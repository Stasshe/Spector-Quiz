'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { onSnapshot, doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
//import { TIMING } from '../config/quizConfig';
import { useAuth } from '../context/AuthContext';
import { QuizRoom, RoomListing, RoomStatus, QuizRoomState, AnswerStatus } from '../types/room';
import { useQuiz } from '../context/QuizContext';
import { Quiz } from '../types/quiz';

// サービス関数をインポート
import {
  fetchAvailableRooms,
  //checkAndDisbandOldRooms,
  //getUnitIdByName,
  //createUnitIfNotExists,
  updateUserStatsOnRoomComplete,
  //calculateRank,
  getRoomById,
  createRoom,
  createRoomWithUnit,
  joinRoom,
  leaveRoom,
  findOrCreateRoom,
  findOrCreateRoomWithUnit,
  updateParticipantReadyStatus,
  startQuiz,
  //updateQuizState,
  finishQuiz,
  revealAnswer,
  //processAnswer,
  registerClickTime,
  submitAnswer,
  moveToNextQuiz,
  getResultRanking
} from '../services/quizRoom';

export function useQuizRoom() {
  // Router
  const router = useRouter();

  // Context
  const { currentUser, userProfile } = useAuth();
  const { 
    setQuizRoom, 
    setIsLeader, 
    setCurrentQuiz, 
    setHasAnsweringRight,
    setWaitingRoom 
  } = useQuiz();

  // State variables
  const [availableRooms, setAvailableRooms] = useState<RoomListing[]>([]);
  const [currentRoom, setCurrentRoom] = useState<QuizRoom | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Room switching state
  const [roomToJoin, setRoomToJoin] = useState<{ roomId: string; roomName: string } | null>(null);
  const [confirmRoomSwitch, setConfirmRoomSwitch] = useState(false);
  
  // 現在の待機中ルームID - ローカルステートからユーザードキュメントを参照するように変更
  const [currentWaitingRoomId, setCurrentWaitingRoomId] = useState<string | null>(null);
  
  // 初期化時にFirebaseからユーザーの現在のルームをチェック
  useEffect(() => {
    if (!currentUser) return;
    
    const checkCurrentRoomFromFirebase = async () => {
      try {
        const userRef = doc(db, 'users', currentUser.uid);
        const userDoc = await getDoc(userRef);
        
        if (userDoc.exists() && userDoc.data().currentRoomId) {
          const roomId = userDoc.data().currentRoomId;
          console.log(`[useQuizRoom] ユーザードキュメントから現在のルームを検出: ${roomId}`);
          setCurrentWaitingRoomId(roomId);
          
          // 実際にルームが存在するか確認
          try {
            const roomData = await getRoomById(roomId);
            if (roomData && roomData.status === 'waiting') {
              console.log(`[useQuizRoom] 有効な待機中ルームを検出: ${roomId}`);
              setWaitingRoom(roomData);
            }
          } catch (err) {
            console.error('[useQuizRoom] ルーム情報取得エラー:', err);
          }
        } else {
          console.log('[useQuizRoom] ユーザーは現在どのルームにも参加していません');
        }
      } catch (err) {
        console.error('[useQuizRoom] ユーザードキュメント取得エラー:', err);
      }
    };
    
    checkCurrentRoomFromFirebase();
  }, [currentUser, setWaitingRoom]);
  
  // Quiz state
  const [currentQuizData, setCurrentQuizData] = useState<Quiz | null>(null);
  const [currentQuizAnswer, setCurrentQuizAnswer] = useState<string>('');
  const [hasClickedQuiz, setHasClickedQuiz] = useState(false);
  const [quizResult, setQuizResult] = useState<{
    isCorrect: boolean;
    correctAnswer: string;
    explanation: string;
  } | null>(null);

  // Memoized values
  const isRoomLeader = useMemo(() => {
    if (!currentRoom || !currentUser) return false;
    return currentRoom.roomLeaderId === currentUser.uid;
  }, [currentRoom, currentUser]);

  const isRoomActive = useMemo(() => {
    if (!currentRoom) return false;
    return currentRoom.status === 'in_progress';
  }, [currentRoom]);

  const isRoomCompleted = useMemo(() => {
    if (!currentRoom) return false;
    return currentRoom.status === 'completed';
  }, [currentRoom]);

  const currentParticipants = useMemo(() => {
    if (!currentRoom) return [];
    return Object.values(currentRoom.participants || {});
  }, [currentRoom]);

  const sortedParticipants = useMemo(() => {
    return [...currentParticipants].sort((a, b) => b.score - a.score);
  }, [currentParticipants]);

  /**
   * ルーム一覧を取得する
   */
  const fetchRoomList = useCallback(async (genre: string, classType: string = 'ユーザー作成') => {
    try {
      setLoading(true);
      const rooms = await fetchAvailableRooms(genre, classType);
      setAvailableRooms(rooms);
      return rooms;
    } catch (err) {
      console.error('ルーム一覧の取得に失敗しました', err);
      setError('ルーム一覧の取得に失敗しました');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * ルームを作成する
   */
  const createNewRoom = useCallback(async (
    roomName: string, 
    genre: string, 
    classType: string = 'ユーザー作成',
    unitId?: string
  ) => {
    if (!currentUser || !userProfile) {
      setError('ログインが必要です');
      return null;
    }

    try {
      setLoading(true);
      
      let roomId: string;
      
      if (unitId) {
        roomId = await createRoomWithUnit(
          roomName,
          genre,
          classType,
          currentUser.uid,
          userProfile.username,
          userProfile.iconId,
          unitId
        );
      } else {
        roomId = await createRoom(
          roomName,
          genre,
          classType,
          currentUser.uid,
          userProfile.username,
          userProfile.iconId
        );
      }
      
      await joinCreatedRoom(roomId);
      return roomId;
    } catch (err) {
      console.error('ルームの作成に失敗しました', err);
      setError('ルームの作成に失敗しました');
      return null;
    } finally {
      setLoading(false);
    }
  }, [currentUser, userProfile]);

  /**
   * ルームに参加する
   */
  const joinExistingRoom = useCallback(async (roomId: string) => {
    if (!currentUser || !userProfile) {
      setError('ログインが必要です');
      return false;
    }

    console.log(`[joinExistingRoom] リクエスト: ${roomId}, 現在のルーム状態: ${currentWaitingRoomId}`);

    // 同じルームに再度参加しようとした場合は早期リターン
    if (currentWaitingRoomId === roomId) {
      console.log(`[joinExistingRoom] 既に参加中のルーム(${roomId})です。処理をスキップします`);
      router.push(`/quiz/room?id=${roomId}`);
      return true;
    }
    
    // 参加前にFirebase上のユーザー情報を確認
    try {
      const userRef = doc(db, 'users', currentUser.uid);
      const userDoc = await getDoc(userRef);
      
      if (userDoc.exists()) {
        console.log('[joinExistingRoom] ユーザードキュメント状態:', userDoc.data().currentRoomId || 'ルーム参加なし');
        
        // Firebaseに保存されている現在のルームIDとローカルステートが異なる場合、ローカルステートを更新
        if (userDoc.data().currentRoomId && userDoc.data().currentRoomId !== currentWaitingRoomId) {
          console.log(`[joinExistingRoom] ローカル状態を更新: ${userDoc.data().currentRoomId}`);
          setCurrentWaitingRoomId(userDoc.data().currentRoomId);
        }
      }
    } catch (err) {
      console.error('[joinExistingRoom] ユーザードキュメント確認エラー:', err);
    }

    // ルームの現在の状態を確認
    try {
      const roomData = await getRoomById(roomId);
      if (!roomData) {
        console.error(`[joinExistingRoom] ルーム ${roomId} が存在しません`);
        setError('指定されたルームが見つかりません');
        return false;
      }
      
      if (roomData.status !== 'waiting') {
        console.error(`[joinExistingRoom] ルーム ${roomId} は待機中ではありません (状態: ${roomData.status})`);
        setError('このルームは参加できない状態です');
        return false;
      }
    } catch (err) {
      console.error('[joinExistingRoom] ルーム状態確認エラー:', err);
      setError('ルームの状態を確認できませんでした');
      return false;
    }

    // 現在のルームIDがない場合でも、Firebaseを直接チェック
    if (currentWaitingRoomId || true) {
      try {
        // ユーザーの現在のルームを直接Firebaseから確認 (常に確認する)
        const userRef = doc(db, 'users', currentUser.uid);
        const userDoc = await getDoc(userRef);
        
        if (userDoc.exists() && userDoc.data().currentRoomId) {
          const currentRoomIdFromFirebase = userDoc.data().currentRoomId;
          
          // 現在のルームが確認対象のルームと異なる場合
          if (currentRoomIdFromFirebase && currentRoomIdFromFirebase !== roomId) {
            console.log(`[joinExistingRoom] Firebaseで検出された既存の参加ルーム: ${currentRoomIdFromFirebase}`);
            
            try {
              // 現在参加中のルームの情報を取得
              const currentRoomData = await getRoomById(currentRoomIdFromFirebase);
              
              // 新しい参加先のルームの情報を取得
              const roomToJoinData = await getRoomById(roomId);
              
              console.log('[joinExistingRoom] 現在参加中:', currentRoomData?.name);
              console.log('[joinExistingRoom] 参加先:', roomToJoinData?.name);
              
              // 状態の明示的な更新順序のためタイムアウトを使用
              // ルーム切り替え確認モーダル表示用のデータを設定
              const roomInfo = {
                roomId: roomId,
                roomName: roomToJoinData?.name || '別のルーム'
              };
              
              // ステート更新
              setCurrentWaitingRoomId(currentRoomIdFromFirebase);  // Firebaseから取得した値で更新
              setRoomToJoin(roomInfo);
              
              // 明示的に順序付けて確認モーダル表示を設定
              setTimeout(() => {
                setConfirmRoomSwitch(true);
                console.log('[joinExistingRoom] ルーム切り替え確認モーダルを表示します');
                
                // 確実に状態更新を確認
                setTimeout(() => {
                  console.log('[joinExistingRoom] モーダル表示状態:', {
                    currentWaitingRoomId: currentRoomIdFromFirebase,
                    roomToJoin: roomInfo,
                    confirmRoomSwitchEnabled: true
                  });
                }, 50);
              }, 50);
              
              return false;
            } catch (err) {
              console.error('[joinExistingRoom] ルーム情報取得エラー:', err);
              // エラーが発生した場合でも、ユーザーはFirebaseに記録されたルームに参加中と判断
              // モーダル表示のためfalseを返す
              return false;
            }
          }
        }
      } catch (err) {
        console.error('[joinExistingRoom] ユーザードキュメント確認エラー:', err);
      }
    }

    try {
      setLoading(true);
      console.log(`ルーム参加処理を開始: ${roomId}`);
      
      const success = await joinRoom(
        roomId, 
        currentUser.uid,
        userProfile.username,
        userProfile.iconId
      );
      
      if (success) {
        console.log('ルーム参加が成功しました');
        
        // ユーザードキュメントを更新して現在のルームを保存
        try {
          const userRef = doc(db, 'users', currentUser.uid);
          await updateDoc(userRef, { currentRoomId: roomId });
          console.log(`[joinExistingRoom] ユーザードキュメントにルームID(${roomId})を保存しました`);
        } catch (userErr) {
          console.error('[joinExistingRoom] ユーザードキュメント更新エラー:', userErr);
          // エラーでもルーム参加処理は続行する
        }
        
        // コンテキストに待機中ルーム情報を設定
        setCurrentWaitingRoomId(roomId);
        
        try {
          console.log('ルーム情報を取得しています...');
          // ルーム情報を取得してからセット
          const roomData = await getRoomById(roomId);
          setWaitingRoom(roomData);
          
          // 自動的にルームページに移動
          console.log(`ルームページに移動します: /quiz/room?id=${roomId}`);
          router.push(`/quiz/room?id=${roomId}`);
          return true;
        } catch (err) {
          console.error('ルーム情報の取得に失敗しました', err);
          // エラーの詳細を表示
          if (err instanceof Error) {
            setError(`ルーム情報の取得に失敗しました: ${err.message}`);
          } else {
            setError('ルーム情報の取得に失敗しました');
          }
          return false;
        }
      } else {
        console.error('ルーム参加処理が失敗しました');
      }
      
      return false;
    } catch (err) {
      console.error('ルームへの参加に失敗しました', err);
      // エラーの詳細を表示
      if (err instanceof Error) {
        setError(`ルームへの参加に失敗しました: ${err.message}`);
      } else {
        setError('ルームへの参加に失敗しました');
      }
      return false;
    } finally {
      setLoading(false);
    }
  }, [currentUser, userProfile, currentWaitingRoomId, router, setWaitingRoom, getRoomById]);

  /**
   * 作成したルームに参加する (内部用)
   */
  const joinCreatedRoom = useCallback(async (roomId: string) => {
    if (!roomId || !currentUser) return false;
    
    setCurrentWaitingRoomId(roomId);
    
    try {
      // ルーム情報を取得して状態を更新
      const roomData = await getRoomById(roomId);
      setWaitingRoom(roomData); // QuizRoom型のオブジェクトを渡す
      
      // 自動的にルームページに移動
      router.push(`/quiz/room?id=${roomId}`);
      return true;
    } catch (err) {
      console.error('ルーム情報の取得に失敗しました', err);
      return false;
    }
  }, [currentUser, router, setWaitingRoom]);

  /**
   * ルームから退出する
   */
  const exitRoom = useCallback(async (roomId: string) => {
    if (!currentUser) {
      setError('ログインが必要です');
      return false;
    }

    console.log(`[exitRoom] ルーム(${roomId})からの退出を開始`);
    
    // 渡されたroomIdが実際に存在するかチェック
    let actualRoomId: string | null = roomId;
    
    if (!actualRoomId) {
      // roomIdが指定されていない場合、現在のルームIDを使用
      actualRoomId = currentWaitingRoomId;
      
      // それでもない場合はFirebaseから取得
      if (!actualRoomId) {
        try {
          const userRef = doc(db, 'users', currentUser.uid);
          const userDoc = await getDoc(userRef);
          if (userDoc.exists() && userDoc.data().currentRoomId) {
            actualRoomId = userDoc.data().currentRoomId;
            console.log(`[exitRoom] Firebaseから現在のルームID(${actualRoomId})を取得しました`);
          }
        } catch (err) {
          console.error('[exitRoom] ユーザードキュメント確認エラー:', err);
        }
      }
    }
    
    if (!actualRoomId) {
      console.error('[exitRoom] 退出するルームIDが見つかりません');
      setError('退出するルームが見つかりません');
      return false;
    }

    try {
      setLoading(true);
      
      // まずルーム情報を取得して、リーダー情報を正確に判断
      let isLeaderOfRoom = isRoomLeader; // デフォルト値
      
      try {
        const roomData = await getRoomById(actualRoomId);
        if (roomData) {
          isLeaderOfRoom = roomData.roomLeaderId === currentUser.uid;
          console.log(`[exitRoom] リーダー確認: ${isLeaderOfRoom ? '自分がリーダー' : '一般参加者'}`);
        }
      } catch (roomErr) {
        console.error('[exitRoom] ルーム情報取得エラー:', roomErr);
        // エラー時はデフォルトのリーダー情報を使用
      }
      
      const success = await leaveRoom(
        actualRoomId as string, // 型アサーション (ここでnullの場合は上の条件でリターンするため安全)
        currentUser.uid, 
        isLeaderOfRoom // 正確なリーダー情報
      );
      
      if (success) {
        console.log(`[exitRoom] ルーム(${actualRoomId})からの退出成功`);
        
        // ユーザードキュメントからも現在のルームID情報を削除
        try {
          const userRef = doc(db, 'users', currentUser.uid);
          await updateDoc(userRef, { currentRoomId: null });
          console.log('[exitRoom] ユーザードキュメントからルームID情報を削除しました');
        } catch (userErr) {
          console.error('[exitRoom] ユーザードキュメント更新エラー:', userErr);
          // エラーがあっても続行
        }
        
        // 状態をクリア
        setCurrentWaitingRoomId(null);
        setWaitingRoom(null);
        setCurrentRoom(null);
        
        // ホームに戻る
        router.push('/quiz');
        return true;
      }
      
      return false;
    } catch (err) {
      console.error('ルームからの退出に失敗しました', err);
      setError('ルームからの退出に失敗しました');
      return false;
    } finally {
      setLoading(false);
    }
  }, [currentUser, isRoomLeader, currentWaitingRoomId, router, setWaitingRoom]);

  /**
   * 参加中のルームを抜けて新しいルームに参加
   */
  const switchRoom = useCallback(async () => {
    console.log('[RoomSwitch] 開始:', {
      currentUser: currentUser?.uid,
      hasUserProfile: !!userProfile,
      roomToJoin,
      currentWaitingRoomId
    });
    
    if (!currentUser || !userProfile || !roomToJoin) {
      console.warn('[RoomSwitch] 中断: 必要なデータが不足しています');
      setConfirmRoomSwitch(false);
      return false;
    }
    
    // 処理の途中でStateが変わらないように、必要な値をローカル変数に保存
    const targetRoomId = roomToJoin.roomId;
    const targetRoomName = roomToJoin.roomName;
    
    console.log(`[RoomSwitch] 参加先ルーム情報: ID=${targetRoomId}, 名前=${targetRoomName}`);
    
    // 現在のルームIDがない場合は、Firebaseから直接チェック
    let actualCurrentRoomId = currentWaitingRoomId;
    if (!actualCurrentRoomId) {
      try {
        const userRef = doc(db, 'users', currentUser.uid);
        const userDoc = await getDoc(userRef);
        if (userDoc.exists() && userDoc.data().currentRoomId) {
          actualCurrentRoomId = userDoc.data().currentRoomId;
          console.log(`[RoomSwitch] Firebaseから現在のルームID(${actualCurrentRoomId})を取得しました`);
        }
      } catch (err) {
        console.error('[RoomSwitch] ユーザードキュメント確認エラー:', err);
      }
    }

    try {
      setLoading(true);
      
      // 現在のルームから退出
      if (actualCurrentRoomId) {
        console.log(`[RoomSwitch] 現在のルーム(${actualCurrentRoomId})から退出します`);
        
        // まずルームの情報を取得して、自分がリーダーかどうかを確認
        let currentRoomData = null;
        let isLeaderOfCurrentRoom = false;
        
        try {
          currentRoomData = await getRoomById(actualCurrentRoomId);
          isLeaderOfCurrentRoom = currentRoomData?.roomLeaderId === currentUser.uid;
          console.log(`[RoomSwitch] リーダー確認: ${isLeaderOfCurrentRoom ? '自分がリーダー' : '一般参加者'}`);
        } catch (roomErr) {
          console.error('[RoomSwitch] ルーム情報取得エラー:', roomErr);
          // ルームが既に削除されている可能性があるため、エラーがあっても処理を継続
          // ただし、ユーザードキュメントは確実にクリア
          try {
            const userRef = doc(db, 'users', currentUser.uid);
            await updateDoc(userRef, { currentRoomId: null });
            console.log('[RoomSwitch] ルーム取得エラー後、ユーザードキュメントからルームID情報を削除しました');
            setCurrentWaitingRoomId(null);
          } catch (clearErr) {
            console.error('[RoomSwitch] ユーザードキュメントクリア中にエラー:', clearErr);
            // それでもローカル状態は更新
            setCurrentWaitingRoomId(null);
          }
        }
        
        // 退出処理を行う（ルーム情報の取得に失敗した場合はスキップ）
        if (currentRoomData) {
          try {
            console.log(`[RoomSwitch] leaveRoom(${actualCurrentRoomId}, ${currentUser.uid}, ${isLeaderOfCurrentRoom})を呼び出します`);
            const leaveResult = await leaveRoom(
              actualCurrentRoomId,
              currentUser.uid,
              isLeaderOfCurrentRoom // 正確なリーダー情報を渡す
            );
            
            if (leaveResult) {
              console.log('[RoomSwitch] 退出成功');
            } else {
              console.warn('[RoomSwitch] 退出処理は完了しましたが、成功フラグがfalseです');
            }
          } catch (leaveErr) {
            console.error('[RoomSwitch] 退出エラー:', leaveErr);
            // エラーがあっても続行（新しいルーム参加を優先）
          }
        }
        
        // 退出処理の成否に関わらず、ユーザードキュメントを確実に更新
        try {
          const userRef = doc(db, 'users', currentUser.uid);
          await updateDoc(userRef, { currentRoomId: null });
          console.log('[RoomSwitch] ユーザードキュメントからルームID情報を削除しました');
          
          // ローカル状態も更新
          setCurrentWaitingRoomId(null);
        } catch (userErr) {
          console.error('[RoomSwitch] ユーザードキュメント更新エラー:', userErr);
          // エラーがあっても続行（ローカル状態は更新）
          setCurrentWaitingRoomId(null);
        }
      }
      
      // 新しいルーム作成か既存ルーム参加かを判断
      if (targetRoomId === 'pending-creation') {
        // これは新規作成の場合のコールバック
        // ルームから退出は成功しているため、まず状態をクリーンにする
        
        setCurrentWaitingRoomId(null); // 退出は成功しているので現在のルームIDをクリア
        setWaitingRoom(null);
        
        // 状態をクリア
        setRoomToJoin(null);
        setConfirmRoomSwitch(false);
        
        console.log('[RoomSwitch] 新規ルーム作成モードで完了 - ルーム作成ページに移動します');
        
        // 新しいルーム作成のためにクイズページに遷移する
        // クオーターセカンドの遅延を入れることで、状態更新が確実に行われるようにする
        setTimeout(() => {
          router.push('/quiz');
          console.log('[RoomSwitch] クイズページに遷移しました');
        }, 250);
        
        return true;
      } else {
        // 既存の特定ルームへの参加
        console.log(`[RoomSwitch] 既存ルーム(${targetRoomId})に参加します`);
        
        // 少し待機して、前のルームからの退出が完全に処理されるのを待つ
        await new Promise(resolve => setTimeout(resolve, 500));
        
        try {
          // 参加前にもう一度ユーザードキュメントを確認
          try {
            const userRef = doc(db, 'users', currentUser.uid);
            const userSnap = await getDoc(userRef);
            if (userSnap.exists() && userSnap.data().currentRoomId) {
              console.log(`[RoomSwitch] 参加前確認: ユーザーは既にルーム(${userSnap.data().currentRoomId})に参加しています`);
              
              // 既に参加中のルームIDがクリアされていない場合は再度クリア
              if (userSnap.data().currentRoomId !== targetRoomId) {
                await updateDoc(userRef, { currentRoomId: null });
                console.log('[RoomSwitch] ユーザードキュメントを再度クリアしました');
              }
            }
          } catch (checkErr) {
            console.error('[RoomSwitch] 参加前ユーザー確認エラー:', checkErr);
            // エラーがあっても続行
          }
          
          const success = await joinRoom(
            targetRoomId,
            currentUser.uid,
            userProfile.username,
            userProfile.iconId
          );
          
          if (success) {
            console.log(`[RoomSwitch] ルーム(${targetRoomId})への参加成功`);
            
            // コンテキストを更新
            setCurrentWaitingRoomId(targetRoomId);
            
            // ルーム情報を取得
            try {
              const roomData = await getRoomById(targetRoomId);
              if (roomData) {
                setWaitingRoom(roomData);
                
                // ルームページへ移動
                router.push(`/quiz/room?id=${targetRoomId}`);
                
                // 状態をクリア
                setRoomToJoin(null);
                setConfirmRoomSwitch(false);
                console.log('[RoomSwitch] 既存ルームへの参加が完了しました');
                return true;
              } else {
                console.error('[RoomSwitch] 参加したルームのデータが取得できませんでした');
                setError('参加したルームの情報が取得できませんでした');
                return false;
              }
            } catch (roomErr) {
              console.error('[RoomSwitch] ルーム情報の取得に失敗:', roomErr);
              setError('ルーム情報の取得に失敗しました');
              return false;
            }
          } else {
            console.error('[RoomSwitch] ルームへの参加に失敗しました');
            setError('ルームへの参加に失敗しました');
          }
        } catch (joinErr) {
          console.error('[RoomSwitch] ルーム参加中にエラー:', joinErr);
          setError(`ルームへの参加中にエラーが発生しました: ${joinErr instanceof Error ? joinErr.message : '不明なエラー'}`);
          return false;
        }
      }
      
      return false;
    } catch (err) {
      console.error('ルーム切り替え中にエラーが発生しました:', err);
      setError('ルームの切り替えに失敗しました');
      return false;
    } finally {
      setLoading(false);
      setConfirmRoomSwitch(false);
    }
  }, [currentUser, userProfile, currentWaitingRoomId, roomToJoin, router, setWaitingRoom, leaveRoom, joinRoom, getRoomById, setWaitingRoom]);

  /**
   * ルーム切り替えをキャンセル
   */
  const cancelRoomSwitch = useCallback(() => {
    console.log('[RoomSwitch] 切り替えキャンセル: 確認ダイアログを閉じます');
    setRoomToJoin(null);
    setConfirmRoomSwitch(false);
  }, []);

  /**
   * 既存のルームを見つけるか、なければ新規作成する
   */
  const findOrCreateNewRoom = useCallback(async (
    roomName: string, 
    genre: string, 
    classType: string = 'ユーザー作成', 
    unitId?: string
  ) => {
    if (!currentUser || !userProfile) {
      setError('ログインが必要です');
      return null;
    }

    console.log(`[findOrCreateNewRoom] 開始: 現在のルーム=${currentWaitingRoomId}, 作成=${roomName}`);

    // 既に待機中ルームに参加している場合は、切り替え確認を表示
    if (currentWaitingRoomId) {
      console.log(`[findOrCreateNewRoom] 既存ルーム検出: ${currentWaitingRoomId}`);
      
      // ルーム作成処理をスキップして、確認ダイアログを表示する
      try {
        // 現在参加中のルーム情報を取得
        const currentRoomData = await getRoomById(currentWaitingRoomId);
        console.log('[findOrCreateNewRoom] 現在参加中のルーム情報:', currentRoomData?.name || 'unknown');

        // 確認ダイアログを表示するための情報を設定
        const roomNameToShow = `${genre}の${unitId ? '単元' : ''}クイズルーム`;
        console.log(`[findOrCreateNewRoom] ルーム切り替え確認ダイアログを表示: ${roomNameToShow}`);
        
        // モーダル表示のための情報
        console.log('[findOrCreateNewRoom] モーダル表示準備中...');
        
        // 重要: モーダルに表示するデータを設定
        // 新しいルーム作成用の特別IDと、現在の作成リクエスト情報を保存
        const newRoomInfo = {
          roomId: 'pending-creation',
          roomName: roomNameToShow,
          // 追加のデータをカスタム属性に埋め込む
          _requestData: {
            genre,
            roomName,
            classType,
            unitId
          }
        };
        
        // 通常の状態更新ではなく、documentのカスタム属性を使って状態を永続化
        // これによりReact状態の非同期更新問題を回避
        document.documentElement.setAttribute('data-room-switch-pending', 'true');
        document.documentElement.setAttribute('data-room-info', JSON.stringify(newRoomInfo));
        
        console.log('[findOrCreateNewRoom] ドキュメント属性を設定しました');
        
        // 確実にモーダルを表示するため、setTimeout後に状態更新
        setTimeout(() => {
          // roomToJoinを先に設定
          setRoomToJoin(newRoomInfo);
          console.log('[findOrCreateNewRoom] roomToJoinを設定しました');
          
          // 少し遅延させて確認フラグを設定（順序を保証）
          setTimeout(() => {
            setConfirmRoomSwitch(true);
            console.log('[findOrCreateNewRoom] 確認モーダル表示を有効化しました');
            
            // 状態更新が確実に行われるようもう少し遅延してチェック
            setTimeout(() => {
              const modalShouldShow = document.documentElement.getAttribute('data-room-switch-pending') === 'true';
              console.log('[findOrCreateNewRoom] 確認：モーダル表示状態=', modalShouldShow);
              
              // まだモーダルが表示されていない場合は強制的に表示
              if (modalShouldShow) {
                console.log('[findOrCreateNewRoom] モーダルを強制的に再表示します');
                setConfirmRoomSwitch(false); // 一度OFFにして
                setTimeout(() => {
                  setConfirmRoomSwitch(true); // 再度ONにする
                  console.log('[findOrCreateNewRoom] モーダル再表示を試行しました');
                }, 100);
              }
            }, 300);
          }, 100);
        }, 100);
        
        // モーダルが確実に表示されるまで監視する関数
        let checkCount = 0;
        const maxChecks = 10;
        const checkModalVisibility = () => {
          const isPending = document.documentElement.getAttribute('data-room-switch-pending') === 'true';
          checkCount++;
          
          if (isPending && checkCount < maxChecks) {
            console.log(`[findOrCreateNewRoom] モーダル表示待機中... (${checkCount}/${maxChecks})`);
            setTimeout(checkModalVisibility, 100);
          } else if (!isPending) {
            console.log('[findOrCreateNewRoom] モーダル表示確認完了');
          } else {
            console.log('[findOrCreateNewRoom] モーダル表示タイムアウト');
            // タイムアウトした場合、フラグをリセット
            document.documentElement.removeAttribute('data-room-switch-pending');
            
            // もう一度モーダル表示を試みる
            const roomInfo = {
              roomId: 'pending-creation',
              roomName: roomNameToShow
            };
            setRoomToJoin(roomInfo);
            setConfirmRoomSwitch(true);
          }
        };
        
        // 表示チェック開始
        setTimeout(checkModalVisibility, 200);
        
        // 確認ダイアログを表示するため、この時点でnullを返す
        setLoading(false);
        return null;
      } catch (err) {
        console.error('[findOrCreateNewRoom] 待機中ルーム情報の確認中にエラー:', err);
        console.log('[findOrCreateNewRoom] currentWaitingRoomId:', currentWaitingRoomId);
        console.log('[findOrCreateNewRoom] 状態リセット中...');
        
        // エラーが発生した場合は、参加中ルーム情報をクリアして続行
        setCurrentWaitingRoomId(null);
      }
    }

    try {
      console.log(`新規ルーム作成または検索を開始: ${roomName}, ${genre}`);
      setLoading(true);
      
      let roomId: string;
      
      if (unitId) {
        roomId = await findOrCreateRoomWithUnit(
          roomName,
          genre,
          classType,
          currentUser.uid,
          userProfile.username,
          userProfile.iconId,
          unitId
        );
      } else {
        roomId = await findOrCreateRoom(
          roomName,
          genre,
          classType,
          currentUser.uid,
          userProfile.username,
          userProfile.iconId
        );
      }
      
      console.log(`ルームが見つかりました/作成されました: ${roomId}`);
      await joinCreatedRoom(roomId);
      return roomId;
    } catch (err) {
      console.error('ルームの検索/作成に失敗しました', err);
      setError('ルームの検索/作成に失敗しました');
      return null;
    } finally {
      setLoading(false);
    }
  }, [currentUser, userProfile, currentWaitingRoomId, joinCreatedRoom, getRoomById, confirmRoomSwitch, roomToJoin]);

  /**
   * 準備状態を切り替える
   */
  const toggleReadyStatus = useCallback(async (roomId: string, isReady: boolean) => {
    if (!currentUser) {
      setError('ログインが必要です');
      return false;
    }

    try {
      const success = await updateParticipantReadyStatus(
        roomId,
        currentUser.uid,
        isReady
      );
      
      return success;
    } catch (err) {
      console.error('準備状態の更新に失敗しました', err);
      setError('準備状態の更新に失敗しました');
      return false;
    }
  }, [currentUser]);

  /**
   * クイズを開始する (リーダー用)
   */
  const startQuizGame = useCallback(async (roomId: string) => {
    if (!currentUser || !isRoomLeader) {
      setError('クイズを開始する権限がありません');
      return false;
    }

    try {
      setLoading(true);
      
      const success = await startQuiz(roomId);
      
      if (success) {
        // ローディング状態を解除するための遅延
        setTimeout(() => setLoading(false), 1000);
        return true;
      }
      
      return false;
    } catch (err) {
      console.error('クイズの開始に失敗しました', err);
      setError('クイズの開始に失敗しました');
      return false;
    } finally {
      setLoading(false);
    }
  }, [currentUser, isRoomLeader]);

  /**
   * クイズをクリックして解答権を得る
   */
  const handleQuizClick = useCallback(async (roomId: string) => {
    if (!currentUser || !currentRoom || hasClickedQuiz) return;

    try {
      setHasClickedQuiz(true);
      
      const updated = await registerClickTime(
        roomId,
        currentUser.uid,
        currentRoom.currentState.quizId
      );
      
      return updated;
    } catch (err) {
      console.error('クイズ解答権の取得に失敗しました', err);
      setError('クイズ解答権の取得に失敗しました');
      setHasClickedQuiz(false);
      return false;
    }
  }, [currentUser, currentRoom, hasClickedQuiz]);

  /**
   * クイズの解答を送信
   */
  const submitQuizAnswer = useCallback(async (
    roomId: string, 
    quizId: string, 
    answer: string
  ) => {
    if (!currentUser || !currentRoom) return false;

    try {
      const result = await submitAnswer(
        roomId,
        currentUser.uid,
        quizId,
        answer
      );
      
      // 結果を設定
      if (result) {
        setQuizResult({
          isCorrect: result.isCorrect,
          correctAnswer: result.correctAnswer,
          explanation: result.explanation
        });
        
        return true;
      }
      
      return false;
    } catch (err) {
      console.error('クイズの解答に失敗しました', err);
      setError('クイズの解答に失敗しました');
      return false;
    }
  }, [currentUser, currentRoom]);

  /**
   * 次のクイズに進む (リーダー用)
   */
  const goToNextQuiz = useCallback(async (roomId: string) => {
    if (!currentUser || !isRoomLeader) {
      setError('次のクイズに進む権限がありません');
      return false;
    }

    try {
      setLoading(true);
      
      // 状態をリセット
      setHasClickedQuiz(false);
      setCurrentQuizAnswer('');
      setQuizResult(null);
      
      const success = await moveToNextQuiz(roomId);
      
      return success;
    } catch (err) {
      console.error('次のクイズへの移動に失敗しました', err);
      setError('次のクイズへの移動に失敗しました');
      return false;
    } finally {
      setLoading(false);
    }
  }, [currentUser, isRoomLeader]);

  /**
   * 正解を表示する (リーダー用)
   */
  const showAnswer = useCallback(async (roomId: string) => {
    if (!currentUser || !isRoomLeader) {
      setError('正解を表示する権限がありません');
      return false;
    }

    try {
      const success = await revealAnswer(roomId);
      return success;
    } catch (err) {
      console.error('正解の表示に失敗しました', err);
      setError('正解の表示に失敗しました');
      return false;
    }
  }, [currentUser, isRoomLeader]);

  /**
   * クイズを終了する (リーダー用)
   */
  const finishQuizGame = useCallback(async (roomId: string) => {
    if (!currentUser || !isRoomLeader) {
      setError('クイズを終了する権限がありません');
      return false;
    }

    try {
      setLoading(true);
      
      const success = await finishQuiz(roomId);
      
      if (success) {
        // 統計を更新（引数は1つのみに修正）
        await updateUserStatsOnRoomComplete(roomId);
        
        // ルーム状態を完了に設定
        if (currentRoom) {
          setCurrentRoom({
            ...currentRoom,
            status: 'completed'
          });
        }
        
        return true;
      }
      
      return false;
    } catch (err) {
      console.error('クイズの終了に失敗しました', err);
      setError('クイズの終了に失敗しました');
      return false;
    } finally {
      setLoading(false);
    }
  }, [currentUser, isRoomLeader, currentRoom]);

  /**
   * 結果ランキングを取得する
   */
  const fetchResultRanking = useCallback(async (roomId: string) => {
    try {
      const rankings = await getResultRanking(roomId);
      return rankings;
    } catch (err) {
      console.error('ランキングの取得に失敗しました', err);
      setError('ランキングの取得に失敗しました');
      return [];
    }
  }, []);

  /**
   * ルーム情報リアルタイム監視
   */
  useEffect(() => {
    if (!currentWaitingRoomId || !currentUser) return;

    const roomRef = doc(db, 'quiz_rooms', currentWaitingRoomId);
    
    const unsubscribe = onSnapshot(roomRef, async (docSnap) => {
      if (docSnap.exists()) {
        const roomData = docSnap.data() as QuizRoom;
        
        setCurrentRoom(roomData);
        setQuizRoom(roomData);
        setIsLeader(roomData.roomLeaderId === currentUser.uid);
        
        // 現在のクイズを取得
        if (roomData.status === 'in_progress' && roomData.currentState) {
          await fetchCurrentQuizData(roomData);
          
          // 解答権の判定
          const hasRight = 
            roomData.currentState.currentAnswerer === currentUser.uid && 
            roomData.currentState.answerStatus === 'answering';
          
          setHasAnsweringRight(hasRight);
        }
      } else {
        // ルームが削除された場合
        setCurrentRoom(null);
        setQuizRoom(null);
        setIsLeader(false);
        setCurrentWaitingRoomId(null);
        setWaitingRoom(null);
        
        // ホームに戻る
        router.push('/quiz');
      }
    }, (error) => {
      console.error('ルーム情報の取得に失敗しました', error);
      setError('ルーム情報の取得に失敗しました');
    });

    return () => {
      unsubscribe();
    };
  }, [currentWaitingRoomId, currentUser, setQuizRoom, setIsLeader, setHasAnsweringRight, setWaitingRoom, router]);

  /**
   * 特定のルームの情報をリアルタイムで監視する
   */
  const useRoomListener = useCallback((roomId: string) => {
    const [room, setRoom] = useState<QuizRoom | null>(null);
    const [previousStatus, setPreviousStatus] = useState<RoomStatus | null>(null);
    const [previousStatsUpdated, setPreviousStatsUpdated] = useState<boolean | undefined>(undefined);
    const [prevQuizIndex, setPrevQuizIndex] = useState<number>(-1);
    const [previousReadyForNext, setPreviousReadyForNext] = useState<boolean | undefined>(undefined);
    
    useEffect(() => {
      if (!roomId) return;
      
      const roomRef = doc(db, 'quiz_rooms', roomId);
      const unsubscribe = onSnapshot(roomRef, (docSnap) => {
        if (docSnap.exists()) {
          const roomData = docSnap.data() as Omit<QuizRoom, 'roomId'>;
          const roomWithId = { ...roomData, roomId: docSnap.id } as QuizRoom;
          
          // ルームのステータスが変わったかを確認
          if (previousStatus !== null && previousStatus !== roomData.status) {
            // ルームが完了状態になったら統計情報を更新
            if (roomData.status === 'completed') {
              updateUserStatsOnRoomComplete(docSnap.id).catch(err => {
                console.error('統計更新エラー:', err);
              });
              
              // statsUpdatedフラグが設定されない場合のバックアップとして機能
              // 統計が更新されないエラーケースでも、ユーザーが画面に残されないようにする
              console.log('クイズが完了しました。統計更新フラグが8秒以内に設定されない場合は自動リダイレクト実行します');
              setTimeout(() => {
                // 最新のルーム情報を取得して確認
                getDoc(roomRef).then(latestSnapshot => {
                  if (latestSnapshot.exists()) {
                    const latestData = latestSnapshot.data();
                    // statsUpdatedフラグが設定されていない場合のみリダイレクト
                    if (!latestData.statsUpdated) {
                      console.log('統計更新フラグが設定されていないため、バックアップリダイレクトを実行します');
                      router.push('/quiz');
                    }
                  } else {
                    // ルームが存在しなくなった場合もリダイレクト
                    router.push('/quiz');
                  }
                }).catch(err => {
                  console.error('バックアップリダイレクトチェック中にエラー:', err);
                  // エラー時はデフォルトでリダイレクト
                  router.push('/quiz');
                });
              }, 8000);
            }
          }
          
          // statsUpdatedフラグが変更されたか確認（undefinedからtrueへの変更も検出）
          if ((previousStatsUpdated === undefined && roomData.statsUpdated === true) || 
              (previousStatsUpdated === false && roomData.statsUpdated === true)) {
            console.log('統計更新フラグが設定されました。クイズ選択画面に戻ります...');
            // 統計更新完了時にクイズ選択画面にリダイレクト
            router.push('/quiz');
          }
          
          // クイズインデックスの変更を検知
          if (prevQuizIndex !== -1 && prevQuizIndex !== roomData.currentQuizIndex) {
            console.log(`問題が更新されました: ${prevQuizIndex} → ${roomData.currentQuizIndex}`);
          }
          
          // readyForNextQuestionフラグの検出 - リーダーでない場合に使用
          if (roomData.readyForNextQuestion === true && previousReadyForNext !== true && 
              roomData.status === 'in_progress' && currentUser && 
              roomData.roomLeaderId === currentUser.uid) {
            
            console.log('次の問題に進むフラグが検出されました。次の問題に進みます');
            
            // 一度だけ実行するためにフラグをリセット
            updateDoc(roomRef, { readyForNextQuestion: false }).catch(err => {
              console.error('readyForNextQuestionフラグのリセットに失敗:', err);
            });
            
            // goToNextQuizを呼び出す
            goToNextQuiz(roomId).catch(err => {
              console.error('次の問題への移動に失敗:', err);
            });
          }
          
          // 現在の状態を保存
          setPreviousStatus(roomData.status);
          setPreviousStatsUpdated(roomData.statsUpdated);
          setPrevQuizIndex(roomData.currentQuizIndex);
          setPreviousReadyForNext(roomData.readyForNextQuestion);
          
          setRoom(roomWithId);
          setQuizRoom(roomWithId);
          
          // 待機中ルームの状態も更新
          if (roomData.status === 'waiting') {
            // participants フィールドが存在することを確認
            if (!roomData.participants) {
              console.warn('Room has no participants field:', roomData);
              // 空のオブジェクトをデフォルトとして使用
              roomData.participants = {};
            }
            
            // 参加者数の計算を追加
            const participantCount = Object.keys(roomData.participants).length;
            console.log(`Room ${docSnap.id} updated: ${participantCount} participants`);
            
            setWaitingRoom(roomWithId);
          } else {
            // ゲーム開始・終了で待機中状態をクリア
            setWaitingRoom(null);
          }
          
          if (currentUser) {
            setIsLeader(currentUser.uid === roomData.roomLeaderId);
            
            // 解答権の状態を更新
            if (roomData.currentState && roomData.currentState.currentAnswerer) {
              setHasAnsweringRight(roomData.currentState.currentAnswerer === currentUser.uid);
            } else {
              setHasAnsweringRight(false);
            }
            
            // 現在のクイズデータを取得
            if (roomData.status === 'in_progress' && roomData.currentState) {
              fetchCurrentQuizData(roomWithId);
            }
          }
        } else {
          // ルームが削除された場合はリダイレクトと状態クリア
          setRoom(null);
          setQuizRoom(null);
          setWaitingRoom(null);
          router.push('/quiz');
        }
      }, (error) => {
        console.error('Room listener error:', error);
        setError('ルーム情報の取得中にエラーが発生しました');
      });
      
      return () => unsubscribe();
    }, [roomId, currentUser, router, previousStatus, previousStatsUpdated, previousReadyForNext, prevQuizIndex, setQuizRoom, setIsLeader, setHasAnsweringRight, setWaitingRoom, goToNextQuiz]);
    
    return room;
  }, [currentUser, setQuizRoom, setIsLeader, setHasAnsweringRight, setWaitingRoom, router, goToNextQuiz]);

  /**
   * 現在のクイズデータを取得する (内部用)
   */
  const fetchCurrentQuizData = async (roomData: QuizRoom) => {
    if (!roomData.currentState || !roomData.currentState.quizId) return;

    try {
      const quizId = roomData.currentState.quizId;
      const unitId = roomData.unitId;
      
      if (!unitId) {
        console.error('単元IDが指定されていません');
        return;
      }
      
      const quizRef = doc(db, 'genres', roomData.genre, 'quiz_units', unitId, 'quizzes', quizId);
      const quizDoc = await getDoc(quizRef);
      
      if (quizDoc.exists()) {
        const quizData = quizDoc.data() as Quiz;
        setCurrentQuizData(quizData);
        setCurrentQuiz(quizData);
      }
    } catch (err) {
      console.error('クイズデータの取得に失敗しました', err);
    }
  };

  // 初期化時にPendingルーム作成リクエストを処理
  useEffect(() => {
    if (!currentUser || !userProfile) return;
    
    // ルームからの退出後に保留になっている新規ルーム作成リクエストを処理
    const handlePendingRoomCreation = async () => {
      try {
        const isPendingCreation = sessionStorage.getItem('pendingRoomCreation') === 'true';
        
        if (isPendingCreation) {
          console.log('[useQuizRoom] 保留中のルーム作成リクエストを検出しました');
          
          // 保存されていたリクエストデータを取得
          const pendingDataStr = sessionStorage.getItem('pendingRoomData');
          if (pendingDataStr) {
            try {
              const pendingData = JSON.parse(pendingDataStr);
              console.log('[useQuizRoom] 保存されていたルーム作成情報:', pendingData);
              
              // リクエストデータが有効な場合、ルームを作成
              if (pendingData && pendingData.genre) {
                console.log('[useQuizRoom] 保存されたデータを使用して新規ルームを作成します');
                
                setLoading(true);
                
                try {
                  // ルーム作成処理を実行
                  const roomId = await findOrCreateNewRoom(
                    pendingData.roomName || `${pendingData.genre}のクイズルーム`,
                    pendingData.genre,
                    pendingData.classType || 'ユーザー作成',
                    pendingData.unitId
                  );
                  
                  if (roomId) {
                    console.log(`[useQuizRoom] 保留されていたルームを作成しました: ${roomId}`);
                  } else {
                    console.error('[useQuizRoom] 保留されていたルーム作成に失敗しました');
                  }
                } catch (createErr) {
                  console.error('[useQuizRoom] 保留中のルーム作成エラー:', createErr);
                } finally {
                  setLoading(false);
                }
              }
            } catch (parseErr) {
              console.error('[useQuizRoom] 保存データの解析エラー:', parseErr);
            }
          } else {
            console.log('[useQuizRoom] 保留中のルーム作成リクエストがありますが、詳細データはありません');
          }
          
          // 処理完了後、保存データをクリア
          sessionStorage.removeItem('pendingRoomCreation');
          sessionStorage.removeItem('pendingRoomData');
        }
      } catch (err) {
        console.error('[useQuizRoom] 保留中のルーム作成チェック中にエラー:', err);
        // エラーが発生しても安全のためストレージをクリア
        try {
          sessionStorage.removeItem('pendingRoomCreation');
          sessionStorage.removeItem('pendingRoomData');
        } catch (e) {}
      }
    };
    
    // 現在のルームIDがnullの場合にのみ保留中のリクエストを処理
    if (!currentWaitingRoomId) {
      handlePendingRoomCreation();
    }
  }, [currentUser, userProfile, currentWaitingRoomId, findOrCreateNewRoom]);

  return {
    // 状態
    availableRooms,
    useRoomListener,
    currentRoom,
    updateUserStatsOnRoomComplete,
    loading,
    error,
    currentWaitingRoomId,
    confirmRoomSwitch,
    roomToJoin,
    currentQuizData,
    currentQuizAnswer,
    hasClickedQuiz,
    quizResult,
    isRoomLeader,
    isRoomActive,
    isRoomCompleted,
    currentParticipants,
    sortedParticipants,

    // ルーム管理
    fetchRoomList,
    createNewRoom,
    joinExistingRoom,
    exitRoom,
    findOrCreateNewRoom,
    
    // ルーム操作
    toggleReadyStatus,
    startQuizGame,
    finishQuizGame,
    
    // クイズ操作
    handleQuizClick,
    setCurrentQuizAnswer,
    submitQuizAnswer,
    goToNextQuiz,
    showAnswer,
    fetchResultRanking,
    
    // ルーム切り替え処理
    setRoomToJoin,
    setConfirmRoomSwitch,
    switchRoom,
    cancelRoomSwitch,
    
    // エラーハンドリング
    setError
  };
}