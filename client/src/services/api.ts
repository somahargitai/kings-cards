import axios from 'axios';
import type { CreateGameInput } from 'shared/types';

const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
});

export interface Teacher {
  id: string;
  email: string;
  displayName: string;
  nickname: string | null;
  avatarUrl: string | null;
}

export interface GameSummary {
  id: string;
  title: string;
  gameType: string;
  config: { rows: number; cols: number; defaultFlipBackDelay: number };
  cardPairCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CardPair {
  id: string;
  pairIndex: number;
  cardAContent: string;
  cardBContent: string;
  contentType: string;
}

export interface GameWithPairs extends GameSummary {
  cardPairs: CardPair[];
}

export interface SessionCreated {
  sessionId: string;
  joinCode: string;
  shareableLink: string;
  status: string;
}

export interface SessionInfo {
  sessionId: string;
  gameTitle: string;
  gameType: string;
  teacherNickname: string;
  status: string;
  participantCount: number;
}

export const authApi = {
  getMe: () => api.get<Teacher>('/auth/me').then((r) => r.data),
  logout: () => api.post('/auth/logout'),
};

export const gamesApi = {
  list: () => api.get<GameSummary[]>('/games').then((r) => r.data),
  create: (data: CreateGameInput) => api.post<GameWithPairs>('/games', data).then((r) => r.data),
  get: (id: string) => api.get<GameWithPairs>(`/games/${id}`).then((r) => r.data),
  update: (id: string, data: CreateGameInput) =>
    api.put<GameWithPairs>(`/games/${id}`, data).then((r) => r.data),
  delete: (id: string) => api.delete(`/games/${id}`),
  createSession: (gameId: string) =>
    api.post<SessionCreated>(`/games/${gameId}/sessions`).then((r) => r.data),
};

export const sessionsApi = {
  get: (sessionId: string) => api.get<SessionInfo>(`/sessions/${sessionId}`).then((r) => r.data),
};

export const profileApi = {
  update: (nickname: string) =>
    api.patch<Teacher>('/profile', { nickname }).then((r) => r.data),
};
