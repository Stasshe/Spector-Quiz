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
  
  // タイマーを開始する処理（問題は常に表示）
  useEffect(() => {
    // 既に同じ問題が表示されている場合はアニメーションを実行しない
    if (timerResetKey === quiz.quizId && isInitialized) {
      return;
    }

    setAnimationInProgress(true);
    setTimerActive(false);
    
    // 問題が切り替わった時に遅延を短くする（250ms）
    const questionTimer = setTimeout(() => {
      setAnimationInProgress(false);
      // 問題表示後、少し遅れてタイマーを開始
      setTimeout(() => {
        setTimerActive(true);
        // タイマーリセットキーを設定（問題変更時のみ）
        if (timerResetKey !== quiz.quizId) {
          setTimerResetKey(quiz.quizId);
        }
        setIsInitialized(true);
        
        // リーダーの場合はサーバー側でもタイマーを開始
        if (quizRoom?.roomId) {
          startQuestionTimer();
        }
      }, 300);
    }, 100);
    
    return () => clearTimeout(questionTimer);
  }, [quiz.quizId, setAnimationInProgress, timerResetKey, isInitialized, startQuestionTimer, quizRoom?.roomId]);

  // タイマーが終了した時の処理
  const handleTimeUp = () => {
    console.log('QuizQuestion: 時間切れです！');
    setTimerActive(false);
    // サーバー側のタイムアウト処理は useLeader の startQuestionTimer で実行される
  };
  
  return (
    <div className="quiz-question relative">
      
      {/* タイマーコンポーネント - 埋め込み形式 */}
      {quiz.genre && (
        <div className="mb-4">
          <QuizTimer
            genre={quiz.genre}
            isActive={timerActive && quizRoom?.status === 'in_progress'}
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
