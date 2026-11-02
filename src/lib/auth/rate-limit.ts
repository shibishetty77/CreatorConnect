const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 5;
const MAX_TRACKED_KEYS = 5_000;

type AttemptRecord = {
  failures: number;
  resetAt: number;
};

const attempts = new Map<string, AttemptRecord>();

function pruneExpired(now: number): void {
  if (attempts.size < MAX_TRACKED_KEYS) {
    return;
  }

  for (const [key, record] of attempts) {
    if (record.resetAt <= now) {
      attempts.delete(key);
    }
  }
}

export function getClientAddress(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  const firstForwarded = forwarded?.split(",")[0]?.trim();

  return (
    firstForwarded ||
    headers.get("x-real-ip")?.trim() ||
    headers.get("cf-connecting-ip")?.trim() ||
    "unknown"
  );
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
  pruneExpired(now);

  const record = attempts.get(key);

  if (!record || record.resetAt <= now) {
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
    attempts.set(key, {
      failures: 1,
      resetAt: now + WINDOW_MS,
    });
    return;
  }

  existing.failures += 1;
}

export function clearLoginFailures(key: string): void {
  attempts.delete(key);
}
