import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import CallModal from './CallModal';

export default function GlobalCallHandler() {
    const { user } = useAuth();
    const [callState, setCallState] = useState({
        active: false,
        isInitiator: false,
        targetId: null,
        incomingCall: null,
    });

    useEffect(() => {
        if (!user) return;

        const handleIncomingCall = (e) => {
            const data = e.detail;
            if (callState.active) return;

            setCallState({
                active: true,
                isInitiator: false,
                targetId: null,
                incomingCall: data,
            });
        };

        window.addEventListener('incoming_call', handleIncomingCall);
        return () => window.removeEventListener('incoming_call', handleIncomingCall);
    }, [user, callState.active]);

    const handleEndCall = () => {
        setCallState({
            active: false,
            isInitiator: false,
            targetId: null,
            incomingCall: null,
        });
    };

    if (!callState.active) return null;

    return (
        <CallModal
            isInitiator={callState.isInitiator}
            targetUserId={callState.targetId}
            incomingCall={callState.incomingCall}
            onEndCall={handleEndCall}
        />
    );
}
