待機ルーム自動解散機能の実装

1. セキュリティルールの修正
   - 古いルーム(8分以上経過)は誰でも削除できるように権限を追加
   ```
   allow delete: if 
     // ルームリーダーは常に削除可能
     request.auth.uid == resource.data.roomLeaderId ||
     // 8分(480秒)以上経過した待機中ルームは誰でも削除可能
     (resource.data.status == 'waiting' && 
      resource.data.startedAt != null && 
      request.time.toMillis() - resource.data.startedAt.toMillis() >= 480000);
   ```

2. 自動解散機能の実装
   - 8分のタイムアウト制限を設定 (AUTO_DISBAND_TIME_MS = 8 * 60 * 1000)
   - 待機ルームのUI上に経過時間のカウンターを表示
   - 8分に近づくと警告表示
   - 権限エラー対策：
     * 削除権限がない場合は代替手段を実行
     * リーダーの場合はルームを「completed」状態に更新
     * 非リーダーの場合はUI上でのみクリア

3. 複数システムによる冗長化
   - WaitingRoomFloating.tsx：ユーザーがルームに参加中の場合のみ自動解散
   - useQuizRoom.ts：定期的に全待機ルームをスキャン（バックグラウンド処理）
   - 一方が失敗しても他方が動作する設計

4. エラーハンドリング
   - 既に削除されたルームに対する操作防止
   - Firebase権限エラーをキャッチして代替処理
   - すべてのエラーに対して詳細なログ出力

実装済み機能:
- 複数デバイスからの自動解散
- 参加者・リーダー両方からの解散可能
- 警告カウントダウン表示
- 解散後の通知メッセージ
