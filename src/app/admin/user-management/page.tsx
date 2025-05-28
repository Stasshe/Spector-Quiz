'use client';

import { db } from '@/config/firebase';
import { useAuth } from '@/context/AuthContext';
import { User } from '@/types/user';
import { collection, doc, getDocs, updateDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';

// Firebaseドキュメント情報を含む拡張ユーザータイプ
interface UserWithFirestoreId extends User {
  firestoreId: string;
}

export default function UserManagement() {
  const { currentUser } = useAuth();
  const [users, setUsers] = useState<UserWithFirestoreId[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserWithFirestoreId | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const pageSize = 10;

  // 日付フォーマット用関数
  const formatDate = (timestamp: any) => {
    if (!timestamp) return '不明';
    const date = timestamp.toDate();
    return new Intl.DateTimeFormat('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  // ユーザーデータ取得
  useEffect(() => {
    async function fetchUsers() {
      try {
        setLoading(true);
        const usersSnapshot = await getDocs(collection(db, 'users'));
        let allUsers = usersSnapshot.docs.map(doc => ({
          ...doc.data(),
          userId: doc.data().userId || doc.id,
          firestoreId: doc.id
        })) as UserWithFirestoreId[];
        
        // 検索フィルター
        if (searchTerm) {
          const searchLower = searchTerm.toLowerCase();
          allUsers = allUsers.filter(user => 
            user.userId.toLowerCase().includes(searchLower) || 
            user.username.toLowerCase().includes(searchLower)
          );
        }
        
        // ページネーション用に総ページ数を計算
        setTotalPages(Math.ceil(allUsers.length / pageSize));
        
        // 現在のページのユーザーのみ表示
        const startIndex = (page - 1) * pageSize;
        const endIndex = startIndex + pageSize;
        const paginatedUsers = allUsers.slice(startIndex, endIndex);
        
        setUsers(paginatedUsers);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching users:', err);
        setError('ユーザーデータの取得中にエラーが発生しました');
        setLoading(false);
      }
    }
    
    fetchUsers();
  }, [searchTerm, page]);

  // ユーザー詳細を表示
  const viewUserDetails = (user: UserWithFirestoreId) => {
    setSelectedUser(user);
    setIsModalOpen(true);
  };
  
  // モーダル閉じる
  const closeModal = () => {
    setSelectedUser(null);
    setIsModalOpen(false);
  };
  
  // ユーザーのランク更新
  const updateUserRank = async (userId: string, rank: string) => {
    if (!currentUser) {
      setError('操作するには管理者権限が必要です');
      return;
    }
    
    try {
      // まずユーザーのfirestoreIdを見つける
      const targetUser = users.find(user => user.userId === userId);
      if (!targetUser || !targetUser.firestoreId) {
        setError('ユーザーが見つかりません');
        return;
      }
      
      const userRef = doc(db, 'users', targetUser.firestoreId);
      await updateDoc(userRef, { rank });
      
      // ローカルの状態を更新
      setUsers(prevUsers => 
        prevUsers.map(user => 
          user.userId === userId ? { ...user, rank } : user
        )
      );
      
      // 詳細表示中のユーザーの場合は、選択されたユーザー情報も更新
      if (selectedUser && selectedUser.userId === userId) {
        setSelectedUser({ ...selectedUser, rank });
      }
      
      setError(null);
    } catch (err) {
      console.error('Error updating user rank:', err);
      setError('ユーザーランクの更新中にエラーが発生しました');
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">ユーザー管理</h1>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          <p>{error}</p>
        </div>
      )}
      
      {/* 検索バー */}
      <div className="mb-6">
        <div className="relative w-full md:w-96">
          <input
            type="text"
            placeholder="ユーザーID・名前で検索"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full border border-gray-300 rounded-md py-2 px-4 pl-10 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <div className="absolute inset-y-0 left-0 flex items-center pl-3">
            <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>
      </div>
      
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-pulse text-xl">データを読み込み中...</div>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white border">
              <thead>
                <tr className="bg-gray-100 text-gray-600 uppercase text-sm leading-normal">
                  <th className="py-3 px-6 text-left">ユーザーID</th>
                  <th className="py-3 px-6 text-left">ユーザー名</th>
                  <th className="py-3 px-6 text-center">ランク</th>
                  <th className="py-3 px-6 text-center">経験値</th>
                  <th className="py-3 px-6 text-center">最終ログイン</th>
                  <th className="py-3 px-6 text-center">操作</th>
                </tr>
              </thead>
              <tbody className="text-gray-600">
                {users.map((user) => (
                  <tr key={user.userId} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-6">{user.userId}</td>
                    <td className="py-3 px-6">{user.username}</td>
                    <td className="py-3 px-6 text-center">{user.rank}</td>
                    <td className="py-3 px-6 text-center">{user.exp}</td>
                    <td className="py-3 px-6 text-center">
                      <button
                        onClick={() => viewUserDetails(user)}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-1 px-2 rounded text-xs"
                      >
                        詳細
                      </button>
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-4 px-6 text-center">ユーザーが見つかりません</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          
          {/* ページネーション */}
          {totalPages > 1 && (
            <div className="flex justify-center items-center mt-6">
              <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                <button
                  onClick={() => setPage(prev => Math.max(prev - 1, 1))}
                  disabled={page === 1}
                  className={`relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium ${
                    page === 1 ? 'text-gray-300 cursor-not-allowed' : 'text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  前へ
                </button>
                
                {Array.from({ length: totalPages }).map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setPage(index + 1)}
                    className={`relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium ${
                      page === index + 1 
                      ? 'bg-indigo-600 text-white' 
                      : 'bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {index + 1}
                  </button>
                ))}
                
                <button
                  onClick={() => setPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={page === totalPages}
                  className={`relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium ${
                    page === totalPages ? 'text-gray-300 cursor-not-allowed' : 'text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  次へ
                </button>
              </nav>
            </div>
          )}
        </>
      )}
      
      {/* ユーザー詳細モーダル */}
      {isModalOpen && selectedUser && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4">
            <div className="flex justify-between items-center p-6 border-b">
              <h3 className="text-xl font-semibold">ユーザー詳細</h3>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-500">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div>
                  <h4 className="text-sm font-medium text-gray-500">ユーザーID</h4>
                  <p className="text-lg">{selectedUser.userId}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-500">ユーザー名</h4>
                  <p className="text-lg">{selectedUser.username}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-500">ランク</h4>
                  <div className="flex items-center">
                    <p className="text-lg mr-2">{selectedUser.rank}</p>
                    <select
                      onChange={(e) => updateUserRank(selectedUser.userId, e.target.value)}
                      value={selectedUser.rank}
                      className="border border-gray-300 rounded px-2 py-1 text-sm"
                    >
                      <option value="ビギナー">ビギナー</option>
                      <option value="アドバンスド">アドバンスド</option>
                      <option value="エキスパート">エキスパート</option>
                      <option value="マスター">マスター</option>
                      <option value="管理者">管理者</option>
                    </select>
                  </div>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-500">経験値</h4>
                  <p className="text-lg">{selectedUser.exp}</p>
                </div>
              </div>
              
              <h4 className="font-medium text-lg mb-3">統計情報</h4>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-gray-50 p-3 rounded">
                  <h5 className="text-sm text-gray-500">回答数</h5>
                  <p className="text-lg">{selectedUser.stats?.totalAnswered || 0}</p>
                </div>
                <div className="bg-gray-50 p-3 rounded">
                  <h5 className="text-sm text-gray-500">正解数</h5>
                  <p className="text-lg">{selectedUser.stats?.correctAnswers || 0}</p>
                </div>
                <div className="bg-gray-50 p-3 rounded">
                  <h5 className="text-sm text-gray-500">正答率</h5>
                  <p className="text-lg">
                    {selectedUser.stats?.totalAnswered
                      ? Math.round((selectedUser.stats.correctAnswers / selectedUser.stats.totalAnswered) * 100)
                      : 0}%
                  </p>
                </div>
              </div>
              
              <h4 className="font-medium text-lg mb-3">ジャンル別統計</h4>
              
              <div className="overflow-y-auto max-h-60">
                <table className="min-w-full bg-white border">
                  <thead>
                    <tr className="bg-gray-100 text-gray-600 text-sm leading-normal">
                      <th className="py-2 px-4 text-left">ジャンル</th>
                      <th className="py-2 px-4 text-center">回答数</th>
                      <th className="py-2 px-4 text-center">正解数</th>
                      <th className="py-2 px-4 text-center">正答率</th>
                    </tr>
                  </thead>
                  <tbody className="text-gray-600">
                    {selectedUser.stats && selectedUser.stats.genres ? 
                      Object.entries(selectedUser.stats.genres).map(([genreId, data]) => (
                        <tr key={genreId} className="border-b">
                          <td className="py-2 px-4">{genreId}</td>
                          <td className="py-2 px-4 text-center">{data.totalAnswered}</td>
                          <td className="py-2 px-4 text-center">{data.correctAnswers}</td>
                          <td className="py-2 px-4 text-center">
                            {data.totalAnswered ? Math.round((data.correctAnswers / data.totalAnswered) * 100) : 0}%
                          </td>
                        </tr>
                      ))
                    : (
                      <tr>
                        <td colSpan={4} className="py-4 px-6 text-center">ジャンル別データがありません</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            
            <div className="flex justify-end px-6 py-4 border-t">
              <button 
                onClick={closeModal}
                className="bg-gray-500 hover:bg-gray-600 text-white font-medium py-2 px-4 rounded"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
