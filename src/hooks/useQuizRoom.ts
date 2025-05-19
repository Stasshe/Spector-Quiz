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
  const [currentWaitingRoomId, setCurrentWaitingRoomId] = useState<string | null>(null);
  
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

    console.log(`ルーム参加リクエスト: ${roomId}, 現在のルーム: ${currentWaitingRoomId}`);

    // 既に別の待機中ルームにいる場合は確認
    if (currentWaitingRoomId && currentWaitingRoomId !== roomId) {
      console.log('別のルームに既に参加中のため、切り替え確認ダイアログを表示します');
      // 確認用にルーム情報を取得しておく
      try {
        const currentRoomData = await getRoomById(currentWaitingRoomId);
        console.log('現在参加中のルーム情報:', currentRoomData);
        
        const roomToJoinData = await getRoomById(roomId);
        console.log('参加先のルーム情報:', roomToJoinData);
        
        // ルーム情報を保存して確認ダイアログを表示
        setRoomToJoin({
          roomId,
          roomName: roomToJoinData.name
        });
        setConfirmRoomSwitch(true);
        console.log('ルーム切り替え確認ダイアログを表示しました');
        return false;
      } catch (err) {
        console.error('ルーム情報の取得中にエラーが発生しました:', err);
        // エラーの詳細を表示
        if (err instanceof Error) {
          setError(`ルーム情報の取得に失敗しました: ${err.message}`);
        } else {
          setError('ルーム情報の取得に失敗しました');
        }
        return false;
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

    try {
      setLoading(true);
      
      const success = await leaveRoom(
        roomId, 
        currentUser.uid, 
        isRoomLeader
      );
      
      if (success) {
        setCurrentWaitingRoomId(null);
        setWaitingRoom(null); // null は許容される型なのでこのままで良い
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
  }, [currentUser, isRoomLeader, router, setWaitingRoom]);

  /**
   * 参加中のルームを抜けて新しいルームに参加
   */
  const switchRoom = useCallback(async () => {
    console.log('[RoomSwitch] 開始:', {
      currentUser: currentUser?.uid,
      hasUserProfile: !!userProfile,
      roomToJoin
    });
    
    if (!currentUser || !userProfile || !roomToJoin) {
      console.warn('[RoomSwitch] 中断: 必要なデータが不足しています');
      setConfirmRoomSwitch(false);
      return false;
    }

    try {
      setLoading(true);
      
      // 現在のルームから退出
      if (currentWaitingRoomId) {
        console.log(`[RoomSwitch] 現在のルーム(${currentWaitingRoomId})から退出します`);
        try {
          await leaveRoom(
            currentWaitingRoomId,
            currentUser.uid,
            false // 強制的に非リーダー扱いで退出
          );
          console.log('[RoomSwitch] 退出成功');
        } catch (leaveErr) {
          console.error('[RoomSwitch] 退出エラー:', leaveErr);
          // エラーがあっても続行（新しいルーム参加を優先）
        }
      }
      
      // 新しいルーム作成か既存ルーム参加かを判断
      if (roomToJoin.roomId === 'pending-creation') {
        // これは新規作成の場合のコールバック
        // ルームから退出は成功しているため、未処理のフラグをクリアして
        // 退出状態をクリーンにする
        
        setCurrentWaitingRoomId(null); // 退出は成功しているので現在のルームIDをクリア
        setWaitingRoom(null);
        
        // 状態をクリア
        setRoomToJoin(null);
        setConfirmRoomSwitch(false);
        
        console.log('[RoomSwitch] 新規ルーム作成モードで完了');
        return true;
      } else {
        // 既存の特定ルームへの参加
        console.log(`[RoomSwitch] 既存ルーム(${roomToJoin.roomId})に参加します`);
        
        const success = await joinRoom(
          roomToJoin.roomId,
          currentUser.uid,
          userProfile.username,
          userProfile.iconId
        );
        
        if (success) {
          // コンテキストを更新
          setCurrentWaitingRoomId(roomToJoin.roomId);
          
          // ルーム情報を取得
          try {
            const roomData = await getRoomById(roomToJoin.roomId);
            setWaitingRoom(roomData);
            
            // ルームページへ移動
            router.push(`/quiz/room?id=${roomToJoin.roomId}`);
            
            // 状態をクリア
            setRoomToJoin(null);
            setConfirmRoomSwitch(false);
            console.log('[RoomSwitch] 既存ルームへの参加が完了しました');
            return true;
          } catch (roomErr) {
            console.error('[RoomSwitch] ルーム情報の取得に失敗:', roomErr);
            setError('ルーム情報の取得に失敗しました');
            return false;
          }
        } else {
          console.error('[RoomSwitch] ルームへの参加に失敗しました');
          setError('ルームへの参加に失敗しました');
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

    // 既に待機中ルームに参加している場合は、切り替え確認を表示
    if (currentWaitingRoomId) {
      try {
        // 現在参加中のルーム情報を取得
        const currentRoomData = await getRoomById(currentWaitingRoomId);
        console.log('現在参加中のルーム情報:', currentRoomData);

        // 確認ダイアログを表示するための情報を設定
        // roomToJoin.roomIdは実際の作成・参加ルームIDではなくダミー値を一時的に設定
        const roomNameToShow = `${genre}の${unitId ? '単元' : ''}クイズルーム`;
        console.log(`ルーム切り替え確認ダイアログを表示します: ${roomNameToShow}`);
        
        setRoomToJoin({
          roomId: 'pending-creation',  // 新規作成用の一時的なID
          roomName: roomNameToShow
        });
        setConfirmRoomSwitch(true);
        
        // 確認ダイアログを表示するため、この時点でnullを返す
        setLoading(false);
        return null;
      } catch (err) {
        console.error('待機中ルーム情報の確認中にエラーが発生しました:', err);
        // エラーが発生してもnullを返す前にさらに詳細を記録
        console.log('currentWaitingRoomId:', currentWaitingRoomId);
        console.log('状態リセット中...');
        
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
  }, [currentUser, userProfile, currentWaitingRoomId, joinCreatedRoom, getRoomById]);

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