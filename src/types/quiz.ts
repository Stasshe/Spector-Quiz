import { Timestamp } from "firebase/firestore";

// クイズの型定義
export interface Quiz {
  quizId: string;
  title: string;
  question: string;
  type: QuizType;
  choices: string[];
  correctAnswer: string;
  acceptableAnswers: string[];
  explanation: string;
  genre?: string;      // 参照用（サブコレクション内では不要）
  difficulty: number;
  createdBy: string;
  createdAt: Timestamp;
  useCount: number;
  correctCount: number;
}

// 基本型定義（サブコレクション用）
export interface QuizBase {
  title: string;
  question: string;
  type: QuizType;
  choices: string[];
  correctAnswer: string;
  acceptableAnswers: string[];
  explanation: string;
  difficulty: number;
  createdBy: string;
  createdAt: Timestamp;
  useCount: number;
  correctCount: number;
}

// 公開クイズ（検索・再利用用）
export interface PublicQuiz extends QuizBase {
  quizId: string;
  genre: string;
  unitId: string;       // 元の単元へのリファレンス
  originalQuizId: string;  // 単元内での元のクイズID
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

export interface GenreStats {
  useCount: number;
  units: {
    [unitId: string]: {
      useCount: number;
    }
  };
}

// クイズ単元（新構造）
export interface QuizUnit {
  unitId: string;
  title: string;
  description?: string;
  genre?: string;          // 参照用（サブコレクションでは親から取得可能）
  createdBy: string;
  createdAt: Timestamp;
  quizCount: number;         // クイズの数（クエリ削減のため）
  averageDifficulty?: number;  // 平均難易度（クエリ削減のため）
  useCount: number;
  isPublic: boolean;
}

// 旧構造との互換性のため
export interface LegacyQuizUnit {
  unitId: string;
  title: string;
  description?: string;
  genre: string;
  createdBy: string;
  createdAt: Timestamp;
  quizIds: string[];        // 旧構造では直接IDを保持
  useCount: number;
  isPublic: boolean;
}
