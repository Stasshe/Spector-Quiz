# Spector-Quiz データベース構造設計

## 概要

Spector-Quizは、Firebase Firestoreを使用したリアルタイムクイズアプリケーションです。階層化されたコレクション構造により、効率的なデータアクセスとリアルタイム同期を実現しています。

## コレクション構造

```
firestore/
├── users/                              # ユーザー情報
│   └── {userId}/                       # ユーザーID
│       ├── 基本プロフィール情報
│       └── (サブコレクション)
│
├── genres/                             # ジャンル情報
│   └── {genreId}/                      # ジャンルID (世界史、日本史など)
│       ├── ジャンルメタデータ
│       ├── quiz_units/                 # ユーザー作成クイズ単元
│       │   └── {unitId}/               # 単元ID
│       │       ├── 単元メタデータ
│       │       └── quizzes/            # クイズコレクション
│       │           └── {quizId}        # 個別クイズ
│       └── official_quiz_units/        # 公式クイズ単元
│           └── {unitId}/               # 公式単元ID
│               ├── 単元メタデータ
│               └── quizzes/            # 公式クイズコレクション
│                   └── {quizId}        # 個別公式クイズ
│
├── quiz_rooms/                         # クイズルーム
│   └── {roomId}/                       # ルームID
│       ├── ルームメタデータ
│       ├── participants/               # 参加者情報 (マップ形式)
│       └── (その他ルーム関連データ)
│
├── user_stats/                         # ユーザー統計情報
│   └── {userId}/                       # ユーザーID
│       └── 統計データ
│
├── rankings/                           # ランキング情報
│   ├── global/                         # グローバルランキング
│   └── genre/                          # ジャンル別ランキング
│       └── {genreId}
│
└── genreStats/                         # ジャンル統計
    └── {genreId}/                      # ジャンルID
        └── 利用統計データ
```

## 詳細なドキュメント構造

### 1. users/{userId}

```typescript
{
  uid: string;                    // Firebase Auth UID
  email: string;                  // メールアドレス
  username: string;               // ユーザー名
  avatarUrl?: string;             // アバター画像URL
  createdAt: Timestamp;           // 作成日時
  lastLoginAt: Timestamp;         // 最終ログイン日時
  totalScore: number;             // 総獲得スコア
  gamesPlayed: number;            // 参加ゲーム数
  averageScore: number;           // 平均スコア
}
```

### 2. genres/{genreId}

```typescript
{
  name: string;                   // ジャンル名 (例: "世界史", "日本史")
  description?: string;           // 説明
  createdAt: Timestamp;           // 作成日時
  isOfficial: boolean;            // 公式ジャンルかどうか
}
```

### 3. genres/{genreId}/quiz_units/{unitId} (ユーザー作成)

```typescript
{
  title: string;                  // 単元名
  description?: string;           // 説明
  createdBy: string;              // 作成者のuserID
  createdAt: Timestamp;           // 作成日時
  updatedAt: Timestamp;           // 更新日時
  isPublic: boolean;              // 公開/非公開
  tags?: string[];                // タグ
  difficulty?: number;            // 難易度 (1-5)
  quizCount: number;              // 含まれるクイズ数
}
```

### 4. genres/{genreId}/official_quiz_units/{unitId} (公式)

```typescript
{
  title: string;                  // 単元名 (例: "古代", "中世")
  description?: string;           // 説明
  period?: string;                // 時代区分
  region?: string;                // 地域
  createdAt: Timestamp;           // 作成日時
  quizCount: number;              // 含まれるクイズ数
  isActive: boolean;              // アクティブかどうか
}
```

### 5. quizzes/{quizId} (単元配下のサブコレクション)

```typescript
{
  question: string;               // 問題文
  correctAnswers: string[];       // 正解パターン配列
  explanation?: string;           // 解説
  difficulty: number;             // 難易度 (1-5)
  type: 'input' | 'multiple';     // 問題タイプ
  hints?: string[];               // ヒント
  tags?: string[];                // タグ
  createdBy?: string;             // 作成者 (ユーザー作成の場合)
  createdAt: Timestamp;           // 作成日時
  updatedAt: Timestamp;           // 更新日時
  
  // 四択問題の場合のみ
  choices?: string[];             // 選択肢
  correctChoice?: number;         // 正解の選択肢番号
}
```

### 6. quiz_rooms/{roomId}

```typescript
{
  roomId: string;                 // ルームID
  genre: string;                  // ジャンル
  unitId: string;                 // 単元ID
  classType: '公式' | 'ユーザー作成';  // クラスタイプ
  quizType?: 'official' | 'user_created'; // クイズタイプ
  
  roomLeaderId: string;           // ルームリーダーのUID
  status: 'waiting' | 'in_progress' | 'completed'; // ルーム状態
  
  participants: {                 // 参加者情報 (マップ形式)
    [userId: string]: {
      uid: string;
      username: string;
      score: number;
      isReady: boolean;
      joinedAt: Timestamp;
      lastAnswerTime?: number;
      clickTimes: number[];       // 各問題のクリック時間
      answers: string[];          // 各問題の回答
      answerStatus: AnswerStatus[]; // 各問題の回答状態
    }
  };
  
  quizIds: string[];              // 出題されるクイズのIDリスト
  currentQuizIndex: number;       // 現在の問題番号
  
  maxParticipants: number;        // 最大参加者数
  createdAt: Timestamp;           // 作成日時
  updatedAt: Timestamp;           // 更新日時
  startedAt?: Timestamp;          // 開始日時
  completedAt?: Timestamp;        // 完了日時
  
  // クイズ進行状態
  state?: {
    phase: 'waiting_for_answers' | 'showing_results' | 'completed';
    timeRemaining?: number;
    fastestAnswerer?: string;
    correctAnswer?: string;
    explanation?: string;
  };
}
```

### 7. user_stats/{userId}

```typescript
{
  totalGamesPlayed: number;       // 総ゲーム数
  totalScore: number;             // 総獲得スコア
  averageScore: number;           // 平均スコア
  bestScore: number;              // 最高スコア
  totalCorrectAnswers: number;    // 総正答数
  totalQuestions: number;         // 総問題数
  correctRate: number;            // 正答率
  
  genreStats: {                   // ジャンル別統計
    [genreId: string]: {
      gamesPlayed: number;
      totalScore: number;
      averageScore: number;
      correctAnswers: number;
      totalQuestions: number;
      correctRate: number;
    }
  };
  
  rank: string;                   // 現在のランク
  experiencePoints: number;       // 経験値
  level: number;                  // レベル
  
  lastUpdated: Timestamp;         // 最終更新日時
}
```

### 8. rankings/global

```typescript
{
  rankings: Array<{
    userId: string;
    username: string;
    totalScore: number;
    gamesPlayed: number;
    averageScore: number;
    rank: number;
  }>;
  lastUpdated: Timestamp;
}
```

### 9. rankings/genre/{genreId}

```typescript
{
  genreId: string;
  rankings: Array<{
    userId: string;
    username: string;
    genreScore: number;
    genreGamesPlayed: number;
    genreAverageScore: number;
    rank: number;
  }>;
  lastUpdated: Timestamp;
}
```

### 10. genreStats/{genreId}

```typescript
{
  useCount: number;               // 利用回数
  units: {                        // 単元別統計
    [unitId: string]: {
      useCount: number;
    }
  };
  lastUpdated: Timestamp;
}
```

## データアクセスパターン

### 1. クイズ取得
```typescript
// 公式クイズの場合
const quizRef = doc(db, 'genres', genreId, 'official_quiz_units', unitId, 'quizzes', quizId);

// ユーザー作成クイズの場合  
const quizRef = doc(db, 'genres', genreId, 'quiz_units', unitId, 'quizzes', quizId);
```

### 2. 単元内の全クイズ取得
```typescript
// 公式クイズの場合
const quizzesRef = collection(db, 'genres', genreId, 'official_quiz_units', unitId, 'quizzes');

// ユーザー作成クイズの場合
const quizzesRef = collection(db, 'genres', genreId, 'quiz_units', unitId, 'quizzes');
```

### 3. ルーム情報のリアルタイム監視
```typescript
const roomRef = doc(db, 'quiz_rooms', roomId);
const unsubscribe = onSnapshot(roomRef, (doc) => {
  // ルーム状態の変更を処理
});
```

## セキュリティルール

### 基本原則
1. **認証必須**: 全てのデータアクセスに認証が必要
2. **読み取り制限**: ユーザーは参加しているルームのみアクセス可能
3. **書き込み制限**: ユーザーは自分の情報のみ変更可能
4. **公式データ保護**: 公式クイズデータは読み取り専用

### ルール例
./firebase.rulesを参照

## パフォーマンス最適化

### 1. インデックス設定
- ルーム検索用の複合インデックス
- ランキング表示用のソートインデックス
- ジャンル別統計用のインデックス

### 2. データ分割戦略
- ジャンル・単元・クイズの3層構造による効率的なアクセス
- 公式クイズとユーザー作成クイズの分離
- 参加者情報のマップ形式格納

### 3. リアルタイム同期最適化
- 必要最小限のフィールドのみ監視
- 不要なリスナーの適切な解除
- バッチ処理による一括更新
