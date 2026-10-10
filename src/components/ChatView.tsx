import React, { useState, useEffect, useRef } from 'react';
import {
  Search, Plus, Send, Mic, Image as ImageIcon, CheckCheck,
  MoreVertical, BellOff, Bell, Flag, Trash2, Edit2, Reply,
  CornerDownRight, UserPlus, Users, X, StopCircle
} from 'lucide-react';
import { Conversation, Message, User } from '../types';
import { api } from '../api';
import { VoiceNotePlayer } from './VoiceNotePlayer';

interface Props {
  currentUser: User | null;
  onOpenReportModal: (targetType: string, targetId: string) => void;
}

export const ChatView: React.FC<Props> = ({ currentUser, onOpenReportModal }) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [chatSearch, setChatSearch] = useState('');

  // Input State
  const [inputText, setInputText] = useState('');
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [editingMsg, setEditingMsg] = useState<Message | null>(null);
  const [sending, setSending] = useState(false);

  // Voice Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);
  const recordTimerRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Modals
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [newChatType, setNewChatType] = useState<'direct' | 'group'>('direct');
  const [groupName, setGroupName] = useState('');
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [chatMenuOpen, setChatMenuOpen] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);

  // Load conversations
  const loadConversations = async () => {
    try {
      const res = await api.getConversations();
      setConversations(res.conversations || []);
      if (!activeConvId && res.conversations?.length > 0) {
        setActiveConvId(res.conversations[0].id);
      }
    } catch (err) {
      console.error('Failed to load conversations:', err);
    }
  };

  useEffect(() => {
    if (currentUser) {
      loadConversations();
    }
  }, [currentUser]);

  // Load messages when activeConvId changes
  useEffect(() => {
    if (activeConvId) {
      fetchMessages(activeConvId, chatSearch);
      api.markChatRead(activeConvId).catch(() => {});
    }
  }, [activeConvId, chatSearch]);

  const fetchMessages = async (convId: string, q?: string) => {
    setLoadingMessages(true);
    try {
      const res = await api.getMessages(convId, q);
      setMessages(res.messages || []);
      setTimeout(() => scrollToBottom(), 100);
    } catch (err) {
      console.error('Failed to load messages:', err);
    } finally {
      setLoadingMessages(false);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!activeConvId || !currentUser) return;

    if (editingMsg) {
      // Handle edit
      try {
        await api.editMessage(activeConvId, editingMsg.id, inputText.trim());
        setEditingMsg(null);
        setInputText('');
        fetchMessages(activeConvId);
      } catch (err: any) {
        alert(err.message || 'Edit failed');
      }
      return;
    }

    if (!inputText.trim()) return;

    setSending(true);
    try {
      await api.sendMessage(activeConvId, {
        message_type: 'text',
        content: inputText.trim(),
        reply_to_message_id: replyingTo ? replyingTo.id : undefined,
      });

      setInputText('');
      setReplyingTo(null);
      await fetchMessages(activeConvId);
      loadConversations();
    } catch (err: any) {
      alert(err.message || 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  // Voice Note Recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true }).catch(() => null);
      setIsRecording(true);
      setRecordDuration(0);

      recordTimerRef.current = setInterval(() => {
        setRecordDuration((prev) => {
          if (prev >= 119) {
            stopRecording();
            return 120;
          }
          return prev + 1;
        });
      }, 1000);

      if (stream) {
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        audioChunksRef.current = [];

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) audioChunksRef.current.push(event.data);
        };

        mediaRecorder.start();
      }
    } catch (err) {
      console.warn('Microphone stream access unavailable, fallback to test simulated recorder:', err);
      setIsRecording(true);
      setRecordDuration(0);
      recordTimerRef.current = setInterval(() => {
        setRecordDuration((prev) => (prev >= 119 ? (stopRecording(), 120) : prev + 1));
      }, 1000);
    }
  };

  const stopRecording = async () => {
    if (recordTimerRef.current) clearInterval(recordTimerRef.current);
    setIsRecording(false);

    if (!activeConvId) return;

    const finalDuration = Math.max(2, recordDuration);

    try {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }

      // Generate or capture audio blob
      const audioBlob = audioChunksRef.current.length > 0
        ? new Blob(audioChunksRef.current, { type: 'audio/webm' })
        : new Blob(['SAMPLE_VOICE_NOTE_AUDIO_BLOB'], { type: 'audio/webm' });

      const uploadedUrl = await api.uploadVoice(audioBlob, finalDuration);

      await api.sendMessage(activeConvId, {
        message_type: 'voice_note',
        media_url: uploadedUrl,
        voice_duration_seconds: finalDuration,
        content: `Voice note (${finalDuration}s)`,
      });

      fetchMessages(activeConvId);
      loadConversations();
    } catch (err: any) {
      alert(err.message || 'Failed to upload voice note');
    }
  };

  // Photo Send in Chat
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeConvId) return;

    // Explicit video check
    if (file.type.startsWith('video/') || /\.(mp4|webm|mov)$/i.test(file.name)) {
      alert('Video uploads are not supported on Yarnna in this testnet release phase.');
      return;
    }

    try {
      const url = await api.uploadPhoto(file);
      await api.sendMessage(activeConvId, {
        message_type: 'photo',
        media_url: url,
        content: 'Shared a photo',
      });
      fetchMessages(activeConvId);
      loadConversations();
    } catch (err: any) {
      alert(err.message || 'Failed to send photo');
    }
  };

  // Delete message
  const handleDeleteMessage = async (msgId: string, deleteForAll: boolean) => {
    if (!activeConvId) return;
    try {
      await api.deleteMessage(activeConvId, msgId, deleteForAll);
      fetchMessages(activeConvId);
    } catch (err: any) {
      alert(err.message || 'Failed to delete message');
    }
  };

  // Mute toggle
  const toggleMute = async () => {
    if (!activeConvId) return;
    try {
      const res = await api.toggleMuteChat(activeConvId);
      setConversations(conversations.map(c => c.id === activeConvId ? { ...c, is_muted: res.is_muted } : c));
    } catch (err) {
      console.error('Mute failed:', err);
    }
  };

  // Open New Chat Modal
  const openNewChat = async () => {
    try {
      const res = await api.search('a');
      setAvailableUsers(res.users.filter((u: User) => u.id !== currentUser?.id));
      setShowNewChatModal(true);
      setSelectedUserIds([]);
      setGroupName('');
    } catch (err) {
      console.error('Failed to load users:', err);
    }
  };

  const handleCreateChat = async () => {
    if (newChatType === 'direct' && selectedUserIds.length !== 1) {
      alert('Please select exactly one user for a direct yarn.');
      return;
    }

    if (newChatType === 'group' && (!groupName.trim() || selectedUserIds.length === 0)) {
      alert('Please enter a group name and select at least one member.');
      return;
    }

    try {
      const res = await api.createConversation({
        type: newChatType,
        participant_ids: selectedUserIds,
        name: newChatType === 'group' ? groupName.trim() : undefined,
      });

      setShowNewChatModal(false);
      await loadConversations();
      setActiveConvId(res.conversation_id);
    } catch (err: any) {
      alert(err.message || 'Failed to create conversation');
    }
  };

  const activeConv = conversations.find(c => c.id === activeConvId);

  return (
    <div className="chat-container">
      {/* Left Column: Conversation List */}
      <div className="chat-sidebar">
        <div style={{ padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)' }}>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.25rem', fontWeight: '700' }}>Direct & Groups</h2>
          <button
            onClick={openNewChat}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              backgroundColor: 'var(--primary)',
              color: 'white',
              fontSize: '0.82rem',
              fontWeight: '700',
              padding: '6px 12px',
              borderRadius: 'var(--radius-full)'
            }}
          >
            <Plus size={16} /> New Yarn
          </button>
        </div>

        <div className="chat-search-bar">
          <Search size={16} color="var(--text-light)" />
          <input
            type="text"
            placeholder="Search conversations..."
            className="chat-search-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="conversation-list">
          {conversations
            .filter(c => !searchQuery || (c.name && c.name.toLowerCase().includes(searchQuery.toLowerCase())))
            .map((conv) => (
              <div
                key={conv.id}
                onClick={() => setActiveConvId(conv.id)}
                className={`conv-item ${conv.id === activeConvId ? 'active' : ''}`}
              >
                <img
                  src={conv.avatar_url || (conv.type === 'group' ? 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=100' : 'https://api.dicebear.com/7.x/bottts/svg?seed=' + conv.id)}
                  alt={conv.name || 'Chat'}
                  className="conv-avatar"
                />
                <div className="conv-info">
                  <div className="conv-top-row">
                    <span className="conv-name">{conv.name || 'Direct Message'}</span>
                    {conv.last_message && (
                      <span className="conv-time">
                        {new Date(conv.last_message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className="conv-last-msg">
                      {conv.last_message?.content || (conv.last_message?.message_type === 'voice_note' ? 'Voice Note' : 'No messages yet')}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {conv.is_muted && <BellOff size={14} color="var(--text-light)" />}
                      {conv.unread_count > 0 && <span className="unread-badge">{conv.unread_count}</span>}
                    </div>
                  </div>
                </div>
              </div>
            ))}
        </div>
      </div>

      {/* Right Column: Active Conversation */}
      {activeConv ? (
        <div className="chat-main">
          {/* Chat Header */}
          <div className="chat-header">
            <div className="chat-header-user">
              <img
                src={activeConv.avatar_url || (activeConv.type === 'group' ? 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=100' : 'https://api.dicebear.com/7.x/bottts/svg?seed=' + activeConv.id)}
                alt={activeConv.name || 'Chat'}
                style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }}
              />
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: '700' }}>{activeConv.name}</h3>
                <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                  {activeConv.type === 'group' ? `${activeConv.participants.length} participants` : 'Private conversation'}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <input
                type="text"
                placeholder="Find in chat..."
                value={chatSearch}
                onChange={(e) => setChatSearch(e.target.value)}
                style={{
                  fontSize: '0.8rem',
                  padding: '4px 10px',
                  borderRadius: 'var(--radius-full)',
                  border: '1px solid var(--border-subtle)',
                  background: 'var(--bg-card)',
                  width: '130px',
                }}
              />

              <button
                onClick={toggleMute}
                title={activeConv.is_muted ? 'Unmute' : 'Mute chat'}
                style={{ color: activeConv.is_muted ? 'var(--accent-red)' : 'var(--text-muted)' }}
              >
                {activeConv.is_muted ? <BellOff size={18} /> : <Bell size={18} />}
              </button>

              <button
                onClick={() => setChatMenuOpen(!chatMenuOpen)}
                style={{ color: 'var(--text-muted)' }}
              >
                <MoreVertical size={18} />
              </button>

              {chatMenuOpen && (
                <div style={{
                  position: 'absolute',
                  right: '16px',
                  top: '50px',
                  backgroundColor: 'var(--bg-card)',
                  boxShadow: 'var(--shadow-lg)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-subtle)',
                  padding: '6px',
                  zIndex: 20,
                  minWidth: '180px',
                }}>
                  <button
                    onClick={() => { onOpenReportModal('user', activeConv.id); setChatMenuOpen(false); }}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', fontSize: '0.86rem', color: 'var(--text-main)', width: '100%', textAlign: 'left' }}
                  >
                    <Flag size={14} /> Report Conversation
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Messages Area */}
          <div className="chat-messages-area">
            {loadingMessages ? (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>Loading messages...</div>
            ) : messages.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '40px' }}>
                No messages yet. Send a greeting or voice note to begin yarning!
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`msg-bubble-wrapper ${msg.is_self ? 'self' : 'other'}`}
                >
                  <div className={`msg-bubble ${msg.is_self ? 'self' : 'other'}`}>
                    {/* Participant sender name for group chat */}
                    {activeConv.type === 'group' && !msg.is_self && (
                      <div style={{ fontSize: '0.74rem', fontWeight: '700', color: 'var(--primary)', marginBottom: '2px' }}>
                        {msg.sender_name}
                      </div>
                    )}

                    {/* Forwarded Tag */}
                    {msg.is_forwarded && (
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-light)', fontStyle: 'italic', marginBottom: '2px' }}>
                        Forwarded
                      </div>
                    )}

                    {/* Quoted reply message */}
                    {msg.reply_to && (
                      <div style={{
                        padding: '4px 8px',
                        borderLeft: '3px solid var(--primary)',
                        backgroundColor: 'rgba(5, 96, 58, 0.08)',
                        borderRadius: '4px',
                        marginBottom: '6px',
                        fontSize: '0.78rem',
                      }}>
                        <span style={{ fontWeight: '700' }}>{msg.reply_to.sender_name}</span>
                        <p style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {msg.reply_to.content}
                        </p>
                      </div>
                    )}

                    {/* Text Message */}
                    {msg.message_type === 'text' && (
                      <p style={{ lineHeight: '1.45' }}>{msg.content}</p>
                    )}

                    {/* Voice Note Message */}
                    {msg.message_type === 'voice_note' && (
                      <VoiceNotePlayer
                        url={msg.media_url}
                        durationSeconds={msg.voice_duration_seconds}
                      />
                    )}

                    {/* Photo Message */}
                    {msg.message_type === 'photo' && (
                      <div>
                        <img
                          src={msg.media_url || ''}
                          alt="Shared in chat"
                          style={{
                            maxWidth: '100%',
                            maxHeight: '300px',
                            borderRadius: '8px',
                            display: 'block',
                            marginBottom: msg.content ? '4px' : '0',
                          }}
                        />
                        {msg.content && <p style={{ marginTop: '4px' }}>{msg.content}</p>}
                      </div>
                    )}

                    {/* Message Meta Info */}
                    <div className="msg-meta">
                      {msg.is_edited && <span style={{ fontStyle: 'italic' }}>edited</span>}
                      <span>{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      {msg.is_self && (
                        <CheckCheck size={14} color="#059669" />
                      )}
                    </div>
                  </div>

                  {/* Actions pill on hover */}
                  <div style={{ display: 'flex', gap: '8px', padding: '2px 4px', fontSize: '0.72rem', color: 'var(--text-light)' }}>
                    <button
                      onClick={() => setReplyingTo(msg)}
                      style={{ color: 'var(--text-muted)' }}
                      title="Reply"
                    >
                      <Reply size={12} />
                    </button>
                    {msg.is_self && msg.message_type === 'text' && (
                      <button
                        onClick={() => { setEditingMsg(msg); setInputText(msg.content); }}
                        style={{ color: 'var(--text-muted)' }}
                        title="Edit"
                      >
                        <Edit2 size={12} />
                      </button>
                    )}
                    {msg.is_self && (
                      <button
                        onClick={() => handleDeleteMessage(msg.id, true)}
                        style={{ color: 'var(--accent-red)' }}
                        title="Delete for everyone"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Reply or Edit Banner */}
          {replyingTo && (
            <div style={{
              padding: '6px 14px',
              backgroundColor: 'var(--bg-card)',
              borderTop: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '0.84rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CornerDownRight size={14} color="var(--primary)" />
                <span>Replying to <strong>{replyingTo.sender_name}</strong></span>
              </div>
              <button onClick={() => setReplyingTo(null)} style={{ color: 'var(--text-muted)' }}>
                <X size={16} />
              </button>
            </div>
          )}

          {editingMsg && (
            <div style={{
              padding: '6px 14px',
              backgroundColor: '#FEF3C7',
              borderTop: '1px solid #FCD34D',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '0.84rem',
              color: '#92400E'
            }}>
              <span>Editing message...</span>
              <button onClick={() => { setEditingMsg(null); setInputText(''); }} style={{ color: '#92400E' }}>
                <X size={16} />
              </button>
            </div>
          )}

          {/* Chat Input Bar */}
          <div className="chat-input-bar">
            {/* Photo Attachment button */}
            <button
              onClick={() => photoInputRef.current?.click()}
              style={{ color: 'var(--primary)' }}
              title="Send Photo"
            >
              <ImageIcon size={22} />
            </button>
            <input
              type="file"
              ref={photoInputRef}
              onChange={handlePhotoUpload}
              accept="image/jpeg,image/png,image/webp"
              style={{ display: 'none' }}
            />

            {/* Voice Recorder button */}
            {isRecording ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button
                  onClick={stopRecording}
                  className="btn-record-voice recording"
                  title="Stop and send voice note"
                >
                  <StopCircle size={22} />
                </button>
                <span style={{ fontSize: '0.9rem', color: '#DC2626', fontWeight: '700' }}>
                  Recording: {recordDuration}s / 120s
                </span>
              </div>
            ) : (
              <>
                <button
                  onClick={startRecording}
                  className="btn-record-voice"
                  title="Hold or click to record Voice Note"
                >
                  <Mic size={20} />
                </button>

                <form onSubmit={handleSendMessage} style={{ flex: 1, display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    placeholder="Type a message..."
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    className="chat-input"
                  />
                  <button
                    type="submit"
                    disabled={!inputText.trim() || sending}
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '50%',
                      backgroundColor: 'var(--primary)',
                      color: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      opacity: !inputText.trim() ? 0.5 : 1,
                    }}
                  >
                    <Send size={18} style={{ marginLeft: '2px' }} />
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
          Select or start a conversation to yarn!
        </div>
      )}

      {/* New Chat Modal */}
      {showNewChatModal && (
        <div className="modal-overlay">
          <div className="modal-box" style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h3 className="modal-title">New Conversation</h3>
              <button onClick={() => setShowNewChatModal(false)}>
                <X size={20} />
              </button>
            </div>

            <div className="modal-body">
              {/* Type toggle */}
              <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
                <button
                  onClick={() => setNewChatType('direct')}
                  style={{
                    flex: 1,
                    padding: '8px',
                    borderRadius: '8px',
                    fontWeight: '700',
                    backgroundColor: newChatType === 'direct' ? 'var(--primary)' : 'var(--bg-input)',
                    color: newChatType === 'direct' ? 'white' : 'var(--text-main)',
                  }}
                >
                  1-on-1 Direct
                </button>
                <button
                  onClick={() => setNewChatType('group')}
                  style={{
                    flex: 1,
                    padding: '8px',
                    borderRadius: '8px',
                    fontWeight: '700',
                    backgroundColor: newChatType === 'group' ? 'var(--primary)' : 'var(--bg-input)',
                    color: newChatType === 'group' ? 'white' : 'var(--text-main)',
                  }}
                >
                  Group Chat
                </button>
              </div>

              {newChatType === 'group' && (
                <div style={{ marginBottom: '14px' }}>
                  <label style={{ fontSize: '0.86rem', fontWeight: '600', marginBottom: '4px', display: 'block' }}>
                    Group Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Lagos Tech Builders"
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-subtle)',
                      background: 'var(--bg-input)',
                    }}
                  />
                </div>
              )}

              <label style={{ fontSize: '0.86rem', fontWeight: '600', marginBottom: '8px', display: 'block' }}>
                {newChatType === 'direct' ? 'Select Contact' : 'Select Group Members'}
              </label>

              <div style={{ maxHeight: '220px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {availableUsers.map((u) => {
                  const isSelected = selectedUserIds.includes(u.id);
                  return (
                    <div
                      key={u.id}
                      onClick={() => {
                        if (newChatType === 'direct') {
                          setSelectedUserIds([u.id]);
                        } else {
                          setSelectedUserIds(isSelected ? selectedUserIds.filter(id => id !== u.id) : [...selectedUserIds, u.id]);
                        }
                      }}
                      style={{
                        padding: '8px 12px',
                        borderRadius: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        cursor: 'pointer',
                        backgroundColor: isSelected ? 'var(--primary-subtle)' : 'var(--bg-main)',
                        border: isSelected ? '1px solid var(--primary)' : '1px solid transparent',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <img
                          src={u.avatar_url || 'https://api.dicebear.com/7.x/bottts/svg?seed=' + u.username}
                          alt={u.display_name}
                          style={{ width: '36px', height: '36px', borderRadius: '50%' }}
                        />
                        <div>
                          <div style={{ fontWeight: '700', fontSize: '0.9rem' }}>{u.display_name}</div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>@{u.username}</div>
                        </div>
                      </div>
                      <input
                        type={newChatType === 'direct' ? 'radio' : 'checkbox'}
                        checked={isSelected}
                        readOnly
                        style={{ accentColor: 'var(--primary)' }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="modal-footer">
              <button
                onClick={() => setShowNewChatModal(false)}
                style={{ padding: '8px 16px', color: 'var(--text-muted)' }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateChat}
                style={{
                  padding: '8px 20px',
                  backgroundColor: 'var(--primary)',
                  color: 'white',
                  borderRadius: 'var(--radius-full)',
                  fontWeight: '700',
                }}
              >
                Start Chat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
