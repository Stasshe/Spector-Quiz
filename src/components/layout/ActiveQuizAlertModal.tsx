'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaExclamationTriangle, FaTimes } from 'react-icons/fa';
import { useQuiz } from '@/hooks/useQuiz';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { db } from '@/config/firebase';
import { doc, getDoc } from 'firebase/firestore';

export default function ActiveQuizAlertModal() {
  const { quizRoom } = useQuiz();
  const { currentUser } = useAuth();
  const router = useRouter();
  const [showAlert, setShowAlert] = React.useState(false);
  const [manualRoomId, setManualRoomId] = React.useState<string | null>(null);
  
  // クイズルームが進行中の場合、アラートを表示する
  React.useEffect(() => {
    // quizRoomがnullの場合や、既にquizRoomページにいる場合は何もしない
    if (!quizRoom || location.pathname.includes('/quiz/room')) {
      setShowAlert(false);
      return;
    }
    
    // ユーザードキュメントからルームIDを確認
    const checkRoomIdFromFirebase = async () => {
      try {
        if (!quizRoom.roomId && currentUser) {
          console.log('[ActiveQuizAlertModal] quizRoomにroomIdがありません。Firebaseから取得を試みます');
          // ユーザードキュメントから現在のルームIDを取得
          const userRef = doc(db, 'users', currentUser.uid);
          const userDoc = await getDoc(userRef);
          if (userDoc.exists() && userDoc.data().currentRoomId) {
            const roomId = userDoc.data().currentRoomId;
            console.log(`[ActiveQuizAlertModal] Firebaseからルームを取得: ${roomId}`);
            
            // Firestoreから直接ルーム情報を取得
            const roomRef = doc(db, 'quiz_rooms', roomId);
            const roomSnap = await getDoc(roomRef);
            if (roomSnap.exists()) {
              const roomData = roomSnap.data();
              console.log('[ActiveQuizAlertModal] Firebaseから取得したルーム情報:', {
                roomId: roomId,
                status: roomData.status,
                name: roomData.name
              });
              
              // 手動でルームIDを保存
              setManualRoomId(roomId);
            }
          }
        }
      } catch (err) {
        console.error('[ActiveQuizAlertModal] ルームID確認エラー:', err);
      }
    };
    
    // デバッグ情報をコンソールに出力
    console.log('[ActiveQuizAlertModal] クイズルーム情報:', {
      roomId: quizRoom.roomId || manualRoomId,
      status: quizRoom.status,
      name: quizRoom.name
    });
    
    // roomIdがない場合はFirebaseから取得を試みる
    if (!quizRoom.roomId && !manualRoomId) {
      checkRoomIdFromFirebase();
    }
    
    // クイズが進行中の場合のみアラートを表示
    if (quizRoom.status === 'in_progress') {
      setShowAlert(true);
      
      // 3秒後に自動的にルームページにリダイレクトする処理は削除
      // QuizRoomRedirectManagerがリダイレクトを担当するため
      // アラートの表示のみを行う
    } else {
      // 進行中でない場合はアラートを非表示
      setShowAlert(false);
    }
  }, [quizRoom, currentUser, manualRoomId]);

  if (!showAlert) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      >
        <motion.div
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.9, y: 20 }}
          className="bg-white rounded-lg p-6 w-full max-w-md shadow-xl"
        >
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-red-600 flex items-center">
              <FaExclamationTriangle className="mr-2" />
              進行中のクイズがあります
            </h2>
            <button
              onClick={() => setShowAlert(false)}
              className="text-gray-500 hover:text-gray-800"
            >
              <FaTimes size={20} />
            </button>
          </div>
          
          <div className="mb-6">
            <p className="text-gray-700 mb-4">
              「{quizRoom?.name || 'クイズルーム'}」のクイズが進行中です。
              下のボタンをクリックしてクイズルームに戻ってください。
            </p>
            <div className="w-full bg-gray-200 h-2 rounded-full mt-4">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: '100%' }}
                transition={{ duration: 3 }}
                className="bg-indigo-600 h-2 rounded-full"
              />
            </div>
          </div>
          
          <div className="flex justify-end space-x-2">
            <button
              onClick={() => {
                // quizRoom.roomId または manualRoomId を使用
                const roomId = quizRoom?.roomId || manualRoomId;
                
                if (roomId) {
                  try {
                    console.log('[ActiveQuizAlertModal] ルームにリダイレクト:', roomId);
                    
                    // まずNext.jsのrouterを使用
                    router.push(`/quiz/room?id=${roomId}`);
                    
                    // バックアップとして直接リダイレクト
                    setTimeout(() => {
                      window.location.href = `/quiz/room?id=${roomId}`;
                    }, 300);
                  } catch (error) {
                    console.error('[ActiveQuizAlertModal] リダイレクトエラー:', error);
                    // エラー時は直接リダイレクト
                    window.location.href = `/quiz/room?id=${roomId}`;
                  }
                  setShowAlert(false);
                } else {
                  console.error('[ActiveQuizAlertModal] ルームIDが存在しません:', {
                    quizRoom,
                    manualRoomId
                  });
                  alert('ルームIDが取得できませんでした。ホームページに戻ります。');
                  router.push('/');
                }
              }}
              className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors"
            >
              ルームに戻る
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
