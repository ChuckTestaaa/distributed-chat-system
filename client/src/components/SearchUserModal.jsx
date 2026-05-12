import { useState, useEffect } from 'react';
import { usersApi, roomsApi } from '../services/api';

export default function SearchUserModal({ onClose, roomId, onMemberAdded }) {
    const [searchTerm, setSearchTerm] = useState('');
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [adding, setAdding] = useState(null);
    const [error, setError] = useState('');

    useEffect(() => {
        const timer = setTimeout(() => {
            if (searchTerm.length >= 2) {
                searchUsers();
            } else {
                setResults([]);
            }
        }, 500);

        return () => clearTimeout(timer);
    }, [searchTerm]);

    const searchUsers = async () => {
        setLoading(true);
        setError('');
        try {
            const data = await usersApi.search(searchTerm);
            setResults(data.users || []);
        } catch (err) {
            console.error('Search failed:', err);
            // Don't show error for empty results
        } finally {
            setLoading(false);
        }
    };

    const handleAdd = async (userId) => {
        setAdding(userId);
        try {
            await roomsApi.addMember(roomId, userId);
            onMemberAdded(userId);
            alert('Member added successfully!');
            onClose();
        } catch (err) {
            setError(err.message);
        } finally {
            setAdding(null);
        }
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content">
                <div className="modal-header">
                    <h3>Add Member</h3>
                    <button onClick={onClose} className="close-btn">×</button>
                </div>

                <div className="modal-body">
                    <input
                        type="text"
                        placeholder="Search by username or email..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="search-input"
                        autoFocus
                    />

                    {error && <div className="error-message">{error}</div>}

                    <div className="search-results">
                        {loading ? (
                            <div className="loading-small">Searching...</div>
                        ) : results.length > 0 ? (
                            results.map(user => (
                                <div key={user.id} className="user-item">
                                    <div className="user-info">
                                        <span className="user-name">{user.username}</span>
                                        <span className="user-email">{user.email}</span>
                                    </div>
                                    <button
                                        onClick={() => handleAdd(user.id)}
                                        disabled={adding === user.id}
                                        className="btn-add"
                                    >
                                        {adding === user.id ? 'Adding...' : 'Add'}
                                    </button>
                                </div>
                            ))
                        ) : searchTerm.length >= 2 ? (
                            <div className="empty-results">No users found</div>
                        ) : (
                            <div className="empty-results">Type at least 2 characters to search</div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
