'use client';

import { useState, useEffect, useCallback } from 'react';
import { useQuiz as useQuizContext } from '@/context/QuizContext';
import { db } from '@/config/firebase';
import { doc, getDoc, collection, query, where, getDocs, updateDoc, increment, setDoc } from 'firebase/firestore';
import { Quiz } from '@/types/quiz';

export function useQuizHook() {
  const { currentQuiz, setCurrentQuiz, quizRoom } = useQuizContext();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [genres, setGenres] = useState<string[]>([]);
  const [units, setUnits] = useState<{ [genre: string]: { [category: string]: string[] } }>({});

  // 特定のジャンルの単元を取得（クラスタイプ別）
  const fetchUnitsForGenre = useCallback(async (genreId: string, classType: string = '公式') => {
    try {
      setLoading(true);
      const isUserCreated = classType === 'ユーザー作成';
      
      if (isUserCreated) {
        // ユーザー作成の場合: Firestoreからユーザー作成単元をフラットなリストで表示
        const unitsRef = collection(db, 'genres', genreId, 'quiz_units');
        // ユーザー作成の単元を取得（インデックスなし）
        const unitsSnap = await getDocs(unitsRef);
        
        // ユーザー作成単元はカテゴリなしでフラットに表示
        // ゆえに、一つのカテゴリに全単元を入れる
        const unitList: string[] = [];
        
        unitsSnap.forEach(unitDoc => {
          const unitData = unitDoc.data();
          if (unitData.title) {
            unitList.push(unitData.title);
          }
        });
        
        // カテゴリマップを作成（カテゴリは「単元」のみで全てフラット）
        const categoryMap: { [category: string]: string[] } = {
          '単元': unitList
        };
        
        // 単元が一つもない場合
        if (unitList.length === 0) {
          categoryMap['単元'] = [];
        }
        
        // クラスタイプごとに分けて保存
        setUnits(prevUnits => ({
          ...prevUnits,
          [`${genreId}_${classType}`]: categoryMap
        }));
        
        return categoryMap;
      } else {
        // 公式の場合: genres.tsを参照して、定義済みの構造を使用
        try {
          // genres.tsからデータを取得（公式クイズは常にgenres.tsから取得）
          const { genreClasses } = await import('@/constants/genres');
          
          // 該当するジャンルのデータを検索
          const genreInfo = genreClasses
            .find(gc => gc.name === 'すべて')?.genres
            .find(g => g.name === genreId);
          
          if (genreInfo && genreInfo.units) {
            // ユーザー作成カテゴリは除外
            const filteredUnits = { ...genreInfo.units };
            if (filteredUnits['ユーザー作成']) {
              delete filteredUnits['ユーザー作成'];
            }
            
            // クラスタイプごとに分けて保存
            setUnits(prevUnits => ({
              ...prevUnits,
              [`${genreId}_${classType}`]: filteredUnits
            }));
            
            return filteredUnits;
          } else {
            // genres.tsに該当ジャンルが見つからない場合は空のマップを返す
            const emptyMap = { '単元': [] };
            setUnits(prevUnits => ({
              ...prevUnits,
              [`${genreId}_${classType}`]: emptyMap
            }));
            return emptyMap;
          }
        } catch (importErr) {
          console.error('Error importing genres.ts:', importErr);
          const emptyMap = { '単元': [] };
          setUnits(prevUnits => ({
            ...prevUnits,
            [`${genreId}_${classType}`]: emptyMap
          }));
          return emptyMap;
        }
      }
      
      return {};
    } catch (err) {
      console.error(`Error fetching units for genre ${genreId}:`, err);
      setError('単元一覧の取得中にエラーが発生しました');
      return {};
    } finally {
      setLoading(false);
    }
  }, []);

  // 利用可能なジャンル一覧を取得（単元は必要になったときだけ取得）
  const fetchGenres = useCallback(async (defaultClassType: string = '公式') => {
    try {
      setLoading(true);
      
      // ジャンルコレクションから取得
      const genresRef = collection(db, 'genres');
      const genresSnap = await getDocs(genresRef);
      
      const genreArray: string[] = [];
      
      // ジャンル名のリストだけを取得
      genresSnap.forEach(doc => {
        genreArray.push(doc.id);
      });
      
      setGenres(genreArray);
      
      // 最初のジャンルの単元を取得（デフォルトクラスタイプで）
      // unitsの状態に依存せず、最初のジャンルの単元を常に取得するように変更
      if (genreArray.length > 0) {
        fetchUnitsForGenre(genreArray[0], defaultClassType);
      }
    } catch (err) {
      console.error('Error fetching genres:', err);
      setError('ジャンル一覧の取得中にエラーが発生しました');
    } finally {
      setLoading(false);
    }
  }, [fetchUnitsForGenre]); // unitsを依存配列から削除

  // 特定のクイズを取得
  const fetchQuiz = useCallback(async (genreId: string, unitId: string, quizId: string) => {
    try {
      setLoading(true);
      const quizRef = doc(db, 'genres', genreId, 'quiz_units', unitId, 'quizzes', quizId);
      const quizSnap = await getDoc(quizRef);
      
      if (quizSnap.exists()) {
        const quizData = quizSnap.data() as Omit<Quiz, 'quizId'>;
        // 参照用にジャンルIDを追加
        const quiz = { 
          ...quizData, 
          quizId: quizSnap.id,
          genre: genreId
        } as Quiz;
        
        setCurrentQuiz(quiz);
        return quiz;
      } else {
        throw new Error('クイズが見つかりません');
      }
    } catch (err: any) {
      console.error('Error fetching quiz:', err);
      setError(err.message || 'クイズの取得中にエラーが発生しました');
      return null;
    } finally {
      setLoading(false);
    }
  }, [setCurrentQuiz]);

  // ジャンルと単元に基づいてクイズを検索
  const searchQuizzes = useCallback(async (genreId: string, unitId: string) => {
    try {
      setLoading(true);
      
      const quizzesRef = collection(db, 'genres', genreId, 'quiz_units', unitId, 'quizzes');
      const quizzesSnap = await getDocs(quizzesRef);
      const quizzes: Quiz[] = [];
      
      quizzesSnap.forEach(doc => {
        const quizData = doc.data() as Omit<Quiz, 'quizId'>;
        quizzes.push({ 
          ...quizData, 
          quizId: doc.id,
          genre: genreId
        });
      });
      
      return quizzes;
    } catch (err) {
      console.error('Error searching quizzes:', err);
      setError('クイズの検索中にエラーが発生しました');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  // ジャンルと単元の利用回数を更新
  const updateGenreStats = useCallback(async (genre: string, unitId?: string) => {
    try {
      // ジャンル統計のドキュメントを取得または作成
      const genreStatsRef = doc(db, 'genreStats', genre);
      const genreStatsSnap = await getDoc(genreStatsRef);
      
      if (genreStatsSnap.exists()) {
        // 既存のジャンル統計を更新
        const genreData = genreStatsSnap.data();
        const unitsMap = genreData.units || {};
        
        if (unitId && unitsMap[unitId]) {
          // 既存の単元の利用回数を増加
          await updateDoc(genreStatsRef, {
            useCount: increment(1),
            [`units.${unitId}.useCount`]: increment(1)
          });
        } else if (unitId) {
          // 新しい単元を追加して利用回数を1に設定
          const updatedUnits = { ...unitsMap };
          updatedUnits[unitId] = { useCount: 1 };
          await updateDoc(genreStatsRef, {
            useCount: increment(1),
            units: updatedUnits
          });
        } else {
          // 単元が指定されていない場合はジャンルのカウントのみアップ
          await updateDoc(genreStatsRef, {
            useCount: increment(1)
          });
        }
      } else {
        // ジャンル統計を新規作成
        await setDoc(genreStatsRef, {
          useCount: 1,
          units: unitId ? {
            [unitId]: { useCount: 1 }
          } : {}
        });
      }
    } catch (err) {
      console.error('Error updating genre stats:', err);
    }
  }, []);

  // クイズルームでの現在のクイズ状態を監視
  useEffect(() => {
    if (!quizRoom) return;
    
    // 現在のクイズIDが変わったら、そのクイズを取得
    const currentQuizId = quizRoom.quizIds?.[quizRoom.currentQuizIndex];
    
    if (currentQuizId && (!currentQuiz || currentQuiz.quizId !== currentQuizId)) {
      // ジャンルと単元IDから新しい階層構造でクイズを取得
      const genre = quizRoom.genre;
      const unitId = quizRoom.unitId;
      
      if (unitId && genre) {
        fetchQuiz(genre, unitId, currentQuizId);
      } else {
        console.error('Quiz room is missing genre or unitId');
        setError('クイズルームの情報が不完全です');
      }
    }
  }, [quizRoom, currentQuiz, fetchQuiz]);

  // genres.tsからローカルデータを使用してunitsを初期化するフォールバック機能
  useEffect(() => {
    if (genres.length > 0) {
      // Firestoreから取得したデータが空の場合、ローカルのgenres.tsのデータを使用
      import('@/constants/genres').then(({ genreClasses }) => {
        // 最新のunitsの状態を確認するためにコールバック形式を使用
        setUnits(prevUnits => {
          // ユニットデータがすでに存在する場合は何もしない
          if (Object.keys(prevUnits).length > 0) {
            return prevUnits;
          }
          
          const localUnitMap: { [genre: string]: { [category: string]: string[] } } = {};
          
          for (const genreClass of genreClasses) {
            for (const genreInfo of genreClass.genres) {
              if (genres.includes(genreInfo.name)) {
                localUnitMap[genreInfo.name] = genreInfo.units;
              }
            }
          }
          
          if (Object.keys(localUnitMap).length > 0) {
            console.log('Firestoreのユニットデータがないためローカルデータをフォールバックとして使用します');
            return localUnitMap;
          }
          
          return prevUnits;
        });
      });
    }
  }, [genres]); // unitsを依存配列から削除し、関数型のsetStateを使用して最新の状態を参照

  return {
    currentQuiz,
    genres,
    units,
    loading,
    error,
    fetchGenres,
    fetchUnitsForGenre,
    fetchQuiz,
    searchQuizzes,
    updateGenreStats
  };
}

// 外部からimportする時にuseQuizという名前で使えるように、エイリアスを設定
export const useQuiz = useQuizContext;
