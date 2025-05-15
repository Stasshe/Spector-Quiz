'use client';

import { createContext, useContext, useState, ReactNode } from 'react';
import { Quiz } from '@/types/quiz';
import { QuizRoom } from '@/types/room';

interface QuizContextType {
  currentQuiz: Quiz | null;
  quizRoom: QuizRoom | null;
  setCurrentQuiz: (quiz: Quiz | null) => void;
  setQuizRoom: (room: QuizRoom | null) => void;
  isLeader: boolean;
  setIsLeader: (isLeader: boolean) => void;
  hasAnsweringRight: boolean;
  setHasAnsweringRight: (hasRight: boolean) => void;
  showChoices: boolean;
  setShowChoices: (show: boolean) => void;
  animationInProgress: boolean;
  setAnimationInProgress: (inProgress: boolean) => void;
  showQuestionDelay: number;
  setShowQuestionDelay: (delay: number) => void;
}

export const QuizContext = createContext<QuizContextType | undefined>(undefined);

export function QuizProvider({ children }: { children: ReactNode }) {
  const [currentQuiz, setCurrentQuiz] = useState<Quiz | null>(null);
  const [quizRoom, setQuizRoom] = useState<QuizRoom | null>(null);
  const [isLeader, setIsLeader] = useState(false);
  const [hasAnsweringRight, setHasAnsweringRight] = useState(false);
  const [showChoices, setShowChoices] = useState(false);
  const [animationInProgress, setAnimationInProgress] = useState(false);
  const [showQuestionDelay, setShowQuestionDelay] = useState(1000); // 1秒のデフォルト遅延

  const value = {
    currentQuiz,
    setCurrentQuiz,
    quizRoom,
    setQuizRoom,
    isLeader,
    setIsLeader,
    hasAnsweringRight,
    setHasAnsweringRight,
    showChoices,
    setShowChoices,
    animationInProgress,
    setAnimationInProgress,
    showQuestionDelay,
    setShowQuestionDelay
  };

  return <QuizContext.Provider value={value}>{children}</QuizContext.Provider>;
}

export function useQuiz() {
  const context = useContext(QuizContext);
  if (context === undefined) {
    throw new Error('useQuiz must be used within a QuizProvider');
  }
  return context;
}
