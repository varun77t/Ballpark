import type * as React from 'react';
import { motion } from 'framer-motion';
import { DIFFICULTY_INFO, type Difficulty } from '@ballpark/shared';
import { cn } from '@/lib/utils';
import { cardColor, cardVars } from '@/lib/deck';

/** The one container: a full-strength colored card. Children read --card / --on-card. */
export function GameCard({
  category,
  color,
  className,
  children,
}: {
  category?: string;
  color?: ReturnType<typeof cardColor>;
  className?: string;
  children: React.ReactNode;
}) {
  const c = color ?? cardColor(category);
  return (
    <section
      style={cardVars(c)}
      className={cn('on-card relative rounded-[var(--radius-card)] bg-[var(--card)] text-[var(--on-card)] shadow-[var(--shadow-card)]', className)}
    >
      {children}
    </section>
  );
}

export function Heading({ children, action, className }: { children: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn('mb-5 flex items-end justify-between gap-4', className)}>
      <h2 className="display text-2xl sm:text-3xl">{children}</h2>
      {action}
    </div>
  );
}

export function DifficultyTag({ difficulty, className }: { difficulty: Difficulty; className?: string }) {
  return <span className={cn('label-caps text-[11px] opacity-80', className)}>{DIFFICULTY_INFO[difficulty].label}</span>;
}

/** A number set in display type with a quiet caption: stats are type, not tiles. */
export function Figure({ label, value, sub, className }: { label: string; value: React.ReactNode; sub?: React.ReactNode; className?: string }) {
  return (
    <div className={cn('min-w-0', className)}>
      <div className="display text-4xl tabular sm:text-5xl">{value}</div>
      <div className="label-caps mt-2 text-[10px] text-ink-soft">{label}</div>
      {sub && <div className="mt-1 text-[13px] text-ink-faint">{sub}</div>}
    </div>
  );
}

export function ProgressBar({ value, color = 'var(--ink)', className }: { value: number; color?: string; className?: string }) {
  return (
    <div className={cn('h-1.5 overflow-hidden rounded-full bg-paper-line/70', className)}>
      <motion.div
        className="h-full rounded-full"
        style={{ background: color }}
        initial={{ width: 0 }}
        animate={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }}
        transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
      />
    </div>
  );
}

export function Loading({ text }: { text: string }) {
  return (
    <div className="grid min-h-[60vh] place-items-center">
      <span className="label-caps flex items-center gap-3 text-[11px] text-ink-soft">
        <span className="size-2.5 animate-ping rounded-full bg-ink" aria-hidden /> {text}
      </span>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-[var(--radius-card)] bg-paper-deep', className)} />;
}

export function ErrorState({ title = 'That didn’t work', message, onRetry }: { title?: string; message: string; onRetry?: () => void }) {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <div className="display text-3xl">{title}</div>
      <p className="mt-3 text-ink-soft">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="label-caps mt-6 text-xs underline">
          Try again
        </button>
      )}
    </div>
  );
}

