'use client';

import { motion } from 'framer-motion';
import { FaTimes, FaExchangeAlt } from 'react-icons/fa';
import { useQuizRoom } from '@/hooks/useQuizRoom';
import { useQuiz } from '@/context/QuizContext';

export default function RoomSwitchConfirmModal() {
  const { 
    confirmRoomSwitch,
    roomToJoin,
    switchRoom,
    cancelRoomSwitch
  } = useQuizRoom();
  
  const { waitingRoom } = useQuiz();

  if (!confirmRoomSwitch || !roomToJoin) {
    return null;
  }

  return (
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
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-lg p-6 w-full max-w-md shadow-xl"
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-800">
            別のルームに参加しますか？
          </h2>
          <button
            onClick={cancelRoomSwitch}
            className="text-gray-500 hover:text-gray-800"
          >
            <FaTimes size={20} />
          </button>
        </div>
        
        <div className="mb-6">
          <p className="text-gray-600 mb-4">
            あなたは現在「{waitingRoom?.name || "待機中ルーム"}」に参加中です。
            新しいルーム「{roomToJoin?.roomName || "別のルーム"}」に参加するには、
            現在のルームから退出する必要があります。
          </p>
          <p className="text-yellow-600 font-medium">
            注意: 現在のルームで得た情報やスコアは失われます。
          </p>
        </div>
        
        <div className="flex justify-end space-x-2">
          <button
            onClick={cancelRoomSwitch}
            className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 transition-colors"
          >
            キャンセル
          </button>
          <button
            onClick={switchRoom}
            className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors flex items-center"
          >
            <FaExchangeAlt className="mr-2" />
            ルームを切り替え
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
