import { Router, Request, Response } from 'express';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db';
import { teachers } from '../db/schema';
import { requireAuth } from '../middleware/auth';

const updateProfileSchema = z.object({
  nickname: z
    .string()
    .min(3)
    .max(50)
    .regex(/^[a-zA-Z0-9 .'-]+$/, 'Nickname may only contain letters, numbers, spaces, and . \' -'),
});

const router = Router();

router.patch('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const parsed = updateProfileSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: parsed.error.message } });
    return;
  }

  const [updated] = await db
    .update(teachers)
    .set({ nickname: parsed.data.nickname, updatedAt: new Date() })
    .where(eq(teachers.id, req.teacher!.id))
    .returning({
      id: teachers.id,
      email: teachers.email,
      displayName: teachers.displayName,
      nickname: teachers.nickname,
      avatarUrl: teachers.avatarUrl,
    });

  res.json(updated);
});

export { router as profileRouter };
