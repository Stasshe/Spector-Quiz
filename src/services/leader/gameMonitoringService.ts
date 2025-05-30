'use client';

import { db } from '@/config/firebase';
import { TIMING } from '@/config/quizConfig';
import { QuizRoom } from '@/types/room';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where
} from 'firebase/firestore';
import { writeMonitor } from '@/utils/firestoreWriteMonitor';

export class GameMonitoringService {
  
  // ゲーム進行状況をチェックして自動進行を決定
  static async checkAndProgressGame(
    roomId: string,
    quizRoom: QuizRoom,
    isLeader: boolean,
    moveToNextQuestion: () => Promise<void>
  ) {
    if (!isLeader || !quizRoom) return;
    
    try {
      // 現在のルーム状態を取得
      const roomRef = doc(db, 'quiz_rooms', roomId);
      const roomSnap = await getDoc(roomRef);
      
      if (!roomSnap.exists()) {
        console.log('ルームが存在しません');
        return;
      }
      
      const roomData = roomSnap.data() as QuizRoom;
      
      // ルームが進行中でない場合は処理しない
      if (roomData.status !== 'in_progress') {
        console.log('ルームが進行中ではありません');
        return;
      }
      
      // 正解者がいる場合は既に処理済み
      if (roomData.currentState?.answerStatus === 'correct') {
        console.log('正解者がいるため、自動進行はスキップします');
        return;
      }
      
      // 現在のクイズの全解答を取得
      const quizIds = roomData.quizIds || [];
      if (quizIds.length === 0) {
        console.log('クイズIDが設定されていません');
        return;
      }
      
      const currentQuizId = quizIds[roomData.currentQuizIndex];
      if (!currentQuizId) {
        console.log('現在のクイズIDが見つかりません');
        return;
      }
      
      const answersRef = collection(db, 'quiz_rooms', roomId, 'answers');
      const currentQuizAnswers = query(
        answersRef,
        where('quizId', '==', currentQuizId)
      );
      
      const answersSnap = await getDocs(currentQuizAnswers);
      
      // 解答したプレイヤーのリスト
      const answeredPlayers = new Set();
      let hasCorrectAnswer = false;
      
      answersSnap.docs.forEach(doc => {
        const answerData = doc.data();
        answeredPlayers.add(answerData.userId);
        if (answerData.isCorrect) {
          hasCorrectAnswer = true;
        }
      });
      
      // 正解者がいる場合は何もしない
      if (hasCorrectAnswer) {
        console.log('正解者がいます');
        return;
      }
      
      // 全員が解答したかチェック
      const totalParticipants = Object.keys(roomData.participants).length;
      const answeredCount = answeredPlayers.size;
      
      console.log(`解答状況: ${answeredCount}/${totalParticipants}人が解答済み`);
      
      // 全員が解答した場合、または時間切れの場合（タイムアウトの状態）
      const isTimeout = roomData.currentState?.answerStatus === 'timeout';
      const allAnswered = answeredCount >= totalParticipants;
      
      // 全員が解答した場合、または時間切れの場合に結果を表示
      if (allAnswered || isTimeout) {
        console.log(isTimeout ? '時間切れです。' : '全員が解答完了しました。');
        console.log('正解と解説を表示して、一定時間後に次の問題に進みます');
        
        // 現在の状態をチェックして、変更が必要な場合のみ更新
        const currentState = roomData.currentState || {};
        const targetStatus = isTimeout ? 'timeout' : 'all_answered';
        const updateData: any = {};
        
        if (currentState.answerStatus !== targetStatus) {
          updateData['currentState.answerStatus'] = targetStatus;
        }
        if (currentState.isRevealed !== true) {
          updateData['currentState.isRevealed'] = true;
        }
        if (currentState.currentAnswerer !== null) {
          updateData['currentState.currentAnswerer'] = null;
        }
        
        // 実際に変更がある場合のみ書き込み
        if (Object.keys(updateData).length > 0) {
          writeMonitor.logOperation('updateDoc', `quiz_rooms/${roomId}`, '全員解答完了/タイムアウト状態更新');
          await updateDoc(roomRef, updateData);
          console.log('ルーム状態を更新しました（全員解答完了/タイムアウト）');
        } else {
          console.log('ルーム状態に変更がないため、書き込みをスキップしました');
        }
        
        // 一定時間後に次の問題へ
        setTimeout(() => {
          moveToNextQuestion();
        }, TIMING.NEXT_QUESTION_DELAY);
      } else {
        // まだ全員が解答していない場合は待機状態を継続
        console.log(`まだ全員が解答していません。待機中... (${answeredCount}/${totalParticipants}人解答済み)`);
      }
      
    } catch (error) {
      console.error('ゲーム進行チェックでエラーが発生しました:', error);
    }
  }

  // 早押し監視
  static handleBuzzerUpdates(
    roomId: string,
    isLeader: boolean,
    checkAndProgressGame: () => Promise<void>
  ) {
    if (!isLeader || !roomId) return () => {};
    
    const answersRef = collection(db, 'quiz_rooms', roomId, 'answers');
    const pendingAnswersQuery = query(
      answersRef,
      where('processingStatus', '==', 'pending'),
      orderBy('clickTime', 'asc')
    );
    
    return GameMonitoringService.subscribeToBuzzerUpdates(
      pendingAnswersQuery,
      roomId,
      checkAndProgressGame
    );
  }

  private static subscribeToBuzzerUpdates(
    pendingAnswersQuery: any,
    roomId: string,
    checkAndProgressGame: () => Promise<void>
  ) {
    return onSnapshot(pendingAnswersQuery, async (snapshot: any) => {
      if (snapshot.empty) return;
      
      try {
        // 最も早く押したユーザーを特定
        const fastestAnswer = snapshot.docs[0];
        const fastestUserId = fastestAnswer.data().userId;
        
        // ルームの状態を確認
        const roomRef = doc(db, 'quiz_rooms', roomId);
        const roomSnap = await getDoc(roomRef);
        
        if (!roomSnap.exists()) {
          console.log('ルームが存在しません');
          return;
        }
        
        if (roomSnap.data().status !== 'in_progress') {
          console.log('ルームが進行中ではありません');
          return;
        }
        
        // 既に解答権が割り当てられていないか確認
        if (roomSnap.data().currentState?.currentAnswerer) {
          console.log('既に解答権が割り当てられています');
          // 保留中の回答をすべて処理済みにマーク
          for (const docSnap of snapshot.docs) {
            try {
              await updateDoc(docSnap.ref, { processingStatus: 'processed' });
            } catch (updateError) {
              console.error('個別解答更新エラー:', updateError);
            }
          }
          return;
        }
        
        await GameMonitoringService.assignAnswerRight(
          roomRef,
          fastestUserId,
          roomId,
          snapshot,
          fastestAnswer
        );
        
      } catch (error) {
        console.error('早押し処理中にエラーが発生しました:', error);
      }
    }, (error: any) => {
      console.error('早押し監視のリスナーでエラーが発生しました:', error);
    });
  }

  private static async assignAnswerRight(
    roomRef: any,
    fastestUserId: string,
    roomId: string,
    snapshot: any,
    fastestAnswer: any
  ) {
    try {
      // 現在の状態をチェックして、実際に変更が必要かを確認
      const roomSnap = await getDoc(roomRef);
      const roomData = roomSnap.data() as QuizRoom;
      const currentState = roomData?.currentState || {};
      const updateData: any = {};
      
      if (currentState.currentAnswerer !== fastestUserId) {
        updateData['currentState.currentAnswerer'] = fastestUserId;
      }
      if (currentState.answerStatus !== 'answering_in_progress') {
        updateData['currentState.answerStatus'] = 'answering_in_progress';
      }
      
      // 実際に変更がある場合のみ書き込み
      if (Object.keys(updateData).length > 0) {
        writeMonitor.logOperation('updateDoc', `quiz_rooms/${roomId}`, '解答権割り当て（変更検出後）');
        await updateDoc(roomRef, updateData);
        console.log(`解答権を ${fastestUserId} に割り当てました`);
      } else {
        console.log('解答権の状態に変更がないため、書き込みをスキップしました');
      }
      
      console.log(`解答権をユーザー ${fastestUserId} に付与しました`);
      
      // 8秒の解答制限時間を設定
      console.log(`解答制限時間を開始します (${TIMING.ANSWER_TIMEOUT/1000}秒)`);
      setTimeout(async () => {
        try {
          // 最新のルーム状態を確認
          const currentRoomSnap = await getDoc(roomRef);
          if (!currentRoomSnap.exists()) return;
          
          const currentRoomData = currentRoomSnap.data() as QuizRoom;
          
          // まだ同じユーザーが解答権を持っていて、解答していない場合
          if (currentRoomData.currentState?.currentAnswerer === fastestUserId && 
              currentRoomData.currentState?.answerStatus === 'answering_in_progress') {
            console.log(`ユーザー ${fastestUserId} の解答時間切れです`);
            
            // 解答権をリセットして他の人が解答できるようにする
            await updateDoc(roomRef, {
              'currentState.currentAnswerer': null,
              'currentState.answerStatus': 'waiting_for_buzz'
            });
            
            console.log('解答権をリセットしました。他の参加者が早押しできます');
          }
        } catch (timeoutError) {
          console.error('解答タイムアウト処理中にエラーが発生しました:', timeoutError);
        }
      }, TIMING.ANSWER_TIMEOUT);
    } catch (roomUpdateError: any) {
      console.error('ルーム状態の更新に失敗しました:', roomUpdateError);
      if (roomUpdateError?.code === 'permission-denied') {
        console.error('権限エラー: ルーム状態の更新が拒否されました');
        return;
      }
    }
    
    // 全ての解答を個別に更新
    try {
      // 最初の解答を処理済みにマーク
      await updateDoc(fastestAnswer.ref, {
        processingStatus: 'processed'
      });
      
      // 他の保留中の解答もキャンセル（個別処理）
      for (const docSnap of snapshot.docs.slice(1)) {
        try {
          await updateDoc(docSnap.ref, { processingStatus: 'processed' });
        } catch (updateError) {
          console.error(`解答 ${docSnap.id} の更新に失敗しました:`, updateError);
        }
      }
      
      console.log(`解答処理完了: 1件処理済み、${snapshot.docs.length - 1}件キャンセル`);
    } catch (updateError: any) {
      console.error('解答の更新に失敗しました:', updateError);
      if (updateError?.code === 'permission-denied') {
        console.error('権限エラー: 解答の更新が拒否されました');
        return;
      }
    }
  }

  // 正解フラグの監視
  static watchForCorrectAnswer(
    roomId: string,
    isLeader: boolean,
    moveToNextQuestion: () => Promise<void>
  ) {
    if (!isLeader || !roomId) return () => {};
    
    console.log('正解フラグの監視を開始します');
    const roomRef = doc(db, 'quiz_rooms', roomId);
    
    return onSnapshot(roomRef, async (docSnap: any) => {
      if (!docSnap.exists()) return;
      
      const roomData = docSnap.data() as QuizRoom;
      
      // readyForNextQuestionフラグが立っていて、正解状態であれば次の問題に進む
      if (roomData.readyForNextQuestion === true && 
          roomData.currentState?.answerStatus === 'correct' && 
          roomData.status === 'in_progress') {
        
        console.log(`正解フラグが検知されました。${TIMING.NEXT_QUESTION_DELAY/1000}秒後に次の問題に進みます`);
        
        try {
          // フラグをリセット
          await updateDoc(roomRef, { readyForNextQuestion: false });
          
          // 設定された遅延時間後に次の問題へ
          setTimeout(() => {
            moveToNextQuestion();
          }, TIMING.NEXT_QUESTION_DELAY);
        } catch (error) {
          console.error('正解フラグ処理中にエラーが発生しました:', error);
        }
      }
    });
  }
}
