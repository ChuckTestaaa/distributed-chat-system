import { useRef, useState, useEffect } from "react";
import { Video, Users, ChevronLeft, Send, X, UserPlus, PlusCircle, MoreVertical, Smile, Flame } from 'lucide-react';
import { useParams, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../hooks/useSocket";
import { roomsApi } from "../services/api";
import SearchUserModal from "../components/SearchUserModal";
import CallModal from "../components/CallModal";
import InviteModal from "../components/InviteModal";
import Avatar from "../components/Avatar";
import ProfileModal from "../components/ProfileModal";

export default function ChatRoom() {
  const { roomId } = useParams();
  const { user } = useAuth();
  const {
    joinRoom,
    leaveRoom,
    sendMessage,
    sendTyping,
    onNewMessage,
    onTyping,
    isConnected,
    addReaction,
    onReactionUpdate,
    revealSecret,
    onSecretRevealed,
    onMessageBurned,
  } = useSocket();

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isSecretMode, setIsSecretMode] = useState(false);
  const [revealingMessages, setRevealingMessages] = useState({}); // { messageId: countdown }
  const [loading, setLoading] = useState(true);
  const [typingUsers, setTypingUsers] = useState([]);
  const [showAddMember, setShowAddMember] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [roomMembers, setRoomMembers] = useState([]);
  const [roomType, setRoomType] = useState(null);
  const [roomName, setRoomName] = useState('');
  const [showUserProfile, setShowUserProfile] = useState(null);
  const [activeReactionId, setActiveReactionId] = useState(null);

  useEffect(() => {
    return onReactionUpdate((data) => {
        setMessages(prev => prev.map(m => 
            m.id === data.messageId ? { ...m, reactions: data.reactions } : m
        ));
    });
  }, [onReactionUpdate]);

  useEffect(() => {
    const unsubRevealed = onSecretRevealed(({ messageId }) => {
      console.log('Secret revealed event received for:', messageId);
      setRevealingMessages(prev => ({ ...prev, [messageId]: 10 }));
      
      const interval = setInterval(() => {
        setRevealingMessages(prev => {
          if (prev[messageId] === undefined) {
            clearInterval(interval);
            return prev;
          }
          if (prev[messageId] <= 0) {
            return { ...prev, [messageId]: 0 };
          }
          return { ...prev, [messageId]: prev[messageId] - 1 };
        });
      }, 1000);
    });

    const unsubBurned = onMessageBurned(({ messageId }) => {
      console.log('Message burned event received for:', messageId);
      setMessages(prev => prev.filter(m => m.id !== messageId));
      setRevealingMessages(prev => {
        const next = { ...prev };
        delete next[messageId];
        return next;
      });
    });

    return () => {
      unsubRevealed();
      unsubBurned();
    };
  }, [onSecretRevealed, onMessageBurned]);
  const [callState, setCallState] = useState({
    active: false,
    isInitiator: false,
    targetId: null,
  });
  const [showMembers, setShowMembers] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // Theme support
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.body.setAttribute('data-theme', savedTheme);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (activeReactionId && !e.target.closest('.reaction-picker') && !e.target.closest('.message')) {
        setActiveReactionId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [activeReactionId]);

  // Load initial messages and join room
  useEffect(() => {
    const init = async () => {
      try {
        const [msgsData, roomData] = await Promise.all([
          roomsApi.getMessages(roomId),
          roomsApi.get(roomId),
        ]);
        setMessages(msgsData.messages || []);
        setRoomMembers(roomData.members || []);
        setRoomType(roomData.type || null);

        if (roomData.type === 'PRIVATE') {
          const friend = (roomData.members || []).find(m => m.id !== user?.id);
          setRoomName(friend ? friend.username : roomData.name);
        } else {
          setRoomName(roomData.name || 'Chat Room');
        }
      } catch (err) {
        console.error("Failed to load data:", err);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [roomId]);

  // Join room when socket connects
  useEffect(() => {
    if (!isConnected) return;

    joinRoom(roomId);

    return () => {
      leaveRoom(roomId);
    };
  }, [roomId, joinRoom, leaveRoom, isConnected]);

  // Listen for new messages
  useEffect(() => {
    const unsubscribe = onNewMessage((message) => {
      console.log('onNewMessage trigger. message:', message, 'Current roomId:', roomId);
      if (message.roomId === roomId) {
        setMessages((prev) => {
          // Prevent duplicates
          if (prev.some(m => m.id === message.id)) return prev;
          return [...prev, message];
        });
      }
    });

    return unsubscribe;
  }, [roomId, onNewMessage]);

  // Listen for typing indicators
  useEffect(() => {
    const unsubscribe = onTyping(
      ({ userId, username, roomId: msgRoomId, isTyping }) => {
        if (msgRoomId === roomId && userId !== user?.id) {
          setTypingUsers((prev) => {
            if (isTyping) {
              // Add user if not already in list
              const exists = prev.some((u) => u.userId === userId);
              if (!exists) {
                return [...prev, { userId, username }];
              }
              return prev;
            } else {
              // Remove user
              return prev.filter((u) => u.userId !== userId);
            }
          });
        }
      },
    );

    return unsubscribe;
  }, [roomId, user?.id, onTyping]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleStartCall = () => {
    // Find other members
    const otherMembers = roomMembers.filter((m) => m.id !== user.id);

    if (otherMembers.length === 0) {
      alert("No one else in this room to call!");
      return;
    }

    // For MVP, just call the first other member
    // In reality, should show a picker if > 1
    const target = otherMembers[0];
    setCallState({
      active: true,
      isInitiator: true,
      targetId: target.id,
    });
  };

  const handleSend = (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    sendMessage(roomId, input.trim(), isSecretMode ? 'SECRET' : 'TEXT');
    setInput("");
    setIsSecretMode(false);
    sendTyping(roomId, false);
  };

  const handleTyping = (e) => {
    setInput(e.target.value);

    // Send typing indicator
    sendTyping(roomId, true);

    // Clear previous timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Stop typing after 2 seconds of inactivity
    typingTimeoutRef.current = setTimeout(() => {
      sendTyping(roomId, false);
    }, 2000);
  };

  return (
    <div style={{ display: 'flex', width: '100%', height: '100%', overflow: 'hidden' }}>
      <div className="chat-container" style={{ flex: 1, minWidth: 0, width: 'auto', borderRight: showUserProfile ? '1px solid var(--border)' : 'none' }}>
        <header className="chat-header">
          <div className="chat-header-left">
            <Link to="/" className="back-btn">
              <ChevronLeft size={20} />
            </Link>
            <h2 className="chat-title">{roomName || 'Chat Room'}</h2>
          </div>
          <div className="chat-header-right">
            <button
              className="btn-ghost btn-header"
              onClick={handleStartCall}
              title="Video Call"
            >
              <span className="btn-icon"><Video size={18} /></span>
              <span className="btn-label">Video Call</span>
            </button>

            <div style={{ position: 'relative' }}>
              <button
                className="btn-ghost btn-header"
                onClick={() => setShowMoreMenu(!showMoreMenu)}
                title="More options"
              >
                <MoreVertical size={20} />
              </button>

              {showMoreMenu && (
                <div 
                  className="dropdown-menu"
                  style={{
                    position: 'absolute',
                    top: '100%',
                    right: 0,
                    marginTop: '8px',
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                    zIndex: 1000,
                    minWidth: '180px',
                    overflow: 'hidden'
                  }}
                >
                  {roomType === 'GROUP' && (
                    <>
                      <button
                        className="menu-item"
                        onClick={() => { setShowInvite(true); setShowMoreMenu(false); }}
                        style={{ width: '100%', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '10px', background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', textAlign: 'left' }}
                      >
                        <UserPlus size={16} /> Invite Link
                      </button>
                      <button
                        className="menu-item"
                        onClick={() => { setShowAddMember(true); setShowMoreMenu(false); }}
                        style={{ width: '100%', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '10px', background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', textAlign: 'left' }}
                      >
                        <PlusCircle size={16} /> Add Member
                      </button>
                    </>
                  )}
                  <button
                    className="menu-item"
                    onClick={() => {
                      if (roomType === 'PRIVATE') {
                        const friend = roomMembers.find(m => m.id !== user?.id);
                        setShowUserProfile(friend?.id);
                      } else {
                        setShowMembers(true);
                      }
                      setShowMoreMenu(false);
                    }}
                    style={{ width: '100%', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '10px', background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', textAlign: 'left' }}
                  >
                    <Users size={16} /> {roomType === 'PRIVATE' ? 'View Profile' : 'View Members'}
                  </button>
                </div>
              )}
            </div>

            <span
              className={`connection-status ${isConnected ? "online" : "offline"}`}
            >
              {isConnected ? "●" : "○"}
            </span>
          </div>
        </header>

        <div className="messages-container">
          {loading ? (
            <div className="loading">Loading messages...</div>
          ) : messages.length === 0 ? (
            <div className="empty-state">
              <p>No messages yet</p>
              <p>Be the first to send one!</p>
            </div>
          ) : (
            messages.map((msg, i) => {
              const prev = messages[i - 1];
              const msgDate = new Date(msg.createdAt);
              const prevDate = prev ? new Date(prev.createdAt) : null;

              const showDateSep = !prevDate ||
                msgDate.toDateString() !== prevDate.toDateString();

              const sameSender = prev && prev.sender?.id === msg.sender?.id;
              const withinWindow = prevDate && (msgDate - prevDate < 120000);
              const isGrouped = sameSender && withinWindow && !showDateSep;
              const isOwn = msg.sender?.id === user?.id;

              let dateLabel = '';
              if (showDateSep) {
                const today = new Date();
                const yesterday = new Date();
                yesterday.setDate(today.getDate() - 1);
                if (msgDate.toDateString() === today.toDateString()) {
                  dateLabel = 'Today';
                } else if (msgDate.toDateString() === yesterday.toDateString()) {
                  dateLabel = 'Yesterday';
                } else {
                  dateLabel = msgDate.toLocaleDateString(undefined, {
                    weekday: 'short', month: 'short', day: 'numeric',
                  });
                }
              }

              return (
                <div key={msg.id}>
                  {showDateSep && (
                    <div className="date-separator">
                      <span>{dateLabel}</span>
                    </div>
                  )}
                  <div className={`message-row ${isOwn ? "own" : ""}`}>
                    {!isOwn && !isGrouped && (
                      <div onClick={() => setShowUserProfile(msg.sender?.id)} style={{ cursor: 'pointer' }}>
                          <Avatar username={msg.sender?.username} size={30} />
                      </div>
                    )}
                    {!isOwn && isGrouped && <div className="avatar-spacer" />}
                    <div className={`message-container-outer ${isOwn ? "own" : ""}`} style={{ display: 'flex', flexDirection: 'column', alignItems: isOwn ? 'flex-end' : 'flex-start', maxWidth: '75%' }}>
                      <div 
                        className={`message ${isOwn ? "own" : ""} ${isGrouped ? "grouped" : ""}`}
                        onMouseDown={() => {
                          const timer = setTimeout(() => setActiveReactionId(msg.id), 500);
                          window.addEventListener('mouseup', () => clearTimeout(timer), { once: true });
                        }}
                        onTouchStart={() => {
                          const timer = setTimeout(() => setActiveReactionId(msg.id), 500);
                          window.addEventListener('touchend', () => clearTimeout(timer), { once: true });
                        }}
                        style={{ position: 'relative', cursor: 'pointer' }}
                      >
                        {!isGrouped && (
                          <div className="message-header">
                            <span className="sender">{msg.sender?.username}</span>
                            <span className="time">
                              {msgDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        )}
                        <div className={`message-content ${msg.type === 'SECRET' && !revealingMessages[msg.id] ? 'secret-blurred' : ''}`}>
                          {msg.type === 'SECRET' && !revealingMessages[msg.id] ? (
                            <div 
                              onClick={() => revealSecret(roomId, msg.id)} 
                              style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontStyle: 'italic', opacity: 0.8 }}
                            >
                              <PlusCircle size={14} /> Click to reveal Pulse message
                            </div>
                          ) : (
                            <>
                              {msg.content}
                              {revealingMessages[msg.id] && (
                                <div style={{ fontSize: '10px', marginTop: '4px', opacity: 0.6, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <div className="burn-timer-dot" style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--error)', animation: 'pulse 1s infinite' }} />
                                  Burning in {revealingMessages[msg.id]}s...
                                </div>
                              )}
                            </>
                          )}
                          
                          <button 
                              className="reaction-trigger"
                              onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveReactionId(activeReactionId === msg.id ? null : msg.id);
                              }}
                              style={{ 
                                  position: 'absolute', 
                                  right: isOwn ? 'auto' : '-30px', 
                                  left: isOwn ? '-30px' : 'auto',
                                  top: '50%', 
                                  transform: 'translateY(-50%)',
                                  opacity: 0,
                                  background: 'none',
                                  border: 'none',
                                  cursor: 'pointer',
                                  color: 'var(--text-secondary)'
                              }}
                          >
                              <Smile size={16} />
                          </button>

                          {activeReactionId === msg.id && (
                              <div className="reaction-picker" style={{ position: 'absolute', top: '-45px', right: isOwn ? 0 : 'auto', left: isOwn ? 'auto' : 0, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '20px', padding: '5px 10px', display: 'flex', gap: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.2)', zIndex: 100 }}>
                                  {['👍', '❤️', '😂', '😮', '😢', '🔥'].map(emoji => (
                                      <span 
                                          key={emoji} 
                                          onClick={(e) => {
                                              e.stopPropagation();
                                              addReaction(roomId, msg.id, emoji);
                                              setActiveReactionId(null);
                                          }}
                                          style={{ cursor: 'pointer', fontSize: '18px' }}
                                      >
                                          {emoji}
                                      </span>
                                  ))}
                              </div>
                          )}
                        </div>
                      </div>

                      {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                        <div className="message-reactions" style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px', paddingLeft: isOwn ? '0' : '4px', paddingRight: isOwn ? '4px' : '0' }}>
                            {Object.entries(msg.reactions).map(([emoji, users]) => (
                                <div 
                                    key={emoji} 
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        addReaction(roomId, msg.id, emoji);
                                    }}
                                    className={`reaction-badge ${users.includes(user?.id) ? 'active' : ''}`}
                                    style={{ 
                                        background: users.includes(user?.id) ? 'rgba(129, 140, 248, 0.2)' : 'var(--bg-hover)',
                                        border: `1px solid ${users.includes(user?.id) ? 'var(--primary)' : 'var(--border)'}`,
                                        borderRadius: '12px',
                                        padding: '2px 6px',
                                        fontSize: '11px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        cursor: 'pointer',
                                        userSelect: 'none'
                                    }}
                                >
                                    <span>{emoji}</span>
                                    <span style={{ color: users.includes(user?.id) ? 'var(--primary)' : 'var(--text-secondary)' }}>{users.length}</span>
                                </div>
                            ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {typingUsers.length > 0 && (
          <div className="typing-indicator">
            {typingUsers.length === 1
              ? `${typingUsers[0].username} is typing...`
              : typingUsers.length === 2
                ? `${typingUsers[0].username} and ${typingUsers[1].username} are typing...`
                : `${typingUsers.length} people are typing...`}
          </div>
        )}

        <form onSubmit={handleSend} className="message-form">
          <button 
            type="button" 
            onClick={() => setIsSecretMode(!isSecretMode)}
            className="btn-pulse"
            style={{ 
              background: 'none', 
              border: 'none', 
              padding: '8px', 
              cursor: 'pointer',
              color: isSecretMode ? '#ef4444' : 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s',
              marginRight: '8px',
              minWidth: '40px'
            }}
            title="Toggle Pulse Mode (Burn-After-Reading)"
          >
            <Flame size={20} fill={isSecretMode ? '#ef4444' : 'none'} />
          </button>
          <input
            type="text"
            value={input}
            onChange={handleTyping}
            placeholder="Type a message..."
            disabled={!isConnected}
          />
          <button type="submit" disabled={!isConnected || !input.trim()} className="btn-primary" style={{ width: 'auto', padding: '10px 20px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Send size={18} />
          </button>
        </form>

        {showInvite && (
          <InviteModal roomId={roomId} onClose={() => setShowInvite(false)} />
        )}

        {showAddMember && (
          <SearchUserModal
            roomId={roomId}
            onClose={() => setShowAddMember(false)}
            onMemberAdded={(userId) => {
              console.log("Member added:", userId);
              // Refresh room members
              roomsApi
                .get(roomId)
                .then((data) => setRoomMembers(data.members || []));
            }}
          />
        )}

        {callState.active && (
          <CallModal
            isInitiator={callState.isInitiator}
            targetUserId={callState.targetId}
            onEndCall={() =>
              setCallState({
                active: false,
                isInitiator: false,
                targetId: null,
              })
            }
          />
        )}
      </div>

      {showMembers && roomType === 'GROUP' && (
        <div className="profile-sidebar" style={{ width: '300px', flexShrink: 0, height: '100%', background: 'var(--bg-card)', borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: '16px' }}>Members ({roomMembers.length})</h3>
            <button className="btn-ghost" onClick={() => setShowMembers(false)} style={{ padding: '4px' }}>
              <X size={20} />
            </button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '10px' }}>
            {roomMembers.map(member => (
              <div 
                key={member.id} 
                className="friend-item friend-item-clickable" 
                onClick={() => setShowUserProfile(member.id)}
                style={{ marginBottom: '8px' }}
              >
                <Avatar username={member.username} size={32} />
                <span style={{ marginLeft: '10px' }}>{member.username}</span>
                {member.id === user?.id && <small style={{ marginLeft: 'auto', color: 'var(--text-secondary)' }}>(You)</small>}
              </div>
            ))}
          </div>
        </div>
      )}

      {showUserProfile && (
        <div className="profile-sidebar" style={{ width: '320px', flexShrink: 0, height: '100%', background: 'var(--bg-card)', borderLeft: '1px solid var(--border)', position: 'relative' }}>
          <button 
            className="btn-ghost" 
            onClick={() => setShowUserProfile(null)}
            style={{ position: 'absolute', top: '15px', right: '15px', zIndex: 10, padding: '4px' }}
          >
            <X size={20} />
          </button>
          <ProfileModal 
            targetUserId={showUserProfile} 
            onClose={() => setShowUserProfile(null)} 
            inline={true}
          />
        </div>
      )}
    </div>
  );
}
