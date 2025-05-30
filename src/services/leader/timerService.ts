'use client';

import { db } from '@/config/firebase';
import { getQuestionTimeout } from '@/config/quizConfig';
import { QuizRoom } from '@/types/room';
import { doc, getDoc, updateDoc } from 'firebase/firestore';

export class TimerService {
  
  // 問題のタイマーを開始（ジャンル別制限時間）
  static startQuestionTimer(
    roomId: string,
    quizRoom: QuizRoom,
    isLeader: boolean,
    checkAndProgressGame: () => Promise<void>
  ) {
    if (!isLeader || !quizRoom || !roomId) return;
    
    const timeout = getQuestionTimeout(quizRoom.genre);
    console.log(`クイズタイマーを開始します (${timeout/1000}秒) - ジャンル: ${quizRoom.genre}`);
    
    // ジャンル別制限時間後に次の問題に進むか、タイムアウト処理を行う
    setTimeout(async () => {
      try {
        // 最新のルーム情報を取得して確認
        const roomRef = doc(db, 'quiz_rooms', roomId);
        const roomSnap = await getDoc(roomRef);
        
        if (!roomSnap.exists()) return;
        
        const roomData = roomSnap.data() as QuizRoom;
        
        // もし同じ問題のままで、かつステータスが進行中の場合のみ処理する
        if (
          roomData.status === 'in_progress' && 
          roomData.currentQuizIndex === quizRoom.currentQuizIndex &&
          roomData.currentState.answerStatus !== 'correct' // 正解していない場合のみ
        ) {
          console.log('時間切れです。自動進行判定を開始します。');
          
          // 時間切れであることを記録（頻繁な状態変更はupdatedAtを省略）
          await updateDoc(roomRef, {
            'currentState.answerStatus': 'timeout',
            'currentState.isRevealed': true
          });
          
          // 自動進行の判定を実行
          await checkAndProgressGame();
        }
      } catch (error) {
        console.error('タイマー処理中にエラーが発生しました:', error);
      }
    }, timeout); // ジャンル別制限時間
  }
}
