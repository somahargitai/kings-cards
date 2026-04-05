import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { gameSessions as gameSessionsTable, cardPairs, games, teachers } from '../db/schema';
import { env } from '../config/env';
import { JwtPayload } from '../middleware/auth';
import {
  gameSessions,
  getSession,
  createSession,
  addParticipant,
  removeParticipant,
  shuffleBoard,
  buildSessionState,
} from './gameState';

const FLIP_RATE_LIMIT_MS = 100; // max 10 flips/sec per socket
const socketLastFlip = new Map<string, number>();

export function registerSocketHandlers(io: Server, socket: Socket): void {
  // teacher:join
  socket.on('teacher:join', async ({ sessionId }: { sessionId: string }) => {
    try {
      const token = (socket.handshake.auth as any)?.token as string | undefined;
      // Cookie-based auth: token comes from handshake headers if sent as cookie
      const cookieHeader = socket.handshake.headers.cookie ?? '';
      const cookieToken = cookieHeader
        .split(';')
        .map((c) => c.trim())
        .find((c) => c.startsWith('token='))
        ?.split('=').slice(1).join('=');

      const actualToken = token ?? cookieToken;
      if (!actualToken) {
        socket.emit('error', { code: 'UNAUTHORIZED', message: 'Authentication required' });
        return;
      }

      let payload: JwtPayload;
      try {
        payload = jwt.verify(actualToken, env.JWT_SECRET) as JwtPayload;
      } catch {
        socket.emit('error', { code: 'INVALID_TOKEN', message: 'Invalid token' });
        return;
      }

      // Load session from DB if not in memory
      let state = getSession(sessionId);
      if (!state) {
        const [dbSession] = await db
          .select()
          .from(gameSessionsTable)
          .where(eq(gameSessionsTable.id, sessionId))
          .limit(1);

        if (!dbSession) {
          socket.emit('error', { code: 'SESSION_NOT_FOUND', message: 'Session not found' });
          return;
        }

        if (dbSession.teacherId !== payload.sub) {
          socket.emit('error', { code: 'FORBIDDEN', message: 'Not your session' });
          return;
        }

        const [game] = await db
          .select()
          .from(games)
          .where(eq(games.id, dbSession.gameId!))
          .limit(1);

        const config = game.config as { rows: number; cols: number; defaultFlipBackDelay: number };
        state = createSession(
          sessionId,
          dbSession.gameId!,
          dbSession.teacherId!,
          game.title,
          config.rows,
          config.cols,
          dbSession.currentFlipDelay,
        );
        state.status = (dbSession.status as any) ?? 'waiting';
      }

      const [teacher] = await db
        .select({ nickname: teachers.nickname, displayName: teachers.displayName })
        .from(teachers)
        .where(eq(teachers.id, payload.sub))
        .limit(1);

      const nickname = teacher?.nickname ?? teacher?.displayName ?? 'Teacher';
      addParticipant(state, socket.id, nickname, 'teacher');
      await socket.join(sessionId);

      socket.emit('session:state', buildSessionState(state));

      io.to(sessionId).emit('player:joined', {
        nickname,
        role: 'teacher',
        participantCount: state.participants.size,
      });
    } catch (err) {
      console.error('teacher:join error', err);
      socket.emit('error', { code: 'SERVER_ERROR', message: 'Server error' });
    }
  });

  // student:join
  socket.on('student:join', async ({ joinCode, nickname }: { joinCode: string; nickname: string }) => {
    try {
      if (!nickname || nickname.length < 1 || nickname.length > 50) {
        socket.emit('error', { code: 'INVALID_NICKNAME', message: 'Nickname must be 1–50 characters' });
        return;
      }

      const [dbSession] = await db
        .select()
        .from(gameSessionsTable)
        .where(eq(gameSessionsTable.joinCode, joinCode.toUpperCase()))
        .limit(1);

      if (!dbSession) {
        socket.emit('error', { code: 'SESSION_NOT_FOUND', message: 'Session not found' });
        return;
      }

      if (dbSession.status === 'completed' || dbSession.status === 'abandoned') {
        socket.emit('error', { code: 'SESSION_ENDED', message: 'This session has ended' });
        return;
      }

      let state = getSession(dbSession.id);
      if (!state) {
        const [game] = await db
          .select()
          .from(games)
          .where(eq(games.id, dbSession.gameId!))
          .limit(1);

        const config = game.config as { rows: number; cols: number; defaultFlipBackDelay: number };
        state = createSession(
          dbSession.id,
          dbSession.gameId!,
          dbSession.teacherId!,
          game.title,
          config.rows,
          config.cols,
          dbSession.currentFlipDelay,
        );
        state.status = (dbSession.status as any) ?? 'waiting';
      }

      addParticipant(state, socket.id, nickname, 'student');
      await socket.join(dbSession.id);

      socket.emit('session:state', buildSessionState(state));

      io.to(dbSession.id).emit('player:joined', {
        nickname,
        role: 'student',
        participantCount: Array.from(state.participants.values()).filter((p) => p.connected).length,
      });
    } catch (err) {
      console.error('student:join error', err);
      socket.emit('error', { code: 'SERVER_ERROR', message: 'Server error' });
    }
  });

  // game:start
  socket.on('game:start', async ({ sessionId }: { sessionId: string }) => {
    try {
      const state = getSession(sessionId);
      if (!state) {
        socket.emit('error', { code: 'SESSION_NOT_FOUND', message: 'Session not found' });
        return;
      }

      const participant = state.participants.get(socket.id);
      if (!participant || participant.role !== 'teacher') {
        socket.emit('error', { code: 'FORBIDDEN', message: 'Only the teacher can start the game' });
        return;
      }

      if (state.status !== 'waiting') {
        socket.emit('error', { code: 'INVALID_STATE', message: 'Game already started' });
        return;
      }

      // Load card pairs and shuffle
      const pairs = await db
        .select({ pairIndex: cardPairs.pairIndex, cardAContent: cardPairs.cardAContent, cardBContent: cardPairs.cardBContent })
        .from(cardPairs)
        .where(eq(cardPairs.gameId, state.gameId))
        .orderBy(cardPairs.pairIndex);

      const { board, boardContent } = shuffleBoard(pairs);
      state.board = board;
      state.boardContent = boardContent;
      state.status = 'active';
      state.startedAt = new Date();

      await db
        .update(gameSessionsTable)
        .set({ status: 'active', startedAt: new Date() })
        .where(eq(gameSessionsTable.id, sessionId));

      // Send board without content
      io.to(sessionId).emit('game:started', {
        board: board.map((c) => ({ index: c.index, state: c.state })),
        rows: state.rows,
        cols: state.cols,
      });
    } catch (err) {
      console.error('game:start error', err);
      socket.emit('error', { code: 'SERVER_ERROR', message: 'Server error' });
    }
  });

  // card:flip
  socket.on('card:flip', ({ cardIndex }: { cardIndex: number }) => {
    try {
      // Rate limiting
      const now = Date.now();
      const lastFlip = socketLastFlip.get(socket.id) ?? 0;
      if (now - lastFlip < FLIP_RATE_LIMIT_MS) return;
      socketLastFlip.set(socket.id, now);

      // Find which session this socket is in
      const sessionId = Array.from(socket.rooms).find((r) => r !== socket.id);
      if (!sessionId) return;

      const state = getSession(sessionId);
      if (!state || state.status !== 'active') return;

      const card = state.board[cardIndex];
      if (!card || card.state !== 'face_down') return;
      if (state.currentlyFlipped.length >= 2) return;

      // Flip the card
      card.state = 'face_up';
      state.currentlyFlipped.push(cardIndex);
      state.totalFlips++;

      const content = state.boardContent[cardIndex]?.content ?? '';
      const flippedBy = state.participants.get(socket.id)?.nickname ?? 'Unknown';

      io.to(sessionId).emit('card:flipped', { cardIndex, content, flippedBy });

      if (state.currentlyFlipped.length === 2) {
        const [idx1, idx2] = state.currentlyFlipped;
        const pairIndex1 = state.boardContent[idx1]?.pairIndex;
        const pairIndex2 = state.boardContent[idx2]?.pairIndex;

        if (pairIndex1 === pairIndex2) {
          // MATCH
          state.board[idx1].state = 'matched';
          state.board[idx2].state = 'matched';
          state.board[idx1].pairIndex = pairIndex1;
          state.board[idx2].pairIndex = pairIndex2;
          state.matchedPairs++;
          state.currentlyFlipped = [];

          io.to(sessionId).emit('card:match', { cardIndex1: idx1, cardIndex2: idx2, pairIndex: pairIndex1 });

          if (state.matchedPairs === state.totalPairs) {
            state.status = 'completed';
            const duration = state.startedAt ? Date.now() - state.startedAt.getTime() : 0;
            db.update(gameSessionsTable)
              .set({ status: 'completed', endedAt: new Date() })
              .where(eq(gameSessionsTable.id, sessionId))
              .catch(console.error);

            io.to(sessionId).emit('game:completed', {
              totalPairs: state.totalPairs,
              totalFlips: state.totalFlips,
              duration,
            });
          }
        } else {
          // NO MATCH
          const toFlipBack = [idx1, idx2];

          io.to(sessionId).emit('card:no_match', {
            cardIndex1: idx1,
            cardIndex2: idx2,
            flipBackDelay: state.flipBackDelay,
          });

          if (state.flipBackDelay > 0) {
            if (state.flipBackTimer) clearTimeout(state.flipBackTimer);
            state.flipBackTimer = setTimeout(() => {
              for (const i of toFlipBack) {
                if (state.board[i]?.state === 'face_up') {
                  state.board[i].state = 'face_down';
                }
              }
              state.currentlyFlipped = [];
              io.to(sessionId).emit('cards:flip_back', { cardIndex1: toFlipBack[0], cardIndex2: toFlipBack[1] });
            }, state.flipBackDelay);
          }
        }
      }
    } catch (err) {
      console.error('card:flip error', err);
    }
  });

  // cards:flip_back_manual
  socket.on('cards:flip_back_manual', () => {
    const sessionId = Array.from(socket.rooms).find((r) => r !== socket.id);
    if (!sessionId) return;

    const state = getSession(sessionId);
    if (!state || state.status !== 'active' || state.flipBackDelay !== 0) return;

    const [idx1, idx2] = state.currentlyFlipped;
    if (idx1 === undefined || idx2 === undefined) return;

    state.board[idx1].state = 'face_down';
    state.board[idx2].state = 'face_down';
    state.currentlyFlipped = [];

    io.to(sessionId).emit('cards:flip_back', { cardIndex1: idx1, cardIndex2: idx2 });
  });

  // settings:update
  socket.on('settings:update', ({ flipBackDelay }: { flipBackDelay: number }) => {
    const sessionId = Array.from(socket.rooms).find((r) => r !== socket.id);
    if (!sessionId) return;

    const state = getSession(sessionId);
    if (!state) return;

    const participant = state.participants.get(socket.id);
    if (!participant || participant.role !== 'teacher') return;

    if (typeof flipBackDelay !== 'number' || flipBackDelay < 0) return;

    state.flipBackDelay = flipBackDelay;
    db.update(gameSessionsTable)
      .set({ currentFlipDelay: flipBackDelay })
      .where(eq(gameSessionsTable.id, sessionId))
      .catch(console.error);

    io.to(sessionId).emit('settings:updated', { flipBackDelay });
  });

  // game:abandon
  socket.on('game:abandon', async ({ sessionId }: { sessionId: string }) => {
    const state = getSession(sessionId);
    if (!state) return;

    const participant = state.participants.get(socket.id);
    if (!participant || participant.role !== 'teacher') return;

    state.status = 'abandoned';
    await db
      .update(gameSessionsTable)
      .set({ status: 'abandoned', endedAt: new Date() })
      .where(eq(gameSessionsTable.id, sessionId));

    io.to(sessionId).emit('game:abandoned', {});
    gameSessions.delete(sessionId);
  });

  // disconnect
  socket.on('disconnect', () => {
    socketLastFlip.delete(socket.id);

    for (const [sessionId, state] of gameSessions) {
      const participant = removeParticipant(state, socket.id);
      if (participant) {
        const connectedCount = Array.from(state.participants.values()).filter((p) => p.connected).length;
        io.to(sessionId).emit('player:left', {
          nickname: participant.nickname,
          role: participant.role,
          participantCount: connectedCount,
        });
        break;
      }
    }
  });
}
