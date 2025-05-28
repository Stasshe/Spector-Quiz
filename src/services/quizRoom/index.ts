'use client';

import { db, usersDb } from '@/config/firebase';
import { SCORING } from '@/config/quizConfig';
import { QuizRoom } from '@/types/room';
import { getAuth } from 'firebase/auth';
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
 * クイズ完了時に全ての統計を一括更新する関数
 * 書き込み回数を最小限に抑えるための最適化済み関数
 * 異なるFirebaseプロジェクト間では個別のバッチを使用
 */
export const updateAllQuizStats = async (
  roomId: string,
  roomData: QuizRoom,
  user: { uid: string }
): Promise<boolean> => {
  try {
    console.log('[updateAllQuizStats] クイズ統計の一括更新を開始');
    
    // 各プロジェクト用の個別バッチを作成
    const mainBatch = writeBatch(db); // メインプロジェクト用（quiz_rooms, genres）
    const usersBatch = writeBatch(usersDb); // usersプロジェクト用（users）
    let mainBatchCount = 0;
    let usersBatchCount = 0;
    const MAX_BATCH_SIZE = 500; // Firestoreの制限
    
    // 自分の統計のみ更新（セキュリティルールの制限により）
    if (roomData.participants && roomData.participants[user.uid]) {
      const userPerformance = roomData.participants[user.uid];
      const userRef = doc(usersDb, 'users', user.uid);
      
      // 現在のユーザー情報を取得してランクアップをチェック
      const userDoc = await getDoc(userRef);
      const currentExp = userDoc.exists() ? (userDoc.data().exp || 0) : 0;
      
      // 経験値計算
      let expToAdd = Math.floor((userPerformance.score || 0) / 100);
      if (expToAdd < 1 && (userPerformance.score || 0) > 0) expToAdd = 1;
      if (userPerformance.missCount === 0 && (userPerformance.score || 0) > 0) expToAdd++;
      
      // 一人プレイの場合は経験値を削減
      const participantCount = Object.keys(roomData.participants).length;
      if (participantCount === 1) {
        expToAdd = Math.round(expToAdd * SCORING.SOLO_MULTIPLIER);
      }
      
      const newExp = currentExp + expToAdd;
      
      // ランクアップしたかチェック
      const didRankUp = hasRankUp(currentExp, newExp);
      const newRankInfo = calculateUserRankInfo(newExp);
      
      // ユーザー統計を更新（usersプロジェクト）
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
        console.log(`🎉 ランクアップ！ ${newRankInfo.rank.name} にランクアップしました！`);
        
        // ランクアップ通知をローカルストレージに保存（UI表示用）
        if (typeof window !== 'undefined') {
          const rankUpMessage = generateRankUpMessage(newRankInfo.rank);
          localStorage.setItem('rankUpNotification', JSON.stringify({
            message: rankUpMessage,
            newRank: newRankInfo.rank,
            timestamp: Date.now()
          }));
        }
      }
      
      usersBatch.update(userRef, updateData);
      usersBatchCount++;
      
      // ジャンル統計を更新（メインプロジェクト）
      if (roomData.genre) {
        const genreRef = doc(db, 'genres', roomData.genre);
        mainBatch.update(genreRef, {
          'stats.useCount': increment(1),
          'stats.lastUpdated': serverTimestamp()
        });
        mainBatchCount++;
        
        // 単元統計も更新（あれば）
        if (roomData.unitId) {
          mainBatch.update(genreRef, {
            [`stats.units.${roomData.unitId}.useCount`]: increment(1)
          });
        }
      }
    }
    
    // ルームに統計更新完了フラグを設定（メインプロジェクト）
    if (user.uid === roomData.roomLeaderId && !roomData.statsUpdated) {
      const roomRef = doc(db, 'quiz_rooms', roomId);
      mainBatch.update(roomRef, {
        statsUpdated: true,
        updatedAt: serverTimestamp()
      });
      mainBatchCount++;
    }
    
    // バッチサイズの制限チェック
    if (mainBatchCount > MAX_BATCH_SIZE) {
      console.warn(`[updateAllQuizStats] メインバッチサイズが制限を超えています: ${mainBatchCount}`);
    }
    if (usersBatchCount > MAX_BATCH_SIZE) {
      console.warn(`[updateAllQuizStats] usersバッチサイズが制限を超えています: ${usersBatchCount}`);
    }
    
    // 各バッチを個別にコミット
    const commitPromises = [];
    
    if (mainBatchCount > 0) {
      console.log(`[updateAllQuizStats] メインプロジェクトのバッチをコミット中 (${mainBatchCount}件)`);
      commitPromises.push(mainBatch.commit());
    }
    
    if (usersBatchCount > 0) {
      console.log(`[updateAllQuizStats] usersプロジェクトのバッチをコミット中 (${usersBatchCount}件)`);
      commitPromises.push(usersBatch.commit());
    }
    
    // 全てのバッチを並行実行
    await Promise.all(commitPromises);
    
    console.log(`[updateAllQuizStats] 統計更新完了 (メイン: ${mainBatchCount}件, users: ${usersBatchCount}件)`);
    
    return true;
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
