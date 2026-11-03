/** Date helpers working on "YYYY-MM-DD" strings, interpreted as calendar days (no time zone). */

export function toDateString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function todayUtc(): string {
  return toDateString(new Date());
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return toDateString(d);
}

export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

/**
 * Players send their local calendar date so the daily flips at their midnight.
 * Anything further than one day from the server's UTC date is clamped back to UTC.
 */
export function resolvePlayerDate(requested?: string | null): string {
  const utc = todayUtc();
  if (!requested) return utc;
  return Math.abs(daysBetween(utc, requested)) <= 1 ? requested : utc;
}

/** Deterministic 32-bit hash (FNV-1a) — used to pick the daily question for a date. */
export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
