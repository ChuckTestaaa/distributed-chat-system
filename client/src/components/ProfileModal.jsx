import { useState, useEffect } from 'react';
import { usersApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import Avatar from './Avatar';

export default function ProfileModal({ onClose, targetUserId, inline }) {
    const { user, setUser } = useAuth();
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [editData, setEditData] = useState({ bio: '', avatarUrl: '' });

    const isOwnProfile = !targetUserId || targetUserId === user?.id;
    const userIdToLoad = targetUserId || user?.id;

    useEffect(() => {
        const loadProfile = async () => {
            try {
                const data = await usersApi.get(userIdToLoad);
                setProfile(data);
                if (isOwnProfile) {
                    setEditData({ bio: data.bio || '', avatarUrl: data.avatarUrl || '' });
                }
            } catch (err) {
                console.error('Failed to load profile:', err);
            } finally {
                setLoading(false);
            }
        };
        loadProfile();
    }, [userIdToLoad, isOwnProfile]);

    const handleSave = async (e) => {
        e.preventDefault();
        try {
            const updated = await usersApi.updateProfile(editData);
            setProfile(updated);
            if (isOwnProfile && setUser) {
                // Update local context user if needed
                setUser({ ...user, avatarUrl: updated.avatarUrl });
            }
            setIsEditing(false);
        } catch (err) {
            alert('Failed to update profile: ' + err.message);
        }
    };

    const content = (
        <div className={inline ? "" : "modal-content"} onClick={e => e.stopPropagation()} style={{ maxWidth: inline ? '100%' : '400px', width: '100%', height: inline ? '100%' : 'auto', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', padding: inline ? '20px' : '0' }}>
                <h2 style={{ margin: 0, fontSize: '18px' }}>{isOwnProfile ? 'Your Profile' : 'User Profile'}</h2>
                {!inline && <button className="btn-ghost" onClick={onClose} style={{ padding: '4px 8px' }}>✕</button>}
            </div>

            <div style={{ padding: inline ? '0 20px 20px' : '0' }}>
            {loading ? (
                <div className="loading">Loading...</div>
            ) : profile ? (
                isEditing ? (
                    <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div className="form-group">
                            <label>Avatar URL</label>
                            <input
                                type="text"
                                value={editData.avatarUrl}
                                onChange={e => setEditData({ ...editData, avatarUrl: e.target.value })}
                                placeholder="https://..."
                            />
                        </div>
                        <div className="form-group">
                            <label>Bio</label>
                            <textarea
                                style={{ width: '100%', padding: '12px 16px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-primary)' }}
                                value={editData.bio}
                                onChange={e => setEditData({ ...editData, bio: e.target.value })}
                                placeholder="Tell us about yourself..."
                                rows="4"
                            />
                        </div>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                            <button type="button" className="btn-ghost" onClick={() => setIsEditing(false)}>Cancel</button>
                            <button type="submit" className="btn-primary" style={{ width: 'auto' }}>Save Changes</button>
                        </div>
                    </form>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                        <div style={{ marginBottom: '16px' }}>
                            {profile.avatarUrl ? (
                                <img src={profile.avatarUrl} alt={profile.username} style={{ width: '100px', height: '100px', borderRadius: '50%', objectFit: 'cover' }} />
                            ) : (
                                <Avatar username={profile.username} size={100} style={{ fontSize: '36px' }} />
                            )}
                        </div>
                        <h3 style={{ fontSize: '24px', margin: '0 0 4px' }}>{profile.username}</h3>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: '16px' }}>{profile.email}</p>
                        
                        <div style={{ background: 'var(--bg-input)', padding: '16px', borderRadius: '8px', width: '100%', marginBottom: '24px', textAlign: 'left' }}>
                            <h4 style={{ color: 'var(--text-secondary)', fontSize: '12px', textTransform: 'uppercase', marginBottom: '8px' }}>About Me</h4>
                            <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{profile.bio || 'No bio provided.'}</p>
                        </div>

                        {isOwnProfile && (
                            <button className="btn-primary" style={{ width: '100%' }} onClick={() => setIsEditing(true)}>
                                Edit Profile
                            </button>
                        )}
                    </div>
                )
            ) : (
                <div className="empty-state">User not found</div>
            )}
            </div>
        </div>
    );

    if (inline) {
        return content;
    }

    return (
        <div className="modal-overlay" onClick={onClose}>
            {content}
        </div>
    );
}
