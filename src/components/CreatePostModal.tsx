import React, { useState, useRef } from 'react';
import { X, Image as ImageIcon, AlertCircle } from 'lucide-react';
import { api } from '../api';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onPostCreated: () => void;
}

export const CreatePostModal: React.FC<Props> = ({ isOpen, onClose, onPostCreated }) => {
  const [content, setContent] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoCaption, setPhotoCaption] = useState('');
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMsg(null);

    // Client-side video rejection
    if (file.type.startsWith('video/') || /\.(mp4|webm|mov|mkv)$/i.test(file.name)) {
      setErrorMsg('Video uploads are not supported on Yarnna during this testnet release phase.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    if (file.size > 2.5 * 1024 * 1024) {
      setErrorMsg('Photo file size must not exceed 2.5 MB.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setUploading(true);
    try {
      const url = await api.uploadPhoto(file);
      setPhotoUrl(url);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to upload photo.');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() && !photoUrl) {
      setErrorMsg('Please enter text content or upload a photo.');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    try {
      await api.createPost({
        content: content.trim(),
        photo_url: photoUrl,
        photo_caption: photoCaption.trim() || undefined,
      });
      setContent('');
      setPhotoUrl(null);
      setPhotoCaption('');
      onPostCreated();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to publish yarn.');
    } finally {
      setSubmitting(false);
    }
  };

  const charLeft = 500 - content.length;

  return (
    <div className="modal-overlay" style={{ zIndex: 110 }}>
      <div className="modal-box" style={{ maxWidth: '540px' }}>
        <div className="modal-header">
          <h3 className="modal-title">Create New Yarn</h3>
          <button onClick={onClose} style={{ color: 'var(--text-muted)' }}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {errorMsg && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 14px',
                backgroundColor: '#FEE2E2',
                color: '#DC2626',
                borderRadius: '8px',
                fontSize: '0.88rem',
                marginBottom: '14px',
              }}>
                <AlertCircle size={18} style={{ flexShrink: 0 }} />
                <span>{errorMsg}</span>
              </div>
            )}

            <textarea
              className="composer-textarea"
              placeholder="Wetin dey happen? Share your thoughts, yarn with your people..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              maxLength={500}
              autoFocus
              style={{ minHeight: '120px' }}
            />

            {photoUrl && (
              <div className="composer-preview-img">
                <img src={photoUrl} alt="Uploaded attachment" />
                <button
                  type="button"
                  onClick={() => setPhotoUrl(null)}
                  className="composer-remove-btn"
                  aria-label="Remove photo"
                >
                  <X size={16} />
                </button>
              </div>
            )}

            {photoUrl && (
              <input
                type="text"
                placeholder="Add a photo caption (optional)..."
                value={photoCaption}
                onChange={(e) => setPhotoCaption(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-subtle)',
                  background: 'var(--bg-input)',
                  fontSize: '0.88rem',
                  marginTop: '8px',
                }}
              />
            )}

            {/* Hidden file input */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handlePhotoSelect}
              accept="image/jpeg,image/png,image/webp"
              style={{ display: 'none' }}
            />
          </div>

          <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="composer-action-btn"
                title="Add photo"
              >
                <ImageIcon size={20} />
              </button>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-light)' }}>
                {uploading ? 'Compressing photo...' : 'JPG, PNG, WebP only'}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <span style={{
                fontSize: '0.82rem',
                color: charLeft < 40 ? 'var(--accent-red)' : 'var(--text-light)',
                fontWeight: charLeft < 40 ? '700' : '500',
              }}>
                {charLeft}
              </span>

              <button
                type="submit"
                disabled={(!content.trim() && !photoUrl) || submitting || uploading}
                className="btn-yarn-submit"
              >
                {submitting ? 'Yarning...' : 'Yarn Am!'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
