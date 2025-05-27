// filepath: /workspaces/Spector-Quiz/src/services/quizRoom/roomService.ts
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  limit,
  orderBy,
  deleteDoc,
  updateDoc,
  deleteField,
  serverTimestamp,
  Timestamp,
  runTransaction,
  increment
} from 'firebase/firestore';
import { TIMING } from '../../config/quizConfig';
import { db } from '../../config/firebase';

import type { RoomListing, QuizRoom } from '../../types/room';
import type { Quiz } from '../../types/quiz';

/**
 * 指定されたIDのルームを取得
 */
export async function getRoomById(roomId: string): Promise<QuizRoom | null> {
  try {
    const roomRef = doc(db, 'quiz_rooms', roomId);
    const roomSnap = await getDoc(roomRef);
    
    if (roomSnap.exists()) {
      const roomData = roomSnap.data() as QuizRoom;
      return {
        ...roomData,
        roomId: roomSnap.id
      };
    }
    
    return null;
  } catch (err) {
    console.error('Error getting room:', err);
    throw new Error('ルームの取得中にエラーが発生しました');
  }
}

/**
 * 利用可能なルームを取得
 */
export async function fetchAvailableRooms(
  genre: string,
  classType: string = 'ユーザー作成'
): Promise<RoomListing[]> {
  try {
    let roomsQuery;
    
    if (genre === 'all') {
      // 「すべて」の場合はジャンルフィルタを外す
      roomsQuery = query(
        collection(db, 'quiz_rooms'),
        where('status', '==', 'waiting'),
        where('classType', '==', classType),
        orderBy('startedAt', 'desc'),
        limit(50)
      );
    } else {
      // 特定のジャンルのルームを取得
      roomsQuery = query(
        collection(db, 'quiz_rooms'),
        where('status', '==', 'waiting'),
        where('genre', '==', genre),
        where('classType', '==', classType),
        orderBy('startedAt', 'desc'),
        limit(50)
      );
    }
    
    const roomsSnapshot = await getDocs(roomsQuery);
    
    const rooms: RoomListing[] = [];
    
    roomsSnapshot.forEach(roomDoc => {
      const roomData = roomDoc.data() as QuizRoom;
      
      // パフォーマンスのためにparticipantsをフルで含めず、数だけカウント
      const participantCount = roomData.participants ? Object.keys(roomData.participants).length : 0;
      
      rooms.push({
        roomId: roomDoc.id,
        unitId: roomData.unitId || 'error',
        name: roomData.name || '無名のルーム',
        genre: roomData.genre,
        participantCount,
        totalQuizCount: roomData.totalQuizCount || 0,
        status: roomData.status,
      });
    });
    
    return rooms;
  } catch (err) {
    console.error('Error fetching available rooms:', err);
    throw new Error('利用可能なルームの取得中にエラーが発生しました');
  }
}

/**
 * 8分以上経過した待機ルームを確認・解散する
 */
export async function checkAndDisbandOldRooms(
  currentUserId?: string | null,
  currentWaitingRoomId?: string | null,
  setWaitingRoom?: (room: QuizRoom | null) => void
): Promise<void> {
  try {
    // 8分前の時間を計算
    const cutoffTime = new Date();
    cutoffTime.setTime(cutoffTime.getTime() - TIMING.AUTO_DISBAND_TIME_MS);
    
    // 8分以上前に作成された待機中のルームを検索
    const oldRoomsQuery = query(
      collection(db, 'quiz_rooms'),
      where('status', '==', 'waiting'),
      where('startedAt', '<', Timestamp.fromDate(cutoffTime)),
      limit(20) // 安全のため制限
    );
    
    const oldRooms = await getDocs(oldRoomsQuery);
    
    if (oldRooms.empty) {
      // 古いルームが無い場合は早期リターン
      return;
    }
    
    console.log(`${oldRooms.size}個の古いルームを解散処理します`);
    
    // 解散処理を実行
    const deletePromises = oldRooms.docs.map(async (roomDoc) => {
      try {
        const roomData = roomDoc.data() as QuizRoom;
        console.log(`古いルーム解散: ${roomDoc.id}, 作成時間: ${roomData.startedAt?.toDate().toLocaleString()}`);
        
        // 参加者のcurrentRoomIdをクリア
        const participantIds = Object.keys(roomData.participants || {});
        
        // 各参加者のユーザー情報を更新（権限エラー対策のため個別処理）
        for (const userId of participantIds) {
          try {
            const userRef = doc(db, 'users', userId);
            const userDoc = await getDoc(userRef);
            
            // ユーザーが存在し、そのルームに参加中の場合のみ更新
            if (userDoc.exists() && userDoc.data().currentRoomId === roomDoc.id) {
              try {
                await updateDoc(userRef, { currentRoomId: null });
                console.log(`ユーザー ${userId} のルーム参加情報をクリアしました`);
              } catch (updateErr: any) {
                // 権限エラーは個別に処理（スキップしてログ記録のみ）
                if (updateErr?.code === 'permission-denied') {
                  console.warn(`ユーザー ${userId} の更新権限がありません`);
                } else {
                  console.error(`ユーザー ${userId} の更新中にエラーが発生しました:`, updateErr);
                }
              }
            }
          } catch (userErr) {
            console.error(`ユーザー ${userId} の情報取得中にエラー:`, userErr);
          }
        }
        
        // まずanswersサブコレクションを削除
        try {
          const answersRef = collection(db, 'quiz_rooms', roomDoc.id, 'answers');
          const answersSnapshot = await getDocs(answersRef);
          
          if (!answersSnapshot.empty) {
            console.log(`ルーム ${roomDoc.id} の回答データ(${answersSnapshot.size}件)を削除します`);
            
            // バッチ処理で回答を削除
            const deletePromises = answersSnapshot.docs.map(doc => deleteDoc(doc.ref));
            await Promise.allSettled(deletePromises);
            console.log(`ルーム ${roomDoc.id} の回答データを削除しました`);
          }
        } catch (answersErr) {
          console.warn(`ルーム ${roomDoc.id} の回答データ削除中にエラー:`, answersErr);
          // 回答削除のエラーは無視して続行
        }
        
        // ルームを削除（リーダーまたは管理者権限がある場合のみ可能）
        try {
          await deleteDoc(roomDoc.ref);
          console.log(`ルーム ${roomDoc.id} を完全に削除しました`);
        } catch (deleteErr: any) {
          // 権限エラーは異なる処理を行う
          if (deleteErr?.code === 'permission-denied') {
            console.warn(`ルーム ${roomDoc.id} の削除権限がありません。代替手段を試行します`);
            
            // 権限エラーの場合は、ルームのステータスを更新して完了とマーク
            try {
              await updateDoc(roomDoc.ref, {
                status: 'completed',
                updatedAt: serverTimestamp(),
                automaticallyClosed: true,
                closeReason: '8分以上の未活動'
              });
              console.log(`ルーム ${roomDoc.id} を完了状態に更新しました`);
            } catch (updateErr: any) {
              // 更新の権限もない場合は諦める
              if (updateErr?.code === 'permission-denied') {
                console.error(`ルーム ${roomDoc.id} を更新する権限もありません`);
              } else {
                console.error(`ルーム ${roomDoc.id} の更新中にエラー:`, updateErr);
              }
            }
          } else {
            console.error(`ルーム ${roomDoc.id} の削除中にエラー:`, deleteErr);
          }
        }
        
        // 現在ユーザーが待機中のルームが解散された場合、待機中ルーム状態をクリア
        if (
          currentUserId && 
          setWaitingRoom && 
          currentWaitingRoomId === roomDoc.id
        ) {
          setWaitingRoom(null);
          console.log(`ユーザーの待機中ルーム状態をクリアしました: ${roomDoc.id}`);
        }
      } catch (roomErr) {
        // 個別のルーム処理でエラーが発生しても他のルームの処理を続行
        console.error(`ルーム ${roomDoc.id} の処理中にエラー:`, roomErr);
      }
    });
    
    // 全ての非同期処理が完了するまで待機
    await Promise.allSettled(deletePromises);
    console.log('古いルームの解散処理が完了しました');
  } catch (err) {
    console.error('古いルームの解散処理中にエラーが発生しました:', err);
    // エラーはスローせず、ログだけ記録（バックグラウンド操作のため）
  }
}

/**
 * ルームが完了したとき（全問終了時）に統計を更新する関数
 * @returns {boolean} 統計が更新されたかどうか
 */
export async function updateUserStatsOnRoomComplete(
  roomId: string,
  currentUserId?: string | null
): Promise<boolean> {
  // currentUserIdが指定されていない場合は引数として渡されたroomIdから取得する
  if (!currentUserId) {
    // ユーザー情報がない場合は早期リターン
    return false;
  }
  
  try {
    // ルーム情報を取得
    const roomRef = doc(db, 'quiz_rooms', roomId);
    const roomSnap = await getDoc(roomRef);
    
    if (!roomSnap.exists()) {
      console.log('ルームが既に削除されています。統計は別の方法で更新済みの可能性があります。');
      return true; // エラーではなく成功として扱う
    }
    
    const roomData = roomSnap.data() as QuizRoom;
    
    // ユーザーの参加情報を確認
    if (!roomData.participants || !roomData.participants[currentUserId]) {
      throw new Error('このルームに参加していません');
    }
    
    const userPerfomance = roomData.participants[currentUserId];
    const score = userPerfomance.score || 0;
    
    // ユーザーとジャンル情報の参照を取得
    const userRef = doc(db, 'users', currentUserId);
    const userDoc = await getDoc(userRef);
    
    let genreRef = null;
    let genreSnap = null;
    
    if (roomData.genre) {
      genreRef = doc(db, 'genres', roomData.genre);
      genreSnap = await getDoc(genreRef);
    }
    
    // トランザクションで統計情報を更新
    await runTransaction(db, async (transaction) => {
      // スコアに基づいて加算するEXP計算
      let expToAdd = Math.floor(score / 100);
      
      if (expToAdd < 1 && score > 0) expToAdd = 1; // 最低1EXP
      if (userPerfomance.missCount === 0 && score > 0) expToAdd++; // ミスがない場合ボーナス
      if (roomData.totalQuizCount > 10 && score > 0) expToAdd++; // 長いクイズセッションのボーナス
      
      
      // ユーザー統計情報の更新（usersコレクションに直接保存）
      if (userDoc.exists()) {
        // ユーザーが存在する場合
        const userData = userDoc.data();
        const currentStats = userData.stats || {
          totalQuizzes: 0,
          correctAnswers: 0,
          experience: 0,
          genre: {}
        };
        
        const genreStats = currentStats.genre?.[roomData.genre] || { count: 0, score: 0 };
        
        transaction.update(userRef, {
          'stats.totalQuizzes': increment(roomData.totalQuizCount),
          'stats.correctAnswers': increment(userPerfomance.score || 0),
          'stats.experience': increment(expToAdd),
          'stats.lastActivity': serverTimestamp(),
          [`stats.genre.${roomData.genre}`]: {
            count: (genreStats.count || 0) + 1,
            score: (genreStats.score || 0) + score
          }
        });
      } else {
        // 想定外のケース：ユーザーが存在しないが、統計を更新しようとしている
        console.error('ユーザーが存在しないため統計更新をスキップします');
      }
      
      // ジャンルと単元の使用統計の更新（genre_statsの代わりにgenresコレクションに統計情報を保存）
      if (roomData.genre && genreRef && genreSnap) {
        if (genreSnap.exists()) {
          transaction.update(genreRef, {
            'stats.useCount': increment(1)
          });
          
          // 単元情報があれば、その統計も更新
          if (roomData.unitId) {
            transaction.update(genreRef, {
              [`stats.units.${roomData.unitId}.useCount`]: increment(1)
            });
          }
        } else {
          // ジャンルデータが存在しないケース（通常は発生しないはず）
          console.error(`ジャンル ${roomData.genre} が存在しないため、統計更新をスキップします`);
        }
      }
      
      // ルーム自体に統計更新完了フラグを設定
      transaction.update(roomRef, {
        statsUpdated: true,
        updatedAt: serverTimestamp()
      });
    });
    
    // ルームの統計更新が完了
    console.log('ルーム統計の更新が完了しました');
    return true;
  } catch (err) {
    console.error('ルーム統計の更新中にエラーが発生しました:', err);
    return false;
  }
}


/**
 * ルームのanswersサブコレクションを削除するユーティリティ関数
 * ルーム削除前に呼び出すことで、サブコレクション残りを防止できる
 */
export async function cleanupRoomAnswersById(roomId: string): Promise<boolean> {
  try {
    // ルームが存在するか確認
    const roomRef = doc(db, 'quiz_rooms', roomId);
    const roomSnap = await getDoc(roomRef);
    
    if (!roomSnap.exists()) {
      console.log(`[cleanupRoomAnswers] ルーム ${roomId} は既に存在しません`);
      return true; // 既に削除されているなら成功とみなす
    }
    
    // answersサブコレクションの削除
    const answersRef = collection(db, 'quiz_rooms', roomId, 'answers');
    const answersSnapshot = await getDocs(answersRef);
    
    if (answersSnapshot.empty) {
      console.log(`[cleanupRoomAnswers] ルーム ${roomId} には回答データがありません`);
      return true;
    }
    
    console.log(`[cleanupRoomAnswers] ルーム ${roomId} の回答データ(${answersSnapshot.size}件)を削除します`);
    
    // バッチ処理で回答を削除
    const deletePromises = answersSnapshot.docs.map(doc => deleteDoc(doc.ref));
    const results = await Promise.allSettled(deletePromises);
    
    // エラーの数を確認
    const errors = results.filter(r => r.status === 'rejected');
    if (errors.length > 0) {
      console.warn(`[cleanupRoomAnswers] ${errors.length}個の回答の削除に失敗しました`);
      return false;
    }
    
    console.log(`[cleanupRoomAnswers] ルーム ${roomId} の回答データを全て削除しました`);
    return true;
  } catch (err) {
    console.error(`[cleanupRoomAnswers] エラー:`, err);
    return false;
  }
}
