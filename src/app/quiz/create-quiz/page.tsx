'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { db } from '@/config/firebase'; 
import { collection, addDoc, serverTimestamp, doc, getDoc, setDoc, updateDoc, getDocs, query, where } from 'firebase/firestore';
import { FaArrowLeft, FaSave, FaUpload, FaTrash, FaSpinner, FaCheckCircle, FaPlus, FaPen, FaCheck } from 'react-icons/fa';
import { Quiz, QuizType, QuizUnit } from '@/types/quiz';
import { genreClasses } from '@/constants/genres';
import { useQuizUnit } from '@/hooks/useQuizUnit';

// QuizDifficultyを定義
export type QuizDifficulty = 1 | 2 | 3 | 4 | 5;

// IndexedDB用の定数
const DB_NAME = 'quiz-units-db';
const STORE_NAME = 'quiz-units';
const DB_VERSION = 1;

interface DraftUnit {
  draftId: string;
  title: string;
  description: string;
  genre: string;
  quizzes: Quiz[];
  isPublic: boolean;
  createdBy: string;
  updatedAt: Date;
}

export default function CreateQuizUnitPage() {
  const { currentUser } = useAuth();
  const router = useRouter();

  // 単元の状態
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [genre, setGenre] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  
  // クイズの状態管理
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [currentQuiz, setCurrentQuiz] = useState<Quiz | null>(null);
  const [editingQuizIndex, setEditingQuizIndex] = useState<number | null>(null);
  const [showQuizForm, setShowQuizForm] = useState(false);
  
  // クイズフォームの状態
  const [quizTitle, setQuizTitle] = useState('');
  const [question, setQuestion] = useState('');
  const [type, setType] = useState<QuizType>('multiple_choice');
  const [choices, setChoices] = useState<string[]>(['', '', '', '']);
  const [correctAnswer, setCorrectAnswer] = useState('');
  const [acceptableAnswers, setAcceptableAnswers] = useState<string[]>(['']);
  const [explanation, setExplanation] = useState('');
  const [difficulty, setDifficulty] = useState<QuizDifficulty>(3);
  
  // UI関連の状態
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [draftId, setDraftId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<DraftUnit[]>([]);
  const [showDrafts, setShowDrafts] = useState(false);
  const [availableQuizzes, setAvailableQuizzes] = useState<Quiz[]>([]);
  const [showAvailableQuizzes, setShowAvailableQuizzes] = useState(false);
  
  // タイマー参照
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // IndexedDBの初期化と下書き読み込み
  useEffect(() => {
    if (!currentUser) {
      router.push('/auth/login');
      return;
    }
    
    initIndexedDB();
    loadDrafts();
    
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

  // IndexedDBの初期化関数
  const initIndexedDB = () => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'draftId' });
        store.createIndex('userId', 'createdBy', { unique: false });
        store.createIndex('updatedAt', 'updatedAt', { unique: false });
      }
    };

    request.onerror = (event) => {
      console.error('IndexedDB error:', (event.target as IDBOpenDBRequest).error);
      setErrorMessage('下書きの保存に問題が発生しました。');
    };
  };

  // 下書き一覧を読み込む
  const loadDrafts = () => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onsuccess = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const userIndex = store.index('userId');
      
      const query = userIndex.getAll(currentUser?.uid);
      
      query.onsuccess = () => {
        const userDrafts = query.result as DraftUnit[];
        // 更新日時で降順にソート
        userDrafts.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        setDrafts(userDrafts);
      };
      
      transaction.oncomplete = () => {
        db.close();
      };
    };
  };

  // 下書きを保存
  const saveDraft = (showMessage = true) => {
    if (!currentUser) return;
    
    setSaving(true);
    
    const now = new Date();
    const draftUnit: DraftUnit = {
      draftId: draftId || `draft_unit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      title,
      description,
      genre,
      quizzes: currentQuiz ? 
        (editingQuizIndex !== null ? 
          [...quizzes.slice(0, editingQuizIndex), {...currentQuiz}, ...quizzes.slice(editingQuizIndex + 1)] : 
          [...quizzes, {...currentQuiz}]
        ) : quizzes,
      isPublic,
      createdBy: currentUser.uid,
      updatedAt: now
    };
    
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onsuccess = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      
      const saveRequest = store.put(draftUnit);
      
      saveRequest.onsuccess = () => {
        setDraftId(draftUnit.draftId);
        if (showMessage) {
          setSuccessMessage('下書きを保存しました');
          setTimeout(() => setSuccessMessage(''), 3000);
        }
        loadDrafts(); // 下書き一覧を更新
      };
      
      saveRequest.onerror = () => {
        setErrorMessage('下書きの保存に失敗しました');
        setTimeout(() => setErrorMessage(''), 3000);
      };
      
      transaction.oncomplete = () => {
        db.close();
        setSaving(false);
      };
    };
    
    request.onerror = () => {
      setErrorMessage('データベースへの接続に失敗しました');
      setSaving(false);
    };
  };

  // 下書きを読み込む
  const loadDraft = (draft: DraftUnit) => {
    setDraftId(draft.draftId);
    setTitle(draft.title);
    setDescription(draft.description);
    setGenre(draft.genre);
    setQuizzes(draft.quizzes || []);
    setIsPublic(draft.isPublic);
    
    // フォームをリセット
    resetQuizForm();
    setShowDrafts(false);
  };

  // 下書きを削除
  const deleteDraft = (draftId: string, event?: React.MouseEvent) => {
    if (event) {
      event.stopPropagation();
    }
    
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onsuccess = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      
      const deleteRequest = store.delete(draftId);
      
      deleteRequest.onsuccess = () => {
        loadDrafts(); // 下書き一覧を更新
        
        // 現在編集中の下書きが削除された場合はフォームをクリア
        if (draftId === draftId) {
          clearForm();
        }
      };
      
      transaction.oncomplete = () => {
        db.close();
      };
    };
  };

  // 新しい単元を公開
  const publishUnit = async () => {
    if (!validateUnitForm()) return;
    
    setLoading(true);
    
    try {
      // クイズを公開する前に、まだFirestoreに存在しないクイズを追加
      const quizIds = [];
      
      for (const quiz of quizzes) {
        if (!quiz.quizId || quiz.quizId.startsWith('temp_')) {
          // 一時的なIDを持つ新しいクイズはFirestoreに追加
          const quizData = {
            title: quiz.title,
            question: quiz.question,
            type: quiz.type,
            choices: quiz.choices,
            correctAnswer: quiz.correctAnswer,
            acceptableAnswers: quiz.acceptableAnswers,
            explanation: quiz.explanation,
            genre: genre,
            difficulty: quiz.difficulty,
            createdBy: currentUser!.uid,
            createdAt: serverTimestamp() as any, // as any で型エラーを回避
            useCount: 0,
            correctCount: 0
          };
          
          const docRef = await addDoc(collection(db, 'quizzes'), quizData);
          quizIds.push(docRef.id);
        } else {
          // 既存のクイズはそのままIDを使用
          quizIds.push(quiz.quizId);
        }
      }
      
      // 単元をFirestoreの新しい階層構造に追加
      const unitData: Omit<QuizUnit, 'unitId'> = {
        title,
        description,
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
          choices: quiz.choices,
          correctAnswer: quiz.correctAnswer,
          acceptableAnswers: quiz.acceptableAnswers,
          explanation: quiz.explanation,
          difficulty: quiz.difficulty,
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
      
      // 公開成功したら下書きを削除
      if (draftId) {
        deleteDraft(draftId);
      }
      
      setSuccessMessage('単元を公開しました！');
      clearForm();
      
      // 3秒後にクイズプレイページに遷移
      setTimeout(() => {
        router.push('/quiz');
      }, 3000);
    } catch (error) {
      console.error('Error publishing unit:', error);
      setErrorMessage('単元の公開に失敗しました。');
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

  // クイズフォームの検証
  const validateQuizForm = () => {
    if (!quizTitle.trim()) {
      setErrorMessage('クイズのタイトルを入力してください');
      return false;
    }
    
    if (!question.trim()) {
      setErrorMessage('問題文を入力してください');
      return false;
    }
    
    if (type === 'multiple_choice') {
      // 選択肢が全て入力されているか確認
      if (choices.some(choice => !choice.trim())) {
        setErrorMessage('全ての選択肢を入力してください');
        return false;
      }
      
      // 正解が選択されているか確認
      if (!correctAnswer) {
        setErrorMessage('正解を選択してください');
        return false;
      }
    } else if (type === 'input') {
      // 正解が入力されているか確認
      if (!correctAnswer.trim()) {
        setErrorMessage('正解を入力してください');
        return false;
      }
    }
    
    setErrorMessage('');
    return true;
  };

  // クイズを追加
  const addQuiz = () => {
    if (!validateQuizForm()) return;
    
    const newQuiz: Quiz = {
      quizId: `temp_${Date.now()}`, // 一時的なID、Firestoreに保存時に更新
      title: quizTitle,
      question,
      type,
      choices,
      correctAnswer,
      acceptableAnswers,
      explanation,
      genre,
      difficulty,
      createdBy: currentUser!.uid,
      createdAt: null as any, // サーバータイムスタンプで更新
      useCount: 0,
      correctCount: 0
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
    
    resetQuizForm();
    setShowQuizForm(false);
    setCurrentQuiz(null);
    
    // 変更を下書き保存
    setTimeout(() => saveDraft(false), 100);
  };

  // クイズを編集
  const editQuiz = (index: number) => {
    const quiz = quizzes[index];
    setQuizTitle(quiz.title);
    setQuestion(quiz.question);
    setType(quiz.type);
    setChoices(quiz.choices);
    setCorrectAnswer(quiz.correctAnswer);
    setAcceptableAnswers(quiz.acceptableAnswers);
    setExplanation(quiz.explanation);
    setDifficulty(quiz.difficulty as QuizDifficulty);
    setEditingQuizIndex(index);
    setShowQuizForm(true);
  };

  // クイズを削除
  const removeQuiz = (index: number) => {
    const updatedQuizzes = [...quizzes];
    updatedQuizzes.splice(index, 1);
    setQuizzes(updatedQuizzes);
    
    // 変更を下書き保存
    setTimeout(() => saveDraft(false), 100);
  };

  // 既存のクイズを選択して追加
  const selectExistingQuiz = (quiz: Quiz) => {
    if (quizzes.some(q => q.quizId === quiz.quizId)) {
      setErrorMessage('このクイズは既に単元に追加されています');
      return;
    }
    
    setQuizzes([...quizzes, quiz]);
    setShowAvailableQuizzes(false);
    
    // 変更を下書き保存
    setTimeout(() => saveDraft(false), 100);
  };

  // フォームをクリア
  const clearForm = () => {
    setDraftId(null);
    setTitle('');
    setDescription('');
    setGenre('');
    setQuizzes([]);
    setIsPublic(true);
    resetQuizForm();
  };

  // クイズフォームをリセット
  const resetQuizForm = () => {
    setQuizTitle('');
    setQuestion('');
    setType('multiple_choice');
    setChoices(['', '', '', '']);
    setCorrectAnswer('');
    setAcceptableAnswers(['']);
    setExplanation('');
    setDifficulty(3);
    setEditingQuizIndex(null);
  };

  // 選択肢の更新
  const updateChoice = (index: number, value: string) => {
    const newChoices = [...choices];
    newChoices[index] = value;
    setChoices(newChoices);
  };

  // 許容回答の更新
  const updateAcceptableAnswer = (index: number, value: string) => {
    const newAnswers = [...acceptableAnswers];
    newAnswers[index] = value;
    setAcceptableAnswers(newAnswers);
  };

  // 許容回答を追加
  const addAcceptableAnswer = () => {
    setAcceptableAnswers([...acceptableAnswers, '']);
  };

  // 許容回答を削除
  const removeAcceptableAnswer = (index: number) => {
    if (acceptableAnswers.length > 1) {
      const newAnswers = [...acceptableAnswers];
      newAnswers.splice(index, 1);
      setAcceptableAnswers(newAnswers);
    }
  };

  // フォーマットされた日時を返す
  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  // ユーザーが未ログインの場合は、ログインページへリダイレクト
  if (!currentUser) {
    return null; // useEffectでリダイレクト
  }

  return (
    <div className="app-container py-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <Link href="/quiz" className="flex items-center text-indigo-600 hover:text-indigo-800 transition-colors">
            <FaArrowLeft className="mr-2" /> クイズ一覧に戻る
          </Link>
          
          <div className="flex items-center space-x-2">
            {saving && (
              <div className="flex items-center text-gray-500">
                <FaSpinner className="animate-spin mr-2" /> 保存中...
              </div>
            )}
            {successMessage && (
              <div className="flex items-center text-green-600">
                <FaCheckCircle className="mr-2" /> {successMessage}
              </div>
            )}
            <button
              onClick={() => saveDraft()}
              className="btn-outline flex items-center"
              disabled={saving || loading}
            >
              <FaSave className="mr-2" /> 下書き保存
            </button>
            <button
              onClick={() => setShowDrafts(!showDrafts)}
              className="btn-outline flex items-center"
            >
              {showDrafts ? '下書きを閉じる' : '下書き一覧'}
            </button>
          </div>
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

          {errorMessage && (
            <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 rounded-lg mb-6">
              <div className="flex">
                <div className="ml-3">
                  <p>{errorMessage}</p>
                </div>
              </div>
            </div>
          )}

          {/* 下書き一覧 */}
          {showDrafts && (
            <div className="mb-8 border border-gray-200 rounded-lg p-4">
              <h2 className="text-lg font-medium mb-4">下書き一覧</h2>
              
              {drafts.length === 0 ? (
                <p className="text-gray-500">保存された下書きはありません</p>
              ) : (
                <div className="space-y-3">
                  {drafts.map(draft => (
                    <div
                      key={draft.draftId}
                      className="border border-gray-200 rounded-lg p-3 hover:bg-gray-50 cursor-pointer flex justify-between items-center"
                      onClick={() => loadDraft(draft)}
                    >
                      <div>
                        <h3 className="font-medium">{draft.title || '無題のクイズ'}</h3>
                        <p className="text-sm text-gray-500">
                          {draft.genre} {/* subgenreは存在しない場合があるのでオプショナルチェーン */}
                          更新: {formatDate(new Date(draft.updatedAt))}
                        </p>
                      </div>
                      <button
                        onClick={(e) => deleteDraft(draft.draftId, e)}
                        className="text-red-500 hover:text-red-700 p-2"
                        title="削除"
                      >
                        <FaTrash />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* クイズ単元作成フォーム */}
          <form onSubmit={(e) => { e.preventDefault(); publishUnit(); }}>
            <div className="space-y-6">
              {/* 基本情報 */}
              <div>
                <h2 className="text-xl font-semibold mb-4">基本情報</h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <div>
                    <label htmlFor="genre" className="form-label">ジャンル</label>
                    <select
                      id="genre"
                      className="form-select"
                      value={genre}
                      onChange={(e) => setGenre(e.target.value)}
                      required
                    >
                      <option value="">ジャンルを選択</option>
                      {genreClasses
                        .find(c => c.name === 'ユーザー作成')?.genres
                        .map(g => (
                          <option key={g.name} value={g.name}>{g.name}</option>
                        ))}
                    </select>
                  </div>
                  
                  <div>
                    <label htmlFor="isPublic" className="form-label">公開設定</label>
                    <div className="mt-2">
                      <label className="inline-flex items-center">
                        <input
                          type="checkbox"
                          checked={isPublic}
                          onChange={(e) => setIsPublic(e.target.checked)}
                          className="form-checkbox"
                        />
                        <span className="ml-2">公開する</span>
                      </label>
                    </div>
                  </div>
                </div>

                <div className="mb-6">
                  <label htmlFor="title" className="form-label">単元タイトル</label>
                  <input
                    type="text"
                    id="title"
                    className="form-input"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="単元のタイトルを入力（例：定期テスト対策6月）"
                    required
                  />
                </div>
                
                <div className="mb-6">
                  <label htmlFor="description" className="form-label">説明 (省略可)</label>
                  <textarea
                    id="description"
                    className="form-textarea"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="この単元についての説明"
                    rows={3}
                  ></textarea>
                </div>
              </div>
              
              {/* クイズ一覧 */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold">クイズ一覧</h2>
                  <div className="flex space-x-2">
                    <button
                      type="button"
                      onClick={() => setShowAvailableQuizzes(!showAvailableQuizzes)}
                      className="btn-outline-sm flex items-center"
                      disabled={!genre}
                    >
                      <FaPlus className="mr-1" size={12} /> 既存のクイズから追加
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCurrentQuiz(null);
                        setEditingQuizIndex(null);
                        resetQuizForm();
                        setShowQuizForm(true);
                      }}
                      className="btn-outline-sm flex items-center"
                    >
                      <FaPlus className="mr-1" size={12} /> 新しいクイズを作成
                    </button>
                  </div>
                </div>
                
                {/* 既存のクイズ選択ダイアログ */}
                {showAvailableQuizzes && (
                  <div className="mb-6 border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-medium">既存のクイズ</h3>
                      <button
                        type="button"
                        onClick={() => setShowAvailableQuizzes(false)}
                        className="text-gray-500 hover:text-gray-700"
                      >
                        閉じる
                      </button>
                    </div>
                    
                    {loading ? (
                      <div className="flex justify-center py-4">
                        <FaSpinner className="animate-spin text-indigo-600" />
                      </div>
                    ) : availableQuizzes.length === 0 ? (
                      <p className="text-gray-500">このジャンルにはまだクイズがありません</p>
                    ) : (
                      <div className="space-y-3 max-h-80 overflow-y-auto">
                        {availableQuizzes.map(quiz => (
                          <div
                            key={quiz.quizId}
                            className={`border ${
                              quizzes.some(q => q.quizId === quiz.quizId)
                                ? 'border-green-200 bg-green-50'
                                : 'border-gray-200'
                            } rounded-lg p-3 hover:bg-gray-50 cursor-pointer`}
                            onClick={() => selectExistingQuiz(quiz)}
                          >
                            <div className="flex justify-between">
                              <h4 className="font-medium">{quiz.title}</h4>
                              <span className="text-sm bg-gray-100 px-2 py-1 rounded">
                                難易度: {quiz.difficulty}
                              </span>
                            </div>
                            <p className="text-sm text-gray-700 mt-1">{quiz.question.substring(0, 100)}...</p>
                            {quizzes.some(q => q.quizId === quiz.quizId) && (
                              <div className="mt-2 text-green-600 flex items-center">
                                <FaCheck className="mr-1" /> 単元に追加済み
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                
                {/* クイズフォーム */}
                {showQuizForm && (
                  <div className="mb-6 border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-medium">{editingQuizIndex !== null ? 'クイズを編集' : '新しいクイズ'}</h3>
                      <button
                        type="button"
                        onClick={() => setShowQuizForm(false)}
                        className="text-gray-500 hover:text-gray-700"
                      >
                        キャンセル
                      </button>
                    </div>
                    
                    <div className="space-y-4">
                      <div>
                        <label htmlFor="quizTitle" className="form-label">クイズタイトル</label>
                        <input
                          type="text"
                          id="quizTitle"
                          className="form-input"
                          value={quizTitle}
                          onChange={(e) => setQuizTitle(e.target.value)}
                          placeholder="クイズのタイトルを入力"
                          required
                        />
                      </div>
                      
                      <div>
                        <label htmlFor="question" className="form-label">問題文</label>
                        <textarea
                          id="question"
                          className="form-textarea"
                          value={question}
                          onChange={(e) => setQuestion(e.target.value)}
                          placeholder="問題文を入力"
                          rows={3}
                          required
                        ></textarea>
                      </div>
                      
                      <div>
                        <label className="form-label">難易度</label>
                        <div className="flex items-center space-x-2">
                          {[1, 2, 3, 4, 5].map((level) => (
                            <button
                              key={level}
                              type="button"
                              className={`w-8 h-8 rounded-full flex items-center justify-center ${
                                level <= difficulty
                                  ? 'bg-yellow-400 text-white'
                                  : 'bg-gray-200 text-gray-600'
                              }`}
                              onClick={() => setDifficulty(level as QuizDifficulty)}
                            >
                              {level}
                            </button>
                          ))}
                        </div>
                      </div>
                      
                      <div>
                        <label className="form-label">問題タイプ</label>
                        <div className="flex space-x-4">
                          <label className="flex items-center">
                            <input
                              type="radio"
                              name="type"
                              value="multiple_choice"
                              checked={type === 'multiple_choice'}
                              onChange={() => setType('multiple_choice')}
                              className="mr-2"
                            />
                            選択式
                          </label>
                          <label className="flex items-center">
                            <input
                              type="radio"
                              name="type"
                              value="input"
                              checked={type === 'input'}
                              onChange={() => setType('input')}
                              className="mr-2"
                            />
                            入力式
                          </label>
                        </div>
                      </div>
                      
                      {/* 選択式の場合の選択肢 */}
                      {type === 'multiple_choice' && (
                        <div className="space-y-3">
                          <p className="form-label">選択肢</p>
                          
                          {choices.map((choice, index) => (
                            <div key={index} className="flex items-center">
                              <label className="inline-flex items-center mr-4">
                                <input
                                  type="radio"
                                  name="correctAnswer"
                                  value={choice}
                                  checked={correctAnswer === choice}
                                  onChange={() => setCorrectAnswer(choice)}
                                  className="mr-2"
                                  disabled={!choice.trim()}
                                />
                                <span className="w-6 h-6 flex items-center justify-center bg-indigo-100 text-indigo-800 rounded-full mr-2">
                                  {String.fromCharCode(65 + index)}
                                </span>
                              </label>
                              <input
                                type="text"
                                value={choice}
                                onChange={(e) => updateChoice(index, e.target.value)}
                                className="form-input"
                                placeholder={`選択肢 ${String.fromCharCode(65 + index)}`}
                                required
                              />
                            </div>
                          ))}
                        </div>
                      )}
                      
                      {/* 入力式の場合の正解と許容回答 */}
                      {type === 'input' && (
                        <div className="space-y-4">
                          <div>
                            <label htmlFor="correctAnswer" className="form-label">正解</label>
                            <input
                              type="text"
                              id="correctAnswer"
                              className="form-input"
                              value={correctAnswer}
                              onChange={(e) => setCorrectAnswer(e.target.value)}
                              placeholder="正解を入力"
                            />
                          </div>
                          
                          {acceptableAnswers.map((answer, index) => (
                            <div key={index} className="flex items-center mb-2">
                              <input
                                type="text"
                                value={answer}
                                onChange={(e) => updateAcceptableAnswer(index, e.target.value)}
                                className="form-input mr-2"
                                placeholder="別の正解を入力"
                              />
                              {acceptableAnswers.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => removeAcceptableAnswer(index)}
                                  className="text-red-500 hover:text-red-700"
                                >
                                  <FaTrash />
                                </button>
                              )}
                            </div>
                          ))}
                          <p className="text-sm text-gray-500">
                            入力式の問題では表記ゆれを考慮して複数の回答を許容できます
                          </p>
                        </div>
                      )}
                      
                      <div>
                        <label htmlFor="quizExplanation" className="form-label">解説 (省略可)</label>
                        <textarea
                          id="quizExplanation"
                          className="form-textarea"
                          value={explanation}
                          onChange={(e) => setExplanation(e.target.value)}
                          placeholder="解説を入力"
                          rows={3}
                        ></textarea>
                      </div>
                      
                      <div className="flex justify-end pt-2">
                        <button
                          type="button"
                          onClick={addQuiz}
                          className="btn-primary flex items-center"
                        >
                          {editingQuizIndex !== null ? (
                            <>
                              <FaCheck className="mr-2" /> 更新する
                            </>
                          ) : (
                            <>
                              <FaPlus className="mr-2" /> 追加する
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
                {quizzes.length === 0 ? (
                  <div className="text-center py-8 border border-dashed border-gray-300 rounded-lg">
                    <p className="text-gray-500">クイズがまだ追加されていません</p>
                    <p className="text-sm text-gray-400 mt-1">「新しいクイズを作成」または「既存のクイズから追加」を使って、単元にクイズを追加してください</p>
                  </div>
                ) : (
                  <div className="space-y-4 mb-6">
                    {quizzes.map((quiz, index) => (
                      <div key={index} className="border border-gray-200 rounded-lg p-4 relative">
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="font-medium">{quiz.title || '無題のクイズ'}</h3>
                            <p className="text-sm text-gray-700 mt-1">{quiz.question.substring(0, 100)}...</p>
                            <div className="flex items-center mt-2 text-sm">
                              <span className="bg-gray-100 px-2 py-1 rounded mr-2">
                                {quiz.type === 'multiple_choice' ? '選択式' : '入力式'}
                              </span>
                              <span className="bg-yellow-100 px-2 py-1 rounded">
                                難易度: {quiz.difficulty}
                              </span>
                            </div>
                          </div>
                          <div className="flex space-x-1">
                            <button
                              type="button"
                              onClick={() => editQuiz(index)}
                              className="p-2 text-indigo-600 hover:text-indigo-800"
                              title="編集"
                            >
                              <FaPen />
                            </button>
                            <button
                              type="button"
                              onClick={() => removeQuiz(index)}
                              className="p-2 text-red-500 hover:text-red-700"
                              title="削除"
                            >
                              <FaTrash />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
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
