import { useState, useEffect } from 'react';
import { Quiz } from '@/types/quiz';
import { useQuiz } from '@/context/QuizContext';
import { motion, AnimatePresence } from 'framer-motion';
import QuizTimer from '@/components/quiz/QuizTimer';
import { useLeader } from '@/hooks/useLeader';

interface QuizQuestionProps {
  quiz: Quiz;
}

export default function QuizQuestion({ quiz }: QuizQuestionProps) {
  const { setAnimationInProgress, quizRoom } = useQuiz();
  const { startQuestionTimer } = useLeader(quizRoom?.roomId || '');
  const [timerActive, setTimerActive] = useState(false);
  const [timerResetKey, setTimerResetKey] = useState<string>('');
  const [isInitialized, setIsInitialized] = useState(false);
  
  // quizがnullの場合は何も表示しない
  if (!quiz) {
    return null;
  }
  
  // タイマーを開始する処理（問題は常に表示）
  useEffect(() => {
    console.log('QuizQuestion effect triggered', { 
      quizId: quiz.quizId, 
      timerResetKey, 
      isInitialized,
      quizRoomId: quizRoom?.roomId,
      status: quizRoom?.status 
    });
    
    // 既に同じ問題が表示されている場合はアニメーションを実行しない
    if (timerResetKey === quiz.quizId && isInitialized) {
      console.log('Same quiz already initialized, skipping');
      return;
    }

    setAnimationInProgress(true);
    setTimerActive(false);
    
    // 問題が切り替わった時の遅延を最小限にする
    const questionTimer = setTimeout(() => {
      console.log('Starting question display');
      setAnimationInProgress(false);
      
      // 問題表示後、タイマーを開始
      setTimeout(() => {
        console.log('Starting timer for quiz:', quiz.quizId);
        setTimerActive(true);
        setTimerResetKey(quiz.quizId);
        setIsInitialized(true);
        
        // リーダーの場合はサーバー側でもタイマーを開始
        if (quizRoom?.roomId && quizRoom.status === 'in_progress') {
          console.log('Starting server-side question timer');
          startQuestionTimer();
        }
      }, 200); // タイマー開始までの遅延を短縮
    }, 50); // 初期遅延を短縮
    
    return () => {
      console.log('Cleaning up question timer');
      clearTimeout(questionTimer);
    };
  }, [quiz.quizId, setAnimationInProgress, startQuestionTimer, quizRoom?.roomId, quizRoom?.status]);

  // タイマーが終了した時の処理
  const handleTimeUp = () => {
    console.log('QuizQuestion: 時間切れです！');
    setTimerActive(false);
    // サーバー側のタイムアウト処理は useLeader の startQuestionTimer で実行される
  };
  
  return (
    <div className="quiz-question relative">
      
      {/* タイマーコンポーネント - 回答表示中でも表示するが停止状態 */}
      {quiz.genre && (
        <div className="mb-4">
          <QuizTimer
            genre={quiz.genre}
            isActive={timerActive && quizRoom?.status === 'in_progress' && !quizRoom?.currentState?.isRevealed}
            onTimeUp={handleTimeUp}
            resetKey={timerResetKey} // 問題が変わるたびにタイマーをリセット
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
