'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useQuizRoom } from '@/hooks/useQuizRoom';
import { FaPlay, FaArrowLeft, FaGamepad, FaBook, FaPenFancy, FaUsers } from 'react-icons/fa';
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
    <div className="app-container py-8">
      <div className="max-w-2xl mx-auto">
        <Link href="/quiz" className="flex items-center text-indigo-600 mb-6 hover:text-indigo-800 transition-colors duration-200">
          <FaArrowLeft className="mr-2" /> クイズ選択に戻る
        </Link>
        
        <div className="card">
          <div className="flex items-center mb-8">
            <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-xl flex items-center justify-center text-white shadow-md mr-4">
              <FaGamepad className="text-2xl" />
            </div>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 text-transparent bg-clip-text">クイズルームを作成</h1>
              <p className="text-gray-600">新しいクイズルームを作成して友達を招待しましょう</p>
            </div>
          </div>
          
          {error && (
            <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 rounded-lg mb-6 animate-fadeIn">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm">{error}</p>
                </div>
              </div>
            </div>
          )}
          
          <form onSubmit={handleCreateRoom} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label htmlFor="genre" className="form-label flex items-center">
                  <FaBook className="mr-2 text-indigo-500" /> ジャンル
                </label>
                <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3 text-gray-700 font-medium">
                  {genre}
                </div>
              </div>
              
              <div className="space-y-2">
                <label htmlFor="subgenre" className="form-label flex items-center">
                  <FaGamepad className="mr-2 text-indigo-500" /> 単元
                </label>
                <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3 text-gray-700 font-medium">
                  {subgenre}
                </div>
              </div>
            </div>
            
            <div className="space-y-2">
              <label htmlFor="roomName" className="form-label flex items-center">
                <FaPenFancy className="mr-2 text-indigo-500" /> ルーム名
              </label>
              <input
                type="text"
                id="roomName"
                name="roomName"
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                required
                className="form-input"
                placeholder="例: 初心者歓迎！楽しく学ぼう！"
              />
            </div>
            
            <div className="pt-4">
              <div className="bg-indigo-50 rounded-xl p-4 mb-6 border border-indigo-100">
                <div className="flex items-center mb-2">
                  <FaUsers className="text-indigo-500 mr-2" />
                  <h3 className="font-medium">ルーム情報</h3>
                </div>
                <p className="text-sm text-gray-600">
                  ルームを作成すると、あなたがリーダーになります。<br />
                  このルームでは、{genre}の{subgenre}に関するクイズが出題されます。<br />
                  友達を招待して一緒にプレイしましょう！
                </p>
              </div>
              
              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full flex items-center justify-center"
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
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
