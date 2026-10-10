import React, { useState, useEffect } from 'react';
import { Search, TrendingUp, Users, Flame, UserCheck, UserPlus } from 'lucide-react';
import { User, Post } from '../types';
import { api } from '../api';
import { PostCard } from './PostCard';

interface Props {
  currentUser: User | null;
  onViewProfile: (username: string) => void;
  onOpenReportModal: (targetType: string, targetId: string) => void;
}

export const DiscoverView: React.FC<Props> = ({ currentUser, onViewProfile, onOpenReportModal }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<{ users: User[]; posts: Post[] }>({ users: [], posts: [] });
  const [isSearching, setIsSearching] = useState(false);
  const [trendingTopics] = useState([
    { tag: '#LagosTech', count: '5,240 yarns', category: 'Technology' },
    { tag: '#ComputerVillage', count: '3,810 yarns', category: 'Lagos Commerce' },
    { tag: '#KanoHeritage', count: '2,430 yarns', category: 'Culture & Architecture' },
    { tag: '#NaijaFood', count: '7,150 yarns', category: 'Lifestyle' },
    { tag: '#PidginYarn', count: '4,920 yarns', category: 'Community' },
  ]);

  useEffect(() => {
    if (!searchTerm.trim()) {
      setResults({ users: [], posts: [] });
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await api.search(searchTerm.trim());
        setResults({ users: res.users || [], posts: res.posts || [] });
      } catch (err) {
        console.error('Search failed:', err);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  const handleFollowToggle = async (userId: string) => {
    if (!currentUser) return;
    try {
      await api.toggleFollow(userId);
      // Refresh results
      if (searchTerm) {
        const res = await api.search(searchTerm);
        setResults({ users: res.users || [], posts: res.posts || [] });
      }
    } catch (err) {
      console.error('Follow toggle failed:', err);
    }
  };

  return (
    <div style={{ flex: 1, minWidth: 0, padding: '16px 20px' }}>
      <h1 className="page-heading" style={{ marginBottom: '16px' }}>Discover Yarnna</h1>

      {/* Search Input Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '12px 18px',
        backgroundColor: 'var(--bg-card)',
        borderRadius: 'var(--radius-full)',
        border: '1px solid var(--border-subtle)',
        boxShadow: 'var(--shadow-sm)',
        marginBottom: '24px',
      }}>
        <Search size={20} color="var(--primary)" />
        <input
          type="text"
          placeholder="Search people, places, topics in Nigeria..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            flex: 1,
            border: 'none',
            background: 'transparent',
            fontSize: '1rem',
            color: 'var(--text-main)',
          }}
        />
        {searchTerm && (
          <button onClick={() => setSearchTerm('')} style={{ fontSize: '0.85rem', color: 'var(--text-light)' }}>
            Clear
          </button>
        )}
      </div>

      {/* Search Results if query present */}
      {searchTerm.trim() ? (
        <div>
          <h2 style={{ fontSize: '1.1rem', fontWeight: '700', marginBottom: '14px' }}>
            {isSearching ? 'Searching...' : `Search Results for "${searchTerm}"`}
          </h2>

          {/* User Results */}
          {results.users.length > 0 && (
            <div style={{ marginBottom: '24px' }}>
              <h3 style={{ fontSize: '0.9rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px' }}>
                People
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
                {results.users.map((u) => (
                  <div
                    key={u.id}
                    style={{
                      padding: '14px',
                      backgroundColor: 'var(--bg-card)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-subtle)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div
                      style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}
                      onClick={() => onViewProfile(u.username)}
                    >
                      <img
                        src={u.avatar_url || 'https://api.dicebear.com/7.x/bottts/svg?seed=' + u.username}
                        alt={u.display_name}
                        style={{ width: '44px', height: '44px', borderRadius: '50%', objectFit: 'cover' }}
                      />
                      <div>
                        <div style={{ fontWeight: '700', fontSize: '0.95rem' }}>{u.display_name}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>@{u.username}</div>
                        <div style={{ fontSize: '0.76rem', color: 'var(--text-light)' }}>{u.location}</div>
                      </div>
                    </div>

                    {currentUser && currentUser.id !== u.id && (
                      <button
                        onClick={() => handleFollowToggle(u.id)}
                        style={{
                          padding: '6px 14px',
                          borderRadius: 'var(--radius-full)',
                          backgroundColor: 'var(--primary)',
                          color: 'white',
                          fontSize: '0.82rem',
                          fontWeight: '700',
                        }}
                      >
                        Follow
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Post Results */}
          {results.posts.length > 0 && (
            <div>
              <h3 style={{ fontSize: '0.9rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px' }}>
                Yarns & Discussions
              </h3>
              <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', overflow: 'hidden' }}>
                {results.posts.map((post) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    currentUser={currentUser}
                    onPostUpdated={() => {}}
                    onOpenReportModal={onOpenReportModal}
                    onViewProfile={onViewProfile}
                  />
                ))}
              </div>
            </div>
          )}

          {!isSearching && results.users.length === 0 && results.posts.length === 0 && (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
              No matches found for "{searchTerm}". Try searching for usernames, towns, or keywords like "laptop" or "Kano".
            </div>
          )}
        </div>
      ) : (
        /* Default Trending & Topics View */
        <div>
          <div style={{
            backgroundColor: 'var(--bg-card)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border-subtle)',
            padding: '20px',
            marginBottom: '24px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <Flame color="var(--accent-gold)" size={22} />
              <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.25rem', fontWeight: '700' }}>
                What Nigeria is Yarning About
              </h2>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {trendingTopics.map((topic, idx) => (
                <div
                  key={idx}
                  onClick={() => setSearchTerm(topic.tag.replace('#', ''))}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 14px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--bg-main)',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  <div>
                    <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                      {topic.category}
                    </span>
                    <div style={{ fontWeight: '700', fontSize: '1.05rem', color: 'var(--primary)' }}>
                      {topic.tag}
                    </div>
                  </div>
                  <span style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>
                    {topic.count}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
