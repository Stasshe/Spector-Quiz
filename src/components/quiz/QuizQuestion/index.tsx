import { useState, useEffect } from 'react';
import { Quiz } from '@/types/quiz';
import { useQuiz } from '@/context/QuizContext';
import { motion, AnimatePresence } from 'framer-motion';

interface QuizQuestionProps {
  quiz: Quiz;
}

export default function QuizQuestion({ quiz }: QuizQuestionProps) {
  const { showChoices, setShowChoices, animationInProgress, setAnimationInProgress, showQuestionDelay, quizRoom } = useQuiz();
  const [showQuestion, setShowQuestion] = useState(false);
  
  // 難易度は単元から取得（単元情報が無い場合はクイズの難易度を使用）
  const unitDifficulty = quizRoom?.unitDifficulty || quiz.difficulty;
  
  // 問題を表示するアニメーション効果（アニメーションは縮小）
  useEffect(() => {
    setAnimationInProgress(true);
    setShowQuestion(false);
    
    // 問題が切り替わった時に遅延を短くする（250ms）
    const questionTimer = setTimeout(() => {
      setShowQuestion(true);
      setAnimationInProgress(false);
    }, 250);
    
    return () => clearTimeout(questionTimer);
  }, [quiz.quizId, setAnimationInProgress]);
  
  return (
    <div className="quiz-question relative">
      {/* 難易度表示を右上に配置 */}
      <div className="absolute top-0 right-0 flex items-center bg-white/80 backdrop-blur-sm px-3 py-1 rounded-lg shadow-sm">
        <span className="text-sm text-gray-600 mr-2">難易度:</span>
        <div className="flex">
          {Array.from({ length: 5 }).map((_, index) => (
            <span
              key={index}
              className={`w-3 h-3 rounded-full mx-0.5 ${
                index < unitDifficulty
                  ? 'bg-yellow-400'
                  : 'bg-gray-200'
              }`}
            ></span>
          ))}
        </div>
      </div>
      
      <motion.h2 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-xl md:text-2xl font-bold mb-4 pr-24" // 右側のスペースを確保
      >
        {quiz.title}
      </motion.h2>
      
      <AnimatePresence>
        {showQuestion && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.4 }}
            className="bg-indigo-50 border border-indigo-100 rounded-lg p-4 mb-6"
          >
            <p className="text-lg font-medium">{quiz.question}</p>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* 入力式問題の場合は選択肢表示なし */}
      {quiz.type === 'input' && showQuestion && (
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
