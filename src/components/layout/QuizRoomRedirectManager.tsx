'use client';

import { useEffect, useRef, useState } from 'react';
import { useQuiz } from '@/hooks/useQuiz';
import { useAuth } from '@/context/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import { db } from '@/config/firebase';
import { doc, getDoc } from 'firebase/firestore';

// クイズルームの状態を監視して、必要に応じてリダイレクトするコンポーネント
export default function QuizRoomRedirectManager() {
  const { quizRoom } = useQuiz();
  const { currentUser } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const redirectInProgressRef = useRef(false);
  const lastPathRef = useRef(pathname);
  const roomIdRef = useRef<string | null>(null);
  const [manualRoomId, setManualRoomId] = useState<string | null>(null);

  useEffect(() => {
    // ユーザーがログインしている場合、Firestoreからルーム情報を取得
    if (currentUser && (!quizRoom || !quizRoom.roomId)) {
      const fetchRoomFromFirestore = async () => {
        try {
          const userRef = doc(db, 'users', currentUser.uid);
          const userDoc = await getDoc(userRef);
          
          if (userDoc.exists() && userDoc.data().currentRoomId) {
            const roomId = userDoc.data().currentRoomId;
            console.log(`[QuizRoomRedirectManager] Firebaseから現在のルームを検出: ${roomId}`);
            
            if (roomId) {
              setManualRoomId(roomId);
              roomIdRef.current = roomId;
              
              // ルーム情報を取得して状態を確認
              const roomRef = doc(db, 'quiz_rooms', roomId);
              const roomSnap = await getDoc(roomRef);
              if (roomSnap.exists()) {
                const roomData = roomSnap.data();
                console.log(`[QuizRoomRedirectManager] ルーム状態: ${roomData.status}`);
              }
            }
          }
        } catch (err) {
          console.error('[QuizRoomRedirectManager] ルーム情報取得エラー:', err);
        }
      };
      
      fetchRoomFromFirestore();
    }
  }, [currentUser, quizRoom]);

  useEffect(() => {
    // リダイレクト処理に使うクリーンアップ関数を定義
    let cleanupTimers: NodeJS.Timeout[] = [];
    
    // ルームIDを決定（quizRoom.roomIdが優先、なければmanualRoomIdを使用）
    const activeRoomId = quizRoom?.roomId || manualRoomId;
    
    // クイズが進行中かつ有効なroomIdがある場合のみ処理
    if (quizRoom && quizRoom.status === 'in_progress' && activeRoomId) {
      // デバッグ情報を出力
      console.log('[QuizRoomRedirectManager] 進行中クイズルーム検出:', {
        roomId: activeRoomId,
        currentPath: pathname,
        inRoom: pathname?.includes('/quiz/room')
      });
      
      // すでにルームページにいる場合は何もしない
      if (pathname?.includes('/quiz/room')) {
        return;
      }

      // リダイレクトが既に進行中でなければ実行
      if (!redirectInProgressRef.current) {
        console.log('[QuizRoomRedirectManager] クイズ進行中にページ移動を検出。ルームページに強制リダイレクト：', activeRoomId);
        
        // リダイレクト進行中フラグをセット
        redirectInProgressRef.current = true;
        
        // window.location を使用した直接リダイレクト
        const redirectTimer = setTimeout(() => {
          try {
            // まずrouter.pushを試す
            router.push(`/quiz/room?id=${activeRoomId}`);
            console.log('[QuizRoomRedirectManager] router.pushでリダイレクト完了');
            
            // バックアップとして直接リダイレクト
            const backupTimer = setTimeout(() => {
              console.log('[QuizRoomRedirectManager] バックアップリダイレクト実行');
              window.location.href = `/quiz/room?id=${activeRoomId}`;
            }, 500);
            
            cleanupTimers.push(backupTimer);
          } catch (error) {
            console.error('[QuizRoomRedirectManager] リダイレクトエラー:', error);
            // エラー時は直接リダイレクト
            window.location.href = `/quiz/room?id=${activeRoomId}`;
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
  }, [quizRoom, router, pathname, manualRoomId]);

  // 何もレンダリングしない
  return null;
}
