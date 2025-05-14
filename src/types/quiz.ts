import { Timestamp } from "firebase/firestore";

export interface Quiz {
  quizId: string;
  title: string;
  question: string;
  type: 'multiple_choice' | 'input';
  choices: string[];
  correctAnswer: string;
  acceptableAnswers: string[];
  explanation: string;
  genre: string;
  subgenre: string;
  difficulty: number;
  createdBy: string;
  createdAt: Timestamp;
  useCount: number;
  correctCount: number;
}

export interface QuizAnswer {
  answerId: string;
  userId: string;
  quizId: string;
  clickTime: Timestamp;
  answerTime: number;
  answer: string;
  isCorrect: boolean;
  processingStatus: 'pending' | 'processed';
}

export type QuizType = 'multiple_choice' | 'input';

export type QuizDifficulty = 1 | 2 | 3 | 4 | 5;

export interface QuizStatistics {
  totalAttempts: number;
  correctAnswers: number;
  averageAnswerTime: number;
}
