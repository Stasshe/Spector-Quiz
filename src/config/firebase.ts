import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getPerformance } from 'firebase/performance';

// メインプロジェクトの設定（quiz_rooms, genresコレクション用）
const mainFirebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Usersプロジェクトの設定（usersコレクション用）
const usersFirebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_USERS_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_USERS_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_USERS_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_USERS_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_USERS_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_USERS_APP_ID,
};

// Firebaseアプリを初期化
const mainApp = initializeApp(mainFirebaseConfig, 'main');
const usersApp = initializeApp(usersFirebaseConfig, 'users');

// メインプロジェクトのインスタンス（quiz_rooms, genres用）
export const auth = getAuth(mainApp);
export const db = getFirestore(mainApp);

// Usersプロジェクトのインスタンス（users用）
export const usersAuth = getAuth(usersApp);
export const usersDb = getFirestore(usersApp);

// Performance Monitoringを初期化（クライアントサイドのみで実行）
export const perf = typeof window !== 'undefined' ? getPerformance(mainApp) : null;
export const usersPerf = typeof window !== 'undefined' ? getPerformance(usersApp) : null;
