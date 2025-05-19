import { Suspense } from 'react';
import CreateQuizForm from './CreateQuizForm';

// QuizDifficultyの型定義（CreateQuizFormからエクスポートされている型なので残しておく）
export type { QuizDifficulty } from './CreateQuizForm';

export default function CreateQuizUnitPage() {
  return (
    <div className="min-h-screen">
      <Suspense fallback={
        <div className="flex justify-center items-center min-h-screen">
          <div className="animate-pulse flex space-x-4">
            <div className="h-12 w-12 bg-indigo-200 rounded-full"></div>
            <div className="space-y-4">
              <div className="h-4 bg-indigo-200 rounded w-36"></div>
              <div className="h-4 bg-indigo-100 rounded w-24"></div>
            </div>
          </div>
        </div>
      }>
        <CreateQuizForm />
      </Suspense>
    </div>
  );
}
