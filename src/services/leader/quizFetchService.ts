'use client';

import { db } from '@/config/firebase';
import { Quiz } from '@/types/quiz';
import { QuizRoom } from '@/types/room';
import { doc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { writeMonitor } from '@/utils/firestoreWriteMonitor';

export class QuizFetchService {
  
  // 現在の問題を取得してセット
  static async fetchCurrentQuiz(
    roomId: string,
    quizRoom: QuizRoom,
    currentQuiz: Quiz | null,
    setCurrentQuiz: (quiz: Quiz) => void,
    setShowChoices: (show: boolean) => void,
    currentUser: any,
    overrideIndex?: number
  ) {
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
          genre: quizRoom.genre || 'general',
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
        const isOfficial = quizRoom.quizType === 'official' || 
                          (quizRoom.quizType === undefined && quizRoom.classType === '公式');
        
        // 公式クイズかユーザー作成クイズかに応じてパスを構築
        let quizRef;
        if (isOfficial) {
          quizRef = doc(db, 'genres', quizRoom.genre, 'official_quiz_units', quizRoom.unitId, 'quizzes', currentQuizId);
        } else {
          quizRef = doc(db, 'genres', quizRoom.genre, 'quiz_units', quizRoom.unitId, 'quizzes', currentQuizId);
        }
        
        const quizSnap = await getDoc(quizRef);
        
        if (quizSnap.exists()) {
          const quizData = quizSnap.data() as Quiz;
          const quizWithGenre = { 
            ...quizData, 
            quizId: quizSnap.id,
            genre: quizRoom.genre
          };
          setCurrentQuiz(quizWithGenre);
          console.log(`[useLeader] クイズ取得成功: ${quizSnap.id}, genre: ${quizRoom.genre}`);
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
            if (currentState.answerStatus !== 'waiting_for_buzz') {
              updateData['currentState.answerStatus'] = 'waiting_for_buzz';
            }
            if (currentState.isRevealed !== false) {
              updateData['currentState.isRevealed'] = false;
            }
            
            // 常に更新が必要なタイムスタンプ
            updateData['currentState.startTime'] = serverTimestamp();
            updateData['currentState.endTime'] = null;
            
            // 実際に変更がある場合のみ書き込み
            if (Object.keys(updateData).length > 2) {
              writeMonitor.logOperation('updateDoc', `quiz_rooms/${roomId}`, 'ルーム状態更新（変更検出後）');
              await updateDoc(roomRef, updateData);
              console.log('ルーム状態を更新しました（変更検出後）');
            } else if (Object.keys(updateData).length > 0) {
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
  }
}
