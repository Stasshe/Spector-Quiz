'use client';

import { db } from '@/config/firebase';
import { useQuiz as useQuizContext } from '@/context/QuizContext';
import { Quiz } from '@/types/quiz';
import { collection, doc, getDoc, getDocs, increment, setDoc, updateDoc } from 'firebase/firestore';
import { useCallback, useEffect, useState } from 'react';

// 単元データの型を拡張して単元名とIDを両方保持できるようにする
type UnitData = { name: string; id: string };

export function useQuizHook() {
  const { currentQuiz, setCurrentQuiz, quizRoom } = useQuizContext();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [genres, setGenres] = useState<string[]>([]);
  const [units, setUnits] = useState<{ [genre: string]: { [category: string]: UnitData[] } }>({});

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
        const unitList: {name: string, id: string}[] = [];
        
        unitsSnap.forEach(unitDoc => {
          const unitData = unitDoc.data();
          if (unitData.title) {
            unitList.push({
              name: unitData.title,
              id: unitDoc.id
            });
          }
        });
        
        // カテゴリマップを作成（カテゴリは「単元」のみで全てフラット）
        const categoryMap: { [category: string]: {name: string, id: string}[] } = {
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
            
            // 公式クイズの場合はFirestoreからIDを取得する必要がある
            // 変換用の関数: string[]をUnitData[]に変換
            async function convertToUnitDataFormat(categoryMap: { [category: string]: string[] }): Promise<{ [category: string]: UnitData[] }> {
              const result: { [category: string]: UnitData[] } = {};
              
              // カテゴリごとに処理
              for (const [category, unitNames] of Object.entries(categoryMap)) {
                result[category] = [];
                
                // 単元名から単元IDを取得するためには、公式単元コレクションをクエリする必要がある
                const unitsRef = collection(db, 'genres', genreId, 'official_quiz_units');
                const unitsSnap = await getDocs(unitsRef);
                
                // 単元名をマップする
                unitNames.forEach(unitName => {
                  // Firestoreで一致する単元を検索
                  const foundUnit = unitsSnap.docs.find(doc => doc.data().title === unitName);
                  
                  result[category].push({
                    name: unitName,
                    id: foundUnit?.id || '' // IDが見つからない場合は空文字列
                  });
                });
              }
              
              return result;
            }
            
            // 単元データをUnitData形式に変換して保存
            const convertAndSaveUnits = async () => {
              try {
                const convertedUnits = await convertToUnitDataFormat(filteredUnits);
                setUnits(prevUnits => ({
                  ...prevUnits,
                  [`${genreId}_${classType}`]: convertedUnits
                }));
              } catch (convErr) {
                console.error('Error converting unit data:', convErr);
              }
            };
            
            // 非同期処理を開始
            convertAndSaveUnits();
            
            // 変換前のデータを一時的に返す（インターフェースの互換性のため）
            return filteredUnits;
          } else {
            // genres.tsに該当ジャンルが見つからない場合は空のマップを返す
            const emptyUnitDataMap = { '単元': [] as UnitData[] };
            setUnits(prevUnits => ({
              ...prevUnits,
              [`${genreId}_${classType}`]: emptyUnitDataMap
            }));
            return emptyUnitDataMap;
          }
        } catch (importErr) {
          console.error('Error importing genres.ts:', importErr);
          const emptyUnitDataMap = { '単元': [] as UnitData[] };
          setUnits(prevUnits => ({
            ...prevUnits,
            [`${genreId}_${classType}`]: emptyUnitDataMap
          }));
          return emptyUnitDataMap;
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

  // 利用可能なジャンル一覧を取得（genres.tsから取得）
  const fetchGenres = useCallback(async (defaultClassType: string = '公式') => {
    try {
      setLoading(true);
      
      // genres.tsからジャンル一覧を取得
      const { genreClasses } = await import('@/constants/genres');
      
      // 'すべて'クラスからジャンル名を抽出
      const allGenresClass = genreClasses.find(gc => gc.name === 'すべて');
      const genreArray: string[] = allGenresClass ? 
        allGenresClass.genres.map(genre => genre.name) : [];
      
      console.log('[useQuiz.fetchGenres] genres.tsから取得したジャンル一覧:', genreArray);
      
      setGenres(genreArray);
      
      // 最初のジャンルの単元を取得（デフォルトクラスタイプで）
      if (genreArray.length > 0) {
        fetchUnitsForGenre(genreArray[0], defaultClassType);
      }
    } catch (err) {
      console.error('Error fetching genres from genres.ts:', err);
      setError('ジャンル一覧の取得中にエラーが発生しました');
    } finally {
      setLoading(false);
    }
  }, [fetchUnitsForGenre]);

  // 特定のクイズを取得
  const fetchQuiz = useCallback(async (genreId: string, unitId: string, quizId: string, classType?: string) => {
    try {
      setLoading(true);
      
      // classTypeまたはquizRoomの情報から公式クイズかどうか判定
      const isOfficial = classType === '公式' || 
                        (quizRoom?.classType === '公式') || 
                        (quizRoom?.quizType === 'official');
      
      // パスを適切に構築
      const collectionName = isOfficial ? 'official_quiz_units' : 'quiz_units';
      const quizRef = doc(db, 'genres', genreId, collectionName, unitId, 'quizzes', quizId);
      
      console.log(`[useQuiz.fetchQuiz] クイズ取得: ${genreId}/${collectionName}/${unitId}/quizzes/${quizId}, isOfficial=${isOfficial}`);
      
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
        console.error(`[useQuiz.fetchQuiz] クイズが見つかりません: ${genreId}/${collectionName}/${unitId}/quizzes/${quizId}`);
        throw new Error('クイズが見つかりません');
      }
    } catch (err: any) {
      console.error('Error fetching quiz:', err);
      setError(err.message || 'クイズの取得中にエラーが発生しました');
      return null;
    } finally {
      setLoading(false);
    }
  }, [setCurrentQuiz, quizRoom]);

  // ジャンルと単元に基づいてクイズを検索
  const searchQuizzes = useCallback(async (genreId: string, unitId: string, classType?: string) => {
    try {
      setLoading(true);
      
      // classTypeまたはquizRoomの情報から公式クイズかどうか判定
      const isOfficial = classType === '公式' || 
                        (quizRoom?.classType === '公式') || 
                        (quizRoom?.quizType === 'official');
      
      // パスを適切に構築
      const collectionName = isOfficial ? 'official_quiz_units' : 'quiz_units';
      const quizzesRef = collection(db, 'genres', genreId, collectionName, unitId, 'quizzes');
      
      console.log(`[useQuiz.searchQuizzes] クイズ検索: ${genreId}/${collectionName}/${unitId}/quizzes, isOfficial=${isOfficial}`);
      
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
  }, [quizRoom]);

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
        // classTypeを明示的に渡す
        fetchQuiz(genre, unitId, currentQuizId, quizRoom.classType);
      } else {
        console.error('Quiz room is missing genre or unitId');
        setError('クイズルームの情報が不完全です');
      }
    }
  }, [quizRoom, currentQuiz, fetchQuiz]);

  // genres.tsからローカルデータを使用してunitsを初期化するフォールバック機能
  useEffect(() => {
    // genres配列が変更され、かつ配列が空でなく、unitsが空の場合のみ実行
    if (genres.length > 0) {
      // Firestoreから取得したデータが空の場合、ローカルのgenres.tsのデータを使用
      import('@/constants/genres').then(({ genreClasses }) => {
        // 最新のunitsの状態を確認するためにコールバック形式を使用
        setUnits(prevUnits => {
          // ユニットデータがすでに存在する場合は何もしない
          if (Object.keys(prevUnits).length > 0) {
            return prevUnits;
          }
          
          // ローカルデータからユニットを構築
          const localUnitMap: { [genre: string]: { [category: string]: UnitData[] } } = {};
          
          for (const genreClass of genreClasses) {
            for (const genreInfo of genreClass.genres) {
              if (genres.includes(genreInfo.name)) {
                // string[]からUnitData[]に変換
                const convertedUnits: { [category: string]: UnitData[] } = {};
                
                Object.entries(genreInfo.units).forEach(([category, unitNames]) => {
                  convertedUnits[category] = unitNames.map(name => ({
                    name: name,
                    id: '' // ローカルデータにはIDがないので空文字列をセット
                  }));
                });
                
                localUnitMap[genreInfo.name] = convertedUnits;
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
  // 初回のみ実行するために空の依存配列を使用
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    currentQuiz,
    genres,
    units,
    loading,
    error,
    fetchGenres,
    fetchUnitsForGenre,
    fetchQuiz,
    searchQuizzes
  };
}

// 外部からimportする時にuseQuizという名前で使えるように、エイリアスを設定
export const useQuiz = useQuizContext;
