'use client';

import { useEffect, useState, Suspense, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useQuiz } from '@/hooks/useQuiz';
import { useQuizRoom } from '@/hooks/useQuizRoom';
import { useLeader } from '@/hooks/useLeader';
import { RoomStatus } from '@/types/room';
import { TIMING } from '@/config/quizConfig';
import QuizQuestion from '@/components/quiz/QuizQuestion';
import ParticipantList from '@/components/quiz/ParticipantList';
import AnswerInput from '@/components/quiz/AnswerInput';
import QuizResult from '@/components/quiz/QuizResult';
import ScoreBoard from '@/components/quiz/ScoreBoard';
import { FaSignOutAlt, FaPlay } from 'react-icons/fa';
import { db } from '@/config/firebase';
import { deleteDoc, doc } from 'firebase/firestore';

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
  const { quizRoom, isLeader, currentQuiz, hasAnsweringRight } = useQuiz();
  const { useRoomListener, exitRoom, updateUserStatsOnRoomComplete } = useQuizRoom();
  const { startQuizGame, handleBuzzer, submitAnswer } = useLeader(roomId);
  
  // 統計更新のステータスを追跡
  const [statsUpdated, setStatsUpdated] = useState(false);
  
  // 以前のルームステータスを追跡
  const prevStatusRef = useRef<RoomStatus | null>(null);
  
  // ルームデータをリアルタイム監視
  const room = useRoomListener(roomId);

  // リダイレクトループ防止
  useEffect(() => {
    // このページにいることを明示的に記録
    console.log('[QuizRoomPage] ページロード - クイズルームフラグを設定');
    
    // グローバルフラグとして設定（window経由で他のコンポーネントからもアクセス可能）
    if (typeof window !== 'undefined') {
      window.inQuizRoomPage = true;
      
      // 確実に設定されるようにタイマーも使用（非同期処理対策）
      const confirmTimer = setTimeout(() => {
        if (typeof window !== 'undefined' && !window.inQuizRoomPage) {
          console.log('[QuizRoomPage] フラグ設定の確認 - 再設定');
          window.inQuizRoomPage = true;
        }
      }, 500);
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

  // ルームからの退出処理
  const handleLeaveRoom = async () => {
    if (roomId) {
      await exitRoom(roomId);
      router.push('/quiz');
    }
  };

  // ルームのステータスが完了に変わったときに統計情報を更新
  useEffect(() => {
    if (!room || !currentUser || statsUpdated) return;
    
    // 非同期処理を行うための内部関数
    const updateStats = async () => {
      try {
        // 引数は1つのみ（roomId）に修正
        const updated = await updateUserStatsOnRoomComplete(roomId);
        if (updated) {
          setStatsUpdated(true);
          console.log('ユーザー統計情報を更新しました');
          
          // 統計更新完了済みのフラグを確認
          if (room.statsUpdated) {
            // すでに更新済みの場合は即時リダイレクトのバックアップとして機能
            console.log('統計更新フラグが既に設定されているため、自動リダイレクト実行');
            handleLeaveRoom();
          }
        } else {
          console.log('統計情報の更新はスキップされました（ユーザー情報なし）');
          // エラーではないのでゲームプレイは続行
          setStatsUpdated(true);
        }
      } catch (err) {
        console.error('統計更新エラー:', err);
        // エラーが発生してもゲームプレイを続行できるように統計更新済みとマーク
        setStatsUpdated(true);
      }
    };
    
    // ルームステータスが「待機中」または「進行中」から「完了」に変わった場合
    if ((prevStatusRef.current === 'waiting' || prevStatusRef.current === 'in_progress') && 
        room.status === 'completed') {
      updateStats();
    }
    
    // 現在のステータスを記録
    prevStatusRef.current = room.status;
  }, [room, currentUser, roomId, updateUserStatsOnRoomComplete, statsUpdated, handleLeaveRoom]);

  // ルーム情報が読み込まれていない場合のローディング表示
  if (!quizRoom || !room) {
    return (
      <div className="flex justify-center items-center min-h-[calc(100vh-64px)]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  // 正解/不正解の状態
  const isCorrect = quizRoom.currentState.answerStatus === 'correct';
  const isIncorrect = quizRoom.currentState.answerStatus === 'incorrect';
  const isRevealed = quizRoom.currentState.isRevealed;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6 flex justify-between items-center">
        <h1 className="text-2xl font-bold">{quizRoom.name}</h1>
        <button
          onClick={handleLeaveRoom}
          className="bg-red-600 text-white px-4 py-2 rounded-md flex items-center"
        >
          <FaSignOutAlt className="mr-2" /> 退出する
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 左側：参加者リスト */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow-md p-4 mb-6">
            <h2 className="text-lg font-medium mb-4">参加者</h2>
            <ParticipantList participants={quizRoom.participants} leaderId={quizRoom.roomLeaderId} />
          </div>

          {/* スコアボード */}
          <div className="bg-white rounded-lg shadow-md p-4">
            <h2 className="text-lg font-medium mb-4">スコアボード</h2>
            <ScoreBoard participants={quizRoom.participants} />
          </div>
        </div>

        {/* 右側：クイズエリア */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            {/* 待機中の場合 */}
            {quizRoom.status === 'waiting' && (
              <div className="text-center py-8">
                <h2 className="text-2xl font-bold mb-4">クイズの開始を待っています</h2>
                <p className="text-gray-600 mb-6">
                  {isLeader
                    ? 'あなたはルームリーダーです。クイズを開始してください。'
                    : 'ルームリーダーがクイズを開始するまでお待ちください。'}
                </p>
                {isLeader ? (
                  <button
                    onClick={startQuizGame}
                    className="bg-indigo-600 text-white px-6 py-3 rounded-md text-lg flex items-center mx-auto"
                  >
                    <FaPlay className="mr-2" /> クイズを開始する
                  </button>
                ) : (
                  <div className="mt-4">
                    <p className="text-gray-500">
                      参加者数: {Object.keys(quizRoom.participants).length}人
                    </p>
                    <p className="text-gray-500">
                    ルームリーダー: {quizRoom.participants[quizRoom.roomLeaderId]?.username}
                    </p>
                    <p className="text-gray-500">
                      ジャンル: {quizRoom.genre}
                    </p>
                    <p className="text-gray-500">
                      単元: {quizRoom.unitId}
                    </p>
                    <p className="text-gray-500">
                      ルームID: {roomId}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* 進行中の場合 */}
            {quizRoom.status === 'in_progress' && (
              <div>
                {/* 問題表示 */}
                {currentQuiz && <QuizQuestion quiz={currentQuiz} />}

                {/* 早押しボタン（解答者がいない場合、かつ選択肢が表示されていない場合） */}
                {!quizRoom.currentState.currentAnswerer && !hasAnsweringRight && currentUser && 
                  // ユーザーがこの問題で間違えていない場合のみボタンを表示
                  (!(quizRoom.participants[currentUser.uid]?.missCount) || 
                   !(quizRoom.participants[currentUser.uid]?.wrongQuizIds?.includes(currentQuiz?.quizId || ''))) && (
                  <div className="mt-6 text-center">
                    <button
                      onClick={handleBuzzer}
                      className="bg-yellow-500 hover:bg-yellow-600 text-white text-xl px-8 py-4 rounded-full shadow-lg transform transition-transform active:scale-95"
                    >
                      押す！
                    </button>
                  </div>
                )}

                {/* 解答入力（解答権を持っている場合） */}
                {hasAnsweringRight && quizRoom.currentState.answerStatus === 'answering' && (
                  <AnswerInput
                    quiz={currentQuiz}
                    onSubmit={submitAnswer}
                  />
                )}

                {/* 他のプレイヤーが解答中 */}
                {quizRoom.currentState.currentAnswerer && 
                  quizRoom.currentState.currentAnswerer !== currentUser?.uid && 
                  quizRoom.currentState.answerStatus === 'answering' && (
                  <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-md text-center">
                    <p className="text-yellow-700">
                      {quizRoom.participants[quizRoom.currentState.currentAnswerer]?.username} さんが解答中...
                    </p>
                  </div>
                )}

                {/* 正解/不正解の表示 */}
                {isRevealed && (
                  <QuizResult
                    isCorrect={isCorrect}
                    quiz={currentQuiz}
                    answererId={quizRoom.currentState.currentAnswerer || ''}
                    participants={quizRoom.participants}
                  />
                )}
              </div>
            )}

            {/* 完了した場合 */}
            {quizRoom.status === 'completed' && (
              <div className="text-center py-8">
                <h2 className="text-2xl font-bold mb-4">クイズが終了しました</h2>
                <p className="text-gray-600 mb-6">
                  全ての問題が終了しました。結果をご確認ください。
                </p>
                {statsUpdated && (
                  <div className="my-4 p-4 bg-green-50 border border-green-200 rounded-md">
                    <p className="text-green-600">✓ プレイ結果が統計に反映されました！</p>
                    {room && room.statsUpdated ? (
                      <p className="text-gray-600 mt-1">全ての処理が完了しました。自動的にクイズ選択画面に戻ります...</p>
                    ) : (
                      <p className="text-gray-600 mt-1">統計更新処理が進行中です。完了後に自動的に画面が切り替わります...</p>
                    )}
                  </div>
                )}
                <button
                  onClick={handleLeaveRoom}
                  className="bg-indigo-600 text-white px-6 py-3 rounded-md text-lg"
                >
                  クイズ選択に戻る
                </button>
              </div>
            )}
          </div>

          {/* クイズ進行状況 */}
          {quizRoom.status === 'in_progress' && (
            <div className="bg-white rounded-lg shadow-md p-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-600">問題の進行状況</span>
                <span className="text-sm font-medium">
                  {quizRoom.currentQuizIndex + 1} / {quizRoom.totalQuizCount}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div
                  className="bg-indigo-600 h-2.5 rounded-full"
                  style={{
                    width: `${((quizRoom.currentQuizIndex + 1) / quizRoom.totalQuizCount) * 100}%`,
                  }}
                ></div>
              </div>
            </div>
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
