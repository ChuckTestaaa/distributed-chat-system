import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from './AuthContext';

const SocketContext = createContext();

const WS_URL = import.meta.env.VITE_API_URL
    ? `${import.meta.env.VITE_API_URL.replace(/^http/, 'ws')}/ws`
    : `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`;

export function useSocket() {
    return useContext(SocketContext);
}

export function SocketProvider({ children }) {
    const { token } = useAuth();
    const wsRef = useRef(null);
    const listenersRef = useRef(new Map());
    const [isConnected, setIsConnected] = useState(false);
    const [onlineUsers, setOnlineUsers] = useState([]);
    const reconnectTimer = useRef(null);
    const reconnectAttempt = useRef(0);
    const maxReconnectAttempts = 10;

    const addListener = useCallback((event, fn) => {
        if (!listenersRef.current.has(event)) {
            listenersRef.current.set(event, new Set());
        }
        listenersRef.current.get(event).add(fn);
        return () => listenersRef.current.get(event)?.delete(fn);
    }, []);

    const emit = useCallback((event, data) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ event, data }));
        }
    }, []);

    const connect = useCallback(() => {
        if (!token) return;
        if (wsRef.current && wsRef.current.readyState <= 1) return; // CONNECTING or OPEN

        const ws = new WebSocket(`${WS_URL}?token=${token}`);

        ws.onopen = () => {
            setIsConnected(true);
            reconnectAttempt.current = 0;
            console.log('WebSocket connected');
        };

        ws.onmessage = (e) => {
            try {
                const parsed = JSON.parse(e.data);
                console.log('WS msg:', parsed);
                const { event, data } = parsed;
                if (event === 'user_online') {
                    setOnlineUsers(prev => [...new Set([...prev, data.userId])]);
                } else if (event === 'user_offline') {
                    setOnlineUsers(prev => prev.filter(id => id !== data.userId));
                }

                // Events dispatched as CustomEvents for component-level listeners
                const dispatchEvents = [
                    'incoming_call', 'call_accepted', 'ice_candidate', 'call_ended',
                    'friend_request', 'friend_accepted',
                ];
                if (dispatchEvents.includes(event)) {
                    window.dispatchEvent(new CustomEvent(event, { detail: data }));
                }

                // Notify registered listeners
                const fns = listenersRef.current.get(event);
                if (fns) {
                    for (const fn of fns) fn(data);
                }
            } catch { /* ignore malformed frames */ }
        };

        ws.onclose = (e) => {
            setIsConnected(false);
            wsRef.current = null;
            console.log('WebSocket disconnected. Code:', e.code, 'Reason:', e.reason);

            // Exponential backoff reconnect
            if (reconnectAttempt.current < maxReconnectAttempts) {
                const delay = Math.min(1000 * 2 ** reconnectAttempt.current, 30000);
                reconnectAttempt.current++;
                reconnectTimer.current = setTimeout(connect, delay);
            }
        };

        ws.onerror = () => {
            ws.close();
        };

        wsRef.current = ws;
    }, [token]);

    useEffect(() => {
        connect();
        return () => {
            clearTimeout(reconnectTimer.current);
            wsRef.current?.close();
            wsRef.current = null;
        };
    }, [connect]);

    // ── Convenience methods matching the old API ──────────────

    const joinRoom = useCallback((roomId) => emit('join_room', roomId), [emit]);
    const leaveRoom = useCallback((roomId) => emit('leave_room', roomId), [emit]);
    const sendMessage = useCallback((roomId, content, type = 'TEXT') => emit('send_message', { roomId, content, type }), [emit]);
    const sendTyping = useCallback((roomId, isTyping) => emit('typing', { roomId, isTyping }), [emit]);

    const onNewMessage = useCallback((callback) => {
        // Listen to both live and offline-delivered messages
        const unsub1 = addListener('new_message', callback);
        const unsub2 = addListener('offline_message', callback);
        return () => { unsub1(); unsub2(); };
    }, [addListener]);
    const onTyping = useCallback((callback) => addListener('typing', callback), [addListener]);

    // WebRTC emitters
    const callUser = useCallback((to, offer) => emit('call_user', { to, offer }), [emit]);
    const answerCall = useCallback((to, answer) => emit('answer_call', { to, answer }), [emit]);
    const sendIceCandidate = useCallback((to, candidate) => emit('ice_candidate', { to, candidate }), [emit]);
    const endCall = useCallback((to) => emit('end_call', { to }), [emit]);

    const addReaction = useCallback((roomId, messageId, emoji) => emit('add_reaction', { roomId, messageId, emoji }), [emit]);
    const onReactionUpdate = useCallback((callback) => addListener('message_reaction_updated', callback), [addListener]);

    const revealSecret = useCallback((roomId, messageId) => emit('reveal_secret', { roomId, messageId }), [emit]);
    const onSecretRevealed = useCallback((callback) => addListener('secret_revealed', callback), [addListener]);
    const onMessageBurned = useCallback((callback) => addListener('message_burned', callback), [addListener]);

    const value = {
        isConnected,
        onlineUsers,
        joinRoom,
        leaveRoom,
        sendMessage,
        sendTyping,
        onNewMessage,
        onTyping,
        callUser,
        answerCall,
        sendIceCandidate,
        endCall,
        addReaction,
        onReactionUpdate,
        revealSecret,
        onSecretRevealed,
        onMessageBurned,
    };

    return (
        <SocketContext.Provider value={value}>
            {children}
        </SocketContext.Provider>
    );
}
