import { forwardRef, useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { animate, motion } from 'framer-motion';
import { toast } from 'sonner';
import { ArrowDown, ArrowRight, ArrowUp, Download, ExternalLink, RotateCcw, Share2 } from 'lucide-react';
import { formatNumber, formatRatio, percentOff, type AttemptDTO, type QuestionReveal, type TierKey } from '@ballpark/shared';
import { Button } from '@/components/ui/button';
import { prefersReducedMotion } from '@/lib/utils';
import { LogRuler } from './LogRuler';
import { Stamp } from './Stamp';
import { shareImage, shareText } from './share';

function CountUp({ value }: { value: number }) {
  const [shown, setShown] = useState(prefersReducedMotion() ? value : 0);
  useEffect(() => {
    if (prefersReducedMotion()) return setShown(value);
    // Count in log space so huge numbers sweep through their orders of magnitude.
    const target = Math.log10(Math.max(value, 1e-6));
    const controls = animate(Math.min(0, target), target, {
      duration: 0.9,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setShown(Math.pow(10, v)),
      onComplete: () => setShown(value),
    });
    // Background tabs pause animation frames; never leave the real answer unshown.
    const settle = setTimeout(() => setShown(value), 1200);
    return () => {
      controls.stop();
      clearTimeout(settle);
    };
  }, [value]);
  return <>{formatNumber(shown)}</>;
}

/** Verdict words, said after the fact rather than as a nudge to keep guessing. */
const VERDICT: Record<TierKey, string> = {
  exceptional: 'Bullseye',
  almost: 'So close',
  very_close: 'Very close',
  good: 'In the ballpark',
  not_bad: 'Not bad',
  getting_there: 'Off',
  keep_thinking: 'Way off',
};

/** "24% low", "3.2× high", "dead on". */
function offBy(err: number, direction: 'high' | 'low' | 'exact'): string {
  if (direction === 'exact' || err < 1e-9) return 'dead on';
  const ratio = Math.pow(10, err);
  if (ratio >= 2) return `${formatRatio(err)} ${direction}`;
  // Percent of the answer: 100k against 132k is "24% low", not the 32% ratio.
  const p = direction === 'high' ? percentOff(err) : (1 - 1 / ratio) * 100;
  return `${Math.max(1, Math.round(p))}% ${direction}`;
}

interface VerdictProps {
  attempt: AttemptDTO;
  onNext?: () => void;
  nextLabel?: string;
  nextPending?: boolean;
  onReplay?: () => void;
  replayPending?: boolean;
  /** Secondary "more like this" route, e.g. the same deck. */
  more?: { to: string; label: string };
  /** 0..1 while an auto-advance countdown runs; null when there is none or it was paused. */
  countdown?: number | null;
}

/** The card after the guess: stamp, the answer, where you landed, and what to do next. */
export const VerdictStage = forwardRef<HTMLDivElement, VerdictProps>(function VerdictStage(
  { attempt, onNext, nextLabel = 'Next question', nextPending, onReplay, replayPending, more, countdown = null },
  actionsRef,
) {
  const q = attempt.question as QuestionReveal;
  const r = attempt.result!;
  const guess = attempt.guesses[0] ?? null;
  const hit = r.status === 'solved';
  const stamp = r.status === 'skipped' ? 'Skipped' : hit ? 'Hit' : 'Miss';
  const stampSub = attempt.practice ? 'practice' : guess ? VERDICT[guess.tier] : undefined;

  const share = async () => {
    const text = shareText(attempt);
    try {
      if (navigator.share && matchMedia('(pointer: coarse)').matches) await navigator.share({ text });
      else {
        await navigator.clipboard.writeText(text);
        toast('Result copied. Paste it anywhere.');
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') toast.error('Couldn’t share. Try saving the image instead.');
    }
  };

  const download = async () => {
    try {
      const blob = await shareImage(attempt);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ballpark-${q.slug}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch {
      toast.error('Couldn’t create the image.');
    }
  };

  const scoreLine = attempt.practice
    ? 'Practice round: nothing scored'
    : r.status === 'skipped'
      ? 'Skipped: nothing scored'
      : r.score.total === 0
        ? 'More than 10× off scores nothing. The next one is a fresh start.'
        : [
            `closeness ${r.score.base}`,
            r.score.firstGuessBonus > 0 && `instinct ${r.score.firstGuessBonus}`,
            hit && r.score.improvementBonus > 0 && `hit ${r.score.improvementBonus}`,
            r.score.multiplier !== 1 && `× ${r.score.multiplier} difficulty`,
            r.xpGained > 0 && `+${r.xpGained} XP`,
          ]
            .filter(Boolean)
            .join(' · ');

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div className="max-w-[36ch]">
          <p className="text-balance text-[15px] font-semibold leading-snug opacity-90 sm:text-base">{q.text}</p>
          {q.qualifier && <p className="mt-1 text-[13px] font-semibold leading-snug opacity-75">{q.qualifier}</p>}
        </div>
        <Stamp label={stamp} sub={stampSub} className="shrink-0" />
      </div>

      <div className="mt-4">
        <div className="display text-[clamp(2.75rem,9vw,4.25rem)] tabular">
          <CountUp value={q.answer} />
        </div>
        <div className="label-caps mt-1.5 text-[11px] opacity-85">
          {q.unit}
          {q.answerLow !== null && q.answerHigh !== null && (
            <span className="normal-case tracking-normal" style={{ fontStretch: '100%' }}>
              {' '}
              · {formatNumber(q.answerLow)} to {formatNumber(q.answerHigh)} counts as exact
            </span>
          )}
        </div>
      </div>

      {guess && (
        <p className="mt-4 flex items-center gap-2 text-lg font-[750] sm:text-xl">
          {guess.direction === 'high' ? <ArrowUp className="size-5 shrink-0" /> : guess.direction === 'low' ? <ArrowDown className="size-5 shrink-0" /> : null}
          You said {formatNumber(guess.value)} · {offBy(guess.logError, guess.direction)}
        </p>
      )}

      <LogRuler answer={q.answer} low={q.answerLow} high={q.answerHigh} tolerance={q.toleranceRatio} guess={guess?.value ?? null} />

      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-t-2 border-[var(--on-card)]/25 pt-4">
        <span className="display text-3xl tabular">
          {r.score.total.toLocaleString()} <span className="text-base font-[750] tracking-normal">pts</span>
        </span>
        <span className="text-[13px] font-semibold opacity-80">
          {scoreLine}
          {r.personalBest && ' · personal best'}
        </span>
      </div>

      <div ref={actionsRef} className="mt-5 flex flex-wrap items-center gap-2">
        {onNext && (
          <Button data-next variant="card" size="lg" onClick={onNext} disabled={nextPending} autoFocus className="relative overflow-hidden">
            {countdown !== null && (
              <motion.span
                aria-hidden
                className="absolute inset-y-0 left-0 bg-[var(--card)]/15"
                initial={false}
                animate={{ width: `${countdown * 100}%` }}
                transition={{ duration: 0.1, ease: 'linear' }}
              />
            )}
            <span className="relative inline-flex items-center gap-2.5">
              {nextLabel} <ArrowRight />
            </span>
          </Button>
        )}
        {more && (
          <Button variant="cardOutline" size="lg" asChild>
            <Link to={more.to}>{more.label}</Link>
          </Button>
        )}
        <Button variant="cardGhost" size="md" onClick={share} aria-label="Share result">
          <Share2 /> Share
        </Button>
        {onReplay && (
          <Button variant="cardGhost" size="md" onClick={onReplay} disabled={replayPending}>
            <RotateCcw /> Replay
          </Button>
        )}
        <Button variant="cardGhost" size="icon" onClick={download} aria-label="Save result as an image" title="Save as image">
          <Download />
        </Button>
      </div>
    </div>
  );
});

/** Under the card, on paper: the fact, the reasoning, the sources. Shares the card's left edge. */
export function ResultDetails({ attempt, extra }: { attempt: AttemptDTO; extra?: ReactNode }) {
  const q = attempt.question as QuestionReveal;
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="mt-10 px-6 sm:px-8"
    >
      {extra && <div className="mb-10">{extra}</div>}

      <p className="display text-balance text-[clamp(1.4rem,3.4vw,1.9rem)]">{q.fact}</p>

      <h2 className="display mt-10 text-xl">How you’d estimate it</h2>
      <p className="mt-2 text-[16px] leading-relaxed text-ink-soft">{q.explanation}</p>
      <ol className="mt-5 space-y-3">
        {q.reasoning.map((step, i) => (
          <li key={i} className="grid grid-cols-[1.75rem_1fr] gap-2 border-t-2 border-paper-line pt-3">
            <span className="text-base font-[850] tabular text-ink-faint">{i + 1}</span>
            <span className="text-[16px] leading-relaxed">{step}</span>
          </li>
        ))}
      </ol>

      <h2 className="display mt-10 text-lg">{q.answerKind === 'estimate' ? 'A Fermi estimate, built from' : 'Sources'}</h2>
      <ul className="mt-2 space-y-1.5 text-[15px] text-ink-soft">
        {q.sources.map((s, i) => (
          <li key={i}>
            {s.url ? (
              <a href={s.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 underline hover:text-ink">
                {s.label} <ExternalLink className="size-3.5" />
              </a>
            ) : (
              s.label
            )}
          </li>
        ))}
      </ul>
    </motion.div>
  );
}
