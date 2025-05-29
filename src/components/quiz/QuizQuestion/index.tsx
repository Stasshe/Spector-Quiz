import QuizTimer from '@/components/quiz/QuizTimer';
import LatexRenderer from '@/components/latex/LatexRenderer';
import { useQuiz } from '@/context/QuizContext';
import { useLeader } from '@/hooks/useLeader';
import { Quiz } from '@/types/quiz';
import { motion, AnimatePresence } from 'framer-motion';
import { useRef, useEffect, useState } from 'react';

interface QuizQuestionProps {
  quiz: Quiz;
  isAnswerRevealed?: boolean; // 正答が表示されているかどうか
}

export default function QuizQuestion({ quiz, isAnswerRevealed }: QuizQuestionProps) {
  const { setAnimationInProgress, quizRoom } = useQuiz();
  const { startQuestionTimer } = useLeader(quizRoom?.roomId || '');
  const currentQuizIdRef = useRef<string>('');
  const initTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [showContent, setShowContent] = useState(false);
  
  // 新しい問題の検出とリーダーのタイマー開始処理
  useEffect(() => {
    if (!quiz) return;
    
    const isNewQuestion = quiz.quizId !== currentQuizIdRef.current;
    
    if (isNewQuestion) {
      console.log('[QuizQuestion] 新しい問題検出:', quiz.quizId);
      currentQuizIdRef.current = quiz.quizId;
      
      // アニメーション状態を設定
      setAnimationInProgress(true);
      setShowContent(false);
      
      // 既存のタイマーをクリア
      if (initTimerRef.current) {
        clearTimeout(initTimerRef.current);
      }
      
      // アニメーション後にコンテンツを表示
      setTimeout(() => {
        setShowContent(true);
      }, 200);
      
      // アニメーション終了後にリーダーのタイマーを開始
      initTimerRef.current = setTimeout(() => {
        setAnimationInProgress(false);
        if (quizRoom?.roomId && quizRoom.status === 'in_progress') {
          startQuestionTimer();
        }
      }, 800);
    } else {
      setShowContent(true);
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
      <AnimatePresence mode="wait">
        <motion.div
          key={`quiz-content-${quiz.quizId}`}
          initial={{ opacity: 0, y: 50, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -50, scale: 1.05 }}
          transition={{ 
            duration: 0.8,
            ease: "easeOut",
            scale: { duration: 0.6 },
            opacity: { duration: 0.6 }
          }}
        >
          {/* タイマーコンポーネント - 超コンパクトに */}
          <motion.div 
            className="mb-2"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1, duration: 0.3 }}
          >
            <QuizTimer
              genre={(() => {
                const genreToUse = quiz.genre || 'general';
                if (!quiz.genre) {
                  console.warn('[QuizQuestion] quiz.genreが未設定です。フォールバック値"general"を使用します', {
                    quizId: quiz.quizId,
                    title: quiz.title
                  });
                }
                return genreToUse;
              })()}
              isActive={quizRoom?.status === 'in_progress'}
              onTimeUp={handleTimeUp}
              resetKey={resetKey}
              localAnswerRevealed={localAnswerRevealed}
            />
          </motion.div>
          
          <motion.h2 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: showContent ? 1 : 0, y: showContent ? 0 : -20 }}
            transition={{ delay: 0.2, duration: 0.4, ease: "easeOut" }}
            className="text-lg md:text-xl font-bold mb-2 text-gray-800 leading-tight"
          >
            <LatexRenderer text={quiz.title} />
          </motion.h2>
          
          {/* 問題文表示 - 超コンパクトに */}
          <motion.div 
            className="bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-200 rounded-lg p-3 mb-2 shadow-sm"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: showContent ? 1 : 0, scale: showContent ? 1 : 0.98 }}
            transition={{ delay: 0.3, duration: 0.4, ease: "easeOut" }}
          >
            <div className="text-sm md:text-base font-medium leading-snug">
              <LatexRenderer text={quiz.question} />
            </div>
          </motion.div>
          
          {/* 入力式問題の場合のガイダンス - 超コンパクトに */}
          {quiz.type === 'input' && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: showContent ? 1 : 0, y: showContent ? 0 : 10 }}
              transition={{ delay: 0.4, duration: 0.3 }}
              className="text-gray-600 text-xs mb-1 text-center bg-gray-50 rounded-md p-1"
            >
              💡 解答を入力してください
            </motion.div>
          )}
          
          <motion.div 
            className="text-xs text-gray-500 flex items-center justify-between"
            initial={{ opacity: 0 }}
            animate={{ opacity: showContent ? 1 : 0 }}
            transition={{ delay: 0.5, duration: 0.3 }}
          >
            <div className="flex items-center space-x-2">
              <span className="bg-indigo-100 text-indigo-800 px-1.5 py-0.5 rounded-full text-xs font-medium">
                {quiz.genre}
              </span>
            </div>
          </motion.div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
