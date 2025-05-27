
import { Quiz } from '@/types/quiz';

// IndexedDB用の型
export interface DraftUnit {
  draftId: string;
  title: string;
  description: string;
  genre: string;
  quizzes: Quiz[]; // Quiz型を明示的に使用
  isPublic: boolean;
  createdBy: string;
  updatedAt: Date;
}

// Quiz型も再エクスポートして利用しやすくする
export type { Quiz };
