import { describe, it, expect } from "vitest";
import { StoredSessionSchema } from "@/lib/schemas/session";
import { HenrikAccountSchema, HenrikMMRSchema } from "@/lib/schemas/henrik";
import {
  AuthResponseSchema,
  EntitlementsResponseSchema,
  UserInfoSchema,
} from "@/lib/schemas/riot-auth";
import { RiotStorefrontSchema } from "@/lib/schemas/storefront";
import { parseWithLog } from "@/lib/schemas/parse";

// ---------------------------------------------------------------------------
// StoredSessionSchema
// ---------------------------------------------------------------------------

describe("StoredSessionSchema", () => {
  const validSession = {
    accessToken: "t",
    entitlementsToken: "e",
    puuid: "p",
    region: "na",
    createdAt: 1000,
  };

  it("valid fixture: parses successfully", () => {
    const result = StoredSessionSchema.safeParse(validSession);
    expect(result.success).toBe(true);
  });

  it("extra fields: passes through (passthrough schema)", () => {
    const withExtra = { ...validSession, extraField: "bonus" };
    const result = StoredSessionSchema.safeParse(withExtra);
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.data as Record<string, unknown>).extraField).toBe("bonus");
    }
  });

  it("missing accessToken: fails validation", () => {
    const { accessToken: _removed, ...withoutAccess } = validSession;
    const result = StoredSessionSchema.safeParse(withoutAccess);
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// HenrikAccountSchema
// ---------------------------------------------------------------------------

describe("HenrikAccountSchema", () => {
  const validAccount = {
    puuid: "test-puuid",
    region: "na",
    account_level: 100,
    name: "TestPlayer",
    tag: "NA1",
    card: {
      small: "https://example.com/small.png",
      large: "https://example.com/large.png",
      wide: "https://example.com/wide.png",
      id: "card-id-abc",
    },
    last_update: "2024-01-01T00:00:00.000Z",
    last_update_raw: 1704067200,
  };

  it("valid fixture: parses successfully", () => {
    const result = HenrikAccountSchema.safeParse(validAccount);
    expect(result.success).toBe(true);
  });

  it("extra fields: passes through", () => {
    const withExtra = { ...validAccount, title: "VCT Champion" };
    const result = HenrikAccountSchema.safeParse(withExtra);
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.data as Record<string, unknown>).title).toBe("VCT Champion");
    }
  });

  it("missing puuid: fails validation", () => {
    const { puuid: _removed, ...withoutPuuid } = validAccount;
    const result = HenrikAccountSchema.safeParse(withoutPuuid);
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// HenrikMMRSchema
// ---------------------------------------------------------------------------

describe("HenrikMMRSchema", () => {
  it("valid fixture with current and peak: parses successfully", () => {
    const validMMR = {
      current: {
        tier: { id: 24, name: "Immortal 3" },
        rr: 75,
        last_change: -10,
        elo: 2475,
        games_needed_for_rating: 0,
      },
      peak: {
        season: { id: "e8a1", short: "e8a1" },
        tier: { id: 25, name: "Radiant" },
      },
    };
    const result = HenrikMMRSchema.safeParse(validMMR);
    expect(result.success).toBe(true);
  });

  it("empty object: parses successfully (both fields optional)", () => {
    const result = HenrikMMRSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("invalid current.tier (missing required name field): fails validation", () => {
    const invalidMMR = {
      current: {
        tier: { id: 24 }, // missing `name`
        rr: 75,
        last_change: -10,
        elo: 2475,
        games_needed_for_rating: 0,
      },
    };
    const result = HenrikMMRSchema.safeParse(invalidMMR);
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// AuthResponseSchema
// ---------------------------------------------------------------------------

describe("AuthResponseSchema", () => {
  it("type=response: parses successfully", () => {
    const result = AuthResponseSchema.safeParse({ type: "response" });
    expect(result.success).toBe(true);
  });

  it("type=multifactor with multifactor field: passes through", () => {
    const result = AuthResponseSchema.safeParse({
      type: "multifactor",
      multifactor: { email: "test@example.com" },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.data as Record<string, unknown>).type).toBe("multifactor");
    }
  });

  it("missing type field: fails validation", () => {
    const result = AuthResponseSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// EntitlementsResponseSchema
// ---------------------------------------------------------------------------

describe("EntitlementsResponseSchema", () => {
  it("valid fixture: parses successfully", () => {
    const result = EntitlementsResponseSchema.safeParse({
      entitlements_token: "ent-token-abc",
    });
    expect(result.success).toBe(true);
  });

  it("missing entitlements_token: fails validation", () => {
    const result = EntitlementsResponseSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// UserInfoSchema
// ---------------------------------------------------------------------------

describe("UserInfoSchema", () => {
  const validUserInfo = {
    country: "US",
    sub: "test-puuid",
    email_verified: true,
    phone_number_verified: true,
    account_verified: true,
    age: 25,
    jti: "test-jti",
  };

  it("valid fixture: parses successfully", () => {
    const result = UserInfoSchema.safeParse(validUserInfo);
    expect(result.success).toBe(true);
  });

  it("missing sub (puuid): fails validation", () => {
    const { sub: _removed, ...withoutSub } = validUserInfo;
    const result = UserInfoSchema.safeParse(withoutSub);
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// RiotStorefrontSchema
// ---------------------------------------------------------------------------

describe("RiotStorefrontSchema", () => {
  const validStorefront = {
    FeaturedBundle: {
      Bundle: { ID: "bundle-uuid", DataAssetID: "data-uuid" },
      Bundles: [{ ID: "bundle-uuid", DataAssetID: "data-uuid" }],
      BundleRemainingDurationInSeconds: 86400,
    },
    SkinsPanelLayout: {
      SingleItemOffers: ["skin-uuid-1", "skin-uuid-2", "skin-uuid-3", "skin-uuid-4"],
      SingleItemOffersRemainingDurationInSeconds: 86400,
      SingleItemStoreOffers: [
        { OfferID: "skin-uuid-1", IsDirectPurchase: true },
      ],
    },
  };

  it("valid fixture with FeaturedBundle and SkinsPanelLayout: parses successfully", () => {
    const result = RiotStorefrontSchema.safeParse(validStorefront);
    expect(result.success).toBe(true);
  });

  it("extra fields in nested objects: passes through", () => {
    const withExtra = {
      ...validStorefront,
      FeaturedBundle: {
        ...validStorefront.FeaturedBundle,
        Bundle: { ...validStorefront.FeaturedBundle.Bundle, ExtraField: "ignored" },
      },
      UnknownTopLevel: "extra-value",
    };
    const result = RiotStorefrontSchema.safeParse(withExtra);
    expect(result.success).toBe(true);
  });

  it("missing SkinsPanelLayout: fails validation", () => {
    const { SkinsPanelLayout: _removed, ...withoutSkins } = validStorefront;
    const result = RiotStorefrontSchema.safeParse(withoutSkins);
    expect(result.success).toBe(false);
  });

  it("BonusStore is optional: parses without it", () => {
    // validStorefront has no BonusStore — should still pass
    const result = RiotStorefrontSchema.safeParse(validStorefront);
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// parseWithLog
// ---------------------------------------------------------------------------

describe("parseWithLog", () => {
  it("valid data: returns parsed result (not null)", () => {
    const result = parseWithLog(StoredSessionSchema, {
      accessToken: "t",
      entitlementsToken: "e",
      puuid: "p",
      region: "na",
      createdAt: 1000,
    }, "StoredSession");
    expect(result).not.toBeNull();
    expect(result!.accessToken).toBe("t");
  });

  it("invalid data (empty object): returns null, does NOT throw", () => {
    expect(() => {
      const result = parseWithLog(StoredSessionSchema, {}, "StoredSession");
      expect(result).toBeNull();
    }).not.toThrow();
  });

  it("completely wrong type: returns null, does NOT throw", () => {
    expect(() => {
      const result = parseWithLog(StoredSessionSchema, "not-an-object", "StoredSession");
      expect(result).toBeNull();
    }).not.toThrow();
  });

  it("null input: returns null, does NOT throw", () => {
    expect(() => {
      const result = parseWithLog(StoredSessionSchema, null, "StoredSession");
      expect(result).toBeNull();
    }).not.toThrow();
  });
});
