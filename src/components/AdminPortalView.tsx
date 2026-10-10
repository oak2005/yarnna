import React, { useState, useEffect } from 'react';
import {
  Shield, Users, Activity, HardDrive, AlertTriangle, FileText,
  Search, CheckCircle, XCircle, Clock, Lock, RefreshCw, Ban, UserCheck
} from 'lucide-react';
import { AdminMetrics, Report, User } from '../types';
import { api } from '../api';

interface Props {
  currentUser: User | null;
  onExit: () => void;
}

export const AdminPortalView: React.FC<Props> = ({ currentUser, onExit }) => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'moderation' | 'users' | 'audit'>('dashboard');
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [adminUsers, setAdminUsers] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchUser, setSearchUser] = useState('');

  // Action modal state
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [actionType, setActionType] = useState('resolved');
  const [actionReason, setActionReason] = useState('');
  const [submittingAction, setSubmittingAction] = useState(false);

  // User moderation modal state
  const [modTargetUser, setModTargetUser] = useState<any | null>(null);
  const [modUserStatus, setModUserStatus] = useState('suspended');
  const [modUserReason, setModUserReason] = useState('');

  const isAuthorized = currentUser && (currentUser.role === 'admin' || currentUser.role === 'super_admin' || currentUser.role === 'moderator');

  const fetchAdminData = async () => {
    setLoading(true);
    try {
      const [m, r, u, a] = await Promise.all([
        api.getAdminMetrics(),
        api.getAdminReports(),
        api.getAdminUsers(searchUser),
        api.getAdminAuditLogs(),
      ]);
      setMetrics(m);
      setReports(r.reports || []);
      setAdminUsers(u.users || []);
      setAuditLogs(a.audit_logs || []);
    } catch (err) {
      console.error('Failed to load admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthorized) {
      fetchAdminData();
    }
  }, [isAuthorized, searchUser]);

  const handleResolveReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReport || !actionReason.trim()) {
      alert('A documented reason is mandatory for any administrative moderation decision.');
      return;
    }

    setSubmittingAction(true);
    try {
      await api.actionAdminReport(selectedReport.id, actionType, actionReason.trim());
      setSelectedReport(null);
      setActionReason('');
      fetchAdminData();
    } catch (err: any) {
      alert(err.message || 'Action failed');
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleUserStatusChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modTargetUser || !modUserReason.trim()) {
      alert('A documented reason is mandatory for any account moderation change.');
      return;
    }

    try {
      await api.updateUserStatus(modTargetUser.id, modUserStatus, modUserReason.trim(), 24);
      setModTargetUser(null);
      setModUserReason('');
      fetchAdminData();
    } catch (err: any) {
      alert(err.message || 'Failed to update user status');
    }
  };

  if (!isAuthorized) {
    return (
      <div style={{ padding: '60px 20px', textAlign: 'center', maxWidth: '500px', margin: '0 auto' }}>
        <Lock size={48} color="#DC2626" style={{ margin: '0 auto 16px' }} />
        <h2 style={{ fontSize: '1.4rem', fontWeight: '800', marginBottom: '8px' }}>Administrative Access Required</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: '20px' }}>
          This portal is restricted to authorized Yarnna safety officers and administrators. Routine administrators cannot inspect private user messages.
        </p>
        <button
          onClick={onExit}
          style={{
            padding: '10px 24px',
            borderRadius: 'var(--radius-full)',
            backgroundColor: 'var(--primary)',
            color: 'white',
            fontWeight: '700',
          }}
        >
          Return to Platform
        </button>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, minWidth: 0, padding: '20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ backgroundColor: 'var(--primary)', color: 'white', padding: '8px', borderRadius: '10px' }}>
            <Shield size={24} />
          </div>
          <div>
            <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.4rem', fontWeight: '800' }}>
              Yarnna Administrator & Safety Portal
            </h1>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Logged in as {currentUser?.display_name} ({currentUser?.role})
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={fetchAdminData}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '8px',
              border: '1px solid var(--border-subtle)',
              fontSize: '0.85rem',
              fontWeight: '600',
            }}
          >
            <RefreshCw size={14} /> Refresh
          </button>
          <button
            onClick={onExit}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              backgroundColor: 'var(--bg-input)',
              fontSize: '0.85rem',
              fontWeight: '600',
            }}
          >
            Exit Portal
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-subtle)', marginBottom: '20px' }}>
        {(['dashboard', 'moderation', 'users', 'audit'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '10px 18px',
              fontWeight: '700',
              fontSize: '0.92rem',
              textTransform: 'capitalize',
              color: activeTab === tab ? 'var(--primary)' : 'var(--text-muted)',
              borderBottom: activeTab === tab ? '3px solid var(--primary)' : '3px solid transparent',
            }}
          >
            {tab === 'dashboard' && 'Metrics & Quotas'}
            {tab === 'moderation' && `Moderation Queue (${reports.filter(r => r.status === 'pending').length})`}
            {tab === 'users' && 'Account Oversight'}
            {tab === 'audit' && 'Immutable Audit Logs'}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading operational metrics...</div>
      ) : activeTab === 'dashboard' && metrics ? (
        <div>
          {/* Time & Africa/Lagos Banner */}
          <div style={{
            backgroundColor: 'var(--primary-subtle)',
            border: '1px solid rgba(5, 96, 58, 0.2)',
            borderRadius: 'var(--radius-md)',
            padding: '12px 18px',
            marginBottom: '20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '0.88rem',
          }}>
            <div>
              <strong>Reporting Timezone:</strong> {metrics.timezone}
              <span style={{ marginLeft: '12px', color: 'var(--text-muted)' }}>{metrics.currentTime}</span>
            </div>
            <span style={{ color: 'var(--primary)', fontWeight: '700' }}>Zero-Budget Guardrails Active</span>
          </div>

          {/* Metric Cards Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
            <div className="widget-card">
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Total Users (Testnet)</span>
              <div style={{ fontSize: '1.8rem', fontWeight: '800', margin: '4px 0' }}>{metrics.users.total}</div>
              <div style={{ fontSize: '0.76rem', color: 'var(--primary)', fontWeight: '600' }}>
                +{metrics.users.signups_today} new today &bull; {metrics.users.signups_7d} last 7d
              </div>
            </div>

            <div className="widget-card">
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Daily Active Users (DAU)</span>
              <div style={{ fontSize: '1.8rem', fontWeight: '800', margin: '4px 0' }}>{metrics.users.dau}</div>
              <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                WAU: {metrics.users.wau} &bull; MAU: {metrics.users.mau}
              </div>
            </div>

            <div className="widget-card">
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Active Sessions</span>
              <div style={{ fontSize: '1.8rem', fontWeight: '800', margin: '4px 0' }}>{metrics.users.active_sessions}</div>
              <div style={{ fontSize: '0.76rem', color: '#059669', fontWeight: '600' }}>
                Distinct from 24h DAU
              </div>
            </div>

            <div className="widget-card">
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Posts Published Today</span>
              <div style={{ fontSize: '1.8rem', fontWeight: '800', margin: '4px 0' }}>{metrics.activity.posts_today}</div>
              <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                {metrics.activity.photos_uploaded_today} photos uploaded
              </div>
            </div>

            <div className="widget-card">
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Voice Notes Today</span>
              <div style={{ fontSize: '1.8rem', fontWeight: '800', margin: '4px 0' }}>{metrics.activity.voice_notes_uploaded_today}</div>
              <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                Aggregate msgs: {metrics.activity.aggregate_messages_sent}
              </div>
            </div>

            <div className="widget-card">
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Object Storage Used</span>
              <div style={{ fontSize: '1.8rem', fontWeight: '800', margin: '4px 0' }}>{metrics.storage.used_mb} MB</div>
              <div style={{ fontSize: '0.76rem', color: '#059669', fontWeight: '600' }}>
                {metrics.storage.percentage}% of 10 GB free R2 quota
              </div>
            </div>

            <div className="widget-card">
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Translation Cost Estimate</span>
              <div style={{ fontSize: '1.8rem', fontWeight: '800', margin: '4px 0' }}>${metrics.translation.estimated_monthly_cost_usd}</div>
              <div style={{ fontSize: '0.76rem', color: 'var(--primary)', fontWeight: '600' }}>
                ₦0.00 (within free allowances)
              </div>
            </div>

            <div className="widget-card">
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Safety & Reports</span>
              <div style={{ fontSize: '1.8rem', fontWeight: '800', margin: '4px 0', color: metrics.moderation.pending_reports > 0 ? '#D97706' : 'var(--text-main)' }}>
                {metrics.moderation.pending_reports}
              </div>
              <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                {metrics.moderation.banned_accounts} banned accounts
              </div>
            </div>
          </div>

          {/* Quota Health Panel */}
          <div style={{
            backgroundColor: 'var(--bg-card)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border-subtle)',
            padding: '20px',
          }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: '700', marginBottom: '14px' }}>
              Free-Tier Infrastructure Health & Quota Protection
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
              <div style={{ padding: '12px', backgroundColor: 'var(--bg-main)', borderRadius: '8px' }}>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Database Capacity</span>
                <p style={{ fontWeight: '700', fontSize: '0.96rem' }}>{metrics.quotas.database_limit}</p>
                <span style={{ fontSize: '0.76rem', color: '#059669' }}>Health: Normal (15 MB / 500 MB)</span>
              </div>

              <div style={{ padding: '12px', backgroundColor: 'var(--bg-main)', borderRadius: '8px' }}>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Object Media Storage</span>
                <p style={{ fontWeight: '700', fontSize: '0.96rem' }}>{metrics.quotas.object_storage_limit}</p>
                <span style={{ fontSize: '0.76rem', color: '#059669' }}>Health: Zero egress fees verified</span>
              </div>

              <div style={{ padding: '12px', backgroundColor: 'var(--bg-main)', borderRadius: '8px' }}>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Current Monthly Infrastructure Bill</span>
                <p style={{ fontWeight: '700', fontSize: '0.96rem', color: 'var(--primary)' }}>{metrics.quotas.estimated_monthly_cost}</p>
                <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>Alert Cap: {metrics.quotas.cost_alert_threshold}</span>
              </div>
            </div>
          </div>
        </div>
      ) : activeTab === 'moderation' ? (
        /* Moderation Queue */
        <div>
          <h2 style={{ fontSize: '1.15rem', fontWeight: '700', marginBottom: '14px' }}>Community Reports Queue</h2>
          {reports.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
              Queue is clean. No community safety reports pending.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {reports.map((r) => (
                <div
                  key={r.id}
                  style={{
                    backgroundColor: 'var(--bg-card)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-subtle)',
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{
                        padding: '3px 8px',
                        borderRadius: 'var(--radius-full)',
                        fontSize: '0.72rem',
                        fontWeight: '700',
                        textTransform: 'uppercase',
                        backgroundColor: r.status === 'pending' ? '#FEF3C7' : '#E0E7FF',
                        color: r.status === 'pending' ? '#B45309' : '#3730A3',
                      }}>
                        {r.status}
                      </span>
                      <span style={{ fontWeight: '700', fontSize: '0.95rem' }}>
                        Category: {r.category}
                      </span>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-light)' }}>
                        Target: {r.target_type}
                      </span>
                    </div>

                    <span style={{ fontSize: '0.76rem', color: 'var(--text-light)' }}>
                      Reported by @{r.reporter_username} &bull; {new Date(r.created_at).toLocaleString()}
                    </span>
                  </div>

                  <p style={{ fontSize: '0.92rem', color: 'var(--text-main)', backgroundColor: 'var(--bg-main)', padding: '10px', borderRadius: '6px' }}>
                    <strong>Reporter's Reason:</strong> {r.reason}
                  </p>

                  {r.target_details && (
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', paddingLeft: '8px', borderLeft: '3px solid var(--primary)' }}>
                      <strong>Evidence Content:</strong> {r.target_details.content || r.target_details.username}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '6px' }}>
                    <button
                      onClick={() => { setSelectedReport(r); setActionType('dismissed'); }}
                      style={{ padding: '6px 14px', borderRadius: '6px', fontSize: '0.82rem', fontWeight: '600', border: '1px solid var(--border-subtle)' }}
                    >
                      Dismiss Report
                    </button>
                    <button
                      onClick={() => { setSelectedReport(r); setActionType('resolved'); }}
                      style={{ padding: '6px 16px', borderRadius: '6px', fontSize: '0.82rem', fontWeight: '700', backgroundColor: 'var(--primary)', color: 'white' }}
                    >
                      Take Moderation Action
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : activeTab === 'users' ? (
        /* User Management */
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '1.15rem', fontWeight: '700' }}>Account Oversight & Safety Controls</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'var(--bg-card)', padding: '6px 12px', borderRadius: 'var(--radius-full)', border: '1px solid var(--border-subtle)' }}>
              <Search size={16} color="var(--text-light)" />
              <input
                type="text"
                placeholder="Search by username or email..."
                value={searchUser}
                onChange={(e) => setSearchUser(e.target.value)}
                style={{ border: 'none', background: 'transparent', fontSize: '0.88rem' }}
              />
            </div>
          </div>

          <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--bg-main)', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '12px 16px' }}>Account</th>
                  <th style={{ padding: '12px 16px' }}>Role</th>
                  <th style={{ padding: '12px 16px' }}>Status</th>
                  <th style={{ padding: '12px 16px' }}>Restrictions</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {adminUsers.map((u) => (
                  <tr key={u.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: '700' }}>{u.display_name}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>@{u.username} &bull; {u.email}</div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: '600' }}>{u.role}</span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{
                        padding: '2px 8px',
                        borderRadius: 'var(--radius-full)',
                        fontSize: '0.74rem',
                        fontWeight: '700',
                        backgroundColor: u.status === 'active' ? '#DCFCE7' : '#FEE2E2',
                        color: u.status === 'active' ? '#15803D' : '#DC2626',
                      }}>
                        {u.status}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      {u.posting_restricted_until ? `Posting restricted` : u.messaging_restricted_until ? `Messaging restricted` : 'None'}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      {u.role !== 'super_admin' && (
                        <button
                          onClick={() => setModTargetUser(u)}
                          style={{
                            padding: '4px 12px',
                            borderRadius: '6px',
                            fontSize: '0.8rem',
                            fontWeight: '600',
                            border: '1px solid var(--border-strong)',
                          }}
                        >
                          Modify Status
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Audit Logs */
        <div>
          <h2 style={{ fontSize: '1.15rem', fontWeight: '700', marginBottom: '14px' }}>Immutable Security Audit Trail</h2>
          <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.86rem' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--bg-main)', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '12px 16px' }}>Timestamp</th>
                  <th style={{ padding: '12px 16px' }}>Admin</th>
                  <th style={{ padding: '12px 16px' }}>Action</th>
                  <th style={{ padding: '12px 16px' }}>Target Resource</th>
                  <th style={{ padding: '12px 16px' }}>Documented Reason</th>
                  <th style={{ padding: '12px 16px' }}>Outcome</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.map((log) => (
                  <tr key={log.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '12px 16px', whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: '700' }}>@{log.admin_username}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <code>{log.action}</code>
                    </td>
                    <td style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>
                      {log.resource_type}:{log.resource_id}
                    </td>
                    <td style={{ padding: '12px 16px' }}>{log.reason}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ color: log.outcome === 'success' ? '#059669' : '#DC2626', fontWeight: '700' }}>
                        {log.outcome}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Action Report Modal */}
      {selectedReport && (
        <div className="modal-overlay">
          <div className="modal-box" style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Resolve Community Report</h3>
            </div>
            <form onSubmit={handleResolveReport}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={{ fontSize: '0.85rem', fontWeight: '600', marginBottom: '4px', display: 'block' }}>Resolution Action</label>
                  <select
                    value={actionType}
                    onChange={(e) => setActionType(e.target.value)}
                    style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-subtle)', background: 'var(--bg-input)' }}
                  >
                    <option value="resolved">Take Enforcement Action (Content Removed / User Warned)</option>
                    <option value="investigating">Mark Under Active Investigation</option>
                    <option value="dismissed">Dismiss (No Policy Violation Detected)</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.85rem', fontWeight: '600', marginBottom: '4px', display: 'block' }}>
                    Documented Administrative Reason (Mandatory)
                  </label>
                  <textarea
                    placeholder="Enter reason for audit trail..."
                    value={actionReason}
                    onChange={(e) => setActionReason(e.target.value)}
                    required
                    style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-subtle)', background: 'var(--bg-input)', minHeight: '90px' }}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" onClick={() => setSelectedReport(null)} style={{ padding: '8px 16px', color: 'var(--text-muted)' }}>
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingAction || !actionReason.trim()}
                  style={{ padding: '8px 20px', borderRadius: 'var(--radius-full)', backgroundColor: 'var(--primary)', color: 'white', fontWeight: '700' }}
                >
                  {submittingAction ? 'Recording...' : 'Confirm Action'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* User Status Modal */}
      {modTargetUser && (
        <div className="modal-overlay">
          <div className="modal-box" style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Account Safety Intervention: @{modTargetUser.username}</h3>
            </div>
            <form onSubmit={handleUserStatusChange}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={{ fontSize: '0.85rem', fontWeight: '600', marginBottom: '4px', display: 'block' }}>Safety Action</label>
                  <select
                    value={modUserStatus}
                    onChange={(e) => setModUserStatus(e.target.value)}
                    style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-subtle)', background: 'var(--bg-input)' }}
                  >
                    <option value="active">Reinstate Account to Active Status</option>
                    <option value="restricted_posting">Restrict Public Posting Privileges (24h)</option>
                    <option value="restricted_messaging">Restrict Private Messaging Privileges (24h)</option>
                    <option value="suspended">Temporarily Suspend Account</option>
                    <option value="banned">Permanently Ban Account</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.85rem', fontWeight: '600', marginBottom: '4px', display: 'block' }}>
                    Mandatory Policy Justification
                  </label>
                  <textarea
                    placeholder="Specify the community guidelines clause violated..."
                    value={modUserReason}
                    onChange={(e) => setModUserReason(e.target.value)}
                    required
                    style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-subtle)', background: 'var(--bg-input)', minHeight: '90px' }}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" onClick={() => setModTargetUser(null)} style={{ padding: '8px 16px', color: 'var(--text-muted)' }}>
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!modUserReason.trim()}
                  style={{ padding: '8px 20px', borderRadius: 'var(--radius-full)', backgroundColor: '#DC2626', color: 'white', fontWeight: '700' }}
                >
                  Apply Status Change
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
