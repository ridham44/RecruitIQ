import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, setToken, getToken } from '../services/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadMe = useCallback(async () => {
    if (!getToken()) {
      setLoading(false);
      return;
    }
    try {
      const { user } = await api.get('/auth/me');
      setUser(user);
    } catch {
      setToken(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMe();
  }, [loadMe]);

  const login = async (email, password) => {
    const { user, token } = await api.post('/auth/login', { email, password });
    setToken(token);
    setUser(user);
    return user;
  };

  const registerCompany = async (payload) => {
    const { user, token } = await api.post('/auth/register/company', payload);
    setToken(token);
    setUser(user);
    return user;
  };

  const registerCandidate = async (payload) => {
    const { user, token } = await api.post('/auth/register/candidate', payload);
    setToken(token);
    setUser(user);
    return user;
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      setToken(null);
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, setUser, loading, login, registerCompany, registerCandidate, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
