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
  serverTimestamp 
} from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';
import { QuizRoom, RoomListing, RoomStatus } from '@/types/room';
import { useQuiz } from '@/context/QuizContext';
import { genreClasses } from '@/constants/genres';

export function useQuizRoom() {
  const { currentUser, userProfile } = useAuth();
  const { setQuizRoom, setIsLeader, setCurrentQuiz, setHasAnsweringRight } = useQuiz();
  const [availableRooms, setAvailableRooms] = useState<RoomListing[]>([]);
  const [currentRoom, setCurrentRoom] = useState<QuizRoom | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // 利用可能なルーム一覧を取得
  const fetchAvailableRooms = useCallback(async (genre: string, subgenre: string, classType: string) => {
    try {
      setLoading(true);
      let roomsQuery;
      
      if (subgenre) {
        roomsQuery = query(
          collection(db, 'quiz_rooms'),
          where('status', '==', 'waiting'),
          where('genre', '==', genre),
          where('subgenre', '==', subgenre),
          orderBy('createdAt', 'desc')
        );
      } else {
        roomsQuery = query(
          collection(db, 'quiz_rooms'),
          where('status', '==', 'waiting'),
          where('genre', '==', genre),
          orderBy('createdAt', 'desc')
        );
      }
      
      const roomsSnapshot = await getDocs(roomsQuery);
      const rooms: RoomListing[] = [];
      
      roomsSnapshot.forEach(doc => {
        const roomData = doc.data() as QuizRoom;
        // クラスタイプでフィルタリング
        const isUserCreated = roomData.classType === 'ユーザー作成';
        if ((classType === 'ユーザー作成' && isUserCreated) || 
            (classType === '公式' && !isUserCreated)) {
          rooms.push({
            roomId: doc.id,
            name: roomData.name,
            genre: roomData.genre,
            subgenre: roomData.subgenre,
            unitId: roomData.unitId || '',  // unitIdが存在しない場合は空文字を設定
            participantCount: Object.keys(roomData.participants).length,
            status: roomData.status
          });
        }
      });
      
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
  const createRoom = useCallback(async (genre: string, subgenre: string, classType: string) => {
    if (!currentUser || !userProfile) {
      setError('ログインが必要です');
      return null;
    }
    
    try {
      setLoading(true);
      
      // クラスタイプに基づいてルーム名を設定
      const name = `${genre} - ${subgenre} (${classType})`;
      
      const quizQuery = query(
        collection(db, 'quizzes'),
        where('genre', '==', genre),
        where('subgenre', '==', subgenre),
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
        subgenre,
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
      
      const roomRef = await addDoc(collection(db, 'quiz_rooms'), newRoom);
      const roomId = roomRef.id;
      
      // ユーザーの現在のルーム情報を更新
      await updateDoc(doc(db, 'users', currentUser.uid), {
        currentRoomId: roomId
      });
      
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
      setError(err.message || 'ルームの作成中にエラーが発生しました');
      return null;
    } finally {
      setLoading(false);
    }
  }, [currentUser, userProfile, router, setQuizRoom, setIsLeader]);

  // 単元を使ってルームを作成
  const createRoomWithUnit = useCallback(async (genreId: string, subgenreId: string, unitId: string, classType: string) => {
    if (!currentUser || !userProfile) {
      setError('ログインが必要です');
      return null;
    }
    
    try {
      setLoading(true);
      
      // 単元データを取得
      const unitRef = doc(db, 'genres', genreId, 'subgenres', subgenreId, 'quiz_units', unitId);
      const unitSnap = await getDoc(unitRef);
      
      if (!unitSnap.exists()) {
        throw new Error('指定された単元が見つかりません');
      }
      
      const unitData = unitSnap.data();
      
      // 単元内のクイズを取得
      const quizzesQuery = collection(db, 'genres', genreId, 'subgenres', subgenreId, 'quiz_units', unitId, 'quizzes');
      const quizzesSnapshot = await getDocs(quizzesQuery);
      
      const quizIds: string[] = [];
      quizzesSnapshot.forEach(doc => {
        quizIds.push(doc.id);
      });
      
      if (quizIds.length === 0) {
        throw new Error('選択した単元にクイズがありません');
      }
      
      // 単元のサブジャンル名（表示用）
      const subgenreRef = doc(db, 'genres', genreId, 'subgenres', subgenreId);
      const subgenreSnap = await getDoc(subgenreRef);
      const subgenreName = subgenreSnap.exists() ? subgenreSnap.data().name : subgenreId;
      
      // ジャンル名（表示用）
      const genreRef = doc(db, 'genres', genreId);
      const genreSnap = await getDoc(genreRef);
      const genreName = genreSnap.exists() ? genreSnap.data().name : genreId;
      
      // クラスタイプに基づいてルーム名を設定
      const name = `${genreName} - ${unitData.title} (${classType})`;
      
      const newRoom: Omit<QuizRoom, 'roomId'> = {
        name,
        genre: genreId,
        subgenre: subgenreId,
        unitId,  // 単元IDを保存
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
      
      const roomRef = await addDoc(collection(db, 'quiz_rooms'), newRoom);
      const roomId = roomRef.id;
      
      // ユーザーの現在のルーム情報を更新
      await updateDoc(doc(db, 'users', currentUser.uid), {
        currentRoomId: roomId
      });
      
      // 単元の使用回数を増やす
      await updateDoc(unitRef, {
        useCount: (unitData.useCount || 0) + 1
      });
      
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
      console.error('Error creating room with unit:', err);
      setError(err.message || 'ルームの作成中にエラーが発生しました');
      return null;
    } finally {
      setLoading(false);
    }
  }, [currentUser, userProfile, router, setQuizRoom, setIsLeader]);

  // ルームに参加
  const joinRoom = useCallback(async (roomId: string) => {
    if (!currentUser || !userProfile) {
      setError('ログインが必要です');
      return false;
    }
    
    try {
      setLoading(true);
      
      const roomRef = doc(db, 'quiz_rooms', roomId);
      const roomSnap = await getDoc(roomRef);
      
      if (!roomSnap.exists()) {
        throw new Error('ルームが見つかりません');
      }
      
      const roomData = roomSnap.data() as Omit<QuizRoom, 'roomId'>;
      
      if (roomData.status !== 'waiting') {
        throw new Error('このルームは既に開始されているか終了しています');
      }
      
      // ルームの参加者に追加
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
      
      // ユーザーの現在のルーム情報を更新
      await updateDoc(doc(db, 'users', currentUser.uid), {
        currentRoomId: roomId
      });
      
      const joinedRoom = {
        ...roomData,
        roomId
      } as QuizRoom;
      
      setCurrentRoom(joinedRoom);
      setQuizRoom(joinedRoom);
      setIsLeader(currentUser.uid === roomData.roomLeaderId);
      
      router.push(`/quiz/room?id=${roomId}`);
      
      return true;
    } catch (err: any) {
      console.error('Error joining room:', err);
      setError(err.message || 'ルームへの参加中にエラーが発生しました');
      return false;
    } finally {
      setLoading(false);
    }
  }, [currentUser, userProfile, router, setQuizRoom, setIsLeader]);

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

  // ジャンルとサブジャンルに基づいてルームを探すか作成する
  const findOrCreateRoom = useCallback(async (genre: string, subgenre: string, classType: string) => {
    if (!currentUser || !userProfile) {
      setError('ログインが必要です');
      return false;
    }
    
    try {
      setLoading(true);
      
      // まず、該当するジャンルとサブジャンルのルームを探す
      const roomsQuery = query(
        collection(db, 'quiz_rooms'),
        where('status', '==', 'waiting'),
        where('genre', '==', genre),
        where('subgenre', '==', subgenre),
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
          return await createRoom(genre, subgenre, classType);
        }
        
        // 既存のルームに参加
        return await joinRoom(roomId);
      }
      
      // 該当するルームがない場合、新しいルームを作成
      return await createRoom(genre, subgenre, classType);
    } catch (err) {
      console.error('Error finding or creating room:', err);
      setError('ルームの探索/作成中にエラーが発生しました');
      return false;
    } finally {
      setLoading(false);
    }
  }, [currentUser, userProfile, createRoom, joinRoom]);

  // 特定のルームを監視するフック
  const useRoomListener = (roomId: string) => {
    const [room, setRoom] = useState<QuizRoom | null>(null);
    
    useEffect(() => {
      if (!roomId) return;
      
      const roomRef = doc(db, 'quiz_rooms', roomId);
      const unsubscribe = onSnapshot(roomRef, (doc) => {
        if (doc.exists()) {
          const roomData = doc.data() as Omit<QuizRoom, 'roomId'>;
          setRoom({ ...roomData, roomId: doc.id } as QuizRoom);
          setQuizRoom({ ...roomData, roomId: doc.id } as QuizRoom);
          
          if (currentUser) {
            setIsLeader(currentUser.uid === roomData.roomLeaderId);
            // 解答権の状態を更新
            setHasAnsweringRight(roomData.currentState.currentAnswerer === currentUser.uid);
          }
        } else {
          // ルームが削除された場合はリダイレクト
          setRoom(null);
          setQuizRoom(null);
          router.push('/quiz');
        }
      }, (error) => {
        console.error('Room listener error:', error);
      });
      
      return () => unsubscribe();
    }, [roomId, currentUser, setQuizRoom, setIsLeader, setHasAnsweringRight, router]);
    
    return room;
  };

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
    createRoomWithUnit  // 新しい関数をエクスポート
  };
}
