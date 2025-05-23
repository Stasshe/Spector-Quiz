'use client';

import { useEffect, useRef } from 'react';
import { useQuiz } from '@/hooks/useQuiz';
import { useRouter, usePathname } from 'next/navigation';

// クイズルームの状態を監視して、必要に応じてリダイレクトするコンポーネント
export default function QuizRoomRedirectManager() {
  const { quizRoom } = useQuiz();
  const router = useRouter();
  const pathname = usePathname();
  const redirectInProgressRef = useRef(false);
  const lastPathRef = useRef(pathname);
  const roomIdRef = useRef<string | null>(null);

  useEffect(() => {
    // quizRoomが変更されたらroomIdを更新
    if (quizRoom && quizRoom.roomId) {
      roomIdRef.current = quizRoom.roomId;
    }
  }, [quizRoom]);

  useEffect(() => {
    // リダイレクト処理に使うクリーンアップ関数を定義
    let cleanupTimers: NodeJS.Timeout[] = [];
    
    // クイズが進行中かつ有効なroomIdがある場合のみ処理
    if (quizRoom && quizRoom.status === 'in_progress' && quizRoom.roomId) {
      // すでにルームページにいる場合は何もしない
      if (pathname?.includes('/quiz/room')) {
        return;
      }

      // リダイレクトが既に進行中でなければ実行
      if (!redirectInProgressRef.current) {
        console.log('[QuizRoomRedirectManager] クイズ進行中にページ移動を検出。ルームページに強制リダイレクト');
        
        // リダイレクト進行中フラグをセット
        redirectInProgressRef.current = true;
        
        // window.location を使用した直接リダイレクト
        const redirectTimer = setTimeout(() => {
          try {
            // まずrouter.pushを試す
            router.push(`/quiz/room?id=${quizRoom.roomId}`);
            
            // バックアップとして直接リダイレクト
            const backupTimer = setTimeout(() => {
              window.location.href = `/quiz/room?id=${quizRoom.roomId}`;
            }, 500);
            
            cleanupTimers.push(backupTimer);
          } catch (error) {
            console.error('[QuizRoomRedirectManager] リダイレクトエラー:', error);
            // エラー時は直接リダイレクト
            window.location.href = `/quiz/room?id=${quizRoom.roomId}`;
          }
          
          // リダイレクト後、フラグをリセット
          const resetTimer = setTimeout(() => {
            redirectInProgressRef.current = false;
          }, 2000);
          
          cleanupTimers.push(resetTimer);
        }, 500);
        
        cleanupTimers.push(redirectTimer);
      }
    }
    
    // クリーンアップ関数
    return () => {
      cleanupTimers.forEach(timer => clearTimeout(timer));
    };
  }, [quizRoom, router, pathname]);

  // 何もレンダリングしない
  return null;
}
