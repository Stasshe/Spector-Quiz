import { Timestamp } from "firebase/firestore";
import { ParticipantInfo } from "./user";

// メインルーム情報
export interface QuizRoom {
  roomId: string;
  name: string;
  genre: string;
  classType: string; // 'ユーザー作成' または '公式'
  quizType?: 'official' | 'user_created'; // クイズのタイプを明示的に指定
  roomLeaderId: string;
  unitId?: string;    // 使用する単元ID
  participants: ParticipantsMap;
  currentQuizIndex: number;
  totalQuizCount: number;
  startedAt: Timestamp;
  updatedAt: Timestamp;
  status: RoomStatus;
  currentState: QuizRoomState;
  statsUpdated?: boolean; // 統計情報が更新済みかどうか
  readyForNextQuestion?: boolean; // 次の問題に進む準備ができているか
  lastCorrectTimestamp?: Timestamp; // 最後に正解した時間
  
  // 移行期間中は互換性のためquizIdsも保持
  quizIds?: string[];
}

// ルームのステータス
export type RoomStatus = 'waiting' | 'in_progress' | 'completed';

// ルームの現在の状態（使用中のため残す）
export interface QuizRoomState {
  quizId: string;
  startTime: Timestamp;
  endTime: Timestamp | null;
  currentAnswerer: string | null;
  answerStatus: AnswerStatus;
  isRevealed: boolean;
}

// 解答状態（使用中のため残す）
export type AnswerStatus = 'waiting' | 'answering' | 'correct' | 'incorrect' | 'timeout' | 'answering_in_progress' | 'all_answered' | 'waiting_for_buzz';

// ルーム一覧表示用
export interface RoomListing {
  roomId: string;
  name: string;
  genre: string;
  unitId: string;
  unitName?: string; // 単元名を追加
  participantCount: number;
  totalQuizCount: number;
  status: RoomStatus;
}

// 参加者マップ（使用中のため残す）
export interface ParticipantsMap {
  [userId: string]: ParticipantInfo;
}
