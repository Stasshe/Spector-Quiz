import { ReactNode } from 'react';

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto py-8">
        {children}
      </div>
    </div>
  );
}
