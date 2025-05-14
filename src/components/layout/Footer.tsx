'use client';

import { FaBolt } from 'react-icons/fa';

export default function Footer() {
  return (
    <footer className="bg-indigo-800 text-white py-6">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row justify-between items-center">
          <div className="flex items-center space-x-2 mb-4 md:mb-0">
            <FaBolt className="text-yellow-300" />
            <span className="font-bold text-lg">Zap!</span>
          </div>
          <div className="text-sm text-indigo-200">
            &copy; {new Date().getFullYear()} Zap! オンラインマルチクイズアプリケーション
          </div>
        </div>
      </div>
    </footer>
  );
}
