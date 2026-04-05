import { Router, Request, Response } from 'express';
import { eq, and, count } from 'drizzle-orm';
import { db } from '../db';
import { games, gameSessions, sessionParticipants, teachers } from '../db/schema';
import { requireAuth } from '../middleware/auth';
import { env } from '../config/env';

function generateJoinCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

async function uniqueJoinCode(): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const code = generateJoinCode();
    const [existing] = await db
      .select()
      .from(gameSessions)
      .where(eq(gameSessions.joinCode, code))
      .limit(1);
    if (!existing) return code;
  }
  throw new Error('Failed to generate unique join code');
}

const router = Router();

// POST /api/games/:id/sessions — teacher starts a session
router.post('/games/:id/sessions', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const [game] = await db
    .select()
    .from(games)
    .where(and(eq(games.id, req.params.id), eq(games.teacherId, req.teacher!.id)))
    .limit(1);

  if (!game) {
    res.status(404).json({ error: { code: 'GAME_NOT_FOUND', message: 'Game not found' } });
    return;
  }

  const config = game.config as { rows: number; cols: number; defaultFlipBackDelay: number };
  const joinCode = await uniqueJoinCode();

  const [session] = await db
    .insert(gameSessions)
    .values({
      gameId: game.id,
      teacherId: req.teacher!.id,
      joinCode,
      currentFlipDelay: config.defaultFlipBackDelay ?? 3000,
      status: 'waiting',
    })
    .returning();

  const baseUrl = env.NODE_ENV === 'production' ? 'https://kingscards.app' : env.FRONTEND_URL;
  res.status(201).json({
    sessionId: session.id,
    joinCode: session.joinCode,
    shareableLink: `${baseUrl}/join/${session.joinCode}`,
    status: session.status,
  });
});

// GET /api/sessions/:sessionId — public, for students joining
router.get('/sessions/:sessionId', async (req: Request, res: Response): Promise<void> => {
  const [session] = await db
    .select({
      id: gameSessions.id,
      status: gameSessions.status,
      gameId: gameSessions.gameId,
      teacherId: gameSessions.teacherId,
    })
    .from(gameSessions)
    .where(eq(gameSessions.id, req.params.sessionId))
    .limit(1);

  if (!session) {
    res.status(404).json({ error: { code: 'SESSION_NOT_FOUND', message: 'Session not found' } });
    return;
  }

  const [game] = await db
    .select({ title: games.title, gameType: games.gameType })
    .from(games)
    .where(eq(games.id, session.gameId!))
    .limit(1);

  const [teacher] = await db
    .select({ nickname: teachers.nickname, displayName: teachers.displayName })
    .from(teachers)
    .where(eq(teachers.id, session.teacherId!))
    .limit(1);

  const [participantCount] = await db
    .select({ count: count() })
    .from(sessionParticipants)
    .where(and(
      eq(sessionParticipants.sessionId, session.id),
      eq(sessionParticipants.connected, true),
    ));

  res.json({
    sessionId: session.id,
    gameTitle: game?.title,
    gameType: game?.gameType,
    teacherNickname: teacher?.nickname ?? teacher?.displayName,
    status: session.status,
    participantCount: Number(participantCount.count),
  });
});

export { router as sessionsRouter };
