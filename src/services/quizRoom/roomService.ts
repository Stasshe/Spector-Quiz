import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  where
} from 'firebase/firestore';
import { db, usersDb } from '../../config/firebase';
import type { QuizRoom, RoomListing } from '../../types/room';
import { writeMonitor } from '@/utils/firestoreWriteMonitor';


// getRoomById関数はparticipationService.tsに統合されました

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
    
    // バッチ処理で回答を削除（書き込み監視）
    writeMonitor.logOperation(
      'batch',
      `quiz_rooms/${roomId}/answers/*`,
      `回答データクリーンアップ - ${answersSnapshot.size}件`,
      answersSnapshot.size
    );
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


/**
 * 利用可能なルームを監視するリアルタイムリスナーを設定
 * onSnapshotを使用して、データの変更があるたびにコールバックが呼び出される
 */
export function subscribeToAvailableRooms(
  genre: string,
  classType: string = 'ユーザー作成',
  callback: (rooms: RoomListing[]) => void,
  onError?: (error: Error) => void
) {
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
    
    // onSnapshotを使用してリアルタイムリスナーを設定
    return onSnapshot(
      roomsQuery,
      (roomsSnapshot) => {
        const rooms: RoomListing[] = [];
        
        roomsSnapshot.forEach(roomDoc => {
          const roomData = roomDoc.data() as QuizRoom;
          
          // パフォーマンスのためにparticipantsをフルで含めず、数だけカウント
          const participantCount = roomData.participants ? Object.keys(roomData.participants).length : 0;
          
          // FirestoreからのデータにunitNameがあるかもしれないので、asで強制キャストしても取得
          const roomDataAny = roomDoc.data() as any;
          
          rooms.push({
            roomId: roomDoc.id,
            unitId: roomData.unitId || 'error',
            unitName: roomDataAny.unitName, // Firestoreのデータから単元名を取得
            name: roomData.name || '無名のルーム',
            genre: roomData.genre,
            participantCount,
            totalQuizCount: roomData.totalQuizCount || 0,
            status: roomData.status,
          });
        });
        
        // コールバックで結果を返す
        callback(rooms);
      },
      (error) => {
        console.error('Error listening to available rooms:', error);
        if (onError) onError(error);
      }
    );
  } catch (err) {
    console.error('Error setting up room listener:', err);
    if (onError) onError(err instanceof Error ? err : new Error('リスナー設定中に未知のエラーが発生しました'));
    // 空のunsubscribe関数を返す
    return () => {};
  }
}
