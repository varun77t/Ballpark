import type { QuestionPublic } from '@ballpark/shared';
import { DIFFICULTY_INFO } from '@ballpark/shared';
import { useMeta } from '@/api/hooks';
import { Wordmark } from '@/components/layout/Logo';

/** Top strip of every game card: brand, deck, and where this card sits. */
export function CardHeader({ question, right }: { question: QuestionPublic; right: string }) {
  const { data: meta } = useMeta();
  const category = meta?.categories.find((c) => c.slug === question.category);
  return (
    <div className="flex items-center justify-between gap-3">
      <Wordmark className="hidden sm:inline-flex" />
      <span className="label-caps truncate text-[11px] opacity-85">
        {category?.name ?? question.category} · {DIFFICULTY_INFO[question.difficulty].label}
      </span>
      <span className="label-caps shrink-0 text-[11px] opacity-85 tabular">{right}</span>
    </div>
  );
}
