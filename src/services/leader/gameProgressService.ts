'use client';

import { db, usersDb } from '@/config/firebase';
import { TIMING } from '@/config/quizConfig';
import { updateAllQuizStats } from '@/services/quizRoom';
import { QuizRoom } from '@/types/room';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  updateDoc
} from 'firebase/firestore';
import { writeMonitor } from '@/utils/firestoreWriteMonitor';

export class GameProgressService {
  
  // クイズゲームを開始する
  static async startQuizGame(
    roomId: string,
    quizRoom: QuizRoom,
    isLeader: boolean,
    fetchCurrentQuiz: (overrideIndex?: number) => Promise<void>
  ) {
    if (!isLeader || !quizRoom) return;
    
    try {
      // 現在のルーム状態をチェック
      const roomRef = doc(db, 'quiz_rooms', roomId);
      const roomSnap = await getDoc(roomRef);
      
      if (roomSnap.exists()) {
        const currentData = roomSnap.data();
        
        // 既に進行中の場合は更新をスキップ
        if (currentData.status === 'in_progress') {
          console.log('ルームは既に進行中です。書き込みをスキップしました');
        } else {
          // ルームのステータスを更新（重要な状態変更のみupdatedAtを更新）
          writeMonitor.logOperation('updateDoc', `quiz_rooms/${roomId}`, 'ゲーム開始状態更新');
          await updateDoc(roomRef, {
            status: 'in_progress',
            startedAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            // ゲーム開始時に状態をリセット
            currentState: {
              answerStatus: 'waiting_for_buzz',
              currentAnswerer: null,
              isRevealed: false
            }
          });
          console.log('ルームを進行中状態に更新し、状態をリセットしました');
        }
      }
      
      // 最初の問題を取得（インデックス0を明示的に指定）
      await fetchCurrentQuiz(0);
    } catch (error) {
      console.error('Error starting quiz game:', error);
    }
  }

  // 次の問題に進む
  static async moveToNextQuestion(
    roomId: string,
    quizRoom: QuizRoom,
    isLeader: boolean,
    fetchCurrentQuiz: (overrideIndex?: number) => Promise<void>,
  ) {
    if (!isLeader || !quizRoom) return;
    
    try {
      const nextIndex = quizRoom.currentQuizIndex + 1;
      const quizIds = quizRoom.quizIds || [];
      
      console.log(`[moveToNextQuestion] 現在のインデックス: ${quizRoom.currentQuizIndex}, 次のインデックス: ${nextIndex}, 総問題数: ${quizIds.length}`);
      console.log(`[moveToNextQuestion] クイズIDs: ${JSON.stringify(quizIds)}`);
      
      if (nextIndex >= quizIds.length) {
        // 全問題が終了した場合、ゲーム終了処理は呼び出し元で実行
        console.log('[moveToNextQuestion] 全問題終了 - 呼び出し元でゲーム終了処理を実行してください');
        return;
      }
      
      // 次の問題インデックスに更新（変更がある場合のみ書き込み）
      if (quizRoom.currentQuizIndex !== nextIndex) {
        console.log(`[moveToNextQuestion] クイズインデックス更新: ${quizRoom.currentQuizIndex} → ${nextIndex}`);
        console.log(`[moveToNextQuestion] 次の問題ID: ${quizIds[nextIndex]}`);
        
        writeMonitor.logOperation('updateDoc', `quiz_rooms/${roomId}`, 'クイズインデックス更新と状態リセット');
        await updateDoc(doc(db, 'quiz_rooms', roomId), {
          currentQuizIndex: nextIndex,
          // 新しい問題開始時に状態をリセット
          currentState: {
            answerStatus: 'waiting_for_buzz',
            currentAnswerer: null,
            isRevealed: false // 重要: 答え表示状態をリセット
          }
        });
        console.log(`クイズインデックスを更新し、状態をリセットしました: ${quizRoom.currentQuizIndex} → ${nextIndex}`);
      } else {
        console.log('[moveToNextQuestion] クイズインデックスに変更がないため、書き込みをスキップしました');
      }
      
      // 次の問題を取得（新しいインデックスを直接渡す）
      await fetchCurrentQuiz(nextIndex);
    } catch (error) {
      console.error('Error moving to next question:', error);
    }
  }

  // クイズゲーム終了時の処理
  static async finishQuizGame(
    roomId: string,
    quizRoom: QuizRoom,
    isLeader: boolean
  ) {
    if (!isLeader || !quizRoom) return;

    writeMonitor.logOperation('batch', `quiz_rooms/${roomId}`, 'finishQuizGame統計更新開始');

    try {
      // 重複防止チェック追加
      if (quizRoom.statsUpdated) {
        console.log('このルームの統計は既に更新済みです');
        return;
      }

      console.log('クイズゲーム終了処理を開始します');
      
      // 統計更新を一括で実行（最適化済み）
      const success = await updateAllQuizStats(roomId, quizRoom, { uid: quizRoom.roomLeaderId });
      
      if (success) {
        console.log('統計情報の一括更新が完了しました');
        writeMonitor.logOperation('batch', `quiz_rooms/${roomId}`, '統計更新完了');
      } else {
        console.warn('統計更新は失敗しましたが、処理を続行します');
      }

      // AI生成ジャンルの場合、クイズ単元を削除
      if (quizRoom.genre === 'AI生成' && quizRoom.unitId) {
        try {
          await this.deleteAIGeneratedQuizUnit(quizRoom.genre, quizRoom.unitId);
          console.log(`AI生成クイズ単元を削除しました: ${quizRoom.unitId}`);
        } catch (error) {
          console.error('AI生成クイズ単元の削除に失敗しました:', error);
        }
      }
      
      console.log(`Quiz room ${roomId} completed - scheduling deletion in 10 seconds`);
      
      // 5秒後にルームを削除（結果表示と統計更新の時間確保）
      setTimeout(async () => {
        try {
          // まず、各参加者のcurrentRoomIdをnullに設定して参照を解除
          const participantUpdates = Object.keys(quizRoom.participants).map(async (userId) => {
            try {
              await updateDoc(doc(usersDb, 'users', userId), { currentRoomId: null });
              console.log(`User ${userId} room reference cleared`);
            } catch (userErr) {
              console.warn(`Failed to clear room reference for user ${userId}:`, userErr);
            }
          });
          
          // すべての参加者の更新を待つ
          await Promise.allSettled(participantUpdates);
          console.log('All participant references cleared');
          
          // ルーム参照を再取得
          const roomRef = doc(db, 'quiz_rooms', roomId);
          const roomCheck = await getDoc(roomRef);
          
          // ルームがすでに削除されている場合は何もしない
          if (!roomCheck.exists()) {
            console.log(`Room ${roomId} already deleted, skipping cleanup`);
            return;
          }
          
          try {
            // ルーム内の回答データを削除
            const answersRef = collection(db, 'quiz_rooms', roomId, 'answers');
            const answersSnapshot = await getDocs(answersRef);
            
            if (!answersSnapshot.empty) {
              console.log(`Deleting ${answersSnapshot.size} answers from room ${roomId}`);
              
              // 並列に削除処理を実行
              const deletePromises = answersSnapshot.docs.map(doc => deleteDoc(doc.ref));
              await Promise.allSettled(deletePromises);
              console.log(`Successfully deleted all answers from room ${roomId}`);
            }
          } catch (answersError) {
            console.warn('Failed to cleanup answers, continuing with room deletion:', answersError);
          }
          
          // 最後にルーム自体を削除
          try {
            await deleteDoc(roomRef);
            console.log(`Successfully deleted room ${roomId}`);
          } catch (roomDeleteError) {
            console.error('Error deleting room:', roomDeleteError);
            console.log('fucking error');
          }
        } catch (error) {
          console.error('Error in room cleanup process:', error);
        }
      }, 5000); // 5秒後に削除
    } catch (error: any) {
      console.error('Error finishing quiz game:', error);
      
      // エラーが発生しても、ルームを非アクティブとしてマークしてリソースを解放する
      if (error?.code === 'permission-denied') {
        try {
          await updateDoc(doc(db, 'quiz_rooms', roomId), {
            status: 'inactive',
            updatedAt: serverTimestamp(),
            isDeleted: true
          });
          console.log(`Marked room ${roomId} as inactive due to permission error in game finish`);
        } catch (markError) {
          console.error('Failed to mark room as inactive after game finish error:', markError);
        }
      }
    }
  }

  // AI生成クイズ単元を削除する（サブコレクション含む）
  static async deleteAIGeneratedQuizUnit(genre: string, unitId: string) {
    try {
      console.log(`[GameProgressService] AI生成クイズ単元削除開始: ${genre}/${unitId}`);

      // サブコレクション（クイズ）を先に削除
      const quizzesRef = collection(db, 'genres', genre, 'official_quiz_units', unitId, 'quizzes');
      const quizzesSnapshot = await getDocs(quizzesRef);

      if (!quizzesSnapshot.empty) {
        console.log(`[GameProgressService] ${quizzesSnapshot.size}個のクイズを削除中...`);
        
        // 並列でクイズを削除
        const deleteQuizPromises = quizzesSnapshot.docs.map(doc => deleteDoc(doc.ref));
        await Promise.allSettled(deleteQuizPromises);
        
        console.log(`[GameProgressService] サブコレクションのクイズを削除完了`);
      }

      // 単元ドキュメント自体を削除
      const unitRef = doc(db, 'genres', genre, 'official_quiz_units', unitId);
      await deleteDoc(unitRef);
      
      console.log(`[GameProgressService] AI生成クイズ単元削除完了: ${unitId}`);
      
    } catch (error) {
      console.error(`[GameProgressService] AI生成クイズ単元削除エラー:`, error);
      throw error;
    }
  }
}
