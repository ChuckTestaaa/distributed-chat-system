import { useState, useEffect, useRef, useCallback } from 'react';
import { useSocket } from '../hooks/useSocket';
import { Mic, MicOff, Video, VideoOff, PhoneOff, PhoneCall } from 'lucide-react';

const ICE_SERVERS = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:global.stun.twilio.com:3478' },
];

export default function CallModal({ isInitiator, targetUserId, incomingCall, onEndCall }) {
    const { callUser, answerCall, sendIceCandidate, endCall } = useSocket();

    const [stream, setStream] = useState(null);
    const [remoteStream, setRemoteStream] = useState(null);
    const [callStatus, setCallStatus] = useState(isInitiator ? 'calling' : 'incoming');
    const [error, setError] = useState('');
    const [isMuted, setIsMuted] = useState(false);
    const [isVideoOff, setIsVideoOff] = useState(false);

    const localVideo = useRef();
    const remoteVideo = useRef();
    const pcRef = useRef(null);
    const iceCandidateQueue = useRef([]);

    // ── 1. Acquire local media ───────────────────────────────

    useEffect(() => {
        let cancelled = false;

        (async () => {
            try {
                const s = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
                if (!cancelled) {
                    setStream(s);
                    if (localVideo.current) localVideo.current.srcObject = s;
                }
            } catch {
                try {
                    const s = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
                    if (!cancelled) {
                        setStream(s);
                        setError('Camera unavailable — audio-only mode.');
                    }
                } catch {
                    if (!cancelled) setError('Cannot access microphone. Call cannot proceed.');
                }
            }
        })();

        return () => {
            cancelled = true;
        };
    }, []);

    // Stop tracks on unmount
    useEffect(() => {
        return () => stream?.getTracks().forEach(t => t.stop());
    }, [stream]);

    const toggleMute = () => {
        if (stream) {
            const audioTrack = stream.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled;
                setIsMuted(!audioTrack.enabled);
            }
        }
    };

    const toggleVideo = () => {
        if (stream) {
            const videoTrack = stream.getVideoTracks()[0];
            if (videoTrack) {
                videoTrack.enabled = !videoTrack.enabled;
                setIsVideoOff(!videoTrack.enabled);
            }
        }
    };

    // ── 2. Create RTCPeerConnection ──────────────────────────

    const createPeerConnection = useCallback((localStream) => {
        const pc = new RTCPeerConnection({ 
            iceServers: ICE_SERVERS,
            iceCandidatePoolSize: 10
        });

        // Add local tracks
        if (localStream) {
            localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
        }

        // Remote track arrives
        pc.ontrack = (e) => {
            setRemoteStream(e.streams[0]);
            setCallStatus('connected');
        };

        // Trickle ICE: send candidates as they're discovered
        pc.onicecandidate = (e) => {
            if (e.candidate) {
                const to = isInitiator ? targetUserId : incomingCall?.from;
                if (to) sendIceCandidate(to, e.candidate);
            }
        };

        pc.oniceconnectionstatechange = () => {
            const state = pc.iceConnectionState;
            console.log('ICE state changed:', state);
            setCallStatus(prev => {
                if (state === 'connected') return 'connected';
                if (state === 'checking') return 'connecting...';
                if (state === 'failed') return 'retrying connection...';
                return prev;
            });

            if (state === 'failed') {
                // Give it a 3-second grace period to recover or find a relay
                setTimeout(() => {
                    if (pcRef.current && pcRef.current.iceConnectionState === 'failed') {
                        console.error('ICE connection failed permanently');
                        cleanup();
                    }
                }, 3000);
            }
        };

        pcRef.current = pc;
        return pc;
    }, [isInitiator, targetUserId, incomingCall, sendIceCandidate]);

    // ── 3. Initiator: create offer ───────────────────────────

    useEffect(() => {
        if (!isInitiator || !stream || pcRef.current) return;

        (async () => {
            setCallStatus('connecting');
            const pc = createPeerConnection(stream);
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            callUser(targetUserId, offer);
        })();
    }, [isInitiator, stream, createPeerConnection, callUser, targetUserId]);

    // ── 4. Receiver: accept incoming call ────────────────────

    const acceptCall = useCallback(async () => {
        if (!stream || !incomingCall) return;
        setCallStatus('connecting');
        const pc = createPeerConnection(stream);
        await pc.setRemoteDescription(new RTCSessionDescription(incomingCall.offer));

        // Flush queued ICE candidates
        for (const c of iceCandidateQueue.current) {
            try {
                await pc.addIceCandidate(new RTCIceCandidate(c));
            } catch (e) { console.warn('Queued ICE failure', e); }
        }
        iceCandidateQueue.current = [];

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        answerCall(incomingCall.from, answer);
    }, [stream, incomingCall, createPeerConnection, answerCall]);

    // ── 5. Initiator: handle answer ──────────────────────────

    useEffect(() => {
        const handler = async (e) => {
            const { from, answer } = e.detail;
            if (!isInitiator || from !== targetUserId || !pcRef.current) return;
            if (pcRef.current.signalingState === 'stable') return; // already set

            await pcRef.current.setRemoteDescription(new RTCSessionDescription(answer));

            // Flush queued ICE candidates
            for (const c of iceCandidateQueue.current) {
                try {
                    await pcRef.current.addIceCandidate(new RTCIceCandidate(c));
                } catch (e) { console.warn('Queued ICE failure (initiator)', e); }
            }
            iceCandidateQueue.current = [];
        };

        window.addEventListener('call_accepted', handler);
        return () => window.removeEventListener('call_accepted', handler);
    }, [isInitiator, targetUserId]);

    // ── 6. Handle ICE candidates from remote ─────────────────

    useEffect(() => {
        const handler = async (e) => {
            const { candidate } = e.detail;
            if (!candidate) return;

            try {
                if (pcRef.current && pcRef.current.remoteDescription && pcRef.current.remoteDescription.type) {
                    await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
                } else {
                    iceCandidateQueue.current.push(candidate);
                }
            } catch (err) {
                console.warn('Failed to add ice candidate:', err);
            }
        };

        window.addEventListener('ice_candidate', handler);
        return () => window.removeEventListener('ice_candidate', handler);
    }, []);

    // ── 7. Remote end call ───────────────────────────────────

    useEffect(() => {
        const handler = () => cleanup();
        window.addEventListener('call_ended', handler);
        return () => window.removeEventListener('call_ended', handler);
    }, []);

    // ── Cleanup ──────────────────────────────────────────────

    const cleanup = useCallback(() => {
        if (pcRef.current) {
            pcRef.current.close();
            pcRef.current = null;
        }
        onEndCall();
    }, [onEndCall]);

    const handleEndCall = () => {
        const to = isInitiator ? targetUserId : incomingCall?.from;
        if (to) endCall(to);
        cleanup();
    };

    // ── Sync video elements ──────────────────────────────────

    useEffect(() => {
        if (localVideo.current && stream) localVideo.current.srcObject = stream;
    }, [stream]);

    useEffect(() => {
        if (remoteVideo.current && remoteStream) {
            remoteVideo.current.srcObject = remoteStream;
            remoteVideo.current.play().catch(() => {});
        }
    }, [remoteStream]);

    // ── Render ───────────────────────────────────────────────

    return (
        <div className="call-modal-overlay">
            <div className="call-container">
                <video playsInline ref={remoteVideo} autoPlay className="remote-video" />

                <video
                    playsInline
                    muted
                    ref={localVideo}
                    autoPlay
                    className={`local-video ${callStatus === 'connected' ? 'pip' : 'preview'}`}
                />

                <div className="call-controls" style={{ 
                    display: 'flex', 
                    gap: '15px', 
                    alignItems: 'center', 
                    background: 'rgba(0,0,0,0.7)', 
                    padding: '12px 20px', 
                    borderRadius: '40px', 
                    backdropFilter: 'blur(15px)', 
                    position: 'absolute', 
                    bottom: '30px', 
                    left: '50%', 
                    transform: 'translateX(-50%)', 
                    zIndex: 100,
                    width: 'max-content',
                    maxWidth: '90vw'
                }}>
                    {callStatus === 'incoming' ? (
                        <>
                            <button className="btn-success" onClick={acceptCall} style={{ width: '60px', height: '60px', minWidth: '60px', minHeight: '60px', borderRadius: '50%', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: 0, flexShrink: 0, border: 'none' }}>
                                <PhoneCall size={28} />
                            </button>
                            <button className="btn-danger-round" onClick={handleEndCall} style={{ width: '60px', height: '60px', minWidth: '60px', minHeight: '60px', borderRadius: '50%', flexShrink: 0, border: 'none', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <PhoneOff size={28} />
                            </button>
                        </>
                    ) : (
                        <>
                            <button 
                                className="btn-ghost" 
                                onClick={toggleMute} 
                                style={{ 
                                    width: '50px', height: '50px', minWidth: '50px', minHeight: '50px', borderRadius: '50%', background: isMuted ? 'var(--error)' : 'rgba(255,255,255,0.1)', color: 'white', border: 'none', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                                }}
                            >
                                {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
                            </button>
                            
                            <button className="btn-danger-round" onClick={handleEndCall} style={{ width: '60px', height: '60px', minWidth: '60px', minHeight: '60px', borderRadius: '50%', flexShrink: 0, border: 'none', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <PhoneOff size={28} />
                            </button>

                            <button 
                                className="btn-ghost" 
                                onClick={toggleVideo} 
                                style={{ 
                                    width: '50px', height: '50px', minWidth: '50px', minHeight: '50px', borderRadius: '50%', background: isVideoOff ? 'var(--error)' : 'rgba(255,255,255,0.1)', color: 'white', border: 'none', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                                }}
                            >
                                {isVideoOff ? <VideoOff size={20} /> : <Video size={20} />}
                            </button>
                        </>
                    )}
                    {error && <div className="error-banner">{error}</div>}
                </div>
            </div>
        </div>
    );
}
