const API_BASE = import.meta.env.VITE_API_URL
    ? `${import.meta.env.VITE_API_URL}/api`
    : '/api';

/**
 * Make API request with optional auth token
 */
async function request(endpoint, options = {}) {
    const token = localStorage.getItem('token');

    const config = {
        headers: {
            'Content-Type': 'application/json',
            ...(token && { Authorization: `Bearer ${token}` }),
            ...options.headers,
        },
        ...options,
    };

    const response = await fetch(`${API_BASE}${endpoint}`, config);
    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || 'Request failed');
    }

    return data;
}

// Auth API
export const authApi = {
    register: (username, email, password) =>
        request('/auth/register', {
            method: 'POST',
            body: JSON.stringify({ username, email, password }),
        }),

    login: (email, password) =>
        request('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password }),
        }),

    getMe: () => request('/auth/me'),
};

// Rooms API
export const roomsApi = {
    list: () => request('/rooms'),
    get: (id) => request(`/rooms/${id}`),

    create: (name, type = 'GROUP', memberIds = []) =>
        request('/rooms', {
            method: 'POST',
            body: JSON.stringify({ name, type, memberIds }),
        }),

    getMessages: (roomId, limit = 50, before = null) => {
        const params = new URLSearchParams({ limit });
        if (before) params.append('before', before);
        return request(`/rooms/${roomId}/messages?${params}`);
    },

    addMember: (roomId, userId) =>
        request(`/rooms/${roomId}/members`, {
            method: 'POST',
            body: JSON.stringify({ userId }),
        }),

    createInvite: (roomId) =>
        request(`/rooms/${roomId}/invite`, { method: 'POST' }),

    joinByInvite: (code) =>
        request(`/rooms/join/${code}`, { method: 'POST' }),

    getOrCreateDM: (friendId) =>
        request('/rooms/dm', {
            method: 'POST',
            body: JSON.stringify({ friendId }),
        }),
};

// Users API
export const usersApi = {
    search: (query) => request(`/users?search=${encodeURIComponent(query)}`),
    get: (id) => request(`/users/${id}`),
    updateProfile: (data) => request('/users/profile', {
        method: 'PUT',
        body: JSON.stringify(data)
    }),
};

// Friends API
export const friendsApi = {
    list: () => request('/friends'),
    pending: () => request('/friends/pending'),

    sendRequest: (userId) =>
        request('/friends/request', {
            method: 'POST',
            body: JSON.stringify({ userId }),
        }),

    accept: (id) =>
        request(`/friends/accept/${id}`, { method: 'POST' }),

    reject: (id) =>
        request(`/friends/reject/${id}`, { method: 'POST' }),
};
