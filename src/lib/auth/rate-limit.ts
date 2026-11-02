const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 5;
const MAX_TRACKED_KEYS = 5_000;

type AttemptRecord = {
  failures: number;
  resetAt: number;
};

const attempts = new Map<string, AttemptRecord>();

export function getClientAddress(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  const forwardedAddresses = forwarded?.split(",");
  const firstForwarded = forwardedAddresses
    ? forwardedAddresses[0]?.trim()
    : undefined;
  const address =
    firstForwarded ||
    headers.get("x-real-ip")?.trim() ||
    headers.get("cf-connecting-ip")?.trim();

  return address ? address.slice(0, 128) : "unknown";
}

export function getRateLimitKey(
  headers: Headers,
  identifier: string,
): string {
  return `${getClientAddress(headers)}:${identifier.trim().toLowerCase()}`;
}

export function getRateLimitStatus(key: string): {
  limited: boolean;
  retryAfterSeconds: number;
} {
  const now = Date.now();
  const record = attempts.get(key);

  if (!record) {
    return { limited: false, retryAfterSeconds: 0 };
  }

  if (record.resetAt <= now) {
    attempts.delete(key);
    return { limited: false, retryAfterSeconds: 0 };
  }

  if (record.failures < MAX_FAILURES) {
    return { limited: false, retryAfterSeconds: 0 };
  }

  return {
    limited: true,
    retryAfterSeconds: Math.max(1, Math.ceil((record.resetAt - now) / 1000)),
  };
}

export function recordLoginFailure(key: string): void {
  const now = Date.now();
  const existing = attempts.get(key);

  if (!existing || existing.resetAt <= now) {
    if (existing) {
      attempts.delete(key);
    } else if (attempts.size >= MAX_TRACKED_KEYS) {
      const oldestKey = attempts.keys().next().value;

      if (oldestKey !== undefined) {
        attempts.delete(oldestKey);
      }
    }

    attempts.set(key, {
      failures: 1,
      resetAt: now + WINDOW_MS,
    });
    return;
  }

  existing.failures += 1;
  attempts.delete(key);
  attempts.set(key, existing);
}

export function clearLoginFailures(key: string): void {
  attempts.delete(key);
}
