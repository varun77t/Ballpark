import type { CSSProperties } from 'react';

/**
 * Card colors per category. Presentation only: the API's category colors were tuned for the old
 * dark theme, so the paper theme keeps its own full-strength set, each with its readable text color.
 */
interface CardColor {
  bg: string;
  fg: string;
  /** Translucent fill for fields and quiet pills on the card. */
  field: string;
}

const LIGHT_ON: Omit<CardColor, 'bg'> = { fg: '#ffffff', field: 'rgba(255,255,255,0.16)' };
const DARK_ON: Omit<CardColor, 'bg'> = { fg: '#1b1a17', field: 'rgba(27,26,23,0.1)' };

const DECK: Record<string, CardColor> = {
  science: { bg: '#2f5fd8', ...LIGHT_ON },
  geography: { bg: '#0b7a85', ...LIGHT_ON },
  food: { bg: '#cc3c18', ...LIGHT_ON },
  sports: { bg: '#f0b606', ...DARK_ON },
  everyday: { bg: '#c92766', ...LIGHT_ON },
  animals: { bg: '#2f7424', ...LIGHT_ON },
  space: { bg: '#6526d1', ...LIGHT_ON },
  history: { bg: '#97461f', ...LIGHT_ON },
  business: { bg: '#87193d', ...LIGHT_ON },
  india: { bg: '#ff8a1f', ...DARK_ON },
  weird: { bg: '#1b1a17', ...LIGHT_ON },
};

export const BRAND_CARD: CardColor = { bg: '#17694a', ...LIGHT_ON };
export const INK_CARD: CardColor = { bg: '#1b1a17', ...LIGHT_ON };

export function cardColor(category: string | undefined): CardColor {
  return (category && DECK[category]) || BRAND_CARD;
}

/** Inline CSS variables consumed by card-scoped utilities (bg-[var(--card)], text-[var(--on-card)]). */
export function cardVars(c: CardColor): CSSProperties {
  return { '--card': c.bg, '--on-card': c.fg, '--card-field': c.field } as CSSProperties;
}
