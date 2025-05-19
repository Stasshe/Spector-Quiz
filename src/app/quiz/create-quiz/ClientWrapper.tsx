'use client';

import dynamic from 'next/dynamic';
import { Suspense } from 'react';

// 動的インポートでSSRなしでインポート
const CreateQuizFormNoSSR = dynamic(() => import('./CreateQuizForm'), {
  ssr: false,
  loading: () => <LoadingComponent />
});

// ローディングコンポーネント
const LoadingComponent = () => (
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

// クライアントコンポーネント
export default function ClientWrapper() {
  return <CreateQuizFormNoSSR />;
}
