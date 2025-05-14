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

  // 利用可能なジャンル一覧を取得
  const fetchGenres = useCallback(async () => {
    try {
      setLoading(true);
      const quizzesRef = collection(db, 'quizzes');
      const quizzesSnap = await getDocs(quizzesRef);
      
      const genreSet = new Set<string>();
      const subgenreMap: { [genre: string]: Set<string> } = {};
      
      quizzesSnap.forEach(doc => {
        const quizData = doc.data() as Quiz;
        genreSet.add(quizData.genre);
        
        if (!subgenreMap[quizData.genre]) {
          subgenreMap[quizData.genre] = new Set<string>();
        }
        
        subgenreMap[quizData.genre].add(quizData.subgenre);
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

  // 特定のクイズを取得
  const fetchQuiz = useCallback(async (quizId: string) => {
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

  // ジャンルとサブジャンルに基づいてクイズを検索
  const searchQuizzes = useCallback(async (genre: string, subgenre?: string) => {
    try {
      setLoading(true);
      
      let quizQuery;
      
      if (subgenre) {
        quizQuery = query(
          collection(db, 'quizzes'),
          where('genre', '==', genre),
          where('subgenre', '==', subgenre)
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
  const updateGenreStats = useCallback(async (genre: string, subgenre: string) => {
    try {
      // ジャンル統計のドキュメントを取得または作成
      const genreStatsRef = doc(db, 'genreStats', genre);
      const genreStatsSnap = await getDoc(genreStatsRef);
      
      if (genreStatsSnap.exists()) {
        // 既存のジャンル統計を更新
        const genreData = genreStatsSnap.data();
        const subgenres = genreData.subgenres || {};
        
        if (subgenres[subgenre]) {
          // 既存の単元の利用回数を増加
          await updateDoc(genreStatsRef, {
            useCount: increment(1),
            [`subgenres.${subgenre}.useCount`]: increment(1)
          });
        } else {
          // 新しい単元を追加して利用回数を1に設定
          subgenres[subgenre] = { useCount: 1 };
          await updateDoc(genreStatsRef, {
            useCount: increment(1),
            subgenres
          });
        }
      } else {
        // ジャンル統計を新規作成
        await setDoc(genreStatsRef, {
          useCount: 1,
          subgenres: {
            [subgenre]: { useCount: 1 }
          }
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
    const currentQuizId = quizRoom.quizIds[quizRoom.currentQuizIndex];
    
    if (currentQuizId && (!currentQuiz || currentQuiz.quizId !== currentQuizId)) {
      fetchQuiz(currentQuizId);
    }
  }, [quizRoom, currentQuiz, fetchQuiz]);

  return {
    currentQuiz,
    genres,
    subgenres,
    loading,
    error,
    fetchGenres,
    fetchQuiz,
    searchQuizzes,
    updateGenreStats
  };
}

// 外部からimportする時にuseQuizという名前で使えるように、エイリアスを設定
export const useQuiz = useQuizContext;
