import QuizTimer from '@/components/quiz/QuizTimer';
import { useQuiz } from '@/context/QuizContext';
import { useLeader } from '@/hooks/useLeader';
import { Quiz } from '@/types/quiz';
import { motion } from 'framer-motion';
import { useEffect, useState, useRef } from 'react';

interface QuizQuestionProps {
  quiz: Quiz;
}

export default function QuizQuestion({ quiz }: QuizQuestionProps) {
  const { setAnimationInProgress, quizRoom } = useQuiz();
  const { startQuestionTimer } = useLeader(quizRoom?.roomId || '');
  const [timerActive, setTimerActive] = useState(false);
  const [timerResetKey, setTimerResetKey] = useState<string>('');
  const [isInitialized, setIsInitialized] = useState(false);
  const currentQuizIdRef = useRef<string>('');
  
  // quizがnullの場合は何も表示しない
  if (!quiz) {
    return null;
  }

  // 問題が変わった時の初期化処理（最小限のログ）
  useEffect(() => {
    if (quiz.quizId !== currentQuizIdRef.current) {
      currentQuizIdRef.current = quiz.quizId;
      setIsInitialized(false);
      setTimerActive(false);
      setTimerResetKey('');
    }
  }, [quiz.quizId]);
   // タイマーを開始する処理（問題は常に表示）
  useEffect(() => {
    // 現在のリセットキーを生成
    const currentResetKey = `${quiz.quizId}-${quizRoom?.currentQuizIndex || 0}`;
    const shouldInitialize = !isInitialized || 
                           timerResetKey !== currentResetKey ||
                           !timerActive;
    
    if (!shouldInitialize) {
      return;
    }

    setAnimationInProgress(true);
    setTimerActive(false);
    
    // 問題が切り替わった時の遅延を最小限にする
    const questionTimer = setTimeout(() => {
      setAnimationInProgress(false);
      
      // 問題表示後、タイマーを開始
      setTimeout(() => {
        setTimerActive(true);
        setTimerResetKey(currentResetKey);
        setIsInitialized(true);
        
        // リーダーの場合はサーバー側でもタイマーを開始
        if (quizRoom?.roomId && quizRoom.status === 'in_progress') {
          startQuestionTimer();
        }
      }, 150); // タイマー開始までの遅延を少し増やして確実性を向上
    }, 50); // 初期遅延を維持
    
    return () => {
      clearTimeout(questionTimer);
    };
  }, [quiz.quizId, quizRoom?.currentQuizIndex, setAnimationInProgress, startQuestionTimer, quizRoom?.roomId, quizRoom?.status]);  // タイマーが終了した時の処理
  const handleTimeUp = () => {
    setTimerActive(false);
    // サーバー側のタイムアウト処理は useLeader の startQuestionTimer で実行される
  };
  
  // デバッグログを削除（必要時のみ有効化）
  // useEffect(() => {
  //   console.log('Timer状態変化:', {
  //     timerActive,
  //     quizRoomStatus: quizRoom?.status,
  //     isRevealed: quizRoom?.currentState?.isRevealed,
  //     resetKey: timerResetKey,
  //     finalIsActive: timerActive && quizRoom?.status === 'in_progress'
  //   });
  // }, [timerActive, quizRoom?.status, quizRoom?.currentState?.isRevealed, timerResetKey]);
  
  return (
    <div className="quiz-question relative">
      
      {/* タイマーコンポーネント - 回答表示中でも表示するが停止状態 */}
      {quiz.genre && (
        <div className="mb-4">
          <QuizTimer
            genre={quiz.genre}
            isActive={timerActive && quizRoom?.status === 'in_progress'}
            onTimeUp={handleTimeUp}
            resetKey={`${quiz.quizId}-${quizRoom?.currentQuizIndex || 0}`} // クイズIDとインデックスを組み合わせてユニークなキーを作成
          />
        </div>
      )}
      
      <motion.h2 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-xl md:text-2xl font-bold mb-4 pr-24" // 右側のスペースを確保
      >
        {quiz.title}
      </motion.h2>
      
      {/* 問題文表示 - 常に表示 */}
      <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-4 mb-6">
        <p className="text-lg font-medium">{quiz.question}</p>
      </div>
      
      {/* 入力式問題の場合のガイダンス */}
      {quiz.type === 'input' && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="text-gray-600 italic mb-4"
        >
          解答を入力してください
        </motion.div>
      )}
      
      <div className="text-sm text-gray-500">
        <div>ジャンル: {quiz.genre}</div>
      </div>
    </div>
  );
}
