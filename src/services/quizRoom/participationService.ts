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
  deleteDoc, 
  deleteField,
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '@/config/firebase';
import { QuizRoom } from '@/types/room';
import { ParticipantInfo } from '@/types/user';

// ------ ルーム参加・退出関連のサービス関数 ------

/**
 * ユーザーをルームに参加させる
 */
export async function joinRoomService(
  roomId: string, 
  userId: string, 
  username: string, 
  iconId: number, 
  force: boolean = false
): Promise<QuizRoom> {
  try {
    // ユーザーが既に別のルームに参加しているか確認
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    // まず、ユーザーのルーム情報をクリア（権限エラーを防止するため）
    try {
      await updateDoc(userRef, { currentRoomId: null });
    } catch (userErr) {
      console.error('Error clearing user room ID:', userErr);
      // エラーが発生してもプロセスを続行
    }
    
    // 参加先のルームの情報を確認
    const roomRef = doc(db, 'quiz_rooms', roomId);
    
    // トライキャッチブロックを使って、各操作を個別に保護
    try {
      const roomSnap = await getDoc(roomRef);
      if (!roomSnap.exists()) {
        throw new Error('ルームが存在しません');
      }
      
      const roomData = roomSnap.data() as QuizRoom;
      
      // in_progressのルームには参加できない
      if (roomData.status === 'in_progress' && !force) {
        throw new Error('進行中のルームには参加できません');
      }
      
      // 参加者情報を作成
      const participantInfo: ParticipantInfo = {
        username,
        iconId,
        score: 0,
        missCount: 0,
        wrongQuizIds: [],
        isReady: false,
        isOnline: true
      };
      
      // ルームに参加者を追加
      await updateDoc(roomRef, {
        [`participants.${userId}`]: participantInfo,
        updatedAt: serverTimestamp()
      });
      
      // ユーザーに現在のルームIDを設定
      await updateDoc(userRef, { currentRoomId: roomId });
      
      // 参加したルームの情報を取得して返す
      const updatedRoomSnap = await getDoc(roomRef);
      const updatedRoom = {
        ...updatedRoomSnap.data(),
        roomId: updatedRoomSnap.id
      } as QuizRoom;
      
      return updatedRoom;
    } catch (roomErr: any) {
      console.error('Error in room operations:', roomErr);
      throw roomErr;
    }
  } catch (err: any) {
    console.error('Error joining room:', err);
    
    // Firebaseの権限エラーを特別に処理
    if (err.code === 'permission-denied') {
      throw new Error('ルームへの参加権限がありません。管理者に問い合わせてください。');
    } else {
      throw new Error(err.message || 'ルームへの参加中にエラーが発生しました');
    }
  }
}

/**
 * ルームから退出する
 */
export async function leaveRoomService(
  userId: string, 
  roomId: string, 
  isLeader: boolean
): Promise<void> {
  try {
    // まず、ユーザー自身のルーム情報をクリア（エラーが発生しても最低限これは行う）
    try {
      await updateDoc(doc(db, 'users', userId), {
        currentRoomId: null
      });
      console.log(`[leaveRoomService] ユーザー(${userId})のルーム情報をクリアしました`);
    } catch (userErr) {
      console.error(`[leaveRoomService] ユーザー(${userId})のルーム情報クリア中にエラー:`, userErr);
      // エラーが発生しても続行
    }
    
    const roomRef = doc(db, 'quiz_rooms', roomId);
    
    // ルームが存在するか確認
    const roomSnap = await getDoc(roomRef);
    if (!roomSnap.exists()) {
      console.log(`[leaveRoomService] ルーム(${roomId})は既に存在しません`);
      return; // ルームが存在しなければ何もしない
    }
    
    // ルームが存在する場合の処理
    if (isLeader) {
      console.log(`[leaveRoomService] リーダーとしてルーム(${roomId})から退出します`);
      // リーダーの場合、ルームを削除
      // まず参加者全員のcurrentRoomIdを更新
      const roomData = roomSnap.data();
      const participants = roomData.participants || {};
      const participantIds = Object.keys(participants);
      
      // すべての参加者のルーム情報をクリア
      const updatePromises = participantIds.map(async (pid) => {
        if (pid !== userId) { // 自分自身は既にクリア済み
          try {
            await updateDoc(doc(db, 'users', pid), {
              currentRoomId: null
            });
          } catch (err) {
            console.error(`[leaveRoomService] 参加者(${pid})の更新中にエラー:`, err);
            // エラーが発生しても他の参加者の処理を続行
          }
        }
      });
      
      try {
        await Promise.all(updatePromises);
        console.log(`[leaveRoomService] 全参加者(${participantIds.length}人)のルーム情報を更新しました`);
      } catch (participantErr) {
        console.error('[leaveRoomService] 参加者の更新中にエラー:', participantErr);
        // エラーが発生しても続行
      }
      
      // ルームを削除
      try {
        await deleteDoc(roomRef);
        console.log(`[leaveRoomService] ルーム(${roomId})を削除しました`);
      } catch (deleteErr) {
        console.error(`[leaveRoomService] ルーム(${roomId})の削除中にエラー:`, deleteErr);
        // 権限エラーなど、予想されるエラーはログのみで続行
        if (deleteErr instanceof Error && deleteErr.message.includes('permission-denied')) {
          console.log(`[leaveRoomService] 権限エラーのため、ルーム(${roomId})は削除されませんでした`);
        } else {
          throw deleteErr; // その他のエラーは上位に伝播
        }
      }
    } else {
      console.log(`[leaveRoomService] 一般参加者としてルーム(${roomId})から退出します`);
      // リーダー以外の場合、参加者リストから自分を削除
      try {
        await updateDoc(roomRef, {
          [`participants.${userId}`]: deleteField(),
          updatedAt: serverTimestamp()
        });
        console.log(`[leaveRoomService] ルーム(${roomId})の参加者リストからユーザー(${userId})を削除しました`);
      } catch (updateErr) {
        console.error(`[leaveRoomService] 参加者情報の削除中にエラー:`, updateErr);
        // 権限エラーなど、予想されるエラーはログのみで続行
        if (updateErr instanceof Error && updateErr.message.includes('permission-denied')) {
          console.log(`[leaveRoomService] 権限エラーのため、参加者情報は更新されませんでした`);
        } else {
          throw updateErr; // その他のエラーは上位に伝播
        }
      }
    }
  } catch (err) {
    console.error('[leaveRoomService] ルームからの退出中にエラー:', err);
    throw new Error('ルームからの退出中にエラーが発生しました');
  }
}

/**
 * 指定されたIDのルームを取得
 */
export async function getRoomById(roomId: string): Promise<QuizRoom> {
  try {
    if (!roomId) {
      throw new Error('ルームIDが指定されていません');
    }
    
    const roomRef = doc(db, 'quiz_rooms', roomId);
    const roomSnap = await getDoc(roomRef);
    
    if (!roomSnap.exists()) {
      throw new Error(`ルームが見つかりません (ID: ${roomId})`);
    }
    
    return {
      ...roomSnap.data(),
      roomId: roomSnap.id
    } as QuizRoom;
  } catch (err) {
    console.error('Error getting room:', err);
    
    // エラーの詳細を含める
    if (err instanceof Error) {
      throw new Error(`ルームの取得中にエラーが発生しました: ${err.message}`);
    } else {
      throw new Error('ルームの取得中に不明なエラーが発生しました');
    }
  }
}
