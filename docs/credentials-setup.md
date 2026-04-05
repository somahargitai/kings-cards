# Credentials setup

This guide explains how to obtain every secret required in `server/.env`.

---

## 1. Neon database (`DATABASE_URL`)

1. Sign up at [neon.tech](https://neon.tech) and create a new project.
2. In the Neon console, open your project and go to **Connection Details**.
3. Copy the connection string — it looks like:

   ```bash
   postgresql://user:password@host/dbname?sslmode=require
   ```

4. Paste it as `DATABASE_URL` in `server/.env`.

> You do not need to run `npx neonctl init`. Pasting the connection string is sufficient.

---

## 2. Google OAuth (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`)

1. Go to [console.cloud.google.com](https://console.cloud.google.com).
2. Click the project picker at the top → **New Project**.
   - Under **Organization**, select **No organization**.
   - Give the project a name and click **Create**.
3. In the left sidebar go to **APIs & Services → OAuth consent screen**.
   - User type: **External**.
   - Fill in the app name and your email, then save.
4. Go to **APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID**.
   - Application type: **Web application**.
   - Under **Authorised redirect URIs**, add:

     ```bash
     http://localhost:3001/api/auth/google/callback
     ```

   - Click **Create**.
5. Copy the **Client ID** and **Client Secret** from the dialog into `server/.env`.

---

## 3. JWT secret (`JWT_SECRET`)

Generate a cryptographically random 32-byte hex string:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Paste the output as `JWT_SECRET`.

---

## 4. Session secret (`SESSION_SECRET`)

Generate a second random string the same way:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Paste the output as `SESSION_SECRET`. It can be a different value from `JWT_SECRET`.

---

## 5. Remaining variables

These have sensible defaults for local development and do not need to be changed:

| Variable | Local value |
|----------|-------------|
| `FRONTEND_URL` | `http://localhost:5173` |
| `PORT` | `3001` |
| `NODE_ENV` | `development` |
| `JWT_EXPIRES_IN` | `24h` |
