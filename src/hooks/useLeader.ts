'use client';

import { useCallback, useEffect } from 'react';
import { db } from '@/config/firebase';
import { TIMING, SCORING, getQuestionTimeout } from '@/config/quizConfig';
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
  //deleteField,
  limit
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
    if (!quizRoom) {
      console.log('クイズルームが設定されていません');
      return;
    }
    
    try {
      // quizIdsがundefinedの可能性を考慮
      const quizIds = quizRoom.quizIds || [];
      const currentQuizId = quizIds[quizRoom.currentQuizIndex];
      
      if (!currentQuizId) {
        console.log('クイズIDが見つかりません');
        return;
      }
      
      // 新しいデータベース構造に合わせてクイズを取得
      if (!quizRoom.genre || !quizRoom.unitId) {
        console.error('Quiz room is missing genre or unitId');
        // 緊急回避策：ダミーのクイズを設定
        setCurrentQuiz({
          quizId: 'error_dummy',
          title: 'エラー: クイズデータが不完全です',
          question: 'ルーム設定が不完全なため、このクイズに回答することはできません。',
          type: 'multiple_choice',
          genre: '',
          choices: ['エラー', 'エラー', 'エラー', 'エラー'],
          correctAnswer: 'エラー',
          acceptableAnswers: [],
          explanation: 'ルーム設定が不完全です',
          createdBy: '',
          createdAt: null as any,
          useCount: 0,
          correctCount: 0
        });
        return;
      }
      
      try {
        // クイズタイプによってコレクションを決定
        const isOfficial = quizRoom.quizType === 'official';
        
        console.log(`[useLeader] クイズ取得: genre=${quizRoom.genre}, unitId=${quizRoom.unitId}, quizId=${currentQuizId}, isOfficial=${isOfficial}`);
        
        // 公式クイズかユーザー作成クイズかに応じてパスを構築
        let quizRef;
        if (isOfficial) {
          // 公式クイズの場合: genres/genre/official_quiz_units/unit/quizzes/quizId
          quizRef = doc(db, 'genres', quizRoom.genre, 'official_quiz_units', quizRoom.unitId, 'quizzes', currentQuizId);
          console.log(`[useLeader] 公式クイズパス: genres/${quizRoom.genre}/official_quiz_units/${quizRoom.unitId}/quizzes/${currentQuizId}`);
        } else {
          // ユーザー作成クイズの場合: genres/genre/quiz_units/unit/quizzes/quizId
          quizRef = doc(db, 'genres', quizRoom.genre, 'quiz_units', quizRoom.unitId, 'quizzes', currentQuizId);
          console.log(`[useLeader] ユーザークイズパス: genres/${quizRoom.genre}/quiz_units/${quizRoom.unitId}/quizzes/${currentQuizId}`);
        }
        
        const quizSnap = await getDoc(quizRef);
        
        if (quizSnap.exists()) {
          const quizData = quizSnap.data() as Quiz;
          setCurrentQuiz({ ...quizData, quizId: quizSnap.id });
          console.log(`[useLeader] クイズ取得成功: ${quizSnap.id}`);
          // 新しい問題が表示されたら選択肢を非表示に戻す
          setShowChoices(false);
          
          try {
            // クイズの使用回数を更新
            await updateDoc(quizRef, {
              useCount: increment(1)
            });
            
            // ジャンルと単元の統計も更新
            if (quizData.genre) {
              await updateGenreStats(quizData.genre, quizRoom.unitId);
            }
          } catch (statsError) {
            console.warn('統計更新中にエラーが発生しましたが、クイズは継続します:', statsError);
            // 統計更新エラーは無視して進行
          }
          
          try {
            // ルームの現在のクイズ状態を更新
            await updateDoc(doc(db, 'quiz_rooms', roomId), {
              'currentState.quizId': currentQuizId,
              'currentState.startTime': serverTimestamp(),
              'currentState.endTime': null,
              'currentState.currentAnswerer': null,
              'currentState.answerStatus': 'waiting',
              'currentState.isRevealed': false
            });
          } catch (roomError: any) {
            console.error('ルーム状態の更新中にエラーが発生しました:', roomError);
            
            if (roomError?.code === 'permission-denied') {
              console.error('権限エラー: ルーム状態の更新が拒否されました');
              
              // リーダーのセッションがまだ有効かを確認
              if (currentUser && quizRoom.roomLeaderId === currentUser.uid) {
                // 完了状態に設定を試みる
                try {
                  await updateDoc(doc(db, 'quiz_rooms', roomId), {
                    status: 'completed',
                    updatedAt: serverTimestamp()
                  });
                  console.log('エラーによりルームを完了状態に強制移行しました');
                } catch (forceCompleteError) {
                  console.error('ルームの強制完了に失敗しました:', forceCompleteError);
                }
              }
            }
          }
        } else {
          const pathInfo = isOfficial 
            ? `genres/${quizRoom.genre}/official_quiz_units/${quizRoom.unitId}/quizzes/${currentQuizId}`
            : `genres/${quizRoom.genre}/quiz_units/${quizRoom.unitId}/quizzes/${currentQuizId}`;
          
          console.error(`[useLeader] クイズが見つかりません: ${currentQuizId}, パス: ${pathInfo}`);
          
          // エラー時刻を記録（リダイレクトループ防止用）
          if (typeof window !== 'undefined') {
            window.quizErrorTimestamp = Date.now();
          }
          
          throw new Error('クイズが見つかりません');
        }
      } catch (fetchError: any) {
        console.error('[useLeader] Error fetching quiz:', fetchError);
        
        if (fetchError?.code === 'permission-denied') {
          console.error('権限エラー: クイズデータへのアクセスが拒否されました');
          
          // 緊急対応策として、現在のクイズ情報を仮設定
          setCurrentQuiz({
            quizId: currentQuizId,
            title: "問題の読み込みに失敗しました",
            question: "権限エラーにより問題を取得できませんでした。ルームからいったん退出して再度参加してください。",
            type: "multiple_choice",
            choices: ["選択肢1", "選択肢2", "選択肢3", "選択肢4"],
            correctAnswer: "選択肢1",
            acceptableAnswers: [],
            explanation: "システムエラーが発生しました",
            createdBy: "",
            createdAt: null as any,
            useCount: 0,
            correctCount: 0
          });
        }
      }
    } catch (error) {
      console.error('Error in fetchCurrentQuiz:', error);
    }
  }, [quizRoom, isLeader, roomId, setCurrentQuiz, updateGenreStats, setShowChoices, currentUser]);

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

  // 問題のタイマーを開始（ジャンル別制限時間）
  const startQuestionTimer = useCallback(() => {
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
          
          // 時間切れであることを記録
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
  }, [isLeader, quizRoom, roomId, moveToNextQuestion]);

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
          const cancelBatch = writeBatch(db);
          snapshot.docs.forEach(doc => {
            cancelBatch.update(doc.ref, { processingStatus: 'processed' });
          });
          await cancelBatch.commit();
          return;
        }
        
        try {
          // 解答権をDBに記録
          await updateDoc(roomRef, {
            'currentState.currentAnswerer': fastestUserId,
            'currentState.answerStatus': 'answering'
          });
          console.log(`解答権をユーザー ${fastestUserId} に付与しました`);
        } catch (roomUpdateError: any) {
          console.error('ルーム状態の更新に失敗しました:', roomUpdateError);
          if (roomUpdateError?.code === 'permission-denied') {
            console.error('権限エラー: ルーム状態の更新が拒否されました');
            return; // 以降の処理をスキップ
          }
        }
        
        try {
          // 処理済みとしてマーク
          await updateDoc(fastestAnswer.ref, {
            processingStatus: 'processed'
          });
        } catch (answerUpdateError: any) {
          console.error('解答状態の更新に失敗しました:', answerUpdateError);
          if (answerUpdateError?.code === 'permission-denied') {
            console.error('権限エラー: 解答状態の更新が拒否されました');
          }
        }
        
        // 他の保留中の回答をキャンセル
        if (snapshot.docs.length > 1) {
          try {
            const batch = writeBatch(db);
            snapshot.docs.slice(1).forEach(doc => {
              batch.update(doc.ref, { processingStatus: 'processed' });
            });
            await batch.commit();
            console.log(`${snapshot.docs.length - 1}件の他の解答をキャンセルしました`);
          } catch (batchError: any) {
            console.error('他の解答のキャンセルに失敗しました:', batchError);
            if (batchError?.code === 'permission-denied') {
              console.error('権限エラー: 解答のバッチ処理が拒否されました');
              
              // 個別更新を試みる
              snapshot.docs.slice(1).forEach(async (doc) => {
                try {
                  await updateDoc(doc.ref, { processingStatus: 'processed' });
                } catch (individualError) {
                  console.error(`解答 ${doc.id} の更新に失敗しました:`, individualError);
                }
              });
            }
          }
        }
      } catch (error) {
        console.error('早押し処理中にエラーが発生しました:', error);
      }
    }, (error) => {
      console.error('早押し監視のリスナーでエラーが発生しました:', error);
    });
  }, [isLeader, roomId]);

  // 解答判定
  const judgeAnswer = useCallback(async (answerId: string) => {
    if (!isLeader || !quizRoom || !currentQuiz) return;
    
    try {
      // 解答データを取得
      const answerRef = doc(db, 'quiz_rooms', roomId, 'answers', answerId);
      
      try {
        const answerSnap = await getDoc(answerRef);
        
        if (!answerSnap.exists()) {
          console.log(`解答データ ${answerId} が見つかりません`);
          return;
        }
        
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
        
        // バッチ処理を使わず、個別に更新して権限エラーを回避
        try {
          // 解答結果の更新
          await updateDoc(answerRef, { isCorrect });
          console.log(`解答結果を更新しました: ${isCorrect ? '正解' : '不正解'}`);
        } catch (answerError: any) {
          console.error('解答結果の更新に失敗しました:', answerError);
          if (answerError?.code === 'permission-denied') {
            console.error('権限エラー: 解答データの更新が拒否されました');
          }
        }
        
        try {
          // ルーム状態の更新
          await updateDoc(doc(db, 'quiz_rooms', roomId), {
            'currentState.answerStatus': isCorrect ? 'correct' : 'incorrect',
            'currentState.isRevealed': true,
            [`participants.${userId}.score`]: increment(isCorrect ? 10 : 0)
          });
          console.log('ルーム状態を更新しました');
        } catch (roomError: any) {
          console.error('ルーム状態の更新に失敗しました:', roomError);
          if (roomError?.code === 'permission-denied') {
            console.error('権限エラー: ルーム状態の更新が拒否されました');
          }
        }
        
        try {
          // クイズ統計の更新（新しいデータベース構造に合わせて修正）
          if (currentQuiz.genre && quizRoom.unitId) {
            const isOfficial = quizRoom.quizType === 'official';
            let statsRef;
            
            if (isOfficial) {
              // 公式クイズの統計更新
              statsRef = doc(db, 'genres', currentQuiz.genre, 'official_quiz_units', quizRoom.unitId, 'quizzes', currentQuiz.quizId);
            } else {
              // ユーザー作成クイズの統計更新
              statsRef = doc(db, 'genres', currentQuiz.genre, 'quiz_units', quizRoom.unitId, 'quizzes', currentQuiz.quizId);
            }
            
            await updateDoc(statsRef, {
              useCount: increment(1),
              correctCount: increment(isCorrect ? 1 : 0)
            });
            console.log('クイズ統計を更新しました');
          }
        } catch (statsError: any) {
          console.warn('クイズ統計の更新に失敗しましたが、ゲームは継続します:', statsError);
          if (statsError?.code === 'permission-denied') {
            console.warn('権限エラー: クイズ統計の更新が拒否されました');
          }
        }
        
        // 正解の場合は次の問題に進む、不正解の場合は自動進行チェック
        if (isCorrect) {
          // 設定された時間待ってから次の問題に進む
          setTimeout(() => {
            moveToNextQuestion();
          }, TIMING.NEXT_QUESTION_DELAY);
        } else {
          // 不正解の場合は自動進行処理を実行
          await handleIncorrectAnswer();
        }
      } catch (getAnswerError: any) {
        console.error('解答データの取得に失敗しました:', getAnswerError);
        
        if (getAnswerError?.code === 'permission-denied') {
          console.error('権限エラー: 解答データへのアクセスが拒否されました');
          
          // 緊急対応策：ルームを次の問題に進める
          try {
            // まずルーム状態を更新
            await updateDoc(doc(db, 'quiz_rooms', roomId), {
              'currentState.answerStatus': 'incorrect',  // デフォルトで不正解にする
              'currentState.isRevealed': true
            });
            
            // 設定された時間待ってから次の問題に進む
            setTimeout(() => {
              moveToNextQuestion();
            }, TIMING.NEXT_QUESTION_DELAY);
            
            console.log(`緊急リカバリー: ${TIMING.NEXT_QUESTION_DELAY/1000}秒後に次の問題に進みます`);
          } catch (recoveryError) {
            console.error('緊急リカバリーに失敗しました:', recoveryError);
          }
        }
      }
    } catch (error) {
      console.error('Error judging answer:', error);
      // 何らかのエラーがあった場合も、タイムアウトで次の問題に進む
      setTimeout(() => {
        moveToNextQuestion();
      }, TIMING.NEXT_QUESTION_DELAY);
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
      
      try {
        await batch.commit();
        console.log('ユーザー統計情報をバッチ処理で更新しました');
        
        // 統計更新済みのフラグをルームに設定（重複更新防止）
        // 重要なフラグなので、エラー発生時は複数回試行
        const setStatsFlag = async (retryCount = 0) => {
          try {
            const roomRef = doc(db, 'quiz_rooms', roomId);
            await updateDoc(roomRef, {
              statsUpdated: true
            });
            console.log('統計更新フラグを設定しました');
          } catch (flagError) {
            console.error(`統計更新フラグの設定に失敗しました (試行: ${retryCount + 1}/3):`, flagError);
            
            // 最大3回まで再試行
            if (retryCount < 2) {
              console.log(`統計更新フラグの設定を ${retryCount + 1} 秒後に再試行します...`);
              setTimeout(() => setStatsFlag(retryCount + 1), (retryCount + 1) * 1000);
            } else {
              console.error('統計更新フラグの設定に失敗しましたが、処理を続行します');
            }
          }
        };
        
        // 統計更新フラグの設定を開始
        setStatsFlag();
      } catch (statsError) {
        console.error('統計情報の更新に失敗しました:', statsError);
        // 統計更新の失敗は無視して処理を続行
        
        // それでも統計更新フラグは設定を試みる（重要なため）
        try {
          const roomRef = doc(db, 'quiz_rooms', roomId);
          await updateDoc(roomRef, { statsUpdated: true });
          console.log('バッチ処理エラー後に統計更新フラグを設定しました');
        } catch (flagError) {
          console.error('バッチエラー後の統計更新フラグの設定に失敗しました:', flagError);
        }
      }
      
      console.log(`Quiz room ${roomId} completed - scheduling deletion in 10 seconds`);
      
      // 10秒後にルームを削除（結果表示と統計更新の時間確保）
      setTimeout(async () => {
        try {
          // まず、各参加者のcurrentRoomIdをnullに設定して参照を解除
          const participantUpdates = Object.keys(quizRoom.participants).map(async (userId) => {
            try {
              await updateDoc(doc(db, 'users', userId), { currentRoomId: null });
              console.log(`User ${userId} room reference cleared`);
            } catch (userErr) {
              console.warn(`Failed to clear room reference for user ${userId}:`, userErr);
              // 個別ユーザーのエラーは無視して続行
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
            
            // まず回答数を確認（小さなバッチで取得）
            const countQuery = query(answersRef, limit(50));
            const countSnap = await getDocs(countQuery);
            
            if (!countSnap.empty) {
              console.log(`Deleting answers from room ${roomId}`);
              
              // 一度に少数の回答だけを削除する
              for (const doc of countSnap.docs) {
                try {
                  await deleteDoc(doc.ref);
                } catch (deleteAnswerError) {
                  console.warn(`Failed to delete answer ${doc.id}:`, deleteAnswerError);
                  // 個別の回答削除エラーは無視
                }
              }
            }
          } catch (answersError) {
            console.warn('Failed to cleanup answers, continuing with room deletion:', answersError);
            // 回答のクリーンアップエラーは無視して続行
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
      }, 10000); // 10秒後に削除（前の修正と合わせる）
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
  }, [isLeader, quizRoom, roomId]);

  // 正解フラグの監視
  const watchForCorrectAnswer = useCallback(() => {
    if (!isLeader || !roomId) return () => {};
    
    console.log('正解フラグの監視を開始します');
    const roomRef = doc(db, 'quiz_rooms', roomId);
    
    return onSnapshot(roomRef, async (docSnap) => {
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
  }, [isLeader, roomId, moveToNextQuestion]);

  // リーダー監視の設定
  useEffect(() => {
    if (!isLeader || !roomId) return;
    
    const unsubscribeBuzzer = handleBuzzerUpdates();
    const unsubscribeCorrect = watchForCorrectAnswer();
    
    return () => {
      unsubscribeBuzzer();
      unsubscribeCorrect();
    };
  }, [isLeader, roomId, handleBuzzerUpdates, watchForCorrectAnswer]);

  // ユーザーが早押しボタンを押した時
  const handleBuzzer = useCallback(async () => {
    if (!currentUser || !quizRoom || !currentQuiz) {
      console.log('早押し処理に必要な情報が不足しています');
      return;
    }
    
    try {
      // 既に誰かが解答中の場合は早押しできない
      if (quizRoom.currentState.currentAnswerer) {
        console.log('既に別のユーザーが解答権を持っています');
        return;
      }
      
      // 選択肢を表示する - UIの応答性向上のため先に実行
      setShowChoices(true);
      
      // トランザクションエラーを防ぐため、先に現在の状態をチェック
      const roomRef = doc(db, 'quiz_rooms', roomId);
      
      try {
        const roomSnap = await getDoc(roomRef);
        
        if (!roomSnap.exists()) {
          console.log('ルームが存在しないため早押しできません');
          return;
        }
        
        const roomData = roomSnap.data();
        
        if (roomData.status !== 'in_progress') {
          console.log('ルームが進行中でないため早押しできません: ' + roomData.status);
          return;
        }
        
        // 現在解答権を持っている人がいないことを再確認
        if (roomData.currentState?.currentAnswerer) {
          console.log('既に別のユーザーが解答権を持っています: ' + roomData.currentState.currentAnswerer);
          return;
        }
        
        // 解答権を取得する処理
        try {
          // ルームの状態を更新（解答権を取得）
          await updateDoc(roomRef, {
            'currentState.currentAnswerer': currentUser.uid,
            'currentState.answerStatus': 'answering'
          });
          
          console.log(`ユーザー ${currentUser.uid} が解答権を取得しました`);
          
          // 早押し情報をDBに記録
          try {
            // 参加者に必要なフィールドが存在するか確認
            if (!quizRoom.participants[currentUser.uid].hasOwnProperty('missCount')) {
              // missCountフィールドが存在しない場合は初期化
              await updateDoc(roomRef, {
                [`participants.${currentUser.uid}.missCount`]: 0
              });
            }
            
            await addDoc(collection(db, 'quiz_rooms', roomId, 'answers'), {
              userId: currentUser.uid,
              quizId: currentQuiz.quizId,
              clickTime: serverTimestamp(),
              answerTime: 0, // クライアント側で計測した時間を入れることも可能
              answer: '',
              isCorrect: false,
              processingStatus: 'pending'
            });
            
            console.log('早押し情報を記録しました');
          } catch (answerErr: any) {
            console.error('早押し情報の記録に失敗しました:', answerErr);
            
            // 権限エラーの場合は特別なハンドリング
            if (answerErr?.code === 'permission-denied') {
              console.error('権限エラー: 早押し情報の記録が拒否されました');
              // 解答権の更新は成功しているので問題ない
            }
          }
        } catch (updateErr: any) {
          console.error('解答権の取得に失敗しました:', updateErr);
          
          if (updateErr?.code === 'permission-denied') {
            console.error('権限エラー: 解答権の取得が拒否されました');
            // ユーザーに通知
            alert('権限エラーが発生しました。ページを再読み込みしてください。');
          }
        }
      } catch (roomErr) {
        console.error('ルーム情報の取得中にエラーが発生しました:', roomErr);
      }
    } catch (error) {
      console.error('Error handling buzzer:', error);
    }
  }, [currentUser, quizRoom, currentQuiz, roomId, setShowChoices]);

  // 解答を提出
  const submitAnswer = useCallback(async (answer: string) => {
    if (!currentUser || !quizRoom || !currentQuiz) {
      console.log('解答処理に必要な情報が不足しています');
      return;
    }
    
    try {
      // 解答権があるか確認
      if (quizRoom.currentState.currentAnswerer !== currentUser.uid) {
        console.log('解答権がありません');
        return;
      }
      
      // 正解かどうかを判定
      const isCorrect = judgeCorrectness(currentQuiz, answer);
      console.log(`解答 "${answer}" は ${isCorrect ? '正解' : '不正解'} です`);
      
      // トランザクションエラーを防ぐため、先に現在の状態をチェック
      const roomRef = doc(db, 'quiz_rooms', roomId);
      
      try {
        const roomSnap = await getDoc(roomRef);
        
        if (!roomSnap.exists()) {
          console.log('ルームが存在しないため解答できません');
          return;
        }
        
        const roomData = roomSnap.data();
        
        if (roomData.status !== 'in_progress') {
          console.log('ルームが進行中でないため解答できません: ' + roomData.status);
          return;
        }
        
        // 解答権を持っていることを再確認
        if (roomData.currentState?.currentAnswerer !== currentUser.uid) {
          console.log('解答権が既に失効しています');
          return;
        }
        
        // 解答情報を取得
        try {
          const answersRef = collection(db, 'quiz_rooms', roomId, 'answers');
          const answerQuery = query(
            answersRef,
            where('userId', '==', currentUser.uid),
            where('quizId', '==', currentQuiz.quizId),
            orderBy('clickTime', 'desc'),
            limit(1)  // 最新のものだけを取得
          );
          
          const answerSnap = await getDocs(answerQuery);
          
          if (answerSnap.empty) {
            console.log('解答データが見つかりません。新しく記録します。');
            
            // 解答データが見つからない場合は新規作成
            try {
              await addDoc(collection(db, 'quiz_rooms', roomId, 'answers'), {
                userId: currentUser.uid,
                quizId: currentQuiz.quizId,
                clickTime: serverTimestamp(),
                answerTime: 0,
                answer: answer,
                isCorrect: isCorrect,
                processingStatus: 'processed'
              });
              
              console.log('新しい解答データを記録しました');
            } catch (createErr: any) {
              console.error('解答データの作成に失敗しました:', createErr);
              
              if (createErr?.code === 'permission-denied') {
                console.error('権限エラー: 解答データの作成が拒否されました');
              }
            }
          } else {
            // 既存の解答を更新
            const answerDoc = answerSnap.docs[0];
            const answerRef = doc(db, 'quiz_rooms', roomId, 'answers', answerDoc.id);
            
            try {
              await updateDoc(answerRef, {
                answer: answer,
                isCorrect: isCorrect,
                processingStatus: 'processed'
              });
              
              console.log('解答データを更新しました');
            } catch (updateErr: any) {
              console.error('解答データの更新に失敗しました:', updateErr);
              
              if (updateErr?.code === 'permission-denied') {
                console.error('権限エラー: 解答データの更新が拒否されました');
              }
            }
          }
          
          // ルームの状態を更新して正誤判定を表示
          try {
            const updateData: any = {
              'currentState.answerStatus': isCorrect ? 'correct' : 'incorrect',
              'currentState.isRevealed': true,
              [`participants.${currentUser.uid}.score`]: increment(isCorrect ? 10 : 0)
            };
            
            // 不正解の場合は、解答権をリセットして他の人が回答できるようにする
            if (!isCorrect) {
              updateData['currentState.currentAnswerer'] = null;
              // お手つきカウントを増やす
              updateData[`participants.${currentUser.uid}.missCount`] = increment(1);
              
              // 間違えた問題IDを追加する
              if (currentQuiz.quizId) {
                // wrongQuizIdsが存在するか確認
                const userSnapshot = await getDoc(doc(db, 'quiz_rooms', roomId));
                if (userSnapshot.exists()) {
                  const userData = userSnapshot.data();
                  const currentWrongQuizIds = userData.participants[currentUser.uid]?.wrongQuizIds || [];
                  
                  // 同じ問題IDを追加しないように新しい配列を作成
                  if (!currentWrongQuizIds.includes(currentQuiz.quizId)) {
                    updateData[`participants.${currentUser.uid}.wrongQuizIds`] = [
                      ...currentWrongQuizIds,
                      currentQuiz.quizId
                    ];
                  }
                } else {
                  updateData[`participants.${currentUser.uid}.wrongQuizIds`] = [currentQuiz.quizId];
                }
              }
              
              // 不正解後の自動進行判定をスケジュール
              if (isLeader) {
                console.log('不正解のため、自動進行判定を5秒後に実行します');
                setTimeout(async () => {
                  try {
                    const latestRoomSnap = await getDoc(roomRef);
                    if (latestRoomSnap.exists()) {
                      const latestRoomData = latestRoomSnap.data() as QuizRoom;
                      // まだ同じ問題で正解者がいない場合
                      if (latestRoomData.currentQuizIndex === quizRoom.currentQuizIndex && 
                          latestRoomData.currentState.answerStatus !== 'correct') {
                        await checkAndProgressGame();
                      }
                    }
                  } catch (error) {
                    console.error('不正解後の自動進行判定でエラー:', error);
                  }
                }, 5000);
              }
            } else {
              // 正解の場合、次の問題に進むためのフラグを設定
              updateData['readyForNextQuestion'] = true;
              updateData['lastCorrectTimestamp'] = serverTimestamp();
            }
            
            await updateDoc(roomRef, updateData);
            
            console.log(`ルーム状態を更新しました - 解答は${isCorrect ? '正解' : '不正解'}です`);
            
            // 正解の場合のみ、リーダーなら待ち時間後に次の問題に進む
            if (isCorrect && isLeader) {
              console.log(`正解が確認されました。${TIMING.NEXT_QUESTION_DELAY/1000}秒後に次の問題に進みます`);
              setTimeout(() => {
                moveToNextQuestion();
              }, TIMING.NEXT_QUESTION_DELAY);
            }
          } catch (roomUpdateErr: any) {
            console.error('ルーム状態の更新に失敗しました:', roomUpdateErr);
            
            if (roomUpdateErr?.code === 'permission-denied') {
              console.error('権限エラー: ルーム状態の更新が拒否されました');
              
              // 緊急回復策: 自分がリーダーなら強制的に次の問題に進む
              if (isLeader && isCorrect) {
                console.log(`緊急回復策を実行します: ${TIMING.NEXT_QUESTION_DELAY/1000}秒後に次の問題に進みます`);
                setTimeout(() => {
                  moveToNextQuestion();
                }, TIMING.NEXT_QUESTION_DELAY);
              } else {
                console.log('リーダーではないか不正解のため、次の問題に進むことはできません');
              }
            }
          }
        } catch (queryError: any) {
          console.error('解答データの取得に失敗しました:', queryError);
          
          if (queryError?.code === 'permission-denied') {
            console.error('権限エラー: 解答データの取得が拒否されました');
            
            // 緊急対応策：ルームのリーダーの場合のみ、ルームの状態を直接更新
            if (isLeader && currentUser.uid === quizRoom.roomLeaderId) {
              try {
                // ルームを強制的に更新
                await updateDoc(roomRef, {
                  'currentState.answerStatus': isCorrect ? 'correct' : 'incorrect',
                  'currentState.isRevealed': true
                });
                
                // 数秒後に次の問題に進む
                setTimeout(() => {
                  moveToNextQuestion();
                }, 3000);
                
                console.log('緊急リカバリー: ルームを次の問題に進める準備をしました');
              } catch (recoveryError) {
                console.error('緊急リカバリーに失敗しました:', recoveryError);
              }
            }
          }
        }
      } catch (error) {
        console.error('Error in roomRef processing:', error);
      }
    } catch (error) {
      console.error('Error submitting answer:', error);
    }
  }, [currentUser, quizRoom, currentQuiz, roomId, isLeader, moveToNextQuestion]);

  // 不正解時の自動進行処理
  const handleIncorrectAnswer = useCallback(async () => {
    if (!isLeader || !quizRoom) return;
    
    try {
      console.log('不正解時の自動進行処理を開始します');
      
      // シングルプレイヤーの場合は即座に次の問題へ
      if (Object.keys(quizRoom.participants).length === 1) {
        console.log('シングルプレイヤー: 次の問題に進みます');
        setTimeout(() => {
          moveToNextQuestion();
        }, TIMING.NEXT_QUESTION_DELAY);
        return;
      }
      
      // マルチプレイヤーの場合は全員の解答状況をチェック
      await checkAndProgressGame();
      
    } catch (error) {
      console.error('不正解時の自動進行処理でエラーが発生しました:', error);
    }
  }, [isLeader, quizRoom, moveToNextQuestion]);

  // ゲーム進行状況をチェックして自動進行を決定
  const checkAndProgressGame = useCallback(async () => {
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
      
      // 全員が解答し、全員不正解の場合
      if (answeredCount >= totalParticipants) {
        console.log('全員が解答し、全員不正解です。次の問題に進みます');
        
        // ルーム状態を更新
        await updateDoc(roomRef, {
          'currentState.answerStatus': 'all_incorrect',
          'currentState.isRevealed': true
        });
        
        // 一定時間後に次の問題へ
        setTimeout(() => {
          moveToNextQuestion();
        }, TIMING.NEXT_QUESTION_DELAY);
      }
      
    } catch (error) {
      console.error('ゲーム進行チェックでエラーが発生しました:', error);
    }
  }, [isLeader, quizRoom, roomId, moveToNextQuestion]);

  return {
    startQuizGame,
    moveToNextQuestion,
    startQuestionTimer,
    handleBuzzer,
    submitAnswer,
    judgeAnswer,
    handleIncorrectAnswer,
    checkAndProgressGame
  };
}

// 回答の正規化（小文字化、空白除去など）
function normalizeAnswer(answer: string): string {
  return answer.toLowerCase().replace(/\s+/g, '');
}

// 正誤判定ヘルパー関数
function judgeCorrectness(quizData: Quiz, userAnswer: string): boolean {
  if (quizData.type === 'multiple_choice') {
    return userAnswer === quizData.correctAnswer;
  } else {
    // 入力式の場合、許容回答リストと照合
    const normalizedUserAnswer = normalizeAnswer(userAnswer);
    return [quizData.correctAnswer, ...(quizData.acceptableAnswers || [])]
      .map(normalizeAnswer)
      .some(answer => answer === normalizedUserAnswer);
  }
}
