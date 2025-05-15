'use client';

import { useState, FormEvent, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { FaBolt, FaUser, FaLock, FaSignInAlt, FaUserPlus } from 'react-icons/fa';

export default function LoginPage() {
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const { handleLogin, error, isLoading, initialized, currentUser } = useAuth();

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    await handleLogin(userId, password);
  };

  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-gradient-to-r from-indigo-50 to-purple-50">
      <div className="max-w-md w-full space-y-8 bg-white rounded-xl shadow-lg p-8 relative overflow-hidden">
        {/* デコレーション要素 */}
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-full opacity-10"></div>
        <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-gradient-to-tr from-indigo-400 to-purple-500 rounded-full opacity-10"></div>
        
        <div className="text-center relative z-10">
          <div className="inline-flex justify-center items-center w-20 h-20 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 shadow-md mb-2">
            <FaBolt className="h-10 w-10 text-white" />
          </div>
          <h2 className="mt-2 text-3xl font-extrabold bg-gradient-to-r from-indigo-600 to-purple-600 text-transparent bg-clip-text">Zap!</h2>
          <p className="mt-2 text-lg text-gray-600">クイズに答えて、ランキングをアップしよう！</p>
        </div>

        {!initialized && (
          <div className="relative z-10 bg-blue-50 border-l-4 border-blue-500 text-blue-700 p-4 rounded-lg animate-pulse">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-blue-500" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm">認証状態を確認中です...</p>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="relative z-10 bg-red-50 border-l-4 border-red-500 text-red-700 p-4 rounded-lg animate-fadeIn">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm">{error}</p>
              </div>
            </div>
          </div>
        )}

        <form className="mt-8 space-y-6 relative z-10" onSubmit={onSubmit}>
          <div className="rounded-md shadow-sm space-y-4">
            <div>
              <label htmlFor="userId" className="block text-sm font-medium text-gray-700 mb-1">
                ユーザーID
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <FaUser className="h-5 w-5 text-indigo-400" />
                </div>
                <input
                  id="userId"
                  name="userId"
                  type="text"
                  autoComplete="username"
                  required
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  className="form-input pl-10"
                  placeholder="ユーザーIDを入力"
                />
              </div>
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                パスワード
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <FaLock className="h-5 w-5 text-indigo-400" />
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="form-input pl-10"
                  placeholder="パスワードを入力"
                />
              </div>
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={isLoading || !initialized}
              className="btn-primary w-full flex items-center justify-center group"
            >
              <FaSignInAlt className="mr-2 group-hover:animate-bounce" />
              {isLoading ? 'ログイン中...' : '次へ'}
            </button>
          </div>

          <div className="text-center">
            <Link 
              href="/auth/register" 
              className="inline-flex items-center font-medium text-indigo-600 hover:text-indigo-500 hover:underline transition-colors duration-200"
            >
              <FaUserPlus className="mr-1 h-4 w-4" />
              アカウントをお持ちでない方はこちら
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
