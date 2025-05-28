export interface User {
  userId: string;
  username: string;
  passwordHash: string;
  iconId: number;
  exp: number;
  rank: string;
  currentRoomId: string | null;
  stats: UserStats;
}

export interface UserStats {
  totalAnswered: number;
  correctAnswers: number;
  genres: {
    [genreId: string]: {
      totalAnswered: number;
      correctAnswers: number;
    };
  };
}

export interface UserProfile {
  userId: string;
  username: string;
  iconId: number;
  exp: number;
  rank: string;
  stats: UserStats;
  isAdmin?: boolean; // 管理者フラグ（オプション）
}

export interface ParticipantInfo {
  username: string;
  iconId: number;
  score: number;
  missCount?: number; // お手つきカウント追加（省略可能にしておく）
  wrongQuizIds?: string[]; // 間違えた問題IDのリスト
  isReady: boolean;
}
