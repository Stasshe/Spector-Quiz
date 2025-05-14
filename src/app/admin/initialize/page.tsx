'use client';

import { useState } from 'react';
import { db } from '@/config/firebase';
import { collection, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '@/hooks/useAuth';
import { genreClasses } from '@/constants/genres';

export default function InitializeDatabase() {
  const { currentUser } = useAuth();
  const [status, setStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const initializeGenres = async () => {
    if (!currentUser) {
      setMessage('ログインが必要です');
      return;
    }

    setStatus('processing');
    setMessage('データベースを初期化中...');

    try {
      // ユーザー作成ジャンルを追加
      const userCreatedGenres = genreClasses.find(c => c.name === 'ユーザー作成')?.genres || [];
      
      for (const genre of userCreatedGenres) {
        try {
          setMessage(prev => prev + `\nジャンル「${genre.name}」を作成中...`);
          const genreRef = doc(db, 'genres', genre.name);
          await setDoc(genreRef, {
            name: genre.name,
            isUserCreated: true,
            createdBy: currentUser.uid,
            createdAt: serverTimestamp(),
            useCount: 0
          });
          setMessage(prev => prev + ` 成功！`);
          
          // 各ジャンルの下に空のダミー単元を作成（初期化用）
          const dummyUnitRef = doc(collection(db, 'genres', genre.name, 'quiz_units'));
          await setDoc(dummyUnitRef, {
            title: 'ダミー単元（初期化用）',
            description: '初期化用のダミー単元です',
            createdBy: currentUser.uid,
            createdAt: serverTimestamp(),
            quizCount: 0,
            useCount: 0,
            isPublic: false,
            averageDifficulty: 0
          });
          setMessage(prev => prev + `\n└ ダミー単元を作成しました`);
          
          // 単元内にダミークイズを作成
          const dummyQuizRef = doc(collection(db, 'genres', genre.name, 'quiz_units', dummyUnitRef.id, 'quizzes'));
          await setDoc(dummyQuizRef, {
            title: 'ダミークイズ（初期化用）',
            question: 'これは初期化用のダミークイズです',
            type: 'multiple_choice',
            choices: ['選択肢1', '選択肢2', '選択肢3', '選択肢4'],
            correctAnswer: '選択肢1',
            acceptableAnswers: [],
            explanation: 'ダミークイズの説明です',
            difficulty: 1,
            createdBy: currentUser.uid,
            createdAt: serverTimestamp(),
            useCount: 0,
            correctCount: 0
          });
          setMessage(prev => prev + `\n└ ダミークイズを作成しました`);
          
        } catch (genreError) {
          console.error(`Error creating genre ${genre.name}:`, genreError);
          setMessage(prev => prev + ` エラー: ${genreError instanceof Error ? genreError.message : '不明なエラー'}`);
        }
      }

      // サンプルクイズをメインクイズコレクションに追加
      try {
        setMessage(prev => prev + `\n\nサンプルクイズを作成中...`);
        const quizRef = doc(collection(db, 'quizzes'));
        await setDoc(quizRef, {
          title: 'サンプルクイズ',
          question: 'これはサンプルクイズです',
          type: 'multiple_choice',
          choices: ['選択肢1', '選択肢2', '選択肢3', '選択肢4'],
          correctAnswer: '選択肢1',
          acceptableAnswers: [],
          explanation: 'サンプルクイズの説明です',
          genre: '日本史',
          difficulty: 3,
          createdBy: currentUser.uid,
          createdAt: serverTimestamp(),
          useCount: 0,
          correctCount: 0
        });
        setMessage(prev => prev + ` 成功！`);
      } catch (quizError) {
        console.error('Error creating sample quiz:', quizError);
        setMessage(prev => prev + ` エラー: ${quizError instanceof Error ? quizError.message : '不明なエラー'}`);
      }

      setStatus('success');
      setMessage(prev => prev + '\n\nデータベースの初期化が完了しました！');
    } catch (error) {
      console.error('Error initializing database:', error);
      setStatus('error');
      if (error instanceof Error) {
        setMessage(`エラーが発生しました: ${error.message}`);
      } else {
        setMessage('エラーが発生しました');
      }
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">データベース初期化</h1>
      <p className="mb-4">
        このページでは、アプリケーションで使用するジャンルを初期化します。
        このプロセスは一度だけ実行する必要があります。
      </p>
      
      <div className="mb-6">
        <button
          onClick={initializeGenres}
          disabled={status === 'processing' || !currentUser}
          className={`px-4 py-2 rounded font-bold ${
            status === 'processing'
              ? 'bg-gray-400 text-white cursor-not-allowed'
              : 'bg-indigo-600 text-white hover:bg-indigo-700'
          }`}
        >
          {status === 'processing' ? '処理中...' : 'データベースを初期化'}
        </button>
      </div>
      
      {message && (
        <div className={`p-4 rounded mb-4 ${
          status === 'error' 
            ? 'bg-red-100 text-red-800' 
            : status === 'success'
            ? 'bg-green-100 text-green-800'
            : 'bg-blue-100 text-blue-800'
        }`}>
          <pre className="whitespace-pre-wrap">{message}</pre>
        </div>
      )}
      
      {status === 'success' && (
        <div className="mt-4">
          <a
            href="/quiz/create-quiz"
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          >
            クイズ作成ページに移動
          </a>
        </div>
      )}
    </div>
  );
}
