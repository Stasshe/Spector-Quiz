'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { useQuiz } from '@/context/QuizContext';
import { useQuizHook } from '@/hooks/useQuiz';
import { useQuizRoom } from '@/hooks/useQuizRoom';
import { genreClasses } from '@/constants/genres';
import { 
  FaBookOpen,
  FaGlobe, 
  FaCalculator, 
  FaGamepad, 
  FaTrophy, 
  FaChevronRight, 
  FaArrowRight, 
  FaPlus, 
  FaPlay,
  FaSearch, 
  FaFilter, 
  FaCheck 
} from 'react-icons/fa';

export default function QuizPage() {
  const { currentUser, userProfile } = useAuth();
  const { findOrCreateRoom } = useQuizRoom();
  const { fetchGenres, genres, units } = useQuizHook();
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [selectedClassTypes, setSelectedClassTypes] = useState<string[]>(['公式', 'ユーザー作成']);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // ジャンル情報を取得
    fetchGenres();
  }, [fetchGenres]);

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

  // ジャンル選択の切り替え
  const toggleGenreSelection = (genre: string) => {
    if (selectedGenres.includes(genre)) {
      setSelectedGenres(selectedGenres.filter(g => g !== genre));
    } else {
      setSelectedGenres([...selectedGenres, genre]);
    }
  };

  // クラスタイプ選択の切り替え
  const toggleClassTypeSelection = (classType: string) => {
    if (selectedClassTypes.includes(classType)) {
      if (selectedClassTypes.length > 1) { // 少なくとも1つは選択されている必要がある
        setSelectedClassTypes(selectedClassTypes.filter(t => t !== classType));
      }
    } else {
      setSelectedClassTypes([...selectedClassTypes, classType]);
    }
  };

  // クイズ作成ページに移動
  const navigateToCreateQuiz = () => {
    router.push('/quiz/create-quiz');
  };

  // ルーム作成ページに移動
  const navigateToCreateRoom = (genre: string, unit: string) => {
    router.push(`/quiz/create?genre=${encodeURIComponent(genre)}&unit=${encodeURIComponent(unit)}&classType=${encodeURIComponent(selectedClassTypes[0])}`);
  };

  // ルーム一覧ページに移動
  const navigateToRooms = (genre: string, unit: string) => {
    router.push(`/quiz/rooms?genre=${encodeURIComponent(genre)}&unit=${encodeURIComponent(unit)}&classType=${encodeURIComponent(selectedClassTypes[0])}`);
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
                <span>ランク: {userProfile.rank || 'ビギナー'}</span>
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
          
          <div className="flex gap-2">
            <Link
              href={`/profile/user?id=${userProfile.userId}`}
              className="btn-outline flex items-center"
            >
              プロフィール <FaChevronRight className="ml-2" />
            </Link>
            <button
              onClick={navigateToCreateQuiz}
              className="btn-primary flex items-center"
            >
              <FaPlus className="mr-2" /> クイズ作成
            </button>
          </div>
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
        <div className="card">
          {/* フィルタリングセクション */}
          <div className="mb-8">
            {/* ジャンル選択 */}
            <h2 className="text-xl font-semibold mb-4">ジャンル</h2>
            <div className="flex flex-wrap gap-3 mb-6">
              {genres.map((genre) => (
                <button
                  key={genre}
                  onClick={() => toggleGenreSelection(genre)}
                  className={`px-4 py-2 rounded-full border transition-all ${
                    selectedGenres.includes(genre)
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                      : 'border-gray-200 hover:border-indigo-200 text-gray-700'
                  }`}
                >
                  <div className="flex items-center">
                    {renderGenreIcon(genre)}
                    <span className="ml-2">{genre}</span>
                    {selectedGenres.includes(genre) && (
                      <FaCheck className="ml-2 text-indigo-500 text-sm" />
                    )}
                  </div>
                </button>
              ))}
              {genres.length === 0 && (
                <p className="text-gray-500">ジャンルが読み込まれていません</p>
              )}
            </div>

            {/* クラスタイプ選択 */}
            <h2 className="text-xl font-semibold mb-4">クラスタイプ</h2>
            <div className="flex flex-wrap gap-3">
              {['公式', 'ユーザー作成'].map((classType) => (
                <button
                  key={classType}
                  onClick={() => toggleClassTypeSelection(classType)}
                  className={`px-4 py-2 rounded-full border transition-all ${
                    selectedClassTypes.includes(classType)
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                      : 'border-gray-200 hover:border-indigo-200 text-gray-700'
                  }`}
                >
                  <div className="flex items-center">
                    {classType === '公式' ? 
                      <FaBookOpen className="text-blue-500" /> : 
                      <FaGamepad className="text-purple-500" />
                    }
                    <span className="ml-2">{classType}</span>
                    {selectedClassTypes.includes(classType) && (
                      <FaCheck className="ml-2 text-indigo-500 text-sm" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* クイズ一覧 */}
          <div>
            <h2 className="text-xl font-semibold mb-4">単元一覧</h2>
            
            {selectedGenres.length === 0 ? (
              <div className="text-center py-8 border border-dashed border-gray-300 rounded-md">
                <p className="text-gray-500">上部のジャンルボタンから選択してください</p>
              </div>
            ) : (
              <div className="space-y-6">
                {selectedGenres.map(genre => (
                  <div key={genre} className="mb-8">
                    <h3 className="text-lg font-medium mb-3 flex items-center">
                      {renderGenreIcon(genre)}
                      <span className="ml-2">{genre}</span>
                    </h3>
                    
                    {Object.entries(units[genre] || {}).map(([category, unitList]) => (
                      <div key={category} className="mb-6">
                        <h4 className="font-medium text-gray-700 mb-2">{category}</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                          {Array.isArray(unitList) ? unitList.map((unit: string) => (
                            <div 
                              key={unit} 
                              className="border border-gray-200 rounded-xl p-4 hover:border-indigo-200 hover:shadow-md transition-all duration-200"
                            >
                              <h5 className="font-medium mb-3 text-gray-800">{unit}</h5>
                              <div className="flex justify-between gap-2">
                                <button
                                  onClick={() => navigateToRooms(genre, unit)}
                                  className="flex-1 flex items-center justify-center p-2 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors duration-200"
                                >
                                  <FaSearch className="mr-2" /> 参加
                                </button>
                                <button
                                  onClick={() => navigateToCreateRoom(genre, unit)}
                                  className="flex-1 flex items-center justify-center p-2 rounded-lg bg-green-50 text-green-700 hover:bg-green-100 transition-colors duration-200"
                                >
                                  <FaPlus className="mr-2" /> 作成
                                </button>
                              </div>
                            </div>
                          )) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
