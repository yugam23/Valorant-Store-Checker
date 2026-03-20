import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { DailyStoreClient } from "./DailyStoreClient";
import type { StoreItem } from "@/types/store";

const mockStoreItem: StoreItem = {
  uuid: "skin-123",
  displayName: "Prime Vandal",
  displayIcon: "/images/prime-vandal.png",
  streamedVideo: null,
  wallpaper: null,
  cost: 1775,
  currencyId: "85ad13f7-3d1b-5128-8a35-80f2bb82406c",
  tierUuid: "e33df4d3-1c32-415c-899a-c6e47a16a936",
  tierName: "Select Edition",
  tierColor: "#5A9FE2",
  chromaCount: 4,
  levelCount: 5,
  assetPath: "SkinsLibrary/Characters/Weapons/PrimeVandal",
};

vi.mock("@/hooks/useWishlist", () => ({
  useWishlist: vi.fn(() => ({
    wishlistedUuids: [],
    isWishlisted: vi.fn(() => false),
    toggleWishlist: vi.fn(),
  })),
}));

describe("DailyStoreClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Renders correct number of store cards", () => {
    it("renders 4 store cards when given 4 items", () => {
      const items: StoreItem[] = [
        { ...mockStoreItem, uuid: "skin-1", displayName: "Skin One" },
        { ...mockStoreItem, uuid: "skin-2", displayName: "Skin Two" },
        { ...mockStoreItem, uuid: "skin-3", displayName: "Skin Three" },
        { ...mockStoreItem, uuid: "skin-4", displayName: "Skin Four" },
      ];

      render(
        <DailyStoreClient
          items={items}
          initialWishlistedUuids={[]}
          expiresAt={new Date(Date.now() + 86400000).toISOString()}
          puuid="test-puuid"
        />
      );

      // Find h3 elements which contain the skin names
      const headings = document.querySelectorAll("h3");
      const headingTexts = Array.from(headings).map(h => h.textContent);
      expect(headingTexts).toContain("Skin One");
      expect(headingTexts).toContain("Skin Two");
      expect(headingTexts).toContain("Skin Three");
      expect(headingTexts).toContain("Skin Four");
    });

    it("renders 2 store cards when given 2 items", () => {
      const items: StoreItem[] = [
        { ...mockStoreItem, uuid: "skin-1", displayName: "Alpha Skin" },
        { ...mockStoreItem, uuid: "skin-2", displayName: "Beta Skin" },
      ];

      render(
        <DailyStoreClient
          items={items}
          initialWishlistedUuids={[]}
          expiresAt={new Date(Date.now() + 86400000).toISOString()}
          puuid="test-puuid"
        />
      );

      const headings = document.querySelectorAll("h3");
      const headingTexts = Array.from(headings).map(h => h.textContent);
      expect(headingTexts).toContain("Alpha Skin");
      expect(headingTexts).toContain("Beta Skin");
    });
  });

  describe("Empty state renders without error", () => {
    it("shows empty state message when items array is empty", () => {
      render(
        <DailyStoreClient
          items={[]}
          initialWishlistedUuids={[]}
          expiresAt={new Date(Date.now() + 86400000).toISOString()}
          puuid="test-puuid"
        />
      );

      expect(screen.getByText("No items in store today")).toBeTruthy();
    });
  });
});
