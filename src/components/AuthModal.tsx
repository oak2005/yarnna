import React, { useState } from 'react';
import { X, ShieldAlert, KeyRound, User, Lock, Mail, UserPlus, LogIn } from 'lucide-react';
import { api, setAuthToken } from '../api';
import { User as UserType } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onAuthSuccess: (user: UserType) => void;
}

export const AuthModal: React.FC<Props> = ({ isOpen, onClose, onAuthSuccess }) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');

  // Register fields
  const [regUsername, setRegUsername] = useState('');
  const [regDisplayName, setRegDisplayName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    try {
      const cleanId = identifier.trim().toLowerCase().replace(/^@+/, '');
      const res = await api.login({ identifier: cleanId, password });
      setAuthToken(res.token);
      onAuthSuccess(res.user);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Login failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    try {
      const cleanUser = regUsername.trim().toLowerCase().replace(/^@+/, '').replace(/\s+/g, '_');
      const res = await api.register({
        username: cleanUser,
        display_name: regDisplayName.trim(),
        email: regEmail.trim(),
        password: regPassword,
      });
      setAuthToken(res.token);
      onAuthSuccess(res.user);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="modal-overlay" style={{ zIndex: 110 }}>
      <div className="modal-box" style={{ maxWidth: '480px' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => { setMode('login'); setErrorMsg(null); }}
              style={{
                fontWeight: '700',
                fontSize: '1.05rem',
                color: mode === 'login' ? 'var(--primary)' : 'var(--text-muted)',
                borderBottom: mode === 'login' ? '2px solid var(--primary)' : 'none',
                paddingBottom: '4px',
              }}
            >
              Sign In
            </button>
            <button
              onClick={() => { setMode('register'); setErrorMsg(null); }}
              style={{
                fontWeight: '700',
                fontSize: '1.05rem',
                color: mode === 'register' ? 'var(--primary)' : 'var(--text-muted)',
                borderBottom: mode === 'register' ? '2px solid var(--primary)' : 'none',
                paddingBottom: '4px',
              }}
            >
              Join Testnet
            </button>
          </div>
          <button onClick={onClose} style={{ color: 'var(--text-muted)' }}>
            <X size={20} />
          </button>
        </div>

        {/* Testnet Security Reminder */}
        <div style={{
          backgroundColor: '#FFFBEB',
          padding: '10px 14px',
          borderBottom: '1px solid #FCD34D',
          fontSize: '0.8rem',
          color: '#92400E',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}>
          <ShieldAlert size={18} style={{ flexShrink: 0 }} />
          <span>
            <strong>Testnet Security:</strong> Never use passwords from your bank, email, or other personal accounts.
          </span>
        </div>

        {errorMsg && (
          <div style={{
            margin: '14px 20px 0',
            padding: '10px 14px',
            backgroundColor: '#FEE2E2',
            color: '#DC2626',
            borderRadius: '8px',
            fontSize: '0.86rem',
          }}>
            {errorMsg}
          </div>
        )}

        {mode === 'login' ? (
          <form onSubmit={handleLogin} style={{ padding: '20px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: '600', marginBottom: '4px', display: 'block' }}>
                  Username or Email
                </label>
                <input
                  type="text"
                  placeholder="e.g. tunde_tech"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  required
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-subtle)', background: 'var(--bg-input)' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: '600', marginBottom: '4px', display: 'block' }}>
                  Password
                </label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-subtle)', background: 'var(--bg-input)' }}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-yarn-submit"
                style={{ width: '100%', padding: '12px', marginTop: '6px' }}
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleRegister} style={{ padding: '20px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: '600', marginBottom: '4px', display: 'block' }}>
                  Display Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Babatunde Alabi"
                  value={regDisplayName}
                  onChange={(e) => setRegDisplayName(e.target.value)}
                  required
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-subtle)', background: 'var(--bg-input)' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: '600', marginBottom: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Unique Username</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-light)', fontWeight: '400' }}>letters, numbers, underscores</span>
                </label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <span style={{ position: 'absolute', left: '12px', color: 'var(--text-muted)', fontWeight: '700', fontSize: '0.95rem', pointerEvents: 'none' }}>@</span>
                  <input
                    type="text"
                    placeholder="oyetundun or oyetundun_taiwo"
                    value={regUsername}
                    onChange={(e) => {
                      const val = e.target.value.toLowerCase().replace(/^@+/, '').replace(/\s+/g, '_');
                      setRegUsername(val);
                    }}
                    required
                    style={{ width: '100%', padding: '10px 12px 10px 28px', borderRadius: '8px', border: '1px solid var(--border-subtle)', background: 'var(--bg-input)' }}
                  />
                </div>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                  Can be only name (e.g. oyetundun) or with underscore or numbers (e.g. oyetundun_taiwo, oyetundun12)
                </span>
              </div>

              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: '600', marginBottom: '4px', display: 'block' }}>
                  Email Address
                </label>
                <input
                  type="email"
                  placeholder="baba@example.ng"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  required
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-subtle)', background: 'var(--bg-input)' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: '600', marginBottom: '4px', display: 'block' }}>
                  Testnet Password (min 8 chars)
                </label>
                <input
                  type="password"
                  placeholder="Create a testnet password"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  required
                  minLength={8}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-subtle)', background: 'var(--bg-input)' }}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-yarn-submit"
                style={{ width: '100%', padding: '12px', marginTop: '6px' }}
              >
                {loading ? 'Creating test account...' : 'Create Test Account'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
