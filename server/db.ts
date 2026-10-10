import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';

export interface User {
  id: string;
  username: string;
  email: string;
  password_hash: string;
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
  updated_at: string;
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
}

export interface Like {
  user_id: string;
  post_id: string;
  created_at: string;
}

export interface Repost {
  user_id: string;
  post_id: string;
  created_at: string;
}

export interface Bookmark {
  user_id: string;
  post_id: string;
  created_at: string;
}

export interface Follow {
  follower_id: string;
  following_id: string;
  created_at: string;
}

export interface Block {
  blocker_id: string;
  blocked_id: string;
  created_at: string;
}

export interface Conversation {
  id: string;
  type: 'direct' | 'group';
  name: string | null;
  avatar_url: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ConversationParticipant {
  conversation_id: string;
  user_id: string;
  role: 'admin' | 'member';
  is_muted: boolean;
  last_read_message_id: string | null;
  joined_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  message_type: 'text' | 'photo' | 'voice_note';
  content: string;
  media_url: string | null;
  voice_duration_seconds: number | null;
  reply_to_message_id: string | null;
  is_forwarded: boolean;
  is_edited: boolean;
  is_deleted_for_all: boolean;
  created_at: string;
  updated_at: string;
}

export interface Notification {
  id: string;
  recipient_id: string;
  actor_id: string;
  type: 'like' | 'reply' | 'repost' | 'follow' | 'message' | 'system';
  target_id: string | null;
  content_summary: string;
  is_read: boolean;
  created_at: string;
}

export interface Report {
  id: string;
  reporter_id: string;
  target_type: 'post' | 'user' | 'message';
  target_id: string;
  category: 'harassment' | 'hate_speech' | 'scam_fraud' | 'impersonation' | 'spam' | 'violence_threat' | 'illegal_goods' | 'csam_grooming' | 'other';
  reason: string;
  status: 'pending' | 'investigating' | 'resolved' | 'dismissed';
  assigned_to: string | null;
  resolution_notes: string | null;
  created_at: string;
  resolved_at: string | null;
}

export interface AdminAuditLog {
  id: string;
  admin_id: string;
  action: string;
  resource_type: string;
  resource_id: string;
  reason: string;
  ip_address: string;
  outcome: 'success' | 'denied' | 'failed';
  created_at: string;
}

export interface Appeal {
  id: string;
  user_id: string;
  action_id: string;
  appeal_reason: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewed_by: string | null;
  resolution_notes: string | null;
  created_at: string;
  resolved_at: string | null;
}

export interface DatabaseState {
  users: User[];
  posts: Post[];
  likes: Like[];
  reposts: Repost[];
  bookmarks: Bookmark[];
  follows: Follow[];
  blocks: Block[];
  conversations: Conversation[];
  conversation_participants: ConversationParticipant[];
  messages: Message[];
  notifications: Notification[];
  reports: Report[];
  admin_audit_logs: AdminAuditLog[];
  appeals: Appeal[];
  translation_cache: Record<string, string>;
}

const isVercel = !!process.env.VERCEL;
const DATA_DIR = isVercel ? '/tmp/data' : path.resolve(process.cwd(), 'data');
const DB_FILE = isVercel ? '/tmp/yarnna_db.json' : path.join(DATA_DIR, 'yarnna_db.json');

class DatabaseEngine {
  public data: DatabaseState = {
    users: [],
    posts: [],
    likes: [],
    reposts: [],
    bookmarks: [],
    follows: [],
    blocks: [],
    conversations: [],
    conversation_participants: [],
    messages: [],
    notifications: [],
    reports: [],
    admin_audit_logs: [],
    appeals: [],
    translation_cache: {},
  };

  constructor() {
    this.init();
  }

  private init() {
    if (!fs.existsSync(DATA_DIR)) {
      try {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      } catch (err) {
        console.warn('[DB] Could not create DATA_DIR:', err);
      }
    }

    // On Vercel, if /tmp/yarnna_db.json does not exist, copy from bundled data/yarnna_db.json
    if (isVercel && !fs.existsSync(DB_FILE)) {
      const bundledPath = path.resolve(process.cwd(), 'data', 'yarnna_db.json');
      if (fs.existsSync(bundledPath)) {
        try {
          fs.copyFileSync(bundledPath, DB_FILE);
          console.log('[DB] Copied bundled database to /tmp for Vercel execution');
        } catch (err) {
          console.warn('[DB] Could not copy bundled database to /tmp:', err);
        }
      }
    }

    if (fs.existsSync(DB_FILE)) {
      try {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        this.data = JSON.parse(raw);
        console.log('[DB] Loaded existing database with', this.data.users.length, 'users');
        return;
      } catch (err) {
        console.error('[DB] Error reading existing database file, re-seeding:', err);
      }
    }

    this.seedInitialData();
    this.save();
  }

  public save() {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (err) {
      console.error('[DB] Failed to save database:', err);
    }
  }

  private seedInitialData() {
    console.log('[DB] Seeding Nigeria-First initial dataset for Yarnna testnet...');

    const now = new Date().toISOString();
    const hash = (pwd: string) => bcrypt.hashSync(pwd, 10);

    // Seed Users
    const users: User[] = [
      {
        id: 'usr_admin',
        username: 'admin',
        email: 'admin@yarnna.ng',
        password_hash: hash('YarnnaSuperAdmin2026!'),
        display_name: 'Yarnna Super Admin',
        avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
        bio: 'Core Platform Engineering & Safety Oversight for Yarnna Nigeria Testnet.',
        location: 'Lagos, Nigeria',
        role: 'super_admin',
        status: 'active',
        posting_restricted_until: null,
        messaging_restricted_until: null,
        acknowledged_testnet_notice_at: now,
        preferred_language: 'en',
        created_at: now,
        updated_at: now,
      },
      {
        id: 'usr_moderator',
        username: 'yarnna_safety',
        email: 'safety@yarnna.ng',
        password_hash: hash('YarnnaSafety2026!'),
        display_name: 'Yarnna Community Safety',
        avatar_url: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150',
        bio: 'Protecting our community. Report scams, harassment or violations directly to us.',
        location: 'Abuja, Nigeria',
        role: 'moderator',
        status: 'active',
        posting_restricted_until: null,
        messaging_restricted_until: null,
        acknowledged_testnet_notice_at: now,
        preferred_language: 'en',
        created_at: now,
        updated_at: now,
      },
      {
        id: 'usr_tunde',
        username: 'tunde_tech',
        email: 'tunde@example.ng',
        password_hash: hash('TestnetPass2026!'),
        display_name: 'Tunde Balogun',
        avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
        bio: 'Fullstack builder, open source advocate, coffee lover. Always testing and giving feedback on Yarnna.',
        location: 'Yaba, Lagos',
        role: 'user',
        status: 'active',
        posting_restricted_until: null,
        messaging_restricted_until: null,
        acknowledged_testnet_notice_at: now,
        preferred_language: 'en',
        created_at: now,
        updated_at: now,
      },
      {
        id: 'usr_amina',
        username: 'amina_k',
        email: 'amina@example.ng',
        password_hash: hash('TestnetPass2026!'),
        display_name: 'Amina Kano',
        avatar_url: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=150',
        bio: 'Architect, culture enthusiast, street photographer. Celebrating northern Nigerian architecture.',
        location: 'Kano, Nigeria',
        role: 'user',
        status: 'active',
        posting_restricted_until: null,
        messaging_restricted_until: null,
        acknowledged_testnet_notice_at: now,
        preferred_language: 'ha',
        created_at: now,
        updated_at: now,
      },
      {
        id: 'usr_chioma',
        username: 'chioma_dev',
        email: 'chioma@example.ng',
        password_hash: hash('TestnetPass2026!'),
        display_name: 'Chioma Okonkwo',
        avatar_url: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=150',
        bio: 'Frontend enthusiast, digital creator. Building clean mobile interfaces. Nnoo nu!',
        location: 'Enugu, Nigeria',
        role: 'user',
        status: 'active',
        posting_restricted_until: null,
        messaging_restricted_until: null,
        acknowledged_testnet_notice_at: now,
        preferred_language: 'ig',
        created_at: now,
        updated_at: now,
      },
      {
        id: 'usr_kemi',
        username: 'kemi_yoruba',
        email: 'kemi@example.ng',
        password_hash: hash('TestnetPass2026!'),
        display_name: 'Kemi Adeyemi',
        avatar_url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150',
        bio: 'Storyteller, foodie, and cultural archivist. Bawo ni gbogbo ile!',
        location: 'Ibadan, Nigeria',
        role: 'user',
        status: 'active',
        posting_restricted_until: null,
        messaging_restricted_until: null,
        acknowledged_testnet_notice_at: now,
        preferred_language: 'yo',
        created_at: now,
        updated_at: now,
      },
    ];

    // Seed Posts
    const posts: Post[] = [
      {
        id: 'post_1',
        author_id: 'usr_tunde',
        content: 'Abeg, who sabi where I fit get better laptop for Lagos? Computer Village dey give me different prices today!',
        reply_to_post_id: null,
        repost_of_post_id: null,
        photo_url: null,
        photo_caption: null,
        likes_count: 5,
        reposts_count: 2,
        replies_count: 3,
        bookmarks_count: 1,
        is_deleted: false,
        created_at: new Date(Date.now() - 3600000 * 4).toISOString(),
        updated_at: new Date(Date.now() - 3600000 * 4).toISOString(),
      },
      {
        id: 'post_2',
        author_id: 'usr_amina',
        content: 'Barka da rana! Kano ancient city gates looking magnificent under the afternoon sky. Architecture that has stood for centuries.',
        reply_to_post_id: null,
        repost_of_post_id: null,
        photo_url: 'https://images.unsplash.com/photo-1590766940554-634a7ed41450?w=800',
        photo_caption: 'Historical Kano cityscape and heritage preservation',
        likes_count: 14,
        reposts_count: 4,
        replies_count: 2,
        bookmarks_count: 6,
        is_deleted: false,
        created_at: new Date(Date.now() - 3600000 * 3).toISOString(),
        updated_at: new Date(Date.now() - 3600000 * 3).toISOString(),
      },
      {
        id: 'post_3',
        author_id: 'usr_chioma',
        content: 'Testing Yarnna testnet today! The zero-budget architecture and privacy model makes so much sense for our local ecosystem. Proud to see something tailored for Nigeria first.',
        reply_to_post_id: null,
        repost_of_post_id: null,
        photo_url: null,
        photo_caption: null,
        likes_count: 18,
        reposts_count: 7,
        replies_count: 1,
        bookmarks_count: 4,
        is_deleted: false,
        created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
        updated_at: new Date(Date.now() - 3600000 * 2).toISOString(),
      },
      {
        id: 'post_4',
        author_id: 'usr_kemi',
        content: 'E kaasan gbogbo eniyan! A quick reminder that authenticity in our communities matters more than vanity metrics. Let us yarn with respect.',
        reply_to_post_id: null,
        repost_of_post_id: null,
        photo_url: null,
        photo_caption: null,
        likes_count: 8,
        reposts_count: 1,
        replies_count: 0,
        bookmarks_count: 2,
        is_deleted: false,
        created_at: new Date(Date.now() - 3600000 * 1).toISOString(),
        updated_at: new Date(Date.now() - 3600000 * 1).toISOString(),
      },
      // Threaded Reply to post_1
      {
        id: 'post_reply_1',
        author_id: 'usr_chioma',
        content: 'Check Otigba street inside Computer Village, ask for the direct refurb shops on the first floor. Or check reputable certified outlets to avoid drama.',
        reply_to_post_id: 'post_1',
        repost_of_post_id: null,
        photo_url: null,
        photo_caption: null,
        likes_count: 3,
        reposts_count: 0,
        replies_count: 0,
        bookmarks_count: 0,
        is_deleted: false,
        created_at: new Date(Date.now() - 3600000 * 3.5).toISOString(),
        updated_at: new Date(Date.now() - 3600000 * 3.5).toISOString(),
      },
    ];

    // Seed Follows
    const follows: Follow[] = [
      { follower_id: 'usr_tunde', following_id: 'usr_chioma', created_at: now },
      { follower_id: 'usr_chioma', following_id: 'usr_tunde', created_at: now },
      { follower_id: 'usr_amina', following_id: 'usr_tunde', created_at: now },
      { follower_id: 'usr_kemi', following_id: 'usr_amina', created_at: now },
    ];

    // Seed Likes
    const likes: Like[] = [
      { user_id: 'usr_tunde', post_id: 'post_2', created_at: now },
      { user_id: 'usr_chioma', post_id: 'post_2', created_at: now },
      { user_id: 'usr_chioma', post_id: 'post_1', created_at: now },
      { user_id: 'usr_tunde', post_id: 'post_3', created_at: now },
    ];

    // Seed Conversations (One direct chat + one group chat)
    const conversations: Conversation[] = [
      {
        id: 'conv_direct_tunde_chioma',
        type: 'direct',
        name: null,
        avatar_url: null,
        created_by: 'usr_tunde',
        created_at: new Date(Date.now() - 3600000 * 5).toISOString(),
        updated_at: new Date(Date.now() - 3600000 * 1).toISOString(),
      },
      {
        id: 'conv_group_tech',
        type: 'group',
        name: 'Lagos Tech Yarn & Builders',
        avatar_url: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=150',
        created_by: 'usr_tunde',
        created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
        updated_at: new Date(Date.now() - 3600000 * 2).toISOString(),
      },
    ];

    // Seed Participants
    const participants: ConversationParticipant[] = [
      // Direct
      {
        conversation_id: 'conv_direct_tunde_chioma',
        user_id: 'usr_tunde',
        role: 'member',
        is_muted: false,
        last_read_message_id: 'msg_3',
        joined_at: now,
      },
      {
        conversation_id: 'conv_direct_tunde_chioma',
        user_id: 'usr_chioma',
        role: 'member',
        is_muted: false,
        last_read_message_id: 'msg_3',
        joined_at: now,
      },
      // Group
      {
        conversation_id: 'conv_group_tech',
        user_id: 'usr_tunde',
        role: 'admin',
        is_muted: false,
        last_read_message_id: 'msg_group_2',
        joined_at: now,
      },
      {
        conversation_id: 'conv_group_tech',
        user_id: 'usr_chioma',
        role: 'member',
        is_muted: false,
        last_read_message_id: 'msg_group_2',
        joined_at: now,
      },
      {
        conversation_id: 'conv_group_tech',
        user_id: 'usr_amina',
        role: 'member',
        is_muted: false,
        last_read_message_id: 'msg_group_2',
        joined_at: now,
      },
    ];

    // Seed Messages (including voice note sample)
    const messages: Message[] = [
      {
        id: 'msg_1',
        conversation_id: 'conv_direct_tunde_chioma',
        sender_id: 'usr_tunde',
        message_type: 'text',
        content: 'Hey Chioma! You saw the new testnet deployment? The speed is really fast on mobile data.',
        media_url: null,
        voice_duration_seconds: null,
        reply_to_message_id: null,
        is_forwarded: false,
        is_edited: false,
        is_deleted_for_all: false,
        created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
        updated_at: new Date(Date.now() - 3600000 * 2).toISOString(),
      },
      {
        id: 'msg_2',
        conversation_id: 'conv_direct_tunde_chioma',
        sender_id: 'usr_chioma',
        message_type: 'text',
        content: 'Yes! And the best thing is no video bloat draining battery or bandwidth. Simple and straight to the point.',
        media_url: null,
        voice_duration_seconds: null,
        reply_to_message_id: 'msg_1',
        is_forwarded: false,
        is_edited: false,
        is_deleted_for_all: false,
        created_at: new Date(Date.now() - 3600000 * 1.5).toISOString(),
        updated_at: new Date(Date.now() - 3600000 * 1.5).toISOString(),
      },
      {
        id: 'msg_3',
        conversation_id: 'conv_direct_tunde_chioma',
        sender_id: 'usr_tunde',
        message_type: 'voice_note',
        content: 'Quick update on the meetup plan',
        media_url: 'https://cdn.freesound.org/previews/560/560446_11861866-lq.mp3',
        voice_duration_seconds: 14,
        reply_to_message_id: null,
        is_forwarded: false,
        is_edited: false,
        is_deleted_for_all: false,
        created_at: new Date(Date.now() - 3600000 * 1).toISOString(),
        updated_at: new Date(Date.now() - 3600000 * 1).toISOString(),
      },
      // Group messages
      {
        id: 'msg_group_1',
        conversation_id: 'conv_group_tech',
        sender_id: 'usr_tunde',
        message_type: 'text',
        content: 'Welcome everyone to the Lagos Tech Yarn group! Share your testnet observations here.',
        media_url: null,
        voice_duration_seconds: null,
        reply_to_message_id: null,
        is_forwarded: false,
        is_edited: false,
        is_deleted_for_all: false,
        created_at: new Date(Date.now() - 3600000 * 3).toISOString(),
        updated_at: new Date(Date.now() - 3600000 * 3).toISOString(),
      },
      {
        id: 'msg_group_2',
        conversation_id: 'conv_group_tech',
        sender_id: 'usr_amina',
        message_type: 'photo',
        content: 'Testing photo sharing from Kano! Clean compression.',
        media_url: 'https://images.unsplash.com/photo-1590766940554-634a7ed41450?w=600',
        voice_duration_seconds: null,
        reply_to_message_id: null,
        is_forwarded: false,
        is_edited: false,
        is_deleted_for_all: false,
        created_at: new Date(Date.now() - 3600000 * 2.2).toISOString(),
        updated_at: new Date(Date.now() - 3600000 * 2.2).toISOString(),
      },
    ];

    // Seed Notifications
    const notifications: Notification[] = [
      {
        id: 'notif_1',
        recipient_id: 'usr_tunde',
        actor_id: 'usr_chioma',
        type: 'reply',
        target_id: 'post_1',
        content_summary: 'replied to your post about laptop shops',
        is_read: false,
        created_at: new Date(Date.now() - 3600000 * 3.5).toISOString(),
      },
      {
        id: 'notif_2',
        recipient_id: 'usr_tunde',
        actor_id: 'usr_amina',
        type: 'follow',
        target_id: 'usr_amina',
        content_summary: 'started following your yarn',
        is_read: false,
        created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
      },
    ];

    // Seed Moderation Reports
    const reports: Report[] = [
      {
        id: 'rep_1',
        reporter_id: 'usr_chioma',
        target_type: 'post',
        target_id: 'post_1',
        category: 'other',
        reason: 'Sample test report for QA verification of moderation queue.',
        status: 'pending',
        assigned_to: null,
        resolution_notes: null,
        created_at: new Date(Date.now() - 3600000 * 1.2).toISOString(),
        resolved_at: null,
      },
    ];

    // Seed Admin Audit Logs
    const auditLogs: AdminAuditLog[] = [
      {
        id: 'aud_1',
        admin_id: 'usr_admin',
        action: 'PLATFORM_BOOTSTRAP',
        resource_type: 'system',
        resource_id: 'sys_root',
        reason: 'Initial testnet seeding and RLS policy verification.',
        ip_address: '127.0.0.1',
        outcome: 'success',
        created_at: now,
      },
    ];

    this.data = {
      users,
      posts,
      likes,
      reposts: [],
      bookmarks: [],
      follows,
      blocks: [],
      conversations,
      conversation_participants: participants,
      messages,
      notifications,
      reports,
      admin_audit_logs: auditLogs,
      appeals: [],
      translation_cache: {},
    };
  }
}

export const db = new DatabaseEngine();
