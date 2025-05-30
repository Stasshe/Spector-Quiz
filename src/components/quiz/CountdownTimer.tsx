'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

interface CountdownTimerProps {
  duration: number; // カウントダウン時間（ミリ秒）
  onComplete?: () => void;
  className?: string;
}

export default function CountdownTimer({ duration, onComplete, className = '' }: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState(duration);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    if (timeLeft <= 0) {
      setIsVisible(false);
      onComplete?.();
      return;
    }

    const timer = setTimeout(() => {
      setTimeLeft(prev => Math.max(0, prev - 100));
    }, 100);

    return () => clearTimeout(timer);
  }, [timeLeft, onComplete]);

  if (!isVisible) return null;

  const seconds = Math.ceil(timeLeft / 1000);
  const progress = (timeLeft / duration) * 100;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      className={`inline-flex items-center space-x-2 bg-white/90 backdrop-blur-sm rounded-full px-3 py-1 shadow-md border ${className}`}
    >
      <div className="relative w-4 h-4">
        <svg className="w-4 h-4 transform -rotate-90" viewBox="0 0 16 16">
          <circle
            cx="8"
            cy="8"
            r="6"
            fill="none"
            stroke="#e5e7eb"
            strokeWidth="2"
          />
          <motion.circle
            cx="8"
            cy="8"
            r="6"
            fill="none"
            stroke="#3b82f6"
            strokeWidth="2"
            strokeLinecap="round"
            strokeDasharray={`${2 * Math.PI * 6}`}
            initial={{ strokeDashoffset: 0 }}
            animate={{ strokeDashoffset: `${2 * Math.PI * 6 * (1 - progress / 100)}` }}
            transition={{ duration: 0.1, ease: "linear" }}
          />
        </svg>
      </div>
      <span className="text-xs font-medium text-gray-700">
        {seconds}秒後
      </span>
    </motion.div>
  );
}
