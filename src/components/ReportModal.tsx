import React, { useState } from 'react';
import { Flag, X, AlertTriangle } from 'lucide-react';
import { api } from '../api';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  targetType: string;
  targetId: string;
}

export const ReportModal: React.FC<Props> = ({ isOpen, onClose, targetType, targetId }) => {
  const [category, setCategory] = useState('harassment');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) return;

    setSubmitting(true);
    try {
      await api.submitReport({
        target_type: targetType,
        target_id: targetId,
        category,
        reason: reason.trim(),
      });
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setReason('');
        onClose();
      }, 1500);
    } catch (err: any) {
      alert(err.message || 'Report submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 120 }}>
      <div className="modal-box" style={{ maxWidth: '480px' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Flag size={20} color="var(--accent-red)" />
            <h3 className="modal-title">Report Content or Account</h3>
          </div>
          <button onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {success ? (
          <div style={{ padding: '30px', textAlign: 'center' }}>
            <div style={{ color: '#059669', fontSize: '1.2rem', fontWeight: '700', marginBottom: '8px' }}>
              Report Received
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              Thank you for keeping Yarnna safe. Our community safety team will review this report against our Community Guidelines.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '0.86rem', fontWeight: '600', marginBottom: '4px', display: 'block' }}>
                  Reason for Reporting
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-subtle)',
                    background: 'var(--bg-input)',
                    fontSize: '0.9rem',
                  }}
                >
                  <option value="harassment">Harassment and Targeted Abuse</option>
                  <option value="hate_speech">Hate Speech and Tribal Slurs</option>
                  <option value="scam_fraud">Scams, Ponzi Schemes and Fraud</option>
                  <option value="impersonation">Impersonation of Person or Brand</option>
                  <option value="spam">Spam and Automated Bots</option>
                  <option value="violence_threat">Threats of Violence</option>
                  <option value="csam_grooming">Child Sexual Abuse or Exploitation (Zero Tolerance)</option>
                  <option value="illegal_goods">Illegal Weapons, Narcotics or Goods</option>
                  <option value="other">Other Violation</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.86rem', fontWeight: '600', marginBottom: '4px', display: 'block' }}>
                  Provide Details (Required)
                </label>
                <textarea
                  placeholder="Explain why this violates Yarnna safety rules..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  required
                  maxLength={500}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-subtle)',
                    background: 'var(--bg-input)',
                    fontSize: '0.9rem',
                    minHeight: '100px',
                    resize: 'none',
                  }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.78rem', color: 'var(--text-light)' }}>
                <AlertTriangle size={14} color="var(--accent-gold)" />
                <span>False reports designed to brigade other users are violations of our terms.</span>
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" onClick={onClose} style={{ padding: '8px 16px', color: 'var(--text-muted)' }}>
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || !reason.trim()}
                style={{
                  padding: '8px 22px',
                  borderRadius: 'var(--radius-full)',
                  backgroundColor: 'var(--accent-red)',
                  color: 'white',
                  fontWeight: '700',
                }}
              >
                {submitting ? 'Submitting...' : 'Submit Report'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
