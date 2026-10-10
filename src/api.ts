import { NotificationItem } from './types';

const API_BASE = '/api';

export function getAuthToken(): string | null {
  return localStorage.getItem('yarnna_token');
}

export function setAuthToken(token: string): void {
  localStorage.setItem('yarnna_token', token);
}

export function removeAuthToken(): void {
  localStorage.removeItem('yarnna_token');
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || `Request failed with status ${res.status}`);
  }

  return data as T;
}

export const api = {
  // Auth
  register: (payload: any) => request<any>('/auth/register', { method: 'POST', body: JSON.stringify(payload) }),
  login: (payload: any) => request<any>('/auth/login', { method: 'POST', body: JSON.stringify(payload) }),
  getMe: () => request<any>('/auth/me'),
  acknowledgeTestnet: () => request<any>('/auth/acknowledge-testnet', { method: 'POST' }),

  // Posts & Feed
  getPosts: (type: 'chronological' | 'recommended' = 'chronological', cursor?: string) => {
    const params = new URLSearchParams({ type });
    if (cursor) params.append('cursor', cursor);
    return request<any>(`/posts?${params.toString()}`);
  },
  getPost: (id: string) => request<any>(`/posts/${id}`),
  createPost: (payload: any) => request<any>('/posts', { method: 'POST', body: JSON.stringify(payload) }),
  editPost: (id: string, content: string) => request<any>(`/posts/${id}`, { method: 'PUT', body: JSON.stringify({ content }) }),
  deletePost: (id: string) => request<any>(`/posts/${id}`, { method: 'DELETE' }),
  likePost: (id: string) => request<any>(`/posts/${id}/like`, { method: 'POST' }),
  repostPost: (id: string) => request<any>(`/posts/${id}/repost`, { method: 'POST' }),
  bookmarkPost: (id: string) => request<any>(`/posts/${id}/bookmark`, { method: 'POST' }),

  // Chats
  getConversations: () => request<any>('/chats'),
  createConversation: (payload: any) => request<any>('/chats', { method: 'POST', body: JSON.stringify(payload) }),
  getMessages: (convId: string, q?: string) => {
    const params = q ? `?q=${encodeURIComponent(q)}` : '';
    return request<any>(`/chats/${convId}/messages${params}`);
  },
  sendMessage: (convId: string, payload: any) => request<any>(`/chats/${convId}/messages`, { method: 'POST', body: JSON.stringify(payload) }),
  editMessage: (convId: string, msgId: string, content: string) => request<any>(`/chats/${convId}/messages/${msgId}`, { method: 'PUT', body: JSON.stringify({ content }) }),
  deleteMessage: (convId: string, msgId: string, deleteForAll: boolean = false) => request<any>(`/chats/${convId}/messages/${msgId}?delete_for_all=${deleteForAll}`, { method: 'DELETE' }),
  markChatRead: (convId: string) => request<any>(`/chats/${convId}/read`, { method: 'POST' }),
  toggleMuteChat: (convId: string) => request<any>(`/chats/${convId}/mute`, { method: 'POST' }),
  manageGroupMember: (convId: string, payload: { action: 'add' | 'remove'; target_user_id: string }) => request<any>(`/chats/${convId}/participants`, { method: 'POST', body: JSON.stringify(payload) }),

  // Users & Profiles
  getProfile: (username: string) => request<any>(`/users/profile/${username}`),
  updateProfile: async (payload: any) => {
    const res = await request<any>('/users/profile', { method: 'PUT', body: JSON.stringify(payload) });
    if (res.token) {
      setAuthToken(res.token);
    }
    return res;
  },
  toggleFollow: (userId: string) => request<any>(`/users/${userId}/follow`, { method: 'POST' }),
  toggleBlock: (userId: string) => request<any>(`/users/${userId}/block`, { method: 'POST' }),
  search: (q: string) => request<any>(`/users/search?q=${encodeURIComponent(q)}`),
  getNotifications: (filter: string = 'all') =>
    request<{ notifications: NotificationItem[]; unread_count: number }>(`/users/notifications/list?filter=${encodeURIComponent(filter)}`),
  getUnreadNotificationCount: () =>
    request<{ unread_count: number }>('/users/notifications/unread-count'),
  markNotificationsRead: (id?: string) =>
    request<{ success: boolean; unread_count: number }>('/users/notifications/read', {
      method: 'POST',
      body: JSON.stringify({ id }),
    }),
  deleteNotification: (id: string) =>
    request<{ success: boolean; unread_count: number }>(`/users/notifications/${id}`, { method: 'DELETE' }),
  clearAllNotifications: () =>
    request<{ success: boolean; unread_count: number }>('/users/notifications/clear-all', { method: 'POST' }),
  subscribeNotificationsStream: (onNotification: (notif: NotificationItem) => void): (() => void) => {
    const token = getAuthToken();
    if (!token) return () => {};

    let eventSource: EventSource | null = null;
    let isClosed = false;
    let reconnectTimeout: any = null;

    const connect = () => {
      if (isClosed) return;
      try {
        const streamUrl = `${API_BASE}/users/notifications/stream?token=${encodeURIComponent(token)}`;
        eventSource = new EventSource(streamUrl);

        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data && data.id) {
              onNotification(data);
            }
          } catch {
            // Heartbeat or comment ping
          }
        };

        eventSource.onerror = () => {
          if (eventSource) {
            eventSource.close();
            eventSource = null;
          }
          if (!isClosed) {
            reconnectTimeout = setTimeout(connect, 4000);
          }
        };
      } catch {
        if (!isClosed) {
          reconnectTimeout = setTimeout(connect, 4000);
        }
      }
    };

    connect();

    return () => {
      isClosed = true;
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (eventSource) {
        eventSource.close();
        eventSource = null;
      }
    };
  },

  // Translation
  translate: (text: string, source_lang: string = 'pcm', target_lang: string = 'en') =>
    request<any>('/translate', { method: 'POST', body: JSON.stringify({ text, source_lang, target_lang }) }),
  getTranslationEval: () => request<any>('/translate/eval'),

  // Safety & Reports
  submitReport: (payload: any) => request<any>('/reports', { method: 'POST', body: JSON.stringify(payload) }),
  submitAppeal: (payload: any) => request<any>('/reports/appeal', { method: 'POST', body: JSON.stringify(payload) }),

  // Admin Portal
  getAdminMetrics: () => request<any>('/admin/metrics'),
  getAdminReports: () => request<any>('/admin/reports'),
  actionAdminReport: (id: string, action: string, resolution_notes: string) =>
    request<any>(`/admin/reports/${id}/action`, { method: 'POST', body: JSON.stringify({ action, resolution_notes }) }),
  getAdminUsers: (q?: string) => request<any>(`/admin/users${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  updateUserStatus: (id: string, status: string, reason: string, restriction_hours?: number) =>
    request<any>(`/admin/users/${id}/status`, { method: 'POST', body: JSON.stringify({ status, reason, restriction_hours }) }),
  getAdminAuditLogs: () => request<any>('/admin/audit-logs'),
  getAdminSettings: () => request<any>('/admin/settings'),
  updateAdminSettings: (payload: { restrict_yarnna_handles: boolean; reason?: string }) =>
    request<any>('/admin/settings', { method: 'POST', body: JSON.stringify(payload) }),

  // Upload helper
  uploadPhoto: async (file: File): Promise<string> => {
    // Explicit client-side video check
    if (file.type.startsWith('video/') || /\.(mp4|webm|mov|mkv)$/i.test(file.name)) {
      throw new Error('Video uploads are not supported on Yarnna in this testnet phase.');
    }

    const token = getAuthToken();
    const formData = new FormData();
    formData.append('photo', file);

    const res = await fetch(`${API_BASE}/upload/photo`, {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Photo upload failed');
    return data.url;
  },

  uploadVoice: async (blob: Blob, durationSeconds: number): Promise<string> => {
    const token = getAuthToken();
    const formData = new FormData();
    formData.append('voice', blob, 'voice_note.webm');
    formData.append('duration', durationSeconds.toString());

    const res = await fetch(`${API_BASE}/upload/voice`, {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Voice note upload failed');
    return data.url;
  },
};
