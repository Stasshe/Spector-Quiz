/**
 * クイズアプリ全体で使用される設定値
 */

// タイミング関連の設定（ミリ秒）
export const TIMING = {
  AUTO_DISBAND_TIME_MS: 8 * 60 * 1000, // ルーム自動解散時間（8分）
  


  // 正解後、次の問題に進むまでの待機時間
  NEXT_QUESTION_DELAY: 4000,
  
  // 問題の制限時間（デフォルト）
  QUESTION_TIMEOUT: 30000,
  // ジャンル別制限時間（ミリ秒）
  GENRE_TIMEOUTS: {
    '日本史': 15000,    // 15秒
    '世界史': 15000,    // 15秒
    '数学': 60000,      // 60秒
    '物理': 45000,      // 45秒
    '化学': 45000,      // 45秒
    '生物': 45000,      // 45秒
    '地理': 30000,      // 30秒
    '現代社会': 30000,  // 30秒
    '政治・経済': 30000, // 30秒
    '倫理': 30000,      // 30秒
    '国語': 30000,      // 30秒
    '英語': 30000       // 30秒
  } as const
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
  //SOLO_MULTIPLIER: 0.1,
  
};



/**
 * ジャンルに応じた制限時間を取得
 * @param genre ジャンル名
 * @returns 制限時間（ミリ秒）
 */
export function getQuestionTimeout(genre: string): number {
  return TIMING.GENRE_TIMEOUTS[genre as keyof typeof TIMING.GENRE_TIMEOUTS] || TIMING.QUESTION_TIMEOUT;
}
