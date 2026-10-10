import { Router, Response } from 'express';
import { db, Conversation, ConversationParticipant, Message } from '../db.js';
import { requireAuth, AuthRequest, rateLimit } from '../auth.js';
import { emitNotification } from '../events.js';

const router = Router();

// GET /api/chats - List conversations for authenticated user
router.get('/', requireAuth, (req: AuthRequest, res: Response) => {
  const currentUserId = req.user!.id;

  // Find all conversations user participates in
  const userParticipations = db.data.conversation_participants.filter(cp => cp.user_id === currentUserId);
  const conversationIds = userParticipations.map(cp => cp.conversation_id);

  const userConversations = db.data.conversations
    .filter(c => conversationIds.includes(c.id))
    .map(c => {
      const participantInfo = userParticipations.find(cp => cp.conversation_id === c.id);
      const allParticipants = db.data.conversation_participants
        .filter(cp => cp.conversation_id === c.id)
        .map(cp => {
          const u = db.data.users.find(user => user.id === cp.user_id);
          return {
            user_id: cp.user_id,
            role: cp.role,
            is_muted: cp.is_muted,
            username: u?.username || 'unknown',
            display_name: u?.display_name || 'Unknown User',
            avatar_url: u?.avatar_url || '',
          };
        });

      // Fetch last message
      const messages = db.data.messages
        .filter(m => m.conversation_id === c.id && !m.is_deleted_for_all)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      const lastMessage = messages[0] || null;

      // Calculate unread count
      let unreadCount = 0;
      if (participantInfo && participantInfo.last_read_message_id) {
        const lastReadIndex = messages.findIndex(m => m.id === participantInfo.last_read_message_id);
        unreadCount = lastReadIndex === -1 ? messages.length : lastReadIndex;
      } else if (messages.length > 0) {
        unreadCount = messages.filter(m => m.sender_id !== currentUserId).length;
      }

      // Title and Avatar resolution for 1-to-1 chats
      let title = c.name;
      let avatarUrl = c.avatar_url;
      if (c.type === 'direct') {
        const otherParticipant = allParticipants.find(p => p.user_id !== currentUserId);
        if (otherParticipant) {
          title = otherParticipant.display_name;
          avatarUrl = otherParticipant.avatar_url;
        }
      }

      return {
        id: c.id,
        type: c.type,
        name: title,
        avatar_url: avatarUrl,
        is_muted: participantInfo?.is_muted || false,
        unread_count: unreadCount,
        participants: allParticipants,
        last_message: lastMessage ? {
          id: lastMessage.id,
          sender_id: lastMessage.sender_id,
          message_type: lastMessage.message_type,
          content: lastMessage.content,
          created_at: lastMessage.created_at,
        } : null,
        updated_at: c.updated_at,
      };
    })
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

  res.json({ conversations: userConversations });
});

// POST /api/chats - Create 1-to-1 or group chat
router.post('/', requireAuth, (req: AuthRequest, res: Response) => {
  const currentUserId = req.user!.id;
  const { type, participant_ids, name, avatar_url } = req.body;

  if (type !== 'direct' && type !== 'group') {
    res.status(400).json({ error: 'Chat type must be direct or group.' });
    return;
  }

  if (type === 'direct') {
    if (!participant_ids || participant_ids.length !== 1) {
      res.status(400).json({ error: 'Direct chat requires exactly one recipient.' });
      return;
    }

    const otherUserId = participant_ids[0];
    if (otherUserId === currentUserId) {
      res.status(400).json({ error: 'Cannot create direct conversation with yourself.' });
      return;
    }

    // Check if direct conversation already exists between these two users
    const existingConv = db.data.conversations.find(c => {
      if (c.type !== 'direct') return false;
      const parts = db.data.conversation_participants.filter(cp => cp.conversation_id === c.id);
      const userIds = parts.map(p => p.user_id);
      return userIds.includes(currentUserId) && userIds.includes(otherUserId);
    });

    if (existingConv) {
      res.json({ conversation_id: existingConv.id, is_existing: true });
      return;
    }
  }

  if (type === 'group' && (!name || !name.trim())) {
    res.status(400).json({ error: 'Group chat must have a name.' });
    return;
  }

  const now = new Date().toISOString();
  const convId = `conv_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

  const newConv: Conversation = {
    id: convId,
    type,
    name: type === 'group' ? name.trim() : null,
    avatar_url: avatar_url || null,
    created_by: currentUserId,
    created_at: now,
    updated_at: now,
  };

  db.data.conversations.unshift(newConv);

  // Add creator
  db.data.conversation_participants.push({
    conversation_id: convId,
    user_id: currentUserId,
    role: type === 'group' ? 'admin' : 'member',
    is_muted: false,
    last_read_message_id: null,
    joined_at: now,
  });

  // Add other participants
  if (Array.isArray(participant_ids)) {
    for (const pid of participant_ids) {
      if (pid !== currentUserId && db.data.users.some(u => u.id === pid)) {
        db.data.conversation_participants.push({
          conversation_id: convId,
          user_id: pid,
          role: 'member',
          is_muted: false,
          last_read_message_id: null,
          joined_at: now,
        });
      }
    }
  }

  db.save();
  res.status(201).json({ conversation_id: convId, is_existing: false });
});

// GET /api/chats/:id/messages - Get messages (strictly checking user participation)
router.get('/:id/messages', requireAuth, (req: AuthRequest, res: Response) => {
  const currentUserId = req.user!.id;
  const conversationId = req.params.id;

  // STRICT PRIVACY CHECK: Is current user a participant in this conversation?
  const isParticipant = db.data.conversation_participants.some(
    cp => cp.conversation_id === conversationId && cp.user_id === currentUserId
  );

  if (!isParticipant) {
    res.status(403).json({ error: 'Access denied. You are not a participant in this conversation.' });
    return;
  }

  const query = (req.query.q as string || '').toLowerCase().trim();

  let messages = db.data.messages
    .filter(m => m.conversation_id === conversationId && !m.is_deleted_for_all)
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  if (query) {
    messages = messages.filter(m => m.content && m.content.toLowerCase().includes(query));
  }

  const formattedMessages = messages.map(m => {
    const sender = db.data.users.find(u => u.id === m.sender_id);
    let replyToSnippet: any = null;

    if (m.reply_to_message_id) {
      const origMsg = db.data.messages.find(orig => orig.id === m.reply_to_message_id);
      if (origMsg) {
        const origSender = db.data.users.find(u => u.id === origMsg.sender_id);
        replyToSnippet = {
          id: origMsg.id,
          sender_name: origSender?.display_name || 'User',
          content: origMsg.content || (origMsg.message_type === 'voice_note' ? 'Voice Note' : 'Photo'),
          type: origMsg.message_type,
        };
      }
    }

    return {
      id: m.id,
      conversation_id: m.conversation_id,
      sender_id: m.sender_id,
      sender_name: sender?.display_name || 'Unknown',
      sender_avatar: sender?.avatar_url || '',
      is_self: m.sender_id === currentUserId,
      message_type: m.message_type,
      content: m.content,
      media_url: m.media_url,
      voice_duration_seconds: m.voice_duration_seconds,
      reply_to: replyToSnippet,
      is_forwarded: m.is_forwarded,
      is_edited: m.is_edited,
      created_at: m.created_at,
      status: 'read', // read receipt state
    };
  });

  res.json({ messages: formattedMessages });
});

// POST /api/chats/:id/messages - Send message (text, photo, voice note)
router.post('/:id/messages', requireAuth, rateLimit(30, 60000), (req: AuthRequest, res: Response) => {
  const currentUserId = req.user!.id;
  const conversationId = req.params.id;

  if (req.user!.messaging_restricted_until && new Date(req.user!.messaging_restricted_until) > new Date()) {
    res.status(403).json({
      error: `Your messaging privilege is temporarily restricted until ${new Date(req.user!.messaging_restricted_until).toLocaleString()}.`,
    });
    return;
  }

  // Check participation
  const isParticipant = db.data.conversation_participants.some(
    cp => cp.conversation_id === conversationId && cp.user_id === currentUserId
  );

  if (!isParticipant) {
    res.status(403).json({ error: 'Access denied. You are not a participant in this conversation.' });
    return;
  }

  const { message_type, content, media_url, voice_duration_seconds, reply_to_message_id, is_forwarded } = req.body;

  if (!['text', 'photo', 'voice_note'].includes(message_type)) {
    res.status(400).json({ error: 'Invalid message type. Only text, photo, or voice_note allowed.' });
    return;
  }

  if (message_type === 'text' && (!content || !content.trim())) {
    res.status(400).json({ error: 'Text message cannot be empty.' });
    return;
  }

  if ((message_type === 'photo' || message_type === 'voice_note') && !media_url) {
    res.status(400).json({ error: 'Media URL required for photos and voice notes.' });
    return;
  }

  // Enforce voice note limit (maximum 120 seconds)
  if (message_type === 'voice_note' && voice_duration_seconds && voice_duration_seconds > 120) {
    res.status(400).json({ error: 'Voice notes are restricted to a maximum duration of 120 seconds.' });
    return;
  }

  const now = new Date().toISOString();
  const newMsg: Message = {
    id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    conversation_id: conversationId,
    sender_id: currentUserId,
    message_type,
    content: (content || '').trim(),
    media_url: media_url || null,
    voice_duration_seconds: voice_duration_seconds ? Math.round(voice_duration_seconds) : null,
    reply_to_message_id: reply_to_message_id || null,
    is_forwarded: !!is_forwarded,
    is_edited: false,
    is_deleted_for_all: false,
    created_at: now,
    updated_at: now,
  };

  db.data.messages.push(newMsg);

  // Update conversation timestamp
  const conv = db.data.conversations.find(c => c.id === conversationId);
  if (conv) {
    conv.updated_at = now;
  }

  // Update sender's last read
  const senderPart = db.data.conversation_participants.find(
    cp => cp.conversation_id === conversationId && cp.user_id === currentUserId
  );
  if (senderPart) {
    senderPart.last_read_message_id = newMsg.id;
  }

  // Notify other participants
  const sender = db.data.users.find(u => u.id === currentUserId);
  const otherParticipants = db.data.conversation_participants.filter(
    cp => cp.conversation_id === conversationId && cp.user_id !== currentUserId && !cp.is_muted
  );
  const summaryText = message_type === 'voice_note'
    ? 'sent you a voice note'
    : message_type === 'photo'
    ? 'sent you a photo'
    : 'sent you a message';

  for (const part of otherParticipants) {
    const msgNotif = {
      id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      recipient_id: part.user_id,
      actor_id: currentUserId,
      type: 'message' as const,
      target_id: conversationId,
      content_summary: summaryText,
      is_read: false,
      created_at: now,
    };
    db.data.notifications.unshift(msgNotif);
    emitNotification({
      ...msgNotif,
      actor: sender ? {
        id: sender.id,
        username: sender.username,
        display_name: sender.display_name,
        avatar_url: sender.avatar_url,
      } : null,
    });
  }

  db.save();

  res.status(201).json({
    message: {
      ...newMsg,
      sender_name: sender?.display_name || 'You',
      sender_avatar: sender?.avatar_url || '',
      is_self: true,
      status: 'sent',
    },
  });
});

// PUT /api/chats/:id/messages/:msgId - Edit text message
router.put('/:id/messages/:msgId', requireAuth, (req: AuthRequest, res: Response) => {
  const currentUserId = req.user!.id;
  const { id: conversationId, msgId } = req.params;

  const msg = db.data.messages.find(m => m.id === msgId && m.conversation_id === conversationId && !m.is_deleted_for_all);
  if (!msg) {
    res.status(404).json({ error: 'Message not found.' });
    return;
  }

  if (msg.sender_id !== currentUserId) {
    res.status(403).json({ error: 'You can only edit your own messages.' });
    return;
  }

  if (msg.message_type !== 'text') {
    res.status(400).json({ error: 'Only text messages can be edited.' });
    return;
  }

  // 15-minute edit window
  const ageMs = Date.now() - new Date(msg.created_at).getTime();
  if (ageMs > 15 * 60 * 1000) {
    res.status(400).json({ error: 'Messages can only be edited within 15 minutes of sending.' });
    return;
  }

  const { content } = req.body;
  if (!content || !content.trim()) {
    res.status(400).json({ error: 'Message content cannot be empty.' });
    return;
  }

  msg.content = content.trim();
  msg.is_edited = true;
  msg.updated_at = new Date().toISOString();
  db.save();

  res.json({ success: true, message: msg });
});

// DELETE /api/chats/:id/messages/:msgId - Delete message
router.delete('/:id/messages/:msgId', requireAuth, (req: AuthRequest, res: Response) => {
  const currentUserId = req.user!.id;
  const { id: conversationId, msgId } = req.params;
  const deleteForAll = req.query.delete_for_all === 'true';

  const msg = db.data.messages.find(m => m.id === msgId && m.conversation_id === conversationId);
  if (!msg) {
    res.status(404).json({ error: 'Message not found.' });
    return;
  }

  if (deleteForAll) {
    if (msg.sender_id !== currentUserId) {
      res.status(403).json({ error: 'Only the sender can delete a message for everyone.' });
      return;
    }
    // 2-hour window for delete-for-all
    const ageMs = Date.now() - new Date(msg.created_at).getTime();
    if (ageMs > 2 * 60 * 60 * 1000) {
      res.status(400).json({ error: 'Delete for everyone is only available within 2 hours of sending.' });
      return;
    }

    msg.is_deleted_for_all = true;
    msg.content = 'This message was deleted';
    msg.media_url = null;
    msg.updated_at = new Date().toISOString();
  }

  db.save();
  res.json({ success: true, message: 'Message deleted successfully.' });
});

// POST /api/chats/:id/read - Mark conversation read
router.post('/:id/read', requireAuth, (req: AuthRequest, res: Response) => {
  const currentUserId = req.user!.id;
  const conversationId = req.params.id;

  const part = db.data.conversation_participants.find(
    cp => cp.conversation_id === conversationId && cp.user_id === currentUserId
  );

  if (part) {
    const messages = db.data.messages
      .filter(m => m.conversation_id === conversationId && !m.is_deleted_for_all)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    if (messages.length > 0) {
      part.last_read_message_id = messages[0].id;
      db.save();
    }
  }

  res.json({ success: true });
});

// POST /api/chats/:id/mute - Toggle mute
router.post('/:id/mute', requireAuth, (req: AuthRequest, res: Response) => {
  const currentUserId = req.user!.id;
  const conversationId = req.params.id;

  const part = db.data.conversation_participants.find(
    cp => cp.conversation_id === conversationId && cp.user_id === currentUserId
  );

  if (!part) {
    res.status(404).json({ error: 'Participant record not found.' });
    return;
  }

  part.is_muted = !part.is_muted;
  db.save();

  res.json({ success: true, is_muted: part.is_muted });
});

// POST /api/chats/:id/participants - Add or remove members in group chat
router.post('/:id/participants', requireAuth, (req: AuthRequest, res: Response) => {
  const currentUserId = req.user!.id;
  const conversationId = req.params.id;
  const { action, target_user_id } = req.body;

  const conv = db.data.conversations.find(c => c.id === conversationId && c.type === 'group');
  if (!conv) {
    res.status(404).json({ error: 'Group conversation not found.' });
    return;
  }

  const currentParticipant = db.data.conversation_participants.find(
    cp => cp.conversation_id === conversationId && cp.user_id === currentUserId
  );

  if (!currentParticipant || currentParticipant.role !== 'admin') {
    res.status(403).json({ error: 'Only group administrators can manage members.' });
    return;
  }

  if (action === 'add') {
    const exists = db.data.conversation_participants.some(
      cp => cp.conversation_id === conversationId && cp.user_id === target_user_id
    );
    if (!exists && db.data.users.some(u => u.id === target_user_id)) {
      db.data.conversation_participants.push({
        conversation_id: conversationId,
        user_id: target_user_id,
        role: 'member',
        is_muted: false,
        last_read_message_id: null,
        joined_at: new Date().toISOString(),
      });
      db.save();
    }
  } else if (action === 'remove') {
    const idx = db.data.conversation_participants.findIndex(
      cp => cp.conversation_id === conversationId && cp.user_id === target_user_id
    );
    if (idx !== -1) {
      db.data.conversation_participants.splice(idx, 1);
      db.save();
    }
  }

  res.json({ success: true });
});

export default router;
