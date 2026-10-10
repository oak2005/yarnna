import { Router, Response } from 'express';
import { db, Post, Like, Repost, Bookmark } from '../db.js';
import { requireAuth, AuthRequest, rateLimit } from '../auth.js';
import { emitNotification } from '../events.js';

const router = Router();

// Helper to decorate post with author info, like status, bookmark status, etc.
export function formatPost(post: Post, currentUserId?: string) {
  const author = db.data.users.find(u => u.id === post.author_id);
  const isLiked = currentUserId ? db.data.likes.some(l => l.post_id === post.id && l.user_id === currentUserId) : false;
  const isReposted = currentUserId ? db.data.reposts.some(r => r.post_id === post.id && r.user_id === currentUserId) : false;
  const isBookmarked = currentUserId ? db.data.bookmarks.some(b => b.post_id === post.id && b.user_id === currentUserId) : false;

  let originalPost: any = null;
  if (post.repost_of_post_id) {
    const orig = db.data.posts.find(p => p.id === post.repost_of_post_id && !p.is_deleted);
    if (orig) {
      originalPost = formatPost(orig, currentUserId);
    }
  }

  let replyToPost: any = null;
  if (post.reply_to_post_id) {
    const parent = db.data.posts.find(p => p.id === post.reply_to_post_id && !p.is_deleted);
    if (parent) {
      const parentAuthor = db.data.users.find(u => u.id === parent.author_id);
      replyToPost = {
        id: parent.id,
        content: parent.content,
        author: parentAuthor ? {
          id: parentAuthor.id,
          username: parentAuthor.username,
          display_name: parentAuthor.display_name,
        } : null,
      };
    }
  }

  return {
    ...post,
    author: author ? {
      id: author.id,
      username: author.username,
      display_name: author.display_name,
      avatar_url: author.avatar_url,
      location: author.location,
    } : {
      id: post.author_id,
      username: 'deactivated',
      display_name: 'Deactivated User',
      avatar_url: '',
      location: '',
    },
    is_liked: isLiked,
    is_reposted: isReposted,
    is_bookmarked: isBookmarked,
    original_post: originalPost,
    reply_to: replyToPost,
  };
}

// GET /api/posts - Social Feed (Chronological or Recommended)
router.get('/', (req: AuthRequest, res: Response) => {
  const feedType = (req.query.type as string) || 'chronological';
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
  const cursor = req.query.cursor as string;
  const currentUserId = req.headers.authorization ? getUserIdFromHeader(req.headers.authorization) : undefined;

  // Filter out soft-deleted posts and blocked authors
  let activePosts = db.data.posts.filter(p => !p.is_deleted);

  if (currentUserId) {
    const blockedUserIds = db.data.blocks
      .filter(b => b.blocker_id === currentUserId || b.blocked_id === currentUserId)
      .map(b => b.blocker_id === currentUserId ? b.blocked_id : b.blocker_id);
    activePosts = activePosts.filter(p => !blockedUserIds.includes(p.author_id));
  }

  // Filter out top-level replies from main feed unless requested
  if (req.query.include_replies !== 'true') {
    activePosts = activePosts.filter(p => !p.reply_to_post_id);
  }

  if (feedType === 'recommended') {
    // Recommendation algorithm: balance recency, like count, reply engagement
    activePosts = [...activePosts].sort((a, b) => {
      const scoreA = (a.likes_count * 2) + (a.replies_count * 3) + (a.reposts_count * 2) + (new Date(a.created_at).getTime() / 36000000);
      const scoreB = (b.likes_count * 2) + (b.replies_count * 3) + (b.reposts_count * 2) + (new Date(b.created_at).getTime() / 36000000);
      return scoreB - scoreA;
    });
  } else {
    // Chronological feed
    activePosts = [...activePosts].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  // Cursor pagination
  let startIndex = 0;
  if (cursor) {
    const cursorIndex = activePosts.findIndex(p => p.id === cursor);
    if (cursorIndex !== -1) {
      startIndex = cursorIndex + 1;
    }
  }

  const paginated = activePosts.slice(startIndex, startIndex + limit);
  const nextCursor = paginated.length === limit ? paginated[paginated.length - 1].id : null;

  const formatted = paginated.map(p => formatPost(p, currentUserId));
  res.json({
    posts: formatted,
    next_cursor: nextCursor,
    total_count: activePosts.length,
  });
});

// GET /api/posts/:id - Single Post with Threaded Replies
router.get('/:id', (req: AuthRequest, res: Response) => {
  const currentUserId = req.headers.authorization ? getUserIdFromHeader(req.headers.authorization) : undefined;
  const post = db.data.posts.find(p => p.id === req.params.id && !p.is_deleted);

  if (!post) {
    res.status(404).json({ error: 'Post not found or removed.' });
    return;
  }

  const formatted = formatPost(post, currentUserId);

  // Fetch replies
  const replies = db.data.posts
    .filter(p => p.reply_to_post_id === post.id && !p.is_deleted)
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    .map(p => formatPost(p, currentUserId));

  res.json({
    post: formatted,
    replies,
  });
});

// POST /api/posts - Create Post
router.post('/', requireAuth, rateLimit(15, 60000), (req: AuthRequest, res: Response) => {
  const user = req.user!;

  if (user.posting_restricted_until && new Date(user.posting_restricted_until) > new Date()) {
    res.status(403).json({
      error: `Your posting privilege is temporarily restricted until ${new Date(user.posting_restricted_until).toLocaleString()}.`,
    });
    return;
  }

  const { content, photo_url, photo_caption, reply_to_post_id } = req.body;

  if (!content && !photo_url) {
    res.status(400).json({ error: 'Post must contain text content or a photo.' });
    return;
  }

  if (content && content.length > 500) {
    res.status(400).json({ error: 'Post content exceeds the 500-character limit.' });
    return;
  }

  // Reject any video links
  if (photo_url && (photo_url.endsWith('.mp4') || photo_url.endsWith('.webm') || photo_url.endsWith('.mov'))) {
    res.status(415).json({ error: 'Video uploads and links are not supported on Yarnna in this release phase.' });
    return;
  }

  const now = new Date().toISOString();
  const newPost: Post = {
    id: `post_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    author_id: user.id,
    content: (content || '').trim(),
    reply_to_post_id: reply_to_post_id || null,
    repost_of_post_id: null,
    photo_url: photo_url || null,
    photo_caption: photo_caption ? photo_caption.trim() : null,
    likes_count: 0,
    reposts_count: 0,
    replies_count: 0,
    bookmarks_count: 0,
    is_deleted: false,
    created_at: now,
    updated_at: now,
  };

  db.data.posts.unshift(newPost);

  // If this is a reply, update parent post replies count and notify parent author
  let parentAuthorId: string | null = null;
  if (reply_to_post_id) {
    const parentPost = db.data.posts.find(p => p.id === reply_to_post_id);
    if (parentPost) {
      parentPost.replies_count += 1;
      parentAuthorId = parentPost.author_id;
      if (parentPost.author_id !== user.id) {
        const replyNotif = {
          id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          recipient_id: parentPost.author_id,
          actor_id: user.id,
          type: 'reply' as const,
          target_id: newPost.id,
          content_summary: 'replied to your yarn',
          is_read: false,
          created_at: now,
        };
        db.data.notifications.unshift(replyNotif);
        emitNotification({
          ...replyNotif,
          actor: {
            id: user.id,
            username: user.username,
            display_name: user.display_name,
            avatar_url: user.avatar_url,
          },
        });
      }
    }
  }

  // Detect and notify @mentioned users
  if (newPost.content) {
    const mentionMatches = newPost.content.match(/@([a-zA-Z0-9_]{3,30})/g);
    if (mentionMatches) {
      const seenHandles = new Set<string>();
      for (const m of mentionMatches) {
        const handle = m.substring(1).toLowerCase();
        if (seenHandles.has(handle)) continue;
        seenHandles.add(handle);

        const mentionedUser = db.data.users.find(u => u.username.toLowerCase() === handle && u.status !== 'banned');
        if (mentionedUser && mentionedUser.id !== user.id && mentionedUser.id !== parentAuthorId) {
          const mentionNotif = {
            id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            recipient_id: mentionedUser.id,
            actor_id: user.id,
            type: 'mention' as const,
            target_id: newPost.id,
            content_summary: 'mentioned you in a yarn',
            is_read: false,
            created_at: now,
          };
          db.data.notifications.unshift(mentionNotif);
          emitNotification({
            ...mentionNotif,
            actor: {
              id: user.id,
              username: user.username,
              display_name: user.display_name,
              avatar_url: user.avatar_url,
            },
          });
        }
      }
    }
  }

  db.save();

  res.status(201).json({ post: formatPost(newPost, user.id) });
});

// PUT /api/posts/:id - Edit Post
router.put('/:id', requireAuth, (req: AuthRequest, res: Response) => {
  const user = req.user!;
  const post = db.data.posts.find(p => p.id === req.params.id && !p.is_deleted);

  if (!post) {
    res.status(404).json({ error: 'Post not found.' });
    return;
  }

  if (post.author_id !== user.id) {
    res.status(403).json({ error: 'You are not authorized to edit this post.' });
    return;
  }

  const { content } = req.body;
  if (!content || !content.trim()) {
    res.status(400).json({ error: 'Post content cannot be empty.' });
    return;
  }

  post.content = content.trim();
  post.updated_at = new Date().toISOString();
  db.save();

  res.json({ post: formatPost(post, user.id) });
});

// DELETE /api/posts/:id - Delete Post
router.delete('/:id', requireAuth, (req: AuthRequest, res: Response) => {
  const user = req.user!;
  const post = db.data.posts.find(p => p.id === req.params.id && !p.is_deleted);

  if (!post) {
    res.status(404).json({ error: 'Post not found.' });
    return;
  }

  // Author or admin can delete
  if (post.author_id !== user.id && user.role !== 'admin' && user.role !== 'super_admin' && user.role !== 'moderator') {
    res.status(403).json({ error: 'You are not authorized to delete this post.' });
    return;
  }

  post.is_deleted = true;
  post.updated_at = new Date().toISOString();

  // If this was a reply, decrement parent's count
  if (post.reply_to_post_id) {
    const parent = db.data.posts.find(p => p.id === post.reply_to_post_id);
    if (parent && parent.replies_count > 0) {
      parent.replies_count -= 1;
    }
  }

  db.save();
  res.json({ success: true, message: 'Post successfully deleted.' });
});

// POST /api/posts/:id/like - Like or Unlike Post
router.post('/:id/like', requireAuth, (req: AuthRequest, res: Response) => {
  const user = req.user!;
  const post = db.data.posts.find(p => p.id === req.params.id && !p.is_deleted);

  if (!post) {
    res.status(404).json({ error: 'Post not found.' });
    return;
  }

  const existingIndex = db.data.likes.findIndex(l => l.post_id === post.id && l.user_id === user.id);
  let liked = false;

  if (existingIndex !== -1) {
    // Unlike
    db.data.likes.splice(existingIndex, 1);
    post.likes_count = Math.max(0, post.likes_count - 1);
    liked = false;
  } else {
    // Like
    db.data.likes.push({
      user_id: user.id,
      post_id: post.id,
      created_at: new Date().toISOString(),
    });
    post.likes_count += 1;
    liked = true;

    // Send notification to author if not self
    if (post.author_id !== user.id) {
      const likeNotif = {
        id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        recipient_id: post.author_id,
        actor_id: user.id,
        type: 'like' as const,
        target_id: post.id,
        content_summary: 'liked your yarn',
        is_read: false,
        created_at: new Date().toISOString(),
      };
      db.data.notifications.unshift(likeNotif);
      emitNotification({
        ...likeNotif,
        actor: {
          id: user.id,
          username: user.username,
          display_name: user.display_name,
          avatar_url: user.avatar_url,
        },
      });
    }
  }

  db.save();
  res.json({ liked, likes_count: post.likes_count });
});

// POST /api/posts/:id/repost - Repost content
router.post('/:id/repost', requireAuth, (req: AuthRequest, res: Response) => {
  const user = req.user!;
  const targetPost = db.data.posts.find(p => p.id === req.params.id && !p.is_deleted);

  if (!targetPost) {
    res.status(404).json({ error: 'Post not found.' });
    return;
  }

  const existingIndex = db.data.reposts.findIndex(r => r.post_id === targetPost.id && r.user_id === user.id);
  let reposted = false;

  if (existingIndex !== -1) {
    // Remove repost
    db.data.reposts.splice(existingIndex, 1);
    targetPost.reposts_count = Math.max(0, targetPost.reposts_count - 1);
    // Remove repost post record if exists
    const repostPostIndex = db.data.posts.findIndex(p => p.repost_of_post_id === targetPost.id && p.author_id === user.id);
    if (repostPostIndex !== -1) {
      db.data.posts[repostPostIndex].is_deleted = true;
    }
    reposted = false;
  } else {
    // Add repost
    const now = new Date().toISOString();
    db.data.reposts.push({
      user_id: user.id,
      post_id: targetPost.id,
      created_at: now,
    });
    targetPost.reposts_count += 1;
    reposted = true;

    // Create wrapper post for timeline
    db.data.posts.unshift({
      id: `post_repost_${Date.now()}`,
      author_id: user.id,
      content: '',
      reply_to_post_id: null,
      repost_of_post_id: targetPost.id,
      photo_url: null,
      photo_caption: null,
      likes_count: 0,
      reposts_count: 0,
      replies_count: 0,
      bookmarks_count: 0,
      is_deleted: false,
      created_at: now,
      updated_at: now,
    });

    if (targetPost.author_id !== user.id) {
      const repostNotif = {
        id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        recipient_id: targetPost.author_id,
        actor_id: user.id,
        type: 'repost' as const,
        target_id: targetPost.id,
        content_summary: 'reposted your yarn',
        is_read: false,
        created_at: now,
      };
      db.data.notifications.unshift(repostNotif);
      emitNotification({
        ...repostNotif,
        actor: {
          id: user.id,
          username: user.username,
          display_name: user.display_name,
          avatar_url: user.avatar_url,
        },
      });
    }
  }

  db.save();
  res.json({ reposted, reposts_count: targetPost.reposts_count });
});

// POST /api/posts/:id/bookmark - Bookmark or Unbookmark
router.post('/:id/bookmark', requireAuth, (req: AuthRequest, res: Response) => {
  const user = req.user!;
  const post = db.data.posts.find(p => p.id === req.params.id && !p.is_deleted);

  if (!post) {
    res.status(404).json({ error: 'Post not found.' });
    return;
  }

  const existingIndex = db.data.bookmarks.findIndex(b => b.post_id === post.id && b.user_id === user.id);
  let bookmarked = false;

  if (existingIndex !== -1) {
    db.data.bookmarks.splice(existingIndex, 1);
    post.bookmarks_count = Math.max(0, post.bookmarks_count - 1);
    bookmarked = false;
  } else {
    db.data.bookmarks.push({
      user_id: user.id,
      post_id: post.id,
      created_at: new Date().toISOString(),
    });
    post.bookmarks_count += 1;
    bookmarked = true;
  }

  db.save();
  res.json({ bookmarked, bookmarks_count: post.bookmarks_count });
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
