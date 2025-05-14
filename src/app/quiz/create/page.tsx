'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useQuizRoom } from '@/hooks/useQuizRoom';
import { FaPlay, FaArrowLeft } from 'react-icons/fa';
import Link from 'next/link';

export default function CreateRoomPage() {
  const { currentUser } = useAuth();
  const { createRoom, loading, error } = useQuizRoom();
  const [roomName, setRoomName] = useState('');
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const genre = searchParams.get('genre');
  const subgenre = searchParams.get('subgenre');

  useEffect(() => {
    // ユーザーがログインしていない場合は、ログインページにリダイレクト
    if (!currentUser) {
      router.push('/auth/login');
    }

    // パラメータが不足している場合はクイズ選択ページにリダイレクト
    if (!genre || !subgenre) {
      router.push('/quiz');
    } else {
      // デフォルトのルーム名を設定
      setRoomName(`${genre} - ${subgenre} - クイズルーム`);
    }
  }, [currentUser, router, genre, subgenre]);

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!genre || !subgenre) {
      return;
    }

    const room = await createRoom(roomName, genre, subgenre);
    
    if (room) {
      router.push(`/quiz/${room.roomId}`);
    }
  };

  if (!currentUser || !genre || !subgenre) {
    return null; // ユーザーがログインしているか確認中、もしくはリダイレクト中
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-xl mx-auto">
        <Link href="/quiz" className="flex items-center text-indigo-600 mb-6">
          <FaArrowLeft className="mr-2" /> クイズ選択に戻る
        </Link>
        
        <div className="bg-white rounded-lg shadow-md p-6">
          <h1 className="text-2xl font-bold mb-6">クイズルームを作成</h1>
          
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-4">
              {error}
            </div>
          )}
          
          <form onSubmit={handleCreateRoom}>
            <div className="mb-4">
              <label htmlFor="genre" className="block text-sm font-medium text-gray-700 mb-1">
                ジャンル
              </label>
              <input
                type="text"
                id="genre"
                name="genre"
                value={genre}
                disabled
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
              />
            </div>
            
            <div className="mb-4">
              <label htmlFor="subgenre" className="block text-sm font-medium text-gray-700 mb-1">
                単元
              </label>
              <input
                type="text"
                id="subgenre"
                name="subgenre"
                value={subgenre}
                disabled
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
              />
            </div>
            
            <div className="mb-6">
              <label htmlFor="roomName" className="block text-sm font-medium text-gray-700 mb-1">
                ルーム名
              </label>
              <input
                type="text"
                id="roomName"
                name="roomName"
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="ルーム名を入力"
              />
            </div>
            
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 transition flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  ルーム作成中...
                </span>
              ) : (
                <span className="flex items-center">
                  <FaPlay className="mr-2" /> ルームを作成する
                </span>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
