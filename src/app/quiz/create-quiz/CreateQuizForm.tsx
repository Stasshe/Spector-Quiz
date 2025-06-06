'use client';

import { db } from '@/config/firebase';
import { useAuth } from '@/hooks/useAuth';
import { Quiz, QuizUnit } from '@/types/quiz';
import { addDoc, collection, doc, getDoc, getDocs, query, serverTimestamp, setDoc, where, writeBatch } from 'firebase/firestore';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { FaArrowLeft, FaSpinner, FaUpload } from 'react-icons/fa';
import { TIMING, QUIZ_UNIT } from '@/config/quizConfig';

// コンポーネントのインポート
import BasicInfoForm from './components/BasicInfoForm';
import DraftManager from './components/DraftManager';
import QuizFormEditor from './components/QuizFormEditor';
import QuizList from './components/QuizList';
import YamlBulkImport from './components/YamlBulkImport';

// 型定義をエクスポート

export default function CreateQuizForm() {
  const { currentUser, userProfile } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  // 単元の状態
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [genre, setGenre] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  
  // クイズの状態管理
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [editingQuizIndex, setEditingQuizIndex] = useState<number | null>(null);
  const [showQuizForm, setShowQuizForm] = useState(false);
  const [availableQuizzes, setAvailableQuizzes] = useState<Quiz[]>([]);
  const [showAvailableQuizzes, setShowAvailableQuizzes] = useState(false);
  
  // UI関連の状態
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [draftId, setDraftId] = useState<string | null>(null);

  // タイマー参照
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // 編集モードかどうか
  const [isEditMode, setIsEditMode] = useState(false);
  // 編集対象の単元ID
  const [editUnitId, setEditUnitId] = useState<string | null>(null);
  // 編集対象のジャンルID
  const [editGenreId, setEditGenreId] = useState<string | null>(null);
  // フォーム項目を無効化するかどうか（編集モード時）
  const [disableTitleGenre, setDisableTitleGenre] = useState(false);

  useEffect(() => {
    if (!currentUser) {
      router.push('/auth/login');
      return;
    }
    
    // URLパラメータから編集モード情報を取得
    const edit = searchParams.get('edit');
    const unitId = searchParams.get('unitId');
    const genreId = searchParams.get('genreId');
    const officialGenre = searchParams.get('officialGenre');
    const officialCategory = searchParams.get('officialCategory');
    const officialUnit = searchParams.get('officialUnit');
    
    console.log('URL パラメータ:', { edit, unitId, genreId, officialGenre, officialCategory, officialUnit });
    
    // 編集モードの場合、単元データを取得
    if (edit === 'true' && unitId) {
      setIsEditMode(true);
      setEditUnitId(unitId);
      
      // officialGenre パラメータが "true" の場合に公式クイズと判断
      const isOfficialQuiz = officialGenre === 'true';
      
      // 実際に使用するジャンルIDを設定
      let actualGenreId = '';
      if (genreId) {
        actualGenreId = genreId;
      } else if (isOfficialQuiz) {
        // 公式クイズの場合はofficialGenre（ジャンル名）を使用
        actualGenreId = officialUnit || '';
      }
      
      console.log('編集モード設定:', { isOfficialQuiz, actualGenreId, unitId });
      
      if (actualGenreId) {
        setEditGenreId(actualGenreId);
        // 単元データを読み込む
        loadUnitData(actualGenreId, unitId, isOfficialQuiz);
      } else {
        console.error('ジャンルIDが見つかりません');
        setErrorMessage('クイズの読み込みに必要な情報が不足しています');
      }
    }
    
    // 自動保存タイマーの設定
    autoSaveTimerRef.current = setInterval(() => {
      if (title || quizzes.length > 0) {
        saveDraft(false);
      }
    }, TIMING.QUIZ_AUTO_SAVE_INTERVAL); // 10秒ごとに自動保存
    
    return () => {
      if (autoSaveTimerRef.current) {
        clearInterval(autoSaveTimerRef.current);
      }
    };
  }, [currentUser, router]);

  // ジャンルが変更されたときに、そのジャンルのクイズを取得
  useEffect(() => {
    if (genre) {
      fetchAvailableQuizzes(genre);
    }
  }, [genre]);

  // 利用可能なクイズを取得
  const fetchAvailableQuizzes = async (selectedGenre: string) => {
    try {
      setLoading(true);
      const quizQuery = query(
        collection(db, 'quizzes'),
        where('genre', '==', selectedGenre),
        where('createdBy', '==', currentUser?.uid)
      );
      
      const quizSnapshot = await getDocs(quizQuery);
      const quizList: Quiz[] = [];
      
      quizSnapshot.forEach(doc => {
        const quizData = doc.data() as Omit<Quiz, 'quizId'>;
        quizList.push({ ...quizData, quizId: doc.id } as Quiz);
      });
      
      setAvailableQuizzes(quizList);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching quizzes:', err);
      setErrorMessage('クイズの取得中にエラーが発生しました');
      setLoading(false);
    }
  };

  // 新しい単元を公開
  const publishUnit = async () => {
    if (!validateUnitForm()) return;
    
    setLoading(true);
    
    try {
      // 編集モードの場合は既存の単元を更新
      if (isEditMode && editUnitId && editGenreId) {
        await updateUnit();
        return;
      }
      
      // 単元をFirestoreの新しい階層構造に追加
      const unitData: Omit<QuizUnit, 'unitId'> = {
        title,
        description: description || '', // 空文字列をデフォルト値として設定
        createdBy: currentUser!.uid,
        createdAt: serverTimestamp() as any, // as any で型エラーを回避
        quizCount: quizzes.length, // クイズの数
        useCount: 0,
        isPublic,
        
      };
      
      // ジャンル->単元の階層構造でデータを保存
      const unitRef = await addDoc(
        collection(db, 'genres', genre, 'quiz_units'), 
        unitData
      );
      
      // クイズを単元のサブコレクションとして追加
      for (const quiz of quizzes) {
        const quizData = {
          title: quiz.title,
          question: quiz.question,
          type: quiz.type,
          choices: quiz.choices || [],
          correctAnswer: quiz.correctAnswer || '',
          acceptableAnswers: quiz.acceptableAnswers || [],
          explanation: quiz.explanation || '',
          createdBy: currentUser!.uid,
          createdAt: serverTimestamp() as any,
          useCount: 0,
          correctCount: 0
        };
        
        await addDoc(
          collection(db, 'genres', genre, 'quiz_units', unitRef.id, 'quizzes'),
          quizData
        );
      }
      
      setSuccessMessage('単元を公開しました！');
      clearForm();
      
      // 3秒後にクイズプレイページに遷移
      setTimeout(() => {
        router.push('/quiz');
      }, TIMING.QUIZ_UNIT_PUBLISH_ROUTER_INTERVAL);
    } catch (error) {
      console.error('Error publishing unit:', error);
      if (error instanceof Error) {
        setErrorMessage(`単元の公開に失敗しました: ${error.message}`);
      } else {
        setErrorMessage('単元の公開に失敗しました。');
      }
    }
    
    setLoading(false);
  };

  // 単元フォームの検証
  const validateUnitForm = () => {
    if (!title.trim()) {
      setErrorMessage('単元のタイトルを入力してください');
      return false;
    }
    
    // タイトルの長さチェック
    if (title.length > QUIZ_UNIT.MAX_TITLE_LENGTH) {
      setErrorMessage(`単元のタイトルは${QUIZ_UNIT.MAX_TITLE_LENGTH}文字以内で入力してください`);
      return false;
    }
    
    // 説明の長さチェック
    if (description.length > QUIZ_UNIT.MAX_DESCRIPTION_LENGTH) {
      setErrorMessage(`単元の説明は${QUIZ_UNIT.MAX_DESCRIPTION_LENGTH}文字以内で入力してください`);
      return false;
    }
    
    if (quizzes.length === 0) {
      setErrorMessage('少なくとも1つのクイズを追加してください');
      return false;
    }
    
    // クイズ数の上限チェック
    if (quizzes.length > QUIZ_UNIT.MAX_QUESTIONS_PER_UNIT) {
      setErrorMessage(`1つの単元には最大${QUIZ_UNIT.MAX_QUESTIONS_PER_UNIT}個までのクイズを追加できます`);
      return false;
    }
    
    if (!genre) {
      setErrorMessage('ジャンルを選択してください');
      return false;
    }
    
    setErrorMessage('');
    return true;
  };

  // 下書き保存のための準備
  const saveDraft = (showMessage = false) => {
    // DraftManagerコンポーネントに処理を委譲
    // このメソッドは自動保存用のラッパーとして残す
    return showMessage;
  };

  // クイズを編集
  const editQuiz = (index: number) => {
    setEditingQuizIndex(index);
    setShowQuizForm(true);
  };

  // クイズを削除
  const removeQuiz = (index: number) => {
    const updatedQuizzes = [...quizzes];
    updatedQuizzes.splice(index, 1);
    setQuizzes(updatedQuizzes);
  };

  // 一括削除
  const handleBulkRemove = (indices: number[]) => {
    const updatedQuizzes = [...quizzes];
    // 逆順で削除（インデックスがずれないように）
    indices.sort((a, b) => b - a).forEach(index => {
      updatedQuizzes.splice(index, 1);
    });
    setQuizzes(updatedQuizzes);
  };

  // 下書きをロード
  const loadDraft = (draft: any) => {
    setDraftId(draft.draftId);
    setTitle(draft.title);
    setDescription(draft.description);
    setGenre(draft.genre);
    setQuizzes(draft.quizzes || []);
    setIsPublic(draft.isPublic);
  };

  // 単元データをロード
  const loadUnitData = async (genreId: string, unitId: string, isOfficial: boolean) => {
    try {
      setLoading(true);
      console.log(`単元データ読み込み開始: genreId=${genreId}, unitId=${unitId}, isOfficial=${isOfficial}`);
      
      // 単元データを取得（公式クイズとユーザークイズで参照先が異なる）
      const collectionName = isOfficial ? 'official_quiz_units' : 'quiz_units';
      console.log(`使用コレクション: ${collectionName}`);
      
      // 完全なコレクションパスをログ出力
      const fullPath = `genres/${genreId}/${collectionName}/${unitId}`;
      console.log(`ドキュメントパス: ${fullPath}`);
      
      const unitDocRef = doc(db, `genres/${genreId}/${collectionName}`, unitId);
      console.log('ドキュメント参照生成完了');
      
      // ドキュメント取得を試行
      const unitSnapshot = await getDoc(unitDocRef);
      console.log('ドキュメント取得完了:', unitSnapshot.exists() ? 'ドキュメント存在' : 'ドキュメント不存在');
      
      if (!unitSnapshot.exists()) {
        console.error(`単元が存在しません: ${fullPath}`);
        setErrorMessage('指定された単元が見つかりませんでした');
        setLoading(false);
        return;
      }
      
      const unitData = unitSnapshot.data() as QuizUnit;
      console.log('単元データ取得成功:', unitData.title);
      console.log('ユーザープロファイル:', userProfile);
      
      // 管理者権限の確認
      const isAdmin = userProfile?.isAdmin === true || userProfile?.userId === '100000';
      console.log('管理者権限チェック:', { isAdmin, userId: userProfile?.userId });
      
      // 公式クイズまたは他のユーザーが作成したクイズの場合、編集権限チェック
      if (isOfficial && !isAdmin) {
        console.error('公式クイズ編集権限がありません');
        setErrorMessage('公式クイズを編集する権限がありません');
        setLoading(false);
        return;
      } else if (!isOfficial && unitData.createdBy !== currentUser?.uid) {
        console.error('他ユーザーのクイズ編集権限がありません');
        setErrorMessage('このクイズを編集する権限がありません');
        setLoading(false);
        return;
      }
      
      // フォームに単元データをセット
      setTitle(unitData.title || '');
      setDescription(unitData.description || '');
      setGenre(genreId);
      setIsPublic(unitData.isPublic);
      setDisableTitleGenre(true); // 単元名とジャンルを編集不可に
      
      console.log('フォームデータ設定完了', { title: unitData.title, genre: genreId });
      
      // クイズデータを取得
      const quizzesCollection = collection(unitDocRef, 'quizzes');
      console.log(`クイズコレクションパス: ${quizzesCollection.path}`);
      
      const quizzesSnapshot = await getDocs(quizzesCollection);
      const loadedQuizzes: Quiz[] = [];
      
      console.log(`クイズデータドキュメント数: ${quizzesSnapshot.size}`);
      
      quizzesSnapshot.forEach(quizDoc => {
        const quizData = quizDoc.data() as Omit<Quiz, 'quizId'>;
        console.log(`クイズデータ読み込み: ${quizDoc.id}`, quizData);
        loadedQuizzes.push({
          ...quizData,
          quizId: quizDoc.id
        } as Quiz);
      });
      
      console.log(`読み込んだクイズ数: ${loadedQuizzes.length}`);
      setQuizzes(loadedQuizzes);
      setSuccessMessage('単元データを読み込みました');
      
      // 明示的にロード状態を解除（タイミング問題を防ぐため）
      setTimeout(() => {
        setLoading(false);
      }, 500);
    } catch (error) {
      console.error('単元データ読み込み中にエラーが発生しました:', error);
      setErrorMessage('単元データの読み込みに失敗しました');
      setLoading(false);
    }
  };

  // フォームをクリア
  const clearForm = () => {
    setDraftId(null);
    setTitle('');
    setDescription('');
    setGenre('');
    setQuizzes([]);
    setIsPublic(true);
    setShowQuizForm(false);
    setEditingQuizIndex(null);
    setDisableTitleGenre(false);
  };

  // クイズの保存（追加・更新）
  const handleSaveQuiz = (quizData: Omit<Quiz, 'quizId' | 'createdAt'>) => {
    const newQuiz: Quiz = {
      ...quizData,
      quizId: `temp_${Date.now()}`, // 一時的なID、Firestoreに保存時に更新
      createdAt: null as any
    };
    
    if (editingQuizIndex !== null) {
      // 既存のクイズを更新
      const updatedQuizzes = [...quizzes];
      updatedQuizzes[editingQuizIndex] = newQuiz;
      setQuizzes(updatedQuizzes);
      setEditingQuizIndex(null);
    } else {
      // 新しいクイズを追加
      setQuizzes([...quizzes, newQuiz]);
    }
    
    setShowQuizForm(false);
  };

  // YAMLからインポートしたクイズを追加
  const handleImportQuizzes = (importedQuizzes: Omit<Quiz, 'quizId' | 'createdAt'>[]) => {
    const newQuizzes = importedQuizzes.map(quiz => ({
      ...quiz,
      quizId: `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: null as any
    }));
    
    setQuizzes([...quizzes, ...newQuizzes]);
    setSuccessMessage(`${newQuizzes.length}個のクイズをインポートしました`);
    setTimeout(() => setSuccessMessage(''), 3000);
  };

  // 既存の単元を更新する関数
  const updateUnit = async () => {
    if (!editUnitId || !editGenreId || !currentUser) {
      console.error('更新に必要な情報が不足しています:', { editUnitId, editGenreId, userId: currentUser?.uid });
      setErrorMessage('更新に必要な情報が不足しています');
      setLoading(false);
      return;
    }
    
    try {
      // 公式クイズかどうかを確認
      const isOfficial = searchParams.get('officialGenre') === 'true';
      console.log(`単元更新開始: isOfficial=${isOfficial}, genreId=${editGenreId}, unitId=${editUnitId}`);
      
      // 管理者権限の確認
      const isAdmin = userProfile?.isAdmin === true || userProfile?.userId === '100000';
      console.log('管理者権限チェック:', { isAdmin, userId: userProfile?.userId });
      
      // 公式クイズの場合は管理者のみ更新可能
      if (isOfficial && !isAdmin) {
        console.error('公式クイズの更新権限がありません');
        setErrorMessage('公式クイズを更新する権限がありません');
        setLoading(false);
        return;
      }
      
      // 適切なコレクションパスを設定
      // 公式クイズの場合は official_quiz_units コレクション、それ以外は quiz_units コレクション
      const collectionName = isOfficial ? 'official_quiz_units' : 'quiz_units';
      console.log(`更新コレクション: ${collectionName}`);
      
      // 完全なコレクションパスをログ出力
      const fullPath = `genres/${editGenreId}/${collectionName}/${editUnitId}`;
      console.log(`更新ドキュメントパス: ${fullPath}`);
      
      const unitRef = doc(db, 'genres', editGenreId, collectionName, editUnitId);
      
      // 更新する単元データを準備
      const updatedUnitData = {
        description: description || '',
        isPublic,
        quizCount: quizzes.length,
        updatedAt: serverTimestamp() as any
      };
      
      console.log('更新する単元データ:', updatedUnitData);
      
      // 単元データを更新
      await setDoc(unitRef, updatedUnitData, { merge: true });
      console.log('単元データの更新完了');
      
      // クイズコレクションを一度クリアして再作成
      // まずは既存のクイズをすべて取得して削除
      const quizzesCollection = collection(unitRef, 'quizzes');
      console.log(`クイズコレクションパス: ${quizzesCollection.path}`);
      
      const quizzesSnapshot = await getDocs(quizzesCollection);
      console.log(`既存のクイズ数: ${quizzesSnapshot.size}`);
      
      const batch = writeBatch(db);
      
      quizzesSnapshot.forEach((quizDoc) => {
        batch.delete(doc(unitRef, 'quizzes', quizDoc.id));
      });
      
      await batch.commit();
      
      
      // 新しいクイズを追加
      console.log(`${quizzes.length}個のクイズを追加します`);
      
      for (const quiz of quizzes) {
        const quizData = {
          title: quiz.title,
          question: quiz.question,
          type: quiz.type,
          choices: quiz.choices || [],
          correctAnswer: quiz.correctAnswer || '',
          acceptableAnswers: quiz.acceptableAnswers || [],
          explanation: quiz.explanation || '',
          createdBy: currentUser.uid,
          createdAt: serverTimestamp() as any,
          useCount: 0,
          correctCount: 0
        };
        
        console.log(`クイズを追加: ${quiz.title}`);
        const newQuizRef = await addDoc(collection(unitRef, 'quizzes'), quizData);
        console.log(`クイズ追加完了: ${newQuizRef.id}`);
      }
      
      setSuccessMessage('単元を更新しました！');
      
      // 3秒後にリダイレクト
      // 公式クイズの場合は管理画面に、それ以外はクイズ一覧に
      const redirectPath = isOfficial ? '/admin/quiz-management' : '/quiz';
      setTimeout(() => {
        router.push(redirectPath);
      }, TIMING.QUIZ_UNIT_PUBLISH_ROUTER_INTERVAL);
    } catch (error) {
      console.error('Error updating unit:', error);
      if (error instanceof Error) {
        setErrorMessage(`単元の更新に失敗しました: ${error.message}`);
      } else {
        setErrorMessage('単元の更新に失敗しました。');
      }
    } finally {
      setLoading(false);
    }
  };

  // ユーザーが未ログインの場合は、ログインページへリダイレクト
  if (!currentUser) {
    return null; // useEffectでリダイレクト
  }

  return (
    <div className="app-container py-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          {searchParams.get('edit') === 'true' && searchParams.get('officialGenre') ? (
            <Link href="/admin/quiz-management" className="flex items-center text-indigo-600 hover:text-indigo-800 transition-colors">
              <FaArrowLeft className="mr-2" /> 公式クイズ一覧に戻る
            </Link>
          ) : (
            <Link href="/quiz" className="flex items-center text-indigo-600 hover:text-indigo-800 transition-colors">
              <FaArrowLeft className="mr-2" /> クイズ一覧に戻る
            </Link>
          )}
        </div>

        <div className="card mb-6">
          <div className="flex items-center mb-8">
            <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-xl flex items-center justify-center text-white shadow-md mr-4">
              <FaUpload className="text-2xl" />
            </div>
            <div>
              {isEditMode ? (
                <>
                  <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 text-transparent bg-clip-text">クイズを編集</h1>
                  <p className="text-gray-600">既存のクイズ単元を編集しましょう</p>
                </>
              ) : (
                <>
                  <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 text-transparent bg-clip-text">新しいクイズを作成</h1>
                  <p className="text-gray-600">あなたのオリジナルクイズを作成して公開しましょう</p>
                </>
              )}
            </div>
          </div>

          {/* 下書き管理コンポーネント */}
          <DraftManager
            currentUserId={currentUser.uid}
            title={title}
            description={description}
            genre={genre}
            quizzes={quizzes}
            isPublic={isPublic}
            draftId={draftId}
            onSaveDraft={saveDraft}
            onLoadDraft={loadDraft}
            onSetDraftId={setDraftId}
          />

          {/* エラーメッセージ表示 */}
          {errorMessage && (
            <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 rounded-lg mb-6">
              <div className="flex">
                <div className="ml-3">
                  <p>{errorMessage}</p>
                </div>
              </div>
            </div>
          )}

          {/* 成功メッセージ表示 */}
          {successMessage && (
            <div className="bg-green-50 border-l-4 border-green-500 text-green-700 p-4 rounded-lg mb-6">
              <div className="flex">
                <div className="ml-3">
                  <p>{successMessage}</p>
                </div>
              </div>
            </div>
          )}

          {/* クイズ単元作成フォーム */}
          <form onSubmit={(e) => { e.preventDefault(); publishUnit(); }}>
            <div className="space-y-6">
              {/* 基本情報フォーム */}
              <BasicInfoForm
                title={title}
                setTitle={setTitle}
                description={description}
                setDescription={setDescription}
                genre={genre}
                setGenre={setGenre}
                isPublic={isPublic}
                setIsPublic={setIsPublic}
                disableTitleGenre={disableTitleGenre}
              />
              
              {/* YAML一括インポート */}
              <YamlBulkImport
                onImport={handleImportQuizzes}
                genre={genre || '未分類'}
                createdBy={currentUser.uid}
              />
              
              {/* クイズエディタ（表示中の場合） */}
              {showQuizForm && (
                <QuizFormEditor
                  onSave={handleSaveQuiz}
                  onCancel={() => {
                    setShowQuizForm(false);
                    setEditingQuizIndex(null);
                  }}
                  editingQuiz={editingQuizIndex !== null ? quizzes[editingQuizIndex] : null}
                  genre={genre || '未分類'}
                  createdBy={currentUser.uid}
                />
              )}
              
              {/* クイズ一覧 */}
              <QuizList
                quizzes={quizzes}
                onAddNew={() => {
                  setShowQuizForm(true);
                  setEditingQuizIndex(null);
                }}
                onEdit={editQuiz}
                onRemove={removeQuiz}
                onBulkRemove={handleBulkRemove}
              />
              
              {/* 送信ボタン */}
              <div className="flex justify-end pt-4">
                <button
                  type="submit"
                  className="btn-primary flex items-center"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <FaSpinner className="animate-spin mr-2" /> 
                      {isEditMode ? '更新中...' : '公開中...'}
                    </>
                  ) : (
                    <>
                      <FaUpload className="mr-2" /> 
                      {isEditMode ? '単元を更新する' : '単元を公開する'}
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
