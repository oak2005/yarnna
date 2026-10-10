import { Router, Response, Request } from 'express';
import { db, User } from '../db.js';
import { requireAuth, AuthRequest, generateToken, verifyUserToken } from '../auth.js';
import { formatPost } from './posts.js';
import { notificationEmitter, emitNotification } from '../events.js';

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
    const newNotif = {
      id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      recipient_id: targetId,
      actor_id: currentUserId,
      type: 'follow' as const,
      target_id: currentUserId,
      content_summary: 'started following your yarn',
      is_read: false,
      created_at: new Date().toISOString(),
    };
    db.data.notifications.unshift(newNotif);

    const actor = db.data.users.find(u => u.id === currentUserId);
    emitNotification({
      ...newNotif,
      actor: actor ? {
        id: actor.id,
        username: actor.username,
        display_name: actor.display_name,
        avatar_url: actor.avatar_url,
      } : null,
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

// GET /api/users/notifications/unread-count - Unread notifications count
router.get('/notifications/unread-count', requireAuth, (req: AuthRequest, res: Response) => {
  const currentUserId = req.user!.id;
  const unreadCount = db.data.notifications.filter(n => n.recipient_id === currentUserId && !n.is_read).length;
  res.json({ unread_count: unreadCount });
});

// GET /api/users/notifications/list - User notifications with filtering
router.get('/notifications/list', requireAuth, (req: AuthRequest, res: Response) => {
  const currentUserId = req.user!.id;
  const filter = (req.query.filter as string || 'all').toLowerCase().trim();

  let filtered = db.data.notifications.filter(n => n.recipient_id === currentUserId);

  if (filter === 'mentions') {
    filtered = filtered.filter(n => n.type === 'mention');
  } else if (filter === 'likes') {
    filtered = filtered.filter(n => n.type === 'like');
  } else if (filter === 'replies') {
    filtered = filtered.filter(n => n.type === 'reply');
  } else if (filter === 'follows') {
    filtered = filtered.filter(n => n.type === 'follow');
  } else if (filter === 'messages') {
    filtered = filtered.filter(n => n.type === 'message');
  }

  const unreadCount = db.data.notifications.filter(n => n.recipient_id === currentUserId && !n.is_read).length;

  const notifs = filtered
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .map(n => {
      const actor = db.data.users.find(u => u.id === n.actor_id);
      let targetPreview: string | null = null;
      if (n.target_id) {
        if (n.type === 'like' || n.type === 'reply' || n.type === 'repost' || n.type === 'mention') {
          const post = db.data.posts.find(p => p.id === n.target_id);
          if (post && post.content) {
            targetPreview = post.content.slice(0, 90);
          }
        }
      }
      return {
        ...n,
        actor: actor ? {
          id: actor.id,
          username: actor.username,
          display_name: actor.display_name,
          avatar_url: actor.avatar_url,
        } : null,
        target_preview: targetPreview,
      };
    });

  res.json({ notifications: notifs, unread_count: unreadCount });
});

// POST /api/users/notifications/read - Mark notifications as read (single or all)
router.post('/notifications/read', requireAuth, (req: AuthRequest, res: Response) => {
  const currentUserId = req.user!.id;
  const { id } = req.body || {};

  if (id && typeof id === 'string') {
    const target = db.data.notifications.find(n => n.id === id && n.recipient_id === currentUserId);
    if (target) {
      target.is_read = true;
    }
  } else {
    for (const n of db.data.notifications) {
      if (n.recipient_id === currentUserId) {
        n.is_read = true;
      }
    }
  }
  db.save();
  const unreadCount = db.data.notifications.filter(n => n.recipient_id === currentUserId && !n.is_read).length;
  res.json({ success: true, unread_count: unreadCount });
});

// DELETE /api/users/notifications/:id - Delete a single notification
router.delete('/notifications/:id', requireAuth, (req: AuthRequest, res: Response) => {
  const currentUserId = req.user!.id;
  const targetId = req.params.id;
  const idx = db.data.notifications.findIndex(n => n.id === targetId && n.recipient_id === currentUserId);
  if (idx !== -1) {
    db.data.notifications.splice(idx, 1);
    db.save();
  }
  const unreadCount = db.data.notifications.filter(n => n.recipient_id === currentUserId && !n.is_read).length;
  res.json({ success: true, unread_count: unreadCount });
});

// POST /api/users/notifications/clear-all - Clear all notifications for user
router.post('/notifications/clear-all', requireAuth, (req: AuthRequest, res: Response) => {
  const currentUserId = req.user!.id;
  db.data.notifications = db.data.notifications.filter(n => n.recipient_id !== currentUserId);
  db.save();
  res.json({ success: true, unread_count: 0 });
});

// GET /api/users/notifications/stream - Server-Sent Events stream for real-time notifications
router.get('/notifications/stream', (req: Request, res: Response) => {
  let token = req.query.token as string;
  if (!token && req.headers.authorization) {
    token = req.headers.authorization.replace('Bearer ', '');
  }

  if (!token) {
    res.status(401).json({ error: 'Authentication token required for real-time notifications.' });
    return;
  }

  const user = verifyUserToken(token);
  if (!user) {
    res.status(401).json({ error: 'Invalid or expired session token.' });
    return;
  }

  // Set SSE Headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
    'Access-Control-Allow-Origin': '*',
  });

  res.write(': connected\n\n');

  const onNotification = (notif: any) => {
    if (notif && notif.recipient_id === user.id) {
      try {
        res.write(`data: ${JSON.stringify(notif)}\n\n`);
      } catch (err) {
        console.error('[SSE] Failed to write notification event:', err);
      }
    }
  };

  notificationEmitter.on('notification', onNotification);

  // Heartbeat every 20 seconds
  const heartbeat = setInterval(() => {
    try {
      res.write(': heartbeat\n\n');
    } catch {
      clearInterval(heartbeat);
    }
  }, 20000);

  req.on('close', () => {
    notificationEmitter.off('notification', onNotification);
    clearInterval(heartbeat);
  });
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
