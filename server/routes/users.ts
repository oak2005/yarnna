import { Router, Response } from 'express';
import { db, User } from '../db.js';
import { requireAuth, AuthRequest, generateToken } from '../auth.js';
import { formatPost } from './posts.js';

const router = Router();

// GET /api/users/search - Search users and posts
router.get('/search', (req: AuthRequest, res: Response) => {
  const query = (req.query.q as string || '').toLowerCase().trim();
  if (!query) {
    res.json({ users: [], posts: [] });
    return;
  }

  const matchedUsers = db.data.users
    .filter(u => u.status !== 'banned' && (u.username.toLowerCase().includes(query) || u.display_name.toLowerCase().includes(query) || u.bio.toLowerCase().includes(query)))
    .slice(0, 15)
    .map(u => ({
      id: u.id,
      username: u.username,
      display_name: u.display_name,
      avatar_url: u.avatar_url,
      bio: u.bio,
      location: u.location,
    }));

  const matchedPosts = db.data.posts
    .filter(p => !p.is_deleted && p.content.toLowerCase().includes(query))
    .slice(0, 15)
    .map(p => formatPost(p));

  res.json({ users: matchedUsers, posts: matchedPosts });
});

// GET /api/users/profile/:username - Public Profile
router.get('/profile/:username', (req: AuthRequest, res: Response) => {
  const targetUsername = req.params.username.toLowerCase().trim();
  const user = db.data.users.find(u => u.username.toLowerCase() === targetUsername);

  if (!user || user.status === 'banned') {
    res.status(404).json({ error: 'User profile not found.' });
    return;
  }

  const currentUserId = req.headers.authorization ? getUserIdFromHeader(req.headers.authorization) : undefined;

  const followersCount = db.data.follows.filter(f => f.following_id === user.id).length;
  const followingCount = db.data.follows.filter(f => f.follower_id === user.id).length;
  const postsCount = db.data.posts.filter(p => p.author_id === user.id && !p.is_deleted).length;

  const isFollowing = currentUserId ? db.data.follows.some(f => f.follower_id === currentUserId && f.following_id === user.id) : false;
  const isBlocked = currentUserId ? db.data.blocks.some(b => b.blocker_id === currentUserId && b.blocked_id === user.id) : false;

  const userPosts = db.data.posts
    .filter(p => p.author_id === user.id && !p.is_deleted)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .map(p => formatPost(p, currentUserId));

  res.json({
    user: {
      id: user.id,
      username: user.username,
      display_name: user.display_name,
      avatar_url: user.avatar_url,
      bio: user.bio,
      location: user.location,
      created_at: user.created_at,
      followers_count: followersCount,
      following_count: followingCount,
      posts_count: postsCount,
      is_following: isFollowing,
      is_blocked: isBlocked,
    },
    posts: userPosts,
  });
});

// PUT /api/users/profile - Update current user profile
router.put('/profile', requireAuth, (req: AuthRequest, res: Response) => {
  const user = db.data.users.find(u => u.id === req.user!.id);
  if (!user) {
    res.status(404).json({ error: 'User not found.' });
    return;
  }

  const { username, display_name, bio, location, avatar_url, preferred_language } = req.body;

  if (username !== undefined && typeof username === 'string') {
    const cleanUsername = username.trim().toLowerCase().replace(/^@+/, '').replace(/\s+/g, '_');
    if (!/^[a-z0-9_]{3,30}$/.test(cleanUsername)) {
      res.status(400).json({ error: 'Username must be 3-30 characters (letters only, or letters with numbers or underscores).' });
      return;
    }

    if (cleanUsername !== user.username) {
      // Brand impersonation guard: protect @yarnna* and @customerservice for non-admins
      const isRestricted = db.data.system_settings?.restrict_yarnna_handles ?? true;
      const isAdmin = user.role === 'admin' || user.role === 'super_admin';
      if (isRestricted && !isAdmin) {
        if (cleanUsername.startsWith('yarnna') || cleanUsername === 'customerservice' || cleanUsername === 'customer_service') {
          res.status(400).json({ error: "Usernames starting with 'yarnna' and official customer service handles are currently reserved for verified system accounts." });
          return;
        }
      }

      const isTaken = db.data.users.some(u => u.id !== user.id && u.username.toLowerCase() === cleanUsername);
      if (isTaken) {
        res.status(409).json({ error: `Username @${cleanUsername} is already taken by another account.` });
        return;
      }
      user.username = cleanUsername;
    }
  }

  if (display_name) user.display_name = display_name.trim().slice(0, 60);
  if (typeof bio === 'string') user.bio = bio.trim().slice(0, 200);
  if (typeof location === 'string') user.location = location.trim().slice(0, 100);
  if (typeof avatar_url === 'string') user.avatar_url = avatar_url.trim();
  if (['en', 'pcm', 'yo', 'ig', 'ha'].includes(preferred_language)) {
    user.preferred_language = preferred_language;
  }

  user.updated_at = new Date().toISOString();
  db.save();

  const token = generateToken(user);
  const { password_hash, ...safeUser } = user;
  res.json({ user: safeUser, token });
});

// POST /api/users/:id/follow - Follow or unfollow user
router.post('/:id/follow', requireAuth, (req: AuthRequest, res: Response) => {
  const currentUserId = req.user!.id;
  const targetId = req.params.id;

  if (currentUserId === targetId) {
    res.status(400).json({ error: 'You cannot follow yourself.' });
    return;
  }

  const target = db.data.users.find(u => u.id === targetId);
  if (!target) {
    res.status(404).json({ error: 'User not found.' });
    return;
  }

  const existingIndex = db.data.follows.findIndex(f => f.follower_id === currentUserId && f.following_id === targetId);
  let isFollowing = false;

  if (existingIndex !== -1) {
    db.data.follows.splice(existingIndex, 1);
    isFollowing = false;
  } else {
    db.data.follows.push({
      follower_id: currentUserId,
      following_id: targetId,
      created_at: new Date().toISOString(),
    });
    isFollowing = true;

    // Send notification
    db.data.notifications.unshift({
      id: `notif_${Date.now()}`,
      recipient_id: targetId,
      actor_id: currentUserId,
      type: 'follow',
      target_id: currentUserId,
      content_summary: 'started following your yarn',
      is_read: false,
      created_at: new Date().toISOString(),
    });
  }

  db.save();
  res.json({ is_following: isFollowing });
});

// POST /api/users/:id/block - Block or unblock user
router.post('/:id/block', requireAuth, (req: AuthRequest, res: Response) => {
  const currentUserId = req.user!.id;
  const targetId = req.params.id;

  if (currentUserId === targetId) {
    res.status(400).json({ error: 'You cannot block yourself.' });
    return;
  }

  const existingIndex = db.data.blocks.findIndex(b => b.blocker_id === currentUserId && b.blocked_id === targetId);
  let isBlocked = false;

  if (existingIndex !== -1) {
    db.data.blocks.splice(existingIndex, 1);
    isBlocked = false;
  } else {
    db.data.blocks.push({
      blocker_id: currentUserId,
      blocked_id: targetId,
      created_at: new Date().toISOString(),
    });
    isBlocked = true;

    // Remove any mutual follow relationships
    db.data.follows = db.data.follows.filter(
      f => !(f.follower_id === currentUserId && f.following_id === targetId) &&
           !(f.follower_id === targetId && f.following_id === currentUserId)
    );
  }

  db.save();
  res.json({ is_blocked: isBlocked });
});

// GET /api/users/notifications - User notifications
router.get('/notifications/list', requireAuth, (req: AuthRequest, res: Response) => {
  const currentUserId = req.user!.id;

  const notifs = db.data.notifications
    .filter(n => n.recipient_id === currentUserId)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .map(n => {
      const actor = db.data.users.find(u => u.id === n.actor_id);
      return {
        ...n,
        actor: actor ? {
          id: actor.id,
          username: actor.username,
          display_name: actor.display_name,
          avatar_url: actor.avatar_url,
        } : null,
      };
    });

  res.json({ notifications: notifs });
});

// POST /api/users/notifications/read - Mark all notifications as read
router.post('/notifications/read', requireAuth, (req: AuthRequest, res: Response) => {
  const currentUserId = req.user!.id;
  for (const n of db.data.notifications) {
    if (n.recipient_id === currentUserId) {
      n.is_read = true;
    }
  }
  db.save();
  res.json({ success: true });
});

function getUserIdFromHeader(authHeader: string): string | undefined {
  try {
    const token = authHeader.replace('Bearer ', '');
    const decoded = Buffer.from(token.split('.')[1], 'base64').toString('utf-8');
    const parsed = JSON.parse(decoded);
    return parsed.id;
  } catch {
    return undefined;
  }
}

export default router;
