import React, { useState } from 'react';
import {
  Heart, MessageCircle, Repeat2, Bookmark, Languages,
  MoreHorizontal, Trash2, Edit3, Flag, Check, CornerDownRight, Send
} from 'lucide-react';
import { Post, User } from '../types';
import { api } from '../api';

interface Props {
  post: Post;
  currentUser: User | null;
  onPostUpdated: () => void;
  onOpenReportModal: (targetType: string, targetId: string) => void;
  onViewProfile: (username: string) => void;
}

export const PostCard: React.FC<Props> = ({
  post,
  currentUser,
  onPostUpdated,
  onOpenReportModal,
  onViewProfile,
}) => {
  const [isLiked, setIsLiked] = useState(post.is_liked);
  const [likesCount, setLikesCount] = useState(post.likes_count);
  const [isReposted, setIsReposted] = useState(post.is_reposted);
  const [repostsCount, setRepostsCount] = useState(post.reposts_count);
  const [isBookmarked, setIsBookmarked] = useState(post.is_bookmarked);
  const [bookmarksCount, setBookmarksCount] = useState(post.bookmarks_count);

  // Translation State
  const [isTranslating, setIsTranslating] = useState(false);
  const [showTranslation, setShowTranslation] = useState(false);
  const [translatedText, setTranslatedText] = useState('');
  const [selectedLang, setSelectedLang] = useState('pcm');

  // Reply & Threading State
  const [showReplies, setShowReplies] = useState(false);
  const [replies, setReplies] = useState<Post[]>([]);
  const [replyContent, setReplyContent] = useState('');
  const [loadingReplies, setLoadingReplies] = useState(false);
  const [submittingReply, setSubmittingReply] = useState(false);

  // Edit State
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(post.content);
  const [showMenu, setShowMenu] = useState(false);

  const isAuthor = currentUser?.id === post.author_id;
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'super_admin' || currentUser?.role === 'moderator';

  const handleLike = async () => {
    if (!currentUser) return;
    try {
      const res = await api.likePost(post.id);
      setIsLiked(res.liked);
      setLikesCount(res.likes_count);
    } catch (err) {
      console.error('Like failed:', err);
    }
  };

  const handleRepost = async () => {
    if (!currentUser) return;
    try {
      const res = await api.repostPost(post.id);
      setIsReposted(res.reposted);
      setRepostsCount(res.reposts_count);
      onPostUpdated();
    } catch (err) {
      console.error('Repost failed:', err);
    }
  };

  const handleBookmark = async () => {
    if (!currentUser) return;
    try {
      const res = await api.bookmarkPost(post.id);
      setIsBookmarked(res.bookmarked);
      setBookmarksCount(res.bookmarks_count);
    } catch (err) {
      console.error('Bookmark failed:', err);
    }
  };

  const handleTranslate = async (targetLangChoice?: string) => {
    if (showTranslation && !targetLangChoice) {
      setShowTranslation(false);
      return;
    }

    const lang = targetLangChoice || selectedLang;
    setIsTranslating(true);
    try {
      const res = await api.translate(post.content, lang, 'en');
      setTranslatedText(res.translated_text);
      setShowTranslation(true);
    } catch (err) {
      console.error('Translation error:', err);
    } finally {
      setIsTranslating(false);
    }
  };

  const toggleReplies = async () => {
    if (showReplies) {
      setShowReplies(false);
      return;
    }

    setShowReplies(true);
    setLoadingReplies(true);
    try {
      const res = await api.getPost(post.id);
      setReplies(res.replies || []);
    } catch (err) {
      console.error('Failed to load replies:', err);
    } finally {
      setLoadingReplies(false);
    }
  };

  const submitReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyContent.trim() || !currentUser) return;

    setSubmittingReply(true);
    try {
      const res = await api.createPost({
        content: replyContent.trim(),
        reply_to_post_id: post.id,
      });
      setReplies([...replies, res.post]);
      setReplyContent('');
      onPostUpdated();
    } catch (err) {
      console.error('Failed to submit reply:', err);
    } finally {
      setSubmittingReply(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editContent.trim()) return;
    try {
      await api.editPost(post.id, editContent.trim());
      post.content = editContent.trim();
      setIsEditing(false);
      onPostUpdated();
    } catch (err) {
      console.error('Edit failed:', err);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this yarn?')) return;
    try {
      await api.deletePost(post.id);
      onPostUpdated();
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  const formatTime = (isoString: string) => {
    const diffMs = Date.now() - new Date(isoString).getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffHours < 1) {
      const diffMins = Math.floor(diffMs / (1000 * 60));
      return `${Math.max(1, diffMins)}m ago`;
    }
    if (diffHours < 24) return `${diffHours}h ago`;
    return new Date(isoString).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  };

  return (
    <div className="post-card">
      <div className="post-avatar-box">
        <img
          src={post.author.avatar_url || 'https://api.dicebear.com/7.x/bottts/svg?seed=user'}
          alt={post.author.display_name}
          className="post-avatar"
          style={{ cursor: 'pointer' }}
          onClick={() => onViewProfile(post.author.username)}
        />
      </div>

      <div className="post-content-box">
        {/* Parent reply indicator */}
        {post.reply_to && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.82rem', color: 'var(--text-light)', marginBottom: '4px' }}>
            <CornerDownRight size={14} />
            <span>Replying to @{post.reply_to.author?.username || 'user'}</span>
          </div>
        )}

        {/* Repost attribution */}
        {post.repost_of_post_id && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.82rem', color: '#059669', fontWeight: '600', marginBottom: '6px' }}>
            <Repeat2 size={15} />
            <span>@{post.author.username} reposted</span>
          </div>
        )}

        <div className="post-header">
          <div className="post-author-row">
            <span
              className="post-author-name"
              style={{ cursor: 'pointer' }}
              onClick={() => onViewProfile(post.author.username)}
            >
              {post.author.display_name}
            </span>
            <span
              className="post-author-handle"
              style={{ cursor: 'pointer' }}
              onClick={() => onViewProfile(post.author.username)}
            >
              @{post.author.username}
            </span>
            <span className="post-time">&bull; {formatTime(post.created_at)}</span>
          </div>

          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowMenu(!showMenu)}
              style={{ color: 'var(--text-light)', padding: '4px' }}
              aria-label="Post options"
            >
              <MoreHorizontal size={18} />
            </button>

            {showMenu && (
              <div style={{
                position: 'absolute',
                right: 0,
                top: '100%',
                backgroundColor: 'var(--bg-card)',
                boxShadow: 'var(--shadow-md)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)',
                padding: '6px',
                zIndex: 25,
                minWidth: '160px',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px'
              }}>
                {isAuthor && (
                  <button
                    onClick={() => { setIsEditing(true); setShowMenu(false); }}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', fontSize: '0.88rem', color: 'var(--text-main)', width: '100%', textAlign: 'left', borderRadius: '6px' }}
                  >
                    <Edit3 size={15} /> Edit post
                  </button>
                )}

                {(isAuthor || isAdmin) && (
                  <button
                    onClick={() => { handleDelete(); setShowMenu(false); }}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', fontSize: '0.88rem', color: 'var(--accent-red)', width: '100%', textAlign: 'left', borderRadius: '6px' }}
                  >
                    <Trash2 size={15} /> Delete post
                  </button>
                )}

                <button
                  onClick={() => { onOpenReportModal('post', post.id); setShowMenu(false); }}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', fontSize: '0.88rem', color: 'var(--text-muted)', width: '100%', textAlign: 'left', borderRadius: '6px' }}
                >
                  <Flag size={15} /> Report yarn
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Post Text or Edit Form */}
        {isEditing ? (
          <div style={{ margin: '8px 0' }}>
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: '8px',
                border: '1px solid var(--primary)',
                background: 'var(--bg-input)',
                color: 'var(--text-main)',
                fontSize: '0.98rem',
                minHeight: '80px',
                resize: 'none',
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px' }}>
              <button
                onClick={() => setIsEditing(false)}
                style={{ padding: '6px 14px', borderRadius: 'var(--radius-full)', fontSize: '0.86rem', color: 'var(--text-muted)' }}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                style={{ padding: '6px 16px', borderRadius: 'var(--radius-full)', fontSize: '0.86rem', backgroundColor: 'var(--primary)', color: 'white', fontWeight: '700' }}
              >
                Save
              </button>
            </div>
          </div>
        ) : (
          <p className="post-text">{post.content}</p>
        )}

        {/* Photo Attachment (if present) */}
        {post.photo_url && (
          <div>
            <img
              src={post.photo_url}
              alt={post.photo_caption || 'Post image'}
              className="post-media-img"
              loading="lazy"
            />
            {post.photo_caption && (
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '8px', fontStyle: 'italic' }}>
                {post.photo_caption}
              </p>
            )}
          </div>
        )}

        {/* Translation Widget */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '4px 0' }}>
          <button
            onClick={() => handleTranslate()}
            className="btn-translate-toggle"
            disabled={isTranslating}
          >
            <Languages size={14} />
            <span>{isTranslating ? 'Translating...' : showTranslation ? 'Hide Translation' : 'Translate'}</span>
          </button>

          {!showTranslation && (
            <select
              value={selectedLang}
              onChange={(e) => {
                setSelectedLang(e.target.value);
                handleTranslate(e.target.value);
              }}
              style={{
                fontSize: '0.76rem',
                background: 'transparent',
                border: '1px solid var(--border-subtle)',
                borderRadius: '4px',
                color: 'var(--text-muted)',
                padding: '2px 4px',
              }}
            >
              <option value="pcm">From Nigerian Pidgin</option>
              <option value="yo">From Yoruba</option>
              <option value="ha">From Hausa</option>
              <option value="ig">From Igbo</option>
            </select>
          )}
        </div>

        {/* Translated Text Container */}
        {showTranslation && (
          <div className="translation-box">
            <div className="translation-label">
              <span>Translated to English</span>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Original preserved above</span>
            </div>
            <p style={{ color: 'var(--text-main)', fontWeight: '500' }}>{translatedText}</p>
          </div>
        )}

        {/* Post Actions Bar */}
        <div className="post-actions-row">
          {/* Reply */}
          <button onClick={toggleReplies} className="action-btn" aria-label="Reply to post">
            <MessageCircle size={18} />
            <span>{post.replies_count + replies.length}</span>
          </button>

          {/* Repost */}
          <button
            onClick={handleRepost}
            className={`action-btn ${isReposted ? 'reposted' : ''}`}
            aria-label="Repost"
          >
            <Repeat2 size={18} />
            <span>{repostsCount}</span>
          </button>

          {/* Like */}
          <button
            onClick={handleLike}
            className={`action-btn ${isLiked ? 'liked' : ''}`}
            aria-label="Like post"
          >
            <Heart size={18} fill={isLiked ? '#E11D48' : 'none'} />
            <span>{likesCount}</span>
          </button>

          {/* Bookmark */}
          <button
            onClick={handleBookmark}
            className={`action-btn ${isBookmarked ? 'bookmarked' : ''}`}
            aria-label="Bookmark post"
          >
            <Bookmark size={18} fill={isBookmarked ? 'var(--accent-gold)' : 'none'} />
            <span>{bookmarksCount}</span>
          </button>
        </div>

        {/* Threaded Replies Section */}
        {showReplies && (
          <div style={{ marginTop: '14px', borderTop: '1px dashed var(--border-subtle)', paddingTop: '12px' }}>
            {/* Inline reply form */}
            {currentUser && (
              <form onSubmit={submitReply} style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
                <input
                  type="text"
                  placeholder="Yarn your reply..."
                  value={replyContent}
                  onChange={(e) => setReplyContent(e.target.value)}
                  style={{
                    flex: 1,
                    padding: '8px 14px',
                    borderRadius: 'var(--radius-full)',
                    border: '1px solid var(--border-subtle)',
                    background: 'var(--bg-input)',
                    fontSize: '0.9rem',
                  }}
                />
                <button
                  type="submit"
                  disabled={!replyContent.trim() || submittingReply}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 'var(--radius-full)',
                    backgroundColor: 'var(--primary)',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '0.85rem',
                    fontWeight: '700',
                    opacity: !replyContent.trim() ? 0.5 : 1,
                  }}
                >
                  <Send size={14} /> Reply
                </button>
              </form>
            )}

            {loadingReplies ? (
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'center', padding: '10px' }}>
                Loading thread replies...
              </div>
            ) : replies.length === 0 ? (
              <div style={{ fontSize: '0.85rem', color: 'var(--text-light)', fontStyle: 'italic', padding: '6px 0' }}>
                No replies yet. Be the first to yarn!
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {replies.map((reply) => (
                  <div
                    key={reply.id}
                    style={{
                      padding: '10px 12px',
                      backgroundColor: 'var(--bg-input)',
                      borderRadius: 'var(--radius-md)',
                      display: 'flex',
                      gap: '10px',
                    }}
                  >
                    <img
                      src={reply.author.avatar_url || 'https://api.dicebear.com/7.x/bottts/svg?seed=user'}
                      alt={reply.author.display_name}
                      style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                        <span style={{ fontWeight: '700', fontSize: '0.88rem' }}>{reply.author.display_name}</span>
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>@{reply.author.username}</span>
                        <span style={{ fontSize: '0.74rem', color: 'var(--text-light)' }}>&bull; {formatTime(reply.created_at)}</span>
                      </div>
                      <p style={{ fontSize: '0.92rem', marginTop: '2px', wordBreak: 'break-word' }}>{reply.content}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
