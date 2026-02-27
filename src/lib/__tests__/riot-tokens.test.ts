import { describe, it, expect } from "vitest";
import { extractTokensFromUri, determineRegion } from "../riot-tokens";
import { UserInfo } from "../riot-auth";

// Minimal UserInfo fixture factory — only fields required for region tests
function makeUserInfo(overrides: Partial<UserInfo> = {}): UserInfo {
  return {
    sub: "test-puuid",
    country: "US",
    email_verified: true,
    phone_number_verified: true,
    account_verified: true,
    age: 25,
    jti: "test-jti",
    ...overrides,
  } as UserInfo;
}

describe("extractTokensFromUri", () => {
  it("extracts access_token and id_token from a valid fragment URI", () => {
    const uri =
      "https://playvalorant.com/opt_in#access_token=abc&id_token=xyz&token_type=Bearer";
    const result = extractTokensFromUri(uri);
    expect(result).not.toBeNull();
    expect(result!.accessToken).toBe("abc");
    expect(result!.idToken).toBe("xyz");
  });

  it("returns null when access_token is missing from the fragment", () => {
    const uri = "https://playvalorant.com/opt_in#id_token=xyz&token_type=Bearer";
    expect(extractTokensFromUri(uri)).toBeNull();
  });

  it("returns null when id_token is missing from the fragment", () => {
    const uri =
      "https://playvalorant.com/opt_in#access_token=abc&token_type=Bearer";
    expect(extractTokensFromUri(uri)).toBeNull();
  });

  it("returns null for a malformed URL that the URL constructor rejects", () => {
    expect(extractTokensFromUri("not-a-url")).toBeNull();
  });

  it("returns null for a URI with an empty fragment", () => {
    const uri = "https://example.com#";
    expect(extractTokensFromUri(uri)).toBeNull();
  });

  it("handles tokens that contain special characters correctly", () => {
    // access_token values in JWT are base64url — no = but dots
    const uri =
      "https://playvalorant.com/opt_in#access_token=header.payload.sig&id_token=h.p.s&token_type=Bearer";
    const result = extractTokensFromUri(uri);
    expect(result).not.toBeNull();
    expect(result!.accessToken).toBe("header.payload.sig");
    expect(result!.idToken).toBe("h.p.s");
  });
});

describe("determineRegion", () => {
  it("uses affinity.pp as primary shard when present", () => {
    const userInfo = makeUserInfo({ affinity: { pp: "eu" } });
    expect(determineRegion(userInfo)).toBe("eu");
  });

  it("falls back to affinity.live when pp is absent", () => {
    const userInfo = makeUserInfo({ affinity: { live: "ap" } });
    expect(determineRegion(userInfo)).toBe("ap");
  });

  it("falls back to first affinity value when neither pp nor live is present", () => {
    const userInfo = makeUserInfo({ affinity: { na: "na" } });
    expect(determineRegion(userInfo)).toBe("na");
  });

  it("maps country US to na", () => {
    const userInfo = makeUserInfo({ country: "US" });
    expect(determineRegion(userInfo)).toBe("na");
  });

  it("maps country GB to eu", () => {
    const userInfo = makeUserInfo({ country: "GB" });
    expect(determineRegion(userInfo)).toBe("eu");
  });

  it("maps country KR to kr", () => {
    const userInfo = makeUserInfo({ country: "KR" });
    expect(determineRegion(userInfo)).toBe("kr");
  });

  it("maps country BR to br", () => {
    const userInfo = makeUserInfo({ country: "BR" });
    expect(determineRegion(userInfo)).toBe("br");
  });

  it("maps country AR to latam", () => {
    const userInfo = makeUserInfo({ country: "AR" });
    expect(determineRegion(userInfo)).toBe("latam");
  });

  it("defaults unknown country code to na", () => {
    const userInfo = makeUserInfo({ country: "ZZ" });
    expect(determineRegion(userInfo)).toBe("na");
  });

  it("affinity takes priority over country when both are present", () => {
    // Country says 'US' (na) but affinity says 'eu' — affinity wins
    const userInfo = makeUserInfo({ country: "US", affinity: { pp: "eu" } });
    expect(determineRegion(userInfo)).toBe("eu");
  });

  it("handles lowercase country code by normalizing to uppercase", () => {
    // country is uppercased before lookup: userInfo.country?.toUpperCase()
    const userInfo = makeUserInfo({ country: "us" });
    expect(determineRegion(userInfo)).toBe("na");
  });

  it("maps country CA to na", () => {
    const userInfo = makeUserInfo({ country: "CA" });
    expect(determineRegion(userInfo)).toBe("na");
  });

  it("maps country JP to ap", () => {
    const userInfo = makeUserInfo({ country: "JP" });
    expect(determineRegion(userInfo)).toBe("ap");
  });
});
