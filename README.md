# 🧠 Spector-Quiz 🎮

<div align="center">
  <img src="public/file.svg" alt="Spector-Quiz Logo" width="150" />
  <p><em>リアルタイムマルチプレイヤークイズで知識を競い合おう</em></p>
</div>

## 📚 Spector-Quizとは？

Spector-Quizは、リアルタイムマルチプレイヤー対応のオンラインクイズアプリケーションです。友達や世界中のプレイヤーと一緒に、早押しクイズや記述式クイズを楽しむことができます。公式の世界史・日本史クイズから、ユーザーが作成したオリジナルクイズまで、幅広いジャンルのクイズでスキルを競い合えます。

### ✨ 主な特徴

- **リアルタイム対戦**: 友達や世界中のプレイヤーとリアルタイムでクイズバトル
- **早押しシステム**: テレビの早押しクイズさながらの緊張感あるゲームプレイ
- **記述式回答**: 自由記述による回答で深い知識を競う
- **公式クイズ**: 世界史・日本史の体系的な学習コンテンツ
- **ユーザー作成クイズ**: 簡単な操作で自分だけのクイズを作成・共有
- **ルームリーダーシステム**: 分散型アーキテクチャによる安定した進行
- **リアルタイム統計**: ゲーム結果の即座な反映と詳細な分析

## 🚀 はじめ方

### ✅ 前提条件

- Node.js 18.0.0以上
- npm, yarn, pnpm または bun
- Firebase アカウント（Firestore・Authentication設定済み）

### 🔧 インストールと起動

1. リポジトリをクローン:

```bash
git clone https://github.com/yourusername/Spector-Quiz.git
cd Spector-Quiz
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
- プロフィールでユーザー名を設定

### 🏛️ 公式クイズに参加
- 「クイズルーム」から世界史・日本史の公式クイズを選択
- 古代・中世・近世・近代・現代の時代別クイズで学習
- 早押しで回答権を獲得し、記述式で回答

### 🎲 ユーザー作成クイズに参加
- カスタムジャンルのクイズルームに参加
- 他のユーザーが作成したオリジナル問題に挑戦
- 多様なトピックで知識を広げる

### 📝 オリジナルクイズを作成
- 「クイズ作成」ページから新しいクイズを作成
- 問題とその答えを設定し、ジャンル・単元を選択
- 複数の正解パターンを登録可能（表記揺れに対応）
- 作成したクイズを他のユーザーと共有

### 🏆 統計とランキング
- 「ランキング」ページで全体およびジャンル別のランキングを確認
- 個人統計でジャンル別の得意・不得意を分析
- 経験値とスコアに応じたランク（レベル）システム

## 🧩 システム構成

### 🖥️ フロントエンド
- **Next.js 14** (App Router) - Reactベースのフルスタックフレームワーク
- **TypeScript** - 型安全な開発
- **Tailwind CSS** - ユーティリティファーストなCSSフレームワーク
- **React Context API** - 状態管理

### ⚡ バックエンド
- **Firebase Firestore** - NoSQLリアルタイムデータベース
- **Firebase Authentication** - ユーザー認証システム
- **Vercel** - 本番環境ホスティング

### 🏗️ アーキテクチャ
- **ルームリーダーモデル** - 分散型ゲーム進行システム
- **階層化データベース** - ジャンル > 単元 > クイズの効率的な構造
- **リアルタイム同期** - Firestoreによる即座のデータ更新

## 📊 主要機能

### 🎯 クイズシステム
- **早押し機能**: ミリ秒単位での正確な早押し判定
- **記述式回答**: 自由入力による詳細な知識確認
- **複数正解対応**: 表記揺れや同義語への対応
- **リアルタイム結果**: 瞬時の正誤判定と解説表示

### 🏛️ 公式コンテンツ
- **世界史**: 古代から現代までの体系的な学習コンテンツ
- **日本史**: 縄文時代から令和まで の時代別問題
- **YAML形式**: 構造化されたデータ管理

### 👥 マルチプレイヤー
- **ルーム制**: 最大複数人での同時対戦
- **リーダーシステム**: 自動選出と引き継ぎ機能
- **リアルタイム更新**: 参加者状況の即座な反映

### 📈 統計・ランキング
- **個人統計**: 正答率、平均スコア、ジャンル別分析
- **グローバルランキング**: 全ユーザー対象のスコアランキング
- **経験値システム**: ゲーム参加による成長要素

## 🛠️ 開発情報

### 📁 プロジェクト構造
```
src/
├── app/                    # Next.js App Router
│   ├── auth/              # 認証関連ページ
│   ├── quiz/              # クイズ関連ページ
│   ├── profile/           # プロフィール
│   └── ranking/           # ランキング
├── components/            # Reactコンポーネント
│   ├── layout/           # レイアウトコンポーネント
│   └── quiz/             # クイズ関連コンポーネント
├── hooks/                # カスタムHooks
├── services/             # ビジネスロジック
├── types/                # TypeScript型定義
└── config/               # 設定ファイル
```

### 🔧 主要な技術的特徴
- **型安全性**: TypeScriptによる厳密な型チェック
- **リアルタイム性**: Firestoreリスナーによる即座の状態同期
- **レスポンシブ**: モバイル・デスクトップ両対応
- **SEO最適化**: Next.jsによるSSR/SSG対応

### 🔄 ゲームフロー
1. ユーザーがクイズルームに参加
2. ルームリーダー（最初の参加者）がクイズを開始
3. 各ユーザーの早押しタイミングをFirestoreに記録
4. 最速ユーザーに解答権を付与
5. 記述式回答の正誤判定と結果表示
6. 全問題完了後の統計更新とルーム自動削除

## 🚀 デプロイメント

### Vercelでのデプロイ
1. Vercelアカウントでリポジトリを連携
2. 環境変数にFirebase設定を追加
3. 自動デプロイメントパイプラインが構築される

### Firebase設定
1. Firestore セキュリティルールの設定
2. Authentication プロバイダーの有効化
3. インデックスの作成（必要に応じて）

## 🤝 コントリビューション

バグ報告や機能提案は、GitHubのIssuesまでお気軽にどうぞ！

### 開発に参加したい方へ
1. このリポジトリをフォーク
2. 機能ブランチを作成 (`git checkout -b feature/AmazingFeature`)
3. 変更をコミット (`git commit -m 'Add some AmazingFeature'`)
4. ブランチにプッシュ (`git push origin feature/AmazingFeature`)
5. プルリクエストを作成

## 📜 ライセンス

このプロジェクトはMITライセンスの下で公開されています。詳細は[LICENSE](LICENSE)ファイルをご覧ください。

## 📞 サポート

- **GitHub Issues**: バグ報告・機能リクエスト
- **Discussions**: 質問・アイデア共有

## 🚀 リリース管理

このプロジェクトでは、GitHub Actionsを使用した自動リリースシステムを採用しています。

### リリースの作成方法

1. **package.jsonのバージョンを更新**:
   ```bash
   # 手動でpackage.jsonのversionを編集
   # 例: "version": "1.1.0" → "version": "1.2.0"
   ```

2. **変更をコミット・プッシュ**:
   ```bash
   git add package.json
   git commit -m "chore: bump version to v1.2.0"
   git push origin main
   ```

3. **GitHub Actionsからリリース**:
   - GitHubリポジトリページの「Actions」タブを開く
   - 左サイドバーから「Create Release」ワークフローを選択
   - 右上の「Run workflow」ボタンをクリック
   - 「Run workflow」を実行

4. **自動実行される処理**:
   - `package.json`のバージョンから`v1.2.0`形式のGitタグが作成
   - GitHubリリースページが自動生成
   - **前回のリリースから現在までのコミットメッセージが自動でリリースノートに追加**
   - リリース日とインストール方法などの情報も自動追加

### ローカルでのリリース確認

```bash
# リリース案内メッセージを表示
npm run release
```

**注意**: 
- 同じバージョンのリリースが既に存在する場合、ワークフローは失敗します
- 実際のリリース作成はGitHub Actionsから行ってください

---

<div align="center">
  <p>🧠 <strong>知識で競い合い、共に成長しよう！</strong> 🎮</p>
  <p><em>Made with ❤️ by the Spector-Quiz Team</em></p>
</div>
