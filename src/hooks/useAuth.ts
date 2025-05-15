'use client';

import { useState, useEffect } from 'react';
import { useAuth as useAuthContext } from '../context/AuthContext';
import { useRouter, usePathname } from 'next/navigation';

export function useAuth() {
  const { currentUser, userProfile, login, register, logout, loading, initialized } = useAuthContext();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  // 認証状態に基づいてリダイレクト処理を行う
  useEffect(() => {
    // 初期化が完了していない場合は何もしない
    if (!initialized) {
      console.log('Auth not initialized yet, skipping redirect check');
      return;
    }

    // パスを正規化（末尾のスラッシュを削除）
    const normalizedPath = pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
    
    // クイズルーム内ではリダイレクトチェックをスキップ（アクティブプレイ中の不要なリダイレクトを防止）
    if (normalizedPath.startsWith('/quiz/room')) {
      console.log('User is in quiz room, skipping auth redirect check');
      return;
    }
    
    const publicPaths = ['/', '/auth/login', '/auth/register'];
    // より寛容なチェック方法: パスが公開パスの一つで始まるか確認
    const isPublicPath = publicPaths.some(path => 
      normalizedPath === path || 
      (path !== '/' && normalizedPath.startsWith(path))
    );
    
    console.log('Auth redirect check:', { 
      currentUser: !!currentUser, 
      pathname, 
      normalizedPath,
      isPublicPath, 
      loading,
      initialized
    });
    
    // ログインページやレジスターページにいる場合で、すでにログインしている場合はquizページへリダイレクト
    if (currentUser && (normalizedPath === '/auth/login' || normalizedPath === '/auth/register')) {
      console.log(`User is authenticated, redirecting to /quiz from path: ${normalizedPath}`);
      router.replace('/quiz');
      return;
    }
    
    // パブリックパスの場合はリダイレクト不要
    if (isPublicPath) {
      console.log(`User is on a public path: ${normalizedPath}, no redirect needed`);
      return;
    }
    
    // 保護されたページにいる場合で、ログインしていない場合はログインページへリダイレクト
    // かつページ遷移が発生していない場合のみリダイレクトする（不要な遷移を防止）
    if (!currentUser && !loading) {
      console.log(`User is not authenticated, redirecting to /auth/login from path: ${normalizedPath}`);
      router.replace('/auth/login');
    }
  }, [currentUser, initialized, loading, pathname, router]);

  const handleLogin = async (userId: string, password: string) => {
    try {
      setIsLoading(true);
      setError(null);
      await login(userId, password);
      // ログイン後のリダイレクトはuseEffectで自動的に行われるため、ここでは不要
    } catch (err: any) {
      let errorMessage = 'ログイン中にエラーが発生しました。';
      
      // Firebase認証エラーの日本語対応
      if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-email') {
        errorMessage = 'ユーザーIDが見つかりません。';
      } else if (err.code === 'auth/wrong-password') {
        errorMessage = 'パスワードが正しくありません。';
      } else if (err.code === 'auth/too-many-requests') {
        errorMessage = 'ログイン試行回数が多すぎます。しばらく時間をおいてお試しください。';
      }
      
      setError(errorMessage);
      console.error('Login error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (password: string, username: string, iconId: number) => {
    try {
      setIsLoading(true);
      setError(null);
      // register関数を呼び出して、自動生成されたユーザーIDを取得
      const userId = await register(password, username, iconId);
      
      // 登録成功のメッセージ表示
      alert(`登録が完了しました！\nあなたのユーザーID: ${userId}\n\nこのIDはログインに必要です。必ずメモしておいてください。`);
      
      // 登録後のリダイレクトはuseEffectで自動的に行われるため、ここでは不要
    } catch (err: any) {
      let errorMessage = 'アカウント作成中にエラーが発生しました。';
      
      // Firebase認証エラーの日本語対応
      if (err.code === 'auth/email-already-in-use') {
        errorMessage = 'このユーザーIDは既に使用されています。';
      } else if (err.code === 'auth/invalid-email') {
        errorMessage = '無効なユーザーIDです。';
      } else if (err.code === 'auth/weak-password') {
        errorMessage = 'パスワードが弱すぎます。6文字以上の強力なパスワードをお使いください。';
      }
      
      setError(errorMessage);
      console.error('Registration error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      setIsLoading(true);
      await logout();
      // ログアウト後のリダイレクトはuseEffectで自動的に行われるため、ここでは不要
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
    initialized,
    handleLogin,
    handleRegister,
    handleLogout
  };
}
