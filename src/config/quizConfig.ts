/**
 * クイズアプリ全体で使用される設定値
 */

// タイミング関連の設定（ミリ秒）
export const TIMING = {
  // 正解後、次の問題に進むまでの待機時間
  NEXT_QUESTION_DELAY: 4000,
  
  // 統計更新後のリダイレクト待機時間
  STATS_REDIRECT_DELAY: 5000,
  
  // クイズルーム削除までの待機時間
  ROOM_DELETION_DELAY: 10000,
  
  // statsUpdatedフラグが設定されない場合のバックアップリダイレクト時間
  BACKUP_REDIRECT_DELAY: 8000,
  
  // 問題の制限時間
  QUESTION_TIMEOUT: 30000
};

// スコア関連の設定
export const SCORING = {
  // 正解時の得点
  CORRECT_ANSWER_SCORE: 10,
  
  // クイズ完了時のボーナス
  SESSION_COMPLETION_BONUS: 20
};

// その他の設定
export const SETTINGS = {
  // 一人プレイの場合の経験値倍率
  SOLO_MULTIPLIER: 0.1,
  
  // リトライ間隔の初期値（ミリ秒）
  INITIAL_RETRY_INTERVAL: 1000,
  
  // 最大リトライ回数
  MAX_RETRY_COUNT: 3
};
