import { Router, Request, Response } from 'express';
import { eq, and, count } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db';
import { games, cardPairs } from '../db/schema';
import { requireAuth } from '../middleware/auth';

const cardPairSchema = z.object({
  pairIndex: z.number().int().min(0),
  cardAContent: z.string().min(1).max(500),
  cardBContent: z.string().min(1).max(500),
  contentType: z.enum(['text', 'image_url']).default('text'),
});

const gameConfigSchema = z.object({
  rows: z.number().int().min(2).max(6),
  cols: z.number().int().min(2).max(6),
  defaultFlipBackDelay: z.number().int().min(0),
});

const createGameSchema = z.object({
  title: z.string().min(1).max(200),
  gameType: z.enum(['memory_cards']),
  config: gameConfigSchema,
  cardPairs: z.array(cardPairSchema).min(1),
});

function validateGridPairs(config: { rows: number; cols: number }, pairs: unknown[]): string | null {
  const totalCells = config.rows * config.cols;
  if (totalCells % 2 !== 0) return 'Grid dimensions must produce an even number of cells';
  const requiredPairs = totalCells / 2;
  if (pairs.length !== requiredPairs)
    return `Grid requires exactly ${requiredPairs} card pairs, got ${pairs.length}`;
  return null;
}

const router = Router();
router.use(requireAuth);

// GET /api/games
router.get('/', async (req: Request, res: Response): Promise<void> => {
  const result = await db
    .select({
      id: games.id,
      title: games.title,
      gameType: games.gameType,
      config: games.config,
      createdAt: games.createdAt,
      updatedAt: games.updatedAt,
      cardPairCount: count(cardPairs.id),
    })
    .from(games)
    .leftJoin(cardPairs, eq(cardPairs.gameId, games.id))
    .where(eq(games.teacherId, req.teacher!.id))
    .groupBy(games.id);

  res.json(result);
});

// POST /api/games
router.post('/', async (req: Request, res: Response): Promise<void> => {
  const parsed = createGameSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: parsed.error.message } });
    return;
  }

  const { title, gameType, config, cardPairs: pairs } = parsed.data;
  const gridError = validateGridPairs(config, pairs);
  if (gridError) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: gridError } });
    return;
  }

  const [game] = await db
    .insert(games)
    .values({ teacherId: req.teacher!.id, title, gameType, config })
    .returning();

  await db.insert(cardPairs).values(
    pairs.map((p) => ({
      gameId: game.id,
      pairIndex: p.pairIndex,
      cardAContent: p.cardAContent,
      cardBContent: p.cardBContent,
      contentType: p.contentType,
    })),
  );

  res.status(201).json(game);
});

// GET /api/games/:id
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  const [game] = await db
    .select()
    .from(games)
    .where(and(eq(games.id, req.params.id), eq(games.teacherId, req.teacher!.id)))
    .limit(1);

  if (!game) {
    res.status(404).json({ error: { code: 'GAME_NOT_FOUND', message: 'Game not found' } });
    return;
  }

  const pairs = await db
    .select()
    .from(cardPairs)
    .where(eq(cardPairs.gameId, game.id))
    .orderBy(cardPairs.pairIndex);

  res.json({ ...game, cardPairs: pairs });
});

// PUT /api/games/:id
router.put('/:id', async (req: Request, res: Response): Promise<void> => {
  const [existing] = await db
    .select()
    .from(games)
    .where(and(eq(games.id, req.params.id), eq(games.teacherId, req.teacher!.id)))
    .limit(1);

  if (!existing) {
    res.status(404).json({ error: { code: 'GAME_NOT_FOUND', message: 'Game not found' } });
    return;
  }

  const parsed = createGameSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: parsed.error.message } });
    return;
  }

  const { title, gameType, config, cardPairs: pairs } = parsed.data;
  const gridError = validateGridPairs(config, pairs);
  if (gridError) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: gridError } });
    return;
  }

  const [updated] = await db
    .update(games)
    .set({ title, gameType, config, updatedAt: new Date() })
    .where(eq(games.id, req.params.id))
    .returning();

  // Full replace card pairs
  await db.delete(cardPairs).where(eq(cardPairs.gameId, req.params.id));
  await db.insert(cardPairs).values(
    pairs.map((p) => ({
      gameId: req.params.id,
      pairIndex: p.pairIndex,
      cardAContent: p.cardAContent,
      cardBContent: p.cardBContent,
      contentType: p.contentType,
    })),
  );

  res.json(updated);
});

// DELETE /api/games/:id
router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  const [existing] = await db
    .select()
    .from(games)
    .where(and(eq(games.id, req.params.id), eq(games.teacherId, req.teacher!.id)))
    .limit(1);

  if (!existing) {
    res.status(404).json({ error: { code: 'GAME_NOT_FOUND', message: 'Game not found' } });
    return;
  }

  await db.delete(games).where(eq(games.id, req.params.id));
  res.status(204).send();
});

export { router as gamesRouter };
