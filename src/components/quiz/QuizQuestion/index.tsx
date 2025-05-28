import QuizTimer from '@/components/quiz/QuizTimer';
import LatexRenderer from '@/components/common/LatexRenderer';
import { useQuiz } from '@/context/QuizContext';
import { useLeader } from '@/hooks/useLeader';
import { Quiz } from '@/types/quiz';
import { motion } from 'framer-motion';
import { useRef, useEffect } from 'react';

interface QuizQuestionProps {
  quiz: Quiz;
  isAnswerRevealed?: boolean; // 正答が表示されているかどうか
}

export default function QuizQuestion({ quiz, isAnswerRevealed }: QuizQuestionProps) {
  const { setAnimationInProgress, quizRoom } = useQuiz();
  const { startQuestionTimer } = useLeader(quizRoom?.roomId || '');
  const currentQuizIdRef = useRef<string>('');
  const initTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // 新しい問題の検出とリーダーのタイマー開始処理
  useEffect(() => {
    if (!quiz) return;
    
    const isNewQuestion = quiz.quizId !== currentQuizIdRef.current;
    
    if (isNewQuestion) {
      console.log('[QuizQuestion] 新しい問題検出:', quiz.quizId);
      currentQuizIdRef.current = quiz.quizId;
      
      // アニメーション状態を設定
      setAnimationInProgress(true);
      
      // 既存のタイマーをクリア
      if (initTimerRef.current) {
        clearTimeout(initTimerRef.current);
      }
      
      // アニメーション終了後にリーダーのタイマーを開始
      initTimerRef.current = setTimeout(() => {
        setAnimationInProgress(false);
        if (quizRoom?.roomId && quizRoom.status === 'in_progress') {
          startQuestionTimer();
        }
      }, 100);
    }
  }, [quiz, setAnimationInProgress, startQuestionTimer, quizRoom?.roomId, quizRoom?.status]);
  
  // quizがnullの場合は何も表示しない（フック呼び出し後に配置）
  if (!quiz) {
    return null;
  }

  // シンプルなreset keyとローカル答え表示状態の計算
  const resetKey = `${quiz.quizId}-${quizRoom?.currentQuizIndex || 0}`;
  const isNewQuestion = quiz.quizId !== currentQuizIdRef.current;
  
  // 新しい問題の場合は答え表示を無視、それ以外は反映
  const localAnswerRevealed = isNewQuestion ? false : (isAnswerRevealed || false);
  
  // タイマーが終了した時の処理
  const handleTimeUp = () => {
    // サーバー側のタイムアウト処理は useLeader の startQuestionTimer で実行される
  };
  
  // デバッグログ
  console.log('[QuizQuestion] レンダリング状態:', {
    quizId: quiz.quizId,
    resetKey,
    isNewQuestion,
    localAnswerRevealed,
    roomStatus: quizRoom?.status
  });

  return (
    <div className="quiz-question relative">
      
      {/* タイマーコンポーネント - 常に表示、答え表示中は停止 */}
      <div className="mb-4">
        <QuizTimer
          genre={quiz.genre || 'general'}
          isActive={quizRoom?.status === 'in_progress'}
          onTimeUp={handleTimeUp}
          resetKey={resetKey}
          localAnswerRevealed={localAnswerRevealed}
        />
      </div>
      
      <motion.h2 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-xl md:text-2xl font-bold mb-4 pr-24" // 右側のスペースを確保
      >
        <LatexRenderer text={quiz.title} />
      </motion.h2>
      
      {/* 問題文表示 - 常に表示 */}
      <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-4 mb-6">
        <div className="text-lg font-medium">
          <LatexRenderer text={quiz.question} />
        </div>
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
