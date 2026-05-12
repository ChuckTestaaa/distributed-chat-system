import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { roomsApi } from '../services/api';

export default function JoinRoom() {
    const { code } = useParams();
    const { user, loading: authLoading } = useAuth();
    const navigate = useNavigate();

    const [status, setStatus] = useState('loading');
    const [error, setError] = useState('');

    useEffect(() => {
        if (authLoading) return;
        if (!user) {
            setStatus('unauthenticated');
            return;
        }

        const join = async () => {
            try {
                const result = await roomsApi.joinByInvite(code);
                navigate(`/chat/${result.roomId}`, { replace: true });
            } catch (err) {
                setError(err.message);
                setStatus('error');
            }
        };
        join();
    }, [code, user, authLoading, navigate]);

    if (authLoading || status === 'loading') {
        return (
            <div className="join-page">
                <div className="join-card">
                    <div className="join-spinner" />
                    <p>Joining room...</p>
                </div>
            </div>
        );
    }

    if (status === 'unauthenticated') {
        return (
            <div className="join-page">
                <div className="join-card">
                    <h2>You've been invited!</h2>
                    <p>Sign in to join this chat room.</p>
                    <div className="join-actions">
                        <Link to="/login" className="btn-primary">Sign In</Link>
                        <Link to="/register" className="btn-ghost">Create Account</Link>
                    </div>
                </div>
            </div>
        );
    }

    if (status === 'error') {
        return (
            <div className="join-page">
                <div className="join-card">
                    <h2>Could not join</h2>
                    <p className="join-error">{error}</p>
                    <Link to="/" className="btn-primary">Go to Rooms</Link>
                </div>
            </div>
        );
    }

    return null;
}
