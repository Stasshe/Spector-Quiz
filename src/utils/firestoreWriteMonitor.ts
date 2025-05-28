// Firestore書き込み操作の監視とログ機能
// 最適化効果の測定に使用

interface WriteOperation {
  timestamp: number;
  operation: 'updateDoc' | 'setDoc' | 'addDoc' | 'deleteDoc' | 'batch';
  path: string;
  context: string;
  batchSize?: number;
}

class FirestoreWriteMonitor {
  private operations: WriteOperation[] = [];
  private isEnabled = false;

  // 監視を開始
  startMonitoring() {
    this.isEnabled = true;
    this.operations = [];
    console.log('[WriteMonitor] Firestore書き込み監視を開始しました');
  }

  // 監視を停止
  stopMonitoring() {
    this.isEnabled = false;
    console.log('[WriteMonitor] Firestore書き込み監視を停止しました');
  }

  // 書き込み操作をログ
  logOperation(
    operation: WriteOperation['operation'],
    path: string,
    context: string,
    batchSize?: number
  ) {
    if (!this.isEnabled) return;

    const op: WriteOperation = {
      timestamp: Date.now(),
      operation,
      path,
      context,
      batchSize
    };

    this.operations.push(op);
    
    console.log(`[WriteMonitor] ${operation}: ${path} (${context})${
      batchSize ? ` - バッチサイズ: ${batchSize}` : ''
    }`);
  }

  // 統計情報を取得
  getStats(timeRangeMs?: number) {
    const now = Date.now();
    const ops = timeRangeMs 
      ? this.operations.filter(op => now - op.timestamp <= timeRangeMs)
      : this.operations;

    const stats = {
      totalOperations: ops.length,
      operationTypes: {} as Record<string, number>,
      contexts: {} as Record<string, number>,
      totalBatchOperations: 0,
      averageBatchSize: 0,
      timeRange: timeRangeMs ? `${timeRangeMs / 1000}秒` : '全期間'
    };

    ops.forEach(op => {
      stats.operationTypes[op.operation] = (stats.operationTypes[op.operation] || 0) + 1;
      stats.contexts[op.context] = (stats.contexts[op.context] || 0) + 1;
      
      if (op.operation === 'batch' && op.batchSize) {
        stats.totalBatchOperations += op.batchSize;
      }
    });

    const batchOps = ops.filter(op => op.operation === 'batch' && op.batchSize);
    if (batchOps.length > 0) {
      stats.averageBatchSize = stats.totalBatchOperations / batchOps.length;
    }

    return stats;
  }

  // レポート出力
  generateReport(timeRangeMs?: number) {
    const stats = this.getStats(timeRangeMs);
    
    console.log('=== Firestore書き込み統計レポート ===');
    console.log(`期間: ${stats.timeRange}`);
    console.log(`総書き込み操作数: ${stats.totalOperations}`);
    console.log('\n操作タイプ別:');
    Object.entries(stats.operationTypes).forEach(([type, count]) => {
      console.log(`  ${type}: ${count}回`);
    });
    console.log('\nコンテキスト別:');
    Object.entries(stats.contexts).forEach(([context, count]) => {
      console.log(`  ${context}: ${count}回`);
    });
    
    if (stats.totalBatchOperations > 0) {
      console.log(`\nバッチ処理: ${stats.totalBatchOperations}操作 (平均${stats.averageBatchSize.toFixed(1)}操作/バッチ)`);
    }
    
    return stats;
  }

  // 操作履歴をエクスポート
  exportOperations() {
    return [...this.operations];
  }

  // クリア
  clear() {
    this.operations = [];
  }
}

// グローバルインスタンス
export const writeMonitor = new FirestoreWriteMonitor();

// 開発環境でのみ自動有効化
if (process.env.NODE_ENV === 'development') {
  writeMonitor.startMonitoring();
  console.log('[WriteMonitor] 開発環境で自動的に監視を開始しました');
}

// 使用例:
// writeMonitor.startMonitoring();
// ... アプリケーションの操作 ...
// const stats = writeMonitor.generateReport(60000); // 直近1分間の統計
// writeMonitor.stopMonitoring();

export default writeMonitor;
