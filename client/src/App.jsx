import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import Login from './pages/Login';
import Register from './pages/Register';
import RoomList from './pages/RoomList';
import ChatRoom from './pages/ChatRoom';
import JoinRoom from './pages/JoinRoom';
import GlobalCallHandler from './components/GlobalCallHandler';
import './App.css';

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="loading-screen">Loading...</div>;
  }

  return user ? children : <Navigate to="/login" />;
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="loading-screen">Loading...</div>;
  }

  return user ? <Navigate to="/" /> : children;
}

import ChatLayout from './components/ChatLayout';
import EmptyChat from './components/EmptyChat';

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={
        <PublicRoute><Login /></PublicRoute>
      } />
      <Route path="/register" element={
        <PublicRoute><Register /></PublicRoute>
      } />
      <Route path="/" element={
        <PrivateRoute><ChatLayout /></PrivateRoute>
      }>
        <Route index element={<EmptyChat />} />
        <Route path="chat/:roomId" element={<ChatRoom />} />
      </Route>
      <Route path="/join/:code" element={<JoinRoom />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <SocketProvider>
          <AppRoutes />
          <GlobalCallHandler />
        </SocketProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
