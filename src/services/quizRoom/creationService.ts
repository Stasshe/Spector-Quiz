'use client';

import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  addDoc, 
  updateDoc, 
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '@/config/firebase';
import { QuizRoom } from '@/types/room';
//import { ParticipantInfo } from '@/types/user';

// 参加機能をインポート
import { joinRoomService } from './participationService';

// ------ ルーム作成関連のサービス関数 ------

/**
 * 基本的なルームを作成する
 */
export async function createRoomService(
  userId: string,
  username: string,
  iconId: number,
  name: string,
  genre: string,
  unitId: string,
  classType: string,
  selectedQuizIds: string[]
): Promise<QuizRoom> {
  try {
    if (selectedQuizIds.length === 0) {
      throw new Error('選択されたクイズがありません');
    }
    
    // ユーザーが既に別のルームに参加しているか確認
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    // 注意: ここでは前のルームからの自動退室を行うが、
    // 実際のUIフローでは useQuizRoom の中で roomSwitchConfirmModal を
    // 表示するように処理が追加されている
    if (userDoc.exists() && userDoc.data().currentRoomId) {
      // ユーザーが既に他のルームに参加している場合、そのルームから強制的に退出
      try {
        await updateDoc(userRef, { currentRoomId: null });
      } catch (err) {
        console.error('Error clearing previous room:', err);
        // 続行する（クリティカルではない）
      }
    }
    
    const newRoom: Omit<QuizRoom, 'roomId'> = {
      name,
      genre,
      unitId,
      classType,
      roomLeaderId: userId,
      participants: {
        [userId]: {
          username,
          iconId,
          score: 0,
          missCount: 0,
          wrongQuizIds: [],
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
      // ユーザーに現在のルームIDを設定
      await updateDoc(userRef, { currentRoomId: roomId });
    } catch (updateErr) {
      console.error('Error updating user room ID:', updateErr);
      // エラーがあってもルーム作成は成功させる
    }
    
    // 作成したルームを返す
    const createdRoom = {
      ...newRoom,
      roomId
    } as QuizRoom;
    
    return createdRoom;
  } catch (err: any) {
    console.error('Error creating room:', err);
    // Firebaseの権限エラーを特別に処理
    if (err.code === 'permission-denied') {
      throw new Error('ルームを作成する権限がありません。管理者に問い合わせてください。');
    } else {
      throw new Error(err.message || 'ルーム作成中にエラーが発生しました');
    }
  }
}

/**
 * 特定の単元に基づいてルームを作成する
 */
export async function createRoomWithUnitService(
  userId: string,
  username: string,
  iconId: number,
  genreId: string,
  unitId: string,
  classType: string
): Promise<QuizRoom> {
  try {
    // ユーザーが既に別のルームに参加しているか確認
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    if (userDoc.exists() && userDoc.data().currentRoomId) {
      // ユーザーが既に他のルームに参加している場合、そのルームから強制的に退出
      try {
        await updateDoc(userRef, { currentRoomId: null });
      } catch (err) {
        console.error('Error clearing previous room:', err);
        // 続行する（クリティカルではない）
      }
    }
    
    // クラスタイプに応じてコレクション名を決定
    const collectionName = classType === '公式' ? 'official_quiz_units' : 'quiz_units';
    console.log(`[createRoomWithUnitService] 使用するコレクション: ${collectionName}, ジャンル: ${genreId}, 単元ID: ${unitId}`);
    
    // 単元データを取得
    const unitRef = doc(db, 'genres', genreId, collectionName, unitId);
    const unitSnap = await getDoc(unitRef);
    
    if (!unitSnap.exists()) {
      console.error(`[createRoomWithUnitService] 単元が見つかりません: ジャンル=${genreId}, 単元ID=${unitId}, コレクション=${collectionName}`);
      throw new Error(`指定された単元「${unitId}」が見つかりません`);
    }
    
    const unitData = unitSnap.data();
    console.log(`[createRoomWithUnitService] 単元データ取得成功: ${unitData.title}`);
    
    
    // 単元内のクイズを取得
    const quizzesQuery = collection(db, 'genres', genreId, collectionName, unitId, 'quizzes');
    const quizzesSnapshot = await getDocs(quizzesQuery);
    
    const quizIds: string[] = [];
    quizzesSnapshot.forEach(doc => {
      quizIds.push(doc.id);
    });
    
    if (quizIds.length === 0) {
      console.error(`[createRoomWithUnitService] クイズが見つかりません: ジャンル=${genreId}, 単元ID=${unitId}, クラスタイプ=${classType}`);
      throw new Error(`この単元にはクイズがありません (${unitData.title})`);
    }
    
    console.log(`[createRoomWithUnitService] 取得したクイズ数: ${quizIds.length}`);
    
    // ジャンル名（表示用）
    const genreRef = doc(db, 'genres', genreId);
    const genreSnap = await getDoc(genreRef);
    const genreName = genreSnap.exists() ? genreSnap.data().name : genreId;
    
    // クラスタイプに基づいてルーム名を設定
    const name = `${genreName} - ${unitData.title} (${classType})`;
    
    const newRoom: Omit<QuizRoom, 'roomId'> = {
      name,
      genre: genreId,
      unitId,
      classType,
      roomLeaderId: userId,
      participants: {
        [userId]: {
          username,
          iconId,
          score: 0,
          missCount: 0,
          wrongQuizIds: [],
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
      // ユーザーに現在のルームIDを設定
      await updateDoc(userRef, { currentRoomId: roomId });
    } catch (updateErr) {
      console.error('Error updating user room ID:', updateErr);
      // エラーがあってもルーム作成は成功させる
    }
    
    // 作成したルームを返す
    const createdRoom = {
      ...newRoom,
      roomId
    } as QuizRoom;
    
    return createdRoom;
  } catch (err: any) {
    console.error('Error creating room with unit:', err);
    // Firebaseの権限エラーを特別に処理
    if (err.code === 'permission-denied') {
      throw new Error('ルームを作成する権限がありません。管理者に問い合わせてください。');
    } else {
      throw new Error(err.message || 'ルーム作成中にエラーが発生しました');
    }
  }
}

/**
 * ジャンルに基づいてルームを探すか作成する
 */
export async function findOrCreateRoomService(
  userId: string,
  username: string,
  iconId: number,
  genre: string,
  classType: string
): Promise<QuizRoom> {
  try {
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
      const firstRoom = roomsSnapshot.docs[0];
      const roomData = firstRoom.data();
      
      // 参加者がいっぱいでないか確認（念のため）
      if (roomData.participants && Object.keys(roomData.participants).length >= 8) {
        throw new Error('ルームは満員です。他のルームをお試しください。');
      }
      
      // ルームに参加
      const joinedRoom = await joinRoomService(
        firstRoom.id,
        userId,
        username,
        iconId
      );
      
      return joinedRoom;
    }
    
    // 該当するルームがない場合、新しいルームを作成
    // 単元IDがない場合は空文字を渡す（APIの仕様に合わせる）
    const unitId = '';
    // 自動生成されたルーム名を作成
    const roomName = `${genre}のクイズルーム`;
    
    // デフォルトのクイズIDリスト（空）
    const emptyQuizIds: string[] = [];
    
    // 新しいルームを作成
    return await createRoomService(
      userId,
      username,
      iconId,
      roomName,
      genre,
      unitId,
      classType,
      emptyQuizIds
    );
  } catch (err: any) {
    console.error('Error finding or creating room:', err);
    throw new Error(err.message || 'ルームの探索/作成中にエラーが発生しました');
  }
}

/**
 * 単元に基づいてルームを探すか作成する
 */
export async function findOrCreateRoomWithUnitService(
  userId: string,
  username: string,
  iconId: number,
  genre: string,
  unitId: string,
  classType: string
): Promise<QuizRoom> {
  try {
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
      const firstRoom = roomsSnapshot.docs[0];
      const roomData = firstRoom.data();
      
      // 参加者がいっぱいでないか確認（念のため）
      if (roomData.participants && Object.keys(roomData.participants).length >= 8) {
        throw new Error('ルームは満員です。他のルームをお試しください。');
      }
      
      // ルームに参加
      const joinedRoom = await joinRoomService(
        firstRoom.id,
        userId,
        username,
        iconId
      );
      
      return joinedRoom;
    }
    
    // 該当するルームがない場合、新しいルームを作成
    return await createRoomWithUnitService(
      userId,
      username,
      iconId,
      genre,
      unitId,
      classType
    );
  } catch (err: any) {
    console.error('Error finding or creating room with unit:', err);
    throw new Error(err.message || 'ルームの探索/作成中にエラーが発生しました');
  }
}
