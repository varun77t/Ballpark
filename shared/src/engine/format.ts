const SCALES: [number, string, string][] = [
  [1e18, 'quintillion', 'Qi'],
  [1e15, 'quadrillion', 'Qa'],
  [1e12, 'trillion', 'T'],
  [1e9, 'billion', 'B'],
  [1e6, 'million', 'M'],
];

function trim(n: number, digits: number): string {
  return Number(n.toPrecision(digits)).toLocaleString('en-US', { maximumFractionDigits: 6 });
}

/** "2.5 million", "38,400", "0.42" — human-readable, about three significant digits. */
export function formatNumber(value: number, digits = 3): string {
  if (!Number.isFinite(value)) return '—';
  const abs = Math.abs(value);
  if (abs >= 1e21) return value.toExponential(digits - 1).replace('e+', ' × 10^');
  for (const [scale, word] of SCALES) {
    if (abs >= scale) return `${trim(value / scale, digits)} ${word}`;
  }
  if (abs >= 1000) return Math.round(value).toLocaleString('en-US');
  if (abs >= 1) return trim(value, digits);
  if (abs === 0) return '0';
  return Number(value.toPrecision(digits)).toString();
}

/** Compact variant for tight spaces: "2.5M", "38.4K". */
export function formatCompact(value: number): string {
  const abs = Math.abs(value);
  for (const [scale, , short] of SCALES) {
    if (abs >= scale) return `${trim(value / scale, 3)}${short}`;
  }
  if (abs >= 1e4) return `${trim(value / 1e3, 3)}K`;
  return formatNumber(value);
}

/** "3.2×" style ratio between a guess and the reference. */
export function formatRatio(logError: number): string {
  const ratio = Math.pow(10, logError);
  if (ratio < 10) return `${ratio.toFixed(ratio < 2 ? 2 : 1)}×`;
  return `${formatCompact(ratio)}×`;
}
