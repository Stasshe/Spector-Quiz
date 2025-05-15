import { useState, useEffect } from 'react';
import { Quiz } from '@/types/quiz';
import { useQuiz } from '@/context/QuizContext';
import { motion, AnimatePresence } from 'framer-motion';

interface QuizQuestionProps {
  quiz: Quiz;
}

export default function QuizQuestion({ quiz }: QuizQuestionProps) {
  const { showChoices, setShowChoices, animationInProgress, setAnimationInProgress, showQuestionDelay } = useQuiz();
  const [showQuestion, setShowQuestion] = useState(false);
  const [showDifficulty, setShowDifficulty] = useState(false);
  
  // 問題を表示するアニメーション効果
  useEffect(() => {
    setAnimationInProgress(true);
    setShowQuestion(false);
    setShowDifficulty(false);
    
    // 問題が切り替わった時に少し遅延をつける
    const questionTimer = setTimeout(() => {
      setShowQuestion(true);
      
      // 難易度表示は問題表示後に少し遅らせる
      const difficultyTimer = setTimeout(() => {
        setShowDifficulty(true);
        setAnimationInProgress(false);
      }, 800);
      
      return () => clearTimeout(difficultyTimer);
    }, showQuestionDelay);
    
    return () => clearTimeout(questionTimer);
  }, [quiz.quizId, setAnimationInProgress, showQuestionDelay]);
  
  return (
    <div className="quiz-question">
      <motion.h2 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-xl md:text-2xl font-bold mb-4"
      >
        {quiz.title}
      </motion.h2>
      
      <AnimatePresence>
        {showQuestion && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.6 }}
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
          transition={{ duration: 0.5, delay: 0.3 }}
          className="text-gray-600 italic mb-4"
        >
          解答を入力してください
        </motion.div>
      )}
      
      <AnimatePresence>
        {showDifficulty && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="flex items-center justify-between text-sm text-gray-500"
          >
            <div>ジャンル: {quiz.genre} &gt;</div>
            <div className="flex items-center">
              <span className="mr-2">難易度:</span>
              <div className="flex">
                {Array.from({ length: 5 }).map((_, index) => (
                  <motion.span
                    key={index}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ duration: 0.3, delay: 0.1 * index }}
                    className={`w-4 h-4 rounded-full mx-0.5 ${
                      index < quiz.difficulty
                        ? 'bg-yellow-400'
                        : 'bg-gray-200'
                    }`}
                  ></motion.span>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
