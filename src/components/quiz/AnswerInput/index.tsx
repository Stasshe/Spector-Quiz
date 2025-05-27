import { useState, FormEvent } from 'react';
import { Quiz } from '@/types/quiz';
import { FaPaperPlane } from 'react-icons/fa';

interface AnswerInputProps {
  quiz: Quiz | null;
  onSubmit: (answer: string) => void;
}

export default function AnswerInput({ quiz, onSubmit }: AnswerInputProps) {
  const [answer, setAnswer] = useState('');

  const handleSubmit = (e?: FormEvent) => {
    if (e) e.preventDefault();

    if (!answer.trim()) return; // 空の回答は送信しない

    onSubmit(answer);
    setAnswer('');
  };

  // 選択式の場合の選択肢クリック処理
  const handleChoiceClick = (choice: string) => {
    setAnswer(choice);
    onSubmit(choice);
  };

  if (!quiz) return null;

  return (
    <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-md">
      <div className="mb-4">
        <h3 className="font-bold text-yellow-800">回答してください</h3>
      </div>

      {quiz.type === 'multiple_choice' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {quiz.choices.map((choice, index) => (
            <button
              key={index}
              onClick={() => handleChoiceClick(choice)}
              className="border border-yellow-300 bg-white hover:bg-yellow-100 rounded-md p-3 text-left focus:outline-none focus:ring-2 focus:ring-yellow-500"
            >
              <div className="flex items-start">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-yellow-200 text-yellow-800 font-medium text-sm mr-3 flex-shrink-0">
                  {String.fromCharCode(65 + index)}
                </span>
                <span>{choice}</span>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex">
          <input
            type="text"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            className="flex-grow px-4 py-2 border border-yellow-300 rounded-l-md focus:outline-none focus:ring-2 focus:ring-yellow-500"
            placeholder="回答を入力..."
            autoFocus
          />
          <button
            type="submit"
            className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-r-md"
          >
            <FaPaperPlane />
          </button>
        </form>
      )}
    </div>
  );
}
