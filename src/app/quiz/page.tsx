'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { useQuiz } from '@/context/QuizContext';
import { useQuizHook } from '@/hooks/useQuiz';
import { useQuizRoom } from '@/hooks/useQuizRoom';
import { getUnitIdByName } from '@/services/quizRoom';
import { genreClasses } from '@/constants/genres';
import RoomSwitchConfirmModal from '@/components/layout/RoomSwitchConfirmModal';
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
  FaCheck,
  FaSort,
  FaUsers,
  FaSortAmountDown,
  FaClock
} from 'react-icons/fa';
import { RoomListing } from '@/types/room';
import { motion, AnimatePresence } from 'framer-motion';

export default function QuizPage() {
  const { currentUser, userProfile } = useAuth();
  const { 
    findOrCreateNewRoom, 
    fetchRoomList, 
    joinExistingRoom: joinRoom,
    confirmRoomSwitch,
    currentWaitingRoomId,
    setConfirmRoomSwitch,
    setRoomToJoin
  } = useQuizRoom();
  const { fetchGenres, fetchUnitsForGenre, genres, units } = useQuizHook();
  const [selectedGenre, setSelectedGenre] = useState<string>("");
  const [selectedClassType, setSelectedClassType] = useState<string>("公式");
  const [loading, setLoading] = useState(false);
  const [waitingRooms, setWaitingRooms] = useState<RoomListing[]>([]);
  const [sortBy, setSortBy] = useState<'participants' | 'popularity' | 'newest'>('participants');
  const router = useRouter();

  const [waitingRoomsLastFetch, setWaitingRoomsLastFetch] = useState(0);

  // ジャンル変更時に対応する単元データをロード
  const handleGenreChange = (genre: string) => {
    setSelectedGenre(genre);
    
    // 選択されたジャンルの単元がまだロードされていなければロード
    // クラスタイプを考慮したキーを使用
    if (!units[`${genre}_${selectedClassType}`]) {
      fetchUnitsForGenre(genre, selectedClassType);
    }
  };


  useEffect(() => {
    // ジャンル情報を取得
    fetchGenres();

    // ジャンルが読み込まれたら最初のジャンルを選択
    if (genres.length > 0 && !selectedGenre) {
      handleGenreChange(genres[0]);
    }
  }, [fetchGenres, genres, selectedGenre, handleGenreChange]);

  // クラスタイプが変更されたときに単元データを再取得
  useEffect(() => {
    if (selectedGenre) {
      // 選択されたクラスタイプの単元データを取得
      if (!units[`${selectedGenre}_${selectedClassType}`]) {
        fetchUnitsForGenre(selectedGenre, selectedClassType);
      }
    }
  }, [selectedClassType, selectedGenre, fetchUnitsForGenre, units]);

  // 選択されたジャンルが変更されたときに待機中のルームを取得
  useEffect(() => {
    if (selectedGenre) {
      fetchWaitingRooms();
    }
  }, [selectedGenre, selectedClassType]);

  // 定期的なルーム情報更新 (60秒ごと)
  useEffect(() => {
    // 初回フェッチはジャンル変更時のuseEffectで行う
    
    // 60秒ごとに更新
    const interval = setInterval(() => {
      if (selectedGenre) {
        fetchWaitingRooms();
      }
    }, 60000); // 60秒間隔
    
    return () => clearInterval(interval);
  }, [selectedGenre]);

  // 待機中のルームを取得
  const fetchWaitingRooms = async () => {
    if (!selectedGenre) return;
    
    // 最後のフェッチから3秒以内は重複フェッチを防止
    const now = Date.now();
    if (now - waitingRoomsLastFetch < 3000) {
      return;
    }
    
    setLoading(true);
    setWaitingRoomsLastFetch(now);
    const rooms = await fetchRoomList(selectedGenre, selectedClassType);
    setWaitingRooms(rooms);
    setLoading(false);
  };

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

  // クイズ作成ページに移動
  const navigateToCreateQuiz = () => {
    router.push('/quiz/create-quiz');
  };

  // 既存のルームに参加
  const joinExistingRoom = async (roomId: string) => {
    try {
      setLoading(true);
      
      console.log(`[page.joinExistingRoom] ルーム参加開始: ${roomId}`);
      
      // useQuizRoomのjoinExistingRoomに委譲する
      const joined = await joinRoom(roomId);
      
      // joinRoomがfalseを返した場合、確認ダイアログが表示されているか、エラーが発生した可能性がある
      if (!joined) {
        console.log('[page.joinExistingRoom] ルーム参加が完了していません（確認待ちまたはエラー）');
        
        // 確認ダイアログが表示されているかチェック
        if (confirmRoomSwitch) {
          console.log('[page.joinExistingRoom] 確認ダイアログが表示されています。処理を続行します');
          // 確認ダイアログが表示されている場合はローディング状態を維持
        } else {
          // 確認ダイアログが表示されていない場合はローディング状態を解除
          setLoading(false);
        }
        return;
      }
      
      if (joined) {
        console.log(`[page.joinExistingRoom] ルーム参加成功、ルームページへ移動: ${roomId}`);
        router.push(`/quiz/room?id=${roomId}`);
      } else {
        throw new Error('ルームへの参加に失敗しました');
      }
    } catch (err) {
      console.error('[page.joinExistingRoom] エラー:', err);
      alert(`エラーが発生しました: ${err instanceof Error ? err.message : '不明なエラー'}`);
    } finally {
      if (!confirmRoomSwitch) {
        setLoading(false);
      }
    }
  };

  // 単元でプレイする
  const playWithUnit = async (genre: string, unit: string) => {
    try {
      setLoading(true);
      
      try {
        // 単元名からUnitIDを取得（選択中のクラスタイプを渡す）
        const unitId = await getUnitIdByName(genre, unit, selectedClassType);
        
        if (!unitId) {
          throw new Error(`単元「${unit}」のIDの取得に失敗しました。管理者に連絡してください。`);
        }
        
        // 現在待機中のルームがある場合はfindOrCreateNewRoomに任せて、
        // そちらでルーム切り替え確認を表示する
        // 直接findOrCreateNewRoomを呼び出して処理を統一する
        const result = await findOrCreateNewRoom(`${genre} Study Room`, genre, selectedClassType, unitId);
        
        // resultがnullの場合、確認ダイアログが表示されている可能性がある
        if (result === null) {
          console.log('[playWithUnit] ルーム切り替え確認が必要な可能性があります');
          setLoading(false);
          return;
        }
        
        // 結果がnullの場合（処理失敗）
        if (!result) {
          throw new Error('ルームの作成または参加に失敗しました');
        }
      } catch (innerErr) {
        // 内部エラーを外部エラーとして再スロー
        throw innerErr;
      }
    } catch (err) {
      console.error('Error finding or joining room:', err);
      
      // より具体的なエラーメッセージを表示
      if (err instanceof Error) {
        // エラーメッセージに「単元」が含まれる場合は単元関連のエラー
        if (err.message.includes('単元')) {
          alert(`単元エラー: ${err.message}`);
        } 
        // エラーメッセージに「クイズ」が含まれる場合はクイズ関連のエラー
        else if (err.message.includes('クイズ')) {
          alert(`クイズエラー: ${err.message}`);
        }
        // その他のエラー
        else {
          alert(`ルーム作成エラー: ${err.message}`);
        }
      } else {
        alert('予期しないエラーが発生しました。しばらく経ってから再度お試しください。');
      }
    } finally {
      if (!confirmRoomSwitch) {
        setLoading(false);
      }
    }
  };

  // ルーム一覧をソート
  const sortedRooms = useMemo(() => {
    if (!waitingRooms.length) return [];
    
    return [...waitingRooms].sort((a, b) => {
      if (sortBy === 'participants') {
        return b.participantCount - a.participantCount;
      } else if (sortBy === 'popularity') {
        // 仮で参加者数でソート（本来は人気度の指標があるはず）
        return b.participantCount - a.participantCount;
      } else {
        // 最新順 - roomIdは時間的に増加するはずなので仮の実装
        return b.roomId.localeCompare(a.roomId);
      }
    });
  }, [waitingRooms, sortBy]);

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

  // 単元ごとの待機中ルーム数を計算する関数
  const getWaitingRoomCountForUnit = (unitName: string) => {
    if (!waitingRooms.length) return 0;
    
    // 単元名が完全に一致するルームをカウント（より正確）
    return waitingRooms.filter(room => room.unitName === unitName).length;
  };

  // 単元ごとの待機中人数の合計を計算
  const getWaitingPlayersForUnit = (unitName: string) => {
    if (!waitingRooms.length) return 0;
    
    // 単元名が一致するルームの参加者合計をカウント
    return waitingRooms
      .filter(room => room.unitName === unitName)
      .reduce((total, room) => total + room.participantCount, 0);
  };

  return (
    <div className="app-container py-8">
      {/* RoomSwitchConfirmModalはlayout.tsxに配置されているため、ここでは不要 */}
      
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
              href={`/profile/user?id=${currentUser.uid}`}
              className="btn-outline flex items-center"
            >
              プロフィール <FaChevronRight className="ml-2" />
            </Link>
            <div className="flex flex-col sm:flex-row gap-2">
              <Link
                href="/quiz/my-units"
                className="btn-outline flex items-center justify-center"
              >
                マイ単元一覧
              </Link>
              <button
                onClick={navigateToCreateQuiz}
                className="btn-primary flex items-center"
              >
                <FaPlus className="mr-2" /> クイズ作成
              </button>
            </div>
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
          {/* ジャンル選択タブ */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4">ジャンル</h2>
            <div className="flex overflow-x-auto space-x-2 pb-2 mb-4 border-b border-gray-200">
              {genres.map((genre) => (
                <button
                  key={genre}
                  onClick={() => handleGenreChange(genre)}
                  className={`px-6 py-2 whitespace-nowrap rounded-t-lg transition-all ${
                    selectedGenre === genre
                      ? 'bg-indigo-100 text-indigo-700 font-medium border-b-2 border-indigo-500'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center">
                    {renderGenreIcon(genre)}
                    <span className="ml-2">{genre}</span>
                  </div>
                </button>
              ))}
              {genres.length === 0 && (
                <p className="text-gray-500 p-2">ジャンルが読み込まれていません</p>
              )}
            </div>

            {/* クラスタイプ選択 */}
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-xl font-semibold mb-2">クラスタイプ</h2>
                <div className="flex space-x-3">
                  {['公式', 'ユーザー作成'].map((classType) => (
                    <button
                      key={classType}
                      onClick={() => setSelectedClassType(classType)}
                      className={`px-4 py-2 rounded-full border transition-all ${
                        selectedClassType === classType
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
                      </div>
                    </button>
                  ))}
                </div>
              </div>
              
              {/* 並べ替え */}
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-600">並び替え:</span>
                <div className="flex border rounded-lg overflow-hidden">
                  <button
                    onClick={() => setSortBy('participants')}
                    className={`px-3 py-1 text-sm ${sortBy === 'participants' ? 'bg-indigo-100 text-indigo-700' : 'bg-white'}`}
                    title="参加者数順"
                  >
                    <FaUsers />
                  </button>
                  <button
                    onClick={() => setSortBy('popularity')}
                    className={`px-3 py-1 text-sm ${sortBy === 'popularity' ? 'bg-indigo-100 text-indigo-700' : 'bg-white'}`}
                    title="人気順"
                  >
                    <FaSortAmountDown />
                  </button>
                  <button
                    onClick={() => setSortBy('newest')}
                    className={`px-3 py-1 text-sm ${sortBy === 'newest' ? 'bg-indigo-100 text-indigo-700' : 'bg-white'}`}
                    title="最新順"
                  >
                    <FaClock />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* 待機中のルーム一覧 */}
          {selectedGenre && waitingRooms.length > 0 && (
            <div className="mb-8">
              <h2 className="text-xl font-semibold mb-4">
                <span className="flex items-center text-indigo-600">
                  <FaGamepad className="mr-2" /> 
                  待機中のルーム
                  <span className="ml-2 text-sm bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">
                    {waitingRooms.length}個
                  </span>
                </span>
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {sortedRooms.map(room => (
                  <motion.div
                    key={room.roomId}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className="border border-indigo-100 bg-indigo-50 rounded-xl p-4 hover:shadow-md transition-all"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <h3 className="font-medium text-indigo-800">{room.name}</h3>
                      <span className="bg-green-100 text-green-700 text-xs px-2 py-1 rounded-full flex items-center">
                        <FaUsers className="mr-1" /> {room.participantCount}/8
                      </span>
                    </div>
                    <div className="flex justify-end mt-2">
                      <button
                        onClick={() => joinExistingRoom(room.roomId)}
                        className="w-full flex items-center justify-center p-2 rounded-lg bg-indigo-500 text-white hover:bg-indigo-600 transition-colors"
                      >
                        <FaPlay className="mr-2" /> 参加する
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* 単元一覧 */}
          <AnimatePresence mode="wait">
            {selectedGenre && (
              <motion.div
                key={selectedGenre}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
              >
                <h2 className="text-xl font-semibold mb-4">単元一覧</h2>
                
                <div className="space-y-6">
                  <div className="mb-8">
                    <h3 className="text-lg font-medium mb-3 flex items-center">
                      {renderGenreIcon(selectedGenre)}
                      <span className="ml-2">{selectedGenre}</span>
                    </h3>
                    
                    {/* クラスタイプを考慮したキーフォーマットを使用 */}
                    {Object.entries(units[`${selectedGenre}_${selectedClassType}`] || {}).map(([category, unitList]) => (
                      <div key={category} className="mb-6">
                        <h4 className="font-medium text-gray-700 mb-2">{category}</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">{
                            Array.isArray(unitList) ? (
                            // 配列の場合（期待される形式）
                            unitList.map((unit: string) => {
                              const waitingRoomCount = getWaitingRoomCountForUnit(unit);
                              const waitingPlayerCount = getWaitingPlayersForUnit(unit);
                              
                              return (
                              <div 
                                key={unit} 
                                className={`border ${waitingRoomCount > 0 ? 'border-green-200 bg-green-50' : 'border-gray-200'} rounded-xl p-4 hover:border-indigo-200 hover:shadow-md transition-all duration-200`}
                              >
                                <div className="flex justify-between items-start mb-3">
                                  <h5 className="font-medium text-gray-800">{unit}</h5>
                                  {waitingRoomCount > 0 && (
                                    <span className="bg-green-100 text-green-700 text-xs px-2 py-1 rounded-full flex items-center">
                                      <FaUsers className="mr-1" /> {waitingPlayerCount}人待機中
                                    </span>
                                  )}
                                </div>
                                <div className="flex justify-center">
                                  <button
                                    onClick={() => playWithUnit(selectedGenre, unit)}
                                    className="w-full flex items-center justify-center p-2 rounded-lg bg-indigo-500 text-white hover:bg-indigo-600 transition-colors"
                                  >
                                    <FaPlay className="mr-2" /> {waitingRoomCount > 0 ? '参加する' : 'プレイする'}
                                  </button>
                                </div>
                              </div>
                            )})
                          ) : typeof unitList === 'object' && unitList !== null ? (
                            // オブジェクトの場合（代替フォーマット）
                            Object.keys(unitList).map((unitKey) => {
                              const unit = unitKey;
                              const waitingRoomCount = getWaitingRoomCountForUnit(unit);
                              const waitingPlayerCount = getWaitingPlayersForUnit(unit);
                              
                              return (
                              <div 
                                key={unit} 
                                className={`border ${waitingRoomCount > 0 ? 'border-green-200 bg-green-50' : 'border-gray-200'} rounded-xl p-4 hover:border-indigo-200 hover:shadow-md transition-all duration-200`}
                              >
                                <div className="flex justify-between items-start mb-3">
                                  <h5 className="font-medium text-gray-800">{unit}</h5>
                                  {waitingRoomCount > 0 && (
                                    <span className="bg-green-100 text-green-700 text-xs px-2 py-1 rounded-full flex items-center">
                                      <FaUsers className="mr-1" /> {waitingPlayerCount}人待機中
                                    </span>
                                  )}
                                </div>
                                <div className="flex justify-center">
                                  <button
                                    onClick={() => playWithUnit(selectedGenre, unit)}
                                    className="w-full flex items-center justify-center p-2 rounded-lg bg-indigo-500 text-white hover:bg-indigo-600 transition-colors"
                                  >
                                    <FaPlay className="mr-2" /> {waitingRoomCount > 0 ? '参加する' : 'プレイする'}
                                  </button>
                                </div>
                              </div>
                            )})
                          ) : (
                            // どちらでもない場合はエラーメッセージを表示
                            <div className="col-span-3 p-4 bg-red-50 border border-red-200 rounded-lg">
                              <p className="text-red-600">単元データが正しく読み込まれませんでした。更新してください。</p>
                              <p className="text-gray-500 text-sm">受信データ型: {typeof unitList}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
