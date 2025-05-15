'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { FaArrowLeft, FaPlay, FaPlus, FaUsers, FaSync } from 'react-icons/fa';
import { useAuth } from '@/hooks/useAuth';
import { useQuizRoom } from '@/hooks/useQuizRoom';
import { RoomListing } from '@/types/room';

// ローディングフォールバックコンポーネント
function RoomsLoading() {
  return (
    <div className="flex justify-center items-center min-h-[calc(100vh-64px)]">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
    </div>
  );
}

function RoomsContent() {
  const { currentUser } = useAuth();
  const { availableRooms, fetchAvailableRooms, joinRoom, loading, error } = useQuizRoom();
  const [joinLoading, setJoinLoading] = useState(false);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [refreshTimer, setRefreshTimer] = useState(30); // 30秒ごとに自動更新
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const genre = searchParams.get('genre') || '';
  const unitId = searchParams.get('unitId') || '';
  const classType = searchParams.get('classType') || '公式';

  // 初回ロード時にルーム一覧を取得
  useEffect(() => {
    if (!currentUser) return;
    fetchAvailableRooms(genre, classType);
    
    // 30秒ごとに自動更新するタイマーを設定
    const interval = setInterval(() => {
      setRefreshTimer(prev => {
        if (prev <= 1) {
          fetchAvailableRooms(genre, classType);
          return 30;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => clearInterval(interval);
  }, [currentUser, fetchAvailableRooms, genre, classType]);

  // ジャンルと単元でフィルタリングする
  const filteredRooms = availableRooms.filter((room) => {
    if (genre && unitId) {
      return room.genre === genre && room.unitId === unitId;
    } else if (genre) {
      return room.genre === genre;
    }
    return true;
  });

  const handleRefresh = () => {
    fetchAvailableRooms(genre, classType);
    setRefreshTimer(30);
  };

  const handleJoinRoom = async (roomId: string) => {
    setSelectedRoomId(roomId);
    setJoinLoading(true);
    
    try {
      const success = await joinRoom(roomId);
      if (success) {
        router.push(`/quiz/room?id=${roomId}`);
      }
    } finally {
      setJoinLoading(false);
      setSelectedRoomId(null);
    }
  };

  const createRoomLink = genre && unitId 
    ? `/quiz/create?genre=${encodeURIComponent(genre)}&unitId=${encodeURIComponent(unitId)}&classType=${encodeURIComponent(classType)}`
    : '/quiz';

  if (!currentUser) {
    return null; // ユーザーがログインしているか確認中、もしくはリダイレクト中
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <Link href="/quiz" className="flex items-center text-indigo-600">
          <FaArrowLeft className="mr-2" /> クイズ選択に戻る
        </Link>
        
        <div className="flex space-x-4">
          <button
            onClick={handleRefresh}
            className="flex items-center text-indigo-600 px-3 py-1 border border-indigo-600 rounded-md"
            disabled={loading}
          >
            <FaSync className={`mr-2 ${loading ? 'animate-spin' : ''}`} /> 更新 ({refreshTimer}秒)
          </button>
          
          <Link
            href={createRoomLink}
            className="flex items-center bg-indigo-600 text-white px-3 py-1 rounded-md"
          >
            <FaPlus className="mr-2" /> 新規ルーム作成
          </Link>
        </div>
      </div>
      
      <div className="bg-white rounded-lg shadow-md p-6">
        <h1 className="text-2xl font-bold mb-4">
          クイズルーム一覧
          {genre && <span className="ml-2 text-lg text-gray-600">({genre})</span>}
          {unitId && <span className="text-lg text-gray-600"> - 単元ID: {unitId}</span>}
        </h1>
        
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-4">
            {error}
          </div>
        )}
        
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
          </div>
        ) : filteredRooms.length === 0 ? (
          <div className="text-center py-8 border border-dashed border-gray-300 rounded-md">
            <p className="text-gray-500 mb-4">利用可能なルームがありません</p>
            <Link
              href={createRoomLink}
              className="inline-flex items-center bg-indigo-600 text-white px-4 py-2 rounded-md"
            >
              <FaPlus className="mr-2" /> 新しいルームを作成する
            </Link>
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredRooms.map((room) => (
              <div key={room.roomId} className="border border-gray-200 rounded-lg p-4 hover:border-indigo-200 hover:bg-indigo-50 transition">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="font-medium text-lg">{room.name}</h3>
                    <div className="text-gray-600 text-sm flex flex-wrap items-center gap-2">
                      <span>{room.genre}</span>
                      {room.unitId && (
                        <>
                          <span>•</span>
                          <span>単元: {room.unitName || room.unitId}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center">
                    <div className="flex items-center mr-4 text-gray-600 bg-gray-100 px-2 py-1 rounded-full">
                      <FaUsers className="mr-1 text-indigo-500" />
                      <span className="font-medium">{room.participantCount || 0}人</span>
                    </div>
                    <button
                      onClick={() => handleJoinRoom(room.roomId)}
                      disabled={joinLoading && selectedRoomId === room.roomId}
                      className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {joinLoading && selectedRoomId === room.roomId ? (
                        <span className="flex items-center">
                          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          参加中...
                        </span>
                      ) : (
                        <span className="flex items-center">
                          <FaPlay className="mr-2" /> 参加する
                        </span>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// メインのルーム一覧ページコンポーネント
export default function RoomsPage() {
  return (
    <Suspense fallback={<RoomsLoading />}>
      <RoomsContent />
    </Suspense>
  );
}
