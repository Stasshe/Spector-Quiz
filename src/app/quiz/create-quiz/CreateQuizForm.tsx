'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { db } from '@/config/firebase'; 
import { collection, addDoc, serverTimestamp, getDocs, query, where } from 'firebase/firestore';
import { FaArrowLeft, FaUpload, FaSpinner } from 'react-icons/fa';
import { Quiz, QuizType, QuizUnit } from '@/types/quiz';

// コンポーネントのインポート
import BasicInfoForm from './components/BasicInfoForm';
import QuizList from './components/QuizList';
import QuizFormEditor from './components/QuizFormEditor';
import DraftManager from './components/DraftManager';
import YamlBulkImport from './components/YamlBulkImport';

// 型定義をエクスポート
export type { QuizDifficulty } from './create-types';
export default function CreateQuizForm() {
  const { currentUser } = useAuth();
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

  useEffect(() => {
    if (!currentUser) {
      router.push('/auth/login');
      return;
    }
    
    // 自動保存タイマーの設定
    autoSaveTimerRef.current = setInterval(() => {
      if (title || quizzes.length > 0) {
        saveDraft(false);
      }
    }, 30000); // 30秒ごとに自動保存
    
    return () => {
      if (autoSaveTimerRef.current) {
        clearInterval(autoSaveTimerRef.current);
      }
    };
  }, [currentUser, router, title, quizzes]);

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
      // 単元をFirestoreの新しい階層構造に追加
      const unitData: Omit<QuizUnit, 'unitId'> = {
        title,
        description: description || '', // 空文字列をデフォルト値として設定
        createdBy: currentUser!.uid,
        createdAt: serverTimestamp() as any, // as any で型エラーを回避
        quizCount: quizzes.length, // クイズの数
        useCount: 0,
        isPublic,
        averageDifficulty: quizzes.length > 0 
          ? quizzes.reduce((sum, q) => sum + q.difficulty, 0) / quizzes.length 
          : 0
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
          difficulty: quiz.difficulty || 3,
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
      }, 3000);
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
    
    if (quizzes.length === 0) {
      setErrorMessage('少なくとも1つのクイズを追加してください');
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

  // 下書きをロード
  const loadDraft = (draft: any) => {
    setDraftId(draft.draftId);
    setTitle(draft.title);
    setDescription(draft.description);
    setGenre(draft.genre);
    setQuizzes(draft.quizzes || []);
    setIsPublic(draft.isPublic);
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
              <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 text-transparent bg-clip-text">新しいクイズを作成</h1>
              <p className="text-gray-600">あなたのオリジナルクイズを作成して公開しましょう</p>
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
                      <FaSpinner className="animate-spin mr-2" /> 公開中...
                    </>
                  ) : (
                    <>
                      <FaUpload className="mr-2" /> 単元を公開する
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
