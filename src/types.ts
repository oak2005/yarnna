export interface User {
  id: string;
  username: string;
  email: string;
  display_name: string;
  avatar_url: string;
  bio: string;
  location: string;
  role: 'user' | 'moderator' | 'admin' | 'super_admin';
  status: 'active' | 'suspended' | 'banned' | 'restricted';
  posting_restricted_until: string | null;
  messaging_restricted_until: string | null;
  acknowledged_testnet_notice_at: string | null;
  preferred_language: 'en' | 'pcm' | 'yo' | 'ig' | 'ha';
  created_at: string;
  followers_count?: number;
  following_count?: number;
  posts_count?: number;
  is_following?: boolean;
  is_blocked?: boolean;
}

export interface Post {
  id: string;
  author_id: string;
  content: string;
  reply_to_post_id: string | null;
  repost_of_post_id: string | null;
  photo_url: string | null;
  photo_caption: string | null;
  likes_count: number;
  reposts_count: number;
  replies_count: number;
  bookmarks_count: number;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
  author: {
    id: string;
    username: string;
    display_name: string;
    avatar_url: string;
    location: string;
  };
  is_liked: boolean;
  is_reposted: boolean;
  is_bookmarked: boolean;
  original_post?: Post | null;
  reply_to?: {
    id: string;
    content: string;
    author: {
      id: string;
      username: string;
      display_name: string;
    } | null;
  } | null;
}

export interface Conversation {
  id: string;
  type: 'direct' | 'group';
  name: string | null;
  avatar_url: string | null;
  is_muted: boolean;
  unread_count: number;
  participants: Array<{
    user_id: string;
    role: 'admin' | 'member';
    is_muted: boolean;
    username: string;
    display_name: string;
    avatar_url: string;
  }>;
  last_message: {
    id: string;
    sender_id: string;
    message_type: 'text' | 'photo' | 'voice_note';
    content: string;
    created_at: string;
  } | null;
  updated_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_name: string;
  sender_avatar: string;
  is_self: boolean;
  message_type: 'text' | 'photo' | 'voice_note';
  content: string;
  media_url: string | null;
  voice_duration_seconds: number | null;
  reply_to?: {
    id: string;
    sender_name: string;
    content: string;
    type: string;
  } | null;
  is_forwarded: boolean;
  is_edited: boolean;
  created_at: string;
  status: 'sent' | 'delivered' | 'read';
}

export interface Report {
  id: string;
  reporter_id: string;
  reporter_username: string;
  target_type: 'post' | 'user' | 'message';
  target_id: string;
  category: string;
  reason: string;
  status: 'pending' | 'investigating' | 'resolved' | 'dismissed';
  assigned_to: string | null;
  resolution_notes: string | null;
  created_at: string;
  resolved_at: string | null;
  target_details?: any;
}

export interface AdminMetrics {
  timezone: string;
  currentTime: string;
  users: {
    total: number;
    signups_today: number;
    signups_7d: number;
    signups_30d: number;
    dau: number;
    wau: number;
    mau: number;
    active_sessions: number;
  };
  activity: {
    posts_today: number;
    photos_uploaded_today: number;
    voice_notes_uploaded_today: number;
    aggregate_messages_sent: number;
  };
  storage: {
    used_mb: number;
    quota_mb: number;
    percentage: string;
    bandwidth_used_mb: string;
  };
  moderation: {
    pending_reports: number;
    investigating_reports: number;
    suspended_accounts: number;
    banned_accounts: number;
  };
  translation: {
    cached_entries: number;
    estimated_monthly_cost_usd: number;
  };
  quotas: {
    database_limit: string;
    object_storage_limit: string;
    realtime_connections_limit: string;
    estimated_monthly_cost: string;
    cost_alert_threshold: string;
  };
}

export interface NotificationItem {
  id: string;
  recipient_id: string;
  actor_id: string;
  type: 'like' | 'reply' | 'repost' | 'follow' | 'message' | 'system';
  target_id: string | null;
  content_summary: string;
  is_read: boolean;
  created_at: string;
  actor?: {
    id: string;
    username: string;
    display_name: string;
    avatar_url: string;
  } | null;
}
