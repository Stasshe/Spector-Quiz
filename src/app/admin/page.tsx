'use client';

import { useState, useEffect } from 'react';
import { db } from '@/config/firebase';
import { collection, getDocs, query, limit, orderBy, getCountFromServer } from 'firebase/firestore';
import { User } from '@/types/user';
import { QuizUnit } from '@/types/quiz';

// ダッシュボード用の統計情報型
interface DashboardStats {
  totalUsers: number;
  activeUsers: number;
  totalQuizzes: number;
  totalUnits: number;
  totalGenres: number;
  recentUsers: User[];
  popularUnits: QuizUnit[];
}

// 日付フォーマット用関数
const formatDate = (timestamp: any) => {
  if (!timestamp) return '不明';
  const date = timestamp.toDate();
  return new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
};

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    activeUsers: 0,
    totalQuizzes: 0,
    totalUnits: 0,
    totalGenres: 0,
    recentUsers: [],
    popularUnits: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchDashboardStats() {
      try {
        setLoading(true);
        
        // 統計情報を集計
        const statsData: DashboardStats = {
          totalUsers: 0,
          activeUsers: 0,
          totalQuizzes: 0,
          totalUnits: 0,
          totalGenres: 0,
          recentUsers: [],
          popularUnits: []
        };
        
        // ユーザー数のカウント
        const usersSnapshot = await getCountFromServer(collection(db, 'users'));
        statsData.totalUsers = usersSnapshot.data().count;
        
        // オンラインユーザー数（24時間以内にログイン）のカウント
        const oneDayAgo = new Date();
        oneDayAgo.setDate(oneDayAgo.getDate() - 1);
        
        // 最近追加されたユーザーを取得
        const recentUsersQuery = query(
          collection(db, 'users'),
          orderBy('createdAt', 'desc'),
          limit(5)
        );
        const recentUsersSnapshot = await getDocs(recentUsersQuery);
        
        statsData.recentUsers = recentUsersSnapshot.docs.map(doc => {
          const userData = doc.data();
          return {
            ...userData,
            userId: userData.userId || doc.id
          } as User;
        });
        
        // アクティブユーザー（直近1日以内にログイン）の数を計算
        statsData.activeUsers = statsData.recentUsers.filter(
          user => user.lastLoginAt && user.lastLoginAt.toDate() > oneDayAgo
        ).length;
        
        // ジャンル数を取得
        const genresSnapshot = await getCountFromServer(collection(db, 'genres'));
        statsData.totalGenres = genresSnapshot.data().count;
        
        // 全クイズの総数（推定値）を取得
        const quizzesSnapshot = await getCountFromServer(collection(db, 'quizzes'));
        statsData.totalQuizzes = quizzesSnapshot.data().count;
        
        // 人気の単元を取得
        const popularUnits: QuizUnit[] = [];
        const genreSnapshot = await getDocs(collection(db, 'genres'));
        
        // 単元の総数をカウント
        let unitCount = 0;
        
        for (const genreDoc of genreSnapshot.docs) {
          const genreId = genreDoc.id;
          
          // ジャンル内の単元総数をカウント
          const unitsCountSnapshot = await getCountFromServer(
            collection(db, 'genres', genreId, 'quiz_units')
          );
          unitCount += unitsCountSnapshot.data().count;
          
          // 人気の単元を取得（各ジャンルから最大3つずつ）
          const unitsQuery = query(
            collection(db, 'genres', genreId, 'quiz_units'),
            orderBy('useCount', 'desc'),
            limit(3)
          );
          
          const unitsSnapshot = await getDocs(unitsQuery);
          
          unitsSnapshot.forEach(doc => {
            popularUnits.push({
              ...doc.data(),
              unitId: doc.id,
              genre: genreId
            } as QuizUnit);
          });
        }
        
        statsData.totalUnits = unitCount;
        
        // 使用回数順に並べ替えて上位5つを選択
        statsData.popularUnits = popularUnits
          .sort((a, b) => (b.useCount || 0) - (a.useCount || 0))
          .slice(0, 5);
        
        setStats(statsData);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching dashboard stats:', err);
        setError('統計情報の取得中にエラーが発生しました');
        setLoading(false);
      }
    }

    fetchDashboardStats();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-pulse text-xl">データを読み込み中...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">管理者ダッシュボード</h1>
      
      {/* 統計カード */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg p-6 shadow border-l-4 border-blue-500">
          <h2 className="text-gray-500 text-sm uppercase font-semibold">ユーザー数</h2>
          <p className="text-3xl font-bold">{stats.totalUsers}</p>
          <p className="text-sm text-gray-600">アクティブ: {stats.activeUsers}</p>
        </div>
        
        <div className="bg-white rounded-lg p-6 shadow border-l-4 border-green-500">
          <h2 className="text-gray-500 text-sm uppercase font-semibold">クイズ数</h2>
          <p className="text-3xl font-bold">{stats.totalQuizzes}</p>
        </div>
        
        <div className="bg-white rounded-lg p-6 shadow border-l-4 border-yellow-500">
          <h2 className="text-gray-500 text-sm uppercase font-semibold">単元数</h2>
          <p className="text-3xl font-bold">{stats.totalUnits}</p>
        </div>
        
        <div className="bg-white rounded-lg p-6 shadow border-l-4 border-purple-500">
          <h2 className="text-gray-500 text-sm uppercase font-semibold">ジャンル数</h2>
          <p className="text-3xl font-bold">{stats.totalGenres}</p>
        </div>
      </div>
      
      {/* 最近のユーザー */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">最近登録したユーザー</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border">
            <thead>
              <tr className="bg-gray-100 text-gray-600 uppercase text-sm leading-normal">
                <th className="py-3 px-6 text-left">ユーザーID</th>
                <th className="py-3 px-6 text-left">名前</th>
                <th className="py-3 px-6 text-left">ランク</th>
                <th className="py-3 px-6 text-left">作成日</th>
                <th className="py-3 px-6 text-left">最終ログイン</th>
              </tr>
            </thead>
            <tbody className="text-gray-600">
              {stats.recentUsers.map((user, index) => (
                <tr key={index} className="border-b hover:bg-gray-50">
                  <td className="py-3 px-6">{user.userId}</td>
                  <td className="py-3 px-6">{user.username}</td>
                  <td className="py-3 px-6">{user.rank}</td>
                  <td className="py-3 px-6">{formatDate(user.createdAt)}</td>
                  <td className="py-3 px-6">{formatDate(user.lastLoginAt)}</td>
                </tr>
              ))}
              {stats.recentUsers.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-4 px-6 text-center">ユーザーデータがありません</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* 人気の単元 */}
      <div>
        <h2 className="text-xl font-semibold mb-4">人気の単元</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border">
            <thead>
              <tr className="bg-gray-100 text-gray-600 uppercase text-sm leading-normal">
                <th className="py-3 px-6 text-left">単元名</th>
                <th className="py-3 px-6 text-left">ジャンル</th>
                <th className="py-3 px-6 text-left">クイズ数</th>
                <th className="py-3 px-6 text-left">使用回数</th>
                <th className="py-3 px-6 text-left">難易度</th>
              </tr>
            </thead>
            <tbody className="text-gray-600">
              {stats.popularUnits.map((unit, index) => (
                <tr key={index} className="border-b hover:bg-gray-50">
                  <td className="py-3 px-6">{unit.title}</td>
                  <td className="py-3 px-6">{unit.genre}</td>
                  <td className="py-3 px-6">{unit.quizCount}</td>
                  <td className="py-3 px-6">{unit.useCount || 0}</td>
                  <td className="py-3 px-6">{unit.averageDifficulty?.toFixed(1) || '不明'}</td>
                </tr>
              ))}
              {stats.popularUnits.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-4 px-6 text-center">単元データがありません</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
