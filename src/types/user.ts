import { Timestamp } from "firebase/firestore";

export interface User {
  userId: string;
  username: string;
  passwordHash: string;
  iconId: number;
  exp: number;
  rank: string;
  createdAt: Timestamp;
  lastLoginAt: Timestamp;
  isOnline: boolean;
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
}

export interface ParticipantInfo {
  username: string;
  iconId: number;
  score: number;
  isReady: boolean;
  isOnline: boolean;
}
