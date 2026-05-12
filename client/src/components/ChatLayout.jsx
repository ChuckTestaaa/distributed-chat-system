import { Outlet, useLocation } from 'react-router-dom';
import RoomList from '../pages/RoomList';

export default function ChatLayout() {
  const location = useLocation();
  const isChatting = location.pathname.startsWith('/chat/');

  return (
    <div className={`app-shell ${isChatting ? 'is-chatting' : ''}`}>
      <div className="sidebar">
        <RoomList />
      </div>
      <div className="main-content">
        <Outlet />
      </div>
    </div>
  );
}
