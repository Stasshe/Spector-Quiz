'use client';

import dynamic from 'next/dynamic';

// 動的インポートでSSRなしでインポート（ローディングはSuspenseで処理するため不要）
const CreateQuizFormNoSSR = dynamic(() => import('./CreateQuizForm'), {
  ssr: false
});

// クライアントコンポーネント
export default function ClientWrapper() {
  return <CreateQuizFormNoSSR />;
}
