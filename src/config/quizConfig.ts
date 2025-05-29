/**
 * クイズアプリ全体で使用される設定値
 */

// タイミング関連の設定（ミリ秒）
export const TIMING = {
  // ルーム自動解散時間（3分）
  AUTO_DISBAND_TIME_MS: 3 * 60 * 10005,

  // 正解後、次の問題に進むまでの待機時間
  NEXT_QUESTION_DELAY: 5000,
  
  // 解答制限時間（早押し後の制限時間）
  ANSWER_TIMEOUT: 8000, // 8秒
  
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
  } as const,


  QUIZ_AUTO_SAVE_INTERVAL: 10000, // クイズ自動保存間隔（ミリ秒）


  QUIZ_UNIT_PUBLISH_ROUTER_INTERVAL: 1000, // クイズユニットのパブリッシュ間隔（ミリ秒）
};


export const QUIZ_UNIT = {
  MAX_QUIZES_PER_ROOM: 10, // 各ルームの最大クイズ数


  // クイズユニットの最大数
  MAX_UNITS: 100, // 最大100ユニット
  // クイズユニットの最大問題数
  MAX_QUESTIONS_PER_UNIT: 10, // 各ユニットの最大問題数
  // クイズユニットの最大選択肢数
  MAX_CHOICES_PER_QUESTION: 4, // 各問題の最大選択肢数
  // クイズユニットの最大タイトル長
  MAX_TITLE_LENGTH: 50, // タイトルの最大文字数
  // クイズユニットの最大説明長
  MAX_DESCRIPTION_LENGTH: 200, // 説明の最大文字数
}

// スコア関連の設定
export const SCORING = {

  SOLO_MULTIPLIER: 0.3, // 一人プレイ時の経験値倍率 (0~1)

  // 正解時の得点
  CORRECT_ANSWER_SCORE: 50,

  // 不正解時の減点
  INCORRECT_ANSWER_PENALTY: -20,

  SCORE_PER_EXP: 10, // 1経験値あたりのスコア（10ポイントで1経験値）

  EXP_PERFECT_ANSWER: 5, // 完答時の経験値
};

/**
 * ジャンルに応じた制限時間を取得
 * @param genre ジャンル名
 * @returns 制限時間（ミリ秒）
 */
export function getQuestionTimeout(genre: string): number {
  return TIMING.GENRE_TIMEOUTS[genre as keyof typeof TIMING.GENRE_TIMEOUTS] || TIMING.QUESTION_TIMEOUT;
}
