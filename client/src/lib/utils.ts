import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { TIERS, type TierKey } from '@ballpark/shared';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** The player's local calendar date — the daily challenge flips at their midnight. */
export function localDate(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function heatOf(tier: TierKey): number {
  return TIERS.find((t) => t.key === tier)?.heat ?? 0;
}

export function heatColor(heat: number): string {
  return `var(--heat-${Math.max(0, Math.min(6, Math.round(heat)))})`;
}

/** Heat (0–6) for an arbitrary log error, matching the tier boundaries. */
export function heatForError(err: number): number {
  for (const t of TIERS) if (err <= Math.log10(t.maxRatio) + 1e-9) return t.heat;
  return 0;
}

export function pct(n: number | null | undefined, digits = 0): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return `${n.toFixed(digits)}%`;
}

export function timeAgo(iso: string): string {
  const s = Math.round((Date.now() - Date.parse(iso)) / 1000);
  if (s < 60) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return d === 1 ? 'yesterday' : `${d}d ago`;
}

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}
