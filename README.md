# 🧠 Zap!-Quiz 🎮

<div align="center">
  <img src="public/file.svg" alt="Zap!-Quiz Logo" width="150" />
  <p><em>知識の探求者たちが集う、次世代のインタラクティブクイズプラットフォーム</em></p>
</div>

## 📚 Zap!-Quizとは？

Zap!-Quizは、教育とエンターテインメントの融合を目指した革新的なオンラインクイズプラットフォームです。友達や同僚と一緒にリアルタイムでクイズを楽しんだり、自分だけのオリジナルクイズを作成して共有したりすることができます。早押しクイズ形式で知識を競い合い、個人の成長をサポートする統計機能も備えています。

### ✨ 主な特徴

- **リアルタイム対戦**: 友達や世界中のプレイヤーとリアルタイムでクイズバトル
- **早押しシステム**: テレビの早押しクイズさながらの緊張感あるゲームプレイ
- **オリジナルクイズ作成**: 簡単な操作で自分だけのクイズを作成
- **豊富なジャンル**: 科学、歴史、芸術、ポップカルチャーなど様々なジャンルから選択可能
- **グローバルランキング**: 全世界のプレイヤーとスコアを競い合うことが可能
- **ユーザープロフィール**: 自分の成績や作成したクイズを管理
- **ジャンル別統計**: ジャンルごとの得意・不得意がわかる詳細な統計機能

## 🚀 はじめ方

### ✅ 前提条件

- Node.js 18.0.0以上
- npm, yarn, pnpm または bun
- Firebase アカウント（バックエンド連携用）

### 🔧 インストールと起動

1. リポジトリをクローン:

```bash
git clone https://github.com/yourusername/Zap!-Quiz.git
cd Zap!-Quiz
```

2. 依存関係をインストール:

```bash
npm install
# または
yarn
# または
pnpm install
# または
bun install
```

3. 環境変数の設定:
`.env.local`ファイルを作成し、Firebase認証情報を設定:

```
NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-auth-domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-storage-bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-messaging-sender-id
NEXT_PUBLIC_FIREBASE_APP_ID=your-app-id
```

4. 開発サーバーを起動:

```bash
npm run dev
# または
yarn dev
# または
pnpm dev
# または
bun dev
```

5. [http://localhost:3000](http://localhost:3000)をブラウザで開いてアプリを確認

## 🎮 使い方

### 👤 アカウント作成
- トップページの「登録」ボタンからアカウントを作成
- メールアドレスとパスワードでログイン
- プロフィールでユーザー名とアイコンを設定

### 🎲 クイズに参加
- 「クイズルーム」からオープンルームに参加
- または友達から共有されたルームコードを入力して参加
- 早押しボタンを押して解答権を獲得し、問題に回答
- 全問題終了後は自動的に統計が更新され、30秒後にルームは自動削除

### 📝 クイズを作成
- 「クイズ作成」ページから新しいクイズを作成
- 問題とその答えを設定し、ジャンルを選択
- 複数の正解パターンを登録可能（表記揺れに対応）
- 作成したクイズを友達と共有

### 🏆 ランキングを確認
- 「ランキング」ページで全体およびジャンル別のランキングを確認
- 自分の順位と獲得ポイントを確認
- 経験値に応じたランク（ビギナー、アマチュア、エキスパートなど）を獲得

## 🧩 システム構成

Zap!-Quizは以下の技術スタックで構築されています：

- **フロントエンド**: 
  - [Next.js 15](https://nextjs.org): Reactフレームワーク
  - TypeScript: 型安全なJavaScript
  - TailwindCSS: ユーティリティファーストCSSフレームワーク
  - Framer Motion: アニメーション
  - Zustand: 状態管理

- **バックエンド**: 
  - Firebase Authentication: ユーザー認証
  - Firestore: NoSQLデータベース（ルーム・クイズ・ユーザー情報管理）
  - Firebase Functions: サーバーレス関数（重要な処理の実行）

- **アーキテクチャ**:
  - カスタムHooksによるロジック分離
  - リアルタイムリスナーによるリアルタイム更新
  - ルームリーダーシステムによる分散処理
  - 完了したルームの自動クリーンアップ

### 🔄 データフロー

1. ユーザーがクイズルームに参加
2. ルームリーダー（最初に参加したユーザー）がクイズを開始
3. 各ユーザーの早押しタイミングをFirestoreに記録
4. ルームリーダーが最速のユーザーに解答権を付与
5. 解答権を持つユーザーが回答を送信
6. ルームリーダーが正誤判定を行い、結果を全員に反映
7. 全問題完了後、統計データを更新し、30秒後にルームを自動削除

## 🛠 開発者向け情報

### プロジェクト構造

```
Zap!-Quiz/
├── public/          # 静的ファイル
├── src/             # ソースコード
│   ├── app/         # Next.js Appルーター
│   ├── components/  # UIコンポーネント
│   ├── config/      # 設定ファイル
│   ├── constants/   # 定数
│   ├── context/     # Reactコンテキスト
│   ├── hooks/       # カスタムReactフック
│   ├── types/       # TypeScript型定義
│   └── utils/       # ユーティリティ関数
└── README.md        # プロジェクト概要
```

### 主要コンポーネント

- **useQuizRoom**: クイズルームの管理（作成・参加・退出）
- **useLeader**: ルームリーダー用機能（クイズ進行・解答権管理）
- **useQuiz**: クイズデータの取得と状態管理
- **QuizRoomPage**: クイズルームのUI

### 最近の修正

- **NaNエラー修正**: ジャンル統計処理でNaNが表示される問題を修正。nullチェックを強化し、安全に統計を更新するようになりました。
- **ルーム削除機能改善**: 完了したクイズルームが30秒後に自動的に削除される機能を実装。手動削除ボタンを廃止し、ユーザー体験を向上させました。
- **エラーハンドリング強化**: 予期せぬエラーが発生した場合でも、適切なフォールバックメカニズムを実装して安定性を向上させました。

## 🤝 貢献方法

1. このリポジトリをフォーク
2. 新しいブランチを作成 (`git checkout -b feature/amazing-feature`)
3. 変更をコミット (`git commit -m 'Add some amazing feature'`)
4. ブランチにプッシュ (`git push origin feature/amazing-feature`)
5. Pull Requestを作成

### バグ報告

バグを発見した場合は、以下の情報を含めてIssueを作成してください：

- バグの詳細な説明
- 再現手順
- 期待される動作
- スクリーンショット（可能であれば）
- 環境情報（ブラウザ、OS等）

## 📄 ライセンス

このプロジェクトはMITライセンスの下で公開されています。詳細は[LICENSE](LICENSE)ファイルを参照してください。

## 👏 謝辞

- すべての貢献者と参加者に感謝します
- このプロジェクトは[Next.js](https://nextjs.org)と[Firebase](https://firebase.google.com)の素晴らしい機能によって支えられています
- オープンソースコミュニティからのインスピレーションに感謝します

---

<div align="center">
  <p>🧠 知識は共有することで倍増する 🧠</p>
  <p>Zap!-Quiz - 2025</p>
</div>
