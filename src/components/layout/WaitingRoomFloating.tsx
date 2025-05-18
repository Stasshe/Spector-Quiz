'use client';

import { useEffect, useState, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { FaUserFriends, FaTimes, FaSignOutAlt, FaPlay, FaClock, FaExchangeAlt } from 'react-icons/fa';
import { useQuiz } from '@/context/QuizContext';
import { useRouter } from 'next/navigation';
import { db } from '@/config/firebase';
import { doc, deleteDoc, updateDoc, onSnapshot, getDoc, collection, query, where, getDocs, Timestamp, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';
import { getRoomById } from '@/services/quizRoom';
import { useQuizRoom } from '@/hooks/useQuizRoom';

const AUTO_DISBAND_TIME_MS = 8 * 60 * 1000; // 8分（ミリ秒）

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
  const [waitTimeMs, setWaitTimeMs] = useState(0);
  const [roomCreationTime, setRoomCreationTime] = useState<Date | null>(null);
  const autoCheckTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // useQuizRoomからルーム切り替え関連の機能を取得
  const { 
    confirmRoomSwitch: isRoomSwitchConfirmOpen,
    roomToJoin: newRoomToJoin,
    switchRoom: handleGlobalSwitchRoom,
    cancelRoomSwitch: handleGlobalCancelRoomSwitch
  } = useQuizRoom();

  // 画面ロード時にユーザーの現在参加中のルームを確認
  useEffect(() => {
    const checkUserCurrentRoom = async () => {
      if (!currentUser) return;
      
      try {
        // ユーザーのドキュメントから現在のルームIDを取得
        const userRef = doc(db, 'users', currentUser.uid);
        const userDoc = await getDoc(userRef);
        
        if (userDoc.exists() && userDoc.data().currentRoomId) {
          const currentRoomId = userDoc.data().currentRoomId;
          
          // 既に設定されているwaitingRoomと同じ場合は何もしない
          if (waitingRoom && waitingRoom.roomId === currentRoomId) return;
          
          // currentRoomIdが存在する場合、そのルーム情報を取得
          try {
            const roomData = await getRoomById(currentRoomId);
            
            // ルームの状態が'waiting'の場合のみ設定
            if (roomData && roomData.status === 'waiting') {
              console.log('ユーザーの参加中ルームを復元:', currentRoomId);
              setWaitingRoom(roomData);
            } else if (roomData && roomData.status === 'in_progress') {
              // 進行中のルームの場合はルームページに移動
              console.log('進行中のルームが見つかりました:', currentRoomId);
              // 自動的な移動はしない（ユーザーが意図的に別のページを開いた可能性がある）
            }
          } catch (roomErr) {
            console.error('ルーム情報の取得中にエラーが発生しました:', roomErr);
            // エラーの場合、不整合を修正するためにcurrentRoomIdをクリア
            await updateDoc(userRef, { currentRoomId: null });
          }
        }
      } catch (err) {
        console.error('ユーザーの現在のルーム確認中にエラーが発生しました:', err);
      }
    };
    
    // ユーザーのログイン状態が変わった時、または画面読み込み時に実行
    checkUserCurrentRoom();
  }, [currentUser, setWaitingRoom, waitingRoom]);

  // 自動解散処理を行う関数
  const checkAndDisbandRoom = async (roomId: string) => {
    try {
      // 一旦ルームが存在するか確認（すでに削除済みなら何もしない）
      const roomRef = doc(db, 'quiz_rooms', roomId);
      const roomSnap = await getDoc(roomRef);
      
      if (!roomSnap.exists()) {
        console.log(`ルーム ${roomId} はすでに存在しません。自動解散処理をスキップします。`);
        return;
      }
      
      const roomData = roomSnap.data();
      
      // タイムスタンプが存在する場合のみ処理を続行
      if (!roomData.startedAt) {
        console.warn(`ルーム ${roomId} の作成時間が見つかりません。自動解散をスキップします。`);
        return;
      }
      
      // ルーム作成時間を取得
      const creationTime = roomData.startedAt.toDate();
      const currentTime = new Date();
      const elapsedMs = currentTime.getTime() - creationTime.getTime();
      
      console.log(`ルーム ${roomId} の経過時間: ${Math.floor(elapsedMs / 1000 / 60)}分${Math.floor((elapsedMs / 1000) % 60)}秒`);
      
      // 8分以上経過していたら自動解散
      if (elapsedMs >= AUTO_DISBAND_TIME_MS) {
        console.log(`ルーム ${roomId} は作成から${Math.floor(AUTO_DISBAND_TIME_MS / 1000 / 60)}分以上経過したため自動解散します`);
        
        try {
          // 自分がリーダーかどうかチェック
          const isLeaderOfRoom = roomData.roomLeaderId === (currentUser?.uid || '');
          
          // ルームを削除
          try {
            await deleteDoc(roomRef);
            console.log(`ルーム ${roomId} の自動解散が完了しました`);
          } catch (deleteErr: any) {
            // 権限エラーの場合、代替手段を試行
            if (deleteErr?.code === 'permission-denied') {
              console.warn(`ルーム ${roomId} の削除権限がありません。代替手段を試行します。`);
              
              // 代替手段1: リーダーの場合は新しい状態でルームを強制的に更新
              if (isLeaderOfRoom) {
                try {
                  await updateDoc(roomRef, {
                    status: 'completed',
                    updatedAt: serverTimestamp(),
                    // 他の必要なデータを更新
                    automaticallyClosed: true,
                    closeReason: '8分以上の未活動'
                  });
                  console.log(`ルーム ${roomId} を完了状態に更新しました`);
                } catch (updateErr) {
                  console.error(`ルーム ${roomId} の更新中にエラーが発生しました:`, updateErr);
                }
              } else {
                console.log(`ルーム ${roomId} はあなたが作成したルームではないため、削除できません。`);
              }
            } else {
              // その他のエラー
              console.error(`ルーム ${roomId} の削除中に不明なエラーが発生しました:`, deleteErr);
            }
          }
          
          // 自分が参加中だった場合、状態をクリア
          if (waitingRoom && waitingRoom.roomId === roomId) {
            setWaitingRoom(null);
            setIsWaitingRoomModalOpen(false);
            
            // 自動解散通知
            alert(`待機ルーム「${waitingRoom.name}」は${Math.floor(AUTO_DISBAND_TIME_MS / 1000 / 60)}分以上経過したため自動解散されました。`);
          }
        } catch (err) {
          console.error('自動解散処理中にエラーが発生しました:', err);
        }
      }
    } catch (err) {
      console.error('ルーム自動解散チェック中にエラーが発生しました:', err);
    }
  };

  // すべての待機中ルームをチェックして古いものを解散する（定期的に実行）
  const checkAllWaitingRooms = async () => {
    try {
      // 'waiting' ステータスのルームのみを取得
      const roomsRef = collection(db, 'quiz_rooms');
      const q = query(roomsRef, where('status', '==', 'waiting'));
      const roomsSnap = await getDocs(q);
      
      if (roomsSnap.empty) {
        console.log('待機中のルームはありません');
        return;
      }
      
      console.log(`${roomsSnap.size}個の待機中ルームをチェックします`);
      
      // 各ルームをチェック
      for (const roomDoc of roomsSnap.docs) {
        await checkAndDisbandRoom(roomDoc.id);
      }
    } catch (err) {
      console.error('待機中ルームの確認中にエラーが発生しました:', err);
    }
  };

  // 参加者数をリアルタイムで監視
  useEffect(() => {
    if (!waitingRoom) return;
    
    const roomRef = doc(db, 'quiz_rooms', waitingRoom.roomId);
    
    const unsubscribe = onSnapshot(roomRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        // データ変換のデバッグ出力を追加
        console.log('WaitingRoom participants data:', data.participants);
        
        // ルーム作成時間を更新
        if (data.startedAt) {
          const creationTime = data.startedAt.toDate();
          setRoomCreationTime(creationTime);
          
          // 経過時間の計算
          const currentTime = new Date();
          const elapsedMs = currentTime.getTime() - creationTime.getTime();
          setWaitTimeMs(elapsedMs);
        }
        
        // 参加者が存在するか確実に確認
        if (data.participants && typeof data.participants === 'object') {
          setParticipantCount(Object.keys(data.participants).length);
        } else {
          console.warn('参加者データが見つからないか不正な形式です', data);
          setParticipantCount(0);
        }
      } else {
        // ルームが削除された場合
        setParticipantCount(0);
        setWaitingRoom(null);
      }
    });
    
    return () => unsubscribe();
  }, [waitingRoom, setWaitingRoom]);

  // 経過時間の定期的な更新
  useEffect(() => {
    if (!roomCreationTime || !waitingRoom) return;
    
    // 1秒ごとに経過時間を更新
    const timerInterval = setInterval(() => {
      const currentTime = new Date();
      const elapsedMs = currentTime.getTime() - roomCreationTime.getTime();
      setWaitTimeMs(elapsedMs);
      
      // 8分以上経過した場合、現在のルームをチェック
      if (elapsedMs >= AUTO_DISBAND_TIME_MS) {
        checkAndDisbandRoom(waitingRoom.roomId);
      }
    }, 1000);
    
    return () => clearInterval(timerInterval);
  }, [roomCreationTime, waitingRoom]);

  // 定期的に全ての待機ルームをチェック（バックグラウンド）
  useEffect(() => {
    // 3分ごとに全待機ルームをチェック
    autoCheckTimerRef.current = setInterval(() => {
      checkAllWaitingRooms();
    }, 3 * 60 * 1000);
    
    // 初回は即時実行
    checkAllWaitingRooms();
    
    return () => {
      if (autoCheckTimerRef.current) {
        clearInterval(autoCheckTimerRef.current);
      }
    };
  }, []);

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

  // ルーム切り替え確認ダイアログを表示
  const [isSwitchDialogOpen, setIsSwitchDialogOpen] = useState(false);
  const [nextRoomId, setNextRoomId] = useState<string | null>(null);

  const handleRoomSwitch = async (newRoomId: string) => {
    if (!currentUser) return;
    
    setNextRoomId(newRoomId);
    setIsSwitchDialogOpen(true);
  };

  const handleLocalConfirmSwitch = async () => {
    if (!nextRoomId || !currentUser) return;
    
    setIsSwitchDialogOpen(false);
    
    try {
      // 現在のルームから退出
      await leaveRoom();
      
      // 新しいルームに参加
      const newRoomData = await getRoomById(nextRoomId);
      if (newRoomData && newRoomData.status === 'waiting') {
        setWaitingRoom(newRoomData);
        setIsWaitingRoomModalOpen(true);
      } else {
        console.error('無効なルームデータ:', newRoomData);
      }
    } catch (err) {
      console.error('ルーム切り替え中にエラーが発生しました:', err);
    }
  };

  const handleLocalCancelSwitch = () => {
    setIsSwitchDialogOpen(false);
    setNextRoomId(null);
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
          {participantCount > 0 ? participantCount : 0}
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
                
                <div className="bg-indigo-50 rounded p-4 mb-3">
                  <p className="font-medium text-indigo-800 mb-1">参加者数:</p>
                  <p className="text-gray-700 flex items-center">
                    <FaUserFriends className="mr-2 text-indigo-600" />
                    <span>{participantCount > 0 ? `${participantCount}人が待機中` : '参加者情報を読み込み中...'}</span>
                  </p>
                </div>
                
                <div className="bg-indigo-50 rounded p-4">
                  <p className="font-medium text-indigo-800 mb-1">待機時間:</p>
                  <p className={`text-gray-700 flex items-center ${waitTimeMs > AUTO_DISBAND_TIME_MS * 0.75 ? 'text-red-600 font-medium' : ''}`}>
                    <FaClock className="mr-2 text-indigo-600" />
                    <span>
                      {Math.floor(waitTimeMs / 1000 / 60)}分{Math.floor((waitTimeMs / 1000) % 60)}秒
                      {waitTimeMs > AUTO_DISBAND_TIME_MS * 0.75 && 
                        ` (あと${Math.max(0, Math.ceil((AUTO_DISBAND_TIME_MS - waitTimeMs) / 1000 / 60))}分で自動解散)`}
                    </span>
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

              {/* ルーム切り替え確認ダイアログ */}
              <AnimatePresence>
                {isSwitchDialogOpen && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
                    onClick={handleLocalCancelSwitch}
                  >
                    <motion.div
                      initial={{ scale: 0.9, y: 20 }}
                      animate={{ scale: 1, y: 0 }}
                      exit={{ scale: 0.9, y: 20 }}
                      onClick={(e) => e.stopPropagation()}
                      className="bg-white rounded-lg p-6 w-full max-w-md shadow-xl"
                    >
                      <h3 className="text-lg font-semibold text-gray-800 mb-4">
                        ルームの切り替え確認
                      </h3>
                      <p className="text-gray-700 mb-6">
                        このルームを退出して、新しいルームに参加しますか？
                      </p>
                      
                      <div className="flex space-x-3">
                        <button
                          onClick={handleLocalConfirmSwitch}
                          className="flex-1 bg-indigo-600 text-white py-2 px-4 rounded-lg flex items-center justify-center hover:bg-indigo-700 transition"
                        >
                          <FaExchangeAlt size={14} className="mr-2" />
                          はい、ルームを切り替える
                        </button>
                        
                        <button
                          onClick={handleLocalCancelSwitch}
                          className="flex-1 bg-gray-300 text-gray-800 py-2 px-4 rounded-lg flex items-center justify-center hover:bg-gray-400 transition"
                        >
                          <FaTimes size={14} className="mr-2" />
                          いいえ、キャンセル
                        </button>
                      </div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
