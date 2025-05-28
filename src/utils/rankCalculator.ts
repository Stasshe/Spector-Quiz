/**
 * ユーザーのランクとレベルを計算するユーティリティ
 */

// ランク定義
export interface RankInfo {
  name: string;
  minExp: number;
  maxExp: number;
  color: string;
  bgColor: string;
  description: string;
}

// ランクシステムの定義
export const RANKS: RankInfo[] = [
  {
    name: 'ビギナー',
    minExp: 0,
    maxExp: 99,
    color: 'text-gray-600',
    bgColor: 'bg-gray-100',
    description: '初心者クイズプレイヤー'
  },
  {
    name: 'アマチュア',
    minExp: 100,
    maxExp: 299,
    color: 'text-green-600',
    bgColor: 'bg-green-100',
    description: '基礎を身につけたプレイヤー'
  },
  {
    name: 'エキスパート',
    minExp: 300,
    maxExp: 599,
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
    description: '経験豊富なプレイヤー'
  },
  {
    name: 'マスター',
    minExp: 600,
    maxExp: 999,
    color: 'text-purple-600',
    bgColor: 'bg-purple-100',
    description: '高度な知識を持つプレイヤー'
  },
  {
    name: 'グランドマスター',
    minExp: 1000,
    maxExp: 1999,
    color: 'text-orange-600',
    bgColor: 'bg-orange-100',
    description: '卓越したスキルを持つプレイヤー'
  },
  {
    name: 'レジェンド',
    minExp: 2000,
    maxExp: Infinity,
    color: 'text-red-600',
    bgColor: 'bg-red-100',
    description: '伝説のクイズプレイヤー'
  }
];

/**
 * 経験値からランク情報を計算する
 * @param exp 経験値
 * @returns ランク情報
 */
export function calculateRank(exp: number): RankInfo {
  // 経験値が負の場合は0として扱う
  const validExp = Math.max(0, exp || 0);
  
  // 該当するランクを見つける
  for (const rank of RANKS) {
    if (validExp >= rank.minExp && validExp <= rank.maxExp) {
      return rank;
    }
  }
  
  // フォールバック（通常は発生しない）
  return RANKS[0];
}

/**
 * 経験値からレベルを計算する
 * @param exp 経験値
 * @returns レベル
 */
export function calculateLevel(exp: number): number {
  const validExp = Math.max(0, exp || 0);
  return Math.floor(validExp / 100) + 1;
}

/**
 * 次のランクまでに必要な経験値を計算する
 * @param exp 現在の経験値
 * @returns 次のランクまでに必要な経験値（最高ランクの場合は0）
 */
export function calculateExpToNextRank(exp: number): number {
  const validExp = Math.max(0, exp || 0);
  const currentRank = calculateRank(validExp);
  
  // 最高ランクの場合は0を返す
  if (currentRank.maxExp === Infinity) {
    return 0;
  }
  
  return currentRank.maxExp + 1 - validExp;
}

/**
 * 現在のランクでの進捗率を計算する（0-100）
 * @param exp 現在の経験値
 * @returns 進捗率（パーセンテージ）
 */
export function calculateRankProgress(exp: number): number {
  const validExp = Math.max(0, exp || 0);
  const currentRank = calculateRank(validExp);
  
  // 最高ランクの場合は100%を返す
  if (currentRank.maxExp === Infinity) {
    return 100;
  }
  
  const rangeSize = currentRank.maxExp - currentRank.minExp + 1;
  const currentPosition = validExp - currentRank.minExp;
  
  return Math.min(100, Math.max(0, (currentPosition / rangeSize) * 100));
}

/**
 * ランク名からランク情報を取得する
 * @param rankName ランク名
 * @returns ランク情報（見つからない場合はビギナー）
 */
export function getRankByName(rankName: string): RankInfo {
  const rank = RANKS.find(r => r.name === rankName);
  return rank || RANKS[0]; // デフォルトはビギナー
}

/**
 * すべてのランクを取得する
 * @returns すべてのランク情報
 */
export function getAllRanks(): RankInfo[] {
  return [...RANKS];
}

/**
 * ユーザーの統合的なランク情報を計算する
 * @param exp 経験値
 * @returns 統合的なランク情報
 */
export function calculateUserRankInfo(exp: number) {
  const validExp = Math.max(0, exp || 0);
  const rank = calculateRank(validExp);
  const level = calculateLevel(validExp);
  const expToNextRank = calculateExpToNextRank(validExp);
  const progress = calculateRankProgress(validExp);
  
  return {
    rank,
    level,
    exp: validExp,
    expToNextRank,
    progress: Math.round(progress)
  };
}

/**
 * 経験値に基づいてランクアップしたかどうかを判定する
 * @param oldExp 以前の経験値
 * @param newExp 新しい経験値
 * @returns ランクアップした場合はtrue
 */
export function hasRankUp(oldExp: number, newExp: number): boolean {
  const oldRank = calculateRank(oldExp || 0);
  const newRank = calculateRank(newExp || 0);
  
  return oldRank.name !== newRank.name;
}

/**
 * ランクアップ時のお祝いメッセージを生成する
 * @param newRank 新しいランク
 * @returns お祝いメッセージ
 */
export function generateRankUpMessage(newRank: RankInfo): string {
  const messages = {
    'アマチュア': '🎉 おめでとうございます！アマチュアランクに昇格しました！',
    'エキスパート': '🎊 素晴らしい！エキスパートランクに到達しました！',
    'マスター': '🏆 驚異的です！マスターランクに昇格しました！',
    'グランドマスター': '👑 圧倒的！グランドマスターランクに到達しました！',
    'レジェンド': '⭐ 伝説の誕生！レジェンドランクに昇格しました！'
  };
  
  return messages[newRank.name as keyof typeof messages] || 
    `🎉 おめでとうございます！${newRank.name}ランクに昇格しました！`;
}
