'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { User, UserProfile } from '@/types/user';
import { FaUser, FaTrophy, FaGamepad, FaCheck, FaArrowLeft } from 'react-icons/fa';
import Link from 'next/link';

export default function ProfilePage() {
  const { currentUser } = useAuth();
  const params = useParams<{ userId: string }>();
  const userId = params.userId as string;
  const router = useRouter();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        setLoading(true);
        const userRef = doc(db, 'users', userId);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists()) {
          const userData = userSnap.data() as User;
          setUserProfile({
            userId: userData.userId,
            username: userData.username,
            iconId: userData.iconId,
            exp: userData.exp,
            rank: userData.rank,
            stats: userData.stats
          });
        } else {
          setError('ユーザーが見つかりません');
        }
      } catch (err) {
        console.error('Error fetching user profile:', err);
        setError('プロフィールの読み込み中にエラーが発生しました');
      } finally {
        setLoading(false);
      }
    };

    fetchUserProfile();
  }, [userId]);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[calc(100vh-64px)]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  if (error || !userProfile) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-md p-8 text-center">
          <h1 className="text-2xl font-bold mb-4">エラー</h1>
          <p className="mb-6">{error || 'ユーザー情報を取得できませんでした'}</p>
          <Link
            href="/quiz"
            className="bg-indigo-600 text-white px-6 py-2 rounded-md inline-flex items-center"
          >
            <FaArrowLeft className="mr-2" /> クイズページに戻る
          </Link>
        </div>
      </div>
    );
  }

  const level = Math.floor(userProfile.exp / 100) + 1;
  const levelProgress = userProfile.exp % 100;
  const isOwnProfile = currentUser && currentUser.uid === userId;

  // 正解率の計算
  const correctRate = userProfile.stats.totalAnswered > 0
    ? Math.round((userProfile.stats.correctAnswers / userProfile.stats.totalAnswered) * 100)
    : 0;

  return (
    <div className="container mx-auto px-4 py-8">
      <Link href="/quiz" className="flex items-center text-indigo-600 mb-6">
        <FaArrowLeft className="mr-2" /> クイズページに戻る
      </Link>

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        {/* ヘッダー部分 */}
        <div className="bg-indigo-600 text-white p-6">
          <div className="flex flex-col md:flex-row items-center gap-6">
            <div className="bg-white text-indigo-600 p-6 rounded-full">
              <FaUser size={40} />
            </div>
            <div>
              <h1 className="text-3xl font-bold">{userProfile.username}</h1>
              <p className="text-indigo-200">
                ランク: {userProfile.rank} • レベル {level}
              </p>
            </div>
          </div>
        </div>

        {/* 経験値バー */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex justify-between text-sm text-gray-600 mb-1">
            <span>レベル {level}</span>
            <span>レベル {level + 1}</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div
              className="bg-indigo-600 h-2.5 rounded-full"
              style={{ width: `${levelProgress}%` }}
            ></div>
          </div>
          <div className="mt-2 text-center text-sm text-gray-600">
            次のレベルまであと {100 - levelProgress} EXP
          </div>
        </div>

        {/* 統計情報 */}
        <div className="p-6">
          <h2 className="text-xl font-bold mb-4">統計情報</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-indigo-50 p-4 rounded-md flex flex-col items-center">
              <FaGamepad className="text-indigo-600 text-2xl mb-2" />
              <span className="text-sm text-gray-600">総回答数</span>
              <span className="text-2xl font-bold">{userProfile.stats.totalAnswered}</span>
            </div>
            <div className="bg-green-50 p-4 rounded-md flex flex-col items-center">
              <FaCheck className="text-green-600 text-2xl mb-2" />
              <span className="text-sm text-gray-600">正解数</span>
              <span className="text-2xl font-bold">{userProfile.stats.correctAnswers}</span>
            </div>
            <div className="bg-yellow-50 p-4 rounded-md flex flex-col items-center">
              <FaTrophy className="text-yellow-600 text-2xl mb-2" />
              <span className="text-sm text-gray-600">正解率</span>
              <span className="text-2xl font-bold">{correctRate}%</span>
            </div>
          </div>
        </div>

        {/* ジャンル別の統計 */}
        {Object.keys(userProfile.stats.genres).length > 0 && (
          <div className="p-6 border-t border-gray-200">
            <h2 className="text-xl font-bold mb-4">ジャンル別統計</h2>
            <div className="overflow-x-auto">
              <table className="w-full table-auto">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-gray-600">ジャンル</th>
                    <th className="px-4 py-2 text-left text-gray-600">回答数</th>
                    <th className="px-4 py-2 text-left text-gray-600">正解数</th>
                    <th className="px-4 py-2 text-left text-gray-600">正解率</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {Object.entries(userProfile.stats.genres).map(([genre, stats]) => {
                    const genreCorrectRate = stats.totalAnswered > 0
                      ? Math.round((stats.correctAnswers / stats.totalAnswered) * 100)
                      : 0;
                    
                    return (
                      <tr key={genre} className="hover:bg-gray-50">
                        <td className="px-4 py-3">{genre}</td>
                        <td className="px-4 py-3">{stats.totalAnswered}</td>
                        <td className="px-4 py-3">{stats.correctAnswers}</td>
                        <td className="px-4 py-3">{genreCorrectRate}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 自分のプロフィールの場合のみ表示する操作 */}
        {isOwnProfile && (
          <div className="p-6 border-t border-gray-200 bg-gray-50">
            <div className="flex justify-center">
              <Link
                href="/quiz"
                className="bg-indigo-600 text-white px-6 py-2 rounded-md inline-flex items-center"
              >
                <FaGamepad className="mr-2" /> クイズをプレイする
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
