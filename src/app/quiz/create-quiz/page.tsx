import dynamic from 'next/dynamic';
import { Suspense } from 'react';

// QuizDifficultyの型定義（CreateQuizFormからエクスポートされている型なので残しておく）
export type { QuizDifficulty } from './create-types';

// クライアントサイドのみでレンダリングするための設定
const CreateQuizFormClient = dynamic(() => import('./CreateQuizForm'), {
  ssr: false,
});

// ローディングコンポーネント
const LoadingFallback = () => (
  <div className="flex justify-center items-center min-h-screen">
    <div className="animate-pulse flex space-x-4">
      <div className="h-12 w-12 bg-indigo-200 rounded-full"></div>
      <div className="space-y-4">
        <div className="h-4 bg-indigo-200 rounded w-36"></div>
        <div className="h-4 bg-indigo-100 rounded w-24"></div>
      </div>
    </div>
  </div>
);

export default function CreateQuizUnitPage() {
  return (
    <div className="min-h-screen">
      <Suspense fallback={<LoadingFallback />}>
        <CreateQuizFormClient />
      </Suspense>
    </div>
  );
}
