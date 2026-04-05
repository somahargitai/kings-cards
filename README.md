# King's Cards

An online multiplayer memory card game designed for classroom use. Teachers sign in with Google, build memory card games by defining word or image pairs, and share a join link with a student. The entire game — card flips, matches, and settings — synchronises in real time via WebSockets.

## What it does

- **Teachers** create and manage memory card games from a dashboard, start sessions, and share a short join code or link with a student.
- **Students** join anonymously — no account, no download. They enter a nickname and start playing.
- **Real-time sync**: card flips, matches, and teacher-controlled settings (flip-back delay) are broadcast instantly to all participants via Socket.io.

## Project structure

This is a TypeScript monorepo with three packages:

```
kings-card/
├── client/    # React 18 SPA (Vite + Material UI)
├── server/    # Express + Socket.io API server
└── shared/    # Shared TypeScript types (card states, WebSocket payloads)
```

For the full architecture, database schema, API reference, and WebSocket event protocol, see [SYSTEM_DESIGN.md](./SYSTEM_DESIGN.md).

---

## Prerequisites

| Requirement | Version / Notes |
|-------------|-----------------|
| Node.js | 20 or later |
| npm | 10 or later (ships with Node 20) |
| Google OAuth credentials | A Google Cloud project with OAuth 2.0 client ID and secret. Authorised redirect URI must include `http://localhost:3001/api/auth/google/callback` for local development. |
| Neon Postgres database | A free [Neon](https://neon.tech) project. Copy the connection string from the Neon console. |

To know more about setting up credentials, check out the [credentials setup guide](./docs/credentials-setup.md).

---

## Local development setup

### 1. Install dependencies

From the repository root (installs all three workspaces at once):

```bash
npm install
```

### 2. Configure the server environment

```bash
cp server/.env.example server/.env
```

Edit `server/.env` and fill in all required values. See [Configuration](#configuration) below for a description of each variable.

### 3. Run database migrations

```bash
npm run migrate --workspace=server
```

This uses Drizzle Kit to push the schema to your Neon database. Run this once on first setup and again after any schema change.

### 4. Seed the teacher whitelist

King's Cards uses a whitelist to restrict who can sign in as a teacher. Add at least one row to the `allowed_teachers` table with your Google account email before attempting to sign in:

```sql
INSERT INTO allowed_teachers (email) VALUES ('you@example.com');
```

You can run this directly in the Neon SQL console or via any Postgres client pointed at your `DATABASE_URL`.

### 5. Start the development servers

Run the client and server in separate terminal windows:

```bash
# Terminal 1 — API server (http://localhost:3001)
npm run dev:server

# Terminal 2 — React SPA (http://localhost:5173)
npm run dev:client
```

The Vite dev server proxies `/api` and `/socket.io` requests to `localhost:3001`, so no CORS configuration is needed during local development.

Open `http://localhost:5173` in your browser and sign in with a whitelisted Google account.

---

## Configuration

All server configuration is read from `server/.env`. The application will refuse to start if any required variable is missing.

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | — | Neon (or any Postgres) connection string, e.g. `postgresql://user:pass@host/db?sslmode=require` |
| `GOOGLE_CLIENT_ID` | Yes | — | OAuth 2.0 client ID from Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | Yes | — | OAuth 2.0 client secret from Google Cloud Console |
| `JWT_SECRET` | Yes | — | Long random string used to sign JWTs. Generate with `openssl rand -hex 32`. |
| `SESSION_SECRET` | Yes | — | Random string used for Passport session initialisation. Can match `JWT_SECRET` or be separate. |
| `JWT_EXPIRES_IN` | No | `24h` | Token lifetime. Accepts any value accepted by the `jsonwebtoken` library (e.g. `12h`, `7d`). |
| `FRONTEND_URL` | No | `http://localhost:5173` | Origin of the React SPA. Used for CORS and Socket.io origin validation. Set to your Vercel URL in production. |
| `PORT` | No | `3001` | Port the Express server listens on. |
| `NODE_ENV` | No | `development` | `development`, `production`, or `test`. |

The client has no `.env` file. In production, the Vite build reads `VITE_API_URL` if you need to point to a non-proxied backend — set this in Vercel's environment variable settings.

---

## Building for production

```bash
# Build the React SPA (outputs to client/dist/)
npm run build:client

# Build the server (outputs to server/dist/)
npm run build:server
```

The server Dockerfile in `server/Dockerfile` handles a multi-stage build for deployment to Fly.io. See [SYSTEM_DESIGN.md — Cloud Infrastructure](./SYSTEM_DESIGN.md#3-cloud-infrastructure--resources) for deployment details.

---

## Tech stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, Vite, Material UI 5, React Router 6, socket.io-client, axios |
| Backend | Node 20, Express 4, Socket.io 4, Passport.js (Google OAuth), Drizzle ORM |
| Database | Neon (serverless Postgres) |
| Auth | Google OAuth 2.0 + JWT in httpOnly cookie |
| Shared types | TypeScript — same types used by client, server, and WebSocket payloads |
| Deployment | Vercel (client), Fly.io (server), Neon (database) |

---

## Further reading

- [SYSTEM_DESIGN.md](./SYSTEM_DESIGN.md) — full architecture, database schema, REST API reference, WebSocket event protocol, security considerations, and deployment phasing
