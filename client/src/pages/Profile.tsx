import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import type { BreakdownRow } from '@ballpark/shared';
import { useAchievements, useMe, useRecent, useStats } from '@/api/hooks';
import { Button } from '@/components/ui/button';
import { Figure, GameCard, Heading, Loading, ProgressBar } from '@/components/ui/misc';
import { RecentList } from '@/components/home/HomeParts';
import { Wordmark } from '@/components/layout/Logo';
import { NamedIcon } from '@/lib/icons';
import { BRAND_CARD, cardColor } from '@/lib/deck';
import { cn, pct } from '@/lib/utils';

const DIFF_COLOR: Record<string, string> = { easy: '#0b7a85', medium: '#f0b606', hard: '#cc3c18', insane: '#1b1a17' };

function Breakdown({ rows, colorFor }: { rows: BreakdownRow[]; colorFor: (key: string) => string }) {
  return (
    <ul>
      {rows.map((r) => (
        <li key={r.key} className="border-t-2 border-paper-line py-3.5">
          <div className="mb-2 flex items-baseline justify-between gap-3">
            <span className="truncate text-[16px] font-bold">{r.label}</span>
            <span className="label-caps shrink-0 text-[10px] text-ink-soft tabular">
              {r.solved}/{r.attempted} hits · {pct(r.averageAccuracy)}
            </span>
          </div>
          <ProgressBar value={r.attempted ? (r.averageAccuracy ?? 0) / 100 : 0} color={colorFor(r.key)} />
        </li>
      ))}
    </ul>
  );
}

export function ProfilePage() {
  const stats = useStats();
  const achievements = useAchievements();
  const recent = useRecent(15);
  const { data: me } = useMe();

  if (stats.isLoading) return <Loading text="Loading your record" />;
  const s = stats.data;

  if (!s || s.attempted === 0) {
    return (
      <GameCard color={BRAND_CARD} className="px-6 pb-10 pt-6 sm:px-12 sm:pt-8">
        <Wordmark />
        <h1 className="display mt-14 text-[clamp(2.5rem,8vw,4.5rem)]">No record yet.</h1>
        <p className="mt-5 max-w-[40ch] text-[17px] font-semibold opacity-90">Make one guess and this page starts filling with hits, accuracy, streaks and badges.</p>
        <Button asChild variant="card" size="lg" className="mt-8">
          <Link to="/play">
            Play now <ArrowRight />
          </Link>
        </Button>
      </GameCard>
    );
  }

  return (
    <div>
      <GameCard color={BRAND_CARD} className="px-6 pb-8 pt-6 sm:px-12 sm:pb-10 sm:pt-8">
        <div className="flex items-center justify-between">
          <Wordmark />
          <span className="label-caps text-[11px] opacity-85">{me?.isGuest ? 'Guest' : 'Account'}</span>
        </div>
        <div className="mt-12 flex flex-wrap items-end justify-between gap-6">
          <div className="min-w-0">
            <h1 className="display truncate text-[clamp(2.5rem,8vw,4.5rem)]">{me?.username ?? 'Guest player'}</h1>
            <p className="mt-2 text-lg font-bold opacity-90">
              Level {s.user.level} · {s.levelTitle}
            </p>
          </div>
          <span className="display text-[clamp(4rem,14vw,7rem)] leading-none opacity-95 tabular">{s.user.level}</span>
        </div>
        <div className="mt-8">
          <div className="h-2 overflow-hidden rounded-full bg-[var(--card-field)]">
            <motion.div
              className="h-full rounded-full bg-[var(--on-card)]"
              initial={{ width: 0 }}
              animate={{ width: `${s.levelProgress * 100}%` }}
              transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
            />
          </div>
          <p className="mt-2 text-[13px] font-semibold opacity-80 tabular">
            {s.user.xp} XP · level {s.user.level + 1} at {s.nextLevelXp}
          </p>
        </div>
        {me?.isGuest && <p className="mt-6 text-[15px] font-semibold opacity-90">Playing as a guest. Create an account from the menu to keep this on every device.</p>}
      </GameCard>

      <section className="mt-14 grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-4">
        <Figure label="Played" value={s.attempted} sub={`${s.skipped} skipped`} />
        <Figure label="Hits" value={s.solved} sub={`${Math.round((s.solved / s.attempted) * 100)}% hit rate`} />
        <Figure label="Avg accuracy" value={pct(s.averageAccuracy)} />
        <Figure label="Best accuracy" value={pct(s.bestAccuracy, 1)} />
        <Figure label="Points" value={s.totalPoints.toLocaleString()} />
        <Figure label="Daily streak" value={s.dailyStreak} sub={`best ${s.bestDailyStreak}`} />
        <Figure label="Endless best" value={s.bestEndlessStreak} />
        <Figure label="Badges" value={`${s.achievementsUnlocked}/${s.achievementsTotal}`} />
      </section>

      <section className="mt-16 grid gap-12 md:grid-cols-2 [&>*]:min-w-0">
        <div>
          <Heading>By deck</Heading>
          <Breakdown rows={s.byCategory} colorFor={(k) => cardColor(k).bg} />
        </div>
        <div>
          <Heading>By difficulty</Heading>
          <Breakdown rows={s.byDifficulty} colorFor={(k) => DIFF_COLOR[k] ?? '#1b1a17'} />
        </div>
      </section>

      <section className="mt-16">
        <Heading>Badges</Heading>
        <ul className="grid gap-x-6 sm:grid-cols-2">
          {(achievements.data ?? []).map((a) => {
            const unlocked = !!a.unlockedAt;
            return (
              <li key={a.key} className="flex items-center gap-4 border-t-2 border-paper-line py-4">
                <span className={cn('grid size-12 shrink-0 place-items-center rounded-full', unlocked ? 'bg-ink text-paper' : 'bg-paper-deep text-ink-faint')}>
                  <NamedIcon name={a.icon} className="size-5" />
                </span>
                <span className="min-w-0">
                  <span className={cn('block text-[16px] font-[800]', !unlocked && 'text-ink-soft')}>{a.name}</span>
                  <span className="block text-[14px] text-ink-soft">
                    {a.description}
                    {unlocked && <span className="text-ink-faint"> · {new Date(a.unlockedAt!).toLocaleDateString()}</span>}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="mt-16">
        <Heading>History</Heading>
        <RecentList items={recent.data ?? []} />
      </section>
    </div>
  );
}
