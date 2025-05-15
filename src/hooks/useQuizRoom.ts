'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/config/firebase';
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  deleteField,
  onSnapshot, 
  serverTimestamp,
  increment,
  runTransaction,
  Timestamp,
  limit
} from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';
import { QuizRoom, RoomListing, RoomStatus } from '@/types/room';
import { useQuiz } from '@/context/QuizContext';
import { genreClasses } from '@/constants/genres';

// 8分（ミリ秒）- WaitingRoomFloating.tsxと同期を保つ
const AUTO_DISBAND_TIME_MS = 8 * 60 * 1000;

export function useQuizRoom() {
  const { currentUser, userProfile } = useAuth();
  const { 
    setQuizRoom, 
    setIsLeader, 
    setCurrentQuiz, 
    setHasAnsweringRight,
    setWaitingRoom 
  } = useQuiz();
  const [availableRooms, setAvailableRooms] = useState<RoomListing[]>([]);
  const [currentRoom, setCurrentRoom] = useState<QuizRoom | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 待機中ルームからの退出確認用の状態
  const [roomToJoin, setRoomToJoin] = useState<string | null>(null);
  const [confirmRoomSwitch, setConfirmRoomSwitch] = useState(false);
  const [currentWaitingRoomId, setCurrentWaitingRoomId] = useState<string | null>(null);
  const router = useRouter();

  // 利用可能なルーム一覧を取得
  const fetchAvailableRooms = useCallback(async (genre: string, classType: string) => {
    try {
      setLoading(true);
      
      // 古いルームを自動解散チェック
      await checkAndDisbandOldRooms();
      
      const roomsQuery = query(
        collection(db, 'quiz_rooms'),
        where('status', '==', 'waiting'),
        where('genre', '==', genre),
        orderBy('startedAt', 'desc')
      );
      
      const roomsSnapshot = await getDocs(roomsQuery);
      
      // 事前にすべての単元IDを収集
      const unitIds = new Set<string>();
      const unitCache: { [unitId: string]: { title: string } } = {};
      
      // まず、必要な単元IDを集める
      roomsSnapshot.docs.forEach(docSnap => {
        const roomData = docSnap.data() as QuizRoom;
        if (roomData.unitId) {
          unitIds.add(roomData.unitId);
        }
      });
      
      // 単元情報を一括でフェッチ（必要な場合のみ）
      if (unitIds.size > 0) {
        const unitPromises = Array.from(unitIds).map(async unitId => {
          try {
            const unitRef = doc(db, 'genres', genre, 'quiz_units', unitId);
            const unitSnap = await getDoc(unitRef);
            if (unitSnap.exists()) {
              const unitData = unitSnap.data();
              unitCache[unitId] = { title: unitData.title || '' };
            }
          } catch (err) {
            console.error(`Error fetching unit data for ID ${unitId}:`, err);
          }
        });
        
        // すべての単元データを並行してフェッチ
        await Promise.all(unitPromises);
      }
      
      // ルーム情報を構築
      const rooms: RoomListing[] = [];
      
      for (const docSnap of roomsSnapshot.docs) {
        const roomData = docSnap.data() as QuizRoom;
        // クラスタイプでフィルタリング
        const isUserCreated = roomData.classType === 'ユーザー作成';
        if ((classType === 'ユーザー作成' && isUserCreated) || 
            (classType === '公式' && !isUserCreated)) {
            
          // キャッシュから単元名を取得
          let unitName = '';
          if (roomData.unitId && unitCache[roomData.unitId]) {
            unitName = unitCache[roomData.unitId].title;
          }
            
          const participantCount = roomData.participants ? Object.keys(roomData.participants).length : 0;
            
          rooms.push({
            roomId: docSnap.id,
            name: roomData.name,
            genre: roomData.genre,
            unitId: roomData.unitId || '',
            unitName: unitName,
            participantCount: participantCount,
            status: roomData.status
          });
        }
      }
      
      setAvailableRooms(rooms);
      return rooms;
    } catch (err) {
      console.error('Error fetching rooms:', err);
      setError('ルーム一覧の取得中にエラーが発生しました');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  // ルームを作成
  const createRoom = useCallback(async (genre: string, unitId: string, classType: string) => {
    if (!currentUser || !userProfile) {
      setError('ログインが必要です');
      return null;
    }
    
    try {
      setLoading(true);
      
      // ユーザーが既に別のルームに参加しているか確認
      const userRef = doc(db, 'users', currentUser.uid);
      const userDoc = await getDoc(userRef);
      
      if (userDoc.exists() && userDoc.data().currentRoomId) {
        const currentRoomId = userDoc.data().currentRoomId;
        const currentRoomRef = doc(db, 'quiz_rooms', currentRoomId);
        const currentRoomSnap = await getDoc(currentRoomRef);
        
        if (currentRoomSnap.exists()) {
          const currentRoomData = currentRoomSnap.data();
          
          // 進行中のルームに参加している場合は、そのルームから退出できない
          if (currentRoomData.status === 'in_progress') {
            setError('あなたは既に進行中のルームに参加しています。そのルームを完了するか退出してから再試行してください。');
            router.push(`/quiz/room?id=${currentRoomId}`);
            return null;
          }
          
          // 待機中のルームに参加している場合は退出
          if (currentRoomData.status === 'waiting') {
            try {
              if (currentRoomData.roomLeaderId === currentUser.uid) {
                // リーダーの場合はルームを削除
                try {
                  await deleteDoc(currentRoomRef);
                  console.log(`以前のルーム(${currentRoomId})を削除しました`);
                } catch (deleteErr: any) {
                  // 削除に失敗した場合、ステータスを変更する
                  if (deleteErr?.code === 'permission-denied') {
                    console.warn(`ルーム ${currentRoomId} の削除権限がありません。状態を更新します。`);
                    try {
                      await updateDoc(currentRoomRef, {
                        status: 'completed',
                        updatedAt: serverTimestamp(),
                        automaticallyClosed: true,
                        closeReason: 'ユーザーが新しいルームを作成'
                      });
                      console.log(`ルーム ${currentRoomId} を完了状態に更新しました`);
                    } catch (updateErr) {
                      console.error(`ルーム ${currentRoomId} の更新中にエラー:`, updateErr);
                    }
                  } else {
                    console.error(`ルーム ${currentRoomId} の削除中にエラー:`, deleteErr);
                  }
                }
              } else {
                // 参加者の場合は参加者リストから削除
                try {
                  await updateDoc(currentRoomRef, {
                    [`participants.${currentUser.uid}`]: deleteField(),
                    updatedAt: serverTimestamp()
                  });
                  console.log(`以前のルーム(${currentRoomId})から退出しました`);
                } catch (err) {
                  console.error(`ルーム ${currentRoomId} からの退出中にエラー:`, err);
                }
              }
              
              // ユーザーの現在のルーム情報をクリア（トランザクションの前に行う）
              try {
                await updateDoc(userRef, {
                  currentRoomId: null
                });
                console.log(`ユーザー ${currentUser.uid} のルーム情報をクリアしました`);
              } catch (err) {
                console.error(`ユーザー ${currentUser.uid} のルーム情報更新エラー:`, err);
              }
            } catch (err) {
              console.error(`以前のルーム(${currentRoomId})からの退出中にエラー:`, err);
              // エラーが発生しても続行する
            }
          }
        }
      }
      
      // クラスタイプに基づいてルーム名を設定
      const name = `${genre} (${classType})`;
      
      const quizQuery = query(
        collection(db, 'quizzes'),
        where('genre', '==', genre),
        orderBy('useCount')
      );
      
      const quizSnapshot = await getDocs(quizQuery);
      const quizIds: string[] = [];
      
      quizSnapshot.forEach(doc => {
        quizIds.push(doc.id);
      });
      
      if (quizIds.length === 0) {
        throw new Error('選択したジャンルにクイズがありません');
      }
      
      // 最大10問までランダムに選択
      const selectedQuizIds = quizIds.sort(() => 0.5 - Math.random()).slice(0, 10);
      
      const newRoom: Omit<QuizRoom, 'roomId'> = {
        name,
        genre,
        unitId,  // 単元ID追加
        classType,
        roomLeaderId: currentUser.uid,
        participants: {
          [currentUser.uid]: {
            username: userProfile.username,
            iconId: userProfile.iconId,
            score: 0,
            isReady: false,
            isOnline: true
          }
        },
        currentQuizIndex: 0,
        quizIds: selectedQuizIds,
        totalQuizCount: selectedQuizIds.length,
        startedAt: serverTimestamp() as any,
        updatedAt: serverTimestamp() as any,
        status: 'waiting',
        currentState: {
          quizId: '',
          startTime: serverTimestamp() as any,
          endTime: null,
          currentAnswerer: null,
          answerStatus: 'waiting',
          isRevealed: false
        }
      };
      
      // まずルームを作成
      const roomRef = await addDoc(collection(db, 'quiz_rooms'), newRoom);
      const roomId = roomRef.id;
      console.log(`新しいルーム(${roomId})を作成しました`);
      
      try {
        // ユーザーの現在のルーム情報を更新
        await updateDoc(doc(db, 'users', currentUser.uid), {
          currentRoomId: roomId
        });
      } catch (updateErr) {
        console.error('ユーザー情報の更新中にエラー:', updateErr);
        // エラーが発生しても続行する（ルームは作成済み）
      }
      
      // 作成したルームを返す
      const createdRoom = {
        ...newRoom,
        roomId
      } as QuizRoom;
      
      setCurrentRoom(createdRoom);
      setQuizRoom(createdRoom);
      setIsLeader(true);
      
      router.push(`/quiz/room?id=${roomId}`);
      
      return createdRoom;
    } catch (err: any) {
      console.error('Error creating room:', err);
      // Firebaseの権限エラーを特別に処理
      if (err.code === 'permission-denied') {
        setError('権限エラーが発生しました。以前のルームからの退出処理に問題がある可能性があります。ページをリロードして再試行してください。');
        
        // ユーザーの現在のルーム情報をクリアする試み
        if (currentUser) {
          try {
            const userRef = doc(db, 'users', currentUser.uid);
            await updateDoc(userRef, { currentRoomId: null });
            console.log('ユーザーのルーム情報をリセットしました');
          } catch (clearErr) {
            console.error('ユーザーのルーム情報リセット中にエラー:', clearErr);
          }
        }
      } else {
        setError(err.message || 'ルームの作成中にエラーが発生しました');
      }
      return null;
    } finally {
      setLoading(false);
    }
  }, [currentUser, userProfile, router, setQuizRoom, setIsLeader]);

  // 単元を使ってルームを作成
  const createRoomWithUnit = useCallback(async (genreId: string, unitId: string, classType: string) => {
    if (!currentUser || !userProfile) {
      setError('ログインが必要です');
      return null;
    }
    
    try {
      setLoading(true);
      
      // ユーザーが既に別のルームに参加しているか確認
      const userRef = doc(db, 'users', currentUser.uid);
      const userDoc = await getDoc(userRef);
      
      if (userDoc.exists() && userDoc.data().currentRoomId) {
        const currentRoomId = userDoc.data().currentRoomId;
        const currentRoomRef = doc(db, 'quiz_rooms', currentRoomId);
        const currentRoomSnap = await getDoc(currentRoomRef);
        
        if (currentRoomSnap.exists()) {
          const currentRoomData = currentRoomSnap.data();
          
          // 進行中のルームに参加している場合は、そのルームから退出できない
          if (currentRoomData.status === 'in_progress') {
            setError('あなたは既に進行中のルームに参加しています。そのルームを完了するか退出してから再試行してください。');
            router.push(`/quiz/room?id=${currentRoomId}`);
            return null;
          }
          
          // 待機中のルームに参加している場合は退出
          if (currentRoomData.status === 'waiting') {
            try {
              if (currentRoomData.roomLeaderId === currentUser.uid) {
                // リーダーの場合はルームを削除
                try {
                  await deleteDoc(currentRoomRef);
                  console.log(`以前のルーム(${currentRoomId})を削除しました`);
                } catch (deleteErr: any) {
                  // 削除に失敗した場合、ステータスを変更する
                  if (deleteErr?.code === 'permission-denied') {
                    console.warn(`ルーム ${currentRoomId} の削除権限がありません。状態を更新します。`);
                    try {
                      await updateDoc(currentRoomRef, {
                        status: 'completed',
                        updatedAt: serverTimestamp(),
                        automaticallyClosed: true,
                        closeReason: 'ユーザーが新しいルームを作成'
                      });
                      console.log(`ルーム ${currentRoomId} を完了状態に更新しました`);
                    } catch (updateErr) {
                      console.error(`ルーム ${currentRoomId} の更新中にエラー:`, updateErr);
                    }
                  } else {
                    console.error(`ルーム ${currentRoomId} の削除中にエラー:`, deleteErr);
                  }
                }
              } else {
                // 参加者の場合は参加者リストから削除
                try {
                  await updateDoc(currentRoomRef, {
                    [`participants.${currentUser.uid}`]: deleteField(),
                    updatedAt: serverTimestamp()
                  });
                  console.log(`以前のルーム(${currentRoomId})から退出しました`);
                } catch (err) {
                  console.error(`ルーム ${currentRoomId} からの退出中にエラー:`, err);
                }
              }
              
              // ユーザーの現在のルーム情報をクリア（トランザクションの前に行う）
              try {
                await updateDoc(userRef, {
                  currentRoomId: null
                });
                console.log(`ユーザー ${currentUser.uid} のルーム情報をクリアしました`);
              } catch (err) {
                console.error(`ユーザー ${currentUser.uid} のルーム情報更新エラー:`, err);
              }
            } catch (err) {
              console.error(`以前のルーム(${currentRoomId})からの退出中にエラー:`, err);
              // エラーが発生しても続行する
            }
          }
        }
      }
      
      // 単元データを取得
      const unitRef = doc(db, 'genres', genreId, 'quiz_units', unitId);
      const unitSnap = await getDoc(unitRef);
      
      if (!unitSnap.exists()) {
        throw new Error('指定された単元が見つかりません');
      }
      
      const unitData = unitSnap.data();
      // 単元の難易度を取得（デフォルトは3）
      const unitDifficulty = unitData.difficulty || 3;
      
      // 単元内のクイズを取得
      const quizzesQuery = collection(db, 'genres', genreId, 'quiz_units', unitId, 'quizzes');
      const quizzesSnapshot = await getDocs(quizzesQuery);
      
      const quizIds: string[] = [];
      quizzesSnapshot.forEach(doc => {
        quizIds.push(doc.id);
      });
      
      if (quizIds.length === 0) {
        throw new Error('選択した単元にクイズがありません');
      }
      
      // ジャンル名（表示用）
      const genreRef = doc(db, 'genres', genreId);
      const genreSnap = await getDoc(genreRef);
      const genreName = genreSnap.exists() ? genreSnap.data().name : genreId;
      
      // クラスタイプに基づいてルーム名を設定
      const name = `${genreName} - ${unitData.title} (${classType})`;
      
      const newRoom: Omit<QuizRoom, 'roomId'> = {
        name,
        genre: genreId,
        unitId,  // 単元IDを保存
        unitDifficulty: unitDifficulty, // 単元の難易度を保存
        classType,
        roomLeaderId: currentUser.uid,
        participants: {
          [currentUser.uid]: {
            username: userProfile.username,
            iconId: userProfile.iconId,
            score: 0,
            isReady: false,
            isOnline: true
          }
        },
        currentQuizIndex: 0,
        quizIds,
        totalQuizCount: quizIds.length,
        startedAt: serverTimestamp() as any,
        updatedAt: serverTimestamp() as any,
        status: 'waiting',
        currentState: {
          quizId: '',
          startTime: serverTimestamp() as any,
          endTime: null,
          currentAnswerer: null,
          answerStatus: 'waiting',
          isRevealed: false
        }
      };
      
      // まずルームを作成
      const roomRef = await addDoc(collection(db, 'quiz_rooms'), newRoom);
      const roomId = roomRef.id;
      console.log(`新しいルーム(${roomId})を作成しました`);
      
      try {
        // ユーザーの現在のルーム情報を更新
        await updateDoc(doc(db, 'users', currentUser.uid), {
          currentRoomId: roomId
        });
        
        // 単元の使用回数を増やす
        await updateDoc(unitRef, {
          useCount: (unitData.useCount || 0) + 1
        });
      } catch (updateErr) {
        console.error('ユーザー情報または単元使用回数の更新中にエラー:', updateErr);
        // エラーが発生しても続行する（ルームは作成済み）
      }
      
      // 作成したルームを返す
      const createdRoom = {
        ...newRoom,
        roomId
      } as QuizRoom;
      
      setCurrentRoom(createdRoom);
      setQuizRoom(createdRoom);
      setIsLeader(true);
      
      // 待機中ルームとして設定
      setWaitingRoom(createdRoom);
      
      router.push(`/quiz/room?id=${roomId}`);
      
      return createdRoom;
    } catch (err: any) {
      console.error('Error creating room with unit:', err);
      // Firebaseの権限エラーを特別に処理
      if (err.code === 'permission-denied') {
        setError('権限エラーが発生しました。以前のルームからの退出処理に問題がある可能性があります。ページをリロードして再試行してください。');
        
        // ユーザーの現在のルーム情報をクリアする試み
        if (currentUser) {
          try {
            const userRef = doc(db, 'users', currentUser.uid);
            await updateDoc(userRef, { currentRoomId: null });
            console.log('ユーザーのルーム情報をリセットしました');
          } catch (clearErr) {
            console.error('ユーザーのルーム情報リセット中にエラー:', clearErr);
          }
        }
      } else {
        setError(err.message || 'ルームの作成中にエラーが発生しました');
      }
      return null;
    } finally {
      setLoading(false);
    }
  }, [currentUser, userProfile, router, setQuizRoom, setIsLeader, setWaitingRoom]);

  // ルームに参加
  const joinRoom = useCallback(async (roomId: string, force: boolean = false) => {
    if (!currentUser || !userProfile) {
      setError('ログインが必要です');
      return false;
    }
    
    try {
      setLoading(true);
      
      // ユーザーが既に別のルームに参加しているか確認
      const userRef = doc(db, 'users', currentUser.uid);
      const userDoc = await getDoc(userRef);
      
      // まず、ユーザーのルーム情報をクリア（権限エラーを防止するため）
      try {
        if (userDoc.exists() && userDoc.data().currentRoomId) {
          // 現在のルームIDを保存
          const existingRoomId = userDoc.data().currentRoomId;
          
          // ユーザードキュメントを先にクリア（権限エラーを防止するため）
          await updateDoc(userRef, { currentRoomId: null });
          console.log(`ユーザー ${currentUser.uid} のルーム情報を事前にクリアしました`);
          
          // 同じルームに参加しようとしている場合は、そのままルームページに移動
          if (existingRoomId === roomId) {
            router.push(`/quiz/room?id=${roomId}`);
            return true;
          }
          
          // 別のルームに既に参加している場合、その情報を処理
          const currentRoomRef = doc(db, 'quiz_rooms', existingRoomId);
          const currentRoomSnap = await getDoc(currentRoomRef);
          
          if (currentRoomSnap.exists()) {
            const currentRoomData = currentRoomSnap.data();
            
            // 進行中のルームに参加している場合は、そのルームから退出できない
            if (currentRoomData.status === 'in_progress') {
              setError('あなたは既に進行中のルームに参加しています。そのルームを完了するか退出してから再試行してください。');
              
              // 元のルーム情報を復元
              await updateDoc(userRef, { currentRoomId: existingRoomId });
              
              router.push(`/quiz/room?id=${existingRoomId}`);
              return false;
            }
            
            // 待機中のルームに参加している場合は確認
            if (currentRoomData.status === 'waiting' && !force) {
              // 確認が必要な場合は状態を保存して確認プロセスを開始
              console.log(`既に待機中のルーム(${existingRoomId})に参加しています。確認が必要です。`);
              
              // 元のルーム情報を復元
              await updateDoc(userRef, { currentRoomId: existingRoomId });
              
              setCurrentWaitingRoomId(existingRoomId);
              setRoomToJoin(roomId);
              setConfirmRoomSwitch(true);
              setLoading(false);
              setError(null); // 以前のエラーをクリア
              return false;
            }
            
            // 確認済みまたは自動退出の場合
            if (force || currentRoomData.status === 'waiting') {
              // 古いルームから退出する処理
              try {
                if (currentRoomData.roomLeaderId === currentUser.uid) {
                  // リーダーの場合はルームを削除
                  try {
                    await deleteDoc(currentRoomRef);
                    console.log(`以前のルーム(${existingRoomId})を削除しました`);
                  } catch (deleteErr: any) {
                    // 削除に失敗した場合、ステータスを変更する代替手段
                    if (deleteErr?.code === 'permission-denied') {
                      console.warn(`ルーム ${existingRoomId} の削除権限がありません。状態を更新します。`);
                      try {
                        await updateDoc(currentRoomRef, {
                          status: 'completed',
                          updatedAt: serverTimestamp(),
                          automaticallyClosed: true,
                          closeReason: 'ユーザーが他のルームに参加'
                        });
                        console.log(`ルーム ${existingRoomId} を完了状態に更新しました`);
                      } catch (updateErr) {
                        console.error(`ルーム ${existingRoomId} の更新中にエラー:`, updateErr);
                      }
                    } else {
                      console.error(`ルーム ${existingRoomId} の削除中にエラー:`, deleteErr);
                    }
                  }
                } else {
                  // 参加者の場合は参加者リストから削除
                  try {
                    await updateDoc(currentRoomRef, {
                      [`participants.${currentUser.uid}`]: deleteField(),
                      updatedAt: serverTimestamp()
                    });
                    console.log(`以前のルーム(${existingRoomId})から退出しました`);
                  } catch (err) {
                    console.error(`ルーム ${existingRoomId} からの退出中にエラー:`, err);
                  }
                }
              } catch (err) {
                console.error(`以前のルーム(${existingRoomId})からの退出中にエラー:`, err);
                // エラーが発生しても続行する
              }
            }
          }
        }
      } catch (userErr) {
        console.error('ユーザー情報のリセット中にエラー:', userErr);
        // エラーが発生しても続行
      }
      
      // 参加先のルームの情報を確認
      const roomRef = doc(db, 'quiz_rooms', roomId);
      
      // トライキャッチブロックを使って、各操作を個別に保護
      try {
        const roomSnap = await getDoc(roomRef);
        
        if (!roomSnap.exists()) {
          throw new Error('ルームが見つかりません');
        }
        
        const roomData = roomSnap.data() as Omit<QuizRoom, 'roomId'>;
        
        if (roomData.status !== 'waiting') {
          throw new Error('このルームは既に開始されているか終了しています');
        }
        
        // ルームの参加者に追加 - トライキャッチで保護
        try {
          await updateDoc(roomRef, {
            [`participants.${currentUser.uid}`]: {
              username: userProfile.username,
              iconId: userProfile.iconId,
              score: 0,
              isReady: false,
              isOnline: true
            },
            updatedAt: serverTimestamp()
          });
          console.log(`ルーム ${roomId} の参加者リストに追加しました`);
        } catch (updateErr: any) {
          if (updateErr?.code === 'permission-denied') {
            console.error('権限エラー: ルームの参加者リスト更新が拒否されました');
            throw new Error('ルームへの参加権限がありません。ルーム作成者に連絡するか、別のルームをお試しください。');
          }
          throw updateErr; // その他のエラーは再スロー
        }
        
        // ユーザーの現在のルーム情報を更新 - トライキャッチで保護
        try {
          await updateDoc(doc(db, 'users', currentUser.uid), {
            currentRoomId: roomId
          });
          console.log(`ユーザー ${currentUser.uid} のルーム情報を更新しました`);
        } catch (userErr) {
          console.error('ユーザー情報の更新中にエラー:', userErr);
          // ユーザー情報の更新に失敗した場合は、ルームの参加者リストから削除を試みる
          try {
            await updateDoc(roomRef, {
              [`participants.${currentUser.uid}`]: deleteField(),
              updatedAt: serverTimestamp()
            });
            console.log(`失敗したため、ルーム ${roomId} の参加者リストから削除しました`);
          } catch (cleanupErr) {
            console.error('クリーンアップ中のエラー:', cleanupErr);
          }
          throw userErr; // 元のエラーを再スロー
        }
        
        const joinedRoom = {
          ...roomData,
          roomId
        } as QuizRoom;
        
        setCurrentRoom(joinedRoom);
        setQuizRoom(joinedRoom);
        setIsLeader(currentUser.uid === roomData.roomLeaderId);
        
        // 待機中ルームとして設定（status が waiting の場合のみ）
        if (roomData.status === 'waiting') {
          setWaitingRoom(joinedRoom);
        }
        
        router.push(`/quiz/room?id=${roomId}`);
        
        return true;
      } catch (roomErr: any) {
        // ルーム関連の操作中のエラーを処理
        console.error('ルーム操作中にエラー:', roomErr);
        
        // ユーザー情報をクリーンアップ
        try {
          await updateDoc(doc(db, 'users', currentUser.uid), { currentRoomId: null });
          console.log('エラーによりユーザーのルーム情報をリセットしました');
        } catch (cleanupErr) {
          console.error('クリーンアップ中のエラー:', cleanupErr);
        }
        
        throw roomErr; // エラーを再スロー
      }
    } catch (err: any) {
      console.error('Error joining room:', err);
      
      // Firebaseの権限エラーを特別に処理
      if (err.code === 'permission-denied') {
        setError('権限エラーが発生しました。ページをリロードして再試行してください。問題が続く場合は、しばらく時間をおいてからお試しください。');
        
        // ユーザーの現在のルーム情報を再確認して、クリア
        if (currentUser) {
          try {
            // 強制的にユーザーのルーム情報をクリア
            const userRef = doc(db, 'users', currentUser.uid);
            await updateDoc(userRef, { currentRoomId: null });
            console.log('ユーザーのルーム情報を強制リセットしました');
            
            // ルームリストを再ロード
            fetchAvailableRooms('', '');
          } catch (clearErr) {
            console.error('ユーザーのルーム情報リセット中にエラー:', clearErr);
          }
        }
      } else {
        setError(err.message || 'ルームへの参加中にエラーが発生しました');
      }
      return false;
    } finally {
      setLoading(false);
    }
  }, [currentUser, userProfile, router, setQuizRoom, setIsLeader, setWaitingRoom]);

  // ルームから退出
  const leaveRoom = useCallback(async () => {
    if (!currentUser || !currentRoom) return false;
    
    try {
      setLoading(true);
      
      const roomRef = doc(db, 'quiz_rooms', currentRoom.roomId);
      
      if (currentUser.uid === currentRoom.roomLeaderId) {
        // リーダーが退出する場合、ルームを削除
        await deleteDoc(roomRef);
      } else {
        // 一般参加者の場合は参加者リストから削除
        await updateDoc(roomRef, {
          [`participants.${currentUser.uid}`]: deleteField(),
          updatedAt: serverTimestamp()
        });
      }
      
      // ユーザーのルーム情報をクリア
      await updateDoc(doc(db, 'users', currentUser.uid), {
        currentRoomId: null
      });
      
      setCurrentRoom(null);
      setQuizRoom(null);
      setIsLeader(false);
      setCurrentQuiz(null);
      setHasAnsweringRight(false);
      
      router.push('/quiz');
      
      return true;
    } catch (err) {
      console.error('Error leaving room:', err);
      setError('ルームからの退出中にエラーが発生しました');
      return false;
    } finally {
      setLoading(false);
    }
  }, [currentUser, currentRoom, router, setQuizRoom, setIsLeader, setCurrentQuiz, setHasAnsweringRight]);

  // ジャンルに基づいてルームを探すか作成する
  const findOrCreateRoom = useCallback(async (genre: string, classType: string) => {
    if (!currentUser || !userProfile) {
      setError('ログインが必要です');
      return false;
    }
    
    try {
      setLoading(true);
      
      // まず、該当するジャンルのルームを探す
      const roomsQuery = query(
        collection(db, 'quiz_rooms'),
        where('status', '==', 'waiting'),
        where('genre', '==', genre),
        where('classType', '==', classType)
      );
      
      const roomsSnapshot = await getDocs(roomsQuery);
      
      // 該当するルームが存在する場合、最初のルームに参加
      if (!roomsSnapshot.empty) {
        const roomData = roomsSnapshot.docs[0].data() as QuizRoom;
        const roomId = roomsSnapshot.docs[0].id;
        
        // すでに満員の場合は新しいルームを作成
        const participantCount = Object.keys(roomData.participants).length;
        if (participantCount >= 8) {
          // 単元IDを取得（URLパラメータまたはルームデータから）
          const unitId = roomData.unitId || '';
          return await createRoom(genre, unitId, classType);
        }
        
        // 既存のルームに参加
        return await joinRoom(roomId);
      }
      
      // 該当するルームがない場合、新しいルームを作成
      // 単元IDがない場合は空文字を渡す（APIの仕様に合わせる）
      const unitId = '';
      return await createRoom(genre, unitId, classType);
    } catch (err) {
      console.error('Error finding or creating room:', err);
      setError('ルームの探索/作成中にエラーが発生しました');
      return false;
    } finally {
      setLoading(false);
    }
  }, [currentUser, userProfile, createRoom, joinRoom]);

  // 単元に基づいてルームを探すか作成する
  const findOrCreateRoomWithUnit = useCallback(async (genre: string, unitId: string, classType: string) => {
    if (!currentUser || !userProfile) {
      setError('ログインが必要です');
      return null;
    }
    
    try {
      setLoading(true);
      
      // まず、該当するジャンルと単元の待機中ルームを探す
      const roomsQuery = query(
        collection(db, 'quiz_rooms'),
        where('status', '==', 'waiting'),
        where('genre', '==', genre),
        where('unitId', '==', unitId),
        where('classType', '==', classType)
      );
      
      const roomsSnapshot = await getDocs(roomsQuery);
      
      // 該当するルームが存在する場合、最初のルームに参加
      if (!roomsSnapshot.empty) {
        const roomData = roomsSnapshot.docs[0].data() as QuizRoom;
        const roomId = roomsSnapshot.docs[0].id;
        
        // すでに満員の場合は新しいルームを作成
        const participantCount = Object.keys(roomData.participants).length;
        if (participantCount >= 8) {
          // 満員なので新しいルームを作成
          return await createRoomWithUnit(genre, unitId, classType);
        }
        
        // 既存のルームに参加
        const joined = await joinRoom(roomId);
        
        // 確認ダイアログが表示された場合
        if (!joined && confirmRoomSwitch) {
          // 確認ダイアログが表示された場合は、nullを返してplayWithUnit関数で処理を中断
          console.log('確認ダイアログが表示されました。処理を一時停止します');
          return null;
        }
        
        // 成功した場合
        if (joined) {
          router.push(`/quiz/room?id=${roomId}`);
          return {
            ...roomData,
            roomId
          } as QuizRoom;
        }
        
        // 上記以外のエラーの場合
        if (!joined) {
          console.error('ルームへの参加処理が失敗しました');
          throw new Error('ルームへの参加に失敗しました');
        }
      }
      
      // 該当するルームがない場合、新しいルームを作成
      return await createRoomWithUnit(genre, unitId, classType);
    } catch (err: any) {
      console.error('Error finding or creating room with unit:', err);
      setError(err.message || 'ルームの探索/作成中にエラーが発生しました');
      return null;
    } finally {
      setLoading(false);
    }
  }, [currentUser, userProfile, createRoomWithUnit, joinRoom, router]);

  // 単元名から単元IDを取得するヘルパー関数
  const getUnitIdByName = useCallback(async (genre: string, unitName: string, classType: string = '公式') => {
    try {
      const isOfficial = classType === '公式';
      
      // ジャンル内の単元コレクションへの参照（クラスタイプに応じたパス）
      const collectionPath = isOfficial 
        ? collection(db, 'genres', genre, 'official_quiz_units') 
        : collection(db, 'genres', genre, 'quiz_units');
      
      // 単元名で絞り込むクエリ
      const unitQuery = query(collectionPath, where('title', '==', unitName));
      const unitSnapshot = await getDocs(unitQuery);
      
      if (unitSnapshot.empty) {
        // 単元が見つからない場合はユーザーに通知するためのエラーをスロー
        throw new Error(`単元「${unitName}」が見つかりません。管理者に連絡してください。`);
      }
      
      // 見つかった単元の最初のIDを返す
      return unitSnapshot.docs[0].id;
    } catch (err) {
      console.error('Error getting unit ID:', err);
      // エラーを上位に伝播させる
      throw err;
    }
  }, []);
  
  // 単元がなければ作成する
  const createUnitIfNotExists = useCallback(async (genreId: string, unitName: string, category: string = 'その他') => {
    if (!currentUser) {
      console.error('ユーザーがログインしていません');
      return null;
    }
    
    try {
      // 単元データを作成
      const unitData = {
        title: unitName,
        description: `${unitName}に関するクイズ`,
        category: category,
        createdBy: currentUser.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        useCount: 0,
        isPublic: true,
        difficulty: 3 // デフォルトの難易度を追加
      };
      
      // ランダムIDで単元を作成
      const unitsCollectionRef = collection(db, 'genres', genreId, 'quiz_units');
      const newUnitRef = await addDoc(unitsCollectionRef, unitData);
      
      return newUnitRef.id;
    } catch (err) {
      console.error('単元の作成に失敗しました:', err);
      return null;
    }
  }, [currentUser]);

  // ルームが完了したとき（全問終了時）に統計を更新する関数
  const updateUserStatsOnRoomComplete = useCallback(async (roomId: string) => {
    if (!currentUser) {
      console.error('ユーザーがログインしていません');
      return false;
    }
    
    try {
      // ルームのデータを取得
      const roomRef = doc(db, 'quiz_rooms', roomId);
      const roomSnap = await getDoc(roomRef);
      
      if (!roomSnap.exists()) {
        throw new Error('ルームが見つかりません');
      }
      
      const roomData = roomSnap.data() as QuizRoom;
      
      // ルームが完了状態になっていることを確認
      if (roomData.status !== 'completed') {
        console.log('ルームはまだ完了していません');
        return false;
      }
      
      // 自分の成績を取得
      const myParticipantData = roomData.participants[currentUser.uid];
      if (!myParticipantData) {
        console.error('このルームの参加者データが見つかりません');
        return false;
      }
      
      // 現在のユーザー統計データを取得
      const userRef = doc(db, 'users', currentUser.uid);
      
      await runTransaction(db, async (transaction) => {
        const userDoc = await transaction.get(userRef);
        if (!userDoc.exists()) {
          throw new Error('ユーザーデータが見つかりません');
        }
        
        const userData = userDoc.data();
        const currentStats = userData.stats || {
          totalAnswered: 0,
          correctAnswers: 0,
          genres: {}
        };
        
        // 参加者のスコアを取得（これが正答数を表す）
        const userScore = myParticipantData.score || 0;
        // 全問題数
        const totalAnswered = roomData.totalQuizCount || 0;
        
        // 全体の統計を更新
        const newTotalAnswered = (currentStats.totalAnswered || 0) + totalAnswered;
        const newCorrectAnswers = (currentStats.correctAnswers || 0) + userScore;
        
        // ジャンル別の統計を更新
        const genre = roomData.genre || 'その他';
        // 既存のジャンル別統計がない場合はデフォルト値を使用
        const genreStats = (currentStats.genres || {})[genre] || { totalAnswered: 0, correctAnswers: 0 };
        const newGenreStats = {
          totalAnswered: (genreStats.totalAnswered || 0) + totalAnswered,
          correctAnswers: (genreStats.correctAnswers || 0) + userScore
        };
        
        // 経験値も更新（正答1問につき10ポイント）
        const expGain = userScore * 10;
        
        // ユーザースキルレベルを計算
        const newExp = (userData.exp || 0) + expGain;
        const newRank = calculateRank(newExp);
        
        // 更新するデータ
        transaction.update(userRef, {
          'stats.totalAnswered': newTotalAnswered,
          'stats.correctAnswers': newCorrectAnswers,
          [`stats.genres.${genre}`]: newGenreStats,
          'exp': newExp,
          'rank': newRank
        });
      });
      
      console.log('ユーザー統計情報を更新しました');
      return true;
    } catch (err) {
      console.error('統計情報の更新中にエラーが発生しました:', err);
      return false;
    }
  }, [currentUser]);
  
  // 経験値からランクを計算する関数
  const calculateRank = (exp: number): string => {
    if (exp < 100) return 'ビギナー';
    if (exp < 300) return 'アマチュア';
    if (exp < 600) return 'エキスパート';
    if (exp < 1000) return 'マスター';
    if (exp < 2000) return 'チャンピオン';
    return 'レジェンド';
  };

  // 特定のルームを監視するフック
  const useRoomListener = (roomId: string) => {
    const [room, setRoom] = useState<QuizRoom | null>(null);
    const [previousStatus, setPreviousStatus] = useState<RoomStatus | null>(null);
    
    useEffect(() => {
      if (!roomId) return;
      
      const roomRef = doc(db, 'quiz_rooms', roomId);
      const unsubscribe = onSnapshot(roomRef, (doc) => {
        if (doc.exists()) {
          const roomData = doc.data() as Omit<QuizRoom, 'roomId'>;
          const roomWithId = { ...roomData, roomId: doc.id } as QuizRoom;
          
          // ルームのステータスが変わったかを確認
          if (previousStatus !== null && previousStatus !== roomData.status) {
            // ルームが完了状態になったら統計情報を更新
            if (roomData.status === 'completed') {
              updateUserStatsOnRoomComplete(doc.id).catch(err => {
                console.error('統計更新エラー:', err);
              });
            }
          }
          
          // 現在のステータスを保存
          setPreviousStatus(roomData.status);
          
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
            console.log(`Room ${doc.id} updated: ${participantCount} participants`);
            
            setWaitingRoom(roomWithId);
          } else {
            // ゲーム開始・終了で待機中状態をクリア
            setWaitingRoom(null);
          }
          
          if (currentUser) {
            setIsLeader(currentUser.uid === roomData.roomLeaderId);
            // 解答権の状態を更新
            setHasAnsweringRight(roomData.currentState.currentAnswerer === currentUser.uid);
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
      });
      
      return () => unsubscribe();
    }, [roomId, currentUser, setQuizRoom, setIsLeader, setHasAnsweringRight, setWaitingRoom, router, previousStatus]);
    
    return room;
  };

  // 8分以上経過した待機ルームを確認・解散する
  const checkAndDisbandOldRooms = useCallback(async () => {
    try {
      // waitingステータスのルームのみを取得
      const roomsQuery = query(
        collection(db, 'quiz_rooms'),
        where('status', '==', 'waiting')
      );
      
      const roomsSnapshot = await getDocs(roomsQuery);
      
      if (roomsSnapshot.empty) {
        console.log('待機中のルームはありません');
        return;
      }
      
      console.log(`${roomsSnapshot.size}個の待機中ルームをチェックします`);
      const currentTime = new Date();
      
      for (const roomDoc of roomsSnapshot.docs) {
        try {
          const roomData = roomDoc.data();
          
          // 開始時間が設定されていない場合はスキップ
          if (!roomData.startedAt) {
            console.warn(`ルーム ${roomDoc.id} の開始時間が設定されていません`);
            continue;
          }
          
          const startTime = roomData.startedAt.toDate();
          const elapsedMs = currentTime.getTime() - startTime.getTime();
          
          // 8分以上経過している場合、自動解散
          if (elapsedMs >= AUTO_DISBAND_TIME_MS) {
            console.log(`ルーム ${roomDoc.id} (${roomData.name}) は${Math.floor(AUTO_DISBAND_TIME_MS / 60000)}分以上経過したため自動解散します`);
            
            try {
              // エラーハンドリングを追加：すでに削除されている可能性があるので、再度存在確認
              const freshRoomRef = doc(db, 'quiz_rooms', roomDoc.id);
              const freshRoomSnap = await getDoc(freshRoomRef);
              
              if (!freshRoomSnap.exists()) {
                console.log(`ルーム ${roomDoc.id} はすでに削除されています。スキップします。`);
                continue;
              }
              
              // リーダーかどうかチェック
              const isLeaderOfRoom = roomData.roomLeaderId === (currentUser?.uid || '');
              
              // ルームを削除（権限エラーが発生する可能性がある）
              try {
                await deleteDoc(freshRoomRef);
                console.log(`ルーム ${roomDoc.id} の自動解散が完了しました`);
              } catch (deleteErr: any) {
                // 権限エラーの場合、代替手段を試行
                if (deleteErr?.code === 'permission-denied') {
                  console.warn(`ルーム ${roomDoc.id} の削除権限がありません。代替手段を試行します。`);
                  
                  // 代替手段1: リーダーの場合は新しい状態でルームを強制的に更新
                  if (isLeaderOfRoom) {
                    try {
                      await updateDoc(freshRoomRef, {
                        status: 'completed',
                        updatedAt: serverTimestamp(),
                        // 他の必要なデータを更新
                        automaticallyClosed: true,
                        closeReason: '8分以上の未活動'
                      });
                      console.log(`ルーム ${roomDoc.id} を完了状態に更新しました`);
                    } catch (updateErr) {
                      console.error(`ルーム ${roomDoc.id} の更新中にエラーが発生しました:`, updateErr);
                    }
                  } else {
                    console.log(`ルーム ${roomDoc.id} はあなたが作成したルームではないため、削除できません。`);
                  }
                } else {
                  // その他のエラー
                  console.error(`ルーム ${roomDoc.id} の削除中に不明なエラーが発生しました:`, deleteErr);
                }
              }
              
              // 自分が参加中で、かつ現在表示されているルームなら、状態を更新
              if (currentWaitingRoomId === roomDoc.id) {
                setCurrentWaitingRoomId(null);
                setWaitingRoom(null);
              }
            } catch (roomErr) {
              console.error(`ルーム ${roomDoc.id} の処理中にエラーが発生しました:`, roomErr);
            }
          }
        } catch (roomErr) {
          console.error(`ルーム ${roomDoc.id} の処理中にエラーが発生しました:`, roomErr);
        }
      }
    } catch (err) {
      console.error('待機ルームのチェック中にエラーが発生しました:', err);
    }
  }, [currentUser, currentWaitingRoomId, setWaitingRoom]);

  return {
    availableRooms,
    currentRoom,
    loading,
    error,
    fetchAvailableRooms,
    createRoom,
    joinRoom,
    leaveRoom,
    findOrCreateRoom,
    useRoomListener,
    createRoomWithUnit,
    findOrCreateRoomWithUnit,
    getUnitIdByName,
    createUnitIfNotExists,
    updateUserStatsOnRoomComplete, // 新しい関数をエクスポート
    checkAndDisbandOldRooms, // 新しい関数をエクスポート
    // 確認関連の状態と関数
    confirmRoomSwitch,
    currentWaitingRoomId,
    confirmJoinNewRoom: async () => {
      if (roomToJoin) {
        setConfirmRoomSwitch(false);
        const success = await joinRoom(roomToJoin, true);
        setRoomToJoin(null);
        setCurrentWaitingRoomId(null);
        return success;
      }
      return false;
    },
    cancelJoinNewRoom: () => {
      setConfirmRoomSwitch(false);
      setRoomToJoin(null);
      setCurrentWaitingRoomId(null);
      setLoading(false);
      return false;
    }
  };
}
