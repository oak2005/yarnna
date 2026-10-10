import React, { useState, useEffect } from 'react';
import {
  Bell,
  Heart,
  MessageCircle,
  Repeat,
  UserPlus,
  AtSign,
  Send,
  CheckCheck,
  Trash2,
  ExternalLink,
  Shield,
  Clock,
  Sparkles
} from 'lucide-react';
import { NotificationItem, User } from '../types';
import { api } from '../api';

interface NotificationsViewProps {
  currentUser: User | null;
  onViewProfile: (username: string) => void;
  onNavigateToPost?: (postId: string) => void;
  onNavigateToChat?: (conversationId: string) => void;
  onUnreadCountChange?: (count: number) => void;
}

type FilterTab = 'all' | 'mentions' | 'likes' | 'replies' | 'follows' | 'messages';

export const NotificationsView: React.FC<NotificationsViewProps> = ({
  currentUser,
  onViewProfile,
  onNavigateToPost,
  onNavigateToChat,
  onUnreadCountChange,
}) => {
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<boolean>(false);

  const fetchNotifications = async (filter: FilterTab = activeTab) => {
    if (!currentUser) return;
    try {
      setLoading(true);
      const res = await api.getNotifications(filter);
      setNotifications(res.notifications || []);
      setUnreadCount(res.unread_count || 0);
      if (onUnreadCountChange) {
        onUnreadCountChange(res.unread_count || 0);
      }
    } catch (err) {
      console.error('Failed to load notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications(activeTab);
  }, [activeTab, currentUser]);

  // Handle incoming real-time notifications
  useEffect(() => {
    if (!currentUser) return;

    const unsubscribe = api.subscribeNotificationsStream((newNotif: NotificationItem) => {
      // If matches active tab or tab is 'all', prepend to list
      const matchesTab =
        activeTab === 'all' ||
        (activeTab === 'mentions' && newNotif.type === 'mention') ||
        (activeTab === 'likes' && newNotif.type === 'like') ||
        (activeTab === 'replies' && newNotif.type === 'reply') ||
        (activeTab === 'follows' && newNotif.type === 'follow') ||
        (activeTab === 'messages' && newNotif.type === 'message');

      if (matchesTab) {
        setNotifications((prev) => [newNotif, ...prev.filter((n) => n.id !== newNotif.id)]);
      }

      setUnreadCount((prev) => {
        const next = prev + 1;
        if (onUnreadCountChange) onUnreadCountChange(next);
        return next;
      });
    });

    return () => {
      unsubscribe();
    };
  }, [activeTab, currentUser]);

  const handleMarkAllRead = async () => {
    if (actionLoading) return;
    setActionLoading(true);
    try {
      const res = await api.markNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(res.unread_count || 0);
      if (onUnreadCountChange) onUnreadCountChange(res.unread_count || 0);
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleMarkSingleRead = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await api.markNotificationsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
      setUnreadCount(res.unread_count || 0);
      if (onUnreadCountChange) onUnreadCountChange(res.unread_count || 0);
    } catch (err) {
      console.error('Failed to mark notification read:', err);
    }
  };

  const handleDeleteNotification = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await api.deleteNotification(id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      setUnreadCount(res.unread_count || 0);
      if (onUnreadCountChange) onUnreadCountChange(res.unread_count || 0);
    } catch (err) {
      console.error('Failed to delete notification:', err);
    }
  };

  const handleClearAll = async () => {
    if (!window.confirm('Clear all notifications in your feed?')) return;
    setActionLoading(true);
    try {
      await api.clearAllNotifications();
      setNotifications([]);
      setUnreadCount(0);
      if (onUnreadCountChange) onUnreadCountChange(0);
    } catch (err) {
      console.error('Failed to clear notifications:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleNotificationClick = (notif: NotificationItem) => {
    if (!notif.is_read) {
      api.markNotificationsRead(notif.id).catch(() => {});
      setNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, is_read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
      if (onUnreadCountChange) onUnreadCountChange(Math.max(0, unreadCount - 1));
    }

    if (notif.type === 'follow' && notif.actor) {
      onViewProfile(notif.actor.username);
    } else if (notif.type === 'message' && onNavigateToChat && notif.target_id) {
      onNavigateToChat(notif.target_id);
    } else if ((notif.type === 'like' || notif.type === 'reply' || notif.type === 'repost' || notif.type === 'mention') && notif.target_id) {
      if (onNavigateToPost) {
        onNavigateToPost(notif.target_id);
      } else if (notif.actor) {
        onViewProfile(notif.actor.username);
      }
    }
  };

  const formatTimeAgo = (dateStr: string) => {
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHr = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHr / 24);

    if (diffSec < 45) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHr < 24) return `${diffHr}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return new Date(dateStr).toLocaleDateString();
  };

  const renderTypeIcon = (type: string) => {
    switch (type) {
      case 'like':
        return (
          <div style={{
            width: '28px',
            height: '28px',
            borderRadius: '50%',
            backgroundColor: 'rgba(239, 68, 68, 0.15)',
            color: '#EF4444',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <Heart size={15} fill="#EF4444" />
          </div>
        );
      case 'reply':
        return (
          <div style={{
            width: '28px',
            height: '28px',
            borderRadius: '50%',
            backgroundColor: 'rgba(5, 150, 105, 0.15)',
            color: 'var(--primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <MessageCircle size={15} />
          </div>
        );
      case 'repost':
        return (
          <div style={{
            width: '28px',
            height: '28px',
            borderRadius: '50%',
            backgroundColor: 'rgba(16, 185, 129, 0.15)',
            color: '#10B981',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <Repeat size={15} />
          </div>
        );
      case 'follow':
        return (
          <div style={{
            width: '28px',
            height: '28px',
            borderRadius: '50%',
            backgroundColor: 'rgba(59, 130, 246, 0.15)',
            color: '#3B82F6',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <UserPlus size={15} />
          </div>
        );
      case 'mention':
        return (
          <div style={{
            width: '28px',
            height: '28px',
            borderRadius: '50%',
            backgroundColor: 'rgba(139, 92, 246, 0.15)',
            color: '#8B5CF6',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <AtSign size={15} />
          </div>
        );
      case 'message':
        return (
          <div style={{
            width: '28px',
            height: '28px',
            borderRadius: '50%',
            backgroundColor: 'rgba(245, 158, 11, 0.15)',
            color: '#F59E0B',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <Send size={15} />
          </div>
        );
      default:
        return (
          <div style={{
            width: '28px',
            height: '28px',
            borderRadius: '50%',
            backgroundColor: 'rgba(107, 114, 128, 0.15)',
            color: 'var(--text-muted)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <Bell size={15} />
          </div>
        );
    }
  };

  const getActionHeadline = (notif: NotificationItem) => {
    switch (notif.type) {
      case 'like':
        return 'liked your yarn';
      case 'reply':
        return 'replied to your yarn';
      case 'repost':
        return 'reposted your yarn';
      case 'follow':
        return 'started following your yarns';
      case 'mention':
        return 'mentioned you in a yarn';
      case 'message':
        return notif.content_summary || 'sent you a private message';
      default:
        return notif.content_summary || 'sent a notification';
    }
  };

  if (!currentUser) {
    return (
      <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
        <Bell size={48} style={{ margin: '0 auto 16px', opacity: 0.4 }} />
        <h3 style={{ fontSize: '1.2rem', fontWeight: '700', color: 'var(--text-main)', marginBottom: '8px' }}>
          Sign in to see notifications
        </h3>
        <p style={{ fontSize: '0.9rem', maxWidth: '380px', margin: '0 auto' }}>
          Get real-time updates when other people like your yarns, reply to you, mention you, or send you private messages.
        </p>
      </div>
    );
  }

  return (
    <div className="notifications-feed-container" style={{ width: '100%', minHeight: '100%' }}>
      {/* Feed Sub-Header */}
      <div style={{
        padding: '14px 16px',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '10px',
        backgroundColor: 'var(--bg-card)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <h2 style={{ fontSize: '1.15rem', fontWeight: '800', margin: 0, color: 'var(--text-main)' }}>
            Notifications
          </h2>
          {unreadCount > 0 && (
            <span style={{
              backgroundColor: 'var(--primary)',
              color: 'white',
              fontSize: '0.72rem',
              fontWeight: '800',
              padding: '2px 8px',
              borderRadius: 'var(--radius-full)'
            }}>
              {unreadCount} new
            </span>
          )}
          {/* Live pulsing indicator */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            fontSize: '0.72rem',
            color: '#10B981',
            fontWeight: '600',
            marginLeft: '6px'
          }}>
            <span style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: '#10B981',
              display: 'inline-block',
              boxShadow: '0 0 6px #10B981'
            }} />
            <span>Live Real-Time</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {notifications.length > 0 && (
            <>
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  disabled={actionLoading}
                  title="Mark all notifications as read"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '6px 12px',
                    borderRadius: 'var(--radius-full)',
                    backgroundColor: 'var(--bg-input)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-main)',
                    fontSize: '0.78rem',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  <CheckCheck size={14} color="var(--primary)" />
                  <span>Mark all read</span>
                </button>
              )}
              <button
                onClick={handleClearAll}
                disabled={actionLoading}
                title="Clear all notifications"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '6px 10px',
                  borderRadius: 'var(--radius-full)',
                  backgroundColor: 'transparent',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-light)',
                  fontSize: '0.78rem',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                <Trash2 size={13} />
                <span>Clear</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Filter Tabs */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid var(--border-subtle)',
        overflowX: 'auto',
        backgroundColor: 'var(--bg-card)',
        padding: '0 8px'
      }}>
        {[
          { id: 'all', label: 'All', icon: Bell },
          { id: 'mentions', label: 'Mentions', icon: AtSign },
          { id: 'likes', label: 'Likes', icon: Heart },
          { id: 'replies', label: 'Replies', icon: MessageCircle },
          { id: 'follows', label: 'Follows', icon: UserPlus },
          { id: 'messages', label: 'Messages', icon: Send },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as FilterTab)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '12px 14px',
                border: 'none',
                backgroundColor: 'transparent',
                color: isActive ? 'var(--primary)' : 'var(--text-muted)',
                fontWeight: isActive ? '700' : '500',
                fontSize: '0.86rem',
                borderBottom: isActive ? '3px solid var(--primary)' : '3px solid transparent',
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              <Icon size={15} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Notifications List Stream */}
      {loading ? (
        <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: '0.92rem' }}>Loading notifications...</div>
        </div>
      ) : notifications.length === 0 ? (
        <div style={{ padding: '70px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            backgroundColor: 'var(--bg-input)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px'
          }}>
            <Bell size={32} style={{ opacity: 0.5, color: 'var(--primary)' }} />
          </div>
          <h3 style={{ fontSize: '1.15rem', fontWeight: '800', color: 'var(--text-main)', marginBottom: '8px' }}>
            No notifications here yet
          </h3>
          <p style={{ fontSize: '0.88rem', maxWidth: '360px', margin: '0 auto 16px', lineHeight: 1.5 }}>
            {activeTab === 'all'
              ? 'When people like your yarns, reply to you, mention you, or follow you, your updates will pop up here in real time.'
              : `You have no ${activeTab} notifications at the moment.`}
          </p>
        </div>
      ) : (
        <div className="notifications-list" style={{ display: 'flex', flexDirection: 'column' }}>
          {notifications.map((notif) => {
            const isUnread = !notif.is_read;
            const actor = notif.actor;
            const actorAvatar = actor?.avatar_url || 'https://api.dicebear.com/7.x/bottts/svg?seed=' + (actor?.username || 'user');

            return (
              <div
                key={notif.id}
                onClick={() => handleNotificationClick(notif)}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px',
                  padding: '16px',
                  borderBottom: '1px solid var(--border-subtle)',
                  backgroundColor: isUnread ? 'var(--primary-subtle)' : 'var(--bg-card)',
                  cursor: 'pointer',
                  transition: 'background-color 0.15s ease',
                  position: 'relative'
                }}
              >
                {/* Unread indicator bar */}
                {isUnread && (
                  <div style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: '4px',
                    backgroundColor: 'var(--primary)'
                  }} />
                )}

                {/* Type Icon */}
                {renderTypeIcon(notif.type)}

                {/* Actor Avatar */}
                <div
                  style={{ position: 'relative', cursor: 'pointer', flexShrink: 0 }}
                  onClick={(e) => {
                    if (actor?.username) {
                      e.stopPropagation();
                      onViewProfile(actor.username);
                    }
                  }}
                >
                  <img
                    src={actorAvatar}
                    alt={actor?.display_name || 'User'}
                    style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: '50%',
                      objectFit: 'cover',
                      border: '1.5px solid var(--border-subtle)'
                    }}
                  />
                </div>

                {/* Notification Content Body */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.92rem', lineHeight: 1.4, color: 'var(--text-main)' }}>
                    <span
                      onClick={(e) => {
                        if (actor?.username) {
                          e.stopPropagation();
                          onViewProfile(actor.username);
                        }
                      }}
                      style={{
                        fontWeight: '700',
                        color: 'var(--text-main)',
                        cursor: 'pointer',
                        marginRight: '5px'
                      }}
                    >
                      {actor?.display_name || 'Someone'}
                    </span>
                    {actor?.username && (
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.84rem', marginRight: '6px' }}>
                        @{actor.username}
                      </span>
                    )}
                    <span style={{ color: 'var(--text-muted)' }}>
                      {getActionHeadline(notif)}
                    </span>
                  </div>

                  {/* Target preview snippet if available */}
                  {(notif as any).target_preview && (
                    <div style={{
                      marginTop: '8px',
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'var(--bg-input)',
                      color: 'var(--text-muted)',
                      fontSize: '0.84rem',
                      fontStyle: 'italic',
                      lineHeight: 1.4,
                      borderLeft: '3px solid var(--primary)'
                    }}>
                      &ldquo;{(notif as any).target_preview}&rdquo;
                    </div>
                  )}

                  {/* Timestamp & actions */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    marginTop: '8px',
                    fontSize: '0.78rem',
                    color: 'var(--text-light)'
                  }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Clock size={12} />
                      {formatTimeAgo(notif.created_at)}
                    </span>

                    {/* Mark read button */}
                    {isUnread && (
                      <button
                        onClick={(e) => handleMarkSingleRead(notif.id, e)}
                        title="Mark as read"
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--primary)',
                          fontSize: '0.78rem',
                          fontWeight: '600',
                          cursor: 'pointer',
                          padding: '0 4px'
                        }}
                      >
                        Mark read
                      </button>
                    )}

                    {/* Delete button */}
                    <button
                      onClick={(e) => handleDeleteNotification(notif.id, e)}
                      title="Delete notification"
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-light)',
                        fontSize: '0.78rem',
                        cursor: 'pointer',
                        padding: '0 4px'
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {/* Unread dot */}
                {isUnread && (
                  <div style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--primary)',
                    marginTop: '6px',
                    flexShrink: 0
                  }} />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
