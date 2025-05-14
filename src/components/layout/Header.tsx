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
    <header className="bg-indigo-600 text-white">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center py-4">
          <Link href="/" className="flex items-center space-x-2 text-xl font-bold">
            <FaBolt className="text-yellow-300" />
            <span>Zap!</span>
          </Link>

          {/* デスクトップナビゲーション */}
          <nav className="hidden md:flex space-x-6">
            {navigation.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className={`hover:text-yellow-300 transition ${
                  pathname === item.href ? 'text-yellow-300 font-medium' : ''
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
                <div className="flex items-center space-x-2">
                  <div className="bg-indigo-700 rounded-full p-2">
                    <FaUser className="text-yellow-300" />
                  </div>
                  <div>
                    <p className="font-medium">{userProfile?.username}</p>
                    <p className="text-xs text-indigo-200">Lv. {Math.floor((userProfile?.exp || 0) / 100) + 1}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <Link href={`/profile/${currentUser.uid}`} className="hover:text-yellow-300">
                    <FaUser />
                  </Link>
                  <button onClick={handleLogout} className="hover:text-yellow-300">
                    <FaSignOutAlt />
                  </button>
                </div>
              </>
            ) : (
              <Link
                href="/auth/login"
                className="bg-yellow-400 text-indigo-800 px-4 py-2 rounded-md font-medium hover:bg-yellow-300 transition"
              >
                ログイン
              </Link>
            )}
          </div>

          {/* モバイルメニューボタン */}
          <button className="md:hidden text-2xl" onClick={toggleMenu}>
            {isMenuOpen ? <FaTimes /> : <FaBars />}
          </button>
        </div>
      </div>

      {/* モバイルナビゲーション */}
      {isMenuOpen && (
        <div className="md:hidden bg-indigo-700 py-4">
          <div className="container mx-auto px-4">
            <nav className="flex flex-col space-y-4">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`hover:text-yellow-300 transition ${
                    pathname === item.href ? 'text-yellow-300 font-medium' : ''
                  }`}
                  onClick={closeMenu}
                >
                  {item.name}
                </Link>
              ))}
              {currentUser ? (
                <>
                  <Link
                    href={`/profile/${currentUser.uid}`}
                    className="hover:text-yellow-300 flex items-center space-x-2"
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
                    className="hover:text-yellow-300 flex items-center space-x-2 text-left"
                  >
                    <FaSignOutAlt />
                    <span>ログアウト</span>
                  </button>
                </>
              ) : (
                <Link
                  href="/auth/login"
                  className="bg-yellow-400 text-indigo-800 px-4 py-2 rounded-md font-medium hover:bg-yellow-300 transition text-center"
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
