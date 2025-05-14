import { Timestamp } from "firebase/firestore";
import { ParticipantInfo } from "./user";

export interface QuizRoom {
  roomId: string;
  name: string;
  genre: string;
  subgenre: string;
  roomLeaderId: string;
  participants: {
    [userId: string]: ParticipantInfo;
  };
  currentQuizIndex: number;
  quizIds: string[];
  totalQuizCount: number;
  startedAt: Timestamp;
  updatedAt: Timestamp;
  status: RoomStatus;
  currentState: QuizRoomState;
}

export type RoomStatus = 'waiting' | 'in_progress' | 'completed';

export interface QuizRoomState {
  quizId: string;
  startTime: Timestamp;
  endTime: Timestamp | null;
  currentAnswerer: string | null;
  answerStatus: AnswerStatus;
  isRevealed: boolean;
}

export type AnswerStatus = 'waiting' | 'answering' | 'correct' | 'incorrect' | 'timeout';

export interface RoomParticipant {
  userId: string;
  username: string;
  iconId: number;
  score: number;
  isReady: boolean;
  isOnline: boolean;
}

export interface RoomListing {
  roomId: string;
  name: string;
  genre: string;
  subgenre: string;
  participantCount: number;
  status: RoomStatus;
}
