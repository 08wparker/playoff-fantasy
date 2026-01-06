import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { User } from '../types';
import { signInWithGoogle, signInWithEmail, signUpWithEmail, signOut, onAuthChange } from '../services/firebase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  signInGoogle: () => Promise<void>;
  signInEmail: (email: string, password: string) => Promise<boolean>;
  signUpEmail: (email: string, password: string, displayName: string) => Promise<boolean>;
  signOutUser: () => Promise<void>;
  clearError: () => void;
}

export const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function useAuthProvider(): AuthContextType {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthChange((user) => {
      setUser(user);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signInGoogle = useCallback(async () => {
    setLoading(true);
    setError(null);
    const user = await signInWithGoogle();
    setUser(user);
    setLoading(false);
  }, []);

  const signInEmail = useCallback(async (email: string, password: string): Promise<boolean> => {
    setLoading(true);
    setError(null);
    const result = await signInWithEmail(email, password);
    if (result.error) {
      setError(result.error);
      setLoading(false);
      return false;
    }
    setUser(result.user);
    setLoading(false);
    return true;
  }, []);

  const signUpEmail = useCallback(async (email: string, password: string, displayName: string): Promise<boolean> => {
    setLoading(true);
    setError(null);
    const result = await signUpWithEmail(email, password, displayName);
    if (result.error) {
      setError(result.error);
      setLoading(false);
      return false;
    }
    setUser(result.user);
    setLoading(false);
    return true;
  }, []);

  const signOutUser = useCallback(async () => {
    await signOut();
    setUser(null);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    user,
    loading,
    error,
    signInGoogle,
    signInEmail,
    signUpEmail,
    signOutUser,
    clearError,
  };
}
