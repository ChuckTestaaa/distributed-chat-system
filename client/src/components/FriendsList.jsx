import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { friendsApi, usersApi, roomsApi } from '../services/api';
import { useSocket } from '../hooks/useSocket';
import Avatar from './Avatar';
import { Search, UserPlus, MessageCircle, Loader2, Users } from 'lucide-react';

export default function FriendsList() {
    const [friends, setFriends] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [searching, setSearching] = useState(false);
    const [openingDM, setOpeningDM] = useState(null);
    const { onlineUsers } = useSocket();
    const navigate = useNavigate();

    const loadFriends = useCallback(async () => {
        try {
            const data = await friendsApi.list();
            setFriends(data.friends || []);
        } catch (err) {
            console.error('Failed to load friends:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadFriends();
    }, [loadFriends]);

    // Reload on friend accepted (real-time)
    useEffect(() => {
        const handler = () => loadFriends();
        window.addEventListener('friend_accepted', handler);
        return () => window.removeEventListener('friend_accepted', handler);
    }, [loadFriends]);

    // Search for users to add as friends
    useEffect(() => {
        if (searchTerm.length < 2) {
            setSearchResults([]);
            return;
        }

        const timeout = setTimeout(async () => {
            setSearching(true);
            try {
                const data = await usersApi.search(searchTerm);
                setSearchResults(data.users || []);
            } catch {
                setSearchResults([]);
            } finally {
                setSearching(false);
            }
        }, 300);

        return () => clearTimeout(timeout);
    }, [searchTerm]);

    const handleSendRequest = async (userId) => {
        try {
            await friendsApi.sendRequest(userId);
            setSearchResults(prev => prev.filter(u => u.id !== userId));
            setSearchTerm('');
        } catch (err) {
            alert(err.message);
        }
    };

    const handleOpenDM = async (friendId) => {
        if (openingDM) return;
        setOpeningDM(friendId);
        try {
            const data = await roomsApi.getOrCreateDM(friendId);
            navigate(`/chat/${data.roomId}`);
        } catch (err) {
            alert(err.message);
        } finally {
            setOpeningDM(null);
        }
    };

    return (
        <div className="friends-panel" style={{ padding: '12px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '16px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Users size={18} /> Friends
            </h3>

            <div className="friend-search" style={{ position: 'relative', marginBottom: '20px' }}>
                <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                <input
                    type="text"
                    placeholder="Search users to add..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    style={{ 
                        width: '100%',
                        padding: '12px 12px 12px 38px',
                        borderRadius: '12px',
                        border: '1px solid var(--border)',
                        background: 'var(--bg-input)',
                        fontSize: '14px'
                    }}
                />
            </div>

            {searchResults.length > 0 && (
                <div className="search-results" style={{ 
                    background: 'var(--bg-card)', 
                    borderRadius: '12px', 
                    border: '1px solid var(--border)',
                    marginBottom: '20px',
                    overflow: 'hidden'
                }}>
                    <div style={{ padding: '10px 12px', fontSize: '12px', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border)' }}>Search Results</div>
                    {searchResults.map(u => (
                        <div key={u.id} className="search-result-item" style={{ padding: '10px 12px', display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid var(--border)' }}>
                            <Avatar username={u.username} size={32} />
                            <span style={{ flex: 1, fontWeight: '500', fontSize: '14px' }}>{u.username}</span>
                            <button
                                className="btn-small btn-primary"
                                onClick={() => handleSendRequest(u.id)}
                                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '8px' }}
                            >
                                <UserPlus size={14} /> Add
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {searching && <div className="loading-small" style={{ textAlign: 'center', padding: '10px' }}><Loader2 size={16} className="animate-spin" /> Searching...</div>}

            {loading ? (
                <div className="loading-small" style={{ textAlign: 'center', padding: '20px' }}><Loader2 size={20} className="animate-spin" /> Loading friends...</div>
            ) : friends.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-secondary)' }}>
                    <div style={{ fontSize: '40px', marginBottom: '12px', opacity: 0.5 }}>👥</div>
                    <p style={{ fontSize: '14px', margin: 0 }}>No friends yet. Search and add some!</p>
                </div>
            ) : (
                <div className="friends-list">
                    {friends.map(f => (
                        <div
                            key={f.friendshipId}
                            className={`friend-item friend-item-clickable ${openingDM === f.id ? 'friend-item-loading' : ''}`}
                            onClick={() => handleOpenDM(f.id)}
                            style={{ 
                                display: 'flex',
                                alignItems: 'center',
                                padding: '10px 12px',
                                borderRadius: '12px',
                                marginBottom: '4px',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                background: openingDM === f.id ? 'var(--bg-hover)' : 'transparent'
                            }}
                            title={`Chat with ${f.username}`}
                        >
                            <div className="avatar-with-status" style={{ position: 'relative' }}>
                                <Avatar username={f.username} size={40} />
                                <span 
                                    className={`status-dot-badge ${(onlineUsers || []).includes(f.id) ? 'online' : 'offline'}`}
                                    style={{
                                        position: 'absolute',
                                        bottom: '2px',
                                        right: '2px',
                                        width: '10px',
                                        height: '10px',
                                        borderRadius: '50%',
                                        border: '2px solid var(--bg-card)',
                                        background: (onlineUsers || []).includes(f.id) ? 'var(--success)' : 'var(--text-secondary)'
                                    }}
                                />
                            </div>
                            <span className="friend-name" style={{ marginLeft: '12px', fontWeight: '600', flex: 1 }}>{f.username}</span>
                            <span className="friend-chat-icon" style={{ color: 'var(--primary)', opacity: 0.8 }}>
                                <MessageCircle size={18} />
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
