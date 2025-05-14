'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { db } from '@/config/firebase'; 
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { FaArrowLeft, FaSave, FaUpload, FaTrash, FaSpinner, FaCheckCircle } from 'react-icons/fa';
import { Quiz, QuizType } from '@/types/quiz';
import { genreClasses } from '@/constants/genres';

// QuizDifficultyを定義
export type QuizDifficulty = 1 | 2 | 3 | 4 | 5;

// IndexedDB用の定数
const DB_NAME = 'quiz-drafts-db';
const STORE_NAME = 'quiz-drafts';
const DB_VERSION = 1;

interface DraftQuiz extends Omit<Quiz, 'quizId' | 'createdAt' | 'useCount' | 'correctCount'> {
  draftId: string;
  updatedAt: Date;
}

export default function CreateQuizPage() {
  const { currentUser } = useAuth();
  const router = useRouter();

  // クイズの状態
  const [title, setTitle] = useState('');
  const [question, setQuestion] = useState('');
  const [type, setType] = useState<QuizType>('multiple_choice');
  const [choices, setChoices] = useState<string[]>(['', '', '', '']);
  const [correctAnswer, setCorrectAnswer] = useState('');
  const [acceptableAnswers, setAcceptableAnswers] = useState<string[]>(['']);
  const [explanation, setExplanation] = useState('');
  const [genre, setGenre] = useState('');
  const [subgenre, setSubgenre] = useState('');
  const [difficulty, setDifficulty] = useState<QuizDifficulty>(3);
  
  // UI関連の状態
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [availableSubgenres, setAvailableSubgenres] = useState<string[]>([]);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<DraftQuiz[]>([]);
  const [showDrafts, setShowDrafts] = useState(false);
  
  // タイマー参照
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // IndexedDBの初期化
  useEffect(() => {
    if (!currentUser) {
      router.push('/auth/login');
      return;
    }
    
    initIndexedDB();
    loadDrafts();
    
    // 自動保存タイマーの設定
    autoSaveTimerRef.current = setInterval(() => {
      if (title || question) {
        saveDraft(false);
      }
    }, 30000); // 30秒ごとに自動保存
    
    return () => {
      if (autoSaveTimerRef.current) {
        clearInterval(autoSaveTimerRef.current);
      }
    };
  }, [currentUser, router]);

  // ジャンルが変更されたときにサブジャンルのリストを更新
  useEffect(() => {
    if (genre) {
      const subgenresList = getSubgenresForGenre(genre);
      setAvailableSubgenres(subgenresList);
      
      // サブジャンルのリストが変わったら選択を解除
      if (!subgenresList.includes(subgenre)) {
        setSubgenre('');
      }
    } else {
      setAvailableSubgenres([]);
      setSubgenre('');
    }
  }, [genre, subgenre]);

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
        const userDrafts = query.result as DraftQuiz[];
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
    const draftQuiz: DraftQuiz = {
      draftId: draftId || `draft_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      title,
      question,
      type,
      choices,
      correctAnswer,
      acceptableAnswers,
      explanation,
      genre,
      subgenre,
      difficulty,
      createdBy: currentUser.uid,
      updatedAt: now
    };
    
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onsuccess = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      
      const saveRequest = store.put(draftQuiz);
      
      saveRequest.onsuccess = () => {
        setDraftId(draftQuiz.draftId);
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
  const loadDraft = (draft: DraftQuiz) => {
    setDraftId(draft.draftId);
    setTitle(draft.title);
    setQuestion(draft.question);
    setType(draft.type);
    setChoices(draft.choices);
    setCorrectAnswer(draft.correctAnswer);
    setAcceptableAnswers(draft.acceptableAnswers);
    setExplanation(draft.explanation);
    setGenre(draft.genre);
    setSubgenre(draft.subgenre);
    setDifficulty(draft.difficulty as QuizDifficulty);
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

  // 新しいクイズを公開
  const publishQuiz = async () => {
    if (!validateForm()) return;
    
    setLoading(true);
    
    try {
      // Firestoreにクイズを追加
      const quizData = {
        title,
        question,
        type,
        choices,
        correctAnswer,
        acceptableAnswers,
        explanation,
        genre,
        subgenre,
        difficulty,
        createdBy: currentUser!.uid,
        createdAt: serverTimestamp(),
        useCount: 0,
        correctCount: 0
      };
      
      const docRef = await addDoc(collection(db, 'quizzes'), quizData);
      
      // 公開成功したら下書きを削除
      if (draftId) {
        deleteDraft(draftId);
      }
      
      setSuccessMessage('クイズを公開しました！');
      clearForm();
      
      // 3秒後にクイズプレイページに遷移
      setTimeout(() => {
        router.push('/quiz');
      }, 3000);
    } catch (error) {
      console.error('Error publishing quiz:', error);
      setErrorMessage('クイズの公開に失敗しました。');
    }
    
    setLoading(false);
  };

  // フォームの検証
  const validateForm = () => {
    if (!title.trim()) {
      setErrorMessage('タイトルを入力してください');
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
    
    if (!genre) {
      setErrorMessage('ジャンルを選択してください');
      return false;
    }
    
    if (!subgenre) {
      setErrorMessage('単元を選択してください');
      return false;
    }
    
    setErrorMessage('');
    return true;
  };

  // フォームをクリア
  const clearForm = () => {
    setDraftId(null);
    setTitle('');
    setQuestion('');
    setType('multiple_choice');
    setChoices(['', '', '', '']);
    setCorrectAnswer('');
    setAcceptableAnswers(['']);
    setExplanation('');
    setGenre('');
    setSubgenre('');
    setDifficulty(3);
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

  // ジャンルに対応するサブジャンルのリストを取得
  const getSubgenresForGenre = (selectedGenre: string): string[] => {
    const allSubgenres: string[] = [];
    
    // 「ユーザー作成」のサブジャンルのみ返す
    for (const classType of genreClasses) {
      if (classType.name === 'ユーザー作成') {
        for (const genreInfo of classType.genres) {
          if (genreInfo.name === selectedGenre) {
            for (const categorySubgenres of Object.values(genreInfo.subgenres)) {
              allSubgenres.push(...categorySubgenres);
            }
          }
        }
      }
    }
    
    return allSubgenres;
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
                          {draft.genre} {draft.subgenre && `- ${draft.subgenre}`} • 
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

          {/* クイズ作成フォーム */}
          <form onSubmit={(e) => { e.preventDefault(); publishQuiz(); }}>
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
                    <label htmlFor="subgenre" className="form-label">単元</label>
                    <select
                      id="subgenre"
                      className="form-select"
                      value={subgenre}
                      onChange={(e) => setSubgenre(e.target.value)}
                      required
                      disabled={!genre}
                    >
                      <option value="">単元を選択</option>
                      {availableSubgenres.map(sg => (
                        <option key={sg} value={sg}>{sg}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="mb-6">
                  <label htmlFor="title" className="form-label">タイトル</label>
                  <input
                    type="text"
                    id="title"
                    className="form-input"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="クイズのタイトルを入力"
                    required
                  />
                </div>
                
                <div className="mb-6">
                  <label htmlFor="question" className="form-label">問題文</label>
                  <textarea
                    id="question"
                    className="form-textarea"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    placeholder="問題文を入力"
                    rows={4}
                    required
                  ></textarea>
                </div>
                
                <div className="mb-6">
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
              </div>
              
              {/* 問題タイプ */}
              <div>
                <h2 className="text-xl font-semibold mb-4">問題タイプ</h2>
                
                <div className="flex space-x-4 mb-6">
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
                
                {/* 選択式の場合の選択肢 */}
                {type === 'multiple_choice' && (
                  <div className="space-y-4 mb-6">
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
                  <div className="space-y-6 mb-6">
                    <div>
                      <label htmlFor="correctAnswer" className="form-label">正解</label>
                      <input
                        type="text"
                        id="correctAnswer"
                        className="form-input"
                        value={correctAnswer}
                        onChange={(e) => setCorrectAnswer(e.target.value)}
                        placeholder="正解を入力"
                        required
                      />
                    </div>
                    
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="form-label">許容される他の回答 (省略可)</label>
                        <button
                          type="button"
                          onClick={addAcceptableAnswer}
                          className="text-sm text-indigo-600 hover:text-indigo-800"
                        >
                          + 追加
                        </button>
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
                  </div>
                )}
              </div>
              
              {/* 解説 */}
              <div>
                <h2 className="text-xl font-semibold mb-4">解説 (省略可)</h2>
                <textarea
                  id="explanation"
                  className="form-textarea"
                  value={explanation}
                  onChange={(e) => setExplanation(e.target.value)}
                  placeholder="解説を入力"
                  rows={4}
                ></textarea>
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
                      <FaUpload className="mr-2" /> クイズを公開する
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
