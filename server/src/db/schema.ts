import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  integer,
  jsonb,
  timestamp,
  unique,
  index,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const allowedTeachers = pgTable('allowed_teachers', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  email: varchar('email', { length: 255 }).unique().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const teachers = pgTable(
  'teachers',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    email: varchar('email', { length: 255 })
      .unique()
      .notNull()
      .references(() => allowedTeachers.email, { onDelete: 'restrict' }),
    googleId: varchar('google_id', { length: 255 }).unique().notNull(),
    displayName: varchar('display_name', { length: 100 }).notNull(),
    nickname: varchar('nickname', { length: 50 }),
    avatarUrl: text('avatar_url'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('teachers_email_idx').on(table.email),
    index('teachers_google_id_idx').on(table.googleId),
  ],
);

export const games = pgTable(
  'games',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    teacherId: uuid('teacher_id')
      .notNull()
      .references(() => teachers.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 200 }).notNull(),
    gameType: varchar('game_type', { length: 50 }).notNull().default('memory_cards'),
    config: jsonb('config').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('games_teacher_id_idx').on(table.teacherId),
  ],
);

export const cardPairs = pgTable(
  'card_pairs',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    gameId: uuid('game_id')
      .notNull()
      .references(() => games.id, { onDelete: 'cascade' }),
    pairIndex: integer('pair_index').notNull(),
    cardAContent: text('card_a_content').notNull(),
    cardBContent: text('card_b_content').notNull(),
    contentType: varchar('content_type', { length: 20 }).notNull().default('text'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('card_pairs_game_id_idx').on(table.gameId),
    unique('card_pairs_game_id_pair_index_unique').on(table.gameId, table.pairIndex),
  ],
);

export const gameSessions = pgTable(
  'game_sessions',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    gameId: uuid('game_id').references(() => games.id, { onDelete: 'cascade' }),
    teacherId: uuid('teacher_id').references(() => teachers.id),
    status: varchar('status', { length: 20 }).default('waiting'),
    joinCode: varchar('join_code', { length: 8 }).unique().notNull(),
    currentFlipDelay: integer('current_flip_delay').notNull().default(3000),
    startedAt: timestamp('started_at'),
    endedAt: timestamp('ended_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('game_sessions_join_code_idx').on(table.joinCode),
    index('game_sessions_game_id_idx').on(table.gameId),
    index('game_sessions_teacher_id_idx').on(table.teacherId),
    index('game_sessions_status_idx').on(table.status),
  ],
);

export const sessionParticipants = pgTable(
  'session_participants',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    sessionId: uuid('session_id').references(() => gameSessions.id, { onDelete: 'cascade' }),
    nickname: varchar('nickname', { length: 50 }).notNull(),
    role: varchar('role', { length: 20 }).default('student'),
    socketId: varchar('socket_id', { length: 100 }),
    connected: boolean('connected').default(true),
    joinedAt: timestamp('joined_at').defaultNow().notNull(),
  },
  (table) => [
    index('session_participants_session_id_idx').on(table.sessionId),
    index('session_participants_socket_id_idx').on(table.socketId),
  ],
);
