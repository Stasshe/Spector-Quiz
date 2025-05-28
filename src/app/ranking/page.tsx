'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { FaTrophy, FaMedal, FaUser, FaCrown, FaChartLine, FaCheck, FaBolt, FaFire } from 'react-icons/fa';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { usersDb } from '@/config/firebase';
import { User, UserProfile } from '@/types/user';
import { calculateUserRankInfo } from '@/utils/rankCalculator';

export default function RankingPage() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'exp' | 'correct'>('exp');

  useEffect(() => {
    const fetchRanking = async () => {
      try {
        setLoading(true);
        
        // 経験値順のランキングを取得
        const usersRef = collection(usersDb, 'users');
        const q = query(
          usersRef, 
          orderBy(activeTab === 'exp' ? 'exp' : 'stats.correctAnswers', 'desc'),
          limit(20)
        );
        
        const querySnapshot = await getDocs(q);
        const fetchedUsers: UserProfile[] = [];
        
        querySnapshot.forEach((doc) => {
          const userData = doc.data() as User;
          // 動的にランク情報を計算
          const rankInfo = calculateUserRankInfo(userData.exp || 0);
          
          fetchedUsers.push({
            userId: userData.userId,
            username: userData.username,
            iconId: userData.iconId,
            exp: userData.exp,
            rank: rankInfo.rank.name, // 計算されたランクを使用
            stats: userData.stats,
            rankInfo // 詳細なランク情報も含める
          });
        });
        
        setUsers(fetchedUsers);
      } catch (err) {
        console.error('Error fetching ranking:', err);
        setError('ランキングの読み込み中にエラーが発生しました');
      } finally {
        setLoading(false);
      }
    };
    
    fetchRanking();
  }, [activeTab]);

  const renderTrophyIcon = (index: number) => {
    switch (index) {
      case 0:
        return <FaTrophy className="text-yellow-500 text-xl" />;
      case 1:
        return <FaTrophy className="text-gray-400 text-xl" />;
      case 2:
        return <FaTrophy className="text-amber-700 text-xl" />;
      default:
        return <span className="text-gray-500">{index + 1}</span>;
    }
  };

  return (
    <div className="app-container py-8">
      <div className="mb-8 text-center">
        <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 text-transparent bg-clip-text mb-2">Zap! ランキング</h1>
        <p className="text-gray-600">最高のクイズプレイヤーたちを競争で勝ち抜こう！</p>
      </div>
      
      {/* タブ切り替え */}
      <div className="mb-8 flex justify-center">
        <div className="inline-flex rounded-full bg-gray-100 p-1 shadow-sm">
          <button
            className={`flex items-center px-6 py-3 rounded-full font-medium text-sm transition-all duration-200 ${
              activeTab === 'exp'
                ? 'bg-white text-indigo-600 shadow-sm'
                : 'text-gray-600 hover:text-indigo-500'
            }`}
            onClick={() => setActiveTab('exp')}
          >
            <FaBolt className={`mr-2 ${activeTab === 'exp' ? 'text-yellow-500' : 'text-gray-400'}`} />
            経験値ランキング
          </button>
          <button
            className={`flex items-center px-6 py-3 rounded-full font-medium text-sm transition-all duration-200 ${
              activeTab === 'correct'
                ? 'bg-white text-indigo-600 shadow-sm'
                : 'text-gray-600 hover:text-indigo-500'
            }`}
            onClick={() => setActiveTab('correct')}
          >
            <FaCheck className={`mr-2 ${activeTab === 'correct' ? 'text-green-500' : 'text-gray-400'}`} />
            正解数ランキング
          </button>
        </div>
      </div>
      
      {loading ? (
        <div className="flex flex-col justify-center items-center py-12">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-indigo-500 mb-4"></div>
          <p className="text-gray-600 animate-pulse">ランキングを読み込み中...</p>
        </div>
      ) : error ? (
        <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 rounded-lg animate-fadeIn">
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
      ) : (
        <div>
          {/* 上位3名の特別表示 */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
            {users.slice(0, 3).map((user, index) => {
              // 表示スタイルを位置によって変更
              let podiumStyles = {};
              let ringColor = "";
              let iconColor = "";
              
              if (index === 0) {
                podiumStyles = { order: 2 };
                ringColor = "ring-yellow-400 bg-yellow-50";
                iconColor = "text-yellow-500";
              } else if (index === 1) {
                podiumStyles = { order: 1 };
                ringColor = "ring-gray-300 bg-gray-50";
                iconColor = "text-gray-400";
              } else {
                podiumStyles = { order: 3 };
                ringColor = "ring-amber-700 bg-amber-50";
                iconColor = "text-amber-700";
              }
              
              return (
                <Link
                  key={user.userId}
                  href={`/profile/user?id=${user.userId}`}
                  style={podiumStyles}
                  className={`card hover:shadow-xl transition-all duration-300 p-6 flex flex-col items-center relative overflow-hidden transform hover:-translate-y-1`}
                >
                  {index === 0 && (
                    <div className="absolute top-2 right-2">
                      <FaCrown className="text-yellow-500 text-2xl animate-pulse" />
                    </div>
                  )}
                  
                  <div className={`relative mb-4 ${index === 0 ? 'scale-125' : ''}`}>
                    <div className={`rounded-full p-4 ring-4 ${ringColor}`}>
                      <FaUser className={`text-2xl ${iconColor}`} />
                    </div>
                    <div className="absolute -bottom-2 -right-2 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full w-8 h-8 flex items-center justify-center text-white font-bold text-sm shadow-md">
                      {index + 1}
                    </div>
                  </div>
                  
                  <h3 className="font-bold text-lg text-center mb-1">{user.username}</h3>
                  
                  <div className="flex items-center justify-center space-x-1 mb-3">
                    <div className={`text-xs font-semibold px-2 py-1 rounded-full ${user.rankInfo?.rank.color || 'text-gray-600'} ${user.rankInfo?.rank.bgColor || 'bg-gray-100'}`}>
                      ランク: {user.rank}
                    </div>
                    <div className="bg-purple-100 text-purple-800 text-xs font-semibold px-2 py-1 rounded-full">
                      Lv. {user.rankInfo?.level || Math.floor(user.exp / 100) + 1}
                    </div>
                  </div>
                  
                  <div className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white px-4 py-2 rounded-full font-bold flex items-center">
                    {activeTab === 'exp' ? (
                      <>
                        <FaFire className="mr-2 animate-pulse" />
                        {user.exp} EXP
                      </>
                    ) : (
                      <>
                        <FaCheck className="mr-2" />
                        {user.stats.correctAnswers} 正解
                      </>
                    )}
                  </div>
                </Link>
              )
            })}
          </div>
          
          {/* ランキングリスト */}
          <div className="card overflow-hidden">
            <div className="bg-indigo-50 px-4 py-3 border-b border-indigo-100">
              <div className="grid grid-cols-12 gap-4">
                <div className="col-span-1 text-center font-medium text-gray-600">#</div>
                <div className="col-span-7 font-medium text-gray-600">ユーザー</div>
                <div className="col-span-4 text-right font-medium text-gray-600">
                  {activeTab === 'exp' ? 'EXP' : '正解数'}
                </div>
              </div>
            </div>
            
            <ul className="divide-y divide-gray-100">
              {users.slice(3).map((user, index) => (
                <li key={user.userId} className="hover:bg-indigo-50 transition-colors duration-150">
                  <Link
                    href={`/profile/user?id=${user.userId}`}
                    className="grid grid-cols-12 gap-4 px-4 py-3 items-center"
                  >
                    <div className="col-span-1 text-center font-semibold text-gray-500">
                      {index + 4}
                    </div>
                    <div className="col-span-7">
                      <div className="flex items-center">
                        <div className="bg-indigo-100 rounded-full p-2 mr-3">
                          <FaUser className="text-indigo-600 text-sm" />
                        </div>
                        <div>
                          <h3 className="font-medium text-gray-800">{user.username}</h3>
                          <div className="flex text-xs space-x-2">
                            <span className={`px-2 py-0.5 rounded ${user.rankInfo?.rank.color || 'text-gray-500'} ${user.rankInfo?.rank.bgColor || 'bg-gray-100'}`}>
                              ランク: {user.rank}
                            </span>
                            <span className="text-gray-500">•</span>
                            <span className="text-gray-500">Lv. {user.rankInfo?.level || Math.floor(user.exp / 100) + 1}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="col-span-4 text-right">
                      <span className="inline-flex items-center bg-indigo-100 text-indigo-800 px-3 py-1 rounded-full text-sm font-medium">
                        {activeTab === 'exp' ? (
                          <>
                            <FaBolt className="mr-1 text-yellow-500" />
                            {user.exp}
                          </>
                        ) : (
                          <>
                            <FaCheck className="mr-1 text-green-500" />
                            {user.stats.correctAnswers}
                          </>
                        )}
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
            
            {users.length === 0 && (
              <div className="py-12 text-center text-gray-500">
                <FaChartLine className="mx-auto text-gray-300 text-4xl mb-4" />
                <p>表示するデータがありません</p>
                <p className="text-sm mt-2">プレイヤーたちがクイズに参加するとランキングが表示されます</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
