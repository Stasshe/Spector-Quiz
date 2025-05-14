'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { FaTrophy, FaMedal, FaUser } from 'react-icons/fa';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { User, UserProfile } from '@/types/user';

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
        const usersRef = collection(db, 'users');
        const q = query(
          usersRef, 
          orderBy(activeTab === 'exp' ? 'exp' : 'stats.correctAnswers', 'desc'),
          limit(20)
        );
        
        const querySnapshot = await getDocs(q);
        const fetchedUsers: UserProfile[] = [];
        
        querySnapshot.forEach((doc) => {
          const userData = doc.data() as User;
          fetchedUsers.push({
            userId: userData.userId,
            username: userData.username,
            iconId: userData.iconId,
            exp: userData.exp,
            rank: userData.rank,
            stats: userData.stats
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
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">ランキング</h1>
      
      {/* タブ切り替え */}
      <div className="mb-6 flex border-b border-gray-200">
        <button
          className={`px-4 py-2 font-medium text-sm focus:outline-none ${
            activeTab === 'exp'
              ? 'text-indigo-600 border-b-2 border-indigo-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setActiveTab('exp')}
        >
          経験値ランキング
        </button>
        <button
          className={`px-4 py-2 font-medium text-sm focus:outline-none ${
            activeTab === 'correct'
              ? 'text-indigo-600 border-b-2 border-indigo-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setActiveTab('correct')}
        >
          正解数ランキング
        </button>
      </div>
      
      {loading ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
          {error}
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          {/* 上位3名の特別表示 */}
          <div className="bg-indigo-50 p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {users.slice(0, 3).map((user, index) => (
                <Link
                  key={user.userId}
                  href={`/profile/${user.userId}`}
                  className="bg-white rounded-lg shadow-sm p-4 hover:shadow-md transition flex flex-col items-center"
                >
                  <div className="mb-2">
                    {index === 0 && <FaMedal className="text-yellow-500 text-3xl" />}
                    {index === 1 && <FaMedal className="text-gray-400 text-3xl" />}
                    {index === 2 && <FaMedal className="text-amber-700 text-3xl" />}
                  </div>
                  <div className="bg-indigo-100 p-3 rounded-full mb-2">
                    <FaUser className="text-indigo-600 text-xl" />
                  </div>
                  <h3 className="font-bold text-lg">{user.username}</h3>
                  <div className="text-gray-600 mb-2">
                    ランク: {user.rank} • Lv. {Math.floor(user.exp / 100) + 1}
                  </div>
                  <div className="font-bold text-indigo-600">
                    {activeTab === 'exp' ? `${user.exp} EXP` : `${user.stats.correctAnswers} 正解`}
                  </div>
                </Link>
              ))}
            </div>
          </div>
          
          {/* ランキングリスト */}
          <ul className="divide-y divide-gray-200">
            {users.slice(3).map((user, index) => (
              <li key={user.userId}>
                <Link
                  href={`/profile/${user.userId}`}
                  className="flex items-center p-4 hover:bg-gray-50 transition"
                >
                  <div className="w-10 text-center mr-4">
                    {renderTrophyIcon(index + 3)}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium">{user.username}</h3>
                    <p className="text-sm text-gray-600">
                      ランク: {user.rank} • Lv. {Math.floor(user.exp / 100) + 1}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-indigo-600">
                      {activeTab === 'exp' ? `${user.exp} EXP` : `${user.stats.correctAnswers} 正解`}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
          
          {users.length === 0 && (
            <div className="py-8 text-center text-gray-500">
              表示するデータがありません
            </div>
          )}
        </div>
      )}
    </div>
  );
}
