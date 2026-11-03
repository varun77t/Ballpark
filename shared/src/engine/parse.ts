/**
 * Turns free-form numeric input into a number.
 *
 * Accepts: "1000000", "1,000,000", "1 000 000", "1_000_000", "1e6", "1.2E+9",
 * "2.5k", "3M", "1.2b", "4 trillion", "3 million", "5 lakh", "2 crore",
 * "1.5 thousand", "10^6", and combinations like "2.5 million".
 */

export type ParseResult =
  | { ok: true; value: number }
  | { ok: false; reason: ParseErrorReason; message: string };

export type ParseErrorReason = 'empty' | 'invalid' | 'zero' | 'negative' | 'too_small' | 'too_large';

export const MIN_GUESS = 1e-6;
export const MAX_GUESS = 1e30;

const MULTIPLIERS: Record<string, number> = {
  k: 1e3,
  thousand: 1e3,
  thousands: 1e3,
  m: 1e6,
  mn: 1e6,
  mil: 1e6,
  million: 1e6,
  millions: 1e6,
  b: 1e9,
  bn: 1e9,
  billion: 1e9,
  billions: 1e9,
  t: 1e12,
  tn: 1e12,
  trillion: 1e12,
  trillions: 1e12,
  quadrillion: 1e15,
  quintillion: 1e18,
  lakh: 1e5,
  lakhs: 1e5,
  lac: 1e5,
  lacs: 1e5,
  crore: 1e7,
  crores: 1e7,
  cr: 1e7,
};

const NUMBER_RE = /^([0-9]*\.?[0-9]+|[0-9]+\.)(?:e([+-]?[0-9]+))?$/;
const POWER_RE = /^([0-9]*\.?[0-9]+)\s*(?:\^|\*\*)\s*([+-]?[0-9]+)$/;

export function parseGuess(raw: string | number): ParseResult {
  if (typeof raw === 'number') return validateGuess(raw);

  let s = raw.trim().toLowerCase();
  if (s === '') return fail('empty', 'Type a number to make a guess.');

  // "≈", "~" and "about" are harmless prefixes people type when estimating.
  s = s.replace(/^(≈|~|about|around|approx\.?|approximately)\s*/, '');
  s = s.replace(/\s*[×x*]\s*10\s*(?:\^|\*\*)\s*/g, 'e');

  let negative = false;
  if (s.startsWith('-') || s.startsWith('−')) {
    negative = true;
    s = s.slice(1).trim();
  } else if (s.startsWith('+')) {
    s = s.slice(1).trim();
  }

  // Strip digit-group separators: commas, underscores, apostrophes and spaces between digits.
  s = s.replace(/(\d)[,_'’](?=\d)/g, '$1').replace(/(\d)\s+(?=\d)/g, '$1');

  let value: number | null = null;

  const power = s.match(POWER_RE);
  if (power) {
    value = Math.pow(Number(power[1]), Number(power[2]));
  } else {
    // Split a trailing word multiplier ("2.5 million", "3m", "5 lakh") from the numeric part.
    const m = s.match(/^([0-9.e+-]+)\s*([a-z]+)?$/);
    if (!m) return fail('invalid', "That doesn't look like a number.");
    const [, numPart, word] = m;
    if (!NUMBER_RE.test(numPart)) return fail('invalid', "That doesn't look like a number.");
    let n = Number(numPart);
    if (word) {
      const mult = MULTIPLIERS[word];
      if (mult === undefined) return fail('invalid', `Unknown scale "${word}". Try k, million, billion, lakh or crore.`);
      n *= mult;
    }
    value = n;
  }

  if (negative) value = -value;
  return validateGuess(value);
}

export function validateGuess(value: number): ParseResult {
  if (!Number.isFinite(value) || Number.isNaN(value)) return fail('invalid', "That doesn't look like a finite number.");
  if (value === 0) return fail('zero', "Zero? Something's always there — try a tiny number instead.");
  if (value < 0) return fail('negative', 'Estimates must be positive.');
  if (value < MIN_GUESS) return fail('too_small', 'That is smaller than any answer in this game.');
  if (value > MAX_GUESS) return fail('too_large', 'That is bigger than any answer in this game (max 10³⁰).');
  return { ok: true, value };
}

function fail(reason: ParseErrorReason, message: string): ParseResult {
  return { ok: false, reason, message };
}
