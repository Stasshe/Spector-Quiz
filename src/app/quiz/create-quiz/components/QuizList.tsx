'use client';

import { FC } from 'react';
import { FaPen, FaPlus, FaTrash } from 'react-icons/fa';
import { Quiz } from '@/types/quiz';

interface QuizListProps {
  quizzes: Quiz[];
  onAddNew: () => void;
  onEdit: (index: number) => void;
  onRemove: (index: number) => void;
}

const QuizList: FC<QuizListProps> = ({
  quizzes,
  onAddNew,
  onEdit,
  onRemove
}) => {
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">クイズ一覧</h2>
        <div className="flex space-x-2">
          <button
            type="button"
            onClick={onAddNew}
            className="btn-outline-sm flex items-center"
          >
            <FaPlus className="mr-1" size={12} /> 新しいクイズを作成
          </button>
        </div>
      </div>
      
      {quizzes.length === 0 ? (
        <div className="text-center py-8 border border-dashed border-gray-300 rounded-lg">
          <p className="text-gray-500">クイズがまだ追加されていません</p>
          <p className="text-sm text-gray-400 mt-1">「新しいクイズを作成」または「既存のクイズから追加」を使って、単元にクイズを追加してください</p>
        </div>
      ) : (
        <div className="space-y-4 mb-6">
          {quizzes.map((quiz, index) => (
            <div key={index} className="border border-gray-200 rounded-lg p-4 relative">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-medium">{quiz.title || '無題のクイズ'}</h3>
                  <p className="text-sm text-gray-700 mt-1">{quiz.question.substring(0, 100)}...</p>
                  <div className="flex items-center mt-2 text-sm">
                    <span className="bg-gray-100 px-2 py-1 rounded mr-2">
                      {quiz.type === 'multiple_choice' ? '選択式' : '入力式'}
                    </span>
                  </div>
                </div>
                <div className="flex space-x-1">
                  <button
                    type="button"
                    onClick={() => onEdit(index)}
                    className="p-2 text-indigo-600 hover:text-indigo-800"
                    title="編集"
                  >
                    <FaPen />
                  </button>
                  <button
                    type="button"
                    onClick={() => onRemove(index)}
                    className="p-2 text-red-500 hover:text-red-700"
                    title="削除"
                  >
                    <FaTrash />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default QuizList;
