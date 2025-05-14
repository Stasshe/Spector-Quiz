'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FaBolt, FaBars, FaTimes, FaUser, FaSignOutAlt, FaTrophy } from 'react-icons/fa';
import { useAuth } from '@/hooks/useAuth';

export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { currentUser, userProfile, handleLogout } = useAuth();
  const pathname = usePathname();

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const closeMenu = () => {
    setIsMenuOpen(false);
  };

  const navigation = [
    { name: 'ホーム', href: '/' },
    { name: 'クイズ', href: '/quiz' },
    { name: 'ランキング', href: '/ranking' },
  ];

  return (
    <header className="sticky top-0 z-50">
      <div className="app-container">
        <div className="navbar">
          <Link href="/" className="flex items-center space-x-2 text-xl font-bold">
            <div className="bg-indigo-600 text-white p-2 rounded-lg transform rotate-12">
              <FaBolt className="text-yellow-300" />
            </div>
            <span className="bg-gradient-to-r from-indigo-600 to-indigo-500 text-transparent bg-clip-text">Zap!</span>
          </Link>

          {/* デスクトップナビゲーション */}
          <nav className="hidden md:flex space-x-8">
            {navigation.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className={`nav-link ${
                  pathname === item.href ? 'nav-link-active' : ''
                }`}
              >
                {item.name}
              </Link>
            ))}
          </nav>

          {/* ユーザーメニュー */}
          <div className="hidden md:flex items-center space-x-4">
            {currentUser ? (
              <>
                <div className="flex items-center space-x-3 bg-gray-50 rounded-xl px-3 py-2 shadow-sm">
                  <div className="avatar w-8 h-8 bg-indigo-100 flex items-center justify-center">
                    <FaUser className="text-indigo-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-800">{userProfile?.username}</p>
                    <div className="flex items-center space-x-1">
                      <FaTrophy className="text-yellow-500 text-xs" />
                      <p className="text-xs text-gray-500">Lv. {Math.floor((userProfile?.exp || 0) / 100) + 1}</p>
                    </div>
                  </div>
                  <div className="flex space-x-2 pl-2 border-l border-gray-200">
                    <Link href={`/profile/user?id=${currentUser.uid}`} className="hover:text-indigo-600 p-1">
                      <FaUser />
                    </Link>
                    <button onClick={handleLogout} className="hover:text-red-600 p-1">
                      <FaSignOutAlt />
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <Link
                href="/auth/login"
                className="btn-primary"
              >
                ログイン
              </Link>
            )}
          </div>

          {/* モバイルメニューボタン */}
          <button className="md:hidden p-2 rounded-lg bg-indigo-100 text-indigo-600 shadow-sm" onClick={toggleMenu}>
            {isMenuOpen ? <FaTimes /> : <FaBars />}
          </button>
        </div>
      </div>

      {/* モバイルナビゲーション */}
      {isMenuOpen && (
        <div className="md:hidden fixed inset-0 bg-white bg-opacity-95 z-50 animate-fadeIn">
          <div className="app-container pt-4">
            <div className="flex justify-between items-center mb-6">
              <Link href="/" className="flex items-center space-x-2 text-xl font-bold" onClick={closeMenu}>
                <div className="bg-indigo-600 text-white p-2 rounded-lg transform rotate-12">
                  <FaBolt className="text-yellow-300" />
                </div>
                <span className="bg-gradient-to-r from-indigo-600 to-indigo-500 text-transparent bg-clip-text">Zap!</span>
              </Link>
              <button className="p-2 rounded-lg bg-gray-100 text-gray-600" onClick={closeMenu}>
                <FaTimes />
              </button>
            </div>
            
            <nav className="flex flex-col space-y-6 py-8">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`text-xl ${
                    pathname === item.href 
                      ? 'text-indigo-600 font-bold' 
                      : 'text-gray-700 hover:text-indigo-600'
                  }`}
                  onClick={closeMenu}
                >
                  {item.name}
                </Link>
              ))}
              
              {currentUser ? (
                <div className="space-y-6 pt-4 border-t border-gray-100">
                  <div className="flex items-center space-x-3">
                    <div className="avatar w-10 h-10 bg-indigo-100 flex items-center justify-center">
                      <FaUser className="text-indigo-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-800">{userProfile?.username}</p>
                      <div className="flex items-center space-x-1">
                        <FaTrophy className="text-yellow-500 text-xs" />
                        <p className="text-xs text-gray-500">Lv. {Math.floor((userProfile?.exp || 0) / 100) + 1}</p>
                      </div>
                    </div>
                  </div>
                
                  <Link
                    href={`/profile/user?id=${currentUser.uid}`}
                    className="flex items-center space-x-3 text-gray-700 hover:text-indigo-600"
                    onClick={closeMenu}
                  >
                    <FaUser />
                    <span>プロフィール</span>
                  </Link>
                  <button
                    onClick={() => {
                      handleLogout();
                      closeMenu();
                    }}
                    className="flex items-center space-x-3 text-gray-700 hover:text-red-600 text-left w-full"
                  >
                    <FaSignOutAlt />
                    <span>ログアウト</span>
                  </button>
                </div>
              ) : (
                <Link
                  href="/auth/login"
                  className="btn-primary w-full flex items-center justify-center mt-4"
                  onClick={closeMenu}
                >
                  ログイン
                </Link>
              )}
            </nav>
          </div>
        </div>
      )}
    </header>
  );
}
