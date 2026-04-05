# King's Cards — System Design Document

**Version:** 1.0
**Date:** 2026-04-05
**Author:** System Design Architect + Solo Developer

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Subprojects & Services](#2-subprojects--services)
3. [Cloud Infrastructure & Resources](#3-cloud-infrastructure--resources)
4. [Authentication & Authorization](#4-authentication--authorization)
5. [Database Design](#5-database-design)
6. [API Design](#6-api-design)
7. [WebSocket Event Protocol](#7-websocket-event-protocol)
8. [User Flows](#8-user-flows)
9. [UI & Design Guidelines](#9-ui--design-guidelines)
10. [Security Considerations](#10-security-considerations)
11. [Work Delegation Framework](#11-work-delegation-framework)
12. [Milestones & Phasing](#12-milestones--phasing)
13. [Open Questions & Risks](#13-open-questions--risks)

---

## 1. Project Overview

King's Cards is an online multiplayer memory card game designed for classroom use. Teachers log in via Google OAuth, create memory card games by defining card pairs, and start game sessions that students join anonymously through a shareable link. The game state — card flips, matches, and settings — synchronizes in real-time between teacher and student via WebSockets.

### Goals

- Provide teachers with an intuitive dashboard to create, edit, and manage memory card games
- Enable frictionless student participation — no sign-up, no download, just click a link and play
- Deliver real-time, synchronized gameplay between teacher and student(s)
- Architect the system so new game types (beyond memory cards) can be added in the future

### Non-Goals (V1)

- No multiplayer beyond 1 teacher + 1 student (architecture supports expansion)
- No historical game results or analytics
- No student accounts or persistent student identity
- No mobile native apps — web only
- No SSR — pure client-side SPA
- No payment or subscription system

---

## 2. Subprojects & Services

The system comprises two deployable units and one managed database:

| Component | Description | Tech |
|-----------|-------------|------|
| **Frontend SPA** | Teacher dashboard + game interface for both teacher and student views | React 18+ / Vite / Material UI |
| **Backend API + WebSocket Server** | REST API for CRUD operations, Google OAuth flow, and Socket.io server for real-time game sync | Express.js / Socket.io / Passport.js |
| **Database** | Persistent storage for teacher accounts, game definitions, whitelist, and active sessions | Neon (Serverless Postgres) |

### Repository Structure (Monorepo)

```
kings-card/
├── client/                  # React SPA
│   ├── src/
│   │   ├── components/      # Shared UI components
│   │   ├── pages/           # Route-level page components
│   │   │   ├── Dashboard/
│   │   │   ├── GameEditor/
│   │   │   ├── GameSession/
│   │   │   ├── JoinGame/
│   │   │   └── Profile/
│   │   ├── hooks/           # Custom React hooks (useSocket, useAuth, etc.)
│   │   ├── context/         # React context providers (AuthContext, SocketContext)
│   │   ├── services/        # API client functions
│   │   ├── types/           # TypeScript type definitions
│   │   └── utils/           # Helper functions
│   ├── index.html
│   ├── vite.config.ts
│   └── package.json
├── server/                  # Express + Socket.io
│   ├── src/
│   │   ├── routes/          # Express route handlers
│   │   ├── middleware/       # Auth, error handling, validation
│   │   ├── socket/          # Socket.io event handlers
│   │   ├── models/          # Database query functions
│   │   ├── services/        # Business logic
│   │   ├── db/              # Database connection, migrations, seeds
│   │   └── config/          # Environment config
│   ├── Dockerfile
│   └── package.json
├── shared/                  # Shared types and constants (game events, enums)
│   └── types.ts
├── fly.toml
└── package.json             # Workspace root
```

**Language:** TypeScript throughout (client, server, shared). This ensures type safety across the WebSocket event protocol and API contracts.

---

## 3. Cloud Infrastructure & Resources

### Hosting

| Service | Platform | Details |
|---------|----------|---------|
| Frontend SPA | **Vercel** | Automatic deploys from `client/` directory on push to `main`. Vercel Edge Network provides global CDN. |
| Backend API + WS | **Fly.io** | Single `shared-cpu-1x` machine (256 MB RAM) in `iad` (Ashburn, Virginia). Scale to 2+ machines when multiplayer expands. |
| Database | **Neon** | Serverless Postgres in `aws-us-east-1` (same region as Fly.io `iad`). Free tier sufficient for V1. |

### Why This Region Alignment Matters

Fly.io `iad` and Neon `aws-us-east-1` are both in Ashburn, Virginia. Database queries from the backend will have sub-5ms network latency, which is critical for responsive real-time game state operations.

### Scaling Strategy

| Component | V1 | Future |
|-----------|-----|--------|
| Frontend | Vercel free tier, auto-scaled at edge | No changes needed — static assets scale infinitely |
| Backend | 1 Fly.io machine, single process | Add machines + Redis pub/sub adapter for Socket.io to share state across instances |
| Database | Neon free tier (0.5 compute units, autosuspend) | Scale compute units; Neon scales storage automatically |

### CI/CD

- **GitHub Actions** with two workflows:
  - `deploy-client.yml`: On push to `main`, build `client/` and deploy to Vercel via Vercel CLI
  - `deploy-server.yml`: On push to `main`, build Docker image and deploy to Fly.io via `flyctl deploy`
- Lint + type-check + test gates before deploy

### Observability (V1 — Minimal)

| Concern | Tool |
|---------|------|
| Backend logs | Fly.io built-in log aggregation (`fly logs`) |
| Uptime monitoring | UptimeRobot (free) — ping health endpoint every 5 min |
| Error tracking | Console logging to Fly.io logs; add Sentry in Phase 2 if needed |

---

## 4. Authentication & Authorization

### Strategy

| Actor | Auth Method |
|-------|-------------|
| Teacher | Google OAuth 2.0 via Passport.js → JWT stored in httpOnly cookie |
| Student | No auth. Joins via shareable link with self-chosen nickname. Identified only by Socket.io connection ID + nickname within a session. |

### Teacher Auth Flow

```
1. Teacher clicks "Sign in with Google"
2. Frontend redirects to backend: GET /api/auth/google
3. Backend redirects to Google OAuth consent screen (Passport.js GoogleStrategy)
4. Google redirects back to: GET /api/auth/google/callback
5. Backend receives Google profile (email, name, avatar)
6. Backend checks: is this email in the `allowed_teachers` table?
   - YES → Create or update teacher record, issue JWT, set httpOnly cookie, redirect to dashboard
   - NO  → Redirect to frontend /unauthorized page
7. Frontend reads auth state from GET /api/auth/me (cookie sent automatically)
```

### JWT Structure

```json
{
  "sub": "teacher_uuid",
  "email": "teacher@school.com",
  "iat": 1712300000,
  "exp": 1712386400
}
```

- **Token lifetime:** 24 hours
- **Storage:** httpOnly, Secure, SameSite=Lax cookie
- **Refresh strategy:** On each `/api/auth/me` call, if token is within 2 hours of expiry, reissue a fresh token

### Authorization Rules

| Resource | Teacher (owner) | Teacher (other) | Student |
|----------|----------------|-----------------|---------|
| Game definitions (CRUD) | Full access | No access | No access |
| Start/stop game session | Yes | No | No |
| Join game session | Yes (as host) | No | Yes (via link) |
| Change in-game settings | Yes | No | No |
| Profile settings | Own profile only | No | N/A |

### Whitelist Management

The `allowed_teachers` table is seeded manually (via SQL or a seed script). There is no admin UI for whitelist management in V1. This keeps the surface area small. If needed, a simple CLI script or admin API route (protected by a server-side secret) can be added.

---

## 5. Database Design

### ORM / Query Layer

**Drizzle ORM** — lightweight, TypeScript-native, excellent Neon support, generates SQL migrations.

### Entity Relationship Diagram (Textual)

```
allowed_teachers (1) ←── email ──→ (1) teachers
teachers (1) ──→ (many) games
games (1) ──→ (many) card_pairs
games (1) ──→ (many) game_sessions
game_sessions (1) ──→ (many) session_participants
```

### Tables

#### `allowed_teachers`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `uuid` | PK, default `gen_random_uuid()` | |
| `email` | `varchar(255)` | UNIQUE, NOT NULL | Gmail address allowed to sign in |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | When the whitelist entry was added |

#### `teachers`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `uuid` | PK, default `gen_random_uuid()` | |
| `email` | `varchar(255)` | UNIQUE, NOT NULL, FK → `allowed_teachers.email` | Google email |
| `google_id` | `varchar(255)` | UNIQUE, NOT NULL | Google OAuth subject ID |
| `display_name` | `varchar(100)` | NOT NULL | Full name from Google profile |
| `nickname` | `varchar(50)` | NULL | Custom in-game nickname (set in profile) |
| `avatar_url` | `text` | NULL | Google profile picture URL |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | |
| `updated_at` | `timestamptz` | NOT NULL, default `now()` | |

#### `games`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `uuid` | PK, default `gen_random_uuid()` | |
| `teacher_id` | `uuid` | NOT NULL, FK → `teachers.id` ON DELETE CASCADE | Owner |
| `title` | `varchar(200)` | NOT NULL | Display name of the game |
| `game_type` | `varchar(50)` | NOT NULL, default `'memory_cards'` | Extensible: `'memory_cards'`, future types |
| `config` | `jsonb` | NOT NULL | Game-type-specific config (rows, cols, default delay) |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | |
| `updated_at` | `timestamptz` | NOT NULL, default `now()` | |

**`config` JSONB structure for `memory_cards`:**

```json
{
  "rows": 4,
  "cols": 4,
  "defaultFlipBackDelay": 3000,
  "pairs": 8
}
```

> **Design note:** `rows`, `cols`, and `defaultFlipBackDelay` are stored in `config` rather than as top-level columns, because different game types will have entirely different configuration schemas. JSONB keeps the table extensible without schema migrations for each new game type.

#### `card_pairs`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `uuid` | PK, default `gen_random_uuid()` | |
| `game_id` | `uuid` | NOT NULL, FK → `games.id` ON DELETE CASCADE | |
| `pair_index` | `integer` | NOT NULL | 0-based index of this pair within the game |
| `card_a_content` | `text` | NOT NULL | Content shown on the first card of the pair |
| `card_b_content` | `text` | NOT NULL | Content shown on the matching card |
| `content_type` | `varchar(20)` | NOT NULL, default `'text'` | `'text'`, `'image_url'` (future) |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | |

**Unique constraint:** `(game_id, pair_index)`

#### `game_sessions`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `uuid` | PK, default `gen_random_uuid()` | Also used as the room code / join code |
| `game_id` | `uuid` | NOT NULL, FK → `games.id` ON DELETE CASCADE | Which game definition is being played |
| `teacher_id` | `uuid` | NOT NULL, FK → `teachers.id` | Host teacher |
| `status` | `varchar(20)` | NOT NULL, default `'waiting'` | `'waiting'`, `'active'`, `'completed'`, `'abandoned'` |
| `join_code` | `varchar(8)` | UNIQUE, NOT NULL | Short human-readable code (e.g., `A3X9B2`) |
| `current_flip_delay` | `integer` | NOT NULL, default `3000` | Current flip-back delay in ms |
| `started_at` | `timestamptz` | NULL | When game play actually began |
| `ended_at` | `timestamptz` | NULL | When game completed or was abandoned |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | |

#### `session_participants`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `uuid` | PK, default `gen_random_uuid()` | |
| `session_id` | `uuid` | NOT NULL, FK → `game_sessions.id` ON DELETE CASCADE | |
| `nickname` | `varchar(50)` | NOT NULL | Student's chosen nickname |
| `role` | `varchar(20)` | NOT NULL, default `'student'` | `'teacher'` or `'student'` |
| `socket_id` | `varchar(100)` | NULL | Current Socket.io connection ID |
| `connected` | `boolean` | NOT NULL, default `true` | Is participant currently connected |
| `joined_at` | `timestamptz` | NOT NULL, default `now()` | |

### Indexes

```sql
CREATE INDEX idx_games_teacher_id ON games(teacher_id);
CREATE INDEX idx_card_pairs_game_id ON card_pairs(game_id);
CREATE INDEX idx_game_sessions_join_code ON game_sessions(join_code);
CREATE INDEX idx_game_sessions_teacher_id ON game_sessions(teacher_id);
CREATE INDEX idx_game_sessions_status ON game_sessions(status) WHERE status IN ('waiting', 'active');
CREATE INDEX idx_session_participants_session_id ON session_participants(session_id);
```

### Migrations

Drizzle Kit generates SQL migration files from the schema definition. Migrations run on deploy via a `migrate` npm script executed before the server starts.

### Backup & Recovery

Neon provides automatic point-in-time recovery with 7-day retention on the free tier. For V1, this is sufficient. No additional backup strategy is needed.

---

## 6. API Design

### Base URL

- Production: `https://api.kingscards.app` (custom domain on Fly.io)
- Development: `http://localhost:3001`

### Common Headers

All authenticated endpoints require the JWT cookie (sent automatically by the browser).

### Endpoints

#### Health

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/health` | None | Health check. Returns `{ "status": "ok" }` |

#### Auth

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/auth/google` | None | Initiates Google OAuth flow (redirect) |
| `GET` | `/api/auth/google/callback` | None | OAuth callback. Sets JWT cookie, redirects to frontend |
| `GET` | `/api/auth/me` | JWT | Returns current teacher profile or 401 |
| `POST` | `/api/auth/logout` | JWT | Clears JWT cookie |

**`GET /api/auth/me` response:**

```json
{
  "id": "uuid",
  "email": "teacher@school.com",
  "displayName": "Jane Smith",
  "nickname": "Ms. Smith",
  "avatarUrl": "https://..."
}
```

#### Teacher Profile

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `PATCH` | `/api/profile` | JWT | Update nickname |

**Request body:** `{ "nickname": "Ms. Smith" }`

#### Games

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/games` | JWT | List all games owned by the authenticated teacher |
| `POST` | `/api/games` | JWT | Create a new game with card pairs |
| `GET` | `/api/games/:id` | JWT | Get a single game with its card pairs |
| `PUT` | `/api/games/:id` | JWT | Update a game and its card pairs (full replace) |
| `DELETE` | `/api/games/:id` | JWT | Delete a game and all its card pairs |

**`POST /api/games` request body:**

```json
{
  "title": "Animal Pairs",
  "gameType": "memory_cards",
  "config": {
    "rows": 4,
    "cols": 4,
    "defaultFlipBackDelay": 3000
  },
  "cardPairs": [
    {
      "pairIndex": 0,
      "cardAContent": "Dog",
      "cardBContent": "Perro",
      "contentType": "text"
    },
    {
      "pairIndex": 1,
      "cardAContent": "Cat",
      "cardBContent": "Gato",
      "contentType": "text"
    }
  ]
}
```

**`GET /api/games` response:**

```json
[
  {
    "id": "uuid",
    "title": "Animal Pairs",
    "gameType": "memory_cards",
    "config": { "rows": 4, "cols": 4, "defaultFlipBackDelay": 3000 },
    "cardPairCount": 8,
    "createdAt": "2026-04-05T10:00:00Z",
    "updatedAt": "2026-04-05T10:00:00Z"
  }
]
```

#### Game Sessions

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/games/:id/sessions` | JWT | Start a new session. Returns session ID + join code + shareable link |
| `GET` | `/api/sessions/:sessionId` | None | Get session info (used by students joining via link) |

**`POST /api/games/:id/sessions` response:**

```json
{
  "sessionId": "uuid",
  "joinCode": "A3X9B2",
  "shareableLink": "https://kingscards.app/join/A3X9B2",
  "status": "waiting"
}
```

**`GET /api/sessions/:sessionId` response (public, minimal):**

```json
{
  "sessionId": "uuid",
  "gameTitle": "Animal Pairs",
  "gameType": "memory_cards",
  "teacherNickname": "Ms. Smith",
  "status": "waiting",
  "participantCount": 1
}
```

### Validation

All request bodies validated with **Zod**. Schemas are defined in `shared/` and imported by both client and server for type consistency.

### Rate Limiting

- **express-rate-limit** middleware
- Global: 100 requests per minute per IP
- Auth endpoints: 10 requests per minute per IP
- Game creation: 20 requests per minute per teacher

### Error Response Format

```json
{
  "error": {
    "code": "GAME_NOT_FOUND",
    "message": "No game found with the given ID"
  }
}
```

Standard HTTP status codes: 200, 201, 400, 401, 403, 404, 429, 500.

---

## 7. WebSocket Event Protocol

### Connection

- **Namespace:** `/game` (e.g., `io("https://api.kingscards.app/game")`)
- **Transport:** WebSocket with polling fallback
- **Auth on connect:** Teacher connections send JWT in the `auth` handshake option. Student connections send `{ joinCode, nickname }`.

### Socket.io Room Model

Each game session uses the `sessionId` as the Socket.io room name. All participants (teacher + student) join this room. All game state broadcasts go to the room.

### Events: Client → Server

| Event | Payload | Sender | Description |
|-------|---------|--------|-------------|
| `teacher:join` | `{ sessionId }` | Teacher | Teacher joins the session room |
| `student:join` | `{ joinCode, nickname }` | Student | Student requests to join a session |
| `card:flip` | `{ cardIndex }` | Either | Player flips a card at the given board index |
| `settings:update` | `{ flipBackDelay }` | Teacher | Teacher changes the flip-back delay mid-game |
| `game:start` | `{ sessionId }` | Teacher | Teacher starts the game (moves status from `waiting` → `active`) |
| `game:abandon` | `{ sessionId }` | Teacher | Teacher ends the game early |

### Events: Server → Client

| Event | Payload | Target | Description |
|-------|---------|--------|-------------|
| `session:state` | Full game state object (see below) | Joining client | Sent to a client immediately after joining — full state sync |
| `player:joined` | `{ nickname, role, participantCount }` | Room | A new participant has joined |
| `player:left` | `{ nickname, role, participantCount }` | Room | A participant disconnected |
| `game:started` | `{ board }` | Room | Game has begun. Contains the shuffled board layout. |
| `card:flipped` | `{ cardIndex, content, flippedBy }` | Room | A card has been revealed |
| `card:match` | `{ cardIndex1, cardIndex2, pairIndex }` | Room | Two flipped cards are a match — move to solved pile |
| `card:no_match` | `{ cardIndex1, cardIndex2, flipBackDelay }` | Room | Two flipped cards are not a match — will flip back after delay |
| `cards:flip_back` | `{ cardIndex1, cardIndex2 }` | Room | Cards flipping back face-down (sent after delay) |
| `settings:updated` | `{ flipBackDelay }` | Room | Flip-back delay has been changed by teacher |
| `game:completed` | `{ totalPairs, totalFlips, duration }` | Room | All pairs found. Show congratulations. |
| `game:abandoned` | `{}` | Room | Teacher ended the game |
| `error` | `{ code, message }` | Sender | Error (invalid move, not your turn, etc.) |

### Full Game State Object (`session:state`)

Sent on join to synchronize a connecting (or reconnecting) client:

```json
{
  "sessionId": "uuid",
  "gameTitle": "Animal Pairs",
  "status": "active",
  "board": [
    { "index": 0, "state": "face_down" },
    { "index": 1, "state": "face_up", "content": "Dog" },
    { "index": 2, "state": "matched" },
    ...
  ],
  "rows": 4,
  "cols": 4,
  "totalPairs": 8,
  "matchedPairs": 3,
  "currentlyFlipped": [1],
  "flipBackDelay": 3000,
  "participants": [
    { "nickname": "Ms. Smith", "role": "teacher", "connected": true },
    { "nickname": "Alex", "role": "student", "connected": true }
  ],
  "totalFlips": 14
}
```

### Server-Side Game State Management

Game state (board layout, flipped cards, matched pairs, flip count) is held **in-memory** on the server in a `Map<sessionId, GameState>` structure. This is appropriate because:

- V1 runs on a single Fly.io machine — no cross-instance coordination needed
- Game state is ephemeral — it does not need to survive server restarts
- In-memory access is orders of magnitude faster than DB queries during rapid card flips

When scaling to multiple Fly.io machines, the in-memory state will be replaced by a Redis-backed state store and Socket.io Redis adapter.

### Card Flip Logic (Server-Side)

```
1. Receive `card:flip` with cardIndex
2. Validate: card is face_down, fewer than 2 cards currently flipped
3. Reveal card → broadcast `card:flipped`
4. If this is the 2nd card flipped:
   a. Check if cards are a pair
   b. If MATCH → broadcast `card:match`, increment matchedPairs
   c. If NO MATCH → broadcast `card:no_match`, schedule flip-back:
      - If flipBackDelay > 0: setTimeout → broadcast `cards:flip_back`
      - If flipBackDelay = 0 (manual): wait for teacher's explicit flip-back event
   d. If matchedPairs === totalPairs → broadcast `game:completed`
```

### Board Shuffling

When the teacher starts a game:

1. Load card pairs from DB
2. Create an array with 2 entries per pair (one for card A, one for card B), each tagged with `pairIndex`
3. Shuffle using Fisher-Yates algorithm
4. Store as the session's board state
5. Broadcast `game:started` with the board (card positions but not content — content is revealed only on flip)

---

## 8. User Flows

### Flow 1: Teacher Sign-In

```
1. Teacher navigates to kingscards.app
2. Landing page shows "Sign in with Google" button
3. Teacher clicks → redirected to Google consent screen
4. Teacher grants access → redirected back to app
5. Server checks email against whitelist
   - If allowed: JWT cookie set, redirect to /dashboard
   - If not allowed: redirect to /unauthorized with explanation
```

### Flow 2: Create a Memory Card Game

```
1. Teacher is on /dashboard, clicks "Create New Game"
2. Game type selector appears (only "Memory Cards" available in V1)
3. Teacher selects "Memory Cards" → game editor opens
4. Teacher enters:
   a. Game title (e.g., "Spanish Animals")
   b. Grid size: rows (dropdown: 2-6) and columns (dropdown: 2-6)
      - System calculates total cards and required pairs
      - Validates that total cards is even
   c. Card pairs: for each pair, two text fields (Card A / Card B)
      - Pair editor auto-generates the correct number of empty pair rows
      - Teacher fills in content
5. Teacher sets default flip-back delay (3s / 5s / 10s / Manual)
6. Teacher clicks "Save" → POST /api/games → redirected to dashboard
7. New game appears in the game list
```

### Flow 3: Start a Game Session

```
1. Teacher clicks "Start" on a game card in the dashboard
2. POST /api/games/:id/sessions → returns joinCode + shareableLink
3. Teacher sees the "Waiting Room" screen:
   - Displays shareable link and join code prominently
   - "Copy Link" button
   - Shows connected participants list (initially just the teacher)
4. Teacher shares the link with the student (verbally, chat, projected on screen)
5. Teacher waits for student to join
```

### Flow 4: Student Joins a Game

```
1. Student clicks the shareable link: kingscards.app/join/A3X9B2
2. Join page loads. Shows game title and teacher name.
3. Student enters a nickname and clicks "Join Game"
4. WebSocket connects → student:join event with joinCode + nickname
5. Server adds student to room, broadcasts player:joined
6. Student sees the waiting room with participant list
7. Teacher sees student appear in participant list
```

### Flow 5: Playing the Memory Card Game

```
1. Teacher clicks "Start Game" in the waiting room
2. Server shuffles board, broadcasts game:started with board layout
3. Both screens show the card grid (all cards face-down)
4. A player clicks a face-down card:
   a. card:flip event sent to server
   b. Server validates and broadcasts card:flipped with content
   c. Card animates to face-up on all screens
5. Player clicks a second card:
   a. Same flip process
   b. Server evaluates match:
      - MATCH: cards animate to "solved" state, move to solved pile area
      - NO MATCH: after flip-back delay, cards animate back to face-down
6. Players alternate flipping cards (V1: no turn enforcement — either player can flip)
7. Teacher can change flip-back delay at any time via dropdown in the toolbar
   - settings:update event → server broadcasts settings:updated → all clients update
8. When all pairs are matched:
   - Server broadcasts game:completed
   - Congratulations screen shows on all clients with stats (total flips, time)
   - "Back to Dashboard" button for teacher, "Thanks for playing!" for student
```

### Flow 6: Teacher Edits a Game

```
1. Teacher clicks "Edit" on a game card in the dashboard
2. GET /api/games/:id → game editor pre-filled with existing data
3. Teacher modifies title, grid size, card pairs, or delay setting
4. Teacher clicks "Save" → PUT /api/games/:id → redirect to dashboard
```

---

## 9. UI & Design Guidelines

### Framework & Component Library

- **React 18+** with functional components and hooks
- **Material UI (MUI) v5+** as the component library
- **React Router v6** for client-side routing

### Page / Screen List

| Route | Page | Description |
|-------|------|-------------|
| `/` | Landing | Sign-in CTA, brief product description |
| `/dashboard` | Dashboard | Grid of saved games, "Create New Game" FAB, game type filter (future) |
| `/games/new` | Game Editor (Create) | Game type selector + type-specific editor form |
| `/games/:id/edit` | Game Editor (Edit) | Pre-filled editor for existing game |
| `/games/:id/session` | Game Session (Teacher View) | Waiting room → active game → completion |
| `/profile` | Profile Settings | Nickname editor, account info |
| `/join/:joinCode` | Join Game (Student) | Nickname entry → waiting room → active game → completion |
| `/unauthorized` | Unauthorized | Message for non-whitelisted Google accounts |

### Design Principles

1. **Classroom-friendly:** Large, tappable targets. High contrast. Readable at projector distance.
2. **Playful but not distracting:** Subtle animations for card flips and matches. Avoid visual clutter.
3. **Responsive:** Must work on teacher's laptop/desktop and student's tablet or phone.
4. **Accessible:** WCAG 2.1 AA compliance. All interactive elements keyboard-navigable. Cards must be distinguishable by content, not just color.

### Card Game Visual Design

- **Card grid:** CSS Grid, responsive sizing based on viewport and grid dimensions
- **Card flip animation:** CSS 3D transform (`rotateY(180deg)`) with 400ms transition
- **Card states:**
  - Face-down: solid color with subtle pattern or logo
  - Face-up: white background with content text centered
  - Matched: faded/semi-transparent, then animated to a "solved" area
- **Solved pile:** sidebar (desktop) or bottom bar (mobile) showing matched pairs
- **Teacher toolbar:** fixed top bar with flip-back delay dropdown, participant count, "End Game" button

### MUI Theme Customization

```typescript
const theme = createTheme({
  palette: {
    primary: { main: '#1565C0' },    // Royal blue — fits "King's Cards" branding
    secondary: { main: '#FF8F00' },   // Amber accent
    background: { default: '#F5F5F5' },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", sans-serif',
    h4: { fontWeight: 700 },
  },
  shape: { borderRadius: 12 },
  components: {
    MuiCard: {
      styleOverrides: {
        root: { borderRadius: 16 },
      },
    },
  },
});
```

---

## 10. Security Considerations

### Data Classification

| Data Type | Sensitivity | Protection |
|-----------|-------------|------------|
| Teacher email/name | PII (low risk) | Encrypted in transit, stored in managed DB |
| Student nickname | Not PII (self-chosen, ephemeral) | In-memory only during session |
| Game content | Low sensitivity | Standard DB protections |
| JWT tokens | Credential | httpOnly, Secure, SameSite cookies |

### Transport Security

- All traffic over HTTPS (enforced by Vercel and Fly.io)
- WebSocket connections over WSS
- HSTS headers enabled

### Authentication Security

- JWT in httpOnly cookies — not accessible to JavaScript (prevents XSS token theft)
- SameSite=Lax — prevents CSRF for state-changing requests from cross-origin contexts
- CSRF token not required for API-only backend with SameSite cookies (no form-based submissions)
- Google OAuth — no password storage or management

### Input Validation

- All API inputs validated with Zod schemas on the server
- Card content sanitized — strip HTML tags (DOMPurify on render if rendering user-generated content as HTML is ever needed)
- Nickname length limited (3-50 chars), alphanumeric + spaces only
- Game grid constrained: rows 2-6, cols 2-6, total must be even

### WebSocket Security

- Teacher socket connections authenticated via JWT (passed in handshake `auth` option, validated by middleware)
- Student socket connections validated: `joinCode` must correspond to an active session
- Rate limiting on socket events: max 10 `card:flip` events per second per connection (prevent abuse)
- Invalid events logged and connection terminated after repeated violations

### OWASP Top 10 — Relevant Mitigations

| Risk | Mitigation |
|------|------------|
| A01: Broken Access Control | JWT auth + ownership checks on all game CRUD. Students cannot access teacher endpoints. |
| A02: Cryptographic Failures | HTTPS everywhere. No sensitive data in JWTs beyond user ID. |
| A03: Injection | Parameterized queries via Drizzle ORM. Zod input validation. |
| A07: Auth Failures | Google OAuth (no custom password logic). JWT expiry. Whitelist-based access. |
| A09: Logging & Monitoring | Structured logging to Fly.io. Failed auth attempts logged. |

### Secrets Management

| Secret | Storage |
|--------|---------|
| Google OAuth client ID/secret | Fly.io secrets (`fly secrets set`) |
| JWT signing key | Fly.io secrets |
| Neon database URL | Fly.io secrets |
| Frontend env vars (Google client ID only) | Vercel environment variables |

### CORS Configuration

```typescript
const corsOptions = {
  origin: ['https://kingscards.app'],  // Only the frontend domain
  credentials: true,                    // Allow cookies
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
};
```

---

## 11. Work Delegation Framework

Since this is a solo developer project, the traditional role-based delegation is reframed as **implementation phases organized by concern**. Each phase is a focused sprint.

| Phase | Focus Area | Key Deliverables | Est. Duration |
|-------|-----------|------------------|---------------|
| 1 | **Project Setup** | Monorepo scaffold, TypeScript config, Vite + React hello world, Express hello world, Neon DB connection, Drizzle schema + initial migration, Fly.io + Vercel deploys working | 2-3 days |
| 2 | **Auth** | Google OAuth flow, JWT cookie issuance, `/api/auth/me`, whitelist check, `AuthContext` on frontend, protected routes | 2-3 days |
| 3 | **Game CRUD** | REST endpoints for games + card pairs, Zod validation, Dashboard page (list games), Game Editor page (create/edit), delete confirmation | 3-4 days |
| 4 | **Game Session + WebSocket** | Session creation endpoint, Socket.io setup, room joining logic, waiting room UI (teacher + student), join page, participant list sync | 3-4 days |
| 5 | **Card Game Engine** | Board shuffle, card flip logic, match detection, flip-back timer, game state management (in-memory), real-time broadcast, game completion | 4-5 days |
| 6 | **Game UI** | Card grid component, flip animation, solved pile, teacher toolbar (delay dropdown), congratulations screen, responsive layout | 3-4 days |
| 7 | **Polish & Hardening** | Error handling (API + socket), edge cases (disconnect/reconnect, stale sessions), loading states, empty states, input validation UX, accessibility pass | 2-3 days |
| 8 | **Deploy & Test** | Production environment config, CI/CD pipelines, manual E2E testing, bug fixes, domain setup | 2-3 days |

**Total estimated duration: 21-29 working days (~4-6 weeks)**

---

## 12. Milestones & Phasing

### MVP (Phases 1-6) — Target: 4 weeks

The minimum viable product that can be used in a real classroom:

- Teacher can sign in, create a memory card game, and start a session
- Student can join via link, enter a nickname, and play
- Cards flip, match, and sync in real-time
- Teacher can adjust flip-back delay during play
- Game ends with a congratulations screen

**MVP Definition of Done:** A teacher at a real school can project the game on their screen, share the link, and play a full memory card game with a student from start to finish without errors.

### Phase 2 — Enhancements (post-MVP, ~2-3 weeks)

- **Multi-student support:** Multiple students join the same session. Add turn-based mechanics or free-for-all mode.
- **Image card content:** Allow teachers to upload images for card pairs (add S3/R2 storage).
- **Game templates:** Pre-made game sets that teachers can clone and customize.
- **Session history:** Store completed session results for teacher review.
- **Error monitoring:** Integrate Sentry for production error tracking.

### Phase 3 — Platform Expansion (future)

- **New game types:** Extend the game type system. Example: matching quiz, flashcard drill, word scramble.
- **Classroom management:** Teacher creates a "class" and invites students by link. Students have persistent (but still anonymous) identity within a class.
- **Multiplayer scoring:** Competitive mode with points and leaderboard.
- **PWA support:** Installable web app with offline game editor.
- **Scaling:** Multi-machine Fly.io deployment with Redis adapter for Socket.io.

---

## 13. Open Questions & Risks

### Open Questions

| # | Question | Impact | Suggested Resolution |
|---|----------|--------|---------------------|
| 1 | Should there be turn-based enforcement in V1 (only one player can flip at a time), or free-for-all? | Gameplay experience | Start with free-for-all (simpler). Add turn mode as a teacher setting later. |
| 2 | What happens if the teacher closes the browser mid-game? | Session continuity | Mark session as `abandoned` after 60s of teacher disconnect. Show "Teacher has left" to student. |
| 3 | Should the shareable link use the session UUID or the short join code? | URL aesthetics, security | Use the short join code in the URL (`/join/A3X9B2`). It is human-friendly and sufficiently random for V1 scale. |
| 4 | Do card pairs need to support rich text or only plain text in V1? | Editor complexity | Plain text only in V1. Rich text / images in Phase 2. |
| 5 | How should stale sessions be cleaned up? | Database hygiene | Cron job or scheduled task: mark `waiting` sessions older than 24h as `abandoned`. Clean up in-memory state on server restart. |
| 6 | Max grid size? 6x6 = 36 cards = 18 pairs. Is that enough? | Game design | 6x6 is a good V1 max. Evaluate after teacher feedback. |

### Technical Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| **Fly.io machine sleeps on free tier** | High | Cold starts cause 2-5s delay on first connection | Use Fly.io `min_machines_running = 1` (costs ~$2/mo) to keep one machine warm. UptimeRobot pings also help. |
| **Neon cold start latency** | Medium | First DB query after idle period takes 1-3s | Neon autosuspend is configurable. Set to 300s (5 min). Auth endpoint warms the connection. |
| **WebSocket disconnections** | Medium | Student or teacher loses connection temporarily | Implement reconnection with state resync: on reconnect, server sends full `session:state`. Socket.io has built-in reconnection with exponential backoff. |
| **In-memory game state lost on server restart** | Medium | Active games are lost if server restarts during play | Acceptable for V1. Deploy during off-hours. Phase 2: persist game state to Redis or DB. |
| **Single Fly.io machine is a SPOF** | Low (V1 scale) | Server down = all games down | Acceptable for V1. Phase 3: multi-machine with Redis adapter. |
| **Google OAuth token / whitelist sync** | Low | Teacher removed from whitelist can still use valid JWT | JWT expires in 24h. For immediate revocation, add a check against whitelist on each `/api/auth/me` call. |

### Dependencies on Third Parties

| Dependency | Risk | Mitigation |
|------------|------|------------|
| Google OAuth | Google API outage prevents teacher sign-in | Low probability. No mitigation needed for V1. |
| Neon Postgres | Neon outage prevents game creation/loading | Low probability. Neon has 99.95% SLA. Game play (once started) uses in-memory state and is unaffected. |
| Fly.io | Fly.io outage takes down all real-time gameplay | Accept the risk for V1. Fly.io `iad` region is well-established. |
| Vercel | Vercel outage prevents frontend loading | SPA is cached at edge. Very low probability of total outage. |

---

*End of System Design Document*
