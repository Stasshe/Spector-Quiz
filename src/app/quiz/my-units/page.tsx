'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { db } from '@/config/firebase';
import { collection, query, where, getDocs, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { FaArrowLeft, FaPen, FaTrash, FaEye, FaEyeSlash, FaSpinner } from 'react-icons/fa';
import { QuizUnit } from '@/types/quiz';

interface QuizUnitWithId extends QuizUnit {
  unitId: string;
  genreId: string;
}

export default function MyUnitsPage() {
  const { currentUser, userProfile } = useAuth();
  const router = useRouter();
  const [units, setUnits] = useState<QuizUnitWithId[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [visibility, setVisibility] = useState<string | null>(null);

  // ユーザーの単元を取得
  const fetchUserUnits = useCallback(async () => {
    if (!currentUser) return;

    try {
      setLoading(true);
      setError(null);

      // ジャンル一覧を取得
      const genresSnapshot = await getDocs(collection(db, 'genres'));
      const userUnits: QuizUnitWithId[] = [];

      // 各ジャンル内のユーザー作成単元を検索
      for (const genreDoc of genresSnapshot.docs) {
        const unitsQuery = query(
          collection(db, `genres/${genreDoc.id}/quiz_units`),
          where('createdBy', '==', currentUser.uid)
        );

        const unitsSnapshot = await getDocs(unitsQuery);
        
        unitsSnapshot.forEach(unitDoc => {
          const unitData = unitDoc.data() as QuizUnit;
          userUnits.push({
            ...unitData,
            unitId: unitDoc.id,
            genreId: genreDoc.id
          });
        });
      }

      // 最新の作成順にソート
      userUnits.sort((a, b) => {
        const dateA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const dateB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return dateB - dateA;
      });

      setUnits(userUnits);
    } catch (err) {
      console.error('単元の取得中にエラーが発生しました:', err);
      setError('単元の取得中にエラーが発生しました。後でもう一度お試しください。');
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  // ページ読み込み時に単元を取得
  useEffect(() => {
    if (!currentUser) {
      router.push('/auth/login');
      return;
    }

    fetchUserUnits();
  }, [currentUser, fetchUserUnits, router]);

  // 単元の公開/非公開を切り替える
  const toggleVisibility = async (unit: QuizUnitWithId) => {
    if (!currentUser) return;

    try {
      setVisibility(unit.unitId);
      const unitRef = doc(db, `genres/${unit.genreId}/quiz_units`, unit.unitId);
      await updateDoc(unitRef, {
        isPublic: !unit.isPublic
      });

      // 状態を更新
      setUnits(prevUnits => 
        prevUnits.map(u => 
          u.unitId === unit.unitId 
            ? {...u, isPublic: !u.isPublic} 
            : u
        )
      );
    } catch (err) {
      console.error('単元の公開状態の更新中にエラーが発生しました:', err);
      setError('単元の公開状態の更新中にエラーが発生しました');
    } finally {
      setVisibility(null);
    }
  };

  // 単元を削除
  const deleteUnit = async (unit: QuizUnitWithId) => {
    if (!currentUser || !window.confirm('この単元を削除してもよろしいですか？この操作は元に戻せません。')) {
      return;
    }

    try {
      setDeleting(unit.unitId);
      const unitRef = doc(db, `genres/${unit.genreId}/quiz_units`, unit.unitId);
      await deleteDoc(unitRef);

      // 状態を更新
      setUnits(prevUnits => prevUnits.filter(u => u.unitId !== unit.unitId));
    } catch (err) {
      console.error('単元の削除中にエラーが発生しました:', err);
      setError('単元の削除中にエラーが発生しました');
    } finally {
      setDeleting(null);
    }
  };

  // ユーザー未ログインの場合
  if (!currentUser) {
    return null; // useEffectでリダイレクト
  }

  return (
    <div className="app-container py-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <Link href="/quiz" className="flex items-center text-indigo-600 hover:text-indigo-800 transition-colors">
            <FaArrowLeft className="mr-2" /> クイズ一覧に戻る
          </Link>
        </div>

        <div className="card">
          <div className="flex items-center mb-8">
            <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-xl flex items-center justify-center text-white shadow-md mr-4">
              <FaPen className="text-2xl" />
            </div>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 text-transparent bg-clip-text">
                マイクイズ単元
              </h1>
              <p className="text-gray-600">
                あなたが作成したクイズ単元の管理
              </p>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 rounded-lg mb-6">
              <div className="flex">
                <div className="ml-3">
                  <p>{error}</p>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end mb-4">
            <Link href="/quiz/create-quiz" className="btn-primary flex items-center">
              <FaPen className="mr-2" /> 新しい単元を作成
            </Link>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <FaSpinner className="animate-spin text-indigo-600 text-4xl" />
            </div>
          ) : units.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg">
              <p className="text-lg text-gray-500">まだクイズ単元を作成していません</p>
              <p className="text-gray-400 mt-2">「新しい単元を作成」ボタンをクリックして、最初の単元を作りましょう！</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full bg-white">
                <thead>
                  <tr className="bg-gray-50 text-gray-600 uppercase text-sm leading-normal">
                    <th className="py-3 px-6 text-left">単元名</th>
                    <th className="py-3 px-6 text-center">ジャンル</th>
                    <th className="py-3 px-6 text-center">クイズ数</th>
                    <th className="py-3 px-6 text-center">使用回数</th>
                    <th className="py-3 px-6 text-center">公開状態</th>
                    <th className="py-3 px-6 text-center">操作</th>
                  </tr>
                </thead>
                <tbody className="text-gray-600 text-sm">
                  {units.map(unit => (
                    <tr key={unit.unitId} className="border-b border-gray-200 hover:bg-gray-50">
                      <td className="py-3 px-6">
                        <div className="font-medium">{unit.title}</div>
                        <div className="text-xs text-gray-500">
                          {new Date(unit.createdAt?.toMillis ? unit.createdAt.toMillis() : 0).toLocaleDateString('ja-JP')} 作成
                        </div>
                      </td>
                      <td className="py-3 px-6 text-center">{unit.genreId}</td>
                      <td className="py-3 px-6 text-center">{unit.quizCount}</td>
                      <td className="py-3 px-6 text-center">{unit.useCount || 0}</td>
                      <td className="py-3 px-6 text-center">
                        <span className={`px-2 py-1 rounded text-white text-xs ${unit.isPublic ? 'bg-green-500' : 'bg-gray-500'}`}>
                          {unit.isPublic ? '公開中' : '非公開'}
                        </span>
                      </td>
                      <td className="py-3 px-6 text-center">
                        <div className="flex items-center justify-center space-x-2">
                          <Link 
                            href={`/quiz/create-quiz?genreId=${unit.genreId}&unitId=${unit.unitId}&edit=true`}
                            className="text-blue-600 hover:text-blue-900 p-1"
                            title="編集"
                          >
                            <FaPen />
                          </Link>
                          <button 
                            onClick={() => toggleVisibility(unit)}
                            disabled={visibility === unit.unitId}
                            className={`${
                              unit.isPublic 
                                ? 'text-yellow-600 hover:text-yellow-900' 
                                : 'text-green-600 hover:text-green-900'
                            } p-1`}
                            title={unit.isPublic ? '非公開にする' : '公開する'}
                          >
                            {visibility === unit.unitId ? (
                              <FaSpinner className="animate-spin" />
                            ) : unit.isPublic ? (
                              <FaEyeSlash />
                            ) : (
                              <FaEye />
                            )}
                          </button>
                          <button 
                            onClick={() => deleteUnit(unit)}
                            disabled={deleting === unit.unitId}
                            className="text-red-600 hover:text-red-900 p-1"
                            title="削除"
                          >
                            {deleting === unit.unitId ? (
                              <FaSpinner className="animate-spin" />
                            ) : (
                              <FaTrash />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
