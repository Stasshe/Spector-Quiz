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
  const [subgenres, setSubgenres] = useState<{ [genre: string]: string[] }>({});

  // 利用可能なジャンル一覧を取得（新DB構造対応）
  const fetchGenres = useCallback(async () => {
    try {
      setLoading(true);
      
      // ジャンルコレクションから取得
      const genresRef = collection(db, 'genres');
      const genresSnap = await getDocs(genresRef);
      
      const genreArray: string[] = [];
      
      // 各ジャンルについて処理
      for (const genreDoc of genresSnap.docs) {
        const genreId = genreDoc.id;
        genreArray.push(genreId);
      }
      
      setGenres(genreArray);
      // サブジャンルは廃止されたため空オブジェクトをセット
      setSubgenres({});
    } catch (err) {
      console.error('Error fetching genres:', err);
      setError('ジャンル一覧の取得中にエラーが発生しました');
    } finally {
      setLoading(false);
    }
  }, []);
  
  // 後方互換性のため、古い取得方法も保持
  const fetchGenresLegacy = useCallback(async () => {
    try {
      setLoading(true);
      const quizzesRef = collection(db, 'quizzes');
      const quizzesSnap = await getDocs(quizzesRef);
      
      const genreSet = new Set<string>();
      const subgenreMap: { [genre: string]: Set<string> } = {};
      
      quizzesSnap.forEach(doc => {
        const quizData = doc.data() as Quiz;
        // genreが存在する場合のみ処理
        if (quizData.genre) {
          genreSet.add(quizData.genre);
        }
      });
      
      const genreArray = Array.from(genreSet);
      const subgenreObject: { [genre: string]: string[] } = {};
      
      for (const [genre, subgenreSet] of Object.entries(subgenreMap)) {
        subgenreObject[genre] = Array.from(subgenreSet);
      }
      
      setGenres(genreArray);
      setSubgenres(subgenreObject);
    } catch (err) {
      console.error('Error fetching genres:', err);
      setError('ジャンル一覧の取得中にエラーが発生しました');
    } finally {
      setLoading(false);
    }
  }, []);

  // 特定のクイズを取得（新DB構造対応）
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
  
  // 後方互換性のため、クイズIDだけで取得する方法も残す
  const fetchQuizLegacy = useCallback(async (quizId: string) => {
    try {
      setLoading(true);
      const quizRef = doc(db, 'quizzes', quizId);
      const quizSnap = await getDoc(quizRef);
      
      if (quizSnap.exists()) {
        const quizData = quizSnap.data() as Omit<Quiz, 'quizId'>;
        setCurrentQuiz({ ...quizData, quizId: quizSnap.id });
        return { ...quizData, quizId: quizSnap.id } as Quiz;
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

  // ジャンルと単元に基づいてクイズを検索（新DB構造対応）
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
  
  // 後方互換性のため、古い検索方法も残す
  const searchQuizzesLegacy = useCallback(async (genre: string, unitId?: string) => {
    try {
      setLoading(true);
      
      let quizQuery;
      
      // 新しい構造では単元IDで絞り込む
      if (unitId) {
        quizQuery = query(
          collection(db, 'quizzes'),
          where('genre', '==', genre),
          where('unitId', '==', unitId)
        );
      } else {
        quizQuery = query(
          collection(db, 'quizzes'),
          where('genre', '==', genre)
        );
      }
      
      const quizSnap = await getDocs(quizQuery);
      const quizzes: Quiz[] = [];
      
      quizSnap.forEach(doc => {
        const quizData = doc.data() as Omit<Quiz, 'quizId'>;
        quizzes.push({ ...quizData, quizId: doc.id });
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
      // 単元IDがある場合は新しい階層構造から取得
      const genre = quizRoom.genre;
      const unitId = quizRoom.unitId;
      
      if (unitId && genre) {
        fetchQuiz(genre, unitId, currentQuizId);
      } else {
        // 旧構造の場合は従来のメソッドを使用
        fetchQuizLegacy(currentQuizId);
      }
    }
  }, [quizRoom, currentQuiz, fetchQuiz, fetchQuizLegacy]);

  return {
    currentQuiz,
    genres,
    subgenres,
    loading,
    error,
    fetchGenres,
    fetchGenresLegacy,
    fetchQuiz,
    fetchQuizLegacy,
    searchQuizzes,
    searchQuizzesLegacy,
    updateGenreStats
  };
}

// 外部からimportする時にuseQuizという名前で使えるように、エイリアスを設定
export const useQuiz = useQuizContext;
