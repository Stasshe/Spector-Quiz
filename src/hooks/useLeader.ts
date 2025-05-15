'use client';

import { useCallback, useEffect } from 'react';
import { db } from '@/config/firebase';
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs,
  query, 
  where, 
  orderBy, 
  updateDoc, 
  addDoc,
  deleteDoc,
  onSnapshot,
  writeBatch,
  serverTimestamp,
  increment,
  deleteField
} from 'firebase/firestore';
import { QuizRoom } from '@/types/room';
import { Quiz } from '@/types/quiz';
import { useQuiz } from '@/context/QuizContext';
import { useAuth } from '@/context/AuthContext';
import { useQuizHook } from '@/hooks/useQuiz';

export function useLeader(roomId: string) {
  const { isLeader, quizRoom, currentQuiz, setCurrentQuiz, setShowChoices } = useQuiz();
  const { currentUser } = useAuth();
  const { updateGenreStats } = useQuizHook();

  // 現在の問題を取得してセット
  const fetchCurrentQuiz = useCallback(async () => {
    if (!quizRoom || !isLeader) return;
    
    try {
      // quizIdsがundefinedの可能性を考慮
      const quizIds = quizRoom.quizIds || [];
      const currentQuizId = quizIds[quizRoom.currentQuizIndex];
      
      if (!currentQuizId) return;
      
      // 新しいデータベース構造に合わせてクイズを取得
      if (!quizRoom.genre || !quizRoom.unitId) {
        console.error('Quiz room is missing genre or unitId');
        return;
      }
      
      const quizRef = doc(db, 'genres', quizRoom.genre, 'quiz_units', quizRoom.unitId, 'quizzes', currentQuizId);
      const quizSnap = await getDoc(quizRef);
      
      if (quizSnap.exists()) {
        const quizData = quizSnap.data() as Quiz;
        setCurrentQuiz({ ...quizData, quizId: quizSnap.id });
        // 新しい問題が表示されたら選択肢を非表示に戻す
        setShowChoices(false);
        
        // クイズの使用回数を更新
        await updateDoc(quizRef, {
          useCount: increment(1)
        });
        
        // ジャンルと単元の統計も更新
        if (quizData.genre) {
          await updateGenreStats(quizData.genre, quizRoom.unitId);
        }
        
        // ルームの現在のクイズ状態を更新
        await updateDoc(doc(db, 'quiz_rooms', roomId), {
          'currentState.quizId': currentQuizId,
          'currentState.startTime': serverTimestamp(),
          'currentState.endTime': null,
          'currentState.currentAnswerer': null,
          'currentState.answerStatus': 'waiting',
          'currentState.isRevealed': false
        });
      }
    } catch (error) {
      console.error('Error fetching current quiz:', error);
    }
  }, [quizRoom, isLeader, roomId, setCurrentQuiz, updateGenreStats, setShowChoices]);

  // クイズゲームを開始する
  const startQuizGame = useCallback(async () => {
    if (!isLeader || !quizRoom) return;
    
    try {
      // ルームのステータスを更新
      await updateDoc(doc(db, 'quiz_rooms', roomId), {
        status: 'in_progress',
        startedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      // 最初の問題を取得
      await fetchCurrentQuiz();
    } catch (error) {
      console.error('Error starting quiz game:', error);
    }
  }, [isLeader, quizRoom, roomId, fetchCurrentQuiz]);

  // 次の問題に進む
  const moveToNextQuestion = useCallback(async () => {
    if (!isLeader || !quizRoom) return;
    
    try {
      const nextIndex = quizRoom.currentQuizIndex + 1;
      // quizIdsがundefinedの可能性を考慮
      const quizIds = quizRoom.quizIds || [];
      
      if (nextIndex >= quizIds.length) {
        // 全問題が終了した場合
        await updateDoc(doc(db, 'quiz_rooms', roomId), {
          status: 'completed',
          updatedAt: serverTimestamp()
        });
        
        // 経験値付与など終了処理
        await finishQuizGame();
        return;
      }
      
      // 次の問題インデックスに更新
      await updateDoc(doc(db, 'quiz_rooms', roomId), {
        currentQuizIndex: nextIndex,
        updatedAt: serverTimestamp()
      });
      
      // 次の問題を取得
      await fetchCurrentQuiz();
    } catch (error) {
      console.error('Error moving to next question:', error);
    }
  }, [isLeader, quizRoom, roomId, fetchCurrentQuiz]);

  // 早押し監視
  const handleBuzzerUpdates = useCallback(() => {
    if (!isLeader || !roomId) return () => {};
    
    const answersRef = collection(db, 'quiz_rooms', roomId, 'answers');
    const pendingAnswersQuery = query(
      answersRef,
      where('processingStatus', '==', 'pending'),
      orderBy('clickTime', 'asc')
    );
    
    return onSnapshot(pendingAnswersQuery, async (snapshot) => {
      if (snapshot.empty) return;
      
      // 最も早く押したユーザーを特定
      const fastestAnswer = snapshot.docs[0];
      const fastestUserId = fastestAnswer.data().userId;
      
      // 解答権をDBに記録
      await updateDoc(doc(db, 'quiz_rooms', roomId), {
        'currentState.currentAnswerer': fastestUserId,
        'currentState.answerStatus': 'answering'
      });
      
      // 処理済みとしてマーク
      await updateDoc(fastestAnswer.ref, {
        processingStatus: 'processed'
      });
      
      // 他の保留中の回答をキャンセル
      const batch = writeBatch(db);
      snapshot.docs.slice(1).forEach(doc => {
        batch.update(doc.ref, { processingStatus: 'processed' });
      });
      await batch.commit();
    });
  }, [isLeader, roomId]);

  // 解答判定
  const judgeAnswer = useCallback(async (answerId: string) => {
    if (!isLeader || !quizRoom || !currentQuiz) return;
    
    try {
      // 解答データを取得
      const answerRef = doc(db, 'quiz_rooms', roomId, 'answers', answerId);
      const answerSnap = await getDoc(answerRef);
      
      if (!answerSnap.exists()) return;
      
      const answerData = answerSnap.data();
      const userAnswer = answerData.answer;
      const userId = answerData.userId;
      
      // 解答の正誤判定
      let isCorrect = false;
      
      if (currentQuiz.type === 'multiple_choice') {
        isCorrect = userAnswer === currentQuiz.correctAnswer;
      } else {
        // 入力式の場合、許容回答リストと照合
        const normalizedUserAnswer = normalizeAnswer(userAnswer);
        isCorrect = [currentQuiz.correctAnswer, ...currentQuiz.acceptableAnswers]
          .map(normalizeAnswer)
          .some(answer => answer === normalizedUserAnswer);
      }
      
      // 結果をDBに記録
      const batch = writeBatch(db);
      
      // 解答結果の更新
      batch.update(answerRef, { isCorrect });
      
      // ルーム状態の更新
      batch.update(doc(db, 'quiz_rooms', roomId), {
        'currentState.answerStatus': isCorrect ? 'correct' : 'incorrect',
        'currentState.isRevealed': true,
        [`participants.${userId}.score`]: increment(isCorrect ? 10 : 0)
      });
      
      // クイズ統計の更新（新しいデータベース構造に合わせて修正）
      if (currentQuiz.genre && quizRoom.unitId) {
        batch.update(doc(db, 'genres', currentQuiz.genre, 'quiz_units', quizRoom.unitId, 'quizzes', currentQuiz.quizId), {
          useCount: increment(1),
          correctCount: increment(isCorrect ? 1 : 0)
        });
      }
      
      await batch.commit();
      
      // 数秒後に次の問題に進む
      setTimeout(() => {
        moveToNextQuestion();
      }, 5000);
    } catch (error) {
      console.error('Error judging answer:', error);
    }
  }, [isLeader, quizRoom, currentQuiz, roomId, moveToNextQuestion]);

  // クイズゲーム終了時の処理
  const finishQuizGame = useCallback(async () => {
    if (!isLeader || !quizRoom) return;
    
    try {
      // 参加者の経験値を更新
      const batch = writeBatch(db);
      
      // 参加者数を確認
      const participantCount = Object.keys(quizRoom.participants).length;
      // 一人プレイの場合は経験値を1/10に
      const soloMultiplier = participantCount === 1 ? 0.1 : 1;
      
      // 各参加者の処理
      Object.entries(quizRoom.participants).forEach(([userId, participant]) => {
        const userRef = doc(db, 'users', userId);
        
        // 獲得経験値の計算（例）
        let expGain = participant.score + 20; // スコア + セッション完了ボーナス
        
        // 一人プレイの場合は1/10に
        expGain = Math.round(expGain * soloMultiplier);
        
        batch.update(userRef, {
          exp: increment(expGain),
          'stats.totalAnswered': increment(quizRoom.totalQuizCount),
          [`stats.genres.${quizRoom.genre}.totalAnswered`]: increment(quizRoom.totalQuizCount)
        });
      });
      
      await batch.commit();
      
      // 30秒後にルームを削除（結果表示時間確保）
      setTimeout(async () => {
        try {
          // ルーム内の回答データを削除
          const answersRef = collection(db, 'quiz_rooms', roomId, 'answers');
          const answersSnap = await getDocs(answersRef);
          
          if (!answersSnap.empty) {
            console.log(`Deleting ${answersSnap.docs.length} answers from room ${roomId}`);
            const deleteBatch = writeBatch(db);
            
            // バッチサイズ制限（500）を考慮
            const chunks = [];
            for (let i = 0; i < answersSnap.docs.length; i += 400) {
              chunks.push(answersSnap.docs.slice(i, i + 400));
            }
            
            // チャンクごとに削除を実行
            for (const chunk of chunks) {
              const chunkBatch = writeBatch(db);
              chunk.forEach(doc => {
                chunkBatch.delete(doc.ref);
              });
              await chunkBatch.commit();
            }
            
            console.log(`Successfully deleted all answers from room ${roomId}`);
          }
          
          // ルーム自体を削除
          await deleteDoc(doc(db, 'quiz_rooms', roomId));
          console.log(`Successfully deleted room ${roomId}`);
          
        } catch (error) {
          console.error('Error deleting room:', error);
          // エラーがあってもクリーンアップを続ける
          try {
            // それでもルームは削除を試みる
            await deleteDoc(doc(db, 'quiz_rooms', roomId));
            console.log(`Attempted to delete room ${roomId} despite errors with answers`);
          } catch (roomError) {
            console.error('Error deleting room after answer deletion failed:', roomError);
          }
        }
      }, 30000);
    } catch (error) {
      console.error('Error finishing quiz game:', error);
    }
  }, [isLeader, quizRoom, roomId]);

  // リーダー監視の設定
  useEffect(() => {
    if (!isLeader || !roomId) return;
    
    const unsubscribe = handleBuzzerUpdates();
    
    return () => {
      unsubscribe();
    };
  }, [isLeader, roomId, handleBuzzerUpdates]);

  // ユーザーが早押しボタンを押した時
  const handleBuzzer = useCallback(async () => {
    if (!currentUser || !quizRoom || !currentQuiz) return;
    
    try {
      // 既に誰かが解答中の場合は早押しできない
      if (quizRoom.currentState.currentAnswerer) return;
      
      // 選択肢を表示する
      setShowChoices(true);
      
      // 早押し情報をDBに記録
      await addDoc(collection(db, 'quiz_rooms', roomId, 'answers'), {
        userId: currentUser.uid,
        quizId: currentQuiz.quizId,
        clickTime: serverTimestamp(),
        answerTime: 0, // クライアント側で計測した時間を入れることも可能
        answer: '',
        isCorrect: false,
        processingStatus: 'pending'
      });
    } catch (error) {
      console.error('Error handling buzzer:', error);
    }
  }, [currentUser, quizRoom, currentQuiz, roomId, setShowChoices]);

  // 解答を提出
  const submitAnswer = useCallback(async (answer: string) => {
    if (!currentUser || !quizRoom || !currentQuiz) return;
    
    try {
      // 解答権があるか確認
      if (quizRoom.currentState.currentAnswerer !== currentUser.uid) return;
      
      // 解答情報を取得
      const answersRef = collection(db, 'quiz_rooms', roomId, 'answers');
      const answerQuery = query(
        answersRef,
        where('userId', '==', currentUser.uid),
        where('quizId', '==', currentQuiz.quizId),
        orderBy('clickTime', 'desc')
      );
      
      const answerSnap = await getDocs(answerQuery);
      
      if (answerSnap.empty) return;
      
      // 最新の解答を取得
      const answerDoc = answerSnap.docs[0];
      
      // 解答を更新
      await updateDoc(answerDoc.ref, {
        answer,
        processingStatus: 'processed'
      });
      
      // リーダーの場合は判定も行う
      if (isLeader) {
        await judgeAnswer(answerDoc.id);
      }
    } catch (error) {
      console.error('Error submitting answer:', error);
    }
  }, [currentUser, quizRoom, currentQuiz, roomId, isLeader, judgeAnswer]);

  return {
    startQuizGame,
    moveToNextQuestion,
    handleBuzzer,
    submitAnswer,
    judgeAnswer
  };
}

// 回答の正規化（小文字化、空白除去など）
function normalizeAnswer(answer: string): string {
  return answer.toLowerCase().replace(/\s+/g, '');
}
