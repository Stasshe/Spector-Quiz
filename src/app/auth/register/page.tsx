'use client';

import { useState, FormEvent } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { FaBolt, FaEnvelope, FaLock, FaUser, FaImage } from 'react-icons/fa';

// アバターアイコンの選択肢
const avatarOptions = [
  { id: 1, name: 'ユーザー1' },
  { id: 2, name: 'ユーザー2' },
  { id: 3, name: 'ユーザー3' },
  { id: 4, name: 'ユーザー4' },
  { id: 5, name: 'ユーザー5' },
];

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [iconId, setIconId] = useState(1);
  const { handleRegister, error, isLoading } = useAuth();

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    await handleRegister(email, password, username, iconId);
  };

  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-gray-50">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-lg shadow-md">
        <div className="text-center">
          <div className="flex justify-center">
            <FaBolt className="h-12 w-12 text-indigo-600" />
          </div>
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">Zap!</h2>
          <p className="mt-2 text-sm text-gray-600">新規アカウント登録</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
            {error}
          </div>
        )}

        <form className="mt-8 space-y-6" onSubmit={onSubmit}>
          <div className="rounded-md shadow-sm -space-y-px">
            <div className="mb-4">
              <label htmlFor="email" className="sr-only">
                メールアドレス
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <FaEnvelope className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="appearance-none relative block w-full px-3 py-2 pl-10 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                  placeholder="メールアドレス"
                />
              </div>
            </div>
            <div className="mb-4">
              <label htmlFor="username" className="sr-only">
                ユーザー名
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <FaUser className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="username"
                  name="username"
                  type="text"
                  autoComplete="username"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="appearance-none relative block w-full px-3 py-2 pl-10 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                  placeholder="ユーザー名（表示名）"
                />
              </div>
            </div>
            <div className="mb-4">
              <label htmlFor="password" className="sr-only">
                パスワード
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <FaLock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="appearance-none relative block w-full px-3 py-2 pl-10 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                  placeholder="パスワード"
                />
              </div>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">アイコンを選択</label>
              <div className="grid grid-cols-5 gap-2">
                {avatarOptions.map((avatar) => (
                  <div
                    key={avatar.id}
                    className={`flex items-center justify-center border rounded-md p-2 cursor-pointer ${
                      iconId === avatar.id ? 'border-indigo-500 bg-indigo-50' : 'border-gray-300'
                    }`}
                    onClick={() => setIconId(avatar.id)}
                  >
                    <div className="flex flex-col items-center">
                      <div className="bg-gray-200 rounded-full p-2 mb-1">
                        <FaUser className="h-6 w-6 text-gray-600" />
                      </div>
                      <span className="text-xs">{avatar.name}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? '登録中...' : 'アカウント登録'}
            </button>
          </div>

          <div className="text-sm text-center">
            <Link href="/auth/login" className="font-medium text-indigo-600 hover:text-indigo-500">
              すでにアカウントをお持ちの方はこちら
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
