
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
