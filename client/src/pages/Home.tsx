import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Check } from 'lucide-react';
import type { Difficulty } from '@ballpark/shared';
import { useDaily, useMeta, useRecent, useStats } from '@/api/hooks';
import { Button } from '@/components/ui/button';
import { GameCard, Heading } from '@/components/ui/misc';
import { Wordmark } from '@/components/layout/Logo';
import { BRAND_CARD } from '@/lib/deck';
import { DeckPicker, DifficultyPicker, RecentList, RecordStrip } from '@/components/home/HomeParts';

export function HomePage() {
  const navigate = useNavigate();
  const [difficulty, setDifficulty] = useState<Difficulty | undefined>();
  const meta = useMeta();
  const daily = useDaily();
  const stats = useStats();
  const recent = useRecent(6);
  const d = daily.data;
  const today = new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });

  return (
    <div>
      <GameCard color={BRAND_CARD} className="px-6 pb-8 pt-6 sm:px-12 sm:pb-12 sm:pt-8">
        <div className="flex items-center justify-between">
          <Wordmark />
          <span className="label-caps text-[11px] opacity-85">{today}</span>
        </div>

        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="display mt-14 text-[clamp(3rem,10vw,6rem)] sm:mt-20"
        >
          One guess.
          <br />
          Then the truth.
        </motion.h1>
        <p className="mt-6 max-w-[42ch] text-[17px] font-semibold leading-relaxed opacity-90 sm:text-lg">
          Impossible-sounding questions, one shot each, no limit on how many you play. See how far off you were, then go again.
        </p>

        <div className="mt-10 flex flex-wrap items-center gap-3">
          <Button variant="card" size="lg" onClick={() => navigate(`/play${difficulty ? `?difficulty=${difficulty}` : ''}`)}>
            Play <ArrowRight />
          </Button>
          <Button variant="cardOutline" size="lg" asChild>
            <Link to="/endless">Endless run</Link>
          </Button>
        </div>

        <Link
          to="/daily"
          className="mt-10 flex items-center gap-4 rounded-[1.5rem] bg-[var(--card-field)] px-5 py-4 transition hover:bg-[var(--on-card)] hover:text-[var(--card)] sm:px-6"
        >
          <span className="label-caps shrink-0 text-[10px]">{d?.completed ? 'Daily done' : 'Today’s daily'}</span>
          <span className="min-w-0 flex-1 truncate text-[16px] font-bold">{d ? d.question.text : 'Loading today’s question…'}</span>
          {d?.completed ? <Check className="size-5 shrink-0" /> : <ArrowRight className="size-5 shrink-0" />}
        </Link>
        {d && (
          <p className="mt-3 px-1 text-[13px] font-semibold opacity-80">
            {d.streak > 0 ? `${d.streak}-day streak` : 'Start a streak today'} · {d.solvers.toLocaleString()} {d.solvers === 1 ? 'hit' : 'hits'} so far today
          </p>
        )}
      </GameCard>

      <section className="mt-16">
        <Heading action={<DifficultyPicker value={difficulty} onChange={setDifficulty} className="hidden md:inline-flex" />}>Pick a deck</Heading>
        <DifficultyPicker value={difficulty} onChange={setDifficulty} className="mb-5 md:hidden" />
        <DeckPicker categories={meta.data?.categories} difficulty={difficulty} />
      </section>

      <section className="mt-16">
        <Heading
          action={
            stats.data && stats.data.attempted > 0 ? (
              <Link to="/profile" className="label-caps text-[11px] underline">
                Full record
              </Link>
            ) : undefined
          }
        >
          Your record
        </Heading>
        <RecordStrip stats={stats.data} loading={stats.isLoading} />
      </section>

      {(recent.data?.length ?? 0) > 0 && (
        <section className="mt-16">
          <Heading>Recently played</Heading>
          <RecentList items={recent.data ?? []} />
        </section>
      )}
    </div>
  );
}
