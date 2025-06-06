'use client';

import AnswerInput from '@/components/quiz/AnswerInput';
import QuizQuestion from '@/components/quiz/QuizQuestion';
import QuizResult from '@/components/quiz/QuizResult';
import ScoreBoard from '@/components/quiz/ScoreBoard';
import { useAuth } from '@/hooks/useAuth';
import { useLeader, judgeCorrectness } from '@/hooks/useLeader';
import { useQuiz } from '@/hooks/useQuiz';
import { useQuizRoom } from '@/hooks/useQuizRoom';
import { AnimatePresence, motion } from 'framer-motion';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { FaSignOutAlt } from 'react-icons/fa';

// ローディングフォールバックコンポーネント
function QuizRoomLoading() {
  return (
    <div className="flex justify-center items-center min-h-[calc(100vh-64px)]">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
    </div>
  );
}

// クイズルームのメインコンテンツコンポーネント
function QuizRoomContent() {
  const { currentUser } = useAuth();
  const params = useSearchParams();
  const roomId = params.get('id') || '';
  const router = useRouter();
  const { quizRoom, isLeader, currentQuiz, hasAnsweringRight, setHasAnsweringRight } = useQuiz();
  const { useRoomListener, exitRoom } = useQuizRoom();
  const { startQuizGame, handleBuzzer, submitAnswer, fetchCurrentQuiz } = useLeader(roomId);
  
  // ユーザーが現在のクイズで不正解したかどうかを追跡
  const [hasFailedCurrentQuiz, setHasFailedCurrentQuiz] = useState(false);
  
  // ルームデータをリアルタイム監視
  const room = useRoomListener(roomId);

  // 途中復帰時の現在クイズ復旧処理
  useEffect(() => {
    // ルーム情報とユーザー情報が揃った時のみ実行
    if (!room || !currentUser || room.status !== 'in_progress') {
      return;
    }
    
    // currentQuizが設定されていない（途中復帰）かつ、進行中のクイズがある場合
    if (!currentQuiz && room.currentState?.quizId) {
      console.log('[QuizRoomPage] 途中復帰を検出 - 現在のクイズを復旧します');
      console.log(`[QuizRoomPage] 復旧対象: QuizID=${room.currentState.quizId}, QuizIndex=${room.currentQuizIndex}`);
      
      // 現在のクイズを取得
      if (fetchCurrentQuiz) {
        fetchCurrentQuiz(room.currentQuizIndex).then(() => {
          console.log('[QuizRoomPage] 現在のクイズの復旧が完了しました');
        }).catch((error: any) => {
          console.error('[QuizRoomPage] 現在のクイズの復旧に失敗しました:', error);
        });
      }
    }
  }, [room, currentUser, currentQuiz, fetchCurrentQuiz]);

  // リダイレクトループ防止
  useEffect(() => {
    // このページにいることを明示的に記録
    console.log('[QuizRoomPage] ページロード - クイズルームフラグを設定');
    
    // グローバルフラグとして設定（window経由で他のコンポーネントからもアクセス可能）
    if (typeof window !== 'undefined') {
      // クイズルームページにいることを示すフラグ
      window.inQuizRoomPage = true;
      
      // エラー検出用のグローバルエラーハンドラを追加
      const originalOnError = window.onerror;
      window.onerror = function(message, source, lineno, colno, error) {
        // クイズが見つからないエラーを検出
        if (message && (
          message.toString().includes('クイズが見つかりません') || 
          message.toString().includes('Error fetching quiz')
        )) {
          console.log('[QuizRoomPage] クイズ取得エラーを検出しました:', message);
          window.quizErrorTimestamp = Date.now();
          
          // URLパラメータから公式クイズフラグをチェック
          const searchParams = new URLSearchParams(window.location.search);
          const isOfficial = searchParams.get('official') === 'true';
          
          // 公式クイズフラグを設定
          window.isOfficialQuiz = isOfficial || params.get('official') === 'true';
          console.log(`[QuizRoomPage] 公式クイズフラグ設定: ${window.isOfficialQuiz}`);
        }
        
        // 元のエラーハンドラを呼び出し
        if (originalOnError) {
          return originalOnError.apply(this, arguments as any);
        }
        return false;
      };
      
    }
    
    console.log('[QuizRoomPage] クイズルームページにロード/マウント完了');
    
    return () => {
      // クリーンアップ時にフラグをリセット
      if (typeof window !== 'undefined') {
        console.log('[QuizRoomPage] ページアンマウント - クイズルームフラグをクリア');
        window.inQuizRoomPage = false;
      }
      console.log('[QuizRoomPage] クイズルームページからアンマウント');
    };
  }, []);

  // ルームからの退出処理
  const handleLeaveRoom = async () => {
    if (roomId) {
      await exitRoom(roomId);
      router.push('/quiz');
    }
  };

  // displayRoomの計算（roomが存在する場合のみ）
  const displayRoom = room ? (quizRoom || room) : null;

  // デバッグ: currentQuizとisRevealedの状態を監視
  useEffect(() => {
    if (!displayRoom) return;
    
    console.log('[QuizRoomPage] 状態変更:', {
      currentQuiz: currentQuiz ? `${currentQuiz.quizId}` : 'null',
      isRevealed: displayRoom.currentState?.isRevealed,
      roomStatus: displayRoom.status,
      currentQuizIndex: displayRoom.currentQuizIndex,
      answerStatus: displayRoom.currentState?.answerStatus,
      currentAnswerer: displayRoom.currentState?.currentAnswerer,
      hasAnsweringRight: hasAnsweringRight,
      isRestoredFromMidway: !currentQuiz && displayRoom.status === 'in_progress' && displayRoom.currentState?.quizId,
      hasFailedCurrentQuiz: hasFailedCurrentQuiz
    });
  }, [currentQuiz, displayRoom?.currentState?.isRevealed, displayRoom?.status, displayRoom?.currentQuizIndex, displayRoom?.currentState?.answerStatus, displayRoom?.currentState?.currentAnswerer, hasAnsweringRight, hasFailedCurrentQuiz]);

  // クイズインデックスが変わったら間違えフラグをリセット
  useEffect(() => {
    if (displayRoom && displayRoom.status === 'in_progress') {
      // 問題が切り替わったら間違えフラグをリセット
      setHasFailedCurrentQuiz(false);
      console.log('[QuizRoomPage] 新しい問題に進んだため間違えフラグをリセットしました');
    }
  }, [displayRoom?.currentQuizIndex]);

  // 認証とルーム情報のチェック（すべてのフック呼び出しの後）
  useEffect(() => {
    // ユーザーがログインしていない場合は、ログインページにリダイレクト
    if (!currentUser) {
      router.push('/auth/login');
      return;
    }
    
    // roomIdがない場合はクイズホームにリダイレクト
    if (!roomId) {
      router.push('/quiz');
    }
  }, [currentUser, roomId, router]);

  // 不正解状態の検知（すべてのフックはearly returnの前に配置）
  useEffect(() => {
    if (!displayRoom || !currentUser) return;
    
    // 不正解かつ自分が回答者の場合、間違えフラグを設定
    const isIncorrect = displayRoom.currentState?.answerStatus === 'incorrect';
    const isRevealed = displayRoom.currentState?.isRevealed;
    
    if (isIncorrect && 
        displayRoom.currentState?.currentAnswerer === currentUser.uid && 
        !isRevealed) {
      console.log('[QuizRoomPage] 不正解を検出しました。間違えフラグを設定します');
      setHasFailedCurrentQuiz(true);
    }
  }, [displayRoom, currentUser]);

  // 回答権の状態を監視
  useEffect(() => {
    if (!room || !currentUser) {
      return;
    }
    
    const currentAnswerer = room.currentState?.currentAnswerer;
    const hasRight = currentAnswerer === currentUser.uid;
    
    // 状態が変更された場合のみログ出力と更新
    if (hasRight !== hasAnsweringRight) {
      console.log(`[QuizRoomPage] 回答権状態変更: ${hasAnsweringRight} -> ${hasRight}`);
      console.log(`[QuizRoomPage] 現在の回答者: ${currentAnswerer}, 自分のUID: ${currentUser.uid}`);
      setHasAnsweringRight(hasRight);
    }
  }, [room, currentUser, hasAnsweringRight, setHasAnsweringRight]);

  // ルーム情報が読み込まれていない場合のローディング表示
  if (!room) {
    return (
      <div className="flex justify-center items-center min-h-[calc(100vh-64px)]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }
  
  // displayRoomが存在しない場合は早期リターン
  if (!displayRoom) {
    return (
      <div className="flex justify-center items-center min-h-[calc(100vh-64px)]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  // 正解/不正解の状態
  const isCorrect = displayRoom.currentState?.answerStatus === 'correct';
  const isIncorrect = displayRoom.currentState?.answerStatus === 'incorrect';
  const isRevealed = displayRoom.currentState?.isRevealed;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* ヘッダー代わりのシンプルなナビゲーション - 高さ固定 */}
      <div className="bg-white shadow-sm border-b flex-shrink-0">
        <div className="container mx-auto px-4 py-2 flex justify-between items-center h-12">
          <h1 className="text-base font-bold text-gray-800 truncate">{displayRoom.name}</h1>
          <button
            onClick={handleLeaveRoom}
            className="bg-red-600 text-white px-3 py-1.5 rounded-lg flex items-center hover:bg-red-700 transition-colors text-sm"
          >
            <FaSignOutAlt className="mr-1" /> 退出
          </button>
        </div>
      </div>

      {/* メインコンテンツエリア - 残りの高さを使用し、スクロール可能 */}
      <div className="flex-1 container mx-auto px-3 py-2 overflow-y-auto">
        <div className="flex flex-col gap-3">
          {/* スコアボード - 横並びで上部に配置 */}
          <div className="bg-white rounded-xl shadow-md p-3 flex-shrink-0">
            <ScoreBoard participants={displayRoom.participants || {}} isHorizontal />
          </div>

          {/* クイズエリア - 自動サイズ調整 */}
          <div className="bg-white rounded-xl shadow-md p-3 flex-shrink-0">
              <AnimatePresence mode="wait">
                {/* 待機中の場合 */}
                {displayRoom.status === 'waiting' && (
                  <motion.div
                    key="waiting"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.5 }}
                    className="text-center py-12"
                  >
                    {isLeader ? (
                      <div className="space-y-6">
                        <div className="text-2xl font-bold text-gray-800 mb-4">
                          ゲーム開始準備
                        </div>
                        <p className="text-gray-600 mb-8">
                          参加者が集まったらゲームを開始できます
                        </p>
                        <button
                          onClick={startQuizGame}
                          className="bg-indigo-600 text-white px-8 py-4 rounded-xl text-lg font-medium hover:bg-indigo-700 transition-colors shadow-lg"
                        >
                          ゲーム開始
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        <div className="text-2xl font-bold text-gray-800 mb-4">
                          ゲーム開始をお待ちください
                        </div>
                        <p className="text-gray-600">
                          ルームリーダーがゲームを開始するまでお待ちください
                        </p>
                        <div className="animate-pulse text-indigo-600">
                          準備中...
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}

                {/* 進行中の場合 */}
                {displayRoom.status === 'in_progress' && (
                  <motion.div
                    key={`quiz-${displayRoom.currentQuizIndex}`}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 1.05 }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                    className="quiz-game-area"
                  >
                    {currentQuiz ? (
                      <QuizQuestion 
                        quiz={currentQuiz} 
                        isAnswerRevealed={isRevealed}
                      />
                    ) : (
                      <div className="text-center py-12">
                        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500 mx-auto mb-4"></div>
                        <p className="text-gray-600">クイズを読み込み中...</p>
                      </div>
                    )}
                    
                    {/* ブザーエリア */}
                    {currentQuiz && !isRevealed && !hasAnsweringRight && !hasFailedCurrentQuiz && 
                     (displayRoom.currentState?.answerStatus === 'waiting' ||
                      displayRoom.currentState?.answerStatus === 'waiting_for_buzz' ||
                      displayRoom.currentState?.answerStatus === 'incorrect') && (
                      <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3, duration: 0.4 }}
                        className="mt-4 text-center"
                      >
                        <button
                          onClick={() => {
                            console.log(`ブザー押下: answerStatus=${displayRoom.currentState?.answerStatus}, hasAnsweringRight=${hasAnsweringRight}, currentAnswerer=${displayRoom.currentState?.currentAnswerer}`);
                            handleBuzzer();
                          }}
                          className="buzzer-button"
                        >
                          押す！
                        </button>
                      </motion.div>
                    )}
                    
                    {/* すでに間違えた場合のメッセージ（ブザーの代わりに表示） */}
                    {currentQuiz && !isRevealed && !hasAnsweringRight && hasFailedCurrentQuiz && 
                     (displayRoom.currentState?.answerStatus === 'waiting' ||
                      displayRoom.currentState?.answerStatus === 'waiting_for_buzz' ||
                      displayRoom.currentState?.answerStatus === 'incorrect') && (
                      <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3, duration: 0.4 }}
                        className="mt-4 text-center"
                      >
                        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                          <div className="flex items-center justify-center space-x-2">
                            <span className="text-gray-700">
                              すでに不正解のため、この問題ではブザーを押せません
                            </span>
                          </div>
                        </div>
                      </motion.div>
                    )}
                    
                    {/* 回答中の状態表示 */}
                    {currentQuiz && !hasAnsweringRight && 
                     displayRoom.currentState?.answerStatus === 'answering_in_progress' && 
                     displayRoom.currentState?.currentAnswerer && (
                      <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4 }}
                        className="mt-4 text-center"
                      >
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                          <div className="flex items-center justify-center space-x-2">
                            <div className="animate-pulse">
                              <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                            </div>
                            <span className="text-blue-700 font-medium">
                              {displayRoom.participants[displayRoom.currentState?.currentAnswerer || '']?.username || 'プレイヤー'}さんが回答中です
                            </span>
                            <div className="animate-pulse">
                              <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                    
                    {/* 間違えた時のメッセージ表示 */}
                    {isIncorrect && !isRevealed && displayRoom.currentState?.currentAnswerer && (
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4 }}
                        className="mt-4 text-center"
                      >
                        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                          <div className="flex items-center justify-center space-x-2">
                            <span className="text-red-700 font-medium">
                              {displayRoom.participants[displayRoom.currentState?.currentAnswerer || '']?.username || 'プレイヤー'}さんは間違えました
                            </span>
                          </div>
                        </div>
                      </motion.div>
                    )}
                    
                    {/* 回答エリア */}
                    {hasAnsweringRight && !isRevealed && 
                     displayRoom.currentState?.answerStatus === 'answering_in_progress' && (
                      <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4 }}
                        className="mt-4"
                      >
                        <AnswerInput
                          quiz={currentQuiz}
                          onSubmit={async (answer) => {
                            try {
                              // 回答を送信
                              await submitAnswer(answer);
                              
                              // currentQuizがnullでないことを確認
                              if (currentQuiz) {
                                // 正誤をチェックして結果に応じた処理
                                const isCorrect = judgeCorrectness(currentQuiz, answer);
                                
                                // 不正解の場合、ローカルの状態を更新
                                if (!isCorrect) {
                                  console.log('[QuizRoomPage] 不正解のため、ローカルの間違えフラグを設定します');
                                  setHasFailedCurrentQuiz(true);
                                }
                              }
                            } catch (error) {
                              console.error('[QuizRoomPage] 回答送信中にエラーが発生しました:', error);
                            }
                          }}
                          onTimeout={async () => {
                            try {
                              console.log('[QuizRoomPage] 回答制限時間切れ - 強制的に不正解処理');
                              // 時間切れの場合、空の回答で強制送信（不正解扱い）
                              await submitAnswer('');
                              
                              // ローカルの間違えフラグを設定
                              console.log('[QuizRoomPage] 時間切れのため、ローカルの間違えフラグを設定します');
                              setHasFailedCurrentQuiz(true);
                            } catch (error) {
                              console.error('[QuizRoomPage] 時間切れ処理中にエラーが発生しました:', error);
                            }
                          }}
                        />
                      </motion.div>
                    )}
                    
                    {/* 正答表示 */}
                    {isRevealed && currentQuiz && (
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                        className="mt-4"
                      >
                        <QuizResult
                          quiz={currentQuiz}
                          isCorrect={isCorrect}
                          answererId={displayRoom.currentState?.currentAnswerer || ''}
                          participants={displayRoom.participants || {}}
                        />
                      </motion.div>
                    )}
                  </motion.div>
                )}

                {/* 完了の場合 */}
                {displayRoom.status === 'completed' && (
                  <motion.div
                    key="completed"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.5 }}
                    className="text-center py-12"
                  >
                    <div className="text-3xl font-bold text-gray-800 mb-6">
                      🎉 ゲーム終了！
                    </div>
                    <p className="text-gray-600 mb-8">
                      お疲れ様でした！最終結果をご確認ください。
                    </p>
                    <div className="bg-gray-50 rounded-xl p-6 mb-8">
                      <h3 className="text-xl font-bold mb-4">最終スコア</h3>
                      <ScoreBoard participants={displayRoom.participants || {}} />
                    </div>
                    <button
                      onClick={handleLeaveRoom}
                      className="bg-indigo-600 text-white px-8 py-4 rounded-xl text-lg font-medium hover:bg-indigo-700 transition-colors shadow-lg"
                    >
                      ホームに戻る
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

          {/* クイズ進行状況 */}
          {displayRoom.status === 'in_progress' && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="bg-white rounded-xl shadow-md p-3 flex-shrink-0"
            >
              <div className="flex items-center justify-between text-xs text-gray-600">
                <span>進行状況</span>
                <span>{displayRoom.currentQuizIndex + 1} / {displayRoom.totalQuizCount || 0}</span>
              </div>
              <div className="progress-container mt-1">
                <motion.div 
                  className="progress-bar bg-indigo-600"
                  initial={{ width: 0 }}
                  animate={{ 
                    width: `${((displayRoom.currentQuizIndex + 1) / (displayRoom.totalQuizCount || 1)) * 100}%` 
                  }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                />
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}

// メインのクイズルームページコンポーネント
export default function QuizRoomPage() {
  return (
    <Suspense fallback={<QuizRoomLoading />}>
      <QuizRoomContent />
    </Suspense>
  );
}
