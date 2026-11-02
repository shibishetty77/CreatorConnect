import { cookies } from "next/headers";

import {
  getSessionTtlSeconds,
  SESSION_COOKIE_NAME,
  type Role,
} from "./constants";
import { signSessionToken, verifySessionToken } from "./token";
import type { SessionUser } from "./types";

type SessionCookieOptions = {
  httpOnly: true;
  secure: boolean;
  sameSite: "lax";
  path: "/";
  maxAge: number;
};

function cookieOptions(): SessionCookieOptions {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: getSessionTtlSeconds(),
  };
}

export async function createSessionCookie(input: {
  userId: number;
  username: string;
  role: Role;
}): Promise<void> {
  const token = await signSessionToken(input);
  const store = await cookies();

  store.set({
    name: SESSION_COOKIE_NAME,
    value: token,
    ...cookieOptions(),
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();

  store.set({
    name: SESSION_COOKIE_NAME,
    value: "",
    ...cookieOptions(),
    maxAge: 0,
  });
}

export async function getSession(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  return verifySessionToken(token);
}
