import { Router, Request, Response } from 'express';
import passport from 'passport';
import { Strategy as GoogleStrategy, Profile } from 'passport-google-oauth20';
import jwt from 'jsonwebtoken';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { allowedTeachers, teachers } from '../db/schema';
import { env } from '../config/env';
import { requireAuth, issueToken, setTokenCookie, JwtPayload } from '../middleware/auth';

// Configure Passport Google Strategy
passport.use(
  new GoogleStrategy(
    {
      clientID: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      callbackURL: `${env.NODE_ENV === 'production' ? 'https://api.kingscards.app' : 'http://localhost:3001'}/api/auth/google/callback`,
    },
    async (_accessToken, _refreshToken, profile: Profile, done) => {
      try {
        const email = profile.emails?.[0]?.value;
        if (!email) return done(new Error('No email from Google'));

        // Check whitelist
        const [allowed] = await db
          .select()
          .from(allowedTeachers)
          .where(eq(allowedTeachers.email, email))
          .limit(1);

        if (!allowed) {
          return done(null, false, { message: 'not_whitelisted' });
        }

        // Upsert teacher
        const displayName = profile.displayName || email;
        const googleId = profile.id;
        const avatarUrl = profile.photos?.[0]?.value ?? null;

        const existing = await db
          .select()
          .from(teachers)
          .where(eq(teachers.googleId, googleId))
          .limit(1);

        let teacher: typeof teachers.$inferSelect;
        if (existing.length > 0) {
          const [updated] = await db
            .update(teachers)
            .set({ displayName, avatarUrl, updatedAt: new Date() })
            .where(eq(teachers.googleId, googleId))
            .returning();
          teacher = updated;
        } else {
          const [created] = await db
            .insert(teachers)
            .values({ email, googleId, displayName, avatarUrl })
            .returning();
          teacher = created;
        }

        return done(null, teacher);
      } catch (err) {
        return done(err as Error);
      }
    },
  ),
);

passport.serializeUser((user: any, done) => done(null, user.id));
passport.deserializeUser((id: string, done) => done(null, { id } as any));

const router = Router();

router.get(
  '/google',
  passport.authenticate('google', { scope: ['profile', 'email'], session: false }),
);

router.get('/google/callback', (req: Request, res: Response) => {
  passport.authenticate(
    'google',
    { session: false, failureRedirect: `${env.FRONTEND_URL}/unauthorized` },
    (err: Error | null, teacher: any, info: any) => {
      if (err) {
        console.error('OAuth error:', err);
        return res.redirect(`${env.FRONTEND_URL}/unauthorized`);
      }
      if (!teacher) {
        return res.redirect(`${env.FRONTEND_URL}/unauthorized`);
      }

      const token = issueToken(teacher.id, teacher.email);
      setTokenCookie(res, token);
      return res.redirect(`${env.FRONTEND_URL}/dashboard`);
    },
  )(req, res);
});

router.get('/me', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const [teacher] = await db
    .select({
      id: teachers.id,
      email: teachers.email,
      displayName: teachers.displayName,
      nickname: teachers.nickname,
      avatarUrl: teachers.avatarUrl,
    })
    .from(teachers)
    .where(eq(teachers.id, req.teacher!.id))
    .limit(1);

  if (!teacher) {
    res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Teacher not found' } });
    return;
  }

  // Refresh token if within 2h of expiry
  const token = req.cookies?.token as string;
  const decoded = jwt.decode(token) as JwtPayload;
  const twoHoursFromNow = Math.floor(Date.now() / 1000) + 2 * 60 * 60;
  if (decoded.exp < twoHoursFromNow) {
    const newToken = issueToken(teacher.id, teacher.email);
    setTokenCookie(res, newToken);
  }

  res.json(teacher);
});

router.post('/logout', requireAuth, (_req: Request, res: Response) => {
  res.clearCookie('token');
  res.json({ success: true });
});

export { router as authRouter };
