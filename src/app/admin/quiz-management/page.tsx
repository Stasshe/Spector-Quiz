'use client';

import { useState, useEffect, useCallback } from 'react';
import { db } from '@/config/firebase';
import { collection, getDocs, query, where, doc, updateDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { genreClasses, GenreInfo } from '@/constants/genres';

// 公式クイズ単元のインターフェース
interface OfficialQuizUnit {
  unitId: string;
  title: string;
  category: string;
  genre: string;
  description?: string;
  quizCount: number;
  useCount: number;
  isPublic: boolean;
  createdAt: any;
  averageDifficulty?: number;
}

// カテゴリとそれに属する単元情報
interface CategoryWithUnits {
  category: string;
  units: OfficialQuizUnit[];
}

export default function QuizManagement() {
  const { currentUser } = useAuth();
  const [officialUnitsByCategory, setOfficialUnitsByCategory] = useState<CategoryWithUnits[]>([]);
  const [selectedGenre, setSelectedGenre] = useState<string>('日本史');
  const [loading, setLoading] = useState(true);
  const [genres, setGenres] = useState<GenreInfo[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  // ジャンルデータを定数から取得
  const fetchGenresFromConstants = useCallback(() => {
    try {
      // genreClassesから「すべて」グループ内のジャンルを取得
      const allGenres = genreClasses.find(gc => gc.name === 'すべて')?.genres || [];
      setGenres(allGenres);
      
      // 最初のジャンルをデフォルトで選択
      if (allGenres.length > 0 && !selectedGenre) {
        setSelectedGenre(allGenres[0].name);
      }
      
      return allGenres;
    } catch (err) {
      console.error('Error fetching genres from constants:', err);
      setError('ジャンル情報の取得中にエラーが発生しました');
      return [];
    }
  }, [selectedGenre]);

  // 公式クイズ単元を取得
  const fetchOfficialUnitsByCategory = useCallback(async (genreName: string) => {
    if (!genreName) {
      return [];
    }

    try {
      setLoading(true);
      console.log(`Fetching official quiz units for genre: ${genreName}`);
      
      // 現在のジャンル配下のofficial_quiz_unitsコレクションからクエリを実行
      // ドキュメントIDはそのままジャンル名を使用
      const genreDocId = genreName;
      console.log(`Using genre document ID: ${genreDocId}`);
      
      const unitsQuery = query(
        collection(db, `genres/${genreDocId}/official_quiz_units`)
      );
      
      const unitsSnapshot = await getDocs(unitsQuery);
      
      // 既存のデータをマッピング
      const existingUnitsMap = new Map<string, OfficialQuizUnit>();
      unitsSnapshot.forEach(doc => {
        const data = doc.data() as Omit<OfficialQuizUnit, 'unitId'>;
        const unit = {
          ...data,
          unitId: doc.id,
        } as OfficialQuizUnit;
        existingUnitsMap.set(`${unit.category}-${unit.title}`, unit);
      });
      
      // ジャンルから対応するカテゴリと単元情報を取得
      const genreInfo = genres.find(g => g.name === genreName);
      if (!genreInfo) {
        setOfficialUnitsByCategory([]);
        setLoading(false);
        return [];
      }
      
      // カテゴリごとにunitsByCategory配列を構築
      const categoriesWithUnits: CategoryWithUnits[] = [];
      
      for (const [category, unitNames] of Object.entries(genreInfo.units)) {
        const units: OfficialQuizUnit[] = [];
        
        // constants/genresから定義されている単元をベースにデータを構築
        for (const unitName of unitNames) {
          const mapKey = `${category}-${unitName}`;
          if (existingUnitsMap.has(mapKey)) {
            // Firestoreに既に存在する単元を追加
            units.push(existingUnitsMap.get(mapKey)!);
          } else {
            // Firestoreにまだない単元はデフォルト値で表示
            units.push({
              unitId: '',  // IDはまだ割り当てられていない
              title: unitName,
              category: category,
              genre: genreName,
              description: `${genreName}の${category}における${unitName}に関する単元です`,
              quizCount: 0,
              useCount: 0,
              isPublic: false,  // 未作成なのでデフォルトでは非公開
              createdAt: null,
              averageDifficulty: 3
            });
          }
        }
        
        categoriesWithUnits.push({
          category,
          units
        });
      }
      
      setOfficialUnitsByCategory(categoriesWithUnits);
      setLoading(false);
      return categoriesWithUnits;
      
    } catch (err) {
      console.error('Error fetching official units:', err);
      setError('公式単元の取得中にエラーが発生しました');
      setLoading(false);
      return [];
    }
  }, [genres]);

  // 単元を公開/非公開に切り替える
  const toggleUnitVisibility = async (unit: OfficialQuizUnit) => {
    if (!currentUser) {
      setError('操作するには管理者権限が必要です');
      return;
    }
    
    // 管理者権限の確認とログ出力
    console.log(`現在のユーザーID: ${currentUser.uid}`);
    console.log(`管理者かどうか: ${currentUser.uid === '100000' ? '管理者です' : '管理者ではありません'}`);
    
    try {
      // 単元がまだFirestoreに存在しない場合は作成
      if (!unit.unitId) {
        // ジャンル名をそのままドキュメントIDとして使用
        const genreDocId = unit.genre;
        console.log(`使用するジャンルID: ${genreDocId}`);
        
        try {
          // 新規単元を作成 - ジャンル配下のコレクションに追加
          const newUnitRef = await addDoc(collection(db, `genres/${genreDocId}/official_quiz_units`), {
          title: unit.title,
          category: unit.category,
          genre: unit.genre,
          description: unit.description || `${unit.genre}の${unit.category}における${unit.title}に関する単元です`,
          quizCount: 0,
          useCount: 0,
          isPublic: true, // 新規作成して公開
          createdAt: serverTimestamp(),
          averageDifficulty: 3
        });
        
        // ローカル状態を更新
        setOfficialUnitsByCategory(prevCategories => 
          prevCategories.map(category => ({
            ...category,
            units: category.units.map(u =>
              u.title === unit.title && u.category === unit.category && u.genre === unit.genre
                ? { 
                    ...u, 
                    unitId: newUnitRef.id, 
                    isPublic: true 
                  } 
                : u
            )
          }))
        );
        } catch (err) {
          console.error('Error creating official unit:', err);
          setError(`単元の作成中にエラーが発生しました: ${err}`);
        }
      } else {
        // 既存の単元を更新 - ジャンル配下のコレクションのドキュメントを参照
        const genreDocId = unit.genre;
        const unitRef = doc(db, `genres/${genreDocId}/official_quiz_units`, unit.unitId);
        await updateDoc(unitRef, {
          isPublic: !unit.isPublic
        });
        
        // ローカル状態を更新
        setOfficialUnitsByCategory(prevCategories => 
          prevCategories.map(category => ({
            ...category,
            units: category.units.map(u =>
              u.unitId === unit.unitId 
                ? { ...u, isPublic: !u.isPublic } 
                : u
            )
          }))
        );
      }
    } catch (err) {
      console.error('Error toggling unit visibility:', err);
      setError('単元の公開状態の更新中にエラーが発生しました');
    }
  };
  
  useEffect(() => {
    // 初期データロード - constants/genresからジャンルとカテゴリを取得
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // ジャンル一覧を定数から取得
        fetchGenresFromConstants();
      } catch (err) {
        console.error('Error loading data:', err);
        setError('データの読み込み中にエラーが発生しました');
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, [fetchGenresFromConstants]);

  // 選択されたジャンルが変更されたら単元を取得
  useEffect(() => {
    if (selectedGenre) {
      fetchOfficialUnitsByCategory(selectedGenre);
    }
  }, [selectedGenre, fetchOfficialUnitsByCategory]);
  
  // ジャンル変更時の処理
  const handleGenreChange = (genreName: string) => {
    setSelectedGenre(genreName);
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
            <option key={genre.name} value={genre.name}>
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
            <h2 className="text-xl font-semibold">公式単元一覧</h2>
            <div className="text-sm text-gray-500">
              ※ 公式クイズの単元情報は constants/genres.ts で定義されています
            </div>
          </div>
          
          {officialUnitsByCategory.length === 0 ? (
            <div className="p-8 text-center text-gray-600">
              このジャンルには単元が定義されていません
            </div>
          ) : (
            officialUnitsByCategory.map((categoryData) => (
              <div key={categoryData.category} className="mb-8">
                <h3 className="text-lg font-semibold bg-gray-100 p-3 mb-3 rounded-t border-l-4 border-indigo-500">
                  {categoryData.category}
                </h3>
                
                <div className="overflow-x-auto">
                  <table className="min-w-full bg-white border">
                    <thead>
                      <tr className="bg-gray-50 text-gray-600 uppercase text-sm leading-normal">
                        <th className="py-3 px-6 text-left">単元名</th>
                        <th className="py-3 px-6 text-center">クイズ数</th>
                        <th className="py-3 px-6 text-center">使用回数</th>
                        <th className="py-3 px-6 text-center">公開状態</th>
                        <th className="py-3 px-6 text-center">操作</th>
                      </tr>
                    </thead>
                    <tbody className="text-gray-600">
                      {categoryData.units.map((unit, index) => (
                        <tr key={unit.unitId || `temp-${index}`} className="border-b hover:bg-gray-50">
                          <td className="py-3 px-6">{unit.title}</td>
                          <td className="py-3 px-6 text-center">{unit.quizCount || 0}</td>
                          <td className="py-3 px-6 text-center">{unit.useCount || 0}</td>
                          <td className="py-3 px-6 text-center">
                            <span className={`px-2 py-1 rounded text-white text-xs ${
                              unit.unitId && unit.isPublic ? 'bg-green-500' : 'bg-gray-500'
                            }`}>
                              {unit.unitId 
                                ? (unit.isPublic ? '公開' : '非公開') 
                                : '未作成'}
                            </span>
                          </td>
                          <td className="py-3 px-6 text-center">
                            <div className="flex items-center justify-center gap-2">
                              {unit.unitId ? (
                                <>
                                  <Link 
                                    href={`/quiz/create-quiz?officialGenre=true&genreId=${unit.genre}&officialCategory=${unit.category}&officialUnit=${unit.title}&unitId=${unit.unitId}&edit=true`}
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
                                </>
                              ) : (
                                <button
                                  onClick={() => toggleUnitVisibility(unit)}
                                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-1 px-2 rounded text-xs"
                                >
                                  作成・公開
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))
          )}
        </>
      )}
    </div>
  );
}
