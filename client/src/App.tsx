import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import Landing from './pages/Landing';
import Dashboard from './pages/Dashboard';
import GameEditor from './pages/GameEditor';
import GameSession from './pages/GameSession';
import JoinGame from './pages/JoinGame';
import Profile from './pages/Profile';
import Unauthorized from './pages/Unauthorized';
import { CircularProgress, Box } from '@mui/material';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { teacher, loading } = useAuth();
  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
        <CircularProgress />
      </Box>
    );
  }
  if (!teacher) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <SocketProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/unauthorized" element={<Unauthorized />} />
          <Route path="/join/:joinCode" element={<JoinGame />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/games/new"
            element={
              <ProtectedRoute>
                <GameEditor />
              </ProtectedRoute>
            }
          />
          <Route
            path="/games/:id/edit"
            element={
              <ProtectedRoute>
                <GameEditor />
              </ProtectedRoute>
            }
          />
          <Route
            path="/games/:id/session"
            element={
              <ProtectedRoute>
                <GameSession />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </SocketProvider>
  );
}
