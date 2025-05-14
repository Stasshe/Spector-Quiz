'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { useQuizHook } from '@/hooks/useQuiz';
import { FaPlus, FaGamepad, FaArrowRight, FaSearch, FaChevronRight, FaTrophy, FaGraduationCap, FaBookOpen, FaFileAlt } from 'react-icons/fa';

export default function QuizPage() {
  const { currentUser, userProfile } = useAuth();
  const { genres, subgenres, fetchGenres, loading } = useQuizHook();
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);

  useEffect(() => {
    fetchGenres();
  }, [fetchGenres]);

  const genreIcons: Record<string, React.ReactNode> = {
    "エンタメ": <FaGamepad className="text-purple-500" />,
    "科学": <FaGraduationCap className="text-blue-500" />,
    "歴史": <FaBookOpen className="text-amber-500" />,
    "一般常識": <FaFileAlt className="text-green-500" />
  };

  const getGenreIcon = (genre: string) => {
    return genreIcons[genre] || <FaGamepad className="text-indigo-500" />;
  };

  // ユーザーが未ログインの場合、ログインを促す
  if (!currentUser) {
    return (
      <div className="app-container py-12">
        <div className="max-w-2xl mx-auto card p-8 text-center">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <FaGamepad className="text-red-500 w-10 h-10" />
          </div>
          <h1 className="text-2xl font-bold mb-4">クイズをプレイするにはログインが必要です</h1>
          <p className="mb-6 text-gray-600">アカウントをお持ちの方はログイン、新規の方は登録からはじめましょう。</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link 
              href="/auth/login" 
              className="btn-primary"
            >
              ログイン
            </Link>
            <Link 
              href="/auth/register" 
              className="btn-outline"
            >
              新規登録
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container py-8">
      {/* ユーザープロフィールカード */}
      {userProfile && (
        <div className="card mb-8 flex flex-col md:flex-row items-center gap-6">
          <div className="flex items-center gap-4">
            <div className="avatar w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-500 text-white flex items-center justify-center text-xl font-bold">
              {userProfile.username.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <p className="font-bold text-lg">{userProfile.username}</p>
              <div className="flex items-center text-gray-600 text-sm">
                <FaTrophy className="text-yellow-500 mr-1" />
                <span>ランク: {userProfile.rank}</span>
              </div>
            </div>
          </div>
          
          <div className="flex-grow mx-4 my-4 md:my-0">
            <div className="flex justify-between text-sm mb-1">
              <span className="font-medium">レベル {Math.floor(userProfile.exp / 100) + 1}</span>
              <span className="text-gray-600">{userProfile.exp % 100}/100 EXP</span>
            </div>
            <div className="progress-container">
              <div
                className="progress-bar bg-gradient-to-r from-indigo-500 to-purple-500"
                style={{ width: `${(userProfile.exp % 100)}%` }}
              ></div>
            </div>
          </div>
          
          <Link
            href={`/profile/${userProfile.userId}`}
            className="btn-outline flex items-center"
          >
            プロフィール <FaChevronRight className="ml-2" />
          </Link>
        </div>
      )}

      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-transparent bg-clip-text">クイズをプレイ</h1>
        <p className="text-gray-600">ジャンルを選んで、クイズルームを作成するか参加しましょう。</p>
      </div>

      {loading ? (
        <div className="flex justify-center items-center min-h-[300px]">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* ジャンル選択セクション */}
          <div className="lg:col-span-1">
            <div className="card">
              <h2 className="text-xl font-semibold mb-6 flex items-center">
                <FaGamepad className="mr-2 text-indigo-500" />
                ジャンルを選択
              </h2>
              <div className="space-y-3">
                {genres.map((genre) => (
                  <button
                    key={genre}
                    className={`w-full p-4 rounded-xl border-2 text-left flex items-center transition-all duration-200 ${
                      selectedGenre === genre
                        ? 'border-indigo-500 bg-indigo-50 shadow-md'
                        : 'border-gray-200 hover:border-indigo-200 hover:bg-indigo-50'
                    }`}
                    onClick={() => setSelectedGenre(genre)}
                  >
                    <div className="w-10 h-10 rounded-lg bg-white shadow-sm flex items-center justify-center mr-3">
                      {getGenreIcon(genre)}
                    </div>
                    <span className="font-medium">{genre}</span>
                    {selectedGenre === genre && (
                      <FaChevronRight className="ml-auto text-indigo-500" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* サブジャンル選択とルーム作成/参加セクション */}
          <div className="lg:col-span-2">
            <div className="card h-full">
              {selectedGenre ? (
                <>
                  <h2 className="text-xl font-semibold mb-6 flex items-center">
                    {getGenreIcon(selectedGenre)}
                    <span className="ml-2">{selectedGenre}の単元</span>
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {subgenres[selectedGenre]?.map((subgenre) => (
                      <div key={subgenre} className="border border-gray-200 rounded-xl p-4 hover:border-indigo-200 hover:shadow-md transition-all duration-200">
                        <h3 className="font-medium mb-3 text-gray-800">{subgenre}</h3>
                        <div className="flex flex-col gap-2">
                          <Link
                            href={`/quiz/rooms?genre=${selectedGenre}&subgenre=${subgenre}`}
                            className="flex items-center justify-between p-3 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors duration-200"
                          >
                            <span className="font-medium">ルームを探す</span>
                            <FaSearch />
                          </Link>
                          <Link
                            href={`/quiz/create?genre=${selectedGenre}&subgenre=${subgenre}`}
                            className="flex items-center justify-between p-3 rounded-lg bg-purple-50 text-purple-700 hover:bg-purple-100 transition-colors duration-200"
                          >
                            <span className="font-medium">ルームを作る</span>
                            <FaPlus />
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center min-h-[300px] py-12">
                  <div className="w-20 h-20 bg-indigo-100 rounded-full flex items-center justify-center mb-6 animate-pulse">
                    <FaArrowRight className="transform -rotate-90 lg:rotate-180 text-xl text-indigo-500" />
                  </div>
                  <p className="text-gray-500 text-lg mb-2">ジャンルを選択してください</p>
                  <p className="text-gray-400 text-sm">左側からお好きなジャンルを選んでクイズを始めましょう</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
