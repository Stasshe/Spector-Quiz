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
      console.log('[QuizRoomRedirectManager] roomId更新:', quizRoom.roomId);
    } else if (quizRoom) {
      console.error('[QuizRoomRedirectManager] quizRoomにroomIdがありません:', quizRoom);
    }
  }, [quizRoom]);

  useEffect(() => {
    // リダイレクト処理に使うクリーンアップ関数を定義
    let cleanupTimers: NodeJS.Timeout[] = [];
    
    // クイズが進行中かつ有効なroomIdがある場合のみ処理
    if (quizRoom && quizRoom.status === 'in_progress' && quizRoom.roomId) {
      // デバッグ情報を出力
      console.log('[QuizRoomRedirectManager] 進行中クイズルーム検出:', {
        roomId: quizRoom.roomId,
        currentPath: pathname,
        inRoom: pathname?.includes('/quiz/room')
      });
      
      // すでにルームページにいる場合は何もしない
      if (pathname?.includes('/quiz/room')) {
        return;
      }

      // リダイレクトが既に進行中でなければ実行
      if (!redirectInProgressRef.current) {
        console.log('[QuizRoomRedirectManager] クイズ進行中にページ移動を検出。ルームページに強制リダイレクト：', quizRoom.roomId);
        
        // リダイレクト進行中フラグをセット
        redirectInProgressRef.current = true;
        
        // window.location を使用した直接リダイレクト
        const redirectTimer = setTimeout(() => {
          try {
            // まずrouter.pushを試す
            router.push(`/quiz/room?id=${quizRoom.roomId}`);
            console.log('[QuizRoomRedirectManager] router.pushでリダイレクト完了');
            
            // バックアップとして直接リダイレクト
            const backupTimer = setTimeout(() => {
              console.log('[QuizRoomRedirectManager] バックアップリダイレクト実行');
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
            console.log('[QuizRoomRedirectManager] リダイレクトフラグリセット');
          }, 2000);
          
          cleanupTimers.push(resetTimer);
        }, 500);
        
        cleanupTimers.push(redirectTimer);
      }
    } else if (quizRoom && quizRoom.status === 'in_progress') {
      // roomIdがない場合
      console.error('[QuizRoomRedirectManager] クイズルームにroomIdがありません:', quizRoom);
    }
    
    // クリーンアップ関数
    return () => {
      cleanupTimers.forEach(timer => clearTimeout(timer));
    };
  }, [quizRoom, router, pathname]);

  // 何もレンダリングしない
  return null;
}
