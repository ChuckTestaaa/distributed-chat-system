import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../hooks/useSocket';
import { roomsApi } from '../services/api';
import FriendsList from '../components/FriendsList';
import FriendRequests from '../components/FriendRequests';
import Avatar from '../components/Avatar';
import ProfileModal from '../components/ProfileModal';
import { Settings, LogOut, MessageSquare, Users, PlusCircle, Loader2, Sun, Moon, Search } from 'lucide-react';

export default function RoomList() {
    const [rooms, setRooms] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);
    const [showFriends, setShowFriends] = useState(false);
    const [showProfile, setShowProfile] = useState(false);
    const [newRoomName, setNewRoomName] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');
    const { user, logout } = useAuth();
    const { onRoomActivity } = useSocket();
    const navigate = useNavigate();

    // Filter rooms based on search term
    const filteredRooms = rooms.filter(room => {
        const displayName = room.type === 'PRIVATE'
            ? (room.members?.find(m => m.id !== user?.id)?.username || room.name)
            : room.name;
        return displayName.toLowerCase().includes(searchTerm.toLowerCase());
    });

    useEffect(() => {
        document.body.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
    }, [theme]);

    const toggleTheme = () => {
        setTheme(prev => prev === 'dark' ? 'light' : 'dark');
    };

    useEffect(() => {
        loadRooms();
    }, []);

    const loadRooms = async () => {
        try {
            const data = await roomsApi.list();
            setRooms(data.rooms || []);
        } catch (err) {
            console.error('Failed to load rooms:', err);
        } finally {
            setLoading(false);
        }
    };

    // Listen for real-time room activity (new messages)
    useEffect(() => {
        return onRoomActivity((data) => {
            setRooms(prev => {
                const index = prev.findIndex(r => r.id === data.roomId);
                if (index === -1) {
                    // Room not in list (might be a new DM or group)
                    loadRooms();
                    return prev;
                }
                
                const updatedRoom = { 
                    ...prev[index], 
                    lastMessage: data.lastMessage,
                    lastMessageAt: data.lastMessage.createdAt
                };
                
                const newRooms = [...prev];
                newRooms.splice(index, 1); // Remove from current position
                return [updatedRoom, ...newRooms]; // Add to top
            });
        });
    }, [onRoomActivity]);

    const handleCreateRoom = async (e) => {
        e.preventDefault();
        if (!newRoomName.trim()) return;

        try {
            const room = await roomsApi.create(newRoomName.trim());
            setRooms([room, ...rooms]);
            setNewRoomName('');
            setShowCreate(false);
        } catch (err) {
            alert(err.message);
        }
    };

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <div className="room-list-container" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <header className="header" style={{ 
                padding: '12px 16px', 
                borderBottom: '1px solid var(--border)', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                background: 'var(--bg-card)'
            }}>
                <h2 style={{ fontSize: '20px', margin: 0, color: 'var(--primary)', fontWeight: '800', letterSpacing: '-0.5px' }}>DistriChat</h2>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                        onClick={toggleTheme}
                        className="btn-ghost"
                        style={{ padding: '8px', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--bg-hover)' }}
                        title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                    >
                        {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
                    </button>
                    <button
                        onClick={() => setShowFriends(!showFriends)}
                        className="btn-ghost"
                        style={{ padding: '8px', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--bg-hover)' }}
                        title={showFriends ? 'View Chats' : 'View Friends'}
                    >
                        {showFriends ? <MessageSquare size={20} /> : <Users size={20} />}
                    </button>
                </div>
            </header>

            <div className="main-layout" style={{ flex: 1, overflowY: 'auto' }}>
                {showFriends ? (
                    <div className="friends-side-panel">
                        <FriendRequests />
                        <FriendsList />
                    </div>
                ) : (
                    <div className="conversations-panel" style={{ padding: '12px' }}>
                        <div className="search-bar" style={{ position: 'relative', marginBottom: '16px' }}>
                            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', opacity: 0.7 }} />
                            <input
                                type="text"
                                placeholder="Search conversations..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '10px 12px 10px 36px',
                                    borderRadius: '10px',
                                    border: '1px solid var(--border)',
                                    background: 'var(--bg-input)',
                                    fontSize: '14px',
                                    transition: 'border-color 0.2s'
                                }}
                            />
                        </div>

                        <button
                            className="create-room-btn"
                            onClick={() => setShowCreate(!showCreate)}
                            style={{ 
                                width: '100%',
                                padding: '14px', 
                                fontSize: '14px', 
                                marginBottom: '16px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '10px',
                                borderRadius: '12px',
                                fontWeight: '600'
                            }}
                        >
                            <PlusCircle size={18} /> New Chat Room
                        </button>

                        {showCreate && (
                            <form onSubmit={handleCreateRoom} className="create-room-form" style={{ marginBottom: '16px' }}>
                                <input
                                    type="text"
                                    value={newRoomName}
                                    onChange={(e) => setNewRoomName(e.target.value)}
                                    placeholder="Enter room name..."
                                    autoFocus
                                    style={{ borderRadius: '10px 0 0 10px' }}
                                />
                                <button type="submit" className="btn-primary" style={{ padding: '8px 20px', borderRadius: '0 10px 10px 0' }}>Add</button>
                            </form>
                        )}

                        {loading ? (
                            <div className="loading" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                                <Loader2 className="animate-spin" style={{ marginBottom: '10px' }} />
                                <p>Loading your chats...</p>
                            </div>
                        ) : rooms.length === 0 ? (
                            <div className="empty-state" style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                                <div style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.5 }}>💬</div>
                                <h3 style={{ margin: '0 0 8px 0', color: 'var(--text-primary)' }}>No conversations yet</h3>
                                <p style={{ fontSize: '14px', margin: 0 }}>Create a room or find friends to start chatting!</p>
                            </div>
                        ) : (
                                <div className="rooms-list-scroll">
                                    {filteredRooms.map(room => {
                                    const displayName = room.type === 'PRIVATE'
                                        ? (room.members?.find(m => m.id !== user?.id)?.username || room.name)
                                        : room.name;

                                    return (
                                        <Link
                                            key={room.id}
                                            to={`/chat/${room.id}`}
                                            className="room-item"
                                            style={{ 
                                                padding: '12px', 
                                                borderRadius: '12px',
                                                marginBottom: '4px',
                                                transition: 'all 0.2s ease'
                                            }}
                                        >
                                            <Avatar username={displayName} size={44} />
                                            <div className="room-info" style={{ marginLeft: '12px' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <h3 style={{ fontSize: '15px', fontWeight: '600', margin: 0 }}>{displayName}</h3>
                                                    {room.type !== 'PRIVATE' && (
                                                        <span className="room-type" style={{ fontSize: '9px', padding: '2px 6px', background: 'var(--primary)', color: 'white', borderRadius: '4px', fontWeight: '700' }}>GROUP</span>
                                                    )}
                                                </div>
                                                <p className="last-message" style={{ fontSize: '13px', margin: '4px 0 0 0', opacity: 0.7, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                    {room.lastMessage
                                                        ? `${room.lastMessage.sender?.username}: ${room.lastMessage.content}`
                                                        : 'Start a conversation...'}
                                                </p>
                                            </div>
                                        </Link>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Bottom User Bar */}
            <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-card)' }}>
                <div 
                    style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', flex: 1, minWidth: 0 }}
                    onClick={() => setShowProfile(true)}
                >
                    <Avatar username={user?.username} size={40} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: '700', fontSize: '15px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--text-primary)' }}>{user?.username}</div>
                        <div style={{ fontSize: '12px', color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--success)' }}></div>
                            Online
                        </div>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button 
                        onClick={() => setShowProfile(true)} 
                        className="btn-ghost" 
                        style={{ padding: '10px', borderRadius: '12px', color: 'var(--text-secondary)' }} 
                        title="Profile Settings"
                    >
                        <Settings size={22} />
                    </button>
                    <button 
                        onClick={handleLogout} 
                        className="btn-ghost" 
                        style={{ padding: '10px', borderRadius: '12px', color: 'var(--error)' }} 
                        title="Logout"
                    >
                        <LogOut size={22} />
                    </button>
                </div>
            </div>

            {showProfile && (
                <ProfileModal onClose={() => setShowProfile(false)} />
            )}
        </div>
    );
}
