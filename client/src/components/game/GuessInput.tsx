import { forwardRef, useEffect, useMemo, type FormEvent } from 'react';
import { motion, useAnimationControls } from 'framer-motion';
import { CornerDownLeft, Loader2 } from 'lucide-react';
import { formatNumber, parseGuess } from '@ballpark/shared';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const SCALES = [
  { label: '×K', factor: 1e3, title: 'thousand' },
  { label: '×M', factor: 1e6, title: 'million' },
  { label: '×B', factor: 1e9, title: 'billion' },
  { label: '×Lakh', factor: 1e5, title: 'lakh (100,000)' },
  { label: '×Cr', factor: 1e7, title: 'crore (10 million)' },
];

interface Props {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  unit: string;
  pending: boolean;
  error: string | null;
  shakeKey: number;
}

/** The single guess. Lives on the card and reads the card's colors. */
export const GuessInput = forwardRef<HTMLInputElement, Props>(function GuessInput({ value, onChange, onSubmit, unit, pending, error, shakeKey }, ref) {
  const parsed = useMemo(() => (value.trim() ? parseGuess(value) : null), [value]);
  const controls = useAnimationControls();
  const ready = !!parsed?.ok;

  // Shake without remounting, so the input keeps focus.
  useEffect(() => {
    if (shakeKey > 0) controls.start({ x: [0, -8, 8, -5, 5, -2, 0], transition: { duration: 0.4 } });
  }, [shakeKey, controls]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit();
  };

  const applyScale = (factor: number) => {
    const current = parsed?.ok ? parsed.value : 1;
    onChange(String(Number((current * factor).toPrecision(12))));
  };

  return (
    <form onSubmit={submit}>
      <motion.label
        animate={controls}
        className={cn(
          'flex items-center gap-3 rounded-[1.25rem] bg-[var(--card-field)] px-5 transition-shadow focus-within:shadow-[inset_0_0_0_2px_var(--on-card)]',
          error && 'shadow-[inset_0_0_0_2px_var(--on-card)]',
        )}
      >
        <span className="sr-only">Your guess</span>
        <input
          ref={ref}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="your guess"
          aria-invalid={!!error}
          aria-describedby="guess-help"
          inputMode="text"
          enterKeyHint="go"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          className="h-16 min-w-0 flex-1 bg-transparent text-[1.6rem] font-[800] tracking-[-0.02em] text-[var(--on-card)] tabular outline-none placeholder:text-[var(--on-card)]/65 sm:h-[4.5rem] sm:text-[1.9rem]"
        />
        <span className="label-caps max-w-[40%] shrink-0 truncate text-right text-[11px] opacity-80">{unit}</span>
      </motion.label>

      <div id="guess-help" className="mt-3 min-h-6 px-1 text-[15px] font-semibold" aria-live="polite">
        {error ? (
          <span className="underline decoration-2 underline-offset-4">{error}</span>
        ) : ready ? (
          <span className="opacity-90 tabular">
            = {parsed.value.toLocaleString('en-US', { maximumFractionDigits: 6 })}
            {parsed.value >= 1e6 && <span className="opacity-75"> · {formatNumber(parsed.value)}</span>}
          </span>
        ) : (
          <span className="opacity-75">Numbers, or words like “3 million” or “5 lakh”.</span>
        )}
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Multiply your number">
          {SCALES.map((s) => (
            <button
              key={s.label}
              type="button"
              title={`Multiply by a ${s.title}`}
              onClick={() => applyScale(s.factor)}
              className="h-9 rounded-full bg-[var(--card-field)] px-3 text-[13px] font-bold transition hover:bg-[var(--on-card)] hover:text-[var(--card)]"
            >
              {s.label}
            </button>
          ))}
        </div>
        <Button type="submit" size="lg" variant={ready ? 'card' : 'cardOutline'} disabled={pending || !value.trim()} className="ml-auto">
          {pending ? <Loader2 className="animate-spin" /> : null}
          Guess
          {!pending && <CornerDownLeft />}
        </Button>
      </div>
    </form>
  );
});
