'use client';

import { useState, useEffect } from 'react';
import { FaTrophy, FaTimes } from 'react-icons/fa';
import { RankInfo } from '@/utils/rankCalculator';

interface RankUpNotificationData {
  message: string;
  newRank: RankInfo;
  timestamp: number;
}

export default function RankUpNotification() {
  const [notification, setNotification] = useState<RankUpNotificationData | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // コンポーネントマウント時にローカルストレージをチェック
    const checkForRankUp = () => {
      if (typeof window === 'undefined') return;
      
      const stored = localStorage.getItem('rankUpNotification');
      if (stored) {
        try {
          const data: RankUpNotificationData = JSON.parse(stored);
          
          // 24時間以内の通知のみ表示
          const now = Date.now();
          const hoursSinceRankUp = (now - data.timestamp) / (1000 * 60 * 60);
          
          if (hoursSinceRankUp < 24) {
            setNotification(data);
            setIsVisible(true);
            
            // 通知を表示したらローカルストレージから削除
            localStorage.removeItem('rankUpNotification');
          } else {
            // 古い通知は削除
            localStorage.removeItem('rankUpNotification');
          }
        } catch (error) {
          console.error('ランクアップ通知の解析に失敗:', error);
          localStorage.removeItem('rankUpNotification');
        }
      }
    };

    checkForRankUp();
    
    // 5秒後に自動で非表示
    const timer = setTimeout(() => {
      if (isVisible) {
        handleClose();
      }
    }, 5000);

    return () => clearTimeout(timer);
  }, [isVisible]);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(() => {
      setNotification(null);
    }, 300); // アニメーション完了後にstate削除
  };

  if (!notification) return null;

  return (
    <div
      className={`fixed top-4 right-4 z-50 transform transition-all duration-300 ${
        isVisible 
          ? 'translate-x-0 opacity-100 scale-100' 
          : 'translate-x-full opacity-0 scale-95'
      }`}
    >
      <div className="bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 text-white rounded-lg shadow-2xl p-4 max-w-sm animate-pulse-slow">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-white rounded-full p-2">
              <FaTrophy className="text-yellow-500 text-xl" />
            </div>
            <div>
              <h3 className="font-bold text-lg">ランクアップ！</h3>
              <div className={`inline-block px-2 py-1 rounded text-sm font-semibold ${notification.newRank.color} ${notification.newRank.bgColor}`}>
                {notification.newRank.name}
              </div>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="text-white hover:text-gray-200 transition-colors"
          >
            <FaTimes />
          </button>
        </div>
        <p className="mt-2 text-sm opacity-90">
          {notification.message}
        </p>
        <div className="mt-3 text-xs opacity-75">
          {notification.newRank.description}
        </div>
      </div>
    </div>
  );
}
