import { createClient, type Client } from "@libsql/client";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import type { SessionData } from "@/lib/schemas/session";
import { encrypt } from "@/lib/session-crypto";

// ---------------------------------------------------------------------------
// In-memory SQLite mock for @/lib/session-db
// vi.mock is hoisted by vitest — factory runs before any imports.
// The testClient variable is captured by reference so beforeEach can update it.
// ---------------------------------------------------------------------------

let testClient: Client;

// Valid 64-char hex encryption key for testing encrypted riotCookies
const TEST_ENCRYPTION_KEY = "a".repeat(64);

vi.mock("@/lib/session-db", () => ({
  initSessionDb: vi.fn(async () => testClient),
}));

vi.mock("@/lib/env", () => ({
  env: {
    ENCRYPTION_KEY: TEST_ENCRYPTION_KEY,
  },
}));

// Import AFTER mock declarations (vi.mock is hoisted, so this is safe)
const {
  saveSessionToStore,
  getSessionFromStore,
  deleteSessionFromStore,
  cleanupExpiredSessions,
  refreshSessionExpiration,
} = await import("@/lib/session-store");

const { initSessionDb } = await import("@/lib/session-db");

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

describe("refreshSessionExpiration", () => {
  it("updates expires_at for an existing session", async () => {
    const now = Date.now();

    // Insert a session with a known expires_at
    await testClient.execute({
      sql: "INSERT INTO sessions (id, data, expires_at) VALUES (?, ?, ?)",
      args: ["refresh-test", JSON.stringify(validSession), now + 60_000],
    });

    // Verify initial expires_at
    let row = await testClient.execute({
      sql: "SELECT expires_at FROM sessions WHERE id = ?",
      args: ["refresh-test"],
    });
    const initialExpiresAt = (row.rows[0]!.expires_at as number);
    expect(initialExpiresAt).toBe(now + 60_000);

    // Refresh with a longer maxAge
    await refreshSessionExpiration("refresh-test", 7200); // 2 hours

    // Verify expires_at was updated
    row = await testClient.execute({
      sql: "SELECT expires_at FROM sessions WHERE id = ?",
      args: ["refresh-test"],
    });
    const newExpiresAt = (row.rows[0]!.expires_at as number);
    // Should be approximately Date.now() + 7200*1000
    expect(newExpiresAt).toBeGreaterThan(initialExpiresAt + 7_000_000);
  });

  it("is a no-op for non-existent session (no throw)", async () => {
    // Should not throw even if session doesn't exist
    await expect(refreshSessionExpiration("nonexistent-session", 3600)).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Defensive error-handling tests (ERR-01, ERR-03)
// ---------------------------------------------------------------------------

describe("getSessionFromStore — defensive error handling", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("ERR-01: corrupt JSON returns null and logs a warning", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    vi.mocked(initSessionDb).mockResolvedValueOnce({
      execute: vi.fn().mockResolvedValueOnce({
        rows: [{ data: "NOT VALID JSON{{{", expires_at: Date.now() + 60_000 }],
      }),
    } as unknown as Awaited<ReturnType<typeof initSessionDb>>);

    const result = await getSessionFromStore("corrupt-id");

    expect(result).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("[session-store]"),
      expect.stringContaining("corrupt session data"),
      "corrupt-id",
    );
  });

  it("ERR-03: DB error returns null and logs an error", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    vi.mocked(initSessionDb).mockResolvedValueOnce({
      execute: vi.fn().mockRejectedValueOnce(new Error("SQLITE_CANTOPEN")),
    } as unknown as Awaited<ReturnType<typeof initSessionDb>>);

    const result = await getSessionFromStore("db-error-id");

    expect(result).toBeNull();
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("[session-store]"),
      expect.stringContaining("database error"),
      "db-error-id",
      expect.any(Error),
    );
  });

  it("ERR-03: missing session returns null silently (no warn, no error)", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    vi.mocked(initSessionDb).mockResolvedValueOnce({
      execute: vi.fn().mockResolvedValueOnce({ rows: [] }),
    } as unknown as Awaited<ReturnType<typeof initSessionDb>>);

    const result = await getSessionFromStore("missing-id");

    expect(result).toBeNull();
    expect(warnSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  });
});

describe("getSessionFromStore — encrypted riotCookies decryption", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("decrypts encrypted riotCookies when ENCRYPTION_KEY is available", async () => {
    // Insert session with encrypted riotCookies directly into DB
    const sessionWithEncryptedCookies: SessionData = {
      ...validSession,
      riotCookies: "original-cookie-value",
    };
    const encryptedCookies = encrypt("original-cookie-value", TEST_ENCRYPTION_KEY);
    const sessionWithEncrypted: Record<string, unknown> = { ...sessionWithEncryptedCookies, riotCookies: encryptedCookies };

    await testClient.execute({
      sql: "INSERT INTO sessions (id, data, expires_at) VALUES (?, ?, ?)",
      args: ["encrypted-session", JSON.stringify(sessionWithEncrypted), Date.now() + 60_000],
    });

    const result = await getSessionFromStore("encrypted-session");

    expect(result).not.toBeNull();
    expect(result!.riotCookies).toBe("original-cookie-value");
  });

  it("returns null when ciphertext is corrupted (decryption fails)", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    // Insert session with invalid encrypted riotCookies (corrupt ciphertext)
    const sessionWithCorrupt: Record<string, unknown> = {
      ...validSession,
      riotCookies: "aa0000bb1111cc2222dd3333:aa0000bb1111cc2222dd333344445555:aa",
    };

    await testClient.execute({
      sql: "INSERT INTO sessions (id, data, expires_at) VALUES (?, ?, ?)",
      args: ["corrupt-session", JSON.stringify(sessionWithCorrupt), Date.now() + 60_000],
    });

    const result = await getSessionFromStore("corrupt-session");

    expect(result).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("[session-store]"),
      expect.stringContaining("Failed to decrypt"),
      expect.any(Error),
    );
  });
});
