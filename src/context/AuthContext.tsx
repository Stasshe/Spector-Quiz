'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  User as FirebaseUser
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp, collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { auth, db } from '@/config/firebase';
import { User, UserProfile } from '@/types/user';

interface AuthContextType {
  currentUser: FirebaseUser | null;
  userProfile: UserProfile | null;
  login: (userId: string, password: string) => Promise<void>;
  register: (password: string, username: string, iconId: number) => Promise<string>;
  logout: () => Promise<void>;
  loading: boolean;
  initialized: boolean; // 初期化完了フラグを追加
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false); // 初期化状態を追加

  // Firebase認証の状態変更監視
  useEffect(() => {
    console.log('Setting up auth state listener');
    let isMounted = true;
    
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      console.log('Auth state changed:', user ? `User: ${user.uid}` : 'No user');
      
      if (!isMounted) {
        console.log('Component unmounted, skipping auth state update');
        return;
      }
      
      setCurrentUser(user);
      
      if (user) {
        try {
          const userDocRef = doc(db, 'users', user.uid);
          const userDoc = await getDoc(userDocRef);
          
          if (userDoc.exists()) {
            const userData = userDoc.data() as User;
            setUserProfile({
              userId: userData.userId,
              username: userData.username,
              iconId: userData.iconId,
              exp: userData.exp,
              rank: userData.rank,
              stats: userData.stats,
              isAdmin: userData.userId === "100000" // ユーザーIDが100000なら管理者権限を付与
            });
            
            // ユーザーがオンライン状態であることを更新
            await setDoc(userDocRef, {
              isOnline: true,
              lastLoginAt: serverTimestamp()
            }, { merge: true });
          } else {
            console.warn('User document does not exist for uid:', user.uid);
            setUserProfile(null);
          }
        } catch (error) {
          console.error('Error fetching user profile:', error);
          setUserProfile(null);
        }
      } else {
        setUserProfile(null);
      }
      
      setLoading(false);
      setInitialized(true); // 初期化完了をマーク
      console.log('Auth initialization complete');
    });

    // コンポーネントのアンマウント時にFirebase認証の監視を解除
    return () => {
      isMounted = false;
      console.log('Cleaning up auth state listener');
      unsubscribe();
    };
  }, []);

  // アプリケーション終了時にユーザーをオフラインに設定
  useEffect(() => {
    const handleBeforeUnload = async () => {
      if (auth.currentUser) {
        try {
          const userRef = doc(db, 'users', auth.currentUser.uid);
          await setDoc(userRef, {
            isOnline: false
          }, { merge: true });
        } catch (error) {
          console.error('Error setting user offline:', error);
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  // 次のユーザーIDを生成する関数（6桁）
  const generateNextUserId = async (): Promise<string> => {
    try {
      // ユーザーコレクションから最新のユーザーIDを取得
      const usersRef = collection(db, 'users');
      const q = query(usersRef, orderBy('userId', 'desc'), limit(1));
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        // ユーザーがまだいない場合は、初期値として '100000' を返す
        return '100000';
      }
      
      // 最新のユーザーIDを取得して次の番号を生成
      const latestUser = querySnapshot.docs[0].data() as User;
      const latestUserId = latestUser.userId;
      
      // 現在のIDが数値形式でない場合は初期値を返す
      if (!/^\d+$/.test(latestUserId)) {
        return '100000';
      }
      
      // 次の番号を計算
      const nextNum = parseInt(latestUserId, 10) + 1;
      // 6桁になるように0埋め
      return nextNum.toString().padStart(6, '0');
    } catch (error) {
      console.error('Error generating next user ID:', error);
      // エラー時はランダムな6桁の数字を生成
      return Math.floor(100000 + Math.random() * 900000).toString();
    }
  };

  const login = async (userId: string, password: string) => {
    try {
      setLoading(true);
      // メールアドレスの代わりにuserIdを使用するための特殊なフォーマット
      // Firebase Authはメールアドレスを必要とするため、ダミーのメールアドレスを作成
      const email = `${userId}@zap-quiz.app`;
      await signInWithEmailAndPassword(auth, email, password);
      
      // ユーザープロファイルの更新はonAuthStateChangedで行われるので、ここでは不要
      return;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const register = async (password: string, username: string, iconId: number) => {
    try {
      setLoading(true);
      
      // 次のユーザーIDを自動生成
      const nextUserId = await generateNextUserId();
      
      // メールアドレスの代わりにuserIdを使用するための特殊なフォーマット
      // Firebase Authはメールアドレスを必要とするため、ダミーのメールアドレスを作成
      const email = `${nextUserId}@zap-quiz.app`;
      
      // Firebase Authで新規ユーザー作成
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      // Firestoreにユーザー情報を保存
      const newUser: User = {
        userId: nextUserId, // 自動生成されたユーザーID
        username,
        passwordHash: '', // クライアントサイドでは空にして、Firebase Authに任せる
        iconId,
        exp: 0,
        rank: 'ビギナー',
        createdAt: serverTimestamp() as any,
        lastLoginAt: serverTimestamp() as any,
        isOnline: true,
        currentRoomId: null,
        stats: {
          totalAnswered: 0,
          correctAnswers: 0,
          genres: {}
        }
      };
      
      await setDoc(doc(db, 'users', user.uid), newUser);
      
      // 登録後、自動的にログイン状態にするために、生成されたIDを返す
      return nextUserId;
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      setLoading(true);
      // ユーザーがログアウトする前にオンライン状態を更新
      if (auth.currentUser) {
        const userRef = doc(db, 'users', auth.currentUser.uid);
        await setDoc(userRef, {
          isOnline: false,
          currentRoomId: null,
          lastLoginAt: serverTimestamp()
        }, { merge: true });
      }
      
      await signOut(auth);
    } catch (error) {
      console.error('Logout error:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const value = {
    currentUser,
    userProfile,
    login,
    register,
    logout,
    loading,
    initialized // 初期化状態を公開
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
