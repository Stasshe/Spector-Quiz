'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { genreClasses } from '@/constants/genres';
import { useQuizRoom } from '@/hooks/useQuizRoom';
import { 
  FaPlus, 
  FaSearch, 
  FaChevronRight, 
  FaTrophy, 
  FaBookOpen, 
  FaGlobe, 
  FaCalculator, 
  FaGamepad, 
  FaArrowRight 
} from 'react-icons/fa';

export default function QuizPage() {
  const { currentUser, userProfile } = useAuth();
  const { findOrCreateRoom } = useQuizRoom();
  const [selectedClassType, setSelectedClassType] = useState<string | null>(null);
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedUnit, setSelectedUnit] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // URLパラメータがあれば取得
  }, []);

  // アイコン定義
  const renderGenreIcon = (genreName: string) => {
    switch(genreName) {
      case '日本史':
        return <FaBookOpen className="text-amber-500" />;
      case '世界史':
        return <FaGlobe className="text-blue-500" />;
      case '数学':
        return <FaCalculator className="text-green-500" />;
      default:
        return <FaBookOpen className="text-indigo-500" />;
    }
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
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* クラス選択セクション */}
          <div className="lg:col-span-3">
            <div className="card">
              <h2 className="text-xl font-semibold mb-6 flex items-center">
                <FaGamepad className="mr-2 text-indigo-500" />
                クラスを選択
              </h2>
              <div className="space-y-3">
                {genreClasses.map((classType) => (
                  <button
                    key={classType.name}
                    className={`w-full p-4 rounded-xl border-2 text-left flex items-center transition-all duration-200 ${
                      selectedClassType === classType.name
                        ? 'border-indigo-500 bg-indigo-50 shadow-md'
                        : 'border-gray-200 hover:border-indigo-200 hover:bg-indigo-50'
                    }`}
                    onClick={() => {
                      setSelectedClassType(classType.name);
                      setSelectedGenre(null);
                      setSelectedCategory(null);
                      setSelectedUnit(null);
                    }}
                  >
                    <div className="w-10 h-10 rounded-lg bg-white shadow-sm flex items-center justify-center mr-3">
                      {classType.name === '公式' ? 
                        <FaBookOpen className="text-blue-500" /> : 
                        <FaGamepad className="text-purple-500" />}
                    </div>
                    <span className="font-medium">{classType.name}</span>
                    {selectedClassType === classType.name && (
                      <FaChevronRight className="ml-auto text-indigo-500" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ジャンル選択セクション */}
          <div className="lg:col-span-9">
            <div className="card h-full">
              {selectedClassType ? (
                <div>
                  <h2 className="text-xl font-semibold mb-6">
                    {selectedClassType === '公式' ? '公式クイズ' : 'ユーザー作成クイズ'}
                  </h2>
                  
                  {/* ジャンル選択 */}
                  {!selectedGenre ? (
                    <div>
                      <h3 className="text-lg font-medium mb-4">ジャンルを選択してください</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                        {genreClasses.find(c => c.name === selectedClassType)?.genres.map((genre) => (
                          <button
                            key={genre.name}
                            className="border border-gray-200 rounded-xl p-4 hover:border-indigo-200 hover:shadow-md transition-all duration-200"
                            onClick={() => setSelectedGenre(genre.name)}
                          >
                            <div className="flex items-center mb-2">
                              <div className="w-10 h-10 rounded-lg bg-white shadow-sm flex items-center justify-center mr-3">
                                {renderGenreIcon(genre.name)}
                              </div>
                              <h3 className="font-medium text-gray-800">{genre.name}</h3>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : !selectedCategory ? (
                    // カテゴリー選択（単元グループ）
                    <div>
                      <div className="flex items-center mb-4">
                        <button 
                          onClick={() => setSelectedGenre(null)} 
                          className="text-indigo-600 hover:text-indigo-800 mr-2"
                        >
                          &larr; 戻る
                        </button>
                        <h3 className="text-lg font-medium">{selectedGenre}のカテゴリーを選択</h3>
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                        {Object.keys(genreClasses
                          .find(c => c.name === selectedClassType)?.genres
                          .find(g => g.name === selectedGenre)?.subgenres || {})
                          .map((category) => (
                            <button
                              key={category}
                              className="border border-gray-200 rounded-xl p-4 hover:border-indigo-200 hover:shadow-md transition-all duration-200"
                              onClick={() => setSelectedCategory(category)}
                            >
                              <h3 className="font-medium text-gray-800">{category}</h3>
                            </button>
                          ))}
                      </div>
                    </div>
                  ) : (
                    // 単元選択と参加/作成ボタン
                    <div>
                      <div className="flex items-center mb-4">
                        <button 
                          onClick={() => setSelectedCategory(null)} 
                          className="text-indigo-600 hover:text-indigo-800 mr-2"
                        >
                          &larr; 戻る
                        </button>
                        <h3 className="text-lg font-medium">{selectedGenre} - {selectedCategory}の単元を選択</h3>
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                        {genreClasses
                          .find(c => c.name === selectedClassType)?.genres
                          .find(g => g.name === selectedGenre)?.subgenres[selectedCategory]
                          .map((unit) => (
                            <div 
                              key={unit} 
                              className="border border-gray-200 rounded-xl p-4 hover:border-indigo-200 hover:shadow-md transition-all duration-200"
                            >
                              <h3 className="font-medium mb-3 text-gray-800">{unit}</h3>
                              <div className="flex flex-col gap-2">
                                <button
                                  onClick={async () => {
                                    setLoading(true);
                                    try {
                                      const result = await findOrCreateRoom(selectedGenre, unit, selectedClassType);
                                      if (result) {
                                        // ルームが見つかったか作成された場合、そのルームページに移動
                                        // router.push は findOrCreateRoom 内で処理されています
                                      }
                                    } catch (error) {
                                      console.error("Error finding or creating room:", error);
                                    } finally {
                                      setLoading(false);
                                    }
                                  }}
                                  className="flex items-center justify-between p-3 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors duration-200"
                                >
                                  <span className="font-medium">参加する</span>
                                  <FaSearch />
                                </button>
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center min-h-[300px] py-12">
                  <div className="w-20 h-20 bg-indigo-100 rounded-full flex items-center justify-center mb-6 animate-pulse">
                    <FaArrowRight className="transform -rotate-90 lg:rotate-0 text-xl text-indigo-500" />
                  </div>
                  <p className="text-gray-500 text-lg mb-2">クラスを選択してください</p>
                  <p className="text-gray-400 text-sm">左側から公式クイズかユーザー作成クイズを選んでください</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
