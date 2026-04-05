/**
 * Shared JWT utilities for session and account management.
 * All JWT signing/verification uses HS256 with SESSION_SECRET.
 */

import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { env } from "@/lib/env";

const _secretKey = new TextEncoder().encode(env.SESSION_SECRET);

export function getSecretKey(): Uint8Array {
  return _secretKey;
}

export async function signPayload(
  payload: Record<string, unknown>
): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .sign(_secretKey);
}

export async function verifyPayload<T extends JWTPayload>(
  token: string
): Promise<T | null> {
  try {
    const { payload } = await jwtVerify(token, _secretKey);
    return payload as T;
  } catch {
    return null;
  }
}
