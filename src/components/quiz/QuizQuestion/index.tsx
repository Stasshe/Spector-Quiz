import QuizTimer from '@/components/quiz/QuizTimer';
import { useQuiz } from '@/context/QuizContext';
import { useLeader } from '@/hooks/useLeader';
import { Quiz } from '@/types/quiz';
import { motion } from 'framer-motion';
import { useEffect, useState, useRef } from 'react';

interface QuizQuestionProps {
  quiz: Quiz;
  isAnswerRevealed?: boolean; // 正答が表示されているかどうか
}

export default function QuizQuestion({ quiz, isAnswerRevealed }: QuizQuestionProps) {
  const { setAnimationInProgress, quizRoom } = useQuiz();
  const { startQuestionTimer } = useLeader(quizRoom?.roomId || '');
  const [timerActive, setTimerActive] = useState(true); // 初期値をtrueに変更
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
      // タイマーは常にアクティブに保つ
      setTimerActive(true);
    }
  }, [quiz.quizId]);
   // タイマーを開始する処理（問題は常に表示）
  useEffect(() => {
    // 現在のリセットキーを生成
    const currentResetKey = `${quiz.quizId}-${quizRoom?.currentQuizIndex || 0}`;
    
    // 既に初期化済みで、同じリセットキーの場合はスキップ
    if (isInitialized && timerResetKey === currentResetKey) {
      return;
    }

    setAnimationInProgress(true);
    setTimerResetKey(currentResetKey);
    
    // 短い遅延でアニメーション終了
    const questionTimer = setTimeout(() => {
      setAnimationInProgress(false);
      setIsInitialized(true);
      
      // リーダーの場合はサーバー側でもタイマーを開始
      if (quizRoom?.roomId && quizRoom.status === 'in_progress') {
        startQuestionTimer();
      }
    }, 100); // 遅延を短縮
    
    return () => {
      clearTimeout(questionTimer);
    };
  }, [quiz.quizId, quizRoom?.currentQuizIndex, setAnimationInProgress, startQuestionTimer, quizRoom?.roomId, quizRoom?.status, isInitialized, timerResetKey]);  
  
  // タイマーが終了した時の処理
  const handleTimeUp = () => {
    setTimerActive(false);
    // サーバー側のタイムアウト処理は useLeader の startQuestionTimer で実行される
  };
  
  // デバッグログを追加
  useEffect(() => {
    const resetKey = `${quiz.quizId}-${quizRoom?.currentQuizIndex || 0}`;
    console.log('[QuizQuestion] タイマー状態確認:', {
      quizId: quiz.quizId,
      currentQuizIndex: quizRoom?.currentQuizIndex,
      resetKey,
      timerActive,
      quizRoomStatus: quizRoom?.status,
      isAnswerRevealed
    });
  }, [quiz.quizId, quizRoom?.currentQuizIndex, timerActive, quizRoom?.status, isAnswerRevealed]);
  
  return (
    <div className="quiz-question relative">
      
      {/* タイマーコンポーネント - 常に表示、答え表示中は停止 */}
      {quiz.genre && (
        <div className="mb-4">
          <QuizTimer
            genre={quiz.genre}
            isActive={timerActive && quizRoom?.status === 'in_progress'}
            onTimeUp={handleTimeUp}
            resetKey={`${quiz.quizId}-${quizRoom?.currentQuizIndex || 0}`} // クイズIDとインデックスを組み合わせてユニークなキーを作成
            isAnswerRevealed={isAnswerRevealed}
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
