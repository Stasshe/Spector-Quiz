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
  localAnswerRevealed?: boolean; // ローカルの正答表示状態（Firestoreに依存しない）
  forceStart?: boolean; // 強制的にタイマーを開始するフラグ
}

export default function QuizTimer({ genre, isActive, onTimeUp, resetKey, localAnswerRevealed, forceStart }: QuizTimerProps) {
  // ジャンルまたは制限時間が無効な場合はデフォルト値を使用
  const effectiveGenre = genre || 'general';
  
  // totalTimeをuseRefで保持し、最初の有効な値をキャッシュする
  const totalTimeRef = useRef<number>(0);
  // 初回のみジャンル別の制限時間を計算し、以降は同じ値を使用
  if (totalTimeRef.current === 0) {
    totalTimeRef.current = getQuestionTimeout(effectiveGenre);
    console.log(`[QuizTimer] ${effectiveGenre}のタイムアウト時間を設定:`, totalTimeRef.current);
  }
  
  const [timeLeft, setTimeLeft] = useState(totalTimeRef.current);
  const lastResetKeyRef = useRef<string>(''); // 前回のresetKeyを記録
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isInitializedRef = useRef(false);

  // 制限時間が無効な場合は処理しない
  if (totalTimeRef.current <= 0) {
    console.log('[QuizTimer] 制限時間が無効のため非表示:', { genre, effectiveGenre, totalTime: totalTimeRef.current });
    return null;
  }

  // resetKeyがない場合は非表示
  if (!resetKey) {
    console.log('[QuizTimer] resetKeyがないため非表示');
    return null;
  }

  // タイマーをリセット（resetKeyが変わった時のみ）
  useEffect(() => {
    // resetKeyが存在し、前回と異なる場合のみリセット
    if (resetKey && resetKey !== lastResetKeyRef.current) {
      console.log('[QuizTimer] 新しい問題検出 - タイマーリセット:', resetKey);
      
      // 既存のインターバルをクリア
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      
      setTimeLeft(totalTimeRef.current);
      lastResetKeyRef.current = resetKey;
      isInitializedRef.current = true;
      
      console.log('[QuizTimer] タイマーリセット完了:', { genre: effectiveGenre, totalTime: totalTimeRef.current });
      
      // 新しい問題では即座にタイマーを開始（localAnswerRevealedの初期値はfalseなので）
      if (isActive) {
        console.log('[QuizTimer] 新しい問題で即座にタイマー開始');
        intervalRef.current = setInterval(() => {
          setTimeLeft(prev => {
            if (prev <= 100) {
              if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
              }
              onTimeUp?.();
              return 0;
            }
            return prev - 100;
          });
        }, 100);
      }
    }
  }, [resetKey, isActive, onTimeUp, effectiveGenre]);

  // 答え表示状態が変わった時にタイマーを停止/再開
  useEffect(() => {
    if (!isInitializedRef.current) return; // 初期化前はスキップ
    
    if (localAnswerRevealed && intervalRef.current) {
      console.log('[QuizTimer] 答え表示のためタイマーを停止');
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    } else if (!localAnswerRevealed && !intervalRef.current && isActive) {
      console.log('[QuizTimer] 答え非表示のためタイマーを再開');
      intervalRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 100) {
            if (intervalRef.current) {
              clearInterval(intervalRef.current);
              intervalRef.current = null;
            }
            onTimeUp?.();
            return 0;
          }
          return prev - 100;
        });
      }, 100);
    }
  }, [localAnswerRevealed, isActive, onTimeUp]);

  // 時間の表示形式を変換
  const formatTime = (milliseconds: number) => {
    const seconds = Math.ceil(milliseconds / 1000);
    return seconds;
  };

  // 進行率を計算（0-1）
  const progress = 1 - (timeLeft / totalTimeRef.current);
  
  // 時間に基づく色の計算
  const getTimerColor = () => {
    const remainingRatio = timeLeft / totalTimeRef.current;
    
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
    const remainingRatio = timeLeft / totalTimeRef.current;
    
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

  // 答え表示中または停止中の状態を示すかどうか
  const isTimerPaused = localAnswerRevealed || !isActive;

  // 答え表示中または停止中の場合は特別な表示
  if (isTimerPaused && resetKey) {
    const statusText = localAnswerRevealed ? '正答表示中' : '時間切れ / 停止中';
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
          {effectiveGenre}
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
            {effectiveGenre}
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
