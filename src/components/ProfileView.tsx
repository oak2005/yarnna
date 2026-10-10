import React, { useState, useEffect } from 'react';
import {
  MapPin, Calendar, Edit3, UserPlus, UserCheck, Shield,
  ArrowLeft, Ban, Check
} from 'lucide-react';
import { User, Post } from '../types';
import { api } from '../api';
import { PostCard } from './PostCard';

interface Props {
  username: string;
  currentUser: User | null;
  onBack?: () => void;
  onOpenReportModal: (targetType: string, targetId: string) => void;
  onProfileUpdated: (updatedUser?: User) => void;
}

export const ProfileView: React.FC<Props> = ({
  username,
  currentUser,
  onBack,
  onOpenReportModal,
  onProfileUpdated,
}) => {
  const [profileUser, setProfileUser] = useState<User | null>(null);
  const [userPosts, setUserPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);

  // Edit Profile State
  const [showEditModal, setShowEditModal] = useState(false);
  const [editUsername, setEditUsername] = useState('');
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editLang, setEditLang] = useState<'en' | 'pcm' | 'yo' | 'ig' | 'ha'>('en');
  const [savingProfile, setSavingProfile] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const isSelf = currentUser?.username.toLowerCase() === username.toLowerCase();

  const loadProfile = async () => {
    setLoading(true);
    try {
      const res = await api.getProfile(username);
      setProfileUser(res.user);
      setUserPosts(res.posts || []);
      setIsFollowing(!!res.user.is_following);
      setIsBlocked(!!res.user.is_blocked);

      if (isSelf) {
        setEditUsername(res.user.username);
        setEditDisplayName(res.user.display_name);
        setEditBio(res.user.bio || '');
        setEditLocation(res.user.location || '');
        setEditLang(res.user.preferred_language || 'en');
      }
    } catch (err) {
      console.error('Failed to load profile:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, [username]);

  const handleFollowToggle = async () => {
    if (!profileUser || !currentUser) return;
    try {
      const res = await api.toggleFollow(profileUser.id);
      setIsFollowing(res.is_following);
      setProfileUser({
        ...profileUser,
        followers_count: (profileUser.followers_count || 0) + (res.is_following ? 1 : -1),
      });
    } catch (err) {
      console.error('Follow toggle error:', err);
    }
  };

  const handleBlockToggle = async () => {
    if (!profileUser || !currentUser) return;
    if (!window.confirm(`Are you sure you want to ${isBlocked ? 'unblock' : 'block'} @${profileUser.username}?`)) return;

    try {
      const res = await api.toggleBlock(profileUser.id);
      setIsBlocked(res.is_blocked);
      if (res.is_blocked) setIsFollowing(false);
    } catch (err) {
      console.error('Block toggle error:', err);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditError(null);

    const cleanUsername = editUsername.trim().toLowerCase().replace(/^@+/, '').replace(/\s+/g, '_');
    if (!/^[a-z0-9_]{3,30}$/.test(cleanUsername)) {
      setEditError('Username must be 3-30 characters (letters only, or letters with numbers or underscores).');
      return;
    }

    setSavingProfile(true);
    try {
      const res = await api.updateProfile({
        username: cleanUsername,
        display_name: editDisplayName,
        bio: editBio,
        location: editLocation,
        preferred_language: editLang,
      });
      setShowEditModal(false);
      onProfileUpdated(res.user);
      if (res.user) {
        setProfileUser(res.user);
      }
      loadProfile();
    } catch (err: any) {
      setEditError(err.message || 'Failed to update profile.');
      console.error('Failed to update profile:', err);
    } finally {
      setSavingProfile(false);
    }
  };

  if (loading) {
    return <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading profile...</div>;
  }

  if (!profileUser) {
    return <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>User not found.</div>;
  }

  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      {/* Header with back button */}
      <div className="top-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          {onBack && (
            <button onClick={onBack} style={{ color: 'var(--text-main)' }}>
              <ArrowLeft size={20} />
            </button>
          )}
          <div>
            <h1 className="page-heading">{profileUser.display_name}</h1>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              {profileUser.posts_count || userPosts.length} Yarns
            </span>
          </div>
        </div>
      </div>

      {/* Profile Banner & Details */}
      <div style={{ backgroundColor: 'var(--bg-card)', borderBottom: '1px solid var(--border-subtle)', padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
          <img
            src={profileUser.avatar_url || 'https://api.dicebear.com/7.x/bottts/svg?seed=' + profileUser.username}
            alt={profileUser.display_name}
            style={{
              width: '84px',
              height: '84px',
              borderRadius: '50%',
              border: '3px solid var(--primary)',
              objectFit: 'cover',
            }}
          />

          <div style={{ display: 'flex', gap: '8px' }}>
            {isSelf ? (
              <button
                onClick={() => {
                  if (profileUser) {
                    setEditUsername(profileUser.username);
                    setEditDisplayName(profileUser.display_name);
                    setEditBio(profileUser.bio || '');
                    setEditLocation(profileUser.location || '');
                    setEditLang(profileUser.preferred_language || 'en');
                    setEditError(null);
                  }
                  setShowEditModal(true);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 18px',
                  borderRadius: 'var(--radius-full)',
                  border: '1px solid var(--border-strong)',
                  fontWeight: '700',
                  fontSize: '0.88rem',
                }}
              >
                <Edit3 size={15} /> Edit Profile
              </button>
            ) : (
              <>
                <button
                  onClick={handleFollowToggle}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 20px',
                    borderRadius: 'var(--radius-full)',
                    backgroundColor: isFollowing ? 'transparent' : 'var(--primary)',
                    color: isFollowing ? 'var(--text-main)' : 'white',
                    border: isFollowing ? '1px solid var(--border-strong)' : 'none',
                    fontWeight: '700',
                    fontSize: '0.88rem',
                  }}
                >
                  {isFollowing ? <UserCheck size={16} /> : <UserPlus size={16} />}
                  {isFollowing ? 'Following' : 'Follow'}
                </button>

                <button
                  onClick={handleBlockToggle}
                  title={isBlocked ? 'Unblock user' : 'Block user'}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-full)',
                    border: '1px solid var(--border-subtle)',
                    color: isBlocked ? 'var(--accent-red)' : 'var(--text-muted)',
                  }}
                >
                  <Ban size={16} />
                </button>
              </>
            )}
          </div>
        </div>

        <h2 style={{ fontSize: '1.3rem', fontWeight: '800' }}>{profileUser.display_name}</h2>
        <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>@{profileUser.username}</span>

        {profileUser.bio && (
          <p style={{ marginTop: '12px', fontSize: '0.96rem', lineHeight: '1.5' }}>{profileUser.bio}</p>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '12px', color: 'var(--text-light)', fontSize: '0.84rem' }}>
          {profileUser.location && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <MapPin size={15} />
              <span>{profileUser.location}</span>
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Calendar size={15} />
            <span>Joined {new Date(profileUser.created_at).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '20px', marginTop: '16px', fontSize: '0.9rem' }}>
          <span>
            <strong>{profileUser.following_count || 0}</strong> <span style={{ color: 'var(--text-muted)' }}>Following</span>
          </span>
          <span>
            <strong>{profileUser.followers_count || 0}</strong> <span style={{ color: 'var(--text-muted)' }}>Followers</span>
          </span>
        </div>
      </div>

      {/* User Posts List */}
      <div>
        <div style={{ padding: '12px 20px', fontWeight: '700', borderBottom: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-main)' }}>
          Yarns
        </div>
        {userPosts.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
            @{profileUser.username} has not posted any yarns yet.
          </div>
        ) : (
          userPosts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              currentUser={currentUser}
              onPostUpdated={loadProfile}
              onOpenReportModal={onOpenReportModal}
              onViewProfile={() => {}}
            />
          ))
        )}
      </div>

      {/* Edit Profile Modal */}
      {showEditModal && (
        <div className="modal-overlay">
          <div className="modal-box" style={{ maxWidth: '460px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Edit Profile</h3>
            </div>
            <form onSubmit={handleSaveProfile}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {editError && (
                  <div style={{
                    padding: '10px 14px',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid var(--accent-red)',
                    borderRadius: '6px',
                    color: 'var(--accent-red)',
                    fontSize: '0.85rem'
                  }}>
                    {editError}
                  </div>
                )}
                <div>
                  <label style={{ fontSize: '0.85rem', fontWeight: '600', marginBottom: '4px', display: 'block' }}>Username</label>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <span style={{ position: 'absolute', left: '12px', color: 'var(--text-muted)', fontWeight: '700', userSelect: 'none', fontSize: '0.95rem' }}>
                      @
                    </span>
                    <input
                      type="text"
                      value={editUsername}
                      onChange={(e) => {
                        const val = e.target.value.replace(/^@+/, '').replace(/\s+/g, '_');
                        setEditUsername(val);
                      }}
                      placeholder="username"
                      required
                      minLength={3}
                      maxLength={30}
                      style={{
                        width: '100%',
                        padding: '8px 12px 8px 30px',
                        borderRadius: '6px',
                        border: '1px solid var(--border-subtle)',
                        background: 'var(--bg-input)',
                        color: 'var(--text-main)',
                        fontWeight: '600',
                      }}
                    />
                  </div>
                  <p style={{ fontSize: '0.74rem', color: 'var(--text-light)', marginTop: '4px' }}>
                    Letters only, or letters with numbers or underscores (3 to 30 characters).
                  </p>
                </div>
                <div>
                  <label style={{ fontSize: '0.85rem', fontWeight: '600', marginBottom: '4px', display: 'block' }}>Display Name</label>
                  <input
                    type="text"
                    value={editDisplayName}
                    onChange={(e) => setEditDisplayName(e.target.value)}
                    required
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-subtle)', background: 'var(--bg-input)' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.85rem', fontWeight: '600', marginBottom: '4px', display: 'block' }}>Bio</label>
                  <textarea
                    value={editBio}
                    onChange={(e) => setEditBio(e.target.value)}
                    maxLength={200}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-subtle)', background: 'var(--bg-input)', minHeight: '80px' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.85rem', fontWeight: '600', marginBottom: '4px', display: 'block' }}>Location</label>
                  <input
                    type="text"
                    value={editLocation}
                    onChange={(e) => setEditLocation(e.target.value)}
                    placeholder="e.g. Lagos, Nigeria"
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-subtle)', background: 'var(--bg-input)' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.85rem', fontWeight: '600', marginBottom: '4px', display: 'block' }}>Preferred Nigerian Language</label>
                  <select
                    value={editLang}
                    onChange={(e: any) => setEditLang(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-subtle)', background: 'var(--bg-input)' }}
                  >
                    <option value="en">English (Nigeria)</option>
                    <option value="pcm">Nigerian Pidgin (Naija)</option>
                    <option value="yo">Yoruba</option>
                    <option value="ig">Igbo</option>
                    <option value="ha">Hausa</option>
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setShowEditModal(false)} style={{ padding: '8px 16px', color: 'var(--text-muted)' }}>
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingProfile}
                  style={{ padding: '8px 20px', borderRadius: 'var(--radius-full)', backgroundColor: 'var(--primary)', color: 'white', fontWeight: '700' }}
                >
                  {savingProfile ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
