import React, { createContext, useContext, useEffect, useState } from 'react';
import { authApi, Teacher } from '../services/api';

interface AuthContextValue {
  teacher: Teacher | null;
  loading: boolean;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshAuth = async () => {
    try {
      const data = await authApi.getMe();
      setTeacher(data);
    } catch {
      setTeacher(null);
    }
  };

  useEffect(() => {
    refreshAuth().finally(() => setLoading(false));
  }, []);

  const logout = async () => {
    await authApi.logout();
    setTeacher(null);
  };

  return (
    <AuthContext.Provider value={{ teacher, loading, logout, refreshAuth }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
