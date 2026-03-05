<p align="center">
  <img src="public/icons/Valorant_Store_Checker.webp" width="750" alt="Valorant Store Checker">
</p>

<h1 align="center">Valorant Store Checker</h1>

<p align="center">
  Check your daily Valorant store, Night Market, and bundles — without launching the game.
</p>

<p align="center">
  <a href="https://github.com/yugam23/Valorant-Store-Checker/actions/workflows/ci.yml">
    <img src="https://github.com/yugam23/Valorant-Store-Checker/actions/workflows/ci.yml/badge.svg" alt="CI">
  </a>
  <a href="https://vercel.com/new/clone?repository-url=https://github.com/yugam23/Valorant-Store-Checker">
    <img src="https://vercel.com/button" alt="Deploy with Vercel">
  </a>
</p>

---

## Overview

Valorant Store Checker is a production-grade, security-hardened Next.js application that authenticates with Riot's OAuth flow and surfaces your personalized in-game store. It supports multi-step authentication (including MFA and browser-based fallback), multi-account switching, store rotation history, wishlists, inventory browsing, and full profile/rank display — all without ever opening the Valorant client.

Sessions are encrypted at rest using AES-256-GCM, tokens never leave the server, and all Riot cookies are stored server-side only. The project ships with 101 Vitest tests and is designed for self-hosting on Vercel.

---

## Features

| Feature | Description |
|---|---|
| **Daily Store** | View all 4 daily rotating skins with VP pricing and tier icons |
| **Night Market** | Check your personalized Night Market discounts when active |
| **Bundles** | Browse current featured bundles with full item breakdowns and pricing |
| **Wallet** | See your current VP and Radianite Point balances |
| **Store History** | Browse past store rotations indexed by date, with repeat and price statistics |
| **Wishlist** | Bookmark skins you want; get highlighted when they appear in your store |
| **Inventory** | View all cosmetics you currently own (skins, sprays, cards, etc.) |
| **Profile & Rank** | Display your Riot ID, account level, current rank, and RR progress |
| **Multi-Account** | Link and switch between multiple Riot accounts in one session |
| **MFA Support** | Full multi-factor authentication flow for 2FA-protected accounts |
| **Secure Auth** | Riot OAuth flow with browser-based Playwright fallback |

---

## Tech Stack

| Category | Technology |
|---|---|
| **Framework** | [Next.js 16](https://nextjs.org) (App Router, Server Components) |
| **Language** | [TypeScript 5](https://www.typescriptlang.org) (strict + `noUncheckedIndexedAccess`) |
| **Styling** | [Tailwind CSS v4](https://tailwindcss.com) |
| **UI Primitives** | [Radix UI](https://www.radix-ui.com), [Lucide Icons](https://lucide.dev), [CVA](https://cva.style) |
| **Validation** | [Zod](https://zod.dev) |
| **Server DB** | [LibSQL / Turso](https://turso.tech) (SQLite) |
| **Client DB** | [Dexie.js](https://dexie.org) (IndexedDB — store history) |
| **Auth Fallback** | [Playwright](https://playwright.dev) (headless browser cookie extraction) |
| **Testing** | [Vitest](https://vitest.dev) + [MSW v2](https://mswjs.io) (101 tests) |

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Browser (Client)                  │
│  React 19 · Tailwind v4 · Dexie (IndexedDB history) │
└──────────────────────┬──────────────────────────────┘
                       │ HTTP (HTTP-only cookie JWT)
┌──────────────────────▼──────────────────────────────┐
│               Next.js App Router (Server)            │
│                                                      │
│  RSCs + API Routes                                   │
│  ├── /api/auth       ← multi-step Riot OAuth         │
│  ├── /api/profile    ← rank + identity               │
│  ├── /api/inventory  ← owned cosmetics               │
│  ├── /api/wishlist   ← bookmark management           │
│  └── /api/accounts   ← multi-account switching       │
│                                                      │
│  Session Layer                                       │
│  ├── session-store.ts   (encrypt-on-write / decrypt) │
│  ├── session-crypto.ts  (AES-256-GCM)                │
│  └── session-db.ts      (LibSQL + hourly cleanup)    │
│                                                      │
│  Riot Module                                         │
│  ├── riot-auth.ts       (OAuth + MFA + reauth)       │
│  ├── riot-store.ts      (daily / night market / bundles) │
│  ├── riot-tokens.ts     (entitlements extraction)    │
│  └── riot-inventory.ts  (cosmetics)                  │
└──────────────────────┬──────────────────────────────┘
                       │
         ┌─────────────┴──────────────┐
         ▼                            ▼
  LibSQL / Turso               Riot Servers
  (encrypted sessions)         (auth + store APIs)
```

**Key patterns:**
- **Reference-token sessions** — JWT in cookie carries only a session ID; all data stays in SQLite
- **RSC deduplication** — `React.cache()` wraps `getSession()` to deduplicate DB reads per render pass
- **withSession HOF** — all protected API routes wrapped with `withSession(handler)` for zero-boilerplate auth
- **FIFO in-memory cache** — capped at 10 entries per cache (profile, store, inventory) to prevent unbounded memory growth
- **Section-level error boundaries** — each store section fails independently; the rest of the page renders

---

## Environment Variables

### Required

| Variable | Description |
|---|---|
| `SESSION_SECRET` | Secret for signing session JWTs. Min 32 chars. Generate: `openssl rand -base64 32` |

### Recommended

| Variable | Description |
|---|---|
| `ENCRYPTION_KEY` | AES-256-GCM key for encrypting Riot cookies at rest. **Must be 64 hex chars (32 bytes).** Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `HENRIK_API_KEY` | [HenrikDev API](https://docs.henrikdev.xyz) key for rank and level data. The app degrades gracefully without it. |

### Database (Production)

| Variable | Description |
|---|---|
| `TURSO_DATABASE_URL` | LibSQL connection URL from [Turso](https://turso.tech) (e.g. `libsql://...`) |
| `TURSO_AUTH_TOKEN` | Turso auth token for the above database |
| `SESSION_DB_PATH` | Override local SQLite path (default: `.session-data/sessions.db`) |

> **Important:** Without `ENCRYPTION_KEY`, Riot session cookies are stored in plaintext in the database. Setting this variable is strongly recommended for any deployment accessible to others.

---

## Deployment

### Vercel (Recommended)

1. Click **Deploy with Vercel** above, or import the repo at [vercel.com/new](https://vercel.com/new).
2. Add the following environment variables in the Vercel project settings:

   - `SESSION_SECRET` ← required
   - `ENCRYPTION_KEY` ← strongly recommended
   - `HENRIK_API_KEY` ← optional (rank data)
   - `TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN` ← for persistent sessions across deployments

3. Click **Deploy**.

> Every push to `main` triggers an automatic redeployment.

### Turso Database (Optional but Recommended)

Without a persistent Turso database, sessions are stored in a local SQLite file that is ephemeral on Vercel (wiped on each deployment). To persist sessions:

1. Create a free database at [turso.tech](https://turso.tech):
   ```bash
   turso db create valorant-store-checker
   turso db tokens create valorant-store-checker
   ```
2. Add `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` to your Vercel environment variables.

---

## Local Development

### Prerequisites

- Node.js 20+
- npm

### Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/yugam23/Valorant-Store-Checker.git
   cd Valorant-Store-Checker
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Create `.env.local`:**
   ```env
   SESSION_SECRET=your-dev-secret-min-32-chars-long
   ENCRYPTION_KEY=your-64-char-hex-key-here
   HENRIK_API_KEY=your-henrikdev-api-key
   ```

4. **Start the development server:**
   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000).

### Running Tests

```bash
npm test              # run all tests
npm run test:coverage # run with coverage report
```

The test suite uses Vitest + MSW v2 for API mocking. Coverage thresholds are enforced (statements 18%, branches 11%, functions 16%, lines 18%).

---

## Project Structure

```
src/
├── app/
│   ├── page.tsx              # Home / landing
│   ├── login/                # Auth flow (credential entry + MFA)
│   ├── store/                # Daily store, Night Market, bundles (protected)
│   ├── profile/              # Rank, level, identity (protected)
│   ├── inventory/            # Owned cosmetics (protected)
│   ├── history/              # Store rotation history (protected)
│   └── api/
│       ├── auth/             # Multi-step Riot OAuth dispatcher
│       ├── profile/          # Identity + rank
│       ├── inventory/        # Cosmetics
│       ├── wishlist/         # Bookmark management
│       └── accounts/         # Multi-account list + switch
├── components/
│   ├── store/                # StoreCard, StoreGrid, DailyStore, Bundle, NightMarket, Wallet
│   ├── profile/              # PlayerCardBanner, RankDisplay, RRProgressBar, AccountLevelBadge
│   ├── layout/               # Header, MobileNav, AccountSwitcher
│   └── ui/                   # Button, LoadingSkeleton, SectionErrorBoundary
└── lib/
    ├── auth-handlers/        # credentials, mfa, url, cookie, browser, shared
    ├── schemas/              # Zod schemas (session, riot-auth, storefront, henrik)
    ├── __tests__/            # 101 Vitest tests across 8 files
    ├── session.ts            # getCachedSession (RSC-safe)
    ├── session-store.ts      # Transparent encrypt/decrypt layer
    ├── session-crypto.ts     # AES-256-GCM primitives
    ├── session-db.ts         # LibSQL client + migrations
    ├── api-validate.ts       # parseBody<T> + withSession HOF
    ├── riot-auth.ts          # Riot OAuth + MFA + SSID refresh
    ├── riot-store.ts         # Storefront API
    ├── riot-tokens.ts        # Token + entitlements extraction
    ├── riot-inventory.ts     # Owned cosmetics
    └── valorant-api.ts       # HenrikDev integration (rank, skins metadata)
```

---

## Security

This project is designed with security as a first-class concern:

- **HTTP-only cookies** — session tokens are never accessible to JavaScript
- **Server-side token storage** — Riot access tokens and cookies never reach the client
- **AES-256-GCM encryption** — all Riot cookies are encrypted at rest in the database
- **Reference-token sessions** — JWTs contain only a session ID, not the session payload
- **Zod input validation** — all API routes reject malformed requests early with 400 responses
- **CSP headers** — strict Content Security Policy with no inline scripts in production
- **HSTS, X-Frame-Options, Referrer-Policy, Permissions-Policy** — full security header suite
- **Automatic token refresh** — SSID-based refresh at 55 minutes; sessions invalidated at 65 minutes
- **Session cleanup** — expired sessions purged from the database hourly

> **Disclaimer:** This project is not affiliated with Riot Games. Usage is subject to Riot's Terms of Service. Credentials are only used to authenticate directly with Riot's servers — they are never stored or logged.

---

## License

This project is open source. See [LICENSE](LICENSE) for details.
