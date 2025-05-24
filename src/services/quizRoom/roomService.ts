'use client';

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
  //deleteField,
  //onSnapshot, 
  serverTimestamp, 
  increment,
  runTransaction,
  Timestamp,
  limit
} from 'firebase/firestore';
import { db } from '@/config/firebase';
import { QuizRoom, RoomListing, RoomStatus } from '@/types/room';
import { ParticipantInfo } from '@/types/user';

// 8分（ミリ秒）- WaitingRoomFloating.tsxと同期を保つ
export const AUTO_DISBAND_TIME_MS = 8 * 60 * 1000;

// ------ ルーム取得関連のサービス関数 ------

/**
 * 利用可能なルーム一覧を取得
 */
export async function fetchAvailableRooms(genre: string, classType: string): Promise<RoomListing[]> {
  try {
    // 古いルームを自動解散チェック
    await checkAndDisbandOldRooms();
    
    const roomsQuery = query(
      collection(db, 'quiz_rooms'),
      where('status', '==', 'waiting'),
      where('genre', '==', genre),
      orderBy('startedAt', 'desc')
    );
    
    const roomsSnapshot = await getDocs(roomsQuery);
    
    // 事前にすべての単元IDを収集
    const unitIds = new Set<string>();
    const unitCache: { [unitId: string]: { title: string } } = {};
    
    // まず、必要な単元IDを集める
    roomsSnapshot.docs.forEach(docSnap => {
      const data = docSnap.data();
      if (data.unitId && data.unitId !== '') {
        unitIds.add(`${data.genre}:${data.unitId}`);
      }
    });
    
    // 単元情報を一括でフェッチ（必要な場合のみ）
    if (unitIds.size > 0) {
      // Promise.allで並列処理
      const unitPromises = Array.from(unitIds).map(async (combinedId) => {
        const [genreId, unitId] = combinedId.split(':');
        const unitRef = doc(db, 'genres', genreId, 'quiz_units', unitId);
        try {
          const unitSnap = await getDoc(unitRef);
          if (unitSnap.exists()) {
            unitCache[combinedId] = { 
              title: unitSnap.data().title || '不明な単元'
            };
          } else {
            unitCache[combinedId] = { title: '削除された単元' };
          }
        } catch (err) {
          console.error(`Error fetching unit ${combinedId}:`, err);
          unitCache[combinedId] = { title: 'エラー' };
        }
      });
      
      await Promise.all(unitPromises);
    }
    
    // ルーム情報を構築
    const rooms: RoomListing[] = [];
    
    for (const docSnap of roomsSnapshot.docs) {
      const data = docSnap.data();
      const participantCount = data.participants ? Object.keys(data.participants).length : 0;
      
      // 単元情報を取得
      let unitName = '一般';
      if (data.unitId && data.unitId !== '') {
        const cacheKey = `${data.genre}:${data.unitId}`;
        if (unitCache[cacheKey]) {
          unitName = unitCache[cacheKey].title;
        }
      }
      
      rooms.push({
        roomId: docSnap.id,
        name: data.name || 'No Name Room',
        genre: data.genre,
        unitId: data.unitId || '',
        unitName, // 単元名をルーム一覧に追加
        participantCount,
        status: data.status
      });
    }
    
    return rooms;
  } catch (err) {
    console.error('Error fetching rooms:', err);
    throw new Error('ルーム一覧の取得中にエラーが発生しました');
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
    cutoffTime.setTime(cutoffTime.getTime() - AUTO_DISBAND_TIME_MS);
    
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
 * 特定の単元IDを名前から取得する
 */
export async function getUnitIdByName(genre: string, unitName: string, classType: string = '公式'): Promise<string | null> {
  try {
    // クラスタイプに応じてコレクション名を決定
    // '公式' の場合は official_quiz_units コレクション
    // それ以外の場合は quiz_units コレクション
    const collectionName = classType === '公式' ? 'official_quiz_units' : 'quiz_units';
    console.log(`[getUnitIdByName] ジャンル: ${genre}, 単元名: ${unitName}, クラスタイプ: ${classType}, コレクション: ${collectionName}`);
    
    const unitsQuery = query(
      collection(db, 'genres', genre, collectionName),
      where('title', '==', unitName),
      limit(1)
    );
    
    const unitsSnapshot = await getDocs(unitsQuery);
    
    if (!unitsSnapshot.empty) {
      const unitId = unitsSnapshot.docs[0].id;
      console.log(`[getUnitIdByName] 単元ID取得成功: ${unitId}`);
      return unitId;
    }
    
    console.error(`[getUnitIdByName] 単元が見つかりません。ジャンル: ${genre}, 単元名: ${unitName}, クラスタイプ: ${classType}`);
    return null;
  } catch (err) {
    console.error(`Error getting unit ID for ${unitName}:`, err);
    throw new Error('単元IDの取得中にエラーが発生しました');
  }
}

/**
 * 単元がなければ作成する
 */
export async function createUnitIfNotExists(
  currentUserId: string | null,
  genreId: string, 
  unitName: string, 
  category: string = 'その他'
): Promise<string> {
  if (!currentUserId) {
    throw new Error('この操作にはログインが必要です');
  }
  
  try {
    // まず、同じ名前の単元が存在するか確認
    const unitsQuery = query(
      collection(db, 'genres', genreId, 'quiz_units'),
      where('title', '==', unitName),
      limit(1)
    );
    
    const unitsSnapshot = await getDocs(unitsQuery);
    
    // 既に存在する場合はそのIDを返す
    if (!unitsSnapshot.empty) {
      return unitsSnapshot.docs[0].id;
    }
    
    // 存在しない場合は新規作成
    const newUnit = {
      title: unitName,
      description: `${unitName}に関するクイズ集`,
      category: category,
      createdBy: currentUserId,
      createdAt: serverTimestamp(),
      quizCount: 0,
      useCount: 0,
      isPublic: false
    };
    
    const unitRef = await addDoc(collection(db, 'genres', genreId, 'quiz_units'), newUnit);
    return unitRef.id;
  } catch (err) {
    console.error(`Error creating unit ${unitName}:`, err);
    throw new Error('単元の作成中にエラーが発生しました');
  }
}

/**
 * 経験値からランクを計算する関数
 */
export function calculateRank(exp: number): string {
  if (exp < 100) return 'ブロンズ';
  if (exp < 300) return 'シルバー';
  if (exp < 600) return 'ゴールド';
  if (exp < 1000) return 'プラチナ';
  if (exp < 2000) return 'ダイヤモンド';
  return 'レジェンド';
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
    
    // ユーザー情報を直接更新（user_statsの代わりにusersコレクションに統計情報を保存）
    const userRef = doc(db, 'users', currentUserId);
    
    // トランザクションで安全に更新
    await runTransaction(db, async (transaction) => {
      // 1. すべての読み取り操作を先に実行 ----------------------------------------
      // ユーザー情報を読み取り
      const userDoc = await transaction.get(userRef);
      
      // ジャンルと単元の情報を読み取り（条件付き）
      let genreRef;
      let genreSnap;
      if (roomData.genre) {
        genreRef = doc(db, 'genres', roomData.genre);
        genreSnap = await transaction.get(genreRef);
      }
      
      // 2. すべての書き込み操作を後で実行 ----------------------------------------
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
          console.error('ジャンルが存在しないため統計更新をスキップします');
        }
      }
    });
  } catch (err) {
    console.error('Error updating user stats:', err);
    throw new Error('統計の更新中にエラーが発生しました');
  }
  
  // 更新が完了したらtrueを返す
  return true;
}
