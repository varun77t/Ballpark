import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { DIFFICULTIES, DIFFICULTY_INFO, levelFromXp, type CategoryDTO, type Difficulty, type RecentAttemptDTO, type StatsDTO } from '@ballpark/shared';
import { Figure, Skeleton } from '@/components/ui/misc';
import { cardColor } from '@/lib/deck';
import { cn, pct, timeAgo } from '@/lib/utils';

export function DifficultyPicker({ value, onChange, className }: { value: Difficulty | undefined; onChange: (d: Difficulty | undefined) => void; className?: string }) {
  const options: (Difficulty | undefined)[] = [undefined, ...DIFFICULTIES];
  return (
    <div className={cn('inline-flex flex-wrap gap-1 rounded-full bg-paper-deep p-1', className)} role="radiogroup" aria-label="Difficulty">
      {options.map((d) => {
        const active = value === d;
        return (
          <button
            key={d ?? 'any'}
            role="radio"
            aria-checked={active}
            title={d ? DIFFICULTY_INFO[d].blurb : 'Any difficulty'}
            onClick={() => onChange(d)}
            className={cn('label-caps h-10 rounded-full px-4 text-[11px] transition', active ? 'bg-ink text-paper' : 'text-ink-soft hover:text-ink')}
          >
            {d ? DIFFICULTY_INFO[d].label : 'Any'}
          </button>
        );
      })}
    </div>
  );
}

/** Decks are pills in their own card color: the color you will play on. */
export function DeckPicker({ categories, difficulty }: { categories?: CategoryDTO[]; difficulty?: Difficulty }) {
  if (!categories) {
    return (
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 11 }, (_, i) => (
          <Skeleton key={i} className="h-14 w-40 rounded-full" />
        ))}
      </div>
    );
  }
  return (
    <div className="flex flex-wrap gap-2">
      {categories.map((c, i) => {
        const color = cardColor(c.slug);
        return (
          <motion.div key={c.slug} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.025, duration: 0.4 }}>
            <Link
              to={`/play?category=${c.slug}${difficulty ? `&difficulty=${difficulty}` : ''}`}
              style={{ background: color.bg, color: color.fg }}
              className="inline-flex h-14 items-center gap-3 rounded-full pl-6 pr-5 text-[17px] font-[800] tracking-[-0.01em] transition-transform hover:-translate-y-0.5 active:scale-[0.98]"
            >
              {c.name}
              <span className="text-[13px] font-semibold opacity-75 tabular">{c.questionCount}</span>
            </Link>
          </motion.div>
        );
      })}
    </div>
  );
}

export function RecordStrip({ stats, loading }: { stats?: StatsDTO | null; loading: boolean }) {
  if (loading) return <Skeleton className="h-28" />;
  if (!stats || stats.attempted === 0) {
    return <p className="max-w-[48ch] text-[17px] leading-relaxed text-ink-soft">Your first guess starts your record: hits, accuracy, streaks and badges. No sign-up needed.</p>;
  }
  const lvl = levelFromXp(stats.user.xp);
  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-4">
      <Figure label="Level" value={lvl.level} sub={stats.levelTitle} />
      <Figure label="Hits" value={stats.solved} sub={`of ${stats.attempted} played`} />
      <Figure label="Avg accuracy" value={pct(stats.averageAccuracy)} />
      <Figure label="Daily streak" value={stats.dailyStreak} sub={`best ${stats.bestDailyStreak}`} />
    </div>
  );
}

const STATUS: Record<string, string> = { solved: 'Hit', revealed: 'Miss', skipped: 'Skipped', active: 'Open' };

export function RecentList({ items }: { items: RecentAttemptDTO[] }) {
  if (items.length === 0) return <p className="text-[17px] text-ink-soft">Nothing played yet.</p>;
  return (
    <ul>
      {items.map((r) => (
        <li key={r.id} className="border-t-2 border-paper-line first:border-t-0">
          <Link to={`/play/${r.id}`} className="group grid grid-cols-[auto_1fr_auto] items-center gap-4 py-4">
            <span className="size-3 rounded-full" style={{ background: cardColor(r.category).bg }} aria-hidden />
            <span className="truncate text-[16px] font-semibold group-hover:underline">{r.questionText}</span>
            <span className="label-caps text-[10px] text-ink-soft tabular">
              {STATUS[r.status]}
              {r.accuracy !== null && ` · ${Math.round(r.accuracy)}%`}
              <span className="hidden sm:inline"> · {timeAgo(r.finishedAt ?? r.startedAt)}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
