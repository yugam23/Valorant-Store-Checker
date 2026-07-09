import { describe, it, expect } from "vitest";
import { buildPdfHtml } from "../pdf";
import type { OwnedSkin } from "@/types/inventory";

/**
 * Factory for creating test OwnedSkin objects with sensible defaults.
 * Override any field via the partial parameter.
 */
function makeSkin(overrides: Partial<OwnedSkin> = {}): OwnedSkin {
  return {
    uuid: "test-uuid-001",
    displayName: "Prime Vandal",
    displayIcon: "https://media.valorant-api.com/weaponskinlevels/prime-vandal.png",
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

describe("buildPdfHtml", () => {
  it("generates HTML containing all skin display names", () => {
    const skins = [
      makeSkin({ displayName: "Prime Vandal" }),
      makeSkin({ uuid: "002", displayName: "Reaver Phantom" }),
      makeSkin({ uuid: "003", displayName: "Elderflame Operator" }),
    ];

    const html = buildPdfHtml(skins);

    expect(html).toContain("Prime Vandal");
    expect(html).toContain("Reaver Phantom");
    expect(html).toContain("Elderflame Operator");
  });

  it("includes weapon name and tier name for each skin", () => {
    const skins = [
      makeSkin({ weaponName: "Vandal", tierName: "Premium Edition" }),
      makeSkin({
        uuid: "002",
        displayName: "Reaver Phantom",
        weaponName: "Phantom",
        tierName: "Exclusive Edition",
      }),
    ];

    const html = buildPdfHtml(skins);

    expect(html).toContain("Vandal");
    expect(html).toContain("Premium Edition");
    expect(html).toContain("Phantom");
    expect(html).toContain("Exclusive Edition");
  });

  it("applies tier colors as inline styles", () => {
    const skins = [makeSkin({ tierColor: "#d1548d" })];

    const html = buildPdfHtml(skins);

    // The tier color should appear in the inline style for the edition badge
    expect(html).toContain("#d1548d");
  });

  it("handles skins with null tierName gracefully", () => {
    const skins = [
      makeSkin({ tierName: null, tierColor: "#71717a" }),
    ];

    const html = buildPdfHtml(skins);

    // Should show "Standard" as the fallback tier label
    expect(html).toContain("Standard");
    // Should not contain "null" as a visible string
    expect(html).not.toContain(">null<");
  });

  it("handles empty skin array with a no-skins message", () => {
    const html = buildPdfHtml([]);

    expect(html).toContain("No skins to display");
    // Should still have the VALORANT branding
    expect(html).toContain("VALORANT");
    expect(html).toContain("COLLECTION");
  });

  it("escapes HTML entities in skin names to prevent XSS", () => {
    const skins = [
      makeSkin({ displayName: '<script>alert("xss")</script>' }),
    ];

    const html = buildPdfHtml(skins);

    // Raw script tags should NOT appear in the output
    expect(html).not.toContain("<script>");
    // Should contain the escaped version
    expect(html).toContain("&lt;script&gt;");
  });

  it("includes the VALORANT COLLECTION header", () => {
    const skins = [makeSkin()];

    const html = buildPdfHtml(skins);

    expect(html).toContain("VALORANT");
    expect(html).toContain("COLLECTION");
  });

  it("includes skin count in the header", () => {
    const skins = [
      makeSkin(),
      makeSkin({ uuid: "002", displayName: "Reaver Phantom" }),
      makeSkin({ uuid: "003", displayName: "Elderflame Operator" }),
    ];

    const html = buildPdfHtml(skins);

    expect(html).toContain("3");
    expect(html).toContain("Skins");
  });

  it("shows singular 'Skin' label for a single skin", () => {
    const skins = [makeSkin()];

    const html = buildPdfHtml(skins);

    // Should show "1 Skin" not "1 Skins"
    expect(html).toMatch(/1\s*Skin(?!s)/);
  });

  it("includes player name when provided in meta", () => {
    const skins = [makeSkin()];

    const html = buildPdfHtml(skins, { playerName: "TestPlayer#NA1" });

    expect(html).toContain("TestPlayer#NA1");
  });

  it("escapes player name to prevent XSS", () => {
    const skins = [makeSkin()];

    const html = buildPdfHtml(skins, { playerName: '<img src=x onerror="alert(1)">' });

    expect(html).not.toContain('<img src=x');
    expect(html).toContain("&lt;img");
  });

  it("includes skin thumbnail images when displayIcon is present", () => {
    const skins = [
      makeSkin({
        displayIcon: "https://media.valorant-api.com/weaponskinlevels/test.png",
      }),
    ];

    const html = buildPdfHtml(skins);

    expect(html).toContain("https://media.valorant-api.com/weaponskinlevels/test.png");
    expect(html).toContain("<img");
  });

  it("shows placeholder when displayIcon is empty", () => {
    const skins = [makeSkin({ displayIcon: "" })];

    const html = buildPdfHtml(skins);

    expect(html).toContain("No image");
  });

  it("includes the footer with generator credit", () => {
    const skins = [makeSkin()];

    const html = buildPdfHtml(skins);

    expect(html).toContain("Generated by Valorant Store Checker");
  });

  it("uses alternating row backgrounds for readability", () => {
    const skins = [
      makeSkin(),
      makeSkin({ uuid: "002", displayName: "Reaver Phantom" }),
    ];

    const html = buildPdfHtml(skins);

    // Both void-deep and void colors should be present as row backgrounds
    expect(html).toContain("#0a1118"); // voidDeep — even rows
    expect(html).toContain("#0f1923"); // void — odd rows
  });
});
