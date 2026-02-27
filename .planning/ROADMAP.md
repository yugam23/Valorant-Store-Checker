# Roadmap

## Phase 1: Featured Content & UI Refinement ✓

_Focus on bringing the current store up to parity with the in-game experience._
_Completed: 2026-02-14_

- [x] **Plan 1.1: Bundle Integration**
  - Implement `getBundles` integration in `api/store/route.ts`.
  - Create `FeaturedBundle` and `BundleCard` components.
- [x] **Plan 1.2: Global Store Layout**
  - Refine the main `/store` page to include Bundles at the top, followed by Daily Shop and Night Market.

## Phase 2: Multi-Account Infrastructure ✓

_Allow power users to manage multiple store rotations._
_Completed: 2026-02-14_

- [x] **Plan 2.1: Multi-Account Session Logic**
  - Update `src/lib/session.ts` to support an array of account sessions.
  - Implement "Add Account" flow (keeping the current one active).
- [x] **Plan 2.2: Account Switcher Component**
  - Create a dropdown in the Navigation bar to switch between active PUUIDs.

## Phase 3: Inventory & Wishlist ✓

_Personalize the experience with collection tracking._
_Completed: 2026-02-14_

- [x] **Plan 3.1: Inventory Engine** (Wave 1)
  - Fetch owned weapon skins from Riot PD API (`/store/v1/entitlements/{puuid}/{itemTypeId}`).
  - Create `src/lib/riot-inventory.ts` with shard fallback and in-memory cache.
  - Create `/inventory` page and `InventoryGrid` with search and weapon-type filters.
- [x] **Plan 3.2: Wishlist Persistence** (Wave 2, depends on 3.1)
  - Add heart button to `StoreCard` for wishlist toggle.
  - Per-account wishlist via PUUID-keyed cookies.
  - Slide-out WishlistPanel in header with count badge.
  - Notify when wishlisted skin appears in daily store ("IN YOUR STORE!" badge).

## Phase 4: History & Polish ✓

_Long-term tracking and final refinements._
_Completed: 2026-02-15_

- [x] **Plan 4.1: Store History Engine** (Wave 1)
  - Dexie.js IndexedDB database with versioned schema and compound `[puuid+date]` index.
  - History types (`StoreRotation`, `HistoryStoreItem`, `HistoryStats`).
  - CRUD utilities: `logStoreRotation`, `getStoreHistory`, `getHistoryStats`, `pruneOldHistory`.
  - Fire-and-forget logging wired into store page on successful fetch.
- [x] **Plan 4.2: History UI & Polish** (Wave 2, depends on 4.1)
  - `/history` page with reactive `useLiveQuery` data binding from IndexedDB.
  - `HistoryStats` dashboard (rotations seen, unique skins, most offered, avg cost).
  - `HistoryCard` with date formatting, tier-colored item grid, staggered animations.
  - "History" navigation link in header.
  - Premium `premiumReveal` and `slideInRight` animations with `prefers-reduced-motion` accessibility.

---

## v1.1: Player Profile

_Milestone Goal: Add player profile page showing identity, cosmetics, and competitive standing._

## Phase 5: Profile Foundation ✓

_Completed: 2026-02-18_

**Goal:** Profile data fetching infrastructure is operational and cached.

Plans:
- [x] 05-01-PLAN.md — Session/auth country propagation, HENRIK_API_KEY env var, valorant-api card/title lookups
- [x] 05-02-PLAN.md — Riot loadout client, Henrik API client with caching, profile cache with multi-tier fallback

## Phase 6: Profile API Route ✓

_Completed: 2026-02-18_

**Goal:** Unified profile endpoint aggregates data from multiple sources with graceful degradation.

Plans:
- [x] 06-01-PLAN.md — Create /api/profile GET route and register in middleware PROTECTED_ROUTES

## Phase 7: Identity Display ✓

_Completed: 2026-02-19_

**Goal:** User can view their player identity with cosmetic customization on the profile page.

Plans:
- [x] 07-01-PLAN.md — API response extension with session fields, ProfilePageData type, middleware protection, header nav link
- [x] 07-02-PLAN.md — Profile page with PlayerCardBanner, IdentityInfo, loading/error/partial states

## Phase 8: Progression Display ✓

_Completed: 2026-02-24_

**Goal:** User can view their competitive standing and account progression on the profile page.

Plans:
- [x] 08-01-PLAN.md — Extend Henrik API types (HenrikMMRData, HenrikMMRHighestRank) and update profile-cache to populate peak rank fields
- [x] 08-02-PLAN.md — Build AccountLevelBadge, RankDisplay, and RRProgressBar components
- [x] 08-03-PLAN.md — Wire progression components into profile page with stagger animations and last-updated timestamp

---

## v1.2: Quality & Hardening

_Milestone Goal: Close every gap from the codebase audit. Zero tests → full test suite. File-based sessions → SQLite. 985-line auth monolith → 4 focused modules. Unsafe API casts → Zod validation._

## Phase 9: SQLite Session Store ✓

_Completed: 2026-02-25_

**Goal:** Replace the file-based `sessions.json` store with a `@libsql/client` SQLite database. Eliminates disk reads on every request and sets the foundation for auth integration tests.

**Requirements Covered:** SQLITE-01, SQLITE-02, SQLITE-03, SQLITE-04, SQLITE-05, SQLITE-06

Plans:
- [x] 09-01-PLAN.md — Install `@libsql/client`, add SESSION_DB_PATH to env.ts, create `src/lib/session-db.ts` singleton with schema init, expired-session cleanup, and sessions.json migration
- [x] 09-02-PLAN.md — Rewrite `session-store.ts` with `@libsql/client` async API; verify all accounts survive server restart

**Success Criteria:**
1. `@libsql/client` installed and importable — no native compile required
2. `src/lib/session-db.ts` exports `initSessionDb()` singleton with sessions table and expires_at index
3. `session-store.ts` uses `@libsql/client`; no `fs/promises` imports remain
4. Non-expired sessions from `sessions.json` migrated to SQLite; file renamed to `.migrated`
5. `SESSION_DB_PATH` env var controls DB path with `.session-data/sessions.db` fallback
6. Expired sessions cleaned on init

## Phase 10: Code Quality

**Goal:** Decompose `riot-auth.ts` (985 lines) into 4 focused modules. Unify all logging through the structured logger — zero raw `console.*` calls remaining in `src/lib/`.

**Dependencies:** Phase 9 (session store stable before touching auth layer)

**Requirements Covered:** QUAL-01, QUAL-02, QUAL-03, QUAL-04, QUAL-05, QUAL-06

Plans:
- [x] 10-01-PLAN.md — Extract `riot-cookies.ts` (pure cookie utilities)
- [x] 10-02-PLAN.md — Extract `riot-tokens.ts` (token/region functions + lookup table)
- [ ] 10-03-PLAN.md — Extract `riot-reauth.ts` (SSID re-auth pair); trim `riot-auth.ts` to credential/MFA auth only
- [ ] 10-04-PLAN.md — Replace all `console.*` calls in `src/lib/` with structured logger; fix `browser-auth.ts`

**Success Criteria:**
1. `src/lib/riot-cookies.ts` exports `mergeCookies`, `extractNamedCookies`, `buildEssentialCookieString`, `captureSetCookies`
2. `src/lib/riot-tokens.ts` exports `extractTokensFromUri`, `getEntitlementsToken`, `getUserInfo`, `determineRegion`, `generateTraceParent`, `randomHex`, `riotHeaders`
3. `src/lib/riot-reauth.ts` exports `refreshTokensWithCookies`, `completeRefresh`; SSID preservation behavior unchanged
4. `riot-auth.ts` retains only `authenticateRiotAccount`, `submitMfa`, `completeAuthWithUrl`, `getRiotLoginUrl`; under 350 lines
5. All existing callers continue to work without modification
6. `grep -r "console\." src/lib/ --include="*.ts"` returns zero results

## Phase 11: Zod Validation ✓

_Completed: 2026-02-26_

**Goal:** Add runtime validation for all external API responses. Replace unsafe `as` type casts with Zod `.safeParse()` calls that log failures and degrade gracefully.

**Dependencies:** Phase 10 (schemas placed in correct decomposed modules)

**Requirements Covered:** ZOD-01, ZOD-02, ZOD-03, ZOD-04, ZOD-05, ZOD-06

Plans:
- [x] 11-01-PLAN.md — Install Zod v3, create `src/lib/schemas/` with parse.ts, session.ts, riot-auth.ts, henrik.ts; apply `parseWithLog()` in session-store.ts, riot-tokens.ts, riot-auth.ts, henrik-api.ts
- [x] 11-02-PLAN.md — Create storefront.ts schema, apply in riot-store.ts with store page null guard; replace auth/route.ts manual body checks with `z.discriminatedUnion`

**Success Criteria:**
1. `src/lib/schemas/parse.ts` exports `parseWithLog<T>()` — uses `.safeParse()`, logs failures at warn level, returns null, never throws
2. `StoredSessionSchema` applied on all `getSessionFromStore` reads; `.passthrough()` allows extra fields
3. Auth response schemas applied in `riot-tokens.ts`; auth degrades gracefully on schema failure
4. Henrik schemas applied in `henrik-api.ts`; profile shows partial data instead of crashing
5. `RiotStorefrontSchema` applied (top-level, `.passthrough()` on nested); store degrades gracefully
6. `/api/auth/route.ts` uses `z.discriminatedUnion` for request body; invalid requests return 400

## Phase 12: Test Suite ✓

_Completed: 2026-02-27_

**Goal:** Add Vitest with full unit and integration coverage for auth, session, and schemas. All critical paths protected against regression.

**Dependencies:** Phase 11 (Zod schemas enable meaningful assertions; decomposed modules enable isolated unit tests; SQLite enables in-memory DB for session tests)

**Requirements Covered:** TEST-01, TEST-02, TEST-03, TEST-04, TEST-05, TEST-06, TEST-07, TEST-08

Plans:
- [x] 12-01-PLAN.md — Install Vitest and testing dependencies; write `vitest.config.ts` and `vitest.setup.ts`; write unit tests for `riot-cookies.ts` and `riot-tokens.ts`
- [x] 12-02-PLAN.md — Write MSW integration tests for auth flow; session-store tests with in-memory SQLite; session.ts branching logic tests; Zod schema fixture tests

**Success Criteria:**
1. `vitest.config.ts` with `resolve.alias`, `environment: 'node'`, `setupFiles`, `env: { LOG_LEVEL: 'warn' }`
2. `vitest.setup.ts` mocks `next/headers`, `next/navigation`, and `@/lib/env`
3. Cookie utility unit tests pass; token unit tests pass
4. MSW auth integration tests pass without real network calls
5. Session store tests pass with in-memory SQLite
6. Zod schema tests pass with valid/extra-fields/missing-required fixtures
7. `npm test` exits 0; `npm run test:coverage` generates coverage report

---

## Progress

| Phase | Status | Completion |
|-------|--------|------------|
| 1 - Featured Content & UI | Complete | 2026-02-14 |
| 2 - Multi-Account | Complete | 2026-02-14 |
| 3 - Inventory & Wishlist | Complete | 2026-02-14 |
| 4 - History & Polish | Complete | 2026-02-15 |
| 5 - Profile Foundation | Complete | 2026-02-18 |
| 6 - Profile API Route | Complete | 2026-02-18 |
| 7 - Identity Display | Complete | 2026-02-19 |
| 8 - Progression Display | Complete | 2026-02-24 |
| 9 - SQLite Session Store | Complete | 2026-02-25 |
| 10 - Code Quality | Complete | 2026-02-25 |
| 11 - Zod Validation | Complete | 2026-02-26 |
| 12 - Test Suite | Complete | 2026-02-27 |

---

_Last Updated: 2026-02-27 (Phase 12 complete; v1.2 milestone done)_
