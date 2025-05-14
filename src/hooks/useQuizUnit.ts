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
  const fetchUnitsByGenre = useCallback(async (genre: string) => {
    if (!genre) {
      setAvailableUnits([]);
      return [];
    }

    try {
      setLoading(true);
      const units: QuizUnit[] = [];
      
      if (currentUser) {
        // ログイン時は、公開単元と自分が作成した単元を両方取得する
        
        // 1. 公開単元を取得
        const publicUnitsQuery = query(
          collection(db, 'quiz_units'),
          where('genre', '==', genre),
          where('isPublic', '==', true)
        );
        const publicUnitsSnapshot = await getDocs(publicUnitsQuery);
        
        publicUnitsSnapshot.forEach(doc => {
          units.push({
            ...doc.data(),
            unitId: doc.id
          } as QuizUnit);
        });
        
        // 2. 自分の単元を取得（重複は除外）
        const myUnitsQuery = query(
          collection(db, 'quiz_units'),
          where('genre', '==', genre),
          where('createdBy', '==', currentUser.uid)
        );
        const myUnitsSnapshot = await getDocs(myUnitsQuery);
        
        myUnitsSnapshot.forEach(doc => {
          // すでに追加されていない場合のみ追加
          if (!units.some(unit => unit.unitId === doc.id)) {
            units.push({
              ...doc.data(),
              unitId: doc.id
            } as QuizUnit);
          }
        });
      } else {
        // 非ログイン時は公開単元のみ取得
        const unitsQuery = query(
          collection(db, 'quiz_units'),
          where('genre', '==', genre),
          where('isPublic', '==', true)
        );
        const unitsSnapshot = await getDocs(unitsQuery);
        
        unitsSnapshot.forEach(doc => {
          units.push({
            ...doc.data(),
            unitId: doc.id
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
  const fetchUnitById = useCallback(async (unitId: string) => {
    try {
      setLoading(true);
      const unitRef = doc(db, 'quiz_units', unitId);
      const unitSnap = await getDoc(unitRef);
      
      if (!unitSnap.exists()) {
        throw new Error('単元が見つかりません');
      }
      
      const unitData = {
        ...unitSnap.data(),
        unitId: unitSnap.id
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
      
      const unitsQuery = query(
        collection(db, 'quiz_units'),
        where('isPublic', '==', true),
        orderBy('useCount', 'desc'),
        firestoreLimit(limitCount)
      );
      
      const unitsSnapshot = await getDocs(unitsQuery);
      const units: QuizUnit[] = [];
      
      unitsSnapshot.forEach(doc => {
        units.push({
          ...doc.data(),
          unitId: doc.id
        } as QuizUnit);
      });
      
      setLoading(false);
      return units;
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
