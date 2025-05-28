'use client';

import { db, usersDb } from '@/config/firebase';
import { useAuth } from '@/context/AuthContext';
import { useQuiz } from '@/hooks/useQuiz';
import { doc, getDoc } from 'firebase/firestore';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

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
    
    // クイズルームページにいる場合の処理（末尾のスラッシュも考慮）
    if (pathname && (pathname.includes('/quiz/room') || pathname === '/quiz/room/')) {
      console.log('[QuizRoomRedirectManager] クイズルームページに滞在中 - リダイレクト処理は無効化');
      
      // クイズルームページにいる場合はリダイレクト処理をスキップするためのフラグを設定
      redirectInProgressRef.current = true;
      
      // window.inQuizRoomPageフラグも設定（グローバルフラグとして使用）
      if (typeof window !== 'undefined') {
        window.inQuizRoomPage = true;
      }
      
      // 5秒後にフラグをリセット（ページ内移動のための時間）
      const timer = setTimeout(() => {
        redirectInProgressRef.current = false;
      }, 3000);
      
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
        }, 3000);
        
        return () => clearTimeout(timer);
      } else {
        // クイズルームページ以外にいる場合はフラグをリセット
        window.inQuizRoomPage = false;
      }
    }
  }, [pathname, currentUser]);

  // ユーザーがログインしている場合、Firestoreからルーム情報を取得
  useEffect(() => {
    if (currentUser && (!quizRoom || !quizRoom.roomId)) {
      const fetchRoomFromFirestore = async () => {
        try {
          const userRef = doc(usersDb, 'users', currentUser.uid);
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
                
                // 公式クイズの場合は特別処理（quizIdがユーザー作成ではなく公式データを参照するため）
                if (roomData.quizType === 'official' && roomData.status === 'in_progress') {
                  console.log('[QuizRoomRedirectManager] 公式クイズルームを検出。特別処理を適用します');
                  
                  // 無限リダイレクトを防ぐために、公式クイズであることをマーク
                  if (typeof window !== 'undefined') {
                    window.isOfficialQuiz = true;
                  }
                }
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
    
    // 最近エラーが発生したかどうかをチェック（エラー発生後のリダイレクト抑制用）
    const hasRecentError = typeof window !== 'undefined' && window.quizErrorTimestamp && 
      (Date.now() - window.quizErrorTimestamp < 3000);
    
    // エラーが発生している場合はリダイレクトを一時的にスキップ
    if (hasRecentError) {
      console.log('[QuizRoomRedirectManager] 最近エラーが発生したため、リダイレクトを一時的に停止します');
      // 5秒後にエラーフラグをリセット
      const errorResetTimer = setTimeout(() => {
        if (typeof window !== 'undefined') {
          window.quizErrorTimestamp = null;
        }
      }, 3000);
      cleanupTimers.push(errorResetTimer);
      return;
    }
    
    // クイズが進行中かつ有効なroomIdがある場合のみ処理
    if (quizRoom && quizRoom.status === 'in_progress' && activeRoomId) {
      // 現在のパスがすでに正しいルームページの場合はスキップ
      const currentRoomIdFromPath = pathname?.includes('/quiz/room') && new URLSearchParams(window?.location?.search || '').get('id');
      if (currentRoomIdFromPath === activeRoomId) {
        console.log('[QuizRoomRedirectManager] 既に正しいルームページにいます:', activeRoomId);
        return;
      }
      
      // デバッグ情報を出力
      console.log('[QuizRoomRedirectManager] 進行中クイズルーム検出:', {
        roomId: activeRoomId,
        currentPath: pathname,
        inRoom: pathname?.includes('/quiz/room'),
        isOfficialQuiz: typeof window !== 'undefined' ? window.isOfficialQuiz : false,
        redirectInProgress: redirectInProgressRef.current
      });
      
      // すでにルームページにいる場合の詳細チェック
      const inRoomPage = 
        (pathname?.includes('/quiz/room')) || 
        (typeof window !== 'undefined' && window.inQuizRoomPage);
      
      if (inRoomPage) {
        // URLパラメータから現在のルームIDを取得
        const currentRoomIdFromUrl = typeof window !== 'undefined' ? 
          new URLSearchParams(window.location.search).get('id') : null;
        
        // 既に正しいルームにいる場合はリダイレクトをスキップ
        if (currentRoomIdFromUrl === activeRoomId) {
          console.log('[QuizRoomRedirectManager] 既に正しいルームページにいます:', activeRoomId);
          return;
        }
        
        console.log('[QuizRoomRedirectManager] すでにルームページにいるため、リダイレクト処理をスキップ', {
          pathname,
          currentRoomIdFromUrl,
          targetRoomId: activeRoomId,
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
          
          // クイズ取得エラーの検出と記録のためのエラーハンドラを設定
          if (typeof window !== 'undefined') {
            // クイズエラーの検出とタイムスタンプ記録のためのエラーハンドラ
            const originalOnError = window.onerror;
            window.onerror = function(message, source, lineno, colno, error) {
              // クイズが見つからないエラーを検出
              if (message && (
                message.toString().includes('クイズが見つかりません') || 
                message.toString().includes('Error fetching quiz')
              )) {
                console.log('[QuizRoomRedirectManager] クイズ取得エラーを検出。リダイレクトを一時停止します');
                window.quizErrorTimestamp = Date.now();
              }
              
              // 元のエラーハンドラを呼び出し
              if (originalOnError) {
                return originalOnError.apply(this, arguments as any);
              }
              return false;
            };
            
            // エラーハンドラクリーンアップ用のタイマー
            const cleanupErrorHandler = setTimeout(() => {
              window.onerror = originalOnError;
            }, 6000);
            cleanupTimers.push(cleanupErrorHandler);
          }
          
          // 直接リダイレクト
          try {
            // パス構築して安全に遷移
            const redirectUrl = `/quiz/room?id=${encodeURIComponent(activeRoomId)}`;
            console.log(`[QuizRoomRedirectManager] リダイレクト実行: ${redirectUrl}`);
            
            // 公式クイズでエラーが発生したことがある場合はクエリパラメータを追加
            const isOfficialQuiz = typeof window !== 'undefined' ? window.isOfficialQuiz : false;
            const finalUrl = isOfficialQuiz ? `${redirectUrl}&official=true` : redirectUrl;
            
            // App Routerを使用（Next.jsの推奨方法）- より強制的なreplace方式を使用
            router.replace(finalUrl);
            
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
                window.location.href = finalUrl;
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
