import { motion } from 'framer-motion';
import { formatCompact } from '@ballpark/shared';

interface Props {
  answer: number;
  low: number | null;
  high: number | null;
  tolerance: number;
  guess: number | null;
}

const ease = [0.16, 1, 0.3, 1] as const;

/**
 * A log-scale ruler: decade ticks, the band that counted as a hit, the answer, and your guess.
 * Distance on the ruler is the same "orders of magnitude" the score uses.
 */
export function LogRuler({ answer, low, high, tolerance, guess }: Props) {
  const zoneLo = (low ?? answer) / tolerance;
  const zoneHi = (high ?? answer) * tolerance;
  const values = [answer, zoneLo, zoneHi, ...(guess ? [guess] : [])];
  let min = Math.log10(Math.min(...values)) - 0.45;
  let max = Math.log10(Math.max(...values)) + 0.45;
  if (max - min < 2.2) {
    const mid = (max + min) / 2;
    min = mid - 1.1;
    max = mid + 1.1;
  }
  const pos = (v: number) => ((Math.log10(v) - min) / (max - min)) * 100;
  const decades: number[] = [];
  for (let d = Math.ceil(min); d <= Math.floor(max); d++) decades.push(d);

  return (
    <div className="relative select-none pb-12 pt-9" aria-hidden>
      {/* the hit zone */}
      <motion.div
        className="absolute top-10 h-4 rounded-full bg-[var(--on-card)]/22"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.5 }}
        style={{ left: `${pos(zoneLo)}%`, width: `${Math.max(1, pos(zoneHi) - pos(zoneLo))}%` }}
      />
      {/* the rule */}
      <div className="relative h-4">
        <div className="absolute inset-x-0 top-1/2 h-[2px] -translate-y-1/2 bg-[var(--on-card)]/55" />
        {decades.map((d) => (
          <div key={d} className="absolute top-0 h-full w-[2px] -translate-x-1/2 bg-[var(--on-card)]/55" style={{ left: `${pos(10 ** d)}%` }}>
            <span className="absolute left-1/2 top-full mt-2 -translate-x-1/2 text-[11px] font-semibold opacity-75 tabular">{formatCompact(10 ** d)}</span>
          </div>
        ))}
      </div>
      {/* answer: a tall rule with its label above */}
      <motion.div
        className="absolute top-6 h-12 w-1 -translate-x-1/2 rounded-full bg-[var(--on-card)]"
        style={{ left: `${pos(answer)}%` }}
        initial={{ scaleY: 0 }}
        animate={{ scaleY: 1 }}
        transition={{ duration: 0.5, ease }}
      >
        <span className="label-caps absolute bottom-full left-1/2 mb-1.5 -translate-x-1/2 whitespace-nowrap text-[10px]">Answer</span>
      </motion.div>
      {/* your guess travels from the answer to where it landed */}
      {guess !== null && (
        <motion.div
          className="absolute top-10 size-4 -translate-x-1/2 rounded-full border-[3px] border-[var(--on-card)] bg-[var(--card)]"
          initial={{ left: `${pos(answer)}%`, opacity: 0 }}
          animate={{ left: `${pos(guess)}%`, opacity: 1 }}
          transition={{ delay: 0.25, duration: 0.9, ease }}
        >
          <span className="label-caps absolute left-1/2 top-full mt-9 -translate-x-1/2 whitespace-nowrap text-[10px]">You</span>
        </motion.div>
      )}
    </div>
  );
}
