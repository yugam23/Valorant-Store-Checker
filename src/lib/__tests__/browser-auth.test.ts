import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock child_process BEFORE importing the module under test
// ---------------------------------------------------------------------------

const mockSpawn = vi.fn();

vi.mock("child_process", () => ({
  spawn: mockSpawn,
}));

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

// ---------------------------------------------------------------------------
// Import module under test AFTER mocks are declared
// ---------------------------------------------------------------------------

const { launchBasicBrowser } = await import("@/lib/browser-auth");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const RIOT_LOGIN_URL =
  "https://auth.riotgames.com/authorize?redirect_uri=https%3A%2F%2Fplayvalorant.com%2Fopt_in&client_id=play-valorant-web-prod&response_type=token%20id_token&nonce=1&scope=account%20openid";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("launchBasicBrowser", () => {
  beforeEach(() => {
    mockSpawn.mockReset();
    mockSpawn.mockReturnValue({
      on: vi.fn(),
    });
  });

  afterEach(() => {
    mockSpawn.mockRestore();
  });

  describe("Windows (win32)", () => {
    it("spawns cmd.exe with correct args on Windows", async () => {
      Object.defineProperty(process, "platform", { value: "win32" });

      mockSpawn.mockReturnValue({
        on: (event: string, cb: (...args: unknown[]) => void) => {
          if (event === "close") {
            setTimeout(() => cb(0), 0);
          }
          return {} as ReturnType<typeof mockSpawn>;
        },
      });

      const result = await launchBasicBrowser();

      expect(mockSpawn).toHaveBeenCalledTimes(1);
      expect(mockSpawn).toHaveBeenCalledWith("cmd.exe", [
        "/c",
        "start",
        "",
        RIOT_LOGIN_URL,
      ]);
      expect(result).toEqual({ success: true });

      // Restore platform
      Object.defineProperty(process, "platform", { value: process.platform });
    });

    it("returns success when spawn closes with code 0 on Windows", async () => {
      Object.defineProperty(process, "platform", { value: "win32" });

      mockSpawn.mockReturnValue({
        on: (event: string, cb: (...args: unknown[]) => void) => {
          if (event === "close") {
            setTimeout(() => cb(0), 0);
          }
          return {} as ReturnType<typeof mockSpawn>;
        },
      });

      const result = await launchBasicBrowser();

      expect(result).toEqual({ success: true });

      Object.defineProperty(process, "platform", { value: process.platform });
    });

    it("returns error when spawn emits error event on Windows", async () => {
      Object.defineProperty(process, "platform", { value: "win32" });

      const spawnError = new Error("spawn failed");
      mockSpawn.mockReturnValue({
        on: (event: string, cb: (...args: unknown[]) => void) => {
          if (event === "error") {
            setTimeout(() => cb(spawnError), 0);
          }
          if (event === "close") {
            setTimeout(() => cb(1), 0);
          }
          return {} as ReturnType<typeof mockSpawn>;
        },
      });

      const result = await launchBasicBrowser();

      expect(result.success).toBe(false);
      expect(result.error).toContain("spawn failed");

      Object.defineProperty(process, "platform", { value: process.platform });
    });
  });

  describe("macOS (darwin)", () => {
    it("spawns open command with URL on macOS", async () => {
      Object.defineProperty(process, "platform", { value: "darwin" });

      mockSpawn.mockReturnValue({
        on: (event: string, cb: (...args: unknown[]) => void) => {
          if (event === "close") {
            setTimeout(() => cb(0), 0);
          }
          return {} as ReturnType<typeof mockSpawn>;
        },
      });

      await launchBasicBrowser();

      expect(mockSpawn).toHaveBeenCalledTimes(1);
      expect(mockSpawn).toHaveBeenCalledWith("open", [RIOT_LOGIN_URL]);

      Object.defineProperty(process, "platform", { value: process.platform });
    });
  });

  describe("Linux", () => {
    it("spawns xdg-open command with URL on Linux", async () => {
      Object.defineProperty(process, "platform", { value: "linux" });

      mockSpawn.mockReturnValue({
        on: (event: string, cb: (...args: unknown[]) => void) => {
          if (event === "close") {
            setTimeout(() => cb(0), 0);
          }
          return {} as ReturnType<typeof mockSpawn>;
        },
      });

      await launchBasicBrowser();

      expect(mockSpawn).toHaveBeenCalledTimes(1);
      expect(mockSpawn).toHaveBeenCalledWith("xdg-open", [RIOT_LOGIN_URL]);

      Object.defineProperty(process, "platform", { value: process.platform });
    });
  });

  describe("error handling", () => {
    it("returns error when spawn exits with non-zero code", async () => {
      Object.defineProperty(process, "platform", { value: "win32" });

      mockSpawn.mockReturnValue({
        on: (event: string, cb: (...args: unknown[]) => void) => {
          if (event === "close") {
            setTimeout(() => cb(1), 0);
          }
          return {} as ReturnType<typeof mockSpawn>;
        },
      });

      const result = await launchBasicBrowser();

      expect(result.success).toBe(false);
      expect(result.error).toContain("Exited with code 1");

      Object.defineProperty(process, "platform", { value: process.platform });
    });
  });
});
