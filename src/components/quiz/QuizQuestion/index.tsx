import { Quiz } from '@/types/quiz';

interface QuizQuestionProps {
  quiz: Quiz;
}

export default function QuizQuestion({ quiz }: QuizQuestionProps) {
  return (
    <div className="quiz-question">
      <h2 className="text-xl md:text-2xl font-bold mb-4">{quiz.title}</h2>
      <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-4 mb-6">
        <p className="text-lg font-medium">{quiz.question}</p>
      </div>
      
      {/* 選択肢の表示（四択問題の場合） */}
      {quiz.type === 'multiple_choice' && quiz.choices && quiz.choices.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
          {quiz.choices.map((choice, index) => (
            <div
              key={index}
              className="border border-gray-200 rounded-md p-3 bg-white hover:bg-gray-50 cursor-pointer"
            >
              <div className="flex items-start">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-indigo-100 text-indigo-800 font-medium text-sm mr-3 flex-shrink-0">
                  {String.fromCharCode(65 + index)}
                </span>
                <span>{choice}</span>
              </div>
            </div>
          ))}
        </div>
      )}

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
