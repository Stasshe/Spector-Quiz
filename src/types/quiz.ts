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
  genre: string;
  createdBy: string;
  createdAt: Timestamp;
  useCount: number;
  correctCount: number;
}

export type QuizType = 'multiple_choice' | 'input';



// クイズ単元（新構造）
export interface QuizUnit {
  unitId: string;
  title: string;
  description?: string;
  genre?: string;          // 参照用（サブコレクションでは親から取得可能）
  createdBy: string;
  createdAt: Timestamp;
  quizCount: number;         // クイズの数（クエリ削減のため）
  useCount: number;
  isPublic: boolean;
}
