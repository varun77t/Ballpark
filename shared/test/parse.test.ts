import { describe, expect, it } from 'vitest';
import { parseGuess } from '../src/engine/parse';

const value = (s: string | number) => {
  const r = parseGuess(s);
  if (!r.ok) throw new Error(`expected ok for ${s}: ${r.message}`);
  return r.value;
};
const reason = (s: string | number) => {
  const r = parseGuess(s);
  if (r.ok) throw new Error(`expected failure for ${s}`);
  return r.reason;
};

describe('parseGuess', () => {
  it('treats different notations of one million identically', () => {
    for (const s of ['1000000', '1,000,000', '1 000 000', '1_000_000', '1e6', '1E+6', '1 million', '1M', '1m', '1000k', '10 lakh', '0.1 crore', '10^6', '1 x 10^6', '1×10^6']) {
      expect(value(s)).toBeCloseTo(1e6, 6);
    }
  });

  it('parses decimals and scale words', () => {
    expect(value('2.5k')).toBe(2500);
    expect(value('3 billion')).toBe(3e9);
    expect(value('1.2B')).toBeCloseTo(1.2e9);
    expect(value('4 trillion')).toBe(4e12);
    expect(value('5 lakh')).toBe(500000);
    expect(value('2 crore')).toBe(2e7);
    expect(value('1.5 thousand')).toBe(1500);
    expect(value('.5')).toBe(0.5);
    expect(value('7.')).toBe(7);
  });

  it('tolerates prefixes and whitespace', () => {
    expect(value('  ~ 300  ')).toBe(300);
    expect(value('about 40k')).toBe(40000);
    expect(value('+12')).toBe(12);
  });

  it('accepts raw numbers', () => {
    expect(value(42)).toBe(42);
  });

  it('rejects empty, zero, negative and junk input', () => {
    expect(reason('')).toBe('empty');
    expect(reason('   ')).toBe('empty');
    expect(reason('0')).toBe('zero');
    expect(reason('0.0')).toBe('zero');
    expect(reason('-5')).toBe('negative');
    expect(reason(-5)).toBe('negative');
    expect(reason('abc')).toBe('invalid');
    expect(reason('12 bananas')).toBe('invalid');
    expect(reason('1.2.3')).toBe('invalid');
    expect(reason(NaN)).toBe('invalid');
    expect(reason(Infinity)).toBe('invalid');
  });

  it('rejects absurd magnitudes', () => {
    expect(reason('1e-9')).toBe('too_small');
    expect(reason('1e40')).toBe('too_large');
  });
});
