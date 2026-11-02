import { jwtVerify, SignJWT } from "jose";

import { getSessionTtlSeconds, isRole, type Role } from "./constants";
import type { SessionUser } from "./types";

const MIN_SECRET_LENGTH = 32;

function getSessionSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET?.trim();

  if (!secret || secret.length < MIN_SECRET_LENGTH) {
    throw new Error(
      `AUTH_SECRET must be set to a random value of at least ${MIN_SECRET_LENGTH} characters.`,
    );
  }

  return new TextEncoder().encode(secret);
}

export type SessionTokenInput = {
  userId: number;
  username: string;
  role: Role;
};

export async function signSessionToken(
  input: SessionTokenInput,
  ttlSeconds: number = getSessionTtlSeconds(),
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);

  return new SignJWT({
    username: input.username,
    role: input.role,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(String(input.userId))
    .setIssuedAt(now)
    .setExpirationTime(now + ttlSeconds)
    .sign(getSessionSecret());
}

export async function verifySessionToken(
  token: string,
): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, getSessionSecret(), {
      algorithms: ["HS256"],
      clockTolerance: 5,
    });

    const userId = Number(payload.sub);
    const role = payload.role;
    const username = payload.username;

    if (
      !Number.isInteger(userId) ||
      userId <= 0 ||
      !isRole(role) ||
      typeof username !== "string" ||
      typeof payload.exp !== "number"
    ) {
      return null;
    }

    return {
      userId,
      username,
      role,
      expiresAt: payload.exp * 1000,
    };
  } catch {
    return null;
  }
}
