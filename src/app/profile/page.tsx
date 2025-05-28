'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { doc, getDoc } from 'firebase/firestore';
import { usersDb } from '@/config/firebase';
import { User, UserProfile } from '@/types/user';
import { FaUser, FaTrophy, FaGamepad, FaCheck, FaArrowLeft } from 'react-icons/fa';
import Link from 'next/link';
import { calculateUserRankInfo } from '@/utils/rankCalculator';

// ローディングフォールバックコンポーネント
function ProfileLoading() {
  return (
    <div className="flex justify-center items-center min-h-[calc(100vh-64px)]">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
    </div>
  );
}

// プロフィールコンテンツコンポーネント
function ProfileContent() {
  const { currentUser } = useAuth();
  const searchParams = useSearchParams();
  const userId = searchParams.get('id');
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!userId) {
        setError('ユーザーIDが指定されていません');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const userRef = doc(usersDb, 'users', userId);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists()) {
          const userData = userSnap.data() as User;
          // 動的にランク情報を計算
          const rankInfo = calculateUserRankInfo(userData.exp || 0);
          
          setUserProfile({
            userId: userData.userId,
            username: userData.username,
            iconId: userData.iconId,
            exp: userData.exp,
            rank: rankInfo.rank.name, // 計算されたランクを使用
            stats: userData.stats,
            rankInfo // 詳細なランク情報も含める
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

  // ランク情報を取得
  const rankInfo = userProfile.rankInfo || calculateUserRankInfo(userProfile.exp || 0);
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
              <p className="text-indigo-200">レベル {rankInfo.level}</p>
            </div>
          </div>
        </div>

        {/* プロフィール情報 */}
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 経験値とレベル */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h2 className="text-lg font-semibold mb-3 flex items-center">
                <FaTrophy className="mr-2" /> 経験値とランク
              </h2>
              <div className="space-y-2">
                <div>
                  <p className="text-sm text-gray-600">総経験値</p>
                  <p className="text-2xl font-bold">{userProfile.exp} EXP</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">ランク</p>
                  <div className="flex items-center space-x-2">
                    <span className={`px-2 py-1 rounded-full text-sm font-semibold ${rankInfo.rank.color} ${rankInfo.rank.bgColor}`}>
                      {userProfile.rank}
                    </span>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-gray-600">次のランクまで</p>
                  <div className="w-full bg-gray-200 rounded-full h-2.5 mt-2">
                    <div
                      className="bg-indigo-600 h-2.5 rounded-full"
                      style={{ width: `${rankInfo.progress}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    あと {rankInfo.expToNextRank} EXP
                  </p>
                </div>
              </div>
            </div>

            {/* プレイ統計 */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h2 className="text-lg font-semibold mb-3 flex items-center">
                <FaGamepad className="mr-2" /> プレイ統計
              </h2>
              <div className="space-y-2">
                <div>
                  <p className="text-sm text-gray-600">総回答数</p>
                  <p className="text-2xl font-bold">{userProfile.stats.totalAnswered}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">正解数</p>
                  <p className="text-2xl font-bold">
                    {userProfile.stats.correctAnswers}
                    <span className="text-sm text-gray-600 ml-2">
                      ({correctRate}% 正解率)
                    </span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// メインのプロフィールページコンポーネント
export default function ProfilePage() {
  return (
    <Suspense fallback={<ProfileLoading />}>
      <ProfileContent />
    </Suspense>
  );
}