# Spector-Quiz データベース構造設計

## 現状の課題

現在のデータベース構造には以下の課題があります：

1. **クイズの散在**: クイズが`quizzes`コレクションに雑然と格納されており、関連クイズをまとめて効率的に取得するのが難しい
2. **過剰なクエリ**: 単元やルームに関連するクイズを取得するために複数のクエリが必要
3. **構造的な関連性の欠如**: クイズ、単元、ルーム間の関係が明確に構造化されていない
4. **無駄なデータ重複**: 同じデータが複数の場所に格納される可能性がある

## 新しいデータベース構造 (単元ベース)

シンプルな階層構造を導入することで、より整理された効率的なデータベース設計を実現します。

## コレクション構造

```
firestore/
├── users/                             # ユーザー情報
│   └── {userId}/                      # ユーザーID
│       ├── プロフィール情報
│       └── user_stats/                # 統計情報のサブコレクション
│           └── stats                  # 統計情報ドキュメント
│
├── genres/                            # ジャンル情報
│   └── {genreId}/                     # ジャンルID
│       ├── ジャンルのメタデータ
│       └── quiz_units/                # クイズ単元のサブコレクション
│           └── {unitId}/              # 単元ID
│               ├── 単元のメタデータ
│               └── quizzes/           # クイズのサブコレクション
│                   └── {quizId}       # クイズID
│
└── quiz_rooms/                        # クイズルーム
    └── {roomId}/                      # ルームID
        ├── ルームのメタデータ（単元IDを含む）
        ├── participants/              # 参加者情報
        │   └── {userId}               # 参加者ごとの情報
        └── answers/                   # 回答データ
            └── {answerId}             # 個々の回答
```

## 各コレクションのドキュメント構造

### ユーザー (`users/{userId}`)

```javascript
{
  userId: string,           // ユーザーID
  username: string,         // ユーザー名
  iconId: number,           // アイコンID
  exp: number,              // 経験値
  rank: string,             // ランク
  createdAt: timestamp,     // 作成日時
  lastLoginAt: timestamp,   // 最終ログイン日時
  isOnline: boolean,        // オンラインステータス
  currentRoomId: string | null  // 現在参加中のルームID
}
```

### ユーザー統計 (`users/{userId}/user_stats/stats`)

```javascript
{
  totalAnswered: number,    // 総回答数
  correctAnswers: number,   // 正解数
  genres: {                 // ジャンルごとの統計
    [genreId]: {
      totalAnswered: number,// そのジャンルでの総回答数
      correctAnswers: number// そのジャンルでの正解数
    }
  }
}
```

### ジャンル (`genres/{genreId}`)

```javascript
{
  name: string,             // ジャンル名
  description: string,      // 説明
  iconPath: string,         // アイコンのパス（オプション）
  sortOrder: number,        // 表示順序
  isUserCreated: boolean    // ユーザー作成かどうか
}
```

### クイズ単元 (`genres/{genreId}/quiz_units/{unitId}`)

```javascript
{
  title: string,            // 単元タイトル
  description: string,      // 説明
  createdBy: string,        // 作成者のユーザーID
  createdAt: timestamp,     // 作成日時
  useCount: number,         // 使用回数
  isPublic: boolean,        // 公開状態
  quizCount: number,        // クイズの数（クエリ削減のため）
  averageDifficulty: number // 平均難易度（クエリ削減のため）
}
```

### クイズ (`genres/{genreId}/quiz_units/{unitId}/quizzes/{quizId}`)

```javascript
{
  title: string,              // クイズタイトル
  question: string,           // 問題文
  type: string,               // 問題タイプ ('multiple_choice' または 'input')
  choices: string[],          // 選択肢（配列、選択式の場合）
  correctAnswer: string,      // 正解
  acceptableAnswers: string[], // 許容される回答（配列、入力式の場合）
  explanation: string,        // 解説
  difficulty: number,         // 難易度 (1-5)
  createdBy: string,          // 作成者のユーザーID
  createdAt: timestamp,       // 作成日時
  useCount: number,           // 使用回数
  correctCount: number        // 正解回数
}
```

### クイズルーム (`quiz_rooms/{roomId}`)

```javascript
{
  name: string,               // ルーム名
  genre: string,              // ジャンルID
  unitId: string,             // クイズ単元ID
  classType: string,          // クラスタイプ ('ユーザー作成' または '公式')
  roomLeaderId: string,       // ルームリーダーのユーザーID
  currentQuizIndex: number,   // 現在のクイズインデックス
  quizIds: string[],          // クイズIDの配列
  totalQuizCount: number,     // クイズの総数
  startedAt: timestamp,       // 開始日時
  updatedAt: timestamp,       // 更新日時
  status: string,             // ステータス ('waiting', 'in_progress', 'completed')
  currentState: {             // 現在の状態
    quizId: string,           // 現在のクイズID
    startTime: timestamp,     // 開始時間
    endTime: timestamp | null,// 終了時間（ある場合）
    currentAnswerer: string | null, // 現在の回答者ID（ある場合）
    answerStatus: string,     // 回答ステータス
    isRevealed: boolean       // 解答が公開されているか
  }
}
```

### 参加者 (`quiz_rooms/{roomId}/participants/{userId}`)

```javascript
{
  username: string,           // ユーザー名
  iconId: number,             // アイコンID
  score: number,              // スコア
  isReady: boolean,           // 準備完了状態
  isOnline: boolean,          // オンラインステータス
  joinedAt: timestamp         // 参加日時
}
```

### 回答 (`quiz_rooms/{roomId}/answers/{answerId}`)

```javascript
{
  userId: string,             // 回答したユーザーID
  quizId: string,             // クイズID
  clickTime: timestamp,       // ボタンを押した時間
  answerTime: number,         // 回答までの時間（ミリ秒）
  answer: string,             // 回答内容
  isCorrect: boolean,         // 正解かどうか
  processingStatus: string    // 処理状態 ('pending' または 'processed')
}
```

#### 公開クイズ (`public_quizzes/{quizId}`)

```javascript
{
  title: string,
  question: string,
  type: 'multiple_choice' | 'input',
  difficulty: number,
  genre: string,
  createdBy: string,
  createdAt: timestamp,
  useCount: number,
  correctCount: number,
  unitId: string,           // 元の単元へのリファレンス
  originalQuizId: string    // 単元内での元のクイズID
}
```

## リレーションシップとクエリパターン

### 主要なリレーションシップ

1. ユーザー -> クイズ単元: ユーザーは複数のクイズ単元を作成できる
2. ジャンル -> クイズ単元: ジャンルは複数のクイズ単元を持つ
3. クイズ単元 -> クイズ: クイズ単元は複数のクイズを持つ
4. ユーザー -> ルーム: ユーザーはルームを作成/参加できる
5. ルーム -> クイズ単元: ルームは1つのクイズ単元に関連付けられる

### 主要なクエリパターン

1. **ジャンルに基づくクイズ単元の取得**:
   ```javascript
   const unitsRef = collection(db, 'genres', genreId, 'quiz_units');
   const unitsSnapshot = await getDocs(unitsRef);
   ```

2. **特定の単元のクイズを全て取得**:
   ```javascript
   const quizzesRef = collection(db, 'genres', genreId, 'quiz_units', unitId, 'quizzes');
   const quizzesSnapshot = await getDocs(quizzesRef);
   ```

3. **ユーザーが作成した単元を取得**:
   ```javascript
   const unitsRef = collection(db, 'genres', genreId, 'quiz_units');
   const q = query(unitsRef, where('createdBy', '==', userId));
   const snapshot = await getDocs(q);
   ```

4. **公開されている単元を取得**:
   ```javascript
   const unitsRef = collection(db, 'genres', genreId, 'quiz_units');
   const q = query(unitsRef, where('isPublic', '==', true));
   const snapshot = await getDocs(q);
   ```

## 構造変更のメリット

1. **シンプルな階層構造**
   - より直感的なデータ構造により、コードの可読性と保守性が向上
   - 階層が1レベル減少し、パスが短くなることでクエリが簡素化

2. **クエリの最適化**
   - 単元に関連するすべてのクイズを1回のクエリで取得可能
   - ルームの参加者や回答も専用のサブコレクションから効率的に取得可能

3. **柔軟性と拡張性**
   - 単元やルームに新しい要素を追加しても、既存の構造を乱さない
   - 公開クイズコレクションにより、人気のクイズを効率的に検索・再利用可能

4. **セキュリティルールの簡素化**
   - 階層構造の簡素化により、セキュリティルールの設定がより直感的に

## セキュリティルール例

```
service cloud.firestore {
  match /databases/{database}/documents {
    // ユーザードキュメント
    match /users/{userId} {
      allow read;
      allow create: if request.auth != null;
      allow update: if request.auth.uid == userId;
      
      // ユーザー統計情報
      match /user_stats/{document=**} {
        allow read;
        allow write: if request.auth.uid == userId;
      }
    }
    
    // ジャンル情報
    match /genres/{genreId} {
      allow read;
      allow write: if request.auth != null && (
                     request.auth.token.admin == true || 
                     resource.data.isUserCreated == true && request.auth.uid == resource.data.createdBy
                   );
      
      // クイズ単元
      match /quiz_units/{unitId} {
        allow read;
        allow create: if request.auth != null;
        allow update, delete: if request.auth.uid == resource.data.createdBy;
        
        // 単元内のクイズ
        match /quizzes/{quizId} {
          allow read;
          allow write: if request.auth.uid == get(/databases/$(database)/documents/genres/$(genreId)/quiz_units/$(unitId)).data.createdBy;
        }
      }
    }
    
    // クイズルーム
    match /quiz_rooms/{roomId} {
      allow read;
      allow create: if request.auth != null;
      allow update: if request.auth != null;
      allow delete: if request.auth.uid == resource.data.roomLeaderId;
      
      // 参加者
      match /participants/{userId} {
        allow read;
        allow create, update: if request.auth.uid == userId || 
                             request.auth.uid == get(/databases/$(database)/documents/quiz_rooms/$(roomId)).data.roomLeaderId;
        allow delete: if request.auth.uid == userId || 
                     request.auth.uid == get(/databases/$(database)/documents/quiz_rooms/$(roomId)).data.roomLeaderId;
      }
      
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

## 移行計画
開発中により一切必要なし

## API使用量の削減

この新しい構造により、以下の点でFirestore APIの使用量を削減できます：

1. 単元関連のクイズを取得する際、複数のクエリではなく1つのクエリで済む
2. ルーム内の参加者情報や回答データを効率的に取得できる
3. 必要なデータのみを選択的に取得することが容易になる
4. 適切なインデックスを設定することで、クエリのパフォーマンスが向上

## パフォーマンス向上のためのインデックス例

```
// 単元の検索用インデックス
collection: genres/{genreId}/quiz_units
fields:
  - isPublic: ASC
  - useCount: DESC

// 人気の公開クイズ検索用インデックス
collection: public_quizzes
fields:
  - genre: ASC
  - useCount: DESC

// ルーム検索用インデックス
collection: quiz_rooms
fields:
  - status: ASC
  - genre: ASC
  - updatedAt: DESC
```

## 課題と対策

この新しいデータベース構造はより直感的でシンプルなため、複雑なクエリが少なくなります。サブジャンルが不要になったことにより、データの取得速度と一貫性が向上します。

このデータベース構造を採用することで、アプリケーションのパフォーマンスが向上し、Firestore APIの使用量が削減され、より保守性の高いシステムになります。
