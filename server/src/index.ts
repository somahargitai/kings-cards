import 'dotenv/config';
import express from 'express';
import http from 'http';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import passport from 'passport';
import rateLimit from 'express-rate-limit';
import { Server } from 'socket.io';
import { env } from './config/env';
import { authRouter } from './routes/auth';
import { gamesRouter } from './routes/games';
import { sessionsRouter } from './routes/sessions';
import { profileRouter } from './routes/profile';
import { registerSocketHandlers } from './socket/handlers';

const app = express();
const server = http.createServer(app);

// CORS
app.use(
  cors({
    origin: env.FRONTEND_URL,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  }),
);

// Body parsing
app.use(express.json());
app.use(cookieParser());

// Passport (no session — JWT only)
app.use(passport.initialize());

// Rate limiting
const globalLimiter = rateLimit({ windowMs: 60_000, max: 100 });
const authLimiter = rateLimit({ windowMs: 60_000, max: 10 });
app.use(globalLimiter);
if (env.NODE_ENV === 'production') {
  app.use('/api/auth', authLimiter);
}

// Health check
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

// Routes
app.use('/api/auth', authRouter);
app.use('/api/games', gamesRouter);
app.use('/api', sessionsRouter);
app.use('/api/profile', profileRouter);

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Internal server error' } });
});

// Socket.io
const io = new Server(server, {
  path: '/socket.io',
  cors: {
    origin: env.FRONTEND_URL,
    credentials: true,
    methods: ['GET', 'POST'],
  },
});

const gameNs = io.of('/game');

gameNs.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);
  registerSocketHandlers(gameNs as any, socket);
  socket.on('disconnect', () => console.log(`Socket disconnected: ${socket.id}`));
});

server.listen(env.PORT, () => {
  console.log(`Server running on port ${env.PORT} [${env.NODE_ENV}]`);
});

export { server, io };
