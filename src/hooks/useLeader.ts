'use client';

import { useAuth } from '@/context/AuthContext';
import { useQuiz } from '@/context/QuizContext';
import { QuizFetchService } from '@/services/leader/quizFetchService';
import { GameProgressService } from '@/services/leader/gameProgressService';
import { GameMonitoringService } from '@/services/leader/gameMonitoringService';
import { TimerService } from '@/services/leader/timerService';
import { AnswerService } from '@/services/leader/answerService';
import { useCallback, useEffect } from 'react';

export function useLeader(roomId: string) {
  const { isLeader, quizRoom, currentQuiz, setCurrentQuiz, setShowChoices } = useQuiz();
  const { currentUser } = useAuth();

  // 現在の問題を取得してセット
  const fetchCurrentQuiz = useCallback(async (overrideIndex?: number) => {
    if (!currentUser?.uid || !quizRoom) return;
    return await QuizFetchService.fetchCurrentQuiz(
      roomId, 
      quizRoom, 
      currentQuiz, 
      setCurrentQuiz, 
      setShowChoices,
      currentUser,
      overrideIndex
    );
  }, [roomId, quizRoom, currentQuiz, setCurrentQuiz, setShowChoices, currentUser]);

  // クイズゲームを開始する
  const startQuizGame = useCallback(async () => {
    if (!quizRoom) return;
    return await GameProgressService.startQuizGame(
      roomId,
      quizRoom,
      isLeader,
      fetchCurrentQuiz
    );
  }, [roomId, quizRoom, isLeader, fetchCurrentQuiz]);

  // 次の問題に進む
  const moveToNextQuestion = useCallback(async () => {
    if (!quizRoom) return;
    return await GameProgressService.moveToNextQuestion(
      roomId,
      quizRoom,
      isLeader,
      fetchCurrentQuiz
    );
  }, [roomId, quizRoom, isLeader, fetchCurrentQuiz]);

  // ゲーム進行状況をチェックして自動進行を決定
  const checkAndProgressGame = useCallback(async () => {
    if (!quizRoom) return;
    return await GameMonitoringService.checkAndProgressGame(
      roomId,
      quizRoom,
      isLeader,
      moveToNextQuestion
    );
  }, [roomId, quizRoom, isLeader, moveToNextQuestion]);

  // 問題のタイマーを開始（ジャンル別制限時間）
  const startQuestionTimer = useCallback(() => {
    if (!quizRoom) return;
    return TimerService.startQuestionTimer(
      roomId,
      quizRoom,
      isLeader,
      checkAndProgressGame
    );
  }, [roomId, quizRoom, isLeader, checkAndProgressGame]);

  // 早押し監視
  const handleBuzzerUpdates = useCallback(() => {
    return GameMonitoringService.handleBuzzerUpdates(
      roomId,
      isLeader,
      checkAndProgressGame
    );
  }, [roomId, isLeader, checkAndProgressGame]);

  // 不正解時の自動進行処理
  const handleIncorrectAnswer = useCallback(async () => {
    if (!quizRoom || !currentQuiz) return;
    return await AnswerService.handleIncorrectAnswer(
      roomId,
      quizRoom,
      currentQuiz,
      isLeader,
      moveToNextQuestion
    );
  }, [roomId, quizRoom, currentQuiz, isLeader, moveToNextQuestion]);

  // 解答判定
  const judgeAnswer = useCallback(async (answerId: string) => {
    if (!quizRoom || !currentQuiz) return;
    return await AnswerService.judgeAnswer(
      answerId,
      roomId,
      quizRoom,
      currentQuiz,
      isLeader,
      moveToNextQuestion,
      handleIncorrectAnswer
    );
  }, [roomId, quizRoom, currentQuiz, isLeader, moveToNextQuestion, handleIncorrectAnswer]);

  // 正解フラグの監視
  const watchForCorrectAnswer = useCallback(() => {
    return GameMonitoringService.watchForCorrectAnswer(
      roomId,
      isLeader,
      moveToNextQuestion
    );
  }, [roomId, isLeader, moveToNextQuestion]);

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
    if (!currentUser || !quizRoom || !currentQuiz) return;
    return await AnswerService.handleBuzzer(
      roomId,
      currentUser,
      quizRoom,
      currentQuiz,
      setShowChoices
    );
  }, [roomId, currentUser, quizRoom, currentQuiz, setShowChoices]);

  // 解答を提出
  const submitAnswer = useCallback(async (answer: string) => {
    if (!currentUser || !quizRoom || !currentQuiz) return;
    return await AnswerService.submitAnswer(
      roomId,
      answer,
      currentUser,
      quizRoom,
      currentQuiz,
      isLeader,
      moveToNextQuestion
    );
  }, [roomId, currentUser, quizRoom, currentQuiz, isLeader, moveToNextQuestion]);

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

// Re-export utility functions from AnswerService
export const { judgeCorrectness } = AnswerService;
