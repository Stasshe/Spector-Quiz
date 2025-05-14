'use client';

import { useState, useCallback } from 'react';
import { db } from '@/config/firebase';
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  limit as firestoreLimit
} from 'firebase/firestore';
import { QuizUnit } from '@/types/quiz';
import { useAuth } from '@/context/AuthContext';

// クイズ単元用のカスタムフック
export function useQuizUnit() {
  const { currentUser } = useAuth();
  const [availableUnits, setAvailableUnits] = useState<QuizUnit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ジャンルに基づいてクイズ単元を検索
  const fetchUnitsByGenre = useCallback(async (genreId: string) => {
    if (!genreId) {
      setAvailableUnits([]);
      return [];
    }

    try {
      setLoading(true);
      const units: QuizUnit[] = [];
      
      // ジャンル内の単元コレクションへの参照
      const unitsCollectionRef = collection(
        db, 
        'genres', genreId, 
        'quiz_units'
      );
      
      if (currentUser) {
        // ログイン時は、公開単元と自分が作成した単元を両方取得する
        
        // 1. 公開単元を取得
        const publicUnitsQuery = query(
          unitsCollectionRef,
          where('isPublic', '==', true)
        );
        const publicUnitsSnapshot = await getDocs(publicUnitsQuery);
        
        publicUnitsSnapshot.forEach(doc => {
          units.push({
            ...doc.data(),
            unitId: doc.id,
            genre: genreId     // 参照用に追加
          } as QuizUnit);
        });
        
        // 2. 自分の単元を取得（重複は除外）
        const myUnitsQuery = query(
          unitsCollectionRef,
          where('createdBy', '==', currentUser.uid)
        );
        const myUnitsSnapshot = await getDocs(myUnitsQuery);
        
        myUnitsSnapshot.forEach(doc => {
          // すでに追加されていない場合のみ追加
          if (!units.some(unit => unit.unitId === doc.id)) {
            units.push({
              ...doc.data(),
              unitId: doc.id,
              genre: genreId     // 参照用に追加
            } as QuizUnit);
          }
        });
      } else {
        // 非ログイン時は公開単元のみ取得
        const unitsQuery = query(
          unitsCollectionRef,
          where('isPublic', '==', true)
        );
        const unitsSnapshot = await getDocs(unitsQuery);
        
        unitsSnapshot.forEach(doc => {
          units.push({
            ...doc.data(),
            unitId: doc.id,
            genre: genreId     // 参照用に追加
          } as QuizUnit);
        });
      }
      
      // 使用回数の多い順にソート
      units.sort((a, b) => b.useCount - a.useCount);
      
      setAvailableUnits(units);
      setLoading(false);
      return units;
    } catch (err) {
      console.error('Error fetching units:', err);
      setError('単元の取得中にエラーが発生しました');
      setLoading(false);
      return [];
    }
  }, [currentUser]);
  
  // 特定の単元を取得
  const fetchUnitById = useCallback(async (genreId: string, unitId: string) => {
    try {
      setLoading(true);
      const unitRef = doc(db, 'genres', genreId, 'quiz_units', unitId);
      const unitSnap = await getDoc(unitRef);
      
      if (!unitSnap.exists()) {
        throw new Error('単元が見つかりません');
      }
      
      const unitData = {
        ...unitSnap.data(),
        unitId: unitSnap.id,
        genre: genreId      // 参照用に追加
      } as QuizUnit;
      
      setLoading(false);
      return unitData;
    } catch (err) {
      console.error('Error fetching unit:', err);
      setError('単元の取得中にエラーが発生しました');
      setLoading(false);
      return null;
    }
  }, []);

  // 人気の単元を取得（ホームページなどでの表示用）
  const fetchPopularUnits = useCallback(async (limitCount: number = 5) => {
    try {
      setLoading(true);
      const units: QuizUnit[] = [];
      
      // ジャンル一覧を取得
      const genresSnapshot = await getDocs(collection(db, 'genres'));
      
      // 各ジャンルの単元を取得
      for (const genreDoc of genresSnapshot.docs) {
        const genreId = genreDoc.id;
        
        // ジャンル内の公開単元を取得（使用回数順）
        const unitsQuery = query(
          collection(db, 'genres', genreId, 'quiz_units'),
          where('isPublic', '==', true),
          orderBy('useCount', 'desc'),
          firestoreLimit(limitCount)
        );
        
        const unitsSnapshot = await getDocs(unitsQuery);
        
        unitsSnapshot.forEach(doc => {
          units.push({
            ...doc.data(),
            unitId: doc.id,
            genre: genreId
          } as QuizUnit);
        });
      }
      
      // 全ての単元を使用回数順に並べ替え、上位limitCount件を返す
      const sortedUnits = units
        .sort((a, b) => b.useCount - a.useCount)
        .slice(0, limitCount);
      
      setLoading(false);
      return sortedUnits;
    } catch (err) {
      console.error('Error fetching popular units:', err);
      setError('人気単元の取得中にエラーが発生しました');
      setLoading(false);
      return [];
    }
  }, []);

  return {
    availableUnits,
    loading,
    error,
    fetchUnitsByGenre,
    fetchUnitById,
    fetchPopularUnits
  };
}
