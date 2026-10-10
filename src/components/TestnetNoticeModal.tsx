import React, { useState } from 'react';
import { ShieldAlert, CheckCircle, X } from 'lucide-react';
import { api } from '../api';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onAcknowledged?: () => void;
  isMandatory?: boolean;
}

export const TestnetNoticeModal: React.FC<Props> = ({ isOpen, onClose, onAcknowledged, isMandatory = false }) => {
  const [isChecked, setIsChecked] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleAcknowledge = async () => {
    setLoading(true);
    try {
      await api.acknowledgeTestnet();
      if (onAcknowledged) onAcknowledged();
      onClose();
    } catch (err) {
      console.error('Failed to acknowledge testnet notice:', err);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 120 }}>
      <div className="modal-box" style={{ maxWidth: '580px', border: '2px solid #FCD34D' }}>
        <div className="modal-header" style={{ backgroundColor: '#FFFBEB' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <ShieldAlert color="#D97706" size={24} />
            <h3 className="modal-title" style={{ color: '#92400E', fontSize: '1.2rem' }}>
              Yarnna Testnet Notice
            </h3>
          </div>
          {!isMandatory && (
            <button onClick={onClose} style={{ color: '#92400E' }}>
              <X size={20} />
            </button>
          )}
        </div>

        <div className="modal-body" style={{ fontSize: '0.96rem', lineHeight: '1.6' }}>
          <div style={{
            backgroundColor: '#FEF3C7',
            padding: '12px 16px',
            borderRadius: '8px',
            marginBottom: '16px',
            fontWeight: '700',
            color: '#B45309'
          }}>
            Yarnna is currently in testnet.
          </div>

          <p style={{ marginBottom: '14px' }}>
            Yarnna is still being tested. Please do not use your personal passwords or passwords from other apps. Do not share sensitive personal information, banking details, verification codes or private information you would not want exposed.
          </p>

          <p style={{ marginBottom: '14px' }}>
            Create a test account using a unique password and only the information required for testing. Never reuse your email password or another account's password.
          </p>

          <p style={{ marginBottom: '14px' }}>
            For now, yarn with your people, test the features and have fun. Features may change, messages or content may be lost, and the service may experience downtime during testing.
          </p>

          <p style={{ marginBottom: '18px' }}>
            Yarnna currently has no advertising or creator revenue payouts. We will announce future monetisation and creator rewards when the platform is ready.
          </p>

          <label style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '10px',
            cursor: 'pointer',
            padding: '12px',
            backgroundColor: 'var(--bg-input)',
            borderRadius: '8px',
            marginTop: '10px'
          }}>
            <input
              type="checkbox"
              checked={isChecked}
              onChange={(e) => setIsChecked(e.target.checked)}
              style={{ marginTop: '4px', width: '18px', height: '18px', accentColor: 'var(--primary)' }}
            />
            <span style={{ fontSize: '0.88rem', fontWeight: '600' }}>
              I have read and acknowledged the testnet safety notice. I agree to test the platform responsibly.
            </span>
          </label>
        </div>

        <div className="modal-footer" style={{ backgroundColor: 'var(--bg-card)' }}>
          {!isMandatory && (
            <button
              onClick={onClose}
              style={{
                padding: '8px 18px',
                borderRadius: 'var(--radius-full)',
                fontWeight: '600',
                color: 'var(--text-muted)'
              }}
            >
              Close
            </button>
          )}
          <button
            onClick={handleAcknowledge}
            disabled={!isChecked || loading}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '10px 22px',
              backgroundColor: isChecked ? 'var(--primary)' : '#9CA3AF',
              color: 'white',
              borderRadius: 'var(--radius-full)',
              fontWeight: '700',
              cursor: isChecked ? 'pointer' : 'not-allowed',
              opacity: isChecked ? 1 : 0.6
            }}
          >
            <CheckCircle size={18} />
            {loading ? 'Saving...' : 'Acknowledge & Continue'}
          </button>
        </div>
      </div>
    </div>
  );
};
