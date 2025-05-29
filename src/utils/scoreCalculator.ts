/**
 * スコア計算ユーティリティ
 */

import { SCORING } from '@/config/quizConfig';

/**
 * ユーザーパフォーマンスデータ
 */
export interface UserPerformance {
  score?: number;
  missCount?: number;
}

/**
 * 経験値計算の結果
 */
export interface ExperienceCalculationResult {
  expToAdd: number;
  actualCorrectAnswers: number;
  isSoloPlay: boolean;
}

/**
 * スコアから実際の正解数を計算する
 * スコア = 正解数 × 10 - 不正解数 × 1
 * 正解数 = (スコア + 不正解数) / 10
 * 
 * @param score ユーザーのスコア
 * @param missCount 不正解数（ミス数）
 * @returns 実際の正解数
 */
export function calculateActualCorrectAnswers(score: number, missCount: number): number {
  const adjustedScore = score + (missCount * Math.abs(SCORING.INCORRECT_ANSWER_PENALTY));
  return Math.max(0, Math.floor(adjustedScore / SCORING.CORRECT_ANSWER_SCORE));
}

/**
 * ユーザーパフォーマンスから基本経験値を計算する
 * 
 * @param userPerformance ユーザーのパフォーマンスデータ
 * @returns 基本経験値
 */
export function calculateBaseExperience(userPerformance: UserPerformance): number {
  const score = userPerformance.score || 0;
  const missCount = userPerformance.missCount || 0;

  // ex.スコア10ポイントで1経験値
  let expToAdd = Math.floor(score / SCORING.SCORE_PER_EXP);
  
  // 完答ボーナス（ミスが0かつスコアが0より大きい場合）
  if (missCount === 0 && score > 0) {
    expToAdd += SCORING.EXP_PERFECT_ANSWER;
  }
  
  return expToAdd;
}

/**
 * ソロプレイ時の経験値倍率を適用する
 * 
 * @param baseExp 基本経験値
 * @returns ソロプレイ用に調整された経験値
 */
export function applySoloPlayMultiplier(baseExp: number): number {
  return Math.round(baseExp * SCORING.SOLO_MULTIPLIER);
}

/**
 * 参加者数からソロプレイかどうかを判定する
 * 
 * @param participantCount 参加者数
 * @returns ソロプレイの場合true
 */
export function isSoloPlay(participantCount: number): boolean {
  return participantCount === 1;
}

/**
 * 総合的な経験値計算を行う
 * 
 * @param userPerformance ユーザーのパフォーマンスデータ
 * @param participantCount 参加者数
 * @returns 経験値計算の結果
 */
export function calculateTotalExperience(
  userPerformance: UserPerformance,
  participantCount: number
): ExperienceCalculationResult {
  const baseExp = calculateBaseExperience(userPerformance);
  const isSolo = isSoloPlay(participantCount);
  const expToAdd = isSolo ? applySoloPlayMultiplier(baseExp) : baseExp;
  
  const actualCorrectAnswers = calculateActualCorrectAnswers(
    userPerformance.score || 0,
    userPerformance.missCount || 0
  );

  return {
    expToAdd,
    actualCorrectAnswers,
    isSoloPlay: isSolo
  };
}

/**
 * スコア計算の詳細ログを生成する
 * 
 * @param userPerformance ユーザーのパフォーマンスデータ
 * @param totalQuizCount 総問題数
 * @param calculationResult 計算結果
 * @returns ログメッセージ
 */
export function generateScoreCalculationLog(
  userPerformance: UserPerformance,
  totalQuizCount: number,
  calculationResult: ExperienceCalculationResult
): string {
  const score = userPerformance.score || 0;
  const missCount = userPerformance.missCount || 0;
  const { actualCorrectAnswers, expToAdd, isSoloPlay } = calculationResult;
  
  const soloPlayInfo = isSoloPlay ? ' (ソロプレイ倍率適用)' : '';
  
  return `統計計算: スコア=${score}, ミス数=${missCount}, 正解数=${actualCorrectAnswers}, 総回答数=${totalQuizCount}, 獲得経験値=${expToAdd}${soloPlayInfo}`;
}
