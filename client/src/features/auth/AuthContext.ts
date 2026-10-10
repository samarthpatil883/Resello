import { createContext, useContext } from 'react';
import type { LoginRequest, RegisterRequest, User, VerifyEmailRequest } from '@resello/shared';

export interface AuthContextValue {
  user: User | null;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  updateUser: (updates: Partial<User>) => void;
  login: (values: LoginRequest) => Promise<User>;
  register: (values: RegisterRequest) => Promise<void>;
  verify: (values: VerifyEmailRequest) => Promise<User>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider.');
  return context;
}
