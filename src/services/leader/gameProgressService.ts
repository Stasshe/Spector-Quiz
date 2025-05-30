'use client';

import { db } from '@/config/firebase';
import { QuizRoom } from '@/types/room';
import {
  doc,
  getDoc,
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
}
