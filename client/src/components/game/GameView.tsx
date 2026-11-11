import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { toast } from 'sonner';
import { ArrowRight, Loader2 } from 'lucide-react';
import { parseGuess, type AttemptDTO, type FinishPayload } from '@ballpark/shared';
import { useEndAttempt, useGuess } from '@/api/hooks';
import { errorMessage, RequestError } from '@/api/client';
import { GameCard } from '@/components/ui/misc';
import { Tooltip } from '@/components/ui/tooltip';
import { NamedIcon } from '@/lib/icons';
import { cardColor, cardVars } from '@/lib/deck';
import { CardHeader } from './CardHeader';
import { GuessInput } from './GuessInput';
import { ResultDetails, VerdictStage } from './ResultPanel';
import { celebrate } from './celebrate';

interface Props {
  attempt: AttemptDTO;
  /** Shown above the card, e.g. an endless-run streak line. Aligned to the card's content edge. */
  header?: ReactNode;
  label?: string;
  allowSkip?: boolean;
  skipLabel?: string;
  /** Whether skipping immediately moves on to the next question (via onNext). */
  skipAdvances?: boolean;
  onNext?: () => void;
  nextLabel?: string;
  nextPending?: boolean;
  onReplay?: () => void;
  replayPending?: boolean;
  more?: { to: string; label: string };
  /** After the verdict, move on automatically after this many ms unless the player engages. */
  autoAdvanceMs?: number;
  onFinished?: (finish: FinishPayload) => void;
  resultExtra?: ReactNode;
}

function announce(finish: FinishPayload) {
  for (const a of finish.newAchievements) {
    toast(a.name, { description: a.description, icon: <NamedIcon name={a.icon} className="size-5" />, duration: 6000 });
  }
  if (finish.levelUp) toast(`Level ${finish.levelUp.to}. Nice.`, { duration: 6000 });
  if (finish.daily && finish.daily.streak > 1) toast(`${finish.daily.streak} days in a row.`);
}

const toleranceText = (ratio: number) => (ratio >= 2 ? `within ${ratio}×` : `within ${Math.round((ratio - 1) * 100)}%`);

/**
 * Counts down to the next card. Reading on (scrolling), pressing other keys or clicking
 * anything but Next pauses it for good; a hidden tab simply doesn't count.
 */
function useAutoAdvance(active: boolean, ms: number | undefined, onNext: (() => void) | undefined, key: string) {
  const [progress, setProgress] = useState<number | null>(null);
  const next = useRef(onNext);
  next.current = onNext;

  useEffect(() => {
    if (!active || !ms || !next.current) {
      setProgress(null);
      return;
    }
    let elapsed = 0;
    let done = false;
    setProgress(0);
    const stop = () => {
      done = true;
      clearInterval(timer);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onPointer);
    };
    const pause = () => {
      stop();
      setProgress(null);
    };
    const onScroll = () => window.scrollY > 160 && pause();
    const onKey = (e: KeyboardEvent) => e.key !== 'Enter' && pause();
    const onPointer = (e: PointerEvent) => !(e.target as Element | null)?.closest('[data-next]') && pause();
    const timer = setInterval(() => {
      if (done || document.hidden) return;
      elapsed += 100;
      if (elapsed >= ms) {
        stop();
        next.current?.();
      } else setProgress(elapsed / ms);
    }, 100);
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onPointer);
    return stop;
  }, [active, ms, key]);

  return progress;
}

/** One question, one guess: the card holds the question, then turns into the verdict. */
export function GameView({
  attempt,
  header,
  label,
  allowSkip = true,
  skipLabel = 'Skip this one',
  skipAdvances = true,
  onNext,
  nextLabel,
  nextPending,
  onReplay,
  replayPending,
  more,
  autoAdvanceMs,
  onFinished,
  resultExtra,
}: Props) {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [shakeKey, setShakeKey] = useState(0);
  const [actionsVisible, setActionsVisible] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);
  const guess = useGuess(attempt.id);
  const end = useEndAttempt(attempt.id);
  const finished = attempt.status !== 'active' && !!attempt.result;
  const q = attempt.question;
  const color = cardColor(q.category);
  const countdown = useAutoAdvance(finished && !nextPending, autoAdvanceMs, onNext, attempt.id);

  useEffect(() => {
    setValue('');
    setError(null);
    if (attempt.status === 'active') {
      inputRef.current?.focus({ preventScroll: true });
      window.scrollTo({ top: 0 });
    }
  }, [attempt.id, attempt.status]);

  // When the player scrolls down to read, keep Next within thumb's reach.
  useEffect(() => {
    const el = actionsRef.current;
    if (!finished || !el) return setActionsVisible(true);
    const io = new IntersectionObserver(([entry]) => setActionsVisible(entry.isIntersecting), { threshold: 0.2 });
    io.observe(el);
    return () => io.disconnect();
  }, [finished, attempt.id]);

  const fail = (message: string) => {
    setError(message);
    setShakeKey((k) => k + 1);
    inputRef.current?.focus();
  };

  const submit = () => {
    if (guess.isPending) return;
    const parsed = parseGuess(value);
    if (!parsed.ok) return fail(parsed.message);
    setError(null);
    guess.mutate(value, {
      onSuccess: (res) => {
        if (res.feedback.solved) celebrate(color.bg, res.feedback.tier === 'exceptional' ? 'big' : 'normal');
        announce(res.finish);
        onFinished?.(res.finish);
      },
      onError: (err) => {
        if (err instanceof RequestError && err.code === 'attempt_finished') toast('You already guessed this one.');
        else fail(errorMessage(err));
      },
    });
  };

  const skip = () =>
    end.mutate('skip', {
      onSuccess: (payload) => {
        announce(payload);
        onFinished?.(payload);
        if (skipAdvances && onNext) onNext();
      },
      onError: (err) => toast.error(errorMessage(err)),
    });

  return (
    <div className="mx-auto w-full max-w-[640px]">
      {header && <div className="mb-4 px-6 sm:px-8">{header}</div>}
      <GameCard color={color} className="px-6 pb-6 pt-5 sm:px-8 sm:pb-8 sm:pt-6">
        <CardHeader question={q} right={label ?? `No. ${attempt.number}`} />
        {finished ? (
          <motion.div key={`verdict-${attempt.id}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }} className="mt-6">
            <VerdictStage
              ref={actionsRef}
              attempt={attempt}
              onNext={onNext}
              nextLabel={nextLabel}
              nextPending={nextPending}
              onReplay={onReplay}
              replayPending={replayPending}
              more={more}
              countdown={countdown}
            />
          </motion.div>
        ) : (
          <motion.div key={`ask-${attempt.id}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}>
            <h1 className="display mt-8 text-balance text-[clamp(1.75rem,4.8vw,2.6rem)] sm:mt-10">{q.text}</h1>
            {q.qualifier && <p className="mt-3 max-w-[52ch] text-pretty text-[16px] font-semibold leading-snug opacity-90">{q.qualifier}</p>}
            <p className="mt-3 text-[14px] font-semibold opacity-85">
              One guess. A hit is {toleranceText(q.toleranceRatio)}.{' '}
              <Tooltip
                content={
                  q.answerKind === 'estimate'
                    ? 'The answer is a reasoned estimate with stated assumptions; anything inside its range counts as exact.'
                    : 'The answer is a documented figure. Sources appear after you guess.'
                }
              >
                <button type="button" className="underline decoration-2 underline-offset-4">
                  {q.answerKind === 'estimate' ? 'Fermi estimate' : 'Real figure'}
                </button>
              </Tooltip>
            </p>
            <div className="mt-7 sm:mt-9">
              <GuessInput
                ref={inputRef}
                value={value}
                onChange={(v) => {
                  setValue(v);
                  if (error) setError(null);
                }}
                onSubmit={submit}
                unit={q.unit}
                pending={guess.isPending}
                error={error}
                shakeKey={shakeKey}
              />
            </div>
          </motion.div>
        )}
      </GameCard>

      {!finished && allowSkip && (
        <div className="mt-4 px-6 sm:px-8">
          <button
            onClick={skip}
            disabled={end.isPending}
            className="label-caps inline-flex items-center gap-2 text-[10px] text-ink-soft underline-offset-4 hover:text-ink hover:underline"
          >
            {end.isPending && <Loader2 className="size-3.5 animate-spin" />} {skipLabel}
          </button>
        </div>
      )}

      {finished && <ResultDetails attempt={attempt} extra={resultExtra} />}

      <AnimatePresence>
        {finished && onNext && !actionsVisible && (
          <motion.button
            data-next
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.2 }}
            onClick={onNext}
            disabled={nextPending}
            style={cardVars(color)}
            className="label-caps fixed bottom-5 left-1/2 z-30 inline-flex h-14 -translate-x-1/2 items-center gap-2.5 rounded-full bg-[var(--card)] px-7 text-[13px] text-[var(--on-card)] shadow-[var(--shadow-card)]"
          >
            {nextLabel ?? 'Next question'} <ArrowRight className="size-4" />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
