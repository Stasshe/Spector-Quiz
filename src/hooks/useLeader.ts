'use client';

import { db, usersDb } from '@/config/firebase';
import { SCORING, TIMING, getQuestionTimeout } from '@/config/quizConfig';
import { useAuth } from '@/context/AuthContext';
import { useQuiz } from '@/context/QuizContext';
import { updateAllQuizStats } from '@/services/quizRoom';
import { Quiz } from '@/types/quiz';
import { QuizRoom } from '@/types/room';
import {
  addDoc,
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
  serverTimestamp,
  updateDoc,
  where,
  writeBatch
} from 'firebase/firestore';
import { useCallback, useEffect } from 'react';
import { writeMonitor } from '../utils/firestoreWriteMonitor';

export function useLeader(roomId: string) {
  const { isLeader, quizRoom, currentQuiz, setCurrentQuiz, setShowChoices } = useQuiz();
  const { currentUser } = useAuth();

  // 現在の問題を取得してセット
  const fetchCurrentQuiz = useCallback(async (overrideIndex?: number) => {
    if (!quizRoom) {
      console.log('[fetchCurrentQuiz] クイズルームが設定されていません');
      return;
    }
    
    // インデックスが指定された場合はそれを使用、そうでなければquizRoomから取得
    const currentQuizIndex = overrideIndex !== undefined ? overrideIndex : quizRoom.currentQuizIndex;
    console.log(`[fetchCurrentQuiz] 実行開始: roomId=${roomId}, currentQuizIndex=${currentQuizIndex} (override: ${overrideIndex})`);
    
    try {
      // quizIdsがundefinedの可能性を考慮
      const quizIds = quizRoom.quizIds || [];
      const currentQuizId = quizIds[currentQuizIndex];
      
      console.log(`[fetchCurrentQuiz] クイズIDs: ${JSON.stringify(quizIds)}, 現在のインデックス: ${currentQuizIndex}, 現在のクイズID: ${currentQuizId}`);
      
      if (!currentQuizId) {
        console.log('[fetchCurrentQuiz] クイズIDが見つかりません - クイズ配列が空かインデックスが範囲外');
        return;
      }

      // 重複問題防止チェック
      if (currentQuiz && currentQuiz.quizId === currentQuizId) {
        console.log(`[fetchCurrentQuiz] 同じクイズが既に設定済み (${currentQuizId}) - スキップ`);
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
        // quizTypeが未定義の場合はclassTypeをフォールバックとして使用
        const isOfficial = quizRoom.quizType === 'official' || 
                          (quizRoom.quizType === undefined && quizRoom.classType === '公式');
        
        // デバッグ時のみログ出力
        // console.log(`[useLeader] クイズ取得: genre=${quizRoom.genre}, unitId=${quizRoom.unitId}, quizId=${currentQuizId}, quizType=${quizRoom.quizType}, classType=${quizRoom.classType}, isOfficial=${isOfficial}`);
        
        // 公式クイズかユーザー作成クイズかに応じてパスを構築
        let quizRef;
        if (isOfficial) {
          // 公式クイズの場合: genres/genre/official_quiz_units/unit/quizzes/quizId
          quizRef = doc(db, 'genres', quizRoom.genre, 'official_quiz_units', quizRoom.unitId, 'quizzes', currentQuizId);
          // console.log(`[useLeader] 公式クイズパス: genres/${quizRoom.genre}/official_quiz_units/${quizRoom.unitId}/quizzes/${currentQuizId}`);
        } else {
          // ユーザー作成クイズの場合: genres/genre/quiz_units/unit/quizzes/quizId
          quizRef = doc(db, 'genres', quizRoom.genre, 'quiz_units', quizRoom.unitId, 'quizzes', currentQuizId);
          // console.log(`[useLeader] ユーザークイズパス: genres/${quizRoom.genre}/quiz_units/${quizRoom.unitId}/quizzes/${currentQuizId}`);
        }
        
        const quizSnap = await getDoc(quizRef);
        
        if (quizSnap.exists()) {
          const quizData = quizSnap.data() as Quiz;
          setCurrentQuiz({ ...quizData, quizId: quizSnap.id });
          console.log(`[useLeader] クイズ取得成功: ${quizSnap.id}`);
          // 新しい問題が表示されたら選択肢を非表示に戻す
          setShowChoices(false);
          
          // ルーム状態のみ更新（統計更新は全クイズ終了時に一括実行）
          const roomRef = doc(db, 'quiz_rooms', roomId);
          
          try {
            // 現在のルーム状態を取得して比較
            const roomSnap = await getDoc(roomRef);
            if (!roomSnap.exists()) {
              console.error('ルームが存在しません');
              return;
            }
            
            const currentRoomData = roomSnap.data();
            const currentState = currentRoomData.currentState || {};
            
            // 変更が必要な項目のみを更新データに含める
            const updateData: any = {};
            
            if (currentState.quizId !== currentQuizId) {
              updateData['currentState.quizId'] = currentQuizId;
            }
            if (currentState.currentAnswerer !== null) {
              updateData['currentState.currentAnswerer'] = null;
            }
            if (currentState.answerStatus !== 'waiting') {
              updateData['currentState.answerStatus'] = 'waiting';
            }
            if (currentState.isRevealed !== false) {
              updateData['currentState.isRevealed'] = false;
            }
            
            // 常に更新が必要なタイムスタンプ
            updateData['currentState.startTime'] = serverTimestamp();
            updateData['currentState.endTime'] = null;
            
            // 実際に変更がある場合のみ書き込み
            if (Object.keys(updateData).length > 2) { // タイムスタンプ以外に変更がある場合
              writeMonitor.logOperation('updateDoc', `quiz_rooms/${roomId}`, 'ルーム状態更新（変更検出後）');
              await updateDoc(roomRef, updateData);
              console.log('ルーム状態を更新しました（変更検出後）');
            } else if (Object.keys(updateData).length > 0) {
              // タイムスタンプのみの更新
              writeMonitor.logOperation('updateDoc', `quiz_rooms/${roomId}`, 'タイムスタンプのみ更新');
              await updateDoc(roomRef, updateData);
              console.log('タイムスタンプのみ更新しました');
            } else {
              console.log('ルーム状態に変更がないため、書き込みをスキップしました');
            }
            
          } catch (batchError: any) {
            console.error('バッチ処理中にエラーが発生しました:', batchError);
            
            if (batchError?.code === 'permission-denied') {
              console.error('権限エラー: データ更新が拒否されました');
              
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
          
          console.error(`[useLeader] クイズが見つかりません:`);
          console.error(`- クイズID: ${currentQuizId}`);
          console.error(`- パス: ${pathInfo}`);
          console.error(`- クイズタイプ: ${quizRoom.quizType}`);
          console.error(`- クラスタイプ: ${quizRoom.classType}`);
          console.error(`- isOfficial: ${isOfficial}`);
          console.error(`- ジャンル: ${quizRoom.genre}`);
          console.error(`- 単元ID: ${quizRoom.unitId}`);
          
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
            question: "一時的な問題により問題を取得できませんでした。しばらくお待ちください。",
            type: "multiple_choice",
            genre: quizRoom.genre || '',
            choices: ["読み込み中...", "読み込み中...", "読み込み中...", "読み込み中..."],
            correctAnswer: "読み込み中...",
            acceptableAnswers: [],
            explanation: "問題データが取得できませんでした。",
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
  }, [quizRoom, isLeader, roomId, setCurrentQuiz, setShowChoices, currentUser]);

  // クイズゲームを開始する
  const startQuizGame = useCallback(async () => {
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
              answerStatus: 'waiting',
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
  }, [isLeader, quizRoom, roomId, fetchCurrentQuiz]);

  // 次の問題に進む
  const moveToNextQuestion = useCallback(async () => {
    if (!isLeader || !quizRoom) return;
    
    try {
      const nextIndex = quizRoom.currentQuizIndex + 1;
      // quizIdsがundefinedの可能性を考慮
      const quizIds = quizRoom.quizIds || [];
      
      console.log(`[moveToNextQuestion] 現在のインデックス: ${quizRoom.currentQuizIndex}, 次のインデックス: ${nextIndex}, 総問題数: ${quizIds.length}`);
      console.log(`[moveToNextQuestion] クイズIDs: ${JSON.stringify(quizIds)}`);
      
      if (nextIndex >= quizIds.length) {
        // 全問題が終了した場合（重要な状態変更のみupdatedAtを更新）
        console.log('[moveToNextQuestion] 全問題終了 - ルームを完了状態に変更');
        await updateDoc(doc(db, 'quiz_rooms', roomId), {
          status: 'completed',
          updatedAt: serverTimestamp()
        });
        
        // 経験値付与など終了処理
        await finishQuizGame();
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
            answerStatus: 'waiting',
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
  }, [isLeader, quizRoom, roomId, fetchCurrentQuiz]);

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
      
      // 全員が解答した場合、または時間切れの場合（タイムアウトの状態）
      const isTimeout = roomData.currentState?.answerStatus === 'timeout';
      const allAnswered = answeredCount >= totalParticipants;
      
      // 全員が解答した場合、または時間切れの場合
      if (allAnswered || isTimeout) {
        console.log(isTimeout ? '時間切れです。' : '全員が解答し、全員不正解です。');
        console.log('正解と解説を表示して、一定時間後に次の問題に進みます');
        
        // 現在の状態をチェックして、変更が必要な場合のみ更新
        const currentState = roomData.currentState || {};
        const targetStatus = isTimeout ? 'timeout' : 'all_incorrect';
        const updateData: any = {};
        
        if (currentState.answerStatus !== targetStatus) {
          updateData['currentState.answerStatus'] = targetStatus;
        }
        if (currentState.isRevealed !== true) {
          updateData['currentState.isRevealed'] = true;
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
      }
      
    } catch (error) {
      console.error('ゲーム進行チェックでエラーが発生しました:', error);
    }
  }, [isLeader, quizRoom, roomId, moveToNextQuestion]);

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
  }, [isLeader, quizRoom, roomId, checkAndProgressGame]);

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
          // 現在の状態をチェックして、実際に変更が必要かを確認
          const currentState = roomSnap.data().currentState || {};
          const updateData: any = {};
          
          if (currentState.currentAnswerer !== fastestUserId) {
            updateData['currentState.currentAnswerer'] = fastestUserId;
          }
          if (currentState.answerStatus !== 'answering') {
            updateData['currentState.answerStatus'] = 'answering';
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
                  currentRoomData.currentState?.answerStatus === 'answering') {
                console.log(`ユーザー ${fastestUserId} の解答時間切れです`);
                
                // 解答権をリセットして他の人が解答できるようにする
                await updateDoc(roomRef, {
                  'currentState.currentAnswerer': null,
                  'currentState.answerStatus': 'waiting'
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
            return; // 以降の処理をスキップ
          }
        }
        
        // 全ての解答を一度のバッチ処理で更新（書き込み回数削減）
        try {
          const batch = writeBatch(db);
          
          // 最初の解答を処理済みにマーク
          batch.update(fastestAnswer.ref, {
            processingStatus: 'processed'
          });
          
          // 他の保留中の解答もキャンセル
          snapshot.docs.slice(1).forEach(doc => {
            batch.update(doc.ref, { processingStatus: 'processed' });
          });
          
          await batch.commit();
          console.log(`解答処理完了: 1件処理済み、${snapshot.docs.length - 1}件キャンセル`);
        } catch (batchError: any) {
          console.error('解答のバッチ処理に失敗しました:', batchError);
          if (batchError?.code === 'permission-denied') {
            console.error('権限エラー: 解答のバッチ処理が拒否されました');
            
            // フォールバック: 個別更新を試みる
            try {
              await updateDoc(fastestAnswer.ref, { processingStatus: 'processed' });
            } catch (individualError) {
              console.error('個別の解答更新に失敗しました:', individualError);
            }
            
            snapshot.docs.slice(1).forEach(async (doc) => {
              try {
                await updateDoc(doc.ref, { processingStatus: 'processed' });
              } catch (individualError) {
                console.error(`解答 ${doc.id} の更新に失敗しました:`, individualError);
              }
            });
          }
        }
      } catch (error) {
        console.error('早押し処理中にエラーが発生しました:', error);
      }
    }, (error) => {
      console.error('早押し監視のリスナーでエラーが発生しました:', error);
    });
  }, [isLeader, roomId, checkAndProgressGame]);

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
        
        // バッチ処理で複数の更新を一度に実行（書き込み回数削減）
        const batch = writeBatch(db);
        
        try {
          // 解答結果の更新
          batch.update(answerRef, { isCorrect });
          
          // ルーム状態の更新（頻繁な状態変更はupdatedAtを省略）
          batch.update(doc(db, 'quiz_rooms', roomId), {
            'currentState.answerStatus': isCorrect ? 'correct' : 'incorrect',
            'currentState.isRevealed': true,
            [`participants.${userId}.score`]: increment(isCorrect ? 10 : 0)
          });
          
          // バッチ実行
          await batch.commit();
          console.log(`解答処理完了: ${isCorrect ? '正解' : '不正解'}`);
        } catch (batchError: any) {
          console.error('バッチ処理に失敗しました:', batchError);
          if (batchError?.code === 'permission-denied') {
            console.error('権限エラー: データ更新が拒否されました');
          }
        }
        
        // クイズ統計の更新は全クイズ終了時に一括実行（優先度低のため）
        
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
      
      console.log(`Quiz room ${roomId} completed - scheduling deletion in 10 seconds`);
      
      // 10秒後にルームを削除（結果表示と統計更新の時間確保）
      setTimeout(async () => {
        try {
          // まず、各参加者のcurrentRoomIdをnullに設定して参照を解除
          const participantUpdates = Object.keys(quizRoom.participants).map(async (userId) => {
            try {
              await updateDoc(doc(usersDb, 'users', userId), { currentRoomId: null });
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
      }, 5000); // 5秒後に削除（前の修正と合わせる）
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
    
    // 空文字列の解答をチェック
    if (!answer || !answer.trim()) {
      console.log('空の解答は受け付けられません');
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
              [`participants.${currentUser.uid}.score`]: increment(isCorrect ? SCORING.CORRECT_ANSWER_SCORE : SCORING.INCORRECT_ANSWER_PENALTY)
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
                }, TIMING.NEXT_QUESTION_DELAY);
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
                }, TIMING.NEXT_QUESTION_DELAY);
                
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

  return {
    startQuizGame,
    moveToNextQuestion,
    startQuestionTimer,
    handleBuzzer,
    submitAnswer,
    judgeAnswer,
    handleIncorrectAnswer,
    checkAndProgressGame,
    fetchCurrentQuiz
  };
}

// 回答の正規化（小文字化、空白除去など）
function normalizeAnswer(answer: string): string {
  if (typeof answer !== 'string') {
    console.warn('normalizeAnswer: answer is not a string:', answer);
    return String(answer || '').toLowerCase().replace(/\s+/g, '');
  }
  return answer.toLowerCase().replace(/\s+/g, '');
}

// 正誤判定ヘルパー関数
function judgeCorrectness(quizData: Quiz, userAnswer: string): boolean {
  // 空文字列や無効な回答の場合は不正解とする
  if (!userAnswer || typeof userAnswer !== 'string' || !userAnswer.trim()) {
    console.log('空の解答のため不正解です');
    return false;
  }
  
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
