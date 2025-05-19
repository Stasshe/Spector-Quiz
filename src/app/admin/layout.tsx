'use client';

import { ReactNode, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { currentUser, userProfile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // 認証とデータロードが完了したときに実行
    if (!loading) {
      if (!currentUser || !userProfile) {
        // ログインしていない場合はログインページへリダイレクト
        router.push('/auth/login');
      } else if (userProfile.userId !== '100000') {
        // 管理者IDでない場合はホームページへリダイレクト
        alert('管理者権限が必要です');
        router.push('/');
      }
    }
  }, [currentUser, userProfile, loading, router]);

  // ローディング中またはログインしていない場合はローディング表示
  if (loading || !currentUser || !userProfile) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-xl font-semibold text-gray-600">読み込み中...</p>
        </div>
      </div>
    );
  }

  // 管理者ID（100000）でない場合は何も表示しない
  if (userProfile.userId !== '100000') {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-indigo-700 text-white shadow-md">
        <div className="container mx-auto py-4 px-4">
          <div className="flex justify-between items-center">
            <h1 className="text-xl font-bold">Spector Quiz 管理ページ</h1>
            <div className="flex items-center space-x-2">
              <span>管理者: {userProfile.username}</span>
            </div>
          </div>
        </div>
      </header>
      
      <div className="container mx-auto py-8 px-4">
        <div className="flex flex-col md:flex-row">
          {/* サイドバーナビゲーション */}
          <aside className="w-full md:w-64 mb-6 md:mb-0">
            <nav className="bg-white shadow rounded-lg p-4">
              <ul className="space-y-2">
                <li>
                  <Link href="/admin" className="block p-2 hover:bg-indigo-50 rounded transition-colors">
                    ダッシュボード
                  </Link>
                </li>
                <li>
                  <Link href="/admin/quiz-management" className="block p-2 hover:bg-indigo-50 rounded transition-colors">
                    公式クイズ管理
                  </Link>
                </li>
                <li>
                  <Link href="/admin/user-management" className="block p-2 hover:bg-indigo-50 rounded transition-colors">
                    ユーザー管理
                  </Link>
                </li>
                <li>
                  <Link href="/admin/initialize" className="block p-2 hover:bg-indigo-50 rounded transition-colors">
                    DB初期化
                  </Link>
                </li>
                <li>
                  <Link href="/" className="block p-2 hover:bg-indigo-50 rounded transition-colors text-blue-600">
                    サイトに戻る
                  </Link>
                </li>
              </ul>
            </nav>
          </aside>
          
          {/* メインコンテンツエリア */}
          <main className="flex-1 md:ml-8">
            <div className="bg-white shadow rounded-lg p-6">
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
