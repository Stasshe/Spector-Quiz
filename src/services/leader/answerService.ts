'use client';

import { db } from '@/config/firebase';
import { SCORING, TIMING } from '@/config/quizConfig';
import { Quiz } from '@/types/quiz';
import { QuizRoom } from '@/types/room';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch
} from 'firebase/firestore';

export class AnswerService {
  
  // ユーザーが早押しボタンを押した時
  static async handleBuzzer(
    roomId: string,
    currentUser: any,
    quizRoom: QuizRoom,
    currentQuiz: Quiz,
    setShowChoices: (show: boolean) => void
  ) {
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
      
      // 解答中の状態（answering_in_progress）でも早押しを制限
      if (quizRoom.currentState.answerStatus === 'answering_in_progress') {
        console.log('他のプレイヤーが回答中のため、早押しできません');
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
        
        // 現在誰かが解答中かチェック（ただし、間違えた状態なら早押し可能）
        if (roomData.currentState?.answerStatus === 'answering_in_progress' &&
            roomData.currentState?.currentAnswerer &&
            roomData.currentState?.currentAnswerer !== currentUser.uid) {
          console.log('他のプレイヤーが回答中のため、早押しできません');
          return;
        }
        
        // 解答権を取得する処理
        try {
          console.log(`早押し処理開始: 現在の状態 = ${roomData.currentState?.answerStatus}, 現在の解答者 = ${roomData.currentState?.currentAnswerer}`);
          
          // ルームの状態を更新（解答権を取得）
          // 早押し時点で即座に answering_in_progress に設定して他のプレイヤーに通知
          await updateDoc(roomRef, {
            'currentState.currentAnswerer': currentUser.uid,
            'currentState.answerStatus': 'answering_in_progress'
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
  }

  // 解答を提出
  static async submitAnswer(
    roomId: string,
    answer: string,
    currentUser: any,
    quizRoom: QuizRoom,
    currentQuiz: Quiz,
    isLeader: boolean,
    moveToNextQuestion: () => Promise<void>
  ) {
    if (!currentUser || !quizRoom || !currentQuiz) {
      console.log('解答処理に必要な情報が不足しています');
      return;
    }
    
    // 空文字列の解答をチェック（ただし、時間切れの場合は強制処理）
    if (!answer || !answer.trim()) {
      console.log('空の解答 - 時間切れによる強制不正解処理と仮定');
      // 空の解答は基本的に不正解として処理
    }
    
    try {
      // 解答権があるか確認
      if (quizRoom.currentState.currentAnswerer !== currentUser.uid) {
        console.log('解答権がありません');
        return;
      }
      
      // 正解かどうかを判定
      const isCorrect = AnswerService.judgeCorrectness(currentQuiz, answer);
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
        
        await AnswerService.processAnswer(
          roomId,
          currentUser,
          currentQuiz,
          answer,
          isCorrect,
          quizRoom,
          isLeader,
          moveToNextQuestion,
          roomRef
        );
        
      } catch (error) {
        console.error('Error in roomRef processing:', error);
      }
    } catch (error) {
      console.error('Error submitting answer:', error);
    }
  }

  private static async processAnswer(
    roomId: string,
    currentUser: any,
    currentQuiz: Quiz,
    answer: string,
    isCorrect: boolean,
    quizRoom: QuizRoom,
    isLeader: boolean,
    moveToNextQuestion: () => Promise<void>,
    roomRef: any
  ) {
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
        const answerDocRef = doc(db, 'quiz_rooms', roomId, 'answers', answerDoc.id);
        
        try {
          await updateDoc(answerDocRef, {
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
      
      // ルームの状態を更新して正誤判定を記録
      await AnswerService.updateRoomStateAfterAnswer(
        roomRef,
        roomId,
        currentUser,
        currentQuiz,
        isCorrect,
        quizRoom,
        isLeader,
        moveToNextQuestion
      );
      
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
  }

  private static async updateRoomStateAfterAnswer(
    roomRef: any,
    roomId: string,
    currentUser: any,
    currentQuiz: Quiz,
    isCorrect: boolean,
    quizRoom: QuizRoom,
    isLeader: boolean,
    moveToNextQuestion: () => Promise<void>
  ) {
    try {
      const updateData: any = {};
      
      // 正解の場合
      if (isCorrect) {
        updateData['currentState.answerStatus'] = 'correct';
        updateData['currentState.isRevealed'] = true;
        updateData[`participants.${currentUser.uid}.score`] = increment(SCORING.CORRECT_ANSWER_SCORE);
        
        // 正解の場合、次の問題に進むためのフラグを設定
        updateData['readyForNextQuestion'] = true;
        updateData['lastCorrectTimestamp'] = serverTimestamp();
      } else {
        // 不正解の場合は、解答権をリセットして他の人が回答できるようにする
        // 正答は表示せず、「間違えました」メッセージを表示
        updateData['currentState.answerStatus'] = 'incorrect';
        updateData['currentState.isRevealed'] = false; // 正答は表示しない
        updateData[`participants.${currentUser.uid}.score`] = increment(SCORING.INCORRECT_ANSWER_PENALTY);
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
      }
      
      await updateDoc(roomRef, updateData);
      
      console.log(`ルーム状態を更新しました - 解答は${isCorrect ? '正解' : '不正解'}です`);
      
      // 正解・不正解に応じた後続処理
      await AnswerService.handlePostAnswerLogic(
        isCorrect,
        isLeader,
        moveToNextQuestion,
        roomRef,
        roomId,
        currentUser,
        currentQuiz,
        quizRoom
      );
      
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
  }

  private static async handlePostAnswerLogic(
    isCorrect: boolean,
    isLeader: boolean,
    moveToNextQuestion: () => Promise<void>,
    roomRef: any,
    roomId: string,
    currentUser: any,
    currentQuiz: Quiz,
    quizRoom: QuizRoom
  ) {
    // 正解の場合はリーダーなら待ち時間後に次の問題に進む
    if (isCorrect && isLeader) {
      console.log(`正解が確認されました。${TIMING.NEXT_QUESTION_DELAY/1000}秒後に次の問題に進みます`);
      setTimeout(() => {
        moveToNextQuestion();
      }, TIMING.NEXT_QUESTION_DELAY);
    } else if (!isCorrect) {
      // 不正解の場合、まず全員の解答状況をチェック
      if (isLeader) {
        console.log('[リーダー] 不正解のため、全員の解答状況をチェックします');
        setTimeout(async () => {
          await AnswerService.handleIncorrectAnswerAsLeader(
            roomId,
            currentQuiz,
            quizRoom,
            roomRef,
            moveToNextQuestion
          );
        }, 500); // 1.0秒 → 0.5秒に短縮
      } else {
        console.log('[非リーダー] 不正解のため、リーダーによる処理を待機します');
        // 非リーダーの場合、リーダーが処理しない場合のフォールバック
        setTimeout(async () => {
          await AnswerService.handleIncorrectAnswerAsFollower(
            roomRef,
            currentUser,
            roomId,
            currentQuiz,
            quizRoom
          );
        }, 3000); // リーダーより少し遅れて実行
      }
    }
  }

  private static async handleIncorrectAnswerAsLeader(
    roomId: string,
    currentQuiz: Quiz,
    quizRoom: QuizRoom,
    roomRef: any,
    moveToNextQuestion: () => Promise<void>
  ) {
    try {
      // 全員の解答状況をチェック
      const answersRef = collection(db, 'quiz_rooms', roomId, 'answers');
      const currentQuizAnswers = query(
        answersRef,
        where('quizId', '==', currentQuiz.quizId)
      );
      
      const answersSnap = await getDocs(currentQuizAnswers);
      
      // 解答したプレイヤーのリストと正解者の存在確認
      const answeredPlayers = new Set();
      let hasCorrectAnswer = false;
      
      answersSnap.docs.forEach(doc => {
        const answerData = doc.data();
        answeredPlayers.add(answerData.userId);
        if (answerData.isCorrect) {
          hasCorrectAnswer = true;
        }
      });
      
      const totalParticipants = Object.keys(quizRoom.participants).length;
      const answeredCount = answeredPlayers.size;
      
      console.log(`解答状況チェック: ${answeredCount}/${totalParticipants}人が解答済み, 正解者: ${hasCorrectAnswer ? 'あり' : 'なし'}`);
      
      // 全員が解答済みで正解者がいない場合は正答表示
      if (answeredCount >= totalParticipants && !hasCorrectAnswer) {
        console.log('[リーダー] 全員不正解のため、正答と解説を表示します');
        await updateDoc(roomRef, {
          'currentState.currentAnswerer': null,
          'currentState.answerStatus': 'all_answered',
          'currentState.isRevealed': true
        });
        
        // 一定時間後に次の問題に進む
        setTimeout(() => {
          moveToNextQuestion();
        }, TIMING.NEXT_QUESTION_DELAY);
      } else {
        // まだ解答していない人がいる場合は解答権をリセット
        console.log('[リーダー] まだ解答していない人がいるため、解答権をリセットします');
        await updateDoc(roomRef, {
          'currentState.currentAnswerer': null,
          'currentState.answerStatus': 'waiting_for_buzz'
        });
      }
    } catch (resetError) {
      console.error('[リーダー] 解答権のリセットに失敗:', resetError);
    }
  }

  private static async handleIncorrectAnswerAsFollower(
    roomRef: any,
    currentUser: any,
    roomId: string,
    currentQuiz: Quiz,
    quizRoom: QuizRoom
  ) {
    try {
      const latestRoomSnap = await getDoc(roomRef);
      if (latestRoomSnap.exists()) {
        const latestRoomData = latestRoomSnap.data() as QuizRoom;
        
        // まだ状態がリセットされていない場合（リーダーが処理していない）
        if (latestRoomData.currentState.answerStatus === 'incorrect' &&
            latestRoomData.currentState.currentAnswerer === currentUser.uid) {
          console.log('[非リーダー] リーダーからの応答がないため、全員の解答状況をチェックします');
          
          // 全員の解答状況をチェック
          const answersRef = collection(db, 'quiz_rooms', roomId, 'answers');
          const currentQuizAnswers = query(
            answersRef,
            where('quizId', '==', currentQuiz.quizId)
          );
          
          const answersSnap = await getDocs(currentQuizAnswers);
          
          const answeredPlayers = new Set();
          let hasCorrectAnswer = false;
          
          answersSnap.docs.forEach(doc => {
            const answerData = doc.data();
            answeredPlayers.add(answerData.userId);
            if (answerData.isCorrect) {
              hasCorrectAnswer = true;
            }
          });
          
          const totalParticipants = Object.keys(latestRoomData.participants).length;
          const answeredCount = answeredPlayers.size;
          
          // 全員が解答済みで正解者がいない場合は正答表示
          if (answeredCount >= totalParticipants && !hasCorrectAnswer) {
            console.log('[非リーダー] 全員不正解のため、正答と解説を表示します');
            await updateDoc(roomRef, {
              'currentState.currentAnswerer': null,
              'currentState.answerStatus': 'all_answered',
              'currentState.isRevealed': true
            });
          } else {
            // まだ解答していない人がいる場合は解答権をリセット
            console.log('[非リーダー] まだ解答していない人がいるため、解答権をリセットします');
            await updateDoc(roomRef, {
              'currentState.currentAnswerer': null,
              'currentState.answerStatus': 'waiting_for_buzz'
            });
          }
        }
      }
    } catch (error) {
      console.error('[非リーダー] 緊急処理でエラー:', error);
    }
  }

  // 解答判定
  static async judgeAnswer(
    answerId: string,
    roomId: string,
    quizRoom: QuizRoom,
    currentQuiz: Quiz,
    isLeader: boolean,
    moveToNextQuestion: () => Promise<void>,
    handleIncorrectAnswer: () => Promise<void>
  ) {
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
        const isCorrect = AnswerService.judgeCorrectness(currentQuiz, userAnswer);
        
        // バッチ処理で複数の更新を一度に実行（書き込み回数削減）
        const batch = writeBatch(db);
        
        try {
          // 解答結果の更新
          batch.update(answerRef, { isCorrect });
          
          // ルーム状態の更新（頻繁な状態変更はupdatedAtを省略）
          const roomUpdate: any = {
            'currentState.answerStatus': isCorrect ? 'correct' : 'incorrect',
            'currentState.isRevealed': isCorrect, // 不正解の場合は正答を表示しない
            [`participants.${userId}.score`]: increment(isCorrect ? 10 : 0)
          };
          
          // 不正解の場合は解答権をリセットして他の人が早押しできるようにする
          if (!isCorrect) {
            roomUpdate['currentState.currentAnswerer'] = null;
          }
          
          batch.update(doc(db, 'quiz_rooms', roomId), roomUpdate);
          
          // バッチ実行
          await batch.commit();
          console.log(`解答処理完了: ${isCorrect ? '正解' : '不正解'}`);
        } catch (batchError: any) {
          console.error('バッチ処理に失敗しました:', batchError);
          if (batchError?.code === 'permission-denied') {
            console.error('権限エラー: データ更新が拒否されました');
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
  }

  // 不正解時の自動進行処理
  static async handleIncorrectAnswer(
    roomId: string,
    quizRoom: QuizRoom,
    currentQuiz: Quiz,
    isLeader: boolean,
    moveToNextQuestion: () => Promise<void>
  ) {
    if (!isLeader || !quizRoom || !currentQuiz) return;
    
    try {
      console.log('不正解時の自動進行処理を開始します');
      
      // 0.8秒後に全員の解答状況をチェック（リーダーが処理）
      setTimeout(async () => {
        try {
          console.log('間違えた答えの後、全員の解答状況をチェックします');
          const roomRef = doc(db, 'quiz_rooms', roomId);
          
          // シングルプレイヤーの場合は次の問題に進む
          if (Object.keys(quizRoom.participants).length === 1) {
            console.log('シングルプレイヤー: 次の問題に進みます');
            setTimeout(() => {
              moveToNextQuestion();
            }, TIMING.NEXT_QUESTION_DELAY);
            return;
          }
          
          // マルチプレイヤーの場合は全員の解答状況をチェック
          const answersRef = collection(db, 'quiz_rooms', roomId, 'answers');
          const currentQuizAnswers = query(
            answersRef,
            where('quizId', '==', currentQuiz.quizId)
          );
          
          const answersSnap = await getDocs(currentQuizAnswers);
          
          const answeredPlayers = new Set();
          let hasCorrectAnswer = false;
          
          answersSnap.docs.forEach(doc => {
            const answerData = doc.data();
            answeredPlayers.add(answerData.userId);
            if (answerData.isCorrect) {
              hasCorrectAnswer = true;
            }
          });
          
          const totalParticipants = Object.keys(quizRoom.participants).length;
          const answeredCount = answeredPlayers.size;
          
          console.log(`解答状況チェック: ${answeredCount}/${totalParticipants}人が解答済み, 正解者: ${hasCorrectAnswer ? 'あり' : 'なし'}`);
          
          // 全員が解答済みで正解者がいない場合は正答表示
          if (answeredCount >= totalParticipants && !hasCorrectAnswer) {
            console.log('全員不正解のため、正答と解説を表示します');
            await updateDoc(roomRef, {
              'currentState.currentAnswerer': null,
              'currentState.answerStatus': 'all_answered',
              'currentState.isRevealed': true
            });
            
            // 一定時間後に次の問題に進む
            setTimeout(() => {
              moveToNextQuestion();
            }, TIMING.NEXT_QUESTION_DELAY);
          } else {
            // まだ解答していない人がいる場合は解答権をリセット
            console.log('まだ解答していない人がいるため、解答権をリセットします');
            await updateDoc(roomRef, {
              'currentState.currentAnswerer': null,
              'currentState.answerStatus': 'waiting_for_buzz',
              'currentState.isRevealed': false
            });
          }
          console.log('解答権処理が完了しました');
        } catch (error) {
          console.error('解答権リセット中にエラーが発生しました:', error);
        }
      }, 500); // 0.5秒後にチェック

    } catch (error) {
      console.error('不正解時の自動進行処理でエラーが発生しました:', error);
    }
  }

  // 正誤判定ヘルパー関数
  static judgeCorrectness(quizData: Quiz, userAnswer: string): boolean {
    // 空文字列や無効な回答の場合は不正解とする
    if (!userAnswer || typeof userAnswer !== 'string' || !userAnswer.trim()) {
      console.log('空の解答のため不正解です');
      return false;
    }
    
    if (quizData.type === 'multiple_choice') {
      return userAnswer === quizData.correctAnswer;
    } else {
      // 入力式の場合、許容回答リストと照合
      const normalizedUserAnswer = AnswerService.normalizeAnswer(userAnswer);
      return [quizData.correctAnswer, ...(quizData.acceptableAnswers || [])]
        .map(AnswerService.normalizeAnswer)
        .some(answer => answer === normalizedUserAnswer);
    }
  }

  // 回答の正規化（小文字化、空白除去など）
  static normalizeAnswer(answer: string): string {
    if (typeof answer !== 'string') {
      console.warn('normalizeAnswer: answer is not a string:', answer);
      return String(answer || '').toLowerCase().replace(/\s+/g, '');
    }
    return answer.toLowerCase().replace(/\s+/g, '');
  }
}
