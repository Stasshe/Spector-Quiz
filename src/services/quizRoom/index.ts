'use client';

import { db } from '@/config/firebase';
import { getAuth } from 'firebase/auth';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';

// roomService.ts からのインポート
import {
  cleanupRoomAnswersById,
  fetchAvailableRooms,
  updateUserStatsOnRoomComplete as updateRoomStats
} from './roomService';



// participationService.ts からのインポート
import {
  getRoomById,
  joinRoomService,
  leaveRoomService
} from './participationService';

// creationService.ts からのインポート
import {
  createRoomService,
  createRoomWithUnitService,
  findOrCreateRoomService,
  findOrCreateRoomWithUnitService
} from './creationService';

// QuizRoom型のインポート（引数型チェック用）
import { QuizRoom } from '@/types/room';

// 直接エクスポートは削除し、必要に応じてラッパー関数を提供

// useQuizRoomで使用する関数を明示的にエクスポート
// ルーム作成・管理関連
export const createRoom = async (
  roomName: string,
  genre: string,
  classType: string,
  userId: string,
  username: string,
  iconId: number
): Promise<string> => {
  const room = await createRoomService(
    userId, 
    username, 
    iconId, 
    roomName, 
    genre, 
    '', // unitId (empty for basic room)
    classType, 
    [] // selectedQuizIds (will be populated later)
  );
  return room.roomId;
};

export const createRoomWithUnit = async (
  roomName: string,
  genre: string,
  classType: string,
  userId: string,
  username: string,
  iconId: number,
  unitId: string
): Promise<string> => {
  // 引数の順序をcreationService.tsのcreateRoomWithUnitServiceに合わせる
  const room = await createRoomWithUnitService(
    userId, 
    username, 
    iconId, 
    genre, // genreIdとして
    unitId, 
    classType
  );
  return room.roomId;
};

export const joinRoom = async (
  roomId: string,
  userId: string,
  username: string,
  iconId: number
): Promise<boolean> => {
  try {
    console.log(`[joinRoom] ルーム(${roomId})への参加を開始します: ユーザー ${userId}`);
    await joinRoomService(roomId, userId, username, iconId);
    console.log(`[joinRoom] ルーム(${roomId})への参加が成功しました`);
    return true;
  } catch (err) {
    console.error(`[joinRoom] ルーム(${roomId})への参加中にエラー:`, err);
    
    // Firebaseの権限エラーの場合は特別に処理
    if (err instanceof Error && err.message.includes('permission-denied')) {
      console.log('権限エラーが発生しましたが、処理は続行します');
      return false; // 失敗として扱うが、エラーはスローしない
    }
    
    throw err; // その他のエラーは上位に伝播させる
  }
};

export const leaveRoom = async (
  roomId: string,
  userId: string,
  isLeader: boolean
): Promise<boolean> => {
  try {
    // leaveRoomServiceは userId, roomId, isLeader の順で引数を取るので順序を修正
    await leaveRoomService(userId, roomId, isLeader);
    return true;
  } catch (err) {
    console.error('Error leaving room:', err);
    
    // Firebaseの権限エラーの場合は特別に処理
    if (err instanceof Error && err.message.includes('permission-denied')) {
      console.log('権限エラーが発生しましたが、処理は続行します');
      return true; // エラーがあっても成功として扱う
    }
    
    throw err; // その他のエラーは上位に伝播させる
  }
};

export const findOrCreateRoom = async (
  roomName: string,
  genre: string,
  classType: string,
  userId: string,
  username: string,
  iconId: number
): Promise<string> => {
  const room = await findOrCreateRoomService(
    userId, 
    username, 
    iconId, 
    genre, 
    classType
  );
  return room.roomId;
};

export const findOrCreateRoomWithUnit = async (
  roomName: string,
  genre: string,
  classType: string,
  userId: string,
  username: string,
  iconId: number,
  unitId: string
): Promise<string> => {
  // roomNameは使用されていないがインターフェースの一貫性のために保持
  const room = await findOrCreateRoomWithUnitService(
    userId, 
    username, 
    iconId, 
    genre, 
    unitId, 
    classType
  );
  return room.roomId;
};

// roomService.ts からエクスポート
export {
  fetchAvailableRooms
};

// participationService.ts からエクスポート
export {
  getRoomById
};

// ラッパー関数
export const updateUserStatsOnRoomComplete = async (roomId: string): Promise<boolean> => {
  try {
    // firebaseからcurrentUserIdを取得
    const auth = getAuth();
    const user = auth.currentUser;
    
    if (!user) {
      console.warn('認証されていないユーザーです。統計は更新されません。');
      return false;
    }

    try {
      // ルームデータを取得
      const roomRef = doc(db, 'quiz_rooms', roomId);
      const roomSnap = await getDoc(roomRef);
      
      if (!roomSnap.exists()) {
        console.log('ルームが既に削除されています。統計は既にバッチ処理で更新済みの可能性があります。');
        return true; // エラーではなく成功として扱う（バッチ処理で既に更新済みと想定）
      }
      
      const roomData = roomSnap.data() as QuizRoom;
      
      // 既に統計が更新済みの場合はスキップ
      if (roomData.statsUpdated) {
        console.log('このルームの統計は既に更新済みです');
        return true;
      }
      
      // 既に統計が更新済みの場合はスキップ
      if (roomData.statsUpdated) {
        console.log('このルームの統計は既に更新済みです');
        return true;
      }
      
      // まず自分自身の統計を更新（エラーをキャッチして続行）
      try {
        // 自分がルームの参加者として含まれているか確認
        if (roomData.participants && roomData.participants[user.uid]) {
          await updateRoomStats(user.uid, roomId);
          console.log('自分の統計情報を更新しました');
        }
      } catch (selfErr) {
        console.warn('自分の統計更新に失敗しましたが、処理を続行します:', selfErr);
      }
      
      // 各ユーザーは自身の統計のみ更新する（セキュリティ上の理由）
      // リーダーが他の参加者の統計を更新しようとするとパーミッションエラーが発生するため、
      // 各ユーザーは自分の統計情報のみを自己責任で更新する
      
      if (roomData.roomLeaderId === user.uid && roomData.participants) {
        // 他のユーザーの統計情報は更新しない（SecurityRulesの制限のため）
        // 代わりに、完了フラグを設定して各ユーザーが自分の統計を更新できるようにする
        try {
          // ルームに統計処理完了フラグを設定（各ユーザーが確認できるように）
          const roomRef = doc(db, 'quiz_rooms', roomId);
          await updateDoc(roomRef, {
            statsUpdated: true
          });
          console.log('ルームの統計処理完了フラグを設定しました。各ユーザーは次回ログイン時に自身の統計を更新します。');
        } catch (flagErr) {
          console.warn('統計処理フラグの設定に失敗しました:', flagErr);
        }
      }
      
      // 一部でも成功していれば true を返す
      return true;
    } catch (statsErr) {
      console.error('統計更新中にエラーが発生しました:', statsErr);
      // 部分的に成功している可能性があるのでtrueを返す
      return true;
    }
  } catch (error) {
    console.error('統計の更新に失敗しました:', error);
    return false;
  }
};

export const finishQuiz = async (roomId: string): Promise<boolean> => {
  try {
    // ルーム存在確認
    const roomRef = doc(db, 'quiz_rooms', roomId);
    const roomSnap = await getDoc(roomRef);
    
    if (!roomSnap.exists()) {
      console.error(`[finishQuiz] ルーム ${roomId} が存在しません`);
      return false;
    }
    
    // ルームステータスを完了に更新
    await updateDoc(roomRef, {
      status: 'completed',
      updatedAt: serverTimestamp()
    });
    
    console.log(`[finishQuiz] ルーム ${roomId} のステータスを完了に更新しました`);
    return true;
  } catch (err) {
    console.error('[finishQuiz] ルーム完了処理中にエラー:', err);
    return false;
  }
};

/**
 * ルームのanswersサブコレクションをクリーンアップする
 * ルームを削除する前に呼び出して、サブコレクションが残らないようにする
 */
export const cleanupRoomAnswers = async (roomId: string): Promise<boolean> => {
  try {
    return await cleanupRoomAnswersById(roomId);
  } catch (err) {
    console.error('Error cleaning up room answers:', err);
    return false;
  }
};
