import confetti from 'canvas-confetti';
import { prefersReducedMotion } from '@/lib/utils';

/** A short burst in the card's own color plus ink and paper. */
export function celebrate(cardColor: string, intensity: 'normal' | 'big' = 'normal') {
  if (prefersReducedMotion()) return;
  const colors = [cardColor, '#1b1a17', '#ffffff', '#ece8df'];
  const count = intensity === 'big' ? 200 : 110;
  const fire = (ratio: number, opts: confetti.Options) =>
    confetti({ origin: { y: 0.45 }, colors, disableForReducedMotion: true, ...opts, particleCount: Math.floor(count * ratio) });
  fire(0.3, { spread: 30, startVelocity: 55 });
  fire(0.25, { spread: 70 });
  fire(0.3, { spread: 110, decay: 0.91, scalar: 0.9 });
  fire(0.15, { spread: 130, startVelocity: 30, decay: 0.92, scalar: 1.2 });
}
