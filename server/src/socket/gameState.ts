import type { BoardCard, Participant, GameSessionState } from 'shared/types';

export interface InMemoryParticipant {
  nickname: string;
  role: 'teacher' | 'student';
  socketId: string;
  connected: boolean;
}

export interface InMemoryGameState {
  sessionId: string;
  gameId: string;
  teacherId: string;
  gameTitle: string;
  board: BoardCard[];
  // Store content separately — only revealed on flip
  boardContent: { content: string; pairIndex: number }[];
  rows: number;
  cols: number;
  totalPairs: number;
  matchedPairs: number;
  currentlyFlipped: number[];
  flipBackDelay: number;
  participants: Map<string, InMemoryParticipant>;
  totalFlips: number;
  startedAt?: Date;
  flipBackTimer?: ReturnType<typeof setTimeout>;
  status: 'waiting' | 'active' | 'completed' | 'abandoned';
}

export const gameSessions = new Map<string, InMemoryGameState>();

export function getSession(sessionId: string): InMemoryGameState | undefined {
  return gameSessions.get(sessionId);
}

export function createSession(
  sessionId: string,
  gameId: string,
  teacherId: string,
  gameTitle: string,
  rows: number,
  cols: number,
  flipBackDelay: number,
): InMemoryGameState {
  const state: InMemoryGameState = {
    sessionId,
    gameId,
    teacherId,
    gameTitle,
    board: [],
    boardContent: [],
    rows,
    cols,
    totalPairs: (rows * cols) / 2,
    matchedPairs: 0,
    currentlyFlipped: [],
    flipBackDelay,
    participants: new Map(),
    totalFlips: 0,
    status: 'waiting',
  };
  gameSessions.set(sessionId, state);
  return state;
}

export function addParticipant(
  state: InMemoryGameState,
  socketId: string,
  nickname: string,
  role: 'teacher' | 'student',
): void {
  state.participants.set(socketId, { nickname, role, socketId, connected: true });
}

export function removeParticipant(state: InMemoryGameState, socketId: string): InMemoryParticipant | undefined {
  const participant = state.participants.get(socketId);
  if (participant) {
    participant.connected = false;
  }
  return participant;
}

export function getParticipantList(state: InMemoryGameState): Participant[] {
  return Array.from(state.participants.values()).map((p) => ({
    nickname: p.nickname,
    role: p.role,
    connected: p.connected,
  }));
}

export function shuffleBoard(
  cardPairData: { pairIndex: number; cardAContent: string; cardBContent: string }[],
): { board: BoardCard[]; boardContent: { content: string; pairIndex: number }[] } {
  // Create two entries per pair
  const items: { content: string; pairIndex: number }[] = [];
  for (const pair of cardPairData) {
    items.push({ content: pair.cardAContent, pairIndex: pair.pairIndex });
    items.push({ content: pair.cardBContent, pairIndex: pair.pairIndex });
  }

  // Fisher-Yates shuffle
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }

  const board: BoardCard[] = items.map((_, index) => ({ index, state: 'face_down' }));
  return { board, boardContent: items };
}

export function buildSessionState(state: InMemoryGameState): GameSessionState {
  return {
    sessionId: state.sessionId,
    gameTitle: state.gameTitle,
    status: state.status,
    board: state.board.map((card) =>
      card.state === 'face_up' || card.state === 'matched'
        ? { ...card, content: state.boardContent[card.index]?.content }
        : card,
    ),
    rows: state.rows,
    cols: state.cols,
    totalPairs: state.totalPairs,
    matchedPairs: state.matchedPairs,
    currentlyFlipped: state.currentlyFlipped,
    flipBackDelay: state.flipBackDelay,
    participants: getParticipantList(state),
    totalFlips: state.totalFlips,
  };
}
