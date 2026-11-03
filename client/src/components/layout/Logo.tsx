import { cn } from '@/lib/utils';

/** Concentric rings: the target you are trying to land in. Draws in currentColor. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn('size-6', className)} aria-hidden fill="none" stroke="currentColor">
      <circle cx="16" cy="16" r="13" strokeWidth="3.2" />
      <circle cx="16" cy="16" r="6.5" strokeWidth="3.2" />
      <circle cx="16" cy="16" r="1.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2 text-[17px] font-[850] tracking-[-0.02em]', className)}>
      <LogoMark className="size-5" />
      Ballpark
    </span>
  );
}
