export default function EmptyChat() {
  return (
    <div className="empty-state" style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.5 }}>💬</div>
      <h2 style={{ fontSize: '24px', marginBottom: '8px', color: 'var(--text-primary)' }}>Welcome to Distributed Chat</h2>
      <p style={{ color: 'var(--text-secondary)' }}>Select a conversation from the sidebar to start messaging</p>
    </div>
  );
}
