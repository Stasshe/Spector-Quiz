'use client';

import { useState, useEffect, useCallback } from 'react';
import { db } from '@/config/firebase';
import { collection, getDocs, query, where, orderBy, limit, doc, updateDoc, deleteDoc, getDoc } from 'firebase/firestore';
import { QuizUnit } from '@/types/quiz';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useQuizUnit } from '@/hooks/useQuizUnit';

export default function QuizManagement() {
  const { currentUser } = useAuth();
  const { fetchUnitsByGenre } = useQuizUnit();
  const [units, setUnits] = useState<QuizUnit[]>([]);
  const [selectedGenre, setSelectedGenre] = useState<string>('日本史');
  const [loading, setLoading] = useState(true);
  const [genres, setGenres] = useState<{id: string, name: string}[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  // ジャンルデータを取得
  const fetchGenres = useCallback(async () => {
    try {
      const genresSnapshot = await getDocs(collection(db, 'genres'));
      const genresData = genresSnapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name || doc.id
      }));
      
      setGenres(genresData);
      return genresData;
    } catch (err) {
      console.error('Error fetching genres:', err);
      setError('ジャンルの取得中にエラーが発生しました');
      return [];
    }
  }, []);

  // 単元を公開/非公開に切り替える
  const toggleUnitVisibility = async (unit: QuizUnit) => {
    if (!currentUser) {
      setError('操作するには管理者権限が必要です');
      return;
    }
    
    try {
      const unitRef = doc(db, 'genres', unit.genre || '', 'quiz_units', unit.unitId);
      await updateDoc(unitRef, {
        isPublic: !unit.isPublic
      });
      
      // ローカル状態を更新
      setUnits(prevUnits => 
        prevUnits.map(u => 
          u.unitId === unit.unitId 
          ? { ...u, isPublic: !u.isPublic } 
          : u
        )
      );
    } catch (err) {
      console.error('Error toggling unit visibility:', err);
      setError('単元の公開状態の更新中にエラーが発生しました');
    }
  };
  
  useEffect(() => {
    // 初期データロード
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // ジャンル一覧を取得
        const genresData = await fetchGenres();
        
        if (genresData.length > 0) {
          // 最初のジャンルを選択状態にする
          const firstGenre = genresData[0].id;
          setSelectedGenre(firstGenre);
          
          // 選択したジャンルの単元を取得
          const units = await fetchUnitsByGenre(firstGenre);
          setUnits(units);
        }
      } catch (err) {
        console.error('Error loading data:', err);
        setError('データの読み込み中にエラーが発生しました');
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, [fetchGenres, fetchUnitsByGenre]);
  
  // ジャンル変更時に単元を再取得
  const handleGenreChange = async (genreId: string) => {
    try {
      setLoading(true);
      setSelectedGenre(genreId);
      
      const units = await fetchUnitsByGenre(genreId);
      setUnits(units);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching units for genre:', err);
      setError('単元の取得中にエラーが発生しました');
      setLoading(false);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">公式クイズ管理</h1>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          <p>{error}</p>
        </div>
      )}
      
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          ジャンル選択
        </label>
        <select
          value={selectedGenre}
          onChange={(e) => handleGenreChange(e.target.value)}
          className="border border-gray-300 rounded-md p-2 w-full md:w-1/3"
        >
          {genres.map((genre) => (
            <option key={genre.id} value={genre.id}>
              {genre.name}
            </option>
          ))}
        </select>
      </div>
      
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-pulse text-xl">データを読み込み中...</div>
        </div>
      ) : (
        <>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">単元一覧</h2>
            <Link
              href="/quiz/create-quiz"
              className="bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded"
            >
              新規単元作成
            </Link>
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white border">
              <thead>
                <tr className="bg-gray-100 text-gray-600 uppercase text-sm leading-normal">
                  <th className="py-3 px-6 text-left">単元名</th>
                  <th className="py-3 px-6 text-left">説明</th>
                  <th className="py-3 px-6 text-center">クイズ数</th>
                  <th className="py-3 px-6 text-center">使用回数</th>
                  <th className="py-3 px-6 text-center">公開状態</th>
                  <th className="py-3 px-6 text-center">操作</th>
                </tr>
              </thead>
              <tbody className="text-gray-600">
                {units.map((unit) => (
                  <tr key={unit.unitId} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-6">{unit.title}</td>
                    <td className="py-3 px-6">{unit.description || '説明なし'}</td>
                    <td className="py-3 px-6 text-center">{unit.quizCount || 0}</td>
                    <td className="py-3 px-6 text-center">{unit.useCount || 0}</td>
                    <td className="py-3 px-6 text-center">
                      <span className={`px-2 py-1 rounded text-white text-xs ${
                        unit.isPublic ? 'bg-green-500' : 'bg-gray-500'
                      }`}>
                        {unit.isPublic ? '公開' : '非公開'}
                      </span>
                    </td>
                    <td className="py-3 px-6 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <Link 
                          href={`/quiz/create-quiz?genreId=${unit.genre}&unitId=${unit.unitId}&edit=true`}
                          className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-1 px-2 rounded text-xs"
                        >
                          編集
                        </Link>
                        <button
                          onClick={() => toggleUnitVisibility(unit)}
                          className={`text-white font-medium py-1 px-2 rounded text-xs ${
                            unit.isPublic 
                            ? 'bg-yellow-600 hover:bg-yellow-700' 
                            : 'bg-green-600 hover:bg-green-700'
                          }`}
                        >
                          {unit.isPublic ? '非公開に' : '公開に'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {units.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-4 px-6 text-center">単元がありません</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
