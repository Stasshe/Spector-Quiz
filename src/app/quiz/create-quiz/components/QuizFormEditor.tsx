'use client';

import { FC, useState } from 'react';
import { FaCheck, FaPlus, FaTrash } from 'react-icons/fa';
import { Quiz, QuizType } from '@/types/quiz';
import { QuizDifficulty } from '../create-types';

interface QuizFormEditorProps {
  onSave: (quiz: Omit<Quiz, 'quizId' | 'createdAt'>) => void;
  onCancel: () => void;
  editingQuiz?: Quiz | null;
  genre: string;
  createdBy: string;
}

const QuizFormEditor: FC<QuizFormEditorProps> = ({
  onSave,
  onCancel,
  editingQuiz,
  genre,
  createdBy
}) => {
  // クイズフォームの状態
  const [quizTitle, setQuizTitle] = useState(editingQuiz?.title || '');
  const [question, setQuestion] = useState(editingQuiz?.question || '');
  const [type, setType] = useState<QuizType>(editingQuiz?.type || 'multiple_choice');
  const [choices, setChoices] = useState<string[]>(editingQuiz?.choices || ['', '', '', '']);
  const [correctAnswer, setCorrectAnswer] = useState(editingQuiz?.correctAnswer || '');
  const [acceptableAnswers, setAcceptableAnswers] = useState<string[]>(editingQuiz?.acceptableAnswers || ['']);
  const [explanation, setExplanation] = useState(editingQuiz?.explanation || '');
  const [difficulty, setDifficulty] = useState<QuizDifficulty>((editingQuiz?.difficulty as QuizDifficulty) || 3);
  const [errorMessage, setErrorMessage] = useState('');

  // 選択肢の更新
  const updateChoice = (index: number, value: string) => {
    const newChoices = [...choices];
    newChoices[index] = value;
    setChoices(newChoices);
  };

  // 許容回答の更新
  const updateAcceptableAnswer = (index: number, value: string) => {
    const newAnswers = [...acceptableAnswers];
    newAnswers[index] = value;
    setAcceptableAnswers(newAnswers);
  };

  // 許容回答を追加
  const addAcceptableAnswer = () => {
    setAcceptableAnswers([...acceptableAnswers, '']);
  };

  // 許容回答を削除
  const removeAcceptableAnswer = (index: number) => {
    if (acceptableAnswers.length > 1) {
      const newAnswers = [...acceptableAnswers];
      newAnswers.splice(index, 1);
      setAcceptableAnswers(newAnswers);
    }
  };

  // クイズフォームの検証
  const validateQuizForm = () => {
    if (!quizTitle.trim()) {
      setErrorMessage('クイズのタイトルを入力してください');
      return false;
    }
    
    if (!question.trim()) {
      setErrorMessage('問題文を入力してください');
      return false;
    }
    
    if (type === 'multiple_choice') {
      // 選択肢が全て入力されているか確認
      if (choices.some(choice => !choice.trim())) {
        setErrorMessage('全ての選択肢を入力してください');
        return false;
      }
      
      // 正解が選択されているか確認
      if (!correctAnswer) {
        setErrorMessage('正解を選択してください');
        return false;
      }
    } else if (type === 'input') {
      // 正解が入力されているか確認
      if (!correctAnswer.trim()) {
        setErrorMessage('正解を入力してください');
        return false;
      }
    }
    
    setErrorMessage('');
    return true;
  };

  // クイズを保存
  const handleSave = () => {
    if (!validateQuizForm()) return;

    const quizData: Omit<Quiz, 'quizId' | 'createdAt'> = {
      title: quizTitle,
      question,
      type,
      choices,
      correctAnswer,
      acceptableAnswers,
      explanation,
      genre,
      difficulty,
      createdBy,
      useCount: 0,
      correctCount: 0
    };
    
    onSave(quizData);
  };

  return (
    <div className="border border-gray-200 rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-medium">{editingQuiz ? 'クイズを編集' : '新しいクイズ'}</h3>
        <button
          type="button"
          onClick={onCancel}
          className="text-gray-500 hover:text-gray-700"
        >
          キャンセル
        </button>
      </div>
      
      {errorMessage && (
        <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 rounded-lg mb-4">
          <p>{errorMessage}</p>
        </div>
      )}
      
      <div className="space-y-4">
        <div>
          <label htmlFor="quizTitle" className="form-label">クイズタイトル</label>
          <input
            type="text"
            id="quizTitle"
            className="form-input"
            value={quizTitle}
            onChange={(e) => setQuizTitle(e.target.value)}
            placeholder="クイズのタイトルを入力"
            required
          />
        </div>
        
        <div>
          <label htmlFor="question" className="form-label">問題文</label>
          <textarea
            id="question"
            className="form-textarea"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="問題文を入力"
            rows={3}
            required
          ></textarea>
        </div>
        
        <div>
          <label className="form-label">難易度</label>
          <div className="flex items-center space-x-2">
            {[1, 2, 3, 4, 5].map((level) => (
              <button
                key={level}
                type="button"
                className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  level <= difficulty
                    ? 'bg-yellow-400 text-white'
                    : 'bg-gray-200 text-gray-600'
                }`}
                onClick={() => setDifficulty(level as QuizDifficulty)}
              >
                {level}
              </button>
            ))}
          </div>
        </div>
        
        <div>
          <label className="form-label">問題タイプ</label>
          <div className="flex space-x-4">
            <label className="flex items-center">
              <input
                type="radio"
                name="type"
                value="multiple_choice"
                checked={type === 'multiple_choice'}
                onChange={() => setType('multiple_choice')}
                className="mr-2"
              />
              選択式
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                name="type"
                value="input"
                checked={type === 'input'}
                onChange={() => setType('input')}
                className="mr-2"
              />
              入力式
            </label>
          </div>
        </div>
        
        {/* 選択式の場合の選択肢 */}
        {type === 'multiple_choice' && (
          <div className="space-y-3">
            <p className="form-label">選択肢</p>
            
            {choices.map((choice, index) => (
              <div key={index} className="flex items-center">
                <label className="inline-flex items-center mr-4">
                  <input
                    type="radio"
                    name="correctAnswer"
                    value={choice}
                    checked={correctAnswer === choice}
                    onChange={() => setCorrectAnswer(choice)}
                    className="mr-2"
                    disabled={!choice.trim()}
                  />
                  <span className="w-6 h-6 flex items-center justify-center bg-indigo-100 text-indigo-800 rounded-full mr-2">
                    {String.fromCharCode(65 + index)}
                  </span>
                </label>
                <input
                  type="text"
                  value={choice}
                  onChange={(e) => updateChoice(index, e.target.value)}
                  className="form-input"
                  placeholder={`選択肢 ${String.fromCharCode(65 + index)}`}
                  required
                />
              </div>
            ))}
          </div>
        )}
        
        {/* 入力式の場合の正解と許容回答 */}
        {type === 'input' && (
          <div className="space-y-4">
            <div>
              <label htmlFor="correctAnswer" className="form-label">正解</label>
              <input
                type="text"
                id="correctAnswer"
                className="form-input"
                value={correctAnswer}
                onChange={(e) => setCorrectAnswer(e.target.value)}
                placeholder="正解を入力"
              />
            </div>
            
            <div>
              <label className="form-label">許容される他の回答 (省略可)</label>
              {acceptableAnswers.map((answer, index) => (
                <div key={index} className="flex items-center mb-2">
                  <input
                    type="text"
                    value={answer}
                    onChange={(e) => updateAcceptableAnswer(index, e.target.value)}
                    className="form-input mr-2"
                    placeholder="別の正解を入力"
                  />
                  {acceptableAnswers.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeAcceptableAnswer(index)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <FaTrash />
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={addAcceptableAnswer}
                className="text-sm text-indigo-600 hover:text-indigo-800 flex items-center mt-2"
              >
                <FaPlus className="mr-1" size={12} /> 別の回答を追加
              </button>
              <p className="text-sm text-gray-500 mt-1">
                入力式の問題では表記ゆれを考慮して複数の回答を許容できます
              </p>
            </div>
          </div>
        )}
        
        <div>
          <label htmlFor="quizExplanation" className="form-label">解説 (省略可)</label>
          <textarea
            id="quizExplanation"
            className="form-textarea"
            value={explanation}
            onChange={(e) => setExplanation(e.target.value)}
            placeholder="解説を入力"
            rows={3}
          ></textarea>
        </div>
        
        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={handleSave}
            className="btn-primary flex items-center"
          >
            {editingQuiz ? (
              <>
                <FaCheck className="mr-2" /> 更新する
              </>
            ) : (
              <>
                <FaPlus className="mr-2" /> 追加する
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default QuizFormEditor;
