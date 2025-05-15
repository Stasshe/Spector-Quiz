import { useState } from 'react';
import { Quiz } from '@/types/quiz';
import { useQuiz } from '@/context/QuizContext';

interface QuizQuestionProps {
  quiz: Quiz;
}

export default function QuizQuestion({ quiz }: QuizQuestionProps) {
  const { showChoices, setShowChoices } = useQuiz();
  
  return (
    <div className="quiz-question">
      <h2 className="text-xl md:text-2xl font-bold mb-4">{quiz.title}</h2>
      <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-4 mb-6">
        <p className="text-lg font-medium">{quiz.question}</p>
      </div>
      
      {/* 入力式問題の場合は選択肢表示なし */}
      {quiz.type === 'input' && (
        <div className="text-gray-600 italic mb-4">
          解答を入力してください
        </div>
      )}
      
      <div className="flex items-center justify-between text-sm text-gray-500">
        <div>ジャンル: {quiz.genre} &gt;</div>
        <div className="flex items-center">
          <span className="mr-2">難易度:</span>
          <div className="flex">
            {Array.from({ length: 5 }).map((_, index) => (
              <span
                key={index}
                className={`w-4 h-4 rounded-full mx-0.5 ${
                  index < quiz.difficulty
                    ? 'bg-yellow-400'
                    : 'bg-gray-200'
                }`}
              ></span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
