'use client';

import { db, usersDb } from '@/config/firebase';
import { QuizRoom } from '@/types/room';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where
} from 'firebase/firestore';

import { QUIZ_UNIT } from '@/config/quizConfig';
import { writeMonitor } from '@/utils/firestoreWriteMonitor';


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
    
    // クイズIDsをシャッフル（10問以上の場合は10問選択、10問未満は全て使用）
    let finalQuizIds: string[] = [];
    if (selectedQuizIds.length >= QUIZ_UNIT.MAX_QUIZES_PER_ROOM) {
      // Fisher-Yatesアルゴリズムでシャッフル
      const shuffled = [...selectedQuizIds];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      // 最初の10問を選択
      finalQuizIds = shuffled.slice(0, QUIZ_UNIT.MAX_QUIZES_PER_ROOM);
      console.log(`[createRoomService] 10問以上あるため、ランダムに10問選択しました`);
    } else {
      // 10問未満の場合は全てのクイズをシャッフル
      finalQuizIds = [...selectedQuizIds];
      for (let i = finalQuizIds.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [finalQuizIds[i], finalQuizIds[j]] = [finalQuizIds[j], finalQuizIds[i]];
      }
      console.log(`[createRoomService] ${selectedQuizIds.length}問全てを使用し、順番をシャッフルしました`);
    }
    
    // ユーザーが既に別のルームに参加しているか確認
    const userRef = doc(usersDb, 'users', userId);
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
      quizType: classType === '公式' ? 'official' : 'user_created', // クイズタイプを明示的に設定
      roomLeaderId: userId,
      participants: {
        [userId]: {
          username,
          iconId,
          score: 0,
          missCount: 0,
          wrongQuizIds: [],
          isReady: false,
        }
      },
      currentQuizIndex: 0,
      quizIds: finalQuizIds,
      totalQuizCount: finalQuizIds.length,
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
    
    // まずルームを作成（書き込み監視）
    writeMonitor.logOperation(
      'addDoc',
      'quiz_rooms',
      `ルーム作成 - ${name} (${classType})`
    );
    const roomRef = await addDoc(collection(db, 'quiz_rooms'), newRoom);
    const roomId = roomRef.id;
    console.log(`新しいルーム(${roomId})を作成しました`);
    
    try {
      // ユーザーに現在のルームIDを設定（書き込み監視）
      writeMonitor.logOperation(
        'updateDoc',
        `users/${userId}`,
        'ルーム作成時のユーザー情報更新'
      );
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
    const userRef = doc(usersDb, 'users', userId);
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
    
    const allQuizIds: string[] = [];
    quizzesSnapshot.forEach(doc => {
      allQuizIds.push(doc.id);
    });
    
    if (allQuizIds.length === 0) {
      console.error(`[createRoomWithUnitService] クイズが見つかりません: ジャンル=${genreId}, 単元ID=${unitId}, クラスタイプ=${classType}`);
      throw new Error(`この単元にはクイズがありません (${unitData.title})`);
    }
    
    console.log(`[createRoomWithUnitService] 取得したクイズ数: ${allQuizIds.length}`);
    
    // クイズが10問以上ある場合はランダムに10問選択、10問未満の場合は全て使用
    let quizIds: string[] = [];
    if (allQuizIds.length >= QUIZ_UNIT.MAX_QUIZES_PER_ROOM) {
      // Fisher-Yatesアルゴリズムでシャッフル
      const shuffled = [...allQuizIds];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      // 最初の10問を選択
      quizIds = shuffled.slice(0, QUIZ_UNIT.MAX_QUIZES_PER_ROOM);
      console.log(`[createRoomWithUnitService] 10問以上あるため、ランダムに10問選択しました`);
    } else {
      // 10問未満の場合は全てのクイズをシャッフル
      quizIds = [...allQuizIds];
      for (let i = quizIds.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [quizIds[i], quizIds[j]] = [quizIds[j], quizIds[i]];
      }
      console.log(`[createRoomWithUnitService] ${allQuizIds.length}問全てを使用し、順番をシャッフルしました`);
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
      unitId,
      classType,
      quizType: classType === '公式' ? 'official' : 'user_created', // クイズタイプを明示的に設定
      roomLeaderId: userId,
      participants: {
        [userId]: {
          username,
          iconId,
          score: 0,
          missCount: 0,
          wrongQuizIds: [],
          isReady: false,
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
    
    // まずルームを作成（書き込み監視）
    writeMonitor.logOperation(
      'addDoc',
      'quiz_rooms',
      `単元ルーム作成 - ${genreId}/${unitId} (${classType})`
    );
    const roomRef = await addDoc(collection(db, 'quiz_rooms'), newRoom);
    const roomId = roomRef.id;
    console.log(`新しいルーム(${roomId})を作成しました`);
    
    try {
      // ユーザーに現在のルームIDを設定（公式クイズ対応改善 + 書き込み監視）
      console.log(`[createRoomWithUnitService] ユーザー(${userId})にルームID(${roomId})を設定中... classType=${classType}`);
      writeMonitor.logOperation(
        'updateDoc',
        `users/${userId}`,
        `単元ルーム作成時のユーザー情報更新 (${classType})`
      );
      await updateDoc(userRef, { currentRoomId: roomId });
      console.log(`[createRoomWithUnitService] ユーザーのcurrentRoomID設定完了: ${roomId}`);
    } catch (updateErr) {
      console.error('[createRoomWithUnitService] ユーザーのcurrentRoomID設定エラー:', updateErr);
      
      // 公式クイズの場合はエラーを重要視
      if (classType === '公式') {
        console.error('[createRoomWithUnitService] 公式クイズでのユーザードキュメント更新に失敗。再試行します');
        try {
          // 公式クイズの場合は再試行
          await updateDoc(userRef, { currentRoomId: roomId });
          console.log('[createRoomWithUnitService] 公式クイズ用ユーザードキュメント更新再試行成功');
        } catch (retryErr) {
          console.error('[createRoomWithUnitService] 公式クイズ用ユーザードキュメント更新再試行も失敗:', retryErr);
          // エラーがあってもルーム作成は成功させる
        }
      } else {
        // ユーザー作成クイズの場合はエラーがあってもルーム作成は成功させる
        console.warn('[createRoomWithUnitService] ユーザー作成クイズでのユーザードキュメント更新エラー（続行）');
      }
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
