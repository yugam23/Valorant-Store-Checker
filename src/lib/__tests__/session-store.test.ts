import { createClient, type Client } from "@libsql/client";
import { vi, describe, it, expect, beforeEach } from "vitest";
import type { SessionData } from "@/lib/session-types";

// ---------------------------------------------------------------------------
// In-memory SQLite mock for @/lib/session-db
// vi.mock is hoisted by vitest — factory runs before any imports.
// The testClient variable is captured by reference so beforeEach can update it.
// ---------------------------------------------------------------------------

let testClient: Client;

vi.mock("@/lib/session-db", () => ({
  initSessionDb: vi.fn(async () => testClient),
}));

// Import AFTER mock declarations (vi.mock is hoisted, so this is safe)
const {
  saveSessionToStore,
  getSessionFromStore,
  deleteSessionFromStore,
  cleanupExpiredSessions,
} = await import("@/lib/session-store");

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const validSession: SessionData = {
  accessToken: "test-access-token",
  entitlementsToken: "test-entitlements-token",
  puuid: "test-puuid",
  region: "na",
  createdAt: Date.now(),
};

// ---------------------------------------------------------------------------
// Setup — fresh in-memory SQLite per test
// ---------------------------------------------------------------------------

beforeEach(async () => {
  testClient = createClient({ url: ":memory:" });
  await testClient.execute(
    "CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, data TEXT NOT NULL, expires_at INTEGER NOT NULL)",
  );
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("saveSessionToStore / getSessionFromStore", () => {
  it("save then get: returns session with matching fields", async () => {
    await saveSessionToStore("s1", validSession, 3600);
    const result = await getSessionFromStore("s1");

    expect(result).not.toBeNull();
    expect(result!.accessToken).toBe("test-access-token");
    expect(result!.puuid).toBe("test-puuid");
    expect(result!.region).toBe("na");
  });

  it("get non-existent session: returns null", async () => {
    const result = await getSessionFromStore("nonexistent");
    expect(result).toBeNull();
  });
});

describe("TTL enforcement", () => {
  it("get expired session: returns null and lazily deletes the row", async () => {
    // Insert a row that already expired
    const expiredAt = Date.now() - 1000;
    await testClient.execute({
      sql: "INSERT INTO sessions (id, data, expires_at) VALUES (?, ?, ?)",
      args: [
        "expired",
        JSON.stringify(validSession),
        expiredAt,
      ],
    });

    const result = await getSessionFromStore("expired");
    expect(result).toBeNull();

    // Confirm the row was lazily deleted
    const check = await testClient.execute({
      sql: "SELECT id FROM sessions WHERE id = ?",
      args: ["expired"],
    });
    expect(check.rows.length).toBe(0);
  });
});

describe("deleteSessionFromStore", () => {
  it("save then delete: get returns null", async () => {
    await saveSessionToStore("del", validSession, 3600);
    await deleteSessionFromStore("del");

    const result = await getSessionFromStore("del");
    expect(result).toBeNull();
  });
});

describe("cleanupExpiredSessions", () => {
  it("removes expired rows but keeps valid rows", async () => {
    const now = Date.now();

    // Insert expired session
    await testClient.execute({
      sql: "INSERT INTO sessions (id, data, expires_at) VALUES (?, ?, ?)",
      args: ["exp-session", JSON.stringify(validSession), now - 5000],
    });

    // Insert valid session
    await testClient.execute({
      sql: "INSERT INTO sessions (id, data, expires_at) VALUES (?, ?, ?)",
      args: ["valid-session", JSON.stringify(validSession), now + 3_600_000],
    });

    await cleanupExpiredSessions();

    // Valid session should remain
    const valid = await getSessionFromStore("valid-session");
    expect(valid).not.toBeNull();

    // Expired session should be gone
    const expired = await testClient.execute({
      sql: "SELECT id FROM sessions WHERE id = ?",
      args: ["exp-session"],
    });
    expect(expired.rows.length).toBe(0);
  });
});
