# Telegram Teaching Bot System

A full-stack system with a Telegram bot for manual payment enrollment and a Next.js admin panel for managing payments, levels, and protected video content.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        User Flow                            │
│                                                             │
│  Telegram Bot ──► /levels ──► Select Level ──► Upload       │
│                                                Receipt      │
│                                                  │          │
│                                                  ▼          │
│                              Admin Panel (Next.js)          │
│                              ├── View receipt image         │
│                              ├── Approve / Reject           │
│                              └── Bot notifies user          │
│                                                  │          │
│                                                  ▼          │
│                              User gets /watch/<levelId>     │
│                              ├── Telegram Login Widget      │
│                              ├── JWT token issued           │
│                              └── Protected video player     │
└─────────────────────────────────────────────────────────────┘
```

---

## Project Structure

```
.
├── prisma/
│   └── schema.prisma          # Shared DB schema
├── bot/                       # GrammY Telegram bot (Node.js)
│   ├── src/
│   │   ├── index.ts           # Bot entry point
│   │   ├── lib/
│   │   │   ├── prisma.ts      # DB client singleton
│   │   │   └── session.ts     # Session type definition
│   │   ├── middleware/
│   │   │   └── userSync.ts    # Auto-upsert users to DB
│   │   └── handlers/
│   │       ├── start.ts       # /start, /help
│   │       ├── levels.ts      # /levels, /mylevels
│   │       └── payment.ts     # Enrollment + receipt upload flow
│   └── package.json
└── admin-panel/               # Next.js 14 App Router
    └── src/
        ├── app/
        │   ├── admin/
        │   │   ├── payments/  # Pending payment review UI
        │   │   ├── levels/    # Content management UI
        │   │   └── users/     # User overview
        │   ├── watch/[levelId]/  # Protected video player
        │   └── api/
        │       ├── admin/
        │       │   ├── payments/[id]/approve/  ← KEY ROUTE
        │       │   ├── payments/[id]/reject/
        │       │   ├── receipt-proxy/          ← Telegram image proxy
        │       │   ├── levels/[id]/videos/
        │       │   └── login/
        │       ├── auth/telegram/              ← Widget verification
        │       └── videos/[levelId]/           ← Token-gated video list
        ├── components/
        │   ├── AdminNav.tsx
        │   ├── PaymentCard.tsx
        │   └── LevelManager.tsx
        └── lib/
            ├── prisma.ts
            ├── telegram.ts    # sendMessage, getFile, verifyAuth
            ├── videoToken.ts  # JWT sign/verify
            └── auth.ts        # Admin cookie auth
```

---

## Quick Start

### 1. Prerequisites

- Node.js 20+
- PostgreSQL database
- A Telegram bot token (from [@BotFather](https://t.me/BotFather))

### 2. Database Setup

```bash
# Copy and fill in your DATABASE_URL
cp .env.example .env

# Install Prisma CLI
npm install

# Run migrations (creates all tables)
npx prisma migrate dev --schema=prisma/schema.prisma --name init

# Generate Prisma client
npx prisma generate --schema=prisma/schema.prisma
```

### 3. Bot Setup

```bash
cd bot
cp .env.example .env
# Fill in BOT_TOKEN and DATABASE_URL

npm install

# Copy the generated Prisma client
# (or symlink prisma/ into bot/ — see note below)

npm run dev
```

> **Note on Prisma in monorepo:** Both `bot/` and `admin-panel/` need access to the Prisma client. The simplest approach is to copy `prisma/schema.prisma` into each sub-project and run `prisma generate` there, or use a shared `node_modules` at the root.

### 4. Admin Panel Setup

```bash
cd admin-panel
cp .env.example .env
# Fill in all variables

npm install
npm run dev
# Open http://localhost:3000
```

### 5. Generate a secure VIDEO_TOKEN_SECRET

```bash
# On Linux/Mac:
openssl rand -hex 32

# On Windows PowerShell:
[System.Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
```

---

## Key API Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/api/admin/payments` | GET | List payments by status |
| `/api/admin/payments/[id]/approve` | POST | **Approve + notify user** |
| `/api/admin/payments/[id]/reject` | POST | Reject with optional note |
| `/api/admin/receipt-proxy` | GET | Proxy Telegram receipt image |
| `/api/admin/levels` | GET/POST | List/create levels |
| `/api/admin/levels/[id]/videos` | POST/DELETE | Manage videos |
| `/api/auth/telegram` | POST | Verify Telegram Login Widget |
| `/api/videos/[levelId]` | GET | Token-gated video list |
| `/api/admin/login` | POST/DELETE | Admin session |

---

## Video Protection Flow

```
1. User clicks /watch/<levelId> link from bot
2. Page shows Telegram Login Widget (no bypass possible)
3. User clicks "Login with Telegram" → Telegram sends signed auth data
4. POST /api/auth/telegram verifies:
   a. HMAC signature of auth data (using bot token as secret)
   b. auth_date is < 24 hours old
   c. UserLevel record exists in DB for this user + level
5. If valid → returns a 2-hour JWT (VIDEO_TOKEN_SECRET signed)
6. Client fetches GET /api/videos/<levelId>?token=<jwt>
7. Server verifies JWT, returns embed URLs
8. Videos render in iframe (Cloudflare Stream / Bunny.net)
```

**Why this is secure:**
- The JWT is short-lived (2h) and server-signed
- Telegram auth hash is cryptographically verified server-side
- Raw video IDs are never exposed to the browser
- Even if someone shares the `/watch` URL, they must authenticate as the paying user

---

## Bot Commands

| Command | Description |
|---------|-------------|
| `/start` | Welcome message |
| `/levels` | Browse available levels with prices |
| `/mylevels` | See enrolled levels + video links |

All bot messages use `protect_content: true` to prevent forwarding/saving.

---

## Deployment Notes

- **Bot:** Deploy to any Node.js host (Railway, Fly.io, VPS). Use long-polling (default) or switch to webhooks for production.
- **Admin Panel:** Deploy to Vercel (recommended for Next.js) or any Node.js host.
- **Database:** Use Supabase, Neon, or Railway PostgreSQL.
- **Sessions (Bot):** The default in-memory session resets on restart. For production, use `@grammyjs/storage-redis` or a DB-backed session store.

---

## Environment Variables Reference

| Variable | Where | Description |
|----------|-------|-------------|
| `DATABASE_URL` | Both | PostgreSQL connection string |
| `BOT_TOKEN` | Both | Telegram bot token |
| `NEXT_PUBLIC_BOT_USERNAME` | Admin panel | Bot username (without @) |
| `VIDEO_TOKEN_SECRET` | Admin panel | 32-byte hex secret for JWT |
| `ADMIN_SECRET` | Admin panel | Admin dashboard password |
| `NEXT_PUBLIC_ADMIN_PANEL_URL` | Bot | Full URL of admin panel (for video links) |
| `CLOUDFLARE_ACCOUNT_ID` | Admin panel | Cloudflare Stream account |
| `BUNNY_LIBRARY_ID` | Admin panel | Bunny.net library ID |
#   t e a c h i n g - b o t  
 