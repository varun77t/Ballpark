import { describe, expect, it } from 'vitest';
import { accuracyPct, directionOf, evaluateGuess, isSolved, logError, percentOff, tierFor } from '../src/engine/estimate';

const spec = { answer: 1000, toleranceRatio: 1.25 };

describe('logError', () => {
  it('is symmetric in log space', () => {
    expect(logError(2000, spec)).toBeCloseTo(logError(500, spec));
    expect(logError(10000, spec)).toBeCloseTo(1);
    expect(logError(10, spec)).toBeCloseTo(2);
    expect(logError(1000, spec)).toBe(0);
  });

  it('treats guesses inside a range as exact and measures to the nearest bound', () => {
    const ranged = { answer: 1000, answerLow: 800, answerHigh: 1500, toleranceRatio: 1.5 };
    expect(logError(900, ranged)).toBe(0);
    expect(logError(1500, ranged)).toBe(0);
    expect(logError(3000, ranged)).toBeCloseTo(Math.log10(2));
    expect(logError(400, ranged)).toBeCloseTo(Math.log10(2));
    expect(directionOf(1200, ranged)).toBe('exact');
    expect(directionOf(3000, ranged)).toBe('high');
    expect(directionOf(100, ranged)).toBe('low');
  });

  it('throws on non-positive guesses', () => {
    expect(() => logError(0, spec)).toThrow();
    expect(() => logError(-1, spec)).toThrow();
  });
});

describe('tiers', () => {
  const cases: [number, string][] = [
    [1000, 'exceptional'],
    [1050, 'exceptional'],
    [1000 / 1.05, 'exceptional'],
    [1080, 'almost'],
    [1100, 'almost'],
    [1250, 'very_close'],
    [800, 'very_close'],
    [1400, 'good'],
    [1999, 'not_bad'],
    [500, 'not_bad'],
    [9000, 'getting_there'],
    [100, 'getting_there'],
    [10001, 'keep_thinking'],
    [5, 'keep_thinking'],
  ];
  it.each(cases)('guess %d → %s', (guess, key) => {
    expect(tierFor(logError(guess, spec)).key).toBe(key);
  });
});

describe('feedback', () => {
  it('reports direction and hint wording', () => {
    const high = evaluateGuess(3000, spec);
    expect(high.direction).toBe('high');
    expect(high.hint.toLowerCase()).toContain('high');
    const low = evaluateGuess(300, spec);
    expect(low.direction).toBe('low');
    expect(low.hint.toLowerCase()).toContain('low');
    expect(evaluateGuess(1000, spec).direction).toBe('exact');
  });

  it('marks solved using the tolerance ratio', () => {
    expect(evaluateGuess(1250, spec).solved).toBe(true);
    expect(evaluateGuess(1260, spec).solved).toBe(false);
    expect(isSolved(Math.log10(2), { toleranceRatio: 2 })).toBe(true);
  });

  it('maps accuracy and percent off sensibly', () => {
    expect(accuracyPct(0)).toBe(100);
    expect(accuracyPct(1)).toBe(50);
    expect(accuracyPct(5)).toBe(0);
    expect(percentOff(Math.log10(1.3))).toBeCloseTo(30);
  });
});
