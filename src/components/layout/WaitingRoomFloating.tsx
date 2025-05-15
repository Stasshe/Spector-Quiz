'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { FaUserFriends, FaTimes, FaSignOutAlt, FaPlay } from 'react-icons/fa';
import { useQuiz } from '@/context/QuizContext';
import { useRouter } from 'next/navigation';
import { db } from '@/config/firebase';
import { doc, deleteDoc, updateDoc, onSnapshot } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';

export default function WaitingRoomFloating() {
  const { 
    waitingRoom, 
    setWaitingRoom, 
    isWaitingRoomModalOpen, 
    setIsWaitingRoomModalOpen,
    isLeader 
  } = useQuiz();
  const { currentUser } = useAuth();
  const router = useRouter();
  const [participantCount, setParticipantCount] = useState(0);

  // 参加者数をリアルタイムで監視
  useEffect(() => {
    if (!waitingRoom) return;
    
    const roomRef = doc(db, 'quiz_rooms', waitingRoom.roomId);
    
    const unsubscribe = onSnapshot(roomRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setParticipantCount(Object.keys(data.participants || {}).length);
      }
    });
    
    return () => unsubscribe();
  }, [waitingRoom]);

  // 待機ルームを退出
  const leaveRoom = async () => {
    if (!waitingRoom || !currentUser) return;
    
    try {
      if (isLeader) {
        // リーダーの場合はルーム自体を削除
        await deleteDoc(doc(db, 'quiz_rooms', waitingRoom.roomId));
      } else {
        // 参加者の場合は自分を参加者から削除
        const roomRef = doc(db, 'quiz_rooms', waitingRoom.roomId);
        const updatedParticipants = { ...waitingRoom.participants };
        delete updatedParticipants[currentUser.uid];
        
        await updateDoc(roomRef, {
          participants: updatedParticipants,
          updatedAt: new Date()
        });
      }
      
      // 待機ルーム情報をクリア
      setWaitingRoom(null);
      setIsWaitingRoomModalOpen(false);
    } catch (error) {
      console.error('Error leaving room:', error);
    }
  };

  // ルームページに移動
  const goToRoom = () => {
    if (!waitingRoom) return;
    router.push(`/quiz/room?id=${waitingRoom.roomId}`);
    setIsWaitingRoomModalOpen(false);
  };

  // 待機ルームがない場合は表示しない
  if (!waitingRoom) return null;

  return (
    <>
      {/* フローティングボタン */}
      <motion.button
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        onClick={() => setIsWaitingRoomModalOpen(true)}
        className="fixed bottom-6 right-6 bg-indigo-600 text-white rounded-full p-3 shadow-lg z-50 flex items-center space-x-2"
      >
        <FaUserFriends className="mr-2" />
        <span className="font-medium">待機中ルーム</span>
        <span className="bg-white text-indigo-700 rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">
          {participantCount}
        </span>
      </motion.button>

      {/* モーダルウィンドウ */}
      <AnimatePresence>
        {isWaitingRoomModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
            onClick={() => setIsWaitingRoomModalOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-lg p-6 w-full max-w-md shadow-xl"
            >
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-800">
                  {waitingRoom.name}
                </h2>
                <button
                  onClick={() => setIsWaitingRoomModalOpen(false)}
                  className="text-gray-500 hover:text-gray-800"
                >
                  <FaTimes size={20} />
                </button>
              </div>
              
              <div className="mb-6">
                <div className="bg-indigo-50 rounded p-4 mb-3">
                  <p className="font-medium text-indigo-800 mb-1">ジャンル:</p>
                  <p className="text-gray-700">{waitingRoom.genre}</p>
                </div>
                
                <div className="bg-indigo-50 rounded p-4">
                  <p className="font-medium text-indigo-800 mb-1">参加者数:</p>
                  <p className="text-gray-700 flex items-center">
                    <FaUserFriends className="mr-2 text-indigo-600" />
                    <span>{participantCount}人が待機中</span>
                  </p>
                </div>
              </div>
              
              <div className="flex space-x-3">
                <button
                  onClick={goToRoom}
                  className="flex-1 bg-indigo-600 text-white py-2 px-4 rounded-lg flex items-center justify-center hover:bg-indigo-700 transition"
                >
                  <FaPlay size={14} className="mr-2" />
                  ルームに戻る
                </button>
                
                <button
                  onClick={leaveRoom}
                  className="flex-1 bg-red-500 text-white py-2 px-4 rounded-lg flex items-center justify-center hover:bg-red-600 transition"
                >
                  <FaSignOutAlt size={14} className="mr-2" />
                  {isLeader ? 'ルームを削除' : '退出する'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
