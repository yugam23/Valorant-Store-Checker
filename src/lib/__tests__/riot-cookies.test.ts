import { describe, it, expect } from "vitest";
import {
  mergeCookies,
  extractNamedCookies,
  buildEssentialCookieString,
  captureSetCookies,
} from "../riot-cookies";

describe("mergeCookies", () => {
  it("returns empty string when both existing and new headers are empty", () => {
    expect(mergeCookies("", [])).toBe("");
  });

  it("preserves existing cookies when no new headers are provided", () => {
    const existing = "ssid=abc123; clid=def456";
    expect(mergeCookies(existing, [])).toBe("ssid=abc123; clid=def456");
  });

  it("overrides existing cookie with same name from new set-cookie header", () => {
    const existing = "ssid=old-value; clid=stay";
    const newHeaders = ["ssid=new-value; Path=/; Secure"];
    const result = mergeCookies(existing, newHeaders);
    // ssid should be overridden, clid should remain
    expect(result).toContain("ssid=new-value");
    expect(result).toContain("clid=stay");
    expect(result).not.toContain("ssid=old-value");
  });

  it("appends new cookies with different names alongside existing ones", () => {
    const existing = "ssid=abc";
    const newHeaders = ["tdid=xyz; Path=/; HttpOnly"];
    const result = mergeCookies(existing, newHeaders);
    expect(result).toContain("ssid=abc");
    expect(result).toContain("tdid=xyz");
  });

  it("processes multiple headers in order — last header wins for same name", () => {
    const existing = "ssid=first";
    const newHeaders = [
      "ssid=second; Path=/",
      "ssid=third; Path=/; Secure",
    ];
    const result = mergeCookies(existing, newHeaders);
    expect(result).toContain("ssid=third");
    expect(result).not.toContain("ssid=first");
    expect(result).not.toContain("ssid=second");
  });

  it("handles set-cookie header with no attributes correctly", () => {
    const result = mergeCookies("", ["clid=myvalue"]);
    expect(result).toBe("clid=myvalue");
  });

  it("ignores malformed cookies with no equals sign in existing string", () => {
    // A pair with no '=' should be skipped (eqIdx <= 0)
    const result = mergeCookies("badcookie; ssid=valid", []);
    expect(result).toBe("ssid=valid");
  });
});

describe("extractNamedCookies", () => {
  it("extracts all 4 named cookies from a full cookie string", () => {
    const cookieString = "ssid=abc; clid=def; csid=ghi; tdid=jkl";
    const result = extractNamedCookies(cookieString);
    expect(result.raw).toBe(cookieString);
    expect(result.ssid).toBe("abc");
    expect(result.clid).toBe("def");
    expect(result.csid).toBe("ghi");
    expect(result.tdid).toBe("jkl");
  });

  it("returns only the present fields when only some cookies are in the string", () => {
    const cookieString = "ssid=abc123; tdid=xyz789";
    const result = extractNamedCookies(cookieString);
    expect(result.ssid).toBe("abc123");
    expect(result.tdid).toBe("xyz789");
    expect(result.clid).toBeUndefined();
    expect(result.csid).toBeUndefined();
  });

  it("returns raw empty string and no named fields for an empty cookie string", () => {
    const result = extractNamedCookies("");
    expect(result.raw).toBe("");
    expect(result.ssid).toBeUndefined();
    expect(result.clid).toBeUndefined();
    expect(result.csid).toBeUndefined();
    expect(result.tdid).toBeUndefined();
  });

  it("correctly handles cookies with '=' in their value (e.g. base64-encoded)", () => {
    // Uses indexOf('=') not split('='), so value can contain '='
    const cookieString = "ssid=abc=def==; clid=normal";
    const result = extractNamedCookies(cookieString);
    expect(result.ssid).toBe("abc=def==");
    expect(result.clid).toBe("normal");
  });

  it("sets raw field to the input string even when no named cookies match", () => {
    const cookieString = "unknowncookie=somevalue; another=data";
    const result = extractNamedCookies(cookieString);
    expect(result.raw).toBe(cookieString);
    expect(result.ssid).toBeUndefined();
    expect(result.clid).toBeUndefined();
    expect(result.csid).toBeUndefined();
    expect(result.tdid).toBeUndefined();
  });
});

describe("buildEssentialCookieString", () => {
  it("builds the correct string when all 4 cookies are present", () => {
    const named = { raw: "", ssid: "a", clid: "b", csid: "c", tdid: "d" };
    expect(buildEssentialCookieString(named)).toBe("ssid=a; clid=b; csid=c; tdid=d");
  });

  it("builds a single-entry string when only ssid is present (no trailing semicolons)", () => {
    const named = { raw: "", ssid: "only-ssid" };
    expect(buildEssentialCookieString(named)).toBe("ssid=only-ssid");
  });

  it("returns empty string when no named cookies are present", () => {
    const named = { raw: "" };
    expect(buildEssentialCookieString(named)).toBe("");
  });

  it("maintains deterministic order: ssid, clid, csid, tdid", () => {
    // Provide all in a shuffled-looking object — order must still be ssid/clid/csid/tdid
    const named = { raw: "", tdid: "d", csid: "c", clid: "b", ssid: "a" };
    const result = buildEssentialCookieString(named);
    const parts = result.split("; ");
    expect(parts[0]).toBe("ssid=a");
    expect(parts[1]).toBe("clid=b");
    expect(parts[2]).toBe("csid=c");
    expect(parts[3]).toBe("tdid=d");
  });

  it("skips missing cookies without leaving gaps", () => {
    // ssid and tdid present, clid and csid absent
    const named = { raw: "", ssid: "s1", tdid: "t1" };
    expect(buildEssentialCookieString(named)).toBe("ssid=s1; tdid=t1");
  });
});

describe("captureSetCookies", () => {
  it("returns the array from getSetCookie() when it works", () => {
    const mockResponse = {
      headers: {
        getSetCookie: () => ["ssid=abc; Path=/", "clid=def; Path=/"],
        get: () => null,
      },
    } as unknown as Response;

    const result = captureSetCookies(mockResponse);
    expect(result).toEqual(["ssid=abc; Path=/", "clid=def; Path=/"]);
  });

  it("falls back to get('set-cookie') and splits on comma before name=value when getSetCookie() throws", () => {
    const mockResponse = {
      headers: {
        getSetCookie: () => {
          throw new Error("getSetCookie not implemented");
        },
        get: (name: string) => {
          if (name === "set-cookie") {
            return "ssid=abc; Path=/, clid=def; Path=/";
          }
          return null;
        },
      },
    } as unknown as Response;

    const result = captureSetCookies(mockResponse);
    expect(result).toHaveLength(2);
    expect(result[0]).toContain("ssid=abc");
    expect(result[1]).toContain("clid=def");
  });

  it("returns empty array when getSetCookie() throws and get('set-cookie') returns null", () => {
    const mockResponse = {
      headers: {
        getSetCookie: () => {
          throw new Error("not available");
        },
        get: () => null,
      },
    } as unknown as Response;

    const result = captureSetCookies(mockResponse);
    expect(result).toEqual([]);
  });
});
