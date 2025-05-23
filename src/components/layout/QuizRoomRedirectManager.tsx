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

  // クイズルームページにいるかどうかを検出
  useEffect(() => {
    // 認証チェック - 未ログインの場合は何もしない
    if (!currentUser) {
      return;
    }
    
    // クイズルームページにいる場合の処理
    if (pathname && pathname.includes('/quiz/room')) {
      console.log('[QuizRoomRedirectManager] クイズルームページに滞在中 - リダイレクト処理は無効化');
      
      // クイズルームページにいる場合はリダイレクト処理をスキップするためのフラグを設定
      redirectInProgressRef.current = true;
      
      // 5秒後にフラグをリセット（ページ内移動のための時間）
      const timer = setTimeout(() => {
        redirectInProgressRef.current = false;
      }, 5000);
      
      return () => clearTimeout(timer);
    } else if (typeof window !== 'undefined') {
      // パスからでは検出できない場合のフォールバック：window.inQuizRoomPageをチェック
      if (window.inQuizRoomPage) {
        console.log('[QuizRoomRedirectManager] window.inQuizRoomPage = true - リダイレクト処理は無効化');
        // 明示的にフラグをリセット（冗長性のため）
        redirectInProgressRef.current = true;
        
        // 5秒後にフラグをリセット
        const timer = setTimeout(() => {
          redirectInProgressRef.current = false;
        }, 5000);
        
        return () => clearTimeout(timer);
      }
    }
  }, [pathname, currentUser]);

  // ユーザーがログインしている場合、Firestoreからルーム情報を取得
  useEffect(() => {
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

  // メインのリダイレクト処理
  useEffect(() => {
    // 認証チェック - 未ログインの場合は何もしない
    if (!currentUser) {
      console.log('[QuizRoomRedirectManager] ユーザーが未ログインのため、リダイレクト処理をスキップ');
      return;
    }
    
    // リダイレクト処理に使うクリーンアップ関数を定義
    const cleanupTimers: NodeJS.Timeout[] = [];
    
    // ルームIDを決定（quizRoom.roomIdが優先、なければmanualRoomIdを使用）
    const activeRoomId = quizRoom?.roomId || manualRoomId || roomIdRef.current;
    
    // クイズが進行中かつ有効なroomIdがある場合のみ処理
    if (quizRoom && quizRoom.status === 'in_progress' && activeRoomId) {
      // デバッグ情報を出力
      console.log('[QuizRoomRedirectManager] 進行中クイズルーム検出:', {
        roomId: activeRoomId,
        currentPath: pathname,
        inRoom: pathname?.includes('/quiz/room'),
        redirectInProgress: redirectInProgressRef.current
      });
      
      // すでにルームページにいる場合は何もしない
      const inRoomPage = 
        (pathname?.includes('/quiz/room')) || 
        (typeof window !== 'undefined' && window.inQuizRoomPage);
      
      if (inRoomPage) {
        console.log('[QuizRoomRedirectManager] すでにルームページにいるため、リダイレクト処理をスキップ', {
          pathname,
          windowFlag: typeof window !== 'undefined' ? window.inQuizRoomPage : undefined
        });
        return;
      }
      
      // 認証ページへの遷移は許可
      if (pathname?.includes('/auth/')) {
        console.log('[QuizRoomRedirectManager] 認証ページへの遷移は許可します');
        return;
      }

      // パス変更を検知したときのみリダイレクト（同じページで再レンダリングされた場合はスキップ）
      const pathChanged = pathname !== lastPathRef.current;
      const isQuizPath = pathname?.includes('/quiz');
      
      if (pathChanged || (isQuizPath && !redirectInProgressRef.current)) {
        if (pathChanged) {
          console.log(`[QuizRoomRedirectManager] パス変更を検知: ${lastPathRef.current} -> ${pathname}`);
          lastPathRef.current = pathname;
        } else {
          console.log('[QuizRoomRedirectManager] クイズ関連ページにいるためリダイレクトチェックを実行');
        }
        
        // リダイレクトが既に進行中でなければ実行
        if (!redirectInProgressRef.current) {
          console.log('[QuizRoomRedirectManager] クイズ進行中にページ移動を検出。ルームページに強制リダイレクト：', activeRoomId);
          
          // リダイレクト進行中フラグをセット
          redirectInProgressRef.current = true;
          
          // 直接リダイレクト
          try {
            // パス構築して安全に遷移
            const redirectUrl = `/quiz/room?id=${encodeURIComponent(activeRoomId)}`;
            console.log(`[QuizRoomRedirectManager] リダイレクト実行: ${redirectUrl}`);
            
            // App Routerを使用（Next.jsの推奨方法）- より強制的なreplace方式を使用
            router.replace(redirectUrl);
            
            // バックアップとして1秒後に再チェック
            const backupTimer = setTimeout(() => {
              // 既にクイズルームページにいる場合はスキップ
              if (typeof window !== 'undefined' && 
                 (window.location.pathname.includes('/quiz/room') || window.inQuizRoomPage)) {
                console.log('[QuizRoomRedirectManager] すでにルームページに移動済みです');
                return;
              }
              
              console.log('[QuizRoomRedirectManager] バックアップリダイレクト実行');
              // 本当に緊急時のバックアップとしてwindow.location.hrefを使用
              if (typeof window !== 'undefined') {
                window.location.href = `/quiz/room?id=${activeRoomId}`;
              }
            }, 1000);
            
            cleanupTimers.push(backupTimer);
          } catch (error) {
            console.error('[QuizRoomRedirectManager] リダイレクトエラー:', error);
            // エラー時のみwindow.location.replaceを使用
            try {
              if (typeof window !== 'undefined') {
                // バックアップとして直接リダイレクト
                console.log('[QuizRoomRedirectManager] router.replaceに失敗。バックアップリダイレクト試行...');
                window.location.replace(`/quiz/room?id=${activeRoomId}`);
              }
            } catch (locationError) {
              console.error('[QuizRoomRedirectManager] バックアップリダイレクトでもエラー:', locationError);
            }
          }
          
          // リダイレクト完了後のフラグリセット用タイマー
          const resetTimer = setTimeout(() => {
            redirectInProgressRef.current = false;
            console.log('[QuizRoomRedirectManager] リダイレクトフラグリセット');
          }, 3000);
          
          cleanupTimers.push(resetTimer);
        }
      }
    } else if (quizRoom && quizRoom.status === 'in_progress') {
      // roomIdがない場合
      console.error('[QuizRoomRedirectManager] クイズルームにroomIdがありません:', quizRoom);
    }
    
    // クリーンアップ関数
    return () => {
      cleanupTimers.forEach(timer => clearTimeout(timer));
    };
  }, [quizRoom, router, pathname, manualRoomId, currentUser]);

  // 何もレンダリングしない
  return null;
}
