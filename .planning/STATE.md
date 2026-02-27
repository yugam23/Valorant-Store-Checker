# Project State

**Project:** Valorant Store Checker
**Milestone:** v1.2 Quality & Hardening
**Last updated:** 2026-02-27

---

## Current Position

**Phase:** 12 — Test Suite (In Progress)
**Current Plan:** 02 (complete)
**Status:** Phase 12 in progress — 2 of N plans done

```
Progress: [████████████████████████░] ~75% of v1.2 (Phases 9-12.01 done)

v1.0 Phases (Complete):
[████] Phase 1: Featured Content & UI ✓
[████] Phase 2: Multi-Account Infrastructure ✓
[████] Phase 3: Inventory & Wishlist ✓
[████] Phase 4: History & Polish ✓

v1.1 Phases (Player Profile — Complete):
[████] Phase 5: Profile Foundation ✓
[████] Phase 6: Profile API Route ✓
[████] Phase 7: Identity Display ✓
[████] Phase 8: Progression Display ✓

v1.2 Phases (Quality & Hardening):
[████] Phase 9:  SQLite Session Store ✓
[████] Phase 10: Code Quality ✓
[████] Phase 11: Zod Validation ✓
[█░░░] Phase 12: Test Suite (Plan 01 done)
```

---

## Completed Work

### Phase 9: SQLite Session Store (Complete — 2026-02-25)

| Plan | Name | Commits |
|------|------|---------|
| 09-01 | @libsql/client install, session-db.ts singleton, schema + migration | — |
| 09-02 | session-store.ts rewrite with @libsql/client async API | — |

### Phase 10: Code Quality (Complete — 2026-02-25)

| Plan | Name | Status | Commits |
|------|------|--------|---------|
| 10-01 | Cookie and Token Module Extraction | Complete | fecdc4c, 0bf594d |
| 10-02 | Structured Logger Migration (src/lib/) | Complete | 816f185, 57c30c7 |
| 10-03 | riot-reauth.ts extraction + riot-auth.ts trim | Complete | d2ca45b, 08932c7 |
| 10-04 | Caller import updates (session.ts, riot-store.ts, api/auth/route.ts) | Complete (no-op — verified by plan 03) | — |

### Phase 11: Zod Validation (Complete — 2026-02-26)

| Plan | Name | Status | Commits |
|------|------|--------|---------|
| 11-01 | Zod install + schema infrastructure + call-site validation | Complete | e9376e5, 655f352 |
| 11-02 | Storefront schema + auth route discriminated union | Complete | 2e59272, e723f7f |

### Phase 12: Test Suite (In Progress — 2026-02-27)

| Plan | Name | Status | Commits |
|------|------|--------|---------|
| 12-01 | Vitest install + riot-cookies + riot-tokens unit tests | Complete | 66ca48d, a7b8282 |
| 12-02 | MSW auth integration tests, session-store, branching, and Zod schema tests | Complete | d3e9499, 068a933 |

---

## Key Decisions

| Decision | Rationale | Date |
|----------|-----------|------|
| Henrik API for level/rank | Riot doesn't expose via official API; Henrik is community standard | 2026-02-15 |
| Player card via `/playerloadout` | Entitlements returns owned items, not equipped | 2026-02-15 |
| Country from session persistence | Available at auth time via userInfo.country | 2026-02-15 |
| HTTP 200 always from /api/profile | Client reads partial/fromCache flags; HTTP status not used for data quality | 2026-02-18 |
| @libsql/client over better-sqlite3 | No Windows C++ Build Tools installed; libsql ships prebuilt binaries | 2026-02-25 |
| session-db.ts (not db.ts) | db.ts is Dexie/IndexedDB for client-side store history — must not be touched | 2026-02-25 |
| initSessionDb() promise pattern | @libsql/client is async; promise cached after first call for zero-cost re-calls | 2026-02-25 |
| Types stay in riot-auth.ts for Phase 10 | RiotSessionCookies and UserInfo imported from riot-auth.ts to avoid cascading caller changes; relocation deferred | 2026-02-25 |
| Verbatim copy + export pattern for extraction | Functions copied exactly from riot-auth.ts with only export keyword added; no behavior changes in plans 01-02 | 2026-02-25 |
| riot-auth.ts unchanged in Plan 01 | Removal of duplicated functions is Plan 03's responsibility | 2026-02-25 |
| browser-auth.ts QUAL-06 confirmed no-op | browser-auth.ts was already fully compliant with createLogger before plan 02 ran | 2026-02-25 |
| 10-03: Caller imports updated as part of task 2 | session.ts/riot-store.ts/auth/route.ts referenced moved exports; updating was required for TypeScript to compile (Rule 3 deviation) | 2026-02-25 |
| 10-03: riot-auth.ts at 470 lines not 350 | Plan estimate miscalculated; do-not-change-logic constraint takes precedence over line count target | 2026-02-25 |
| 10-04: No-op plan — all work pre-completed by plan 10-03 | Caller import updates committed in 08932c7 as blocking fix; plan 04 verification-only with zero source changes | 2026-02-25 |
| 11-01: Zod v3 not v4 | Plan explicitly requires ^3.24.2 for API stability | 2026-02-26 |
| 11-01: .passthrough() on all external-data schemas | Riot/Henrik may add fields; stripping unknown keys would break downstream consumers silently | 2026-02-26 |
| 11-01: AuthResponseSchema intentionally loose (type + passthrough) | Auth response can be response/multifactor/error/auth; type is the only guaranteed field across all variants | 2026-02-26 |
| 11-01: as UserInfo|null and as SessionData|null casts retained | .passthrough() widens inferred type vs interface; cast is safe since validation guarantees required fields present | 2026-02-26 |
| 11-02: RiotStorefrontSchema uses .passthrough() on all nested objects | Bundle internals change frequently; enforcing individual fields adds fragility with no benefit | 2026-02-26 |
| 11-02: BonusStore .optional() in schema | Night Market is a time-limited event, frequently inactive | 2026-02-26 |
| 11-02: AuthBodySchema with z.discriminatedUnion replaces LoginRequestBody | Provides TypeScript narrowing per variant; malformed JSON returns 400 not 500 | 2026-02-26 |
| 12-01: environment: node (not jsdom) | All tested code is server-side; no DOM needed | 2026-02-27 |
| 12-01: include scoped to __tests__ dirs | Prevents vitest from scanning React component files | 2026-02-27 |
| 12-01: Global env mock in vitest.setup.ts | env.ts throws at import time without SESSION_SECRET; global mock prevents that for all test files | 2026-02-27 |
| 12-01: makeUserInfo fixture factory | Factory function with spread overrides is cleaner than inline objects for per-test field customization | 2026-02-27 |
| 12-02: MSW v2 HttpResponse constructor for redirects | HttpResponse.json() shorthand doesn't support status overrides; new HttpResponse(null, {status, headers}) needed for 303 responses | 2026-02-27 |
| 12-02: testClient let ref + beforeEach reassignment | vi.mock factory captures testClient by reference; beforeEach creates fresh :memory: client so each test has isolated DB state | 2026-02-27 |
| 12-02: 55min/65min thresholds tested via createdAt offsets | makeSession({ createdAt: Date.now() - N * 60 * 1000 }) precisely triggers TOKEN_EXPIRY_THRESHOLD and TOKEN_HARD_EXPIRY branches | 2026-02-27 |

---

## Phase 12 Current State

**78 tests passing across 6 test files. MSW integration, in-memory SQLite, branching logic, and all Zod schemas covered.**
- `vitest.config.ts` — node environment, @ alias, setupFiles, LOG_LEVEL=warn
- `vitest.setup.ts` — global mocks for next/headers, next/navigation, @/lib/env
- `src/lib/__tests__/riot-cookies.test.ts` — 20 tests, riot-cookies.ts at 100% coverage
- `src/lib/__tests__/riot-tokens.test.ts` — 19 tests, extractTokensFromUri + determineRegion covered
- `src/lib/__tests__/riot-auth.test.ts` — 5 MSW integration tests for authenticateRiotAccount and refreshTokensWithCookies
- `src/lib/__tests__/session-store.test.ts` — 5 tests with in-memory SQLite (save/get/TTL/delete/cleanup)
- `src/lib/__tests__/session.test.ts` — 5 tests for getSessionWithRefresh branching (fresh/56min/66min thresholds)
- `src/lib/__tests__/schemas.test.ts` — 24 schema fixture tests; lib/schemas/ at 100% coverage
- `npm test` exits 0; `npm run test:coverage` generates v8 coverage report

---

## Known Blockers

**None.** Phase 12 Plans 01 and 02 complete. Next: Phase 12 Plan 03 if applicable, or phase completion.

---

## Session Continuity

**If resuming this project:**

1. **Next action:** Phase 12 Plan 03 (if any) — or phase completion check.

2. **Phase 12 plan ordering:**
   - Plan 01 complete — test infrastructure + riot-cookies/riot-tokens tests done
   - Plan 02 complete — MSW auth integration tests, session-store tests, session branching tests, Zod schema tests

3. **Reference files:**
   - `.planning/ROADMAP.md` — Full phase overview with success criteria
   - `.planning/REQUIREMENTS.md` — 26 requirements (SQLITE ✓, QUAL ✓, ZOD ✓, TEST in progress)
   - `.planning/phases/12-test-suite/12-01-SUMMARY.md` — Plan 01 summary
   - `.planning/phases/12-test-suite/12-02-SUMMARY.md` — Plan 02 summary

4. **Current branch:** main

---

## Performance Metrics

| Phase | Plan | Duration | Tasks | Files | Completed |
|-------|------|----------|-------|-------|-----------|
| 09 | 01 | — | 2 | 3 | 2026-02-25 |
| 09 | 02 | — | 2 | 1 | 2026-02-25 |
| 10 | 01 | 3min | 2 | 2 | 2026-02-25 |
| 10 | 02 | 2min | 2 | 3 | 2026-02-25 |
| 10 | 03 | 4min | 2 | 5 | 2026-02-25 |
| 10 | 04 | 2min | 0 | 0 | 2026-02-25 |
| 11 | 01 | 5min | 2 | 9 | 2026-02-26 |
| 11 | 02 | 3min | 2 | 4 | 2026-02-26 |
| 12 | 01 | 2min | 2 | 5 | 2026-02-27 |
| 12 | 02 | 3min | 2 | 6 | 2026-02-27 |

---

_Last Updated: 2026-02-27 — Phase 12 Plan 02 complete_

