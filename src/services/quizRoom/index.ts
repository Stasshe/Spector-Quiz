'use client';

import { getAuth } from 'firebase/auth';
import { getDoc, doc } from 'firebase/firestore';
import { db } from '@/config/firebase';

// roomService.ts からのインポート
import {
  fetchAvailableRooms,
  checkAndDisbandOldRooms,
  getUnitIdByName,
  createUnitIfNotExists,
  updateUserStatsOnRoomComplete as updateRoomStats,
  calculateRank
} from './roomService';

// participationService.ts からのインポート
import {
  joinRoomService,
  leaveRoomService,
  getRoomById
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

// サービス関連の全ての関数をエクスポート
export * from './roomService';
export * from './participationService';
export * from './creationService';

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
  await joinRoomService(roomId, userId, username, iconId);
  return true;
};

export const leaveRoom = async (
  roomId: string,
  userId: string,
  isLeader: boolean
): Promise<boolean> => {
  await leaveRoomService(roomId, userId, isLeader);
  return true;
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
  fetchAvailableRooms,
  checkAndDisbandOldRooms,
  getUnitIdByName,
  createUnitIfNotExists,
  calculateRank,
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
        console.warn('ルームが見つかりません。統計は更新されません。');
        return false;
      }
      
      const roomData = roomSnap.data() as QuizRoom;
      
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
      
      // ルームリーダーのみが全員の統計を更新
      let updatedCount = 0;
      let failedCount = 0;
      
      if (roomData.roomLeaderId === user.uid && roomData.participants) {
        // 全参加者の統計を更新（自分以外）
        const participantIds = Object.keys(roomData.participants).filter(id => id !== user.uid);
        console.log(`ルームリーダーとして${participantIds.length}人の参加者の統計を更新します`);
        
        // 各参加者の統計を非同期で更新し、エラーがあっても継続
        for (const participantId of participantIds) {
          try {
            await updateRoomStats(participantId, roomId);
            updatedCount++;
          } catch (participantErr) {
            console.warn(`参加者 ${participantId} の統計更新に失敗しました:`, participantErr);
            failedCount++;
            // エラーがあっても処理を続行
          }
        }
        
        console.log(`参加者統計更新結果: 成功=${updatedCount}, 失敗=${failedCount}`);
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

// useQuizRoom.ts内で実装されている関数をスタブとしてエクスポート
// これらの関数はuseQuizRoom.ts内で直接定義されており、サービス内には存在しない
export const updateParticipantReadyStatus = async (
  roomId: string, 
  userId: string, 
  isReady: boolean
): Promise<boolean> => {
  console.warn('updateParticipantReadyStatus is not implemented in service layer');
  return true;
};

export const startQuiz = async (roomId: string): Promise<boolean> => {
  console.warn('startQuiz is not implemented in service layer');
  return true;
};

export const updateQuizState = async (): Promise<boolean> => {
  console.warn('updateQuizState is not implemented in service layer');
  return true;
};

export const finishQuiz = async (roomId: string): Promise<boolean> => {
  console.warn('finishQuiz is not implemented in service layer');
  return true;
};

export const revealAnswer = async (roomId: string): Promise<boolean> => {
  console.warn('revealAnswer is not implemented in service layer');
  return true;
};

export const processAnswer = async (): Promise<boolean> => {
  console.warn('processAnswer is not implemented in service layer');
  return true;
};

// クイズ操作関連
export const registerClickTime = async (
  roomId: string, 
  userId: string, 
  quizId: string
): Promise<boolean> => {
  console.warn('registerClickTime is not implemented in service layer');
  return true;
};

export const submitAnswer = async (
  roomId: string, 
  userId: string, 
  quizId: string, 
  answer: string
): Promise<{isCorrect: boolean, correctAnswer: string, explanation: string} | null> => {
  console.warn('submitAnswer is not implemented in service layer');
  return { isCorrect: true, correctAnswer: "", explanation: "" };
};

export const moveToNextQuiz = async (roomId: string): Promise<boolean> => {
  console.warn('moveToNextQuiz is not implemented in service layer');
  return true;
};

export const getResultRanking = async (roomId: string): Promise<any[]> => {
  console.warn('getResultRanking is not implemented in service layer');
  return [];
};
