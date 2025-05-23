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

  useEffect(() => {
    // パスが変わった時だけ実行するように修正
    if (pathname === lastPathRef.current) {
      return;
    }
    lastPathRef.current = pathname;
    
    // リダイレクトが既に進行中なら何もしない
    if (redirectInProgressRef.current) {
      return;
    }

    // クイズが進行中の場合のみ処理
    if (quizRoom && quizRoom.status === 'in_progress') {
      // すでにルームページにいる場合は何もしない
      if (pathname?.startsWith('/quiz/room')) {
        return;
      }

      console.log('[QuizRoomRedirectManager] クイズ進行中にページ移動を検出。ルームページに強制リダイレクト');
      
      // リダイレクト進行中フラグをセット
      redirectInProgressRef.current = true;
      
      // 1秒遅延してリダイレクト（ユーザーに状況を認識する時間を与える）
      const redirectTimer = setTimeout(() => {
        router.push(`/quiz/room?id=${quizRoom.roomId}`);
        // リダイレクト後、少し待ってからフラグをリセット
        setTimeout(() => {
          redirectInProgressRef.current = false;
        }, 1000);
      }, 1000);

      return () => {
        clearTimeout(redirectTimer);
      };
    }
  }, [quizRoom, router, pathname]);

  // 何もレンダリングしない
  return null;
}
