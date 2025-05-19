// QuizDifficultyを定義
export type QuizDifficulty = 1 | 2 | 3 | 4 | 5;

// IndexedDB用の型
export interface DraftUnit {
  draftId: string;
  title: string;
  description: string;
  genre: string;
  quizzes: any[]; // Quiz型
  isPublic: boolean;
  createdBy: string;
  updatedAt: Date;
}
