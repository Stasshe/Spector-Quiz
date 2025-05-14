'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { useQuizHook } from '@/hooks/useQuiz';
import { FaPlus, FaGamepad, FaArrowRight } from 'react-icons/fa';

export default function QuizPage() {
  const { currentUser, userProfile } = useAuth();
  const { genres, subgenres, fetchGenres, loading } = useQuizHook();
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);

  useEffect(() => {
    fetchGenres();
  }, [fetchGenres]);

  // ユーザーが未ログインの場合、ログインを促す
  if (!currentUser) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-md p-8 text-center">
          <h1 className="text-2xl font-bold mb-4">クイズをプレイするにはログインが必要です</h1>
          <p className="mb-6">アカウントをお持ちの方はログイン、新規の方は登録からはじめましょう。</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link 
              href="/auth/login" 
              className="bg-indigo-600 text-white font-bold px-6 py-2 rounded-md"
            >
              ログイン
            </Link>
            <Link 
              href="/auth/register" 
              className="bg-yellow-400 text-indigo-900 font-bold px-6 py-2 rounded-md"
            >
              新規登録
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">クイズをプレイ</h1>
        <p className="text-gray-600">ジャンルを選んで、クイズルームを作成するか参加しましょう。</p>
      </div>

      {loading ? (
        <div className="flex justify-center items-center min-h-[300px]">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* ジャンル選択セクション */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4">ジャンルを選択</h2>
            <div className="grid grid-cols-2 gap-4">
              {genres.map((genre) => (
                <button
                  key={genre}
                  className={`p-4 rounded-lg border text-left ${
                    selectedGenre === genre
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}
                  onClick={() => setSelectedGenre(genre)}
                >
                  <span className="font-medium">{genre}</span>
                </button>
              ))}
            </div>
          </div>

          {/* サブジャンル選択とルーム作成/参加セクション */}
          <div className="bg-white rounded-lg shadow-md p-6">
            {selectedGenre ? (
              <>
                <h2 className="text-xl font-semibold mb-4">{selectedGenre}の単元</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                  {subgenres[selectedGenre]?.map((subgenre) => (
                    <div key={subgenre} className="border border-gray-200 rounded-lg p-4">
                      <h3 className="font-medium mb-2">{subgenre}</h3>
                      <div className="flex flex-col gap-2">
                        <Link
                          href={`/quiz/rooms?genre=${selectedGenre}&subgenre=${subgenre}`}
                          className="bg-indigo-100 text-indigo-700 px-3 py-1.5 rounded text-sm flex items-center justify-between"
                        >
                          ルームを探す
                          <FaGamepad />
                        </Link>
                        <Link
                          href={`/quiz/create?genre=${selectedGenre}&subgenre=${subgenre}`}
                          className="bg-yellow-100 text-yellow-700 px-3 py-1.5 rounded text-sm flex items-center justify-between"
                        >
                          ルームを作る
                          <FaPlus />
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center min-h-[300px] text-gray-500">
                <p className="mb-4">左側からジャンルを選択してください</p>
                <FaArrowRight className="transform -rotate-90 md:rotate-180 text-2xl" />
              </div>
            )}
          </div>
        </div>
      )}

      {/* ユーザー情報セクション */}
      {userProfile && (
        <div className="mt-8 bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">あなたの情報</h2>
          <div className="flex flex-col md:flex-row gap-6">
            <div className="flex items-center gap-4">
              <div className="bg-indigo-100 text-indigo-700 p-4 rounded-full">
                <span className="text-xl font-bold">{userProfile.iconId}</span>
              </div>
              <div>
                <p className="font-medium">{userProfile.username}</p>
                <p className="text-gray-600 text-sm">ランク: {userProfile.rank}</p>
              </div>
            </div>
            <div className="flex-grow">
              <div className="bg-gray-100 rounded-full h-6 mb-2">
                <div
                  className="bg-indigo-600 h-6 rounded-full text-xs text-white flex items-center justify-center"
                  style={{ width: `${(userProfile.exp % 100)}%` }}
                >
                  {userProfile.exp % 100}%
                </div>
              </div>
              <div className="flex justify-between text-xs text-gray-600">
                <span>レベル {Math.floor(userProfile.exp / 100) + 1}</span>
                <span>次のレベルまで {100 - (userProfile.exp % 100)} EXP</span>
              </div>
            </div>
            <div>
              <Link
                href={`/profile/${userProfile.userId}`}
                className="bg-indigo-600 text-white px-4 py-2 rounded-md inline-block"
              >
                プロフィール詳細
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
