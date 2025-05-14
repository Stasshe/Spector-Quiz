# オンラインマルチクイズアプリケーション仕様書

## 1. プロジェクト概要

### 1.1 アプリケーション概要
- アプリ名：Zap!
- 種類：オンラインマルチクイズアプリケーション
- プラットフォーム：ウェブブラウザ（レスポンシブ対応）
- ホスティング：静的ホスティング（Render/Vercel/Netlify等）

### 1.2 主な機能
- オンラインマルチプレイヤー対戦クイズ
- ジャンル・単元ベースのクイズ選択
- 早押し方式のクイズゲーム
- 回答方法：四択問題と入力式問題（記述式）
- 経験値システムとランク制度
- シンプルなユーザー認証

## 2. 技術スタック

### 2.1 フロントエンド
- React/Next.js（SPA方式）
- TypeScript
- TailwindCSS（UIフレームワーク）
- 必要に応じてコンポーネントライブラリを使用できます

### 2.2 アーキテクチャ
- SSG(output:export)で、SPAとする
- 静的ホスティング（サーバーサイド処理なし）
- 分散型処理（ルームリーダーモデル）
  - 各クイズルームに1名のリーダーが存在
  - リーダーはクライアント内でバックエンド的な役割を果たす

### 2.3 データベース
- Firebase Firestore
  - リアルタイム更新機能でクイズの早押し機能に適している
  - クライアントサイドでの直接接続が可能
  - セキュリティルールによるアクセス制御
  - 無料枠を使います

### 2.4 認証
- Firebase Authentication
  - ID/パスワード認証（またはカスタム認証）
  - ブラウザのローカルストレージを利用した自動ログイン
  - セキュリティはあまり重視しない（限られた数十人のみで使う）

## 3. 機能要件

### 3.1 認証機能
- ユーザー登録
  - ユーザーID（自動採番または選択）
  - パスワード
  - オプション：表示名、アイコン選択
- ログイン機能
  - ID/パスワードによるログイン
  - 自動ログイン（ローカルストレージ使用）
- ログアウト機能

### 3.2 ユーザープロフィール
- ユーザー名（表示名）
- プロフィールアイコン（選択式）
- 経験値（EXP）表示
- ランク表示
- プレイ統計（正解率、クリア問題数など）

### 3.3 クイズルーム機能
- ルーム作成・参加
- ルームリーダーシステム
  - 最初に単元のルームを作成したプレイヤーが自動的にルームリーダーに指定
  - リーダーは解答権の判定と進行を担当
  - ルーム終了時にリーダーがルームを削除
- 参加者一覧表示
- 絵文字送信機能（オプション）

### 3.4 クイズシステム
- ジャンル・単元ごとのクイズ提供
- 問題タイプ
  - 四択問題
  - 入力式問題（表現揺れに対応）
- 早押し機能
  - 解答ボタン押下時間をDBに記録
  - リーダーが解答権を判定
  - 解答権所持者をDB記録（他プレイヤーに表示）
- スコア計算と表示
- 正解・不正解の判定と表示

### 3.5 経験値・ランキングシステム
- 経験値獲得条件
  - 問題正解：基本EXP
  - 早押し成功：ボーナスEXP
  - 難易度：難易度に応じたボーナス
  - セッション完了：ボーナスEXP
- ランク制度
  - 経験値に基づくランク分け
  - ランクごとの特典（オプション）
- ランキング表示
  - グローバルランキング
  - ジャンル別ランキング

## 4. データベース設計

### 4.1 コレクション構造（Firebase Firestore）

#### users
```
users/{userId}
{
  userId: string,         // ユーザーID
  username: string,       // 表示名
  passwordHash: string,   // ハッシュ化されたパスワード
  iconId: number,         // アイコンID
  exp: number,            // 経験値
  rank: string,           // ランク
  createdAt: timestamp,   // 作成日時
  lastLoginAt: timestamp, // 最終ログイン日時
  isOnline: boolean,      // オンライン状態
  currentRoomId: string,  // 現在参加中のルームID（なければnull）
  stats: {
    totalAnswered: number,    // 総回答数
    correctAnswers: number,   // 正解数
    // ジャンルごとの統計情報
    genres: {
      [genreId]: {
        totalAnswered: number,
        correctAnswers: number,
      }
    }
  }
}
```

#### quizzes
```
quizzes/{quizId}
{
  quizId: string,           // クイズID
  title: string,            // クイズタイトル
  question: string,         // 問題文
  type: string,             // 'multiple_choice' または 'input'
  choices: array,           // 四択の場合の選択肢
  correctAnswer: string,    // 正解
  acceptableAnswers: array, // 入力式の場合の許容回答リスト
  explanation: string,      // 解説
  genre: string,            // ジャンル
  subgenre: string,         // 単元名
  difficulty: number,       // 難易度
  createdBy: string,        // 作成者ID
  createdAt: timestamp,     // 作成日時
  useCount: number,         // 出題回数
  correctCount: number,     // 正解回数
}
```

#### quiz_rooms
```
quiz_rooms/{roomId}
{
  roomId: string,           // ルームID
  name: string,             // ルーム名
  genre: string,            // ジャンル
  subgenre: string,         // 単元
  roomLeaderId: string,     // ルームリーダーのユーザーID
  participants: {           // 参加者情報
    [userId]: {
      username: string,     // 表示名
      iconId: number,       // アイコンID
      score: number,        // 現在のスコア
      isReady: boolean,     // 準備完了状態
      isOnline: boolean     // オンライン状態
    }
  },
  currentQuizIndex: number, // 現在の問題インデックス
  quizIds: array,           // 出題するクイズIDリスト
  totalQuizCount: number,   // クイズの総数
  startedAt: timestamp,     // 開始時間
  updatedAt: timestamp,     // 最終更新時間
  status: string,           // 'waiting', 'in_progress', 'completed'
  currentState: {           // 現在の出題状態
    quizId: string,         // 現在のクイズID
    startTime: timestamp,   // 問題開始時間
    endTime: timestamp,     // 問題終了時間（設定されていれば）
    currentAnswerer: string, // 現在の解答権を持つユーザーID
    answerStatus: string,   // 'waiting', 'answering', 'correct', 'incorrect', 'timeout'
    isRevealed: boolean,    // 解答・解説が表示されているか
  }
}
```

#### quiz_answers
```
quiz_rooms/{roomId}/answers/{answerId}
{
  answerId: string,        // 回答ID
  userId: string,          // 回答したユーザーID
  quizId: string,          // クイズID
  clickTime: timestamp,    // ボタンを押した時間
  answerTime: number,      // 回答までの時間（ミリ秒）
  answer: string,          // ユーザーの回答
  isCorrect: boolean,      // 正解か不正解か
  processingStatus: string, // 'pending', 'processed'（リーダーが処理済みか）
}
```

## 5. クライアント-データベース連携

### 5.1 クライアントからのデータベースアクセス
- Firebase SDKをクライアントに組み込み
- セキュリティルールによるアクセス制御
- リアルタイムリスナーの活用
  - 早押し判定用のデータ監視
  - クイズ状態の同期

### 5.2 ルームリーダーの役割
- クイズの進行管理
  - 次の問題への移行
  - タイムアウト処理
- 早押し判定
  1. 各プレイヤーの解答ボタン押下時間をDB監視
  2. 最速のプレイヤーに解答権を付与
  3. 解答権情報をDBに更新（全プレイヤーに反映）
- 解答判定
  - 正解/不正解の判定
  - スコア計算と更新
- ルーム終了処理
  - 最終結果の集計
  - 経験値の付与
  - ルームデータの削除

### 5.3 データフロー
1. クイズ開始時
   - リーダーがクイズデータをDBから取得し、ルームに設定
   - 参加者全員にクイズデータが配信される
2. 解答ボタン押下時
   - プレイヤーがDB内のanswersコレクションに時間情報を記録
   - リーダーがリアルタイムリスナーで更新を検知
   - 最速のプレイヤーに解答権を付与（DB更新）
3. 解答提出時
   - 解答内容をDBに記録
   - リーダーが正誤判定
   - 結果をDB更新（全プレイヤーに反映）
4. 次の問題への移行
   - リーダーがcurrentQuizIndexを更新
   - 新しい問題データが全プレイヤーに配信

## 6. ユーザーインターフェース

### 6.1 画面構成
- ログイン/登録画面
- ホーム画面（ジャンル選択）
- ルーム一覧/作成画面
- クイズルーム画面
  - 参加者一覧
  - 問題表示エリア
  - 解答エリア
  - スコアボード
- プロフィール画面
- ランキング画面

### 6.2 クイズプレイ画面の状態遷移
1. 待機状態
   - 参加者一覧表示
   - 準備完了ボタン
2. 出題状態
   - 問題文表示
   - 解答ボタン（早押し）
3. 解答権取得状態
   - 解答入力/選択UI
   - 制限時間表示
4. 結果表示状態
   - 正解/不正解表示
   - 解説表示
   - スコア更新
5. セッション終了状態
   - 最終スコア表示
   - 獲得経験値表示
   - 次のセッション/ホームへ戻るボタン

## 7. プロジェクト構造

```
/
├── public/
│   ├── images/
│   │   └── avatars/      # ユーザーアバター画像
│   └── favicon.ico
├── src/
│   ├── components/       # Reactコンポーネント
│   │   ├── auth/         # 認証関連コンポーネント
│   │   ├── layout/       # レイアウトコンポーネント
│   │   ├── quiz/         # クイズ関連コンポーネント
│   │   │   ├── QuizQuestion.tsx      # 問題表示
│   │   │   ├── AnswerInput.tsx       # 解答入力
│   │   │   ├── QuizResult.tsx        # 結果表示
│   │   │   ├── ParticipantList.tsx   # 参加者一覧
│   │   │   └── ScoreBoard.tsx        # スコアボード
│   │   └── ui/           # 共通UIコンポーネント
│   ├── config/           # 設定ファイル
│   │   └── firebase.ts   # Firebase設定
│   ├── context/          # Reactコンテキスト
│   │   ├── AuthContext.tsx   # 認証コンテキスト
│   │   └── QuizContext.tsx   # クイズコンテキスト
│   ├── hooks/            # カスタムフック
│   │   ├── useAuth.ts        # 認証フック
│   │   ├── useQuiz.ts        # クイズフック
│   │   ├── useQuizRoom.ts    # ルーム管理フック
│   │   └── useLeader.ts      # リーダー機能フック
│   ├── pages/            # Next.jsページ
│   │   ├── auth/         # 認証ページ
│   │   │   ├── login.tsx
│   │   │   └── register.tsx
│   │   ├── quiz/         # クイズページ
│   │   │   ├── index.tsx     # ジャンル選択
│   │   │   ├── rooms.tsx     # ルーム一覧
│   │   │   └── [roomId].tsx  # クイズルーム
│   │   ├── profile/      # プロフィールページ
│   │   │   └── [userId].tsx
│   │   ├── ranking/      # ランキングページ
│   │   │   └── index.tsx
│   │   ├── _app.tsx
│   │   └── index.tsx     # ホームページ
│   ├── services/         # サービス層
│   │   ├── auth.ts       # 認証サービス
│   │   ├── quiz.ts       # クイズデータサービス
│   │   ├── room.ts       # ルーム管理サービス
│   │   └── user.ts       # ユーザーサービス
│   ├── types/            # 型定義
│   │   ├── quiz.ts       # クイズ関連の型
│   │   ├── room.ts       # ルーム関連の型
│   │   └── user.ts       # ユーザー関連の型
│   └── utils/            # ユーティリティ関数
│       ├── firebase.ts   # Firebase操作ヘルパー
│       ├── leader.ts     # リーダー機能ヘルパー
│       └── quiz.ts       # クイズロジックヘルパー
├── .gitignore
├── next.config.js
├── package.json
├── tailwind.config.js
└── tsconfig.json
```

## 8. クライアントサイドリーダー実装

### 8.1 リーダー選出ロジック
```typescript
// src/utils/leader.ts
export const determineRoomLeader = async (roomId: string, userId: string) => {
  const roomRef = doc(db, 'quiz_rooms', roomId);
  const roomSnap = await getDoc(roomRef);
  
  if (!roomSnap.exists()) {
    // ルームが存在しない場合は新規作成し、自分がリーダーになる
    await setDoc(roomRef, {
      roomId,
      roomLeaderId: userId,
      participants: { [userId]: { /* 参加者情報 */ } },
      status: 'waiting',
      // その他必要な情報
    });
    return true; // リーダー
  } else {
    const roomData = roomSnap.data();
    if (!roomData.roomLeaderId) {
      // リーダーがいない場合は自分がリーダーに
      await updateDoc(roomRef, { roomLeaderId: userId });
      return true; // リーダー
    }
    return roomData.roomLeaderId === userId; // 既存のリーダーか確認
  }
};
```

### 8.2 早押し判定ロジック
```typescript
// src/hooks/useLeader.ts
const handleBuzzerUpdates = useCallback((roomId: string) => {
  const answersRef = collection(db, 'quiz_rooms', roomId, 'answers');
  const pendingAnswersQuery = query(
    answersRef,
    where('processingStatus', '==', 'pending'),
    orderBy('clickTime', 'asc')
  );

  return onSnapshot(pendingAnswersQuery, async (snapshot) => {
    if (snapshot.empty) return;
    
    // 最も早く押したユーザーを特定
    const fastestAnswer = snapshot.docs[0];
    const fastestUserId = fastestAnswer.data().userId;
    
    // 解答権をDBに記録
    await updateDoc(doc(db, 'quiz_rooms', roomId), {
      'currentState.currentAnswerer': fastestUserId,
      'currentState.answerStatus': 'answering',
    });
    
    // 処理済みとしてマーク
    await updateDoc(fastestAnswer.ref, {
      processingStatus: 'processed'
    });
    
    // 他の保留中の回答をキャンセル
    const batch = writeBatch(db);
    snapshot.docs.slice(1).forEach(doc => {
      batch.update(doc.ref, { processingStatus: 'processed' });
    });
    await batch.commit();
  });
}, []);
```

### 8.3 解答判定ロジック
```typescript
// src/hooks/useLeader.ts
const judgeAnswer = useCallback(async (roomId: string, answerId: string) => {
  // 解答データを取得
  const answerRef = doc(db, 'quiz_rooms', roomId, 'answers', answerId);
  const answerSnap = await getDoc(answerRef);
  if (!answerSnap.exists()) return;
  
  const answerData = answerSnap.data();
  const quizId = answerData.quizId;
  
  // クイズデータを取得
  const quizRef = doc(db, 'quizzes', quizId);
  const quizSnap = await getDoc(quizRef);
  if (!quizSnap.exists()) return;
  
  const quizData = quizSnap.data();
  const userAnswer = answerData.answer;
  const isCorrect = judgeCorrectness(quizData, userAnswer);
  
  // 結果をDBに記録
  const batch = writeBatch(db);
  
  // 解答結果の更新
  batch.update(answerRef, { isCorrect });
  
  // ルーム状態の更新
  batch.update(doc(db, 'quiz_rooms', roomId), {
    'currentState.answerStatus': isCorrect ? 'correct' : 'incorrect',
    [`participants.${answerData.userId}.score`]: increment(isCorrect ? 10 : 0)
  });
  
  await batch.commit();
  
  // 次の問題に進むタイマーを設定
  if (isLeader) {
    setTimeout(() => moveToNextQuestion(roomId), 5000);
  }
}, [isLeader]);

// 正誤判定ヘルパー関数（入力式の場合は表現揺れ対応）
const judgeCorrectness = (quizData, userAnswer) => {
  if (quizData.type === 'multiple_choice') {
    return userAnswer === quizData.correctAnswer;
  } else {
    // 入力式の場合、許容回答リストと照合
    const normalizedUserAnswer = normalizeAnswer(userAnswer);
    return [quizData.correctAnswer, ...quizData.acceptableAnswers]
      .map(normalizeAnswer)
      .some(answer => answer === normalizedUserAnswer);
  }
};

// 回答の正規化（小文字化、空白除去など）
const normalizeAnswer = (answer) => {
  return answer.toLowerCase().replace(/\s+/g, '');
};
```

### 8.4 ルーム終了処理
```typescript
// src/hooks/useLeader.ts
const finishRoom = useCallback(async (roomId: string) => {
  // ルームデータを取得
  const roomRef = doc(db, 'quiz_rooms', roomId);
  const roomSnap = await getDoc(roomRef);
  if (!roomSnap.exists()) return;
  
  const roomData = roomSnap.data();
  
  // 参加者の経験値を更新
  const batch = writeBatch(db);
  
  // 各参加者の処理
  Object.entries(roomData.participants).forEach(([userId, participantData]) => {
    const userRef = doc(db, 'users', userId);
    
    // 獲得経験値の計算（例）
    const expGain = participantData.score + 20; // スコア + セッション完了ボーナス
    
    batch.update(userRef, {
      exp: increment(expGain),
      'stats.totalAnswered': increment(roomData.totalQuizCount),
      // その他の統計情報更新
    });
  });
  
  // ルームステータスを完了に変更
  batch.update(roomRef, {
    status: 'completed',
    endedAt: serverTimestamp()
  });
  
  await batch.commit();
  
  // しばらく待ってからルームを削除（結果表示時間確保）
  setTimeout(async () => {
    // ルーム内の回答データを削除
    const answersRef = collection(db, 'quiz_rooms', roomId, 'answers');
    const answersSnap = await getDocs(answersRef);
    
    const deleteBatch = writeBatch(db);
    answersSnap.docs.forEach(doc => {
      deleteBatch.delete(doc.ref);
    });
    
    // ルーム自体を削除
    deleteBatch.delete(roomRef);
    
    await deleteBatch.commit();
  }, 30000); // 30秒後に削除
}, []);
```

## 9. パフォーマンスとセキュリティ考慮事項

### 9.1 Firebaseクエリ最適化
- インデックスの適切な設定
- 必要なフィールドのみの取得
- リアルタイムリスナーの適切な使用と破棄
- バッチ処理による書き込み最適化

### 9.2 キャッシング戦略
- Firebaseのオフラインキャッシュ活用
- クイズデータのローカルキャッシュ
- React Query/SWRの活用

### 9.3 セキュリティルール
```
// firestore.rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // ユーザードキュメント
    match /users/{userId} {
      allow read;
      allow create: if request.auth != null;
      allow update: if request.auth.uid == userId;
    }
    
    // クイズデータ
    match /quizzes/{quizId} {
      allow read;
      allow create: if request.auth != null;
      allow update: if request.auth.uid == resource.data.createdBy;
    }
    
    // クイズルーム
    match /quiz_rooms/{roomId} {
      allow read;
      allow create: if request.auth != null;
      allow update: if request.auth != null;
      allow delete: if request.auth.uid == resource.data.roomLeaderId;
      
      // 回答データ
      match /answers/{answerId} {
        allow read;
        allow create: if request.auth != null;
        allow update: if request.auth.uid == resource.data.userId || 
                       request.auth.uid == get(/databases/$(database)/documents/quiz_rooms/$(roomId)).data.roomLeaderId;
      }
    }
  }
}
```

### 9.4 エラーハンドリングとリカバリー
- ネットワーク切断時の動作
- リーダー離脱時の自動リーダー再選出
- 不整合データの検出と修正

## 10. 拡張性と将来的な発展

### 10.1 スケーラビリティ
- データベースシャーディング考慮
- クイズデータの動的ローディング
- リーダー負荷の分散（サブルーム制など）

### 10.2 拡張機能案
- チーム対戦モード
- トーナメント形式
- カスタムクイズ作成
- ソーシャル機能（フレンド、メッセージ）
- モバイルアプリ（PWA対応）

## 11. 開発ロードマップ

### 11.1 フェーズ1：基盤構築
- プロジェクト設定
- Firebase連携
- 認証システム
- データモデル実装

### 11.2 フェーズ2：コア機能
- クイズ表示システム
- 早押しシステム
- ルームリーダー機能
- 基本UI実装

### 11.3 フェーズ3：拡張機能
- ユーザープロフィール
- ランキングシステム
- 統計情報表示
- UI/UX改善

### 11.4 フェーズ4：最適化とデプロイ
- パフォーマンス最適化
- セキュリティ強化
- テスト実施
- 本番環境デプロイ

## 12. テスト戦略

### 12.1 単体テスト
- 認証機能
- クイズロジック
- リーダー機能

### 12.2 統合テスト
- マルチプレイヤー連携
- データベース同期
- リアルタイム機能

### 12.3 負荷テスト
- 同時接続
- データベースクエリ最適化
- レスポンス時間

