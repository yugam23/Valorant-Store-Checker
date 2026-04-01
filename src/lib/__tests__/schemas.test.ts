import { describe, it, expect } from "vitest";
import { StoredSessionSchema } from "@/lib/schemas/session";
import { HenrikAccountSchema, HenrikMMRSchema } from "@/lib/schemas/henrik";
import {
  AuthResponseSchema,
  EntitlementsResponseSchema,
  UserInfoSchema,
} from "@/lib/schemas/riot-auth";
import { RiotStorefrontSchema, RiotWalletSchema } from "@/lib/schemas/storefront";
import { AccountsPayloadSchema } from "@/lib/schemas/accounts";
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

  it("type=multifactor with multifactor field: parses successfully", () => {
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

  // Negative validation tests
  it("unknown fields: stripped and passes validation", () => {
    const result = AuthResponseSchema.safeParse({
      type: "response",
      unknownField: "value",
    });
    // .strip() silently removes unknown fields instead of rejecting
    expect(result.success).toBe(true);
  });

  it("empty string for accessToken: fails validation", () => {
    const result = AuthResponseSchema.safeParse({
      type: "response",
      accessToken: "",
    });
    expect(result.success).toBe(false);
  });

  it("null for accessToken: fails validation", () => {
    const result = AuthResponseSchema.safeParse({
      type: "response",
      accessToken: null,
    });
    expect(result.success).toBe(false);
  });

  it("array input for accessToken: fails validation", () => {
    const result = AuthResponseSchema.safeParse({
      type: "response",
      accessToken: ["array"],
    });
    expect(result.success).toBe(false);
  });

  it("invalid type value (not response/multifactor): fails validation", () => {
    const result = AuthResponseSchema.safeParse({ type: "invalid" });
    expect(result.success).toBe(false);
  });

  it("negative expiresAt: fails validation", () => {
    const result = AuthResponseSchema.safeParse({
      type: "response",
      expiresAt: -1,
    });
    expect(result.success).toBe(false);
  });

  it("valid full response with all optional fields: passes", () => {
    const result = AuthResponseSchema.safeParse({
      type: "response",
      accessToken: "tok123",
      idToken: "id123",
      expiresAt: 3600,
      expiresIn: 3600,
    });
    expect(result.success).toBe(true);
  });

  it("valid multifactor response with email: passes", () => {
    const result = AuthResponseSchema.safeParse({
      type: "multifactor",
      multifactor: { email: "test@example.com" },
    });
    expect(result.success).toBe(true);
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
  const validOffer = {
    OfferID: "skin-uuid-1",
    IsDirectPurchase: true,
    StartDate: "2024-01-01T00:00:00Z",
    Cost: { "85ad13f7-3d1b-5128-9eb2-7cd8ee0b5741": 1775 },
    Rewards: [{ ItemTypeID: "e7c63390-eda7-46e0-bb7a-a6abdacd2433", ItemID: "skin-uuid-1", Quantity: 1 }],
  };

  const validBundle = {
    ID: "bundle-uuid",
    DataAssetID: "data-uuid",
    CurrencyID: "85ad13f7-3d1b-5128-9eb2-7cd8ee0b5741",
    Items: [{
      Item: { ItemTypeID: "e7c63390-eda7-46e0-bb7a-a6abdacd2433", ItemID: "skin-1", Amount: 1 },
      BasePrice: 1775,
      CurrencyID: "85ad13f7-3d1b-5128-9eb2-7cd8ee0b5741",
      DiscountPercent: 0,
      DiscountedPrice: 1775,
      IsPromoItem: false,
    }],
    DurationRemainingInSeconds: 86400,
    WholesaleOnly: false,
  };

  const validStorefront = {
    FeaturedBundle: {
      Bundle: validBundle,
      Bundles: [validBundle],
      BundleRemainingDurationInSeconds: 86400,
    },
    SkinsPanelLayout: {
      SingleItemOffers: ["skin-uuid-1", "skin-uuid-2", "skin-uuid-3", "skin-uuid-4"],
      SingleItemOffersRemainingDurationInSeconds: 86400,
      SingleItemStoreOffers: [validOffer],
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
        Bundle: { ...validBundle, ExtraField: "ignored" },
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

  it("BonusStore with valid offers: parses successfully", () => {
    const withBonus = {
      ...validStorefront,
      BonusStore: {
        BonusStoreOffers: [{
          BonusOfferID: "bonus-1",
          Offer: validOffer,
          DiscountPercent: 33,
          DiscountCosts: { "85ad13f7-3d1b-5128-9eb2-7cd8ee0b5741": 1189 },
          IsSeen: false,
        }],
        BonusStoreRemainingDurationInSeconds: 172800,
      },
    };
    const result = RiotStorefrontSchema.safeParse(withBonus);
    expect(result.success).toBe(true);
  });

  it("offer missing Cost field: fails validation", () => {
    const badOffer = { ...validOffer, Cost: undefined };
    const badStorefront = {
      ...validStorefront,
      SkinsPanelLayout: {
        ...validStorefront.SkinsPanelLayout,
        SingleItemStoreOffers: [badOffer],
      },
    };
    const result = RiotStorefrontSchema.safeParse(badStorefront);
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// RiotWalletSchema
// ---------------------------------------------------------------------------

describe("RiotWalletSchema", () => {
  it("valid wallet with VP/RP/KC balances: parses successfully", () => {
    const wallet = {
      Balances: {
        "85ad13f7-3d1b-5128-9eb2-7cd8ee0b5741": 3850,
        "e59aa87c-4cbf-517a-5983-6e81511be9b7": 44,
        "85ca954a-41f2-ce94-9b45-8ca3dd39a00d": 115,
      },
    };
    const result = RiotWalletSchema.safeParse(wallet);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.Balances["85ad13f7-3d1b-5128-9eb2-7cd8ee0b5741"]).toBe(3850);
    }
  });

  it("empty Balances object: parses successfully", () => {
    const result = RiotWalletSchema.safeParse({ Balances: {} });
    expect(result.success).toBe(true);
  });

  it("extra fields: passes through", () => {
    const result = RiotWalletSchema.safeParse({
      Balances: { "some-id": 100 },
      SomeExtraField: "test",
    });
    expect(result.success).toBe(true);
  });

  it("missing Balances field: fails validation", () => {
    const result = RiotWalletSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("wrong Balances type (string values): fails validation", () => {
    const result = RiotWalletSchema.safeParse({ Balances: { key: "not-a-number" } });
    expect(result.success).toBe(false);
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

// ---------------------------------------------------------------------------
// AccountsPayloadSchema
// ---------------------------------------------------------------------------

describe("AccountsPayloadSchema", () => {
  const validAccountEntry = {
    puuid: "test-puuid-abc",
    region: "na",
    gameName: "TestPlayer",
    tagLine: "NA1",
    addedAt: 1700000000000,
  };

  const validPayload = {
    accounts: [validAccountEntry],
    activePuuid: "test-puuid-abc",
  };

  it("valid accounts payload: parses successfully", () => {
    const result = AccountsPayloadSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.accounts).toHaveLength(1);
      expect(result.data.activePuuid).toBe("test-puuid-abc");
    }
  });

  it("extra fields: passes through (passthrough)", () => {
    const withExtra = { ...validPayload, extraField: "bonus", nested: { foo: "bar" } };
    const result = AccountsPayloadSchema.safeParse(withExtra);
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.data as Record<string, unknown>).extraField).toBe("bonus");
      expect((result.data as Record<string, unknown>).nested).toEqual({ foo: "bar" });
    }
  });

  it("missing accounts array: fails validation", () => {
    const withoutAccounts = { activePuuid: "test-puuid-abc" };
    const result = AccountsPayloadSchema.safeParse(withoutAccounts);
    expect(result.success).toBe(false);
  });

  it("missing activePuuid: fails validation", () => {
    const withoutActive = { accounts: [validAccountEntry] };
    const result = AccountsPayloadSchema.safeParse(withoutActive);
    expect(result.success).toBe(false);
  });

  it("invalid account entry (missing puuid): fails validation", () => {
    const invalidEntry = { region: "na", gameName: "Test" };
    const withInvalid = { accounts: [invalidEntry], activePuuid: "test" };
    const result = AccountsPayloadSchema.safeParse(withInvalid);
    expect(result.success).toBe(false);
  });

  it("addedAt as string: accepted as-is without coercion", () => {
    const withStringTimestamp = {
      accounts: [{ puuid: "p", region: "r", addedAt: "2024-01-01T00:00:00.000Z" }],
      activePuuid: "p",
    };
    const result = AccountsPayloadSchema.safeParse(withStringTimestamp);
    expect(result.success).toBe(true);
    if (result.success) {
      // z.union accepts string but does not coerce to number
      expect(typeof result.data.accounts[0]!.addedAt).toBe("string");
      expect(result.data.accounts[0]!.addedAt).toBe("2024-01-01T00:00:00.000Z");
    }
  });

  it("addedAt as number: parses correctly", () => {
    const withNumberTimestamp = {
      accounts: [{ puuid: "p", region: "r", addedAt: 1700000000000 }],
      activePuuid: "p",
    };
    const result = AccountsPayloadSchema.safeParse(withNumberTimestamp);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.accounts[0]!.addedAt).toBe(1700000000000);
    }
  });

  it("multiple accounts: parses array correctly", () => {
    const multiPayload = {
      accounts: [
        { puuid: "puuid-1", region: "na", addedAt: 1000 },
        { puuid: "puuid-2", region: "eu", addedAt: 2000, gameName: "Player2", tagLine: "EU1" },
      ],
      activePuuid: "puuid-2",
    };
    const result = AccountsPayloadSchema.safeParse(multiPayload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.accounts).toHaveLength(2);
      expect(result.data.activePuuid).toBe("puuid-2");
    }
  });
});
