import { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { roomsApi } from '../services/api';

export default function InviteModal({ roomId, onClose }) {
    const [inviteUrl, setInviteUrl] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        const generate = async () => {
            try {
                const data = await roomsApi.createInvite(roomId);
                const url = `${window.location.origin}/join/${data.code}`;
                setInviteUrl(url);
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };
        generate();
    }, [roomId]);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(inviteUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            const input = document.createElement('input');
            input.value = inviteUrl;
            document.body.appendChild(input);
            input.select();
            document.execCommand('copy');
            document.body.removeChild(input);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="invite-modal" onClick={e => e.stopPropagation()}>
                <div className="invite-modal-header">
                    <h3>Invite to Room</h3>
                    <button className="modal-close-btn" onClick={onClose}>&times;</button>
                </div>

                <div className="invite-modal-body">
                    {loading && <div className="invite-loading">Generating invite link...</div>}

                    {error && <div className="invite-error">{error}</div>}

                    {inviteUrl && (
                        <>
                            <div className="invite-qr-container">
                                <QRCodeSVG
                                    value={inviteUrl}
                                    size={200}
                                    level="M"
                                    includeMargin
                                />
                            </div>

                            <p className="invite-instruction">
                                Scan this QR code or share the link below
                            </p>

                            <div className="invite-link-row">
                                <input
                                    type="text"
                                    readOnly
                                    value={inviteUrl}
                                    className="invite-link-input"
                                />
                                <button className="invite-copy-btn" onClick={handleCopy}>
                                    {copied ? 'Copied!' : 'Copy'}
                                </button>
                            </div>

                            <p className="invite-expiry">Link expires in 15 minutes</p>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
