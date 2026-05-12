import { useState, useEffect, useCallback } from 'react';
import { friendsApi } from '../services/api';
import { useSocket } from '../hooks/useSocket';
import Avatar from './Avatar';

export default function FriendRequests() {
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const { onlineUsers } = useSocket();

    const loadRequests = useCallback(async () => {
        try {
            const data = await friendsApi.pending();
            setRequests(data.requests || []);
        } catch (err) {
            console.error('Failed to load friend requests:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadRequests();
    }, [loadRequests]);

    // Listen for real-time friend requests via WebSocket
    useEffect(() => {
        const handler = (e) => {
            loadRequests();
        };
        window.addEventListener('friend_request', handler);
        return () => window.removeEventListener('friend_request', handler);
    }, [loadRequests]);

    const handleAccept = async (id) => {
        try {
            await friendsApi.accept(id);
            setRequests(prev => prev.filter(r => r.id !== id));
        } catch (err) {
            alert(err.message);
        }
    };

    const handleReject = async (id) => {
        try {
            await friendsApi.reject(id);
            setRequests(prev => prev.filter(r => r.id !== id));
        } catch (err) {
            alert(err.message);
        }
    };

    if (loading) return <div className="loading-small">Loading...</div>;
    if (requests.length === 0) return null;

    return (
        <div className="friend-requests">
            <h4><UserCheck size={16} /> Friend Requests ({requests.length})</h4>
            {requests.map(r => (
                <div key={r.id} className="friend-request-item">
                    <div className="friend-info">
                        <Avatar username={r.requester.username} size={28} />
                        <span className="friend-name">{r.requester.username}</span>
                    </div>
                    <div className="friend-actions">
                        <button className="btn-small btn-success" onClick={() => handleAccept(r.id)} title="Accept">
                            <Check size={14} />
                        </button>
                        <button className="btn-small btn-danger" onClick={() => handleReject(r.id)} title="Reject">
                            <X size={14} />
                        </button>
                    </div>
                </div>
            ))}
        </div>
    );
}
