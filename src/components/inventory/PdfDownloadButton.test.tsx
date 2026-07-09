import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PdfDownloadButton } from "./PdfDownloadButton";
import type { OwnedSkin } from "@/types/inventory";

/**
 * Factory for creating test OwnedSkin objects with sensible defaults.
 */
function makeSkin(overrides: Partial<OwnedSkin> = {}): OwnedSkin {
  return {
    uuid: "test-uuid-001",
    displayName: "Prime Vandal",
    displayIcon: "https://media.valorant-api.com/test.png",
    streamedVideo: null,
    wallpaper: null,
    blurDataURL: "data:image/png;base64,placeholder",
    tierUuid: "tier-001",
    tierName: "Premium Edition",
    tierColor: "#d1548d",
    chromaCount: 4,
    levelCount: 5,
    assetPath: "/Game/Skins/Prime/Vandal",
    weaponName: "Vandal",
    ...overrides,
  };
}

// Mock the pdf module to avoid loading html2canvas/jspdf in tests
vi.mock("@/lib/pdf", () => ({
  generateCollectionPdf: vi.fn(),
}));

describe("PdfDownloadButton", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders in idle state with correct label", () => {
    const skins = [makeSkin()];
    render(<PdfDownloadButton skins={skins} />);

    const button = screen.getByRole("button", { name: /export pdf/i });
    expect(button).toBeDefined();
    expect(button.getAttribute("disabled")).toBeNull();
  });

  it("is disabled when skins array is empty", () => {
    render(<PdfDownloadButton skins={[]} />);

    const button = screen.getByRole("button");
    expect(button.hasAttribute("disabled")).toBe(true);
    expect(button.getAttribute("title")).toBe("No skins to export");
  });

  it("calls generateCollectionPdf with the provided skins on click", async () => {
    const { generateCollectionPdf } = await import("@/lib/pdf");
    const mockGenerate = vi.mocked(generateCollectionPdf);
    mockGenerate.mockResolvedValueOnce(undefined);

    const skins = [makeSkin(), makeSkin({ uuid: "002", displayName: "Reaver Phantom" })];
    const user = userEvent.setup();
    render(<PdfDownloadButton skins={skins} />);

    await user.click(screen.getByRole("button", { name: /export pdf/i }));

    expect(mockGenerate).toHaveBeenCalledOnce();
    expect(mockGenerate).toHaveBeenCalledWith(skins);
  });

  it("shows loading state during PDF generation", async () => {
    const { generateCollectionPdf } = await import("@/lib/pdf");
    const mockGenerate = vi.mocked(generateCollectionPdf);

    // Create a promise we control to keep the button in loading state
    let resolveGenerate!: () => void;
    mockGenerate.mockImplementation(
      () => new Promise<void>((resolve) => { resolveGenerate = resolve; }),
    );

    const skins = [makeSkin()];
    const user = userEvent.setup();
    render(<PdfDownloadButton skins={skins} />);

    // Click and check loading state
    await user.click(screen.getByRole("button", { name: /export pdf/i }));

    // "Generating..." text should appear
    expect(screen.getByText(/generating/i)).toBeDefined();
    const button = screen.getByRole("button");
    expect(button.hasAttribute("disabled")).toBe(true);

    // Resolve to clean up
    resolveGenerate();
  });

  it("handles generation errors without crashing", async () => {
    const { generateCollectionPdf } = await import("@/lib/pdf");
    const mockGenerate = vi.mocked(generateCollectionPdf);
    mockGenerate.mockRejectedValueOnce(new Error("Canvas capture failed"));

    // Suppress console.error for this test
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const skins = [makeSkin()];
    const user = userEvent.setup();
    render(<PdfDownloadButton skins={skins} />);

    await user.click(screen.getByRole("button", { name: /export pdf/i }));

    // Should show error state
    expect(screen.getByText(/error/i)).toBeDefined();
    expect(screen.getByText(/Canvas capture failed/i)).toBeDefined();

    consoleSpy.mockRestore();
  });
});
