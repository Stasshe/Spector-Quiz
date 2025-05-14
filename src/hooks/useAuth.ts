'use client';

import { useState } from 'react';
import { useAuth as useAuthContext } from '../context/AuthContext';
import { useRouter } from 'next/navigation';

export function useAuth() {
  const { currentUser, userProfile, login, register, logout, loading } = useAuthContext();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (email: string, password: string) => {
    try {
      setIsLoading(true);
      setError(null);
      await login(email, password);
      router.push('/quiz');
    } catch (err: any) {
      setError(err.message || 'ログイン中にエラーが発生しました。');
      console.error('Login error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (email: string, password: string, username: string, iconId: number) => {
    try {
      setIsLoading(true);
      setError(null);
      await register(email, password, username, iconId);
      router.push('/quiz');
    } catch (err: any) {
      setError(err.message || 'アカウント作成中にエラーが発生しました。');
      console.error('Registration error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      setIsLoading(true);
      await logout();
      router.push('/');
    } catch (err: any) {
      setError(err.message || 'ログアウト中にエラーが発生しました。');
      console.error('Logout error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return {
    currentUser,
    userProfile,
    error,
    isLoading: isLoading || loading,
    handleLogin,
    handleRegister,
    handleLogout
  };
}
