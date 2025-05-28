'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaClock, FaExclamationTriangle } from 'react-icons/fa';
import { getQuestionTimeout } from '@/config/quizConfig';

interface QuizTimerProps {
  genre: string;
  isActive: boolean;
  onTimeUp?: () => void;
  resetKey?: string; // タイマーをリセットするためのキー
  isAnswerRevealed?: boolean; // 正答が表示されているかどうか
}

export default function QuizTimer({ genre, isActive, onTimeUp, resetKey, isAnswerRevealed }: QuizTimerProps) {
  const totalTime = getQuestionTimeout(genre); // ジャンル別の制限時間（ミリ秒）
  const [timeLeft, setTimeLeft] = useState(totalTime);
  const [isVisible, setIsVisible] = useState(false);
  const lastResetKeyRef = useRef<string>(''); // 前回のresetKeyを記録
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isInitializedRef = useRef(false);

  // ジャンルまたは制限時間が無効な場合は何も表示しない
  if (!genre || totalTime <= 0) {
    return null;
  }

  // タイマーをリセット（resetKeyが変わった時のみ）
  useEffect(() => {
    console.log('[QuizTimer] リセット処理チェック:', {
      resetKey,
      lastResetKey: lastResetKeyRef.current,
      totalTime,
      isInitialized: isInitializedRef.current
    });
    
    // resetKeyが存在し、前回と異なる場合のみリセット
    if (resetKey && resetKey !== lastResetKeyRef.current) {
      console.log('[QuizTimer] タイマーリセット実行:', resetKey);
      
      // 既存のインターバルをクリア
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setTimeLeft(totalTime);
      lastResetKeyRef.current = resetKey;
      isInitializedRef.current = true;
      
      // 初期化完了後に表示状態を更新
      setIsVisible(true);
    }
  }, [resetKey, totalTime]);

  // 表示状態の決定（resetKeyまたは答え表示状態が変わった時）
  useEffect(() => {
    // resetKeyが存在する場合は表示
    const shouldBeVisible = !!resetKey;
    
    console.log('[QuizTimer] 表示状態チェック:', {
      resetKey,
      shouldBeVisible,
      currentIsVisible: isVisible,
      isAnswerRevealed
    });
    
    if (shouldBeVisible !== isVisible) {
      setIsVisible(shouldBeVisible);
    }
  }, [resetKey, isAnswerRevealed, isVisible]);

  // カウントダウン処理（isActiveが変わった時のみ）
  useEffect(() => {
    // 既存のインターバルをクリア
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    // 答えが表示されている場合はタイマーを停止
    if (isAnswerRevealed || !isActive || !isInitializedRef.current) {
      return;
    }

    intervalRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 100) { // 100ms以下になったら終了
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          onTimeUp?.();
          return 0;
        }
        
        return prev - 100; // 100msごとに更新
      });
    }, 100);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isActive, onTimeUp, isInitializedRef.current, isAnswerRevealed]); // isAnswerRevealedを依存に追加

  // 時間の表示形式を変換
  const formatTime = (milliseconds: number) => {
    const seconds = Math.ceil(milliseconds / 1000);
    return seconds;
  };

  // 進行率を計算（0-1）
  const progress = 1 - (timeLeft / totalTime);
  
  // 時間に基づく色の計算
  const getTimerColor = () => {
    const remainingRatio = timeLeft / totalTime;
    
    if (remainingRatio > 0.5) {
      return 'text-green-600 border-green-500';
    } else if (remainingRatio > 0.25) {
      return 'text-yellow-600 border-yellow-500';
    } else {
      return 'text-red-600 border-red-500';
    }
  };

  // 背景色の計算
  const getProgressColor = () => {
    const remainingRatio = timeLeft / totalTime;
    
    if (remainingRatio > 0.5) {
      return 'bg-green-500';
    } else if (remainingRatio > 0.25) {
      return 'bg-yellow-500';
    } else {
      return 'bg-red-500';
    }
  };

  // 危険状態（残り5秒以下）の判定
  const isDangerous = timeLeft <= 5000;
  
  // 非常に危険状態（残り3秒以下）の判定
  const isCritical = timeLeft <= 3000;

  if (!isVisible) {
    return null;
  }

  // 答え表示中または停止中の状態を示すかどうか
  const isTimerPaused = isAnswerRevealed || !isActive;

  // 答え表示中または停止中の場合は特別な表示
  if (isTimerPaused && resetKey) {
    const statusText = isAnswerRevealed ? '正答表示中' : '時間切れ / 停止中';
    return (
      <div className="relative bg-gray-100 rounded-lg shadow-lg border-2 border-gray-300 p-4 w-full opacity-80">
        <div className="flex items-center mb-2">
          <FaClock className="mr-2 text-gray-500" />
          <span className="text-sm font-medium text-gray-500">{statusText}</span>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-gray-500">
            {formatTime(timeLeft)}
          </div>
          <div className="text-xs text-gray-400">秒</div>
        </div>
        <div className="mt-2 text-xs text-gray-500 text-center">
          {genre}
        </div>
      </div>
    );
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ 
          opacity: 1, 
          scale: isDangerous ? (isCritical ? 1.1 : 1.05) : 1, 
          y: 0 
        }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={{ 
          duration: 0.3,
          scale: { duration: 0.2 }
        }}
        className={`relative w-full ${getTimerColor()}`}
      >
        <div className={`relative bg-white rounded-lg shadow-lg border-2 p-4 w-full ${getTimerColor().split(' ')[1]}`}>
          {/* 危険時の警告アイコン */}
          {isDangerous && (
            <motion.div
              animate={{ 
                scale: [1, 1.2, 1],
                rotate: isCritical ? [0, -5, 5, 0] : 0
              }}
              transition={{ 
                duration: isCritical ? 0.5 : 1,
                repeat: Infinity
              }}
              className="absolute -top-2 -right-2"
            >
              <FaExclamationTriangle 
                className={`text-xl ${isCritical ? 'text-red-500' : 'text-yellow-500'}`} 
              />
            </motion.div>
          )}

          <div className="flex items-center mb-2">
            <motion.div
              animate={{ rotate: isDangerous ? [0, 10, -10, 0] : 0 }}
              transition={{ 
                duration: 0.5, 
                repeat: isDangerous ? Infinity : 0 
              }}
            >
              <FaClock className="mr-2" />
            </motion.div>
            <span className="text-sm font-medium">残り時間</span>
          </div>

          <div className="text-center">
            <motion.div
              animate={{ 
                scale: isDangerous ? [1, 1.1, 1] : 1,
                color: isCritical ? ['#dc2626', '#ef4444', '#dc2626'] : undefined
              }}
              transition={{ 
                duration: isCritical ? 0.3 : 0.5,
                repeat: isDangerous ? Infinity : 0
              }}
              className={`text-2xl font-bold ${getTimerColor().split(' ')[0]}`}
            >
              {formatTime(timeLeft)}
            </motion.div>
            <div className="text-xs text-gray-500">秒</div>
          </div>

          {/* プログレスバー */}
          <div className="mt-3">
            <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
              <motion.div
                className={`h-full rounded-full ${getProgressColor()}`}
                initial={{ width: '0%' }}
                animate={{ width: `${progress * 100}%` }}
                transition={{ duration: 0.1 }}
              />
            </div>
          </div>

          {/* ジャンル表示 */}
          <div className="mt-2 text-xs text-gray-600 text-center">
            {genre}
          </div>
        </div>

        {/* 時間切れ時のパルス効果 */}
        {timeLeft === 0 && (
          <motion.div
            className="absolute inset-0 bg-red-500 rounded-lg"
            animate={{
              opacity: [0, 0.3, 0],
              scale: [1, 1.05, 1]
            }}
            transition={{
              duration: 0.6,
              repeat: 3
            }}
          />
        )}
      </motion.div>
    </AnimatePresence>
  );
}
