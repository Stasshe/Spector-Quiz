'use client';

import { useState, FormEvent } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { FaBolt, FaEnvelope, FaLock, FaUser, FaImage, FaArrowLeft, FaUserPlus } from 'react-icons/fa';

// アバターアイコン選択肢のサンプル
const avatarOptions = [
  { id: 1, name: 'ユーザー1', icon: '👨' },
  { id: 2, name: 'ユーザー2', icon: '👩' },
  { id: 3, name: 'ユーザー3', icon: '🧑' },
  { id: 4, name: 'ユーザー4', icon: '👧' },
  { id: 5, name: 'ユーザー5', icon: '👦' },
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
          <p className="mt-2 text-lg text-gray-600">新規アカウント登録</p>
        </div>

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

        <form className="mt-6 space-y-6 relative z-10" onSubmit={onSubmit}>
          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                メールアドレス
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <FaEnvelope className="h-5 w-5 text-indigo-400" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="form-input pl-10"
                  placeholder="メールアドレスを入力"
                />
              </div>
            </div>
            
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
                ユーザー名
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <FaUser className="h-5 w-5 text-indigo-400" />
                </div>
                <input
                  id="username"
                  name="username"
                  type="text"
                  autoComplete="username"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="form-input pl-10"
                  placeholder="ユーザー名（表示名）"
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
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="form-input pl-10"
                  placeholder="安全なパスワードを設定"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                プロフィールアイコン
              </label>
              <div className="grid grid-cols-5 gap-3">
                {avatarOptions.map((avatar) => (
                  <div
                    key={avatar.id}
                    className={`transition-all duration-200 flex flex-col items-center p-2 rounded-xl cursor-pointer ${
                      iconId === avatar.id 
                        ? 'bg-gradient-to-br from-indigo-50 to-purple-50 border-2 border-indigo-300 shadow-md transform scale-105' 
                        : 'border-2 border-gray-100 hover:border-indigo-200 hover:bg-indigo-50'
                    }`}
                    onClick={() => setIconId(avatar.id)}
                  >
                    <div className="flex justify-center items-center w-10 h-10 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-full text-white mb-1 text-xl">
                      {avatar.icon}
                    </div>
                    <span className="text-xs font-medium">{avatar.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary w-full flex items-center justify-center group"
            >
              <FaUserPlus className="mr-2 group-hover:animate-bounce" />
              {isLoading ? '登録中...' : 'アカウント登録'}
            </button>
          </div>

          <div className="text-center">
            <Link 
              href="/auth/login" 
              className="inline-flex items-center font-medium text-indigo-600 hover:text-indigo-500 hover:underline transition-colors duration-200"
            >
              <FaArrowLeft className="mr-1 h-4 w-4" />
              すでにアカウントをお持ちの方はこちら
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
