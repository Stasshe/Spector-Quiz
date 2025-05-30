'use client';

import React, { useState } from 'react';
import { FaRobot, FaSpinner, FaCheck, FaExclamationTriangle } from 'react-icons/fa';
import { AIQuizGenerationService } from '@/services/ai/aiQuizGenerationService';
import { useAuth } from '@/hooks/useAuth';

interface AIQuizGeneratorProps {
  onQuizGenerated: (unitId: string, unitName: string) => void;
  className?: string;
}

interface GenerationStep {
  step: 'idle' | 'generating' | 'saving' | 'completed' | 'waiting' | 'error';
  message: string;
  progress: number;
}

const AIQuizGenerator: React.FC<AIQuizGeneratorProps> = ({
  onQuizGenerated,
  className = ''
}) => {
  const { currentUser } = useAuth();
  const [topic, setTopic] = useState('');
  const [questionType, setQuestionType] = useState<'mixed' | 'multiple_choice' | 'input'>('mixed');
  const [generationStep, setGenerationStep] = useState<GenerationStep>({
    step: 'idle',
    message: '',
    progress: 0
  });
  const [errorMessage, setErrorMessage] = useState('');

  const handleGenerate = async () => {
    if (!topic.trim()) {
      setErrorMessage('トピックを入力してください');
      return;
    }

    if (!currentUser) {
      setErrorMessage('ログインが必要です');
      return;
    }

    setErrorMessage('');
    
    try {
      // ステップ1: AI生成
      setGenerationStep({
        step: 'generating',
        message: 'AI がクイズを生成しています...',
        progress: 20
      });

      const aiQuizUnit = await AIQuizGenerationService.generateQuizzes(
        topic,
        10, // デフォルト問題数
        questionType
      );

      // ステップ2: 保存
      setGenerationStep({
        step: 'saving',
        message: 'データベースに保存しています...',
        progress: 70
      });

      const unitName = `${topic}（AI生成）`;
      const unitId = await AIQuizGenerationService.saveGeneratedQuizUnit(
        aiQuizUnit,
        'AI生成',
        currentUser.uid,
        unitName
      );

      // ステップ3: 完了
      setGenerationStep({
        step: 'completed',
        message: `クイズが正常に生成されました！（${aiQuizUnit.quizzes.length}問）`,
        progress: 100
      });

      // ステップ4: 待機期間（8秒）
      setTimeout(() => {
        setGenerationStep({
          step: 'waiting',
          message: 'ルームを準備しています...',
          progress: 100
        });
      }, 2000);

      // 親コンポーネントに通知（4秒後）
      setTimeout(() => {
        onQuizGenerated(unitId, unitName);
      }, 4000);

      // フォームリセット（8秒後）
      setTimeout(() => {
        setTopic('');
        setGenerationStep({
          step: 'idle',
          message: '',
          progress: 0
        });
      }, 15000);

    } catch (error) {
      console.error('[AIQuizGenerator] エラー:', error);
      setGenerationStep({
        step: 'error',
        message: error instanceof Error ? error.message : 'クイズ生成中にエラーが発生しました',
        progress: 0
      });
      setErrorMessage(error instanceof Error ? error.message : 'クイズ生成中にエラーが発生しました');
      
      // エラーが発生した場合は親コンポーネントに通知しない
      // （重複したエラーメッセージを防ぐため）
      return;
    }
  };

  const isGenerating = generationStep.step === 'generating' || generationStep.step === 'saving';
  const isCompleted = generationStep.step === 'completed';
  const isWaiting = generationStep.step === 'waiting';
  const hasError = generationStep.step === 'error';
  const isProcessing = isGenerating || isCompleted || isWaiting;

  return (
    <div className={`bg-gradient-to-br from-purple-50 to-blue-50 border border-purple-200 rounded-lg p-6 ${className}`}>
      <div className="flex items-center mb-4">
        <FaRobot className="text-purple-600 text-2xl mr-3" />
        <h3 className="text-xl font-bold text-gray-800">AI クイズ生成</h3>
      </div>

      <p className="text-gray-600 mb-6">
        Gemini AI を使って、あなたの指定したトピックに関するクイズを自動生成します。
      </p>

      {/* 入力フォーム */}
      <div className="space-y-4 mb-6">
        {/* トピック入力 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            トピック・テーマ <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="例: 英語長文読解、日本の歴史、基礎数学"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
            disabled={isProcessing}
            maxLength={50}
          />
        </div>

        {/* 問題形式選択 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            問題形式
          </label>
          <select
            value={questionType}
            onChange={(e) => setQuestionType(e.target.value as 'multiple_choice' | 'mixed' | 'input')}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
            disabled={isProcessing}
          >
            <option value="multiple_choice">選択式のみ</option>
            <option value="mixed">混合（選択式 + 記述式）</option>
            <option value="input">記述式のみ</option>
          </select>
        </div>
      </div>

      {/* 進行状況表示 */}
      {(isGenerating || isCompleted || isWaiting || hasError) && (
        <div className="mb-4">
          <div className="flex items-center mb-2">
            {isGenerating && <FaSpinner className="animate-spin text-purple-600 mr-2" />}
            {(isCompleted || isWaiting) && <FaCheck className="text-green-600 mr-2" />}
            {hasError && <FaExclamationTriangle className="text-red-600 mr-2" />}
            <span className={`text-sm font-medium ${
              (isCompleted || isWaiting) ? 'text-green-600' : 
              hasError ? 'text-red-600' : 
              'text-purple-600'
            }`}>
              {generationStep.message}
            </span>
            {isWaiting && (
              <div className="ml-2 flex space-x-1">
                <div className="w-1 h-1 bg-green-500 rounded-full animate-pulse"></div>
                <div className="w-1 h-1 bg-green-500 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                <div className="w-1 h-1 bg-green-500 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
              </div>
            )}
          </div>
          
          {generationStep.progress > 0 && (
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className={`h-2 rounded-full transition-all duration-500 ${
                  (isCompleted || isWaiting) ? 'bg-green-500' : 
                  hasError ? 'bg-red-500' : 
                  'bg-purple-500'
                }`}
                style={{ width: `${generationStep.progress}%` }}
              />
            </div>
          )}
        </div>
      )}

      {/* エラーメッセージ */}
      {errorMessage && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-4">
          <div className="flex items-center">
            <FaExclamationTriangle className="mr-2" />
            <span className="text-sm">{errorMessage}</span>
          </div>
        </div>
      )}

      {/* 生成ボタン */}
      <button
        onClick={handleGenerate}
        disabled={isProcessing || !topic.trim() || !currentUser}
        className={`w-full py-3 px-4 rounded-md font-medium transition-colors ${
          isProcessing || !topic.trim() || !currentUser
            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
            : 'bg-purple-600 hover:bg-purple-700 text-white'
        }`}
      >
        {isGenerating ? (
          <div className="flex items-center justify-center">
            <FaSpinner className="animate-spin mr-2" />
            クイズを生成中...
          </div>
        ) : isWaiting ? (
          <div className="flex items-center justify-center">
            <FaSpinner className="animate-spin mr-2" />
            準備中...
          </div>
        ) : (
          <div className="flex items-center justify-center">
            <FaRobot className="mr-2" />
            AI クイズを生成
          </div>
        )}
      </button>

      {/* 注意事項 */}
      <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
        <p className="text-xs text-blue-700">
          <strong>注意：</strong> AI生成には数十秒かかる場合があります。生成されたクイズは自動的に保存され、すぐにプレイできるようになります。
        </p>
      </div>
    </div>
  );
};

export default AIQuizGenerator;
