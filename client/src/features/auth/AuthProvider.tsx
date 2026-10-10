import axios from 'axios';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { User } from '@resello/shared';
import { api } from '../../lib/api';
import { AuthContext, type AuthContextValue } from './AuthContext';

function isUnauthorized(error: unknown) {
  return axios.isAxiosError(error) && error.response?.status === 401;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const session = await api.get<{ user: User }>('/auth/me');
      setUser(session.data.user);
    } catch (sessionError) {
      if (!isUnauthorized(sessionError)) {
        setError('Resello could not connect to the server. Start the API and try again.');
        setLoading(false);
        return;
      }

      try {
        const refreshed = await api.post<{ user: User }>('/auth/refresh');
        setUser(refreshed.data.user);
      } catch (refreshError) {
        if (!isUnauthorized(refreshError)) {
          setError('Resello could not connect to the server. Start the API and try again.');
        }
        setUser(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      error,
      reload,
      updateUser(updates) {
        setUser((current) => (current ? { ...current, ...updates } : current));
      },
      async login(values) {
        const response = await api.post<{ user: User }>('/auth/login', values);
        setUser(response.data.user);
        return response.data.user;
      },
      async register(values) {
        await api.post('/auth/register', values);
      },
      async verify(values) {
        const response = await api.post<{ user: User }>('/auth/verify-email', values);
        setUser(response.data.user);
        return response.data.user;
      },
      async logout() {
        await api.post('/auth/logout');
        setUser(null);
      },
    }),
    [user, loading, error, reload],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
