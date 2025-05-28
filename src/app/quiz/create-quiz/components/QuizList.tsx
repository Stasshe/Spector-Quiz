'use client';

import { FC, useState } from 'react';
import { FaPen, FaPlus, FaTrash, FaCheckSquare, FaSquare } from 'react-icons/fa';
import { Quiz } from '@/types/quiz';

interface QuizListProps {
  quizzes: Quiz[];
  onAddNew: () => void;
  onEdit: (index: number) => void;
  onRemove: (index: number) => void;
  onBulkRemove?: (indices: number[]) => void;
}

const QuizList: FC<QuizListProps> = ({
  quizzes,
  onAddNew,
  onEdit,
  onRemove,
  onBulkRemove
}) => {
  const [selectedQuizzes, setSelectedQuizzes] = useState<Set<number>>(new Set());
  const [showBulkActions, setShowBulkActions] = useState(false);

  // 個別クイズの選択/選択解除
  const toggleQuizSelection = (index: number) => {
    const newSelection = new Set(selectedQuizzes);
    if (newSelection.has(index)) {
      newSelection.delete(index);
    } else {
      newSelection.add(index);
    }
    setSelectedQuizzes(newSelection);
    setShowBulkActions(newSelection.size > 0);
  };

  // 全選択/全選択解除
  const toggleSelectAll = () => {
    if (selectedQuizzes.size === quizzes.length) {
      setSelectedQuizzes(new Set());
      setShowBulkActions(false);
    } else {
      setSelectedQuizzes(new Set(quizzes.map((_, index) => index)));
      setShowBulkActions(true);
    }
  };

  // 一括削除の実行
  const handleBulkDelete = () => {
    if (selectedQuizzes.size === 0) return;
    
    const confirmMessage = `選択した${selectedQuizzes.size}個のクイズを削除しますか？この操作は取り消せません。`;
    if (window.confirm(confirmMessage)) {
      const indicesToDelete = Array.from(selectedQuizzes).sort((a, b) => b - a); // 逆順でソート
      
      if (onBulkRemove) {
        onBulkRemove(indicesToDelete);
      } else {
        // フォールバック: 個別削除を逆順で実行
        indicesToDelete.forEach(index => onRemove(index));
      }
      
      setSelectedQuizzes(new Set());
      setShowBulkActions(false);
    }
  };

  // 選択をキャンセル
  const clearSelection = () => {
    setSelectedQuizzes(new Set());
    setShowBulkActions(false);
  };

  const allSelected = selectedQuizzes.size === quizzes.length && quizzes.length > 0;
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">クイズ一覧</h2>
        <div className="flex space-x-2">
          {/* 一括操作ボタン（クイズが存在する場合のみ表示） */}
          {quizzes.length > 0 && (
            <button
              type="button"
              onClick={toggleSelectAll}
              className="btn-outline-sm flex items-center text-gray-600 hover:text-gray-800"
              title={allSelected ? "全選択解除" : "全選択"}
            >
              {allSelected ? <FaCheckSquare className="mr-1" size={12} /> : <FaSquare className="mr-1" size={12} />}
              {allSelected ? "全選択解除" : "全選択"}
            </button>
          )}
          <button
            type="button"
            onClick={onAddNew}
            className="btn-outline-sm flex items-center"
          >
            <FaPlus className="mr-1" size={12} /> 新しいクイズを作成
          </button>
        </div>
      </div>

      {/* 一括操作バー */}
      {showBulkActions && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between">
          <span className="text-blue-700">
            {selectedQuizzes.size}個のクイズが選択されています
          </span>
          <div className="flex space-x-2">
            <button
              type="button"
              onClick={handleBulkDelete}
              className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700 flex items-center"
            >
              <FaTrash className="mr-1" size={12} /> 選択したクイズを削除
            </button>
            <button
              type="button"
              onClick={clearSelection}
              className="bg-gray-500 text-white px-3 py-1 rounded text-sm hover:bg-gray-600"
            >
              選択解除
            </button>
          </div>
        </div>
      )}
      
      {quizzes.length === 0 ? (
        <div className="text-center py-8 border border-dashed border-gray-300 rounded-lg">
          <p className="text-gray-500">クイズがまだ追加されていません</p>
          <p className="text-sm text-gray-400 mt-1">「新しいクイズを作成」または「既存のクイズから追加」を使って、単元にクイズを追加してください</p>
        </div>
      ) : (
        <div className="space-y-4 mb-6">
          {quizzes.map((quiz, index) => (
            <div 
              key={index} 
              className={`border rounded-lg p-4 relative transition-colors ${
                selectedQuizzes.has(index) 
                  ? 'border-blue-300 bg-blue-50' 
                  : 'border-gray-200'
              }`}
            >
              <div className="flex items-start">
                {/* チェックボックス */}
                <div className="flex items-center mr-3 mt-1">
                  <button
                    type="button"
                    onClick={() => toggleQuizSelection(index)}
                    className="text-gray-500 hover:text-blue-600"
                    title={selectedQuizzes.has(index) ? "選択解除" : "選択"}
                  >
                    {selectedQuizzes.has(index) ? 
                      <FaCheckSquare className="text-blue-600" size={16} /> : 
                      <FaSquare size={16} />
                    }
                  </button>
                </div>
                
                {/* クイズ情報 */}
                <div className="flex-1">
                  <h3 className="font-medium">{quiz.title || '無題のクイズ'}</h3>
                  <p className="text-sm text-gray-700 mt-1">{quiz.question.substring(0, 100)}...</p>
                  <div className="flex items-center mt-2 text-sm">
                    <span className="bg-gray-100 px-2 py-1 rounded mr-2">
                      {quiz.type === 'multiple_choice' ? '選択式' : '入力式'}
                    </span>
                  </div>
                </div>
                
                {/* アクションボタン */}
                <div className="flex space-x-1 ml-3">
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
