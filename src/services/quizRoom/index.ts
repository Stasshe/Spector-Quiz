'use client';

import { db, usersDb, usersAuth } from '@/config/firebase';
import { SCORING } from '@/config/quizConfig';
import { QuizRoom } from '@/types/room';
import { doc, getDoc, updateDoc, serverTimestamp, writeBatch, increment } from 'firebase/firestore';
import { hasRankUp, calculateUserRankInfo, generateRankUpMessage } from '@/utils/rankCalculator';

// roomService.ts からのインポート
import {
  cleanupRoomAnswersById,
  fetchAvailableRooms,
  subscribeToAvailableRooms
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
  fetchAvailableRooms,subscribeToAvailableRooms
};

// participationService.ts からエクスポート
export {
  getRoomById
};

// ラッパー関数
export const updateUserStatsOnRoomComplete = async (roomId: string): Promise<boolean> => {
  try {
    // firebaseからcurrentUserIdを取得
    const user = usersAuth.currentUser;
    
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
      
      // 最適化された統計更新を使用
      return await updateAllQuizStats(roomId, roomData, user);
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
 * 個別ユーザーの統計情報を更新する関数
 * バッチ処理を使わず、各ユーザーが自分の統計のみを個別更新
 */
export const updateUserStats = async (
  roomId: string,
  roomData: QuizRoom,
  userId: string
): Promise<boolean> => {
  try {
    console.log(`[updateUserStats] ユーザー ${userId} の統計更新を開始`);
    
    // 自分の参加情報があるかチェック
    if (!roomData.participants || !roomData.participants[userId]) {
      console.log(`[updateUserStats] ユーザー ${userId} はこのルームに参加していません`);
      return false;
    }
    
    const userPerformance = roomData.participants[userId];
    const userRef = doc(usersDb, 'users', userId);
    
    // 現在のユーザー情報を取得してランクアップをチェック
    const userDoc = await getDoc(userRef);
    const currentExp = userDoc.exists() ? (userDoc.data().exp || 0) : 0;
    
    // 経験値計算
    let expToAdd = Math.floor((userPerformance.score || 0) / 10); // スコア10ポイントで1経験値
    if (expToAdd < 1 && (userPerformance.score || 0) > 0) expToAdd = 1; // 最低1経験値
    if (userPerformance.missCount === 0 && (userPerformance.score || 0) > 0) expToAdd++; // 完答ボーナス
    
    // 一人プレイの場合は経験値を削減
    const participantCount = Object.keys(roomData.participants).length;
    if (participantCount === 1) {
      expToAdd = Math.round(expToAdd * SCORING.SOLO_MULTIPLIER);
    }
    
    const newExp = currentExp + expToAdd;
    
    // ランクアップしたかチェック
    const didRankUp = hasRankUp(currentExp, newExp);
    const newRankInfo = calculateUserRankInfo(newExp);
    
    // ユーザー統計を更新（個別updateDoc使用）
    const updateData: any = {
      exp: increment(expToAdd),
      'stats.totalAnswered': increment(roomData.totalQuizCount || 1),
      'stats.correctAnswers': increment(userPerformance.score || 0),
      [`stats.genres.${roomData.genre}.totalAnswered`]: increment(roomData.totalQuizCount || 1),
      [`stats.genres.${roomData.genre}.correctAnswers`]: increment(userPerformance.score || 0),
      'stats.lastActivity': serverTimestamp()
    };
    
    // ランクアップした場合は新しいランクも更新
    if (didRankUp) {
      updateData.rank = newRankInfo.rank.name;
      console.log(`🎉 ユーザー ${userId} がランクアップ！ ${newRankInfo.rank.name} にランクアップしました！`);
      
      // ランクアップ通知をローカルストレージに保存（現在のユーザーのみ）
      if (typeof window !== 'undefined' && usersAuth.currentUser && usersAuth.currentUser.uid === userId) {
        const rankUpMessage = generateRankUpMessage(newRankInfo.rank);
        localStorage.setItem('rankUpNotification', JSON.stringify({
          message: rankUpMessage,
          newRank: newRankInfo.rank,
          timestamp: Date.now()
        }));
      }
    }
    
    await updateDoc(userRef, updateData);
    console.log(`[updateUserStats] ユーザー ${userId} の統計更新完了 (経験値: +${expToAdd})`);
    
    return true;
  } catch (error) {
    console.error(`[updateUserStats] ユーザー ${userId} の統計更新中にエラー:`, error);
    return false;
  }
};

/**
 * クイズ完了時に統計を更新する関数（個別処理版）
 * 各ユーザーが自分の統計のみを更新し、リーダーがルーム完了フラグを設定
 */
export const updateAllQuizStats = async (
  roomId: string,
  roomData: QuizRoom,
  user: { uid: string }
): Promise<boolean> => {
  try {
    console.log('[updateAllQuizStats] 個別統計更新を開始');
    
    // 自分の統計を更新
    const userStatsSuccess = await updateUserStats(roomId, roomData, user.uid);
    
    // ルーム完了フラグの設定は削除（ルーム自体が削除されるため不要）
    // useLeaderのfinishQuizGameで5秒後にルーム全体が削除される
    
    return userStatsSuccess;
  } catch (error) {
    console.error('[updateAllQuizStats] 統計更新中にエラー:', error);
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
