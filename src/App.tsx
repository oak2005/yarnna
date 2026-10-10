import React, { useState, useEffect } from 'react';
import {
  Home, Compass, PlusCircle, MessageSquare, User as UserIcon,
  Shield, LogOut, LogIn, Moon, Sun, Monitor, Check, Info, Bell, RefreshCw, Sparkles, Clock
} from 'lucide-react';
import { User, Post } from './types';
import { api, getAuthToken, removeAuthToken } from './api';
import { PostCard } from './components/PostCard';
import { CreatePostModal } from './components/CreatePostModal';
import { ChatView } from './components/ChatView';
import { DiscoverView } from './components/DiscoverView';
import { ProfileView } from './components/ProfileView';
import { AdminPortalView } from './components/AdminPortalView';
import { TestnetNoticeModal } from './components/TestnetNoticeModal';
import { ReportModal } from './components/ReportModal';
import { AuthModal } from './components/AuthModal';

export type ThemeMode = 'light' | 'dark' | 'system';

export const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<'feed' | 'discover' | 'chats' | 'profile' | 'admin'>('feed');
  const [feedType, setFeedType] = useState<'chronological' | 'recommended'>('chronological');
  const [posts, setPosts] = useState<Post[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(false);
  
  // Theme Mode: light | dark | system
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    return (localStorage.getItem('yarnna_theme_mode') as ThemeMode) || 'system';
  });
  const [showThemeMenu, setShowThemeMenu] = useState(false);

  // Modals
  const [showTestnetModal, setShowTestnetModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [reportModalData, setReportModalData] = useState<{ isOpen: boolean; type: string; id: string }>({
    isOpen: false,
    type: 'post',
    id: '',
  });

  // Profile navigation target
  const [viewingUsername, setViewingUsername] = useState<string | null>(null);

  // Handle Theme switching and system/device listener
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const applyTheme = (mode: ThemeMode) => {
      let resolved: 'light' | 'dark';
      if (mode === 'system') {
        resolved = mediaQuery.matches ? 'dark' : 'light';
      } else {
        resolved = mode;
      }
      document.documentElement.setAttribute('data-theme', resolved);
    };

    applyTheme(themeMode);
    localStorage.setItem('yarnna_theme_mode', themeMode);

    const handleSystemChange = () => {
      if (themeMode === 'system') {
        applyTheme('system');
      }
    };

    mediaQuery.addEventListener('change', handleSystemChange);
    return () => mediaQuery.removeEventListener('change', handleSystemChange);
  }, [themeMode]);

  // Initialize Auth
  useEffect(() => {
    const token = getAuthToken();
    if (token) {
      api.getMe()
        .then((res) => {
          setCurrentUser(res.user);
          // Show testnet notice if not yet acknowledged
          if (!res.user.acknowledged_testnet_notice_at) {
            setShowTestnetModal(true);
          }
        })
        .catch(() => {
          removeAuthToken();
          // Prompt login or auto-show notice
          setShowTestnetModal(true);
        });
    } else {
      // First time visitor: show testnet notice
      setShowTestnetModal(true);
    }
  }, []);

  const handleLogout = () => {
    removeAuthToken();
    setCurrentUser(null);
    setActiveTab('feed');
  };

  // Load feed posts
  const loadFeedPosts = async () => {
    setLoadingPosts(true);
    try {
      const res = await api.getPosts(feedType);
      setPosts(res.posts || []);
    } catch (err) {
      console.error('Failed to load posts:', err);
    } finally {
      setLoadingPosts(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'feed') {
      loadFeedPosts();
    }
  }, [activeTab, feedType]);

  const handleViewProfile = (uname: string) => {
    setViewingUsername(uname);
    setActiveTab('profile');
  };

  const openReport = (targetType: string, targetId: string) => {
    setReportModalData({ isOpen: true, type: targetType, id: targetId });
  };

  return (
    <div className="app-container">
      {/* Desktop Sidebar */}
      <aside className="sidebar">
        <div className="brand-logo">
          <div className="brand-title">
            <span>Yarnna</span>
            <span className="testnet-pill">Testnet</span>
          </div>
        </div>

        <nav className="nav-links">
          <button
            onClick={() => { setActiveTab('feed'); setViewingUsername(null); }}
            className={`nav-item ${activeTab === 'feed' ? 'active' : ''}`}
          >
            <Home size={22} />
            <span>Home</span>
          </button>

          <button
            onClick={() => { setActiveTab('discover'); setViewingUsername(null); }}
            className={`nav-item ${activeTab === 'discover' ? 'active' : ''}`}
          >
            <Compass size={22} />
            <span>Discover</span>
          </button>

          <button
            onClick={() => {
              if (!currentUser) setShowAuthModal(true);
              else { setActiveTab('chats'); setViewingUsername(null); }
            }}
            className={`nav-item ${activeTab === 'chats' ? 'active' : ''}`}
          >
            <MessageSquare size={22} />
            <span>Chats</span>
          </button>

          <button
            onClick={() => {
              if (!currentUser) setShowAuthModal(true);
              else {
                setViewingUsername(currentUser.username);
                setActiveTab('profile');
              }
            }}
            className={`nav-item ${activeTab === 'profile' ? 'active' : ''}`}
          >
            <UserIcon size={22} />
            <span>Profile</span>
          </button>

          {(currentUser?.role === 'admin' || currentUser?.role === 'super_admin' || currentUser?.role === 'moderator') && (
            <button
              onClick={() => setActiveTab('admin')}
              className={`nav-item ${activeTab === 'admin' ? 'active' : ''}`}
              style={{ color: '#D97706' }}
            >
              <Shield size={22} />
              <span>Admin Portal</span>
            </button>
          )}

          <button
            onClick={() => {
              if (!currentUser) setShowAuthModal(true);
              else setShowCreateModal(true);
            }}
            className="btn-post-cta"
          >
            <PlusCircle size={20} />
            <span>Yarn Something</span>
          </button>
        </nav>

        {/* User Card at bottom of sidebar */}
        {currentUser ? (
          <div
            className="sidebar-profile"
            onClick={() => {
              setViewingUsername(currentUser.username);
              setActiveTab('profile');
            }}
          >
            <img
              src={currentUser.avatar_url || 'https://api.dicebear.com/7.x/bottts/svg?seed=' + currentUser.username}
              alt={currentUser.display_name}
              className="sidebar-avatar"
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: '700', fontSize: '0.92rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {currentUser.display_name}
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                @{currentUser.username}
              </div>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); handleLogout(); }}
              title="Sign Out"
              style={{ color: 'var(--text-light)', padding: '4px' }}
            >
              <LogOut size={16} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowAuthModal(true)}
            style={{
              padding: '12px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--primary)',
              color: 'var(--primary)',
              fontWeight: '700',
              marginTop: '16px',
            }}
          >
            Sign In / Join
          </button>
        )}
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        {/* Top Header Bar */}
        <header className="top-header">
          <div className="header-title-box">
            <h1 className="page-heading">
              {activeTab === 'feed' && 'Yarnna Feed'}
              {activeTab === 'discover' && 'Discover'}
              {activeTab === 'chats' && 'Chats & Voice Notes'}
              {activeTab === 'profile' && 'Profile'}
              {activeTab === 'admin' && 'Admin Portal'}
            </h1>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {/* Admin Portal Shortcut if privileged */}
            {(currentUser?.role === 'admin' || currentUser?.role === 'super_admin' || currentUser?.role === 'moderator') && (
              <button
                onClick={() => setActiveTab('admin')}
                title="Open Admin & Safety Portal"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '6px 12px',
                  borderRadius: 'var(--radius-full)',
                  backgroundColor: activeTab === 'admin' ? 'var(--primary)' : 'rgba(217, 119, 6, 0.12)',
                  color: activeTab === 'admin' ? 'white' : '#D97706',
                  border: '1px solid #FCD34D',
                  fontSize: '0.8rem',
                  fontWeight: '700',
                }}
              >
                <Shield size={14} />
                <span>Admin</span>
              </button>
            )}

            {/* Testnet notice trigger button */}
            <button
              onClick={() => setShowTestnetModal(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                padding: '6px 12px',
                borderRadius: 'var(--radius-full)',
                backgroundColor: 'var(--accent-gold-subtle)',
                color: 'var(--accent-gold)',
                border: '1px solid var(--accent-gold)',
                fontSize: '0.8rem',
                fontWeight: '700',
              }}
            >
              <Info size={14} />
              <span>Testnet</span>
            </button>

            {/* Theme Mode Selector (Light, Dark, System / Device Default) */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setShowThemeMenu(!showThemeMenu)}
                title={`Theme: ${themeMode === 'system' ? 'Device Default' : themeMode === 'dark' ? 'Dark Mode' : 'Light Mode'}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '6px 10px',
                  borderRadius: 'var(--radius-full)',
                  backgroundColor: 'var(--bg-input)',
                  color: 'var(--text-main)',
                  fontSize: '0.8rem',
                  fontWeight: '600',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                {themeMode === 'system' ? <Monitor size={15} /> : themeMode === 'dark' ? <Moon size={15} /> : <Sun size={15} />}
                <span style={{ textTransform: 'capitalize' }}>
                  {themeMode === 'system' ? 'Device' : themeMode}
                </span>
              </button>

              {showThemeMenu && (
                <div
                  style={{
                    position: 'absolute',
                    right: 0,
                    top: '115%',
                    backgroundColor: 'var(--bg-card)',
                    borderRadius: 'var(--radius-md)',
                    boxShadow: 'var(--shadow-lg)',
                    border: '1px solid var(--border-subtle)',
                    padding: '6px',
                    zIndex: 50,
                    minWidth: '175px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2px',
                  }}
                >
                  <button
                    onClick={() => { setThemeMode('light'); setShowThemeMenu(false); }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      fontSize: '0.86rem',
                      fontWeight: themeMode === 'light' ? '700' : '500',
                      color: themeMode === 'light' ? 'var(--primary)' : 'var(--text-main)',
                      backgroundColor: themeMode === 'light' ? 'var(--primary-subtle)' : 'transparent',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Sun size={15} /> Light Mode
                    </div>
                    {themeMode === 'light' && <Check size={14} />}
                  </button>

                  <button
                    onClick={() => { setThemeMode('dark'); setShowThemeMenu(false); }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      fontSize: '0.86rem',
                      fontWeight: themeMode === 'dark' ? '700' : '500',
                      color: themeMode === 'dark' ? 'var(--primary)' : 'var(--text-main)',
                      backgroundColor: themeMode === 'dark' ? 'var(--primary-subtle)' : 'transparent',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Moon size={15} /> Dark Mode
                    </div>
                    {themeMode === 'dark' && <Check size={14} />}
                  </button>

                  <button
                    onClick={() => { setThemeMode('system'); setShowThemeMenu(false); }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      fontSize: '0.86rem',
                      fontWeight: themeMode === 'system' ? '700' : '500',
                      color: themeMode === 'system' ? 'var(--primary)' : 'var(--text-main)',
                      backgroundColor: themeMode === 'system' ? 'var(--primary-subtle)' : 'transparent',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Monitor size={15} /> Device Default
                    </div>
                    {themeMode === 'system' && <Check size={14} />}
                  </button>
                </div>
              )}
            </div>

            {/* Sign Out / Sign In Button */}
            {currentUser ? (
              <button
                onClick={handleLogout}
                title="Sign out of your account"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '6px 12px',
                  borderRadius: 'var(--radius-full)',
                  backgroundColor: 'var(--bg-input)',
                  color: 'var(--accent-red)',
                  border: '1px solid var(--border-subtle)',
                  fontSize: '0.8rem',
                  fontWeight: '700',
                }}
              >
                <LogOut size={14} />
                <span>Sign Out</span>
              </button>
            ) : (
              <button
                onClick={() => setShowAuthModal(true)}
                title="Sign In or Create Account"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '6px 14px',
                  borderRadius: 'var(--radius-full)',
                  backgroundColor: 'var(--primary)',
                  color: 'white',
                  border: 'none',
                  fontSize: '0.8rem',
                  fontWeight: '700',
                }}
              >
                <LogIn size={14} />
                <span>Sign In</span>
              </button>
            )}
          </div>
        </header>

        {/* Global Testnet Advisory Banner */}
        <div className="testnet-banner">
          <div className="testnet-banner-text">
            <span>Yarnna is currently in testnet. Do not use personal passwords. Features may change.</span>
          </div>
          <button onClick={() => setShowTestnetModal(true)} className="testnet-banner-btn">
            Read Notice
          </button>
        </div>

        {/* Dynamic View Switcher */}
        {activeTab === 'feed' && (
          <div>
            {/* Feed Switcher Tabs */}
            <div className="feed-tabs">
              <button
                onClick={() => setFeedType('chronological')}
                className={`feed-tab ${feedType === 'chronological' ? 'active' : ''}`}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                  <Clock size={16} /> Latest Yarns (Chronological)
                </div>
              </button>
              <button
                onClick={() => setFeedType('recommended')}
                className={`feed-tab ${feedType === 'recommended' ? 'active' : ''}`}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                  <Sparkles size={16} /> For You (Recommended)
                </div>
              </button>
            </div>

            {/* Inline Composer (for quick posting) */}
            {currentUser && (
              <div
                className="composer-card"
                onClick={() => setShowCreateModal(true)}
                style={{ cursor: 'pointer' }}
              >
                <img
                  src={currentUser.avatar_url || 'https://api.dicebear.com/7.x/bottts/svg?seed=' + currentUser.username}
                  alt={currentUser.display_name}
                  className="composer-avatar"
                />
                <div style={{
                  flex: 1,
                  padding: '10px 14px',
                  backgroundColor: 'var(--bg-input)',
                  borderRadius: 'var(--radius-full)',
                  color: 'var(--text-muted)',
                  fontSize: '0.95rem',
                }}>
                  Wetin dey happen? Yarn with your people...
                </div>
              </div>
            )}

            {/* Feed Posts Stream */}
            {loadingPosts ? (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                Loading freshest yarns...
              </div>
            ) : posts.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                No posts in this feed yet. Be the first to start the yarn!
              </div>
            ) : (
              posts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  currentUser={currentUser}
                  onPostUpdated={loadFeedPosts}
                  onOpenReportModal={openReport}
                  onViewProfile={handleViewProfile}
                />
              ))
            )}
          </div>
        )}

        {activeTab === 'discover' && (
          <DiscoverView
            currentUser={currentUser}
            onViewProfile={handleViewProfile}
            onOpenReportModal={openReport}
          />
        )}

        {activeTab === 'chats' && (
          <ChatView
            currentUser={currentUser}
            onOpenReportModal={openReport}
          />
        )}

        {activeTab === 'profile' && (
          <ProfileView
            username={viewingUsername || currentUser?.username || 'tunde_tech'}
            currentUser={currentUser}
            onBack={() => setActiveTab('feed')}
            onOpenReportModal={openReport}
            onProfileUpdated={(updatedUser?: User) => {
              if (updatedUser) {
                setCurrentUser(updatedUser);
                setViewingUsername(updatedUser.username);
              } else {
                api.getMe().then((r) => {
                  setCurrentUser(r.user);
                  setViewingUsername(r.user.username);
                });
              }
            }}
            onLogout={handleLogout}
            onOpenAdmin={() => setActiveTab('admin')}
          />
        )}

        {activeTab === 'admin' && (
          <AdminPortalView
            currentUser={currentUser}
            onExit={() => setActiveTab('feed')}
          />
        )}
      </main>

      {/* Right Sidebar Desktop Widgets */}
      <aside className="right-sidebar">
        {/* About Yarnna Widget */}
        <div className="widget-card">
          <h3 className="widget-title">About Yarnna</h3>
          <p style={{ fontSize: '0.86rem', lineHeight: '1.5', color: 'var(--text-muted)', marginBottom: '10px' }}>
            A Nigeria-first social media platform for public text posts, photo sharing and private messaging. Designed for privacy, familiar conversations and low data usage.
          </p>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-light)', borderTop: '1px solid var(--border-subtle)', paddingTop: '8px' }}>
            Zero budget testnet phase &bull; Video hosting intentionally excluded &bull; Strictly advertisement-free
          </div>
        </div>

        {/* Trending Widget */}
        <div className="widget-card">
          <h3 className="widget-title">Trending in Nigeria</h3>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div className="trend-item" onClick={() => { setActiveTab('discover'); }}>
              <span className="trend-tag">#LagosTech</span>
              <span className="trend-count">5,240 yarns</span>
            </div>
            <div className="trend-item" onClick={() => { setActiveTab('discover'); }}>
              <span className="trend-tag">#ComputerVillage</span>
              <span className="trend-count">3,810 yarns</span>
            </div>
            <div className="trend-item" onClick={() => { setActiveTab('discover'); }}>
              <span className="trend-tag">#KanoHeritage</span>
              <span className="trend-count">2,430 yarns</span>
            </div>
            <div className="trend-item" onClick={() => { setActiveTab('discover'); }}>
              <span className="trend-tag">#NaijaFood</span>
              <span className="trend-count">7,150 yarns</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="mobile-nav">
        <button
          onClick={() => { setActiveTab('feed'); setViewingUsername(null); }}
          className={`mobile-nav-btn ${activeTab === 'feed' ? 'active' : ''}`}
        >
          <Home size={22} />
          <span>Home</span>
        </button>

        <button
          onClick={() => { setActiveTab('discover'); setViewingUsername(null); }}
          className={`mobile-nav-btn ${activeTab === 'discover' ? 'active' : ''}`}
        >
          <Compass size={22} />
          <span>Discover</span>
        </button>

        <button
          onClick={() => {
            if (!currentUser) setShowAuthModal(true);
            else setShowCreateModal(true);
          }}
          className="mobile-nav-btn"
          style={{ color: 'var(--primary)' }}
        >
          <PlusCircle size={26} />
          <span>Post</span>
        </button>

        <button
          onClick={() => {
            if (!currentUser) setShowAuthModal(true);
            else { setActiveTab('chats'); setViewingUsername(null); }
          }}
          className={`mobile-nav-btn ${activeTab === 'chats' ? 'active' : ''}`}
        >
          <MessageSquare size={22} />
          <span>Chats</span>
        </button>

        <button
          onClick={() => {
            if (!currentUser) setShowAuthModal(true);
            else {
              setViewingUsername(currentUser.username);
              setActiveTab('profile');
            }
          }}
          className={`mobile-nav-btn ${activeTab === 'profile' ? 'active' : ''}`}
        >
          <UserIcon size={22} />
          <span>Profile</span>
        </button>

        {(currentUser?.role === 'admin' || currentUser?.role === 'super_admin' || currentUser?.role === 'moderator') && (
          <button
            onClick={() => { setActiveTab('admin'); setViewingUsername(null); }}
            className={`mobile-nav-btn ${activeTab === 'admin' ? 'active' : ''}`}
            style={{ color: '#D97706' }}
          >
            <Shield size={22} />
            <span>Admin</span>
          </button>
        )}
      </nav>

      {/* Modals */}
      <TestnetNoticeModal
        isOpen={showTestnetModal}
        onClose={() => setShowTestnetModal(false)}
        onAcknowledged={() => {
          if (currentUser) {
            setCurrentUser({ ...currentUser, acknowledged_testnet_notice_at: new Date().toISOString() });
          }
        }}
      />

      <CreatePostModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onPostCreated={() => {
          if (activeTab === 'feed') loadFeedPosts();
        }}
      />

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onAuthSuccess={(u) => {
          setCurrentUser(u);
          if (!u.acknowledged_testnet_notice_at) {
            setShowTestnetModal(true);
          }
        }}
      />

      <ReportModal
        isOpen={reportModalData.isOpen}
        onClose={() => setReportModalData({ isOpen: false, type: 'post', id: '' })}
        targetType={reportModalData.type}
        targetId={reportModalData.id}
      />
    </div>
  );
};
export default App;
