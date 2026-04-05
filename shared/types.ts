export type GameType = 'memory_cards';
export type SessionStatus = 'waiting' | 'active' | 'completed' | 'abandoned';
export type CardState = 'face_down' | 'face_up' | 'matched';
export type ParticipantRole = 'teacher' | 'student';
export type ContentType = 'text' | 'image_url';

export interface CardPairInput {
  pairIndex: number;
  cardAContent: string;
  cardBContent: string;
  contentType: ContentType;
}

export interface GameConfig {
  rows: number;
  cols: number;
  defaultFlipBackDelay: number;
}

export interface CreateGameInput {
  title: string;
  gameType: GameType;
  config: GameConfig;
  cardPairs: CardPairInput[];
}

export interface BoardCard {
  index: number;
  state: CardState;
  content?: string;
  pairIndex?: number;
}

export interface Participant {
  nickname: string;
  role: ParticipantRole;
  connected: boolean;
}

export interface GameSessionState {
  sessionId: string;
  gameTitle: string;
  status: SessionStatus;
  board: BoardCard[];
  rows: number;
  cols: number;
  totalPairs: number;
  matchedPairs: number;
  currentlyFlipped: number[];
  flipBackDelay: number;
  participants: Participant[];
  totalFlips: number;
}

// Socket event payloads
export interface TeacherJoinPayload { sessionId: string; }
export interface StudentJoinPayload { joinCode: string; nickname: string; }
export interface CardFlipPayload { cardIndex: number; }
export interface SettingsUpdatePayload { flipBackDelay: number; }
export interface GameStartPayload { sessionId: string; }
export interface GameAbandonPayload { sessionId: string; }
