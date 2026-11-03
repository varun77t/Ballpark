import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { ArrowRight, Loader2 } from 'lucide-react';
import type { Difficulty, EndlessRunDTO } from '@ballpark/shared';
import { useActiveRun, useAttempt, useEndRun, useMeta, useNextInRun, useRun, useStartRun, useStats, type Filters } from '@/api/hooks';
import { errorMessage } from '@/api/client';
import { GameView } from '@/components/game/GameView';
import { Button } from '@/components/ui/button';
import { ErrorState, Figure, GameCard, Loading } from '@/components/ui/misc';
import { DifficultyPicker } from '@/components/home/HomeParts';
import { Wordmark } from '@/components/layout/Logo';
import { INK_CARD, cardColor } from '@/lib/deck';
import { cn, pct } from '@/lib/utils';

function RunHeader({ run, onEnd, ending }: { run: EndlessRunDTO; onEnd: () => void; ending: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="flex items-baseline gap-2">
        <motion.span key={run.currentStreak} initial={{ scale: 1.5 }} animate={{ scale: 1 }} className="display inline-block text-3xl tabular">
          {run.currentStreak}
        </motion.span>
        <span className="label-caps text-[10px] text-ink-soft">
          in a row · best {run.bestStreak} · {run.solvedCount}/{run.questionsPlayed} hits
        </span>
      </span>
      {run.status === 'active' && (
        <button onClick={onEnd} disabled={ending} className="label-caps text-[10px] text-ink-soft underline-offset-4 hover:text-ink hover:underline">
          End run
        </button>
      )}
    </div>
  );
}

function RunSummary({ run, onRestart, pending }: { run: EndlessRunDTO; onRestart: () => void; pending: boolean }) {
  return (
    <div>
      <h2 className="display text-3xl">Run over.</h2>
      <div className="mt-6 grid grid-cols-3 gap-6">
        <Figure label="Hits" value={run.solvedCount} />
        <Figure label="Best streak" value={run.bestStreak} />
        <Figure label="Avg accuracy" value={pct(run.averageAccuracy)} />
      </div>
      <Button className="mt-8" size="lg" onClick={onRestart} disabled={pending}>
        Start a new run <ArrowRight />
      </Button>
    </div>
  );
}

export function EndlessPage() {
  const active = useActiveRun();
  const stats = useStats();
  const { data: meta } = useMeta();
  const [runId, setRunId] = useState<string | undefined>();
  const [filters, setFilters] = useState<Filters>({});
  const startRun = useStartRun();

  // Resume an in-progress run on first load.
  useEffect(() => {
    if (!runId && active.data) setRunId(active.data.id);
  }, [active.data, runId]);

  const begin = () =>
    startRun.mutate(filters, {
      onSuccess: ({ run }) => setRunId(run.id),
      onError: (e) => toast.error(errorMessage(e)),
    });

  if (active.isLoading) return <Loading text="Checking for a run in progress" />;

  if (!runId) {
    return (
      <div>
        <GameCard color={INK_CARD} className="px-6 pb-8 pt-6 sm:px-12 sm:pb-12 sm:pt-8">
          <div className="flex items-center justify-between">
            <Wordmark />
            <span className="label-caps text-[11px] opacity-80">Best streak {stats.data?.bestEndlessStreak ?? 0}</span>
          </div>
          <h1 className="display mt-14 text-[clamp(3rem,10vw,6rem)] sm:mt-20">Endless.</h1>
          <p className="mt-6 max-w-[44ch] text-[17px] font-semibold leading-relaxed opacity-85 sm:text-lg">
            Card after card, one guess each, no stopping. Every hit grows your streak; a miss resets it to zero and the next card is already on its way.
          </p>
          <Button variant="card" size="lg" className="mt-10" onClick={begin} disabled={startRun.isPending}>
            {startRun.isPending && <Loader2 className="animate-spin" />} Start run <ArrowRight />
          </Button>
        </GameCard>

        <section className="mt-12 space-y-6">
          <div>
            <div className="label-caps mb-3 text-[10px] text-ink-soft">Difficulty</div>
            <DifficultyPicker value={filters.difficulty} onChange={(difficulty: Difficulty | undefined) => setFilters((f) => ({ ...f, difficulty }))} />
          </div>
          <div>
            <div className="label-caps mb-3 text-[10px] text-ink-soft">Deck</div>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Deck">
              <button
                role="radio"
                aria-checked={!filters.category}
                onClick={() => setFilters((f) => ({ ...f, category: undefined }))}
                className={cn('h-11 rounded-full px-5 text-[15px] font-bold transition', !filters.category ? 'bg-ink text-paper' : 'bg-paper-deep text-ink-soft hover:text-ink')}
              >
                Every deck
              </button>
              {meta?.categories.map((c) => {
                const color = cardColor(c.slug);
                const on = filters.category === c.slug;
                return (
                  <button
                    key={c.slug}
                    role="radio"
                    aria-checked={on}
                    onClick={() => setFilters((f) => ({ ...f, category: c.slug }))}
                    style={on ? { background: color.bg, color: color.fg } : undefined}
                    className={cn('h-11 rounded-full px-5 text-[15px] font-bold transition', !on && 'bg-paper-deep text-ink-soft hover:text-ink')}
                  >
                    {c.name}
                  </button>
                );
              })}
            </div>
          </div>
        </section>
      </div>
    );
  }

  return <RunView runId={runId} filters={filters} onRestart={begin} restarting={startRun.isPending} />;
}

function RunView({ runId, filters, onRestart, restarting }: { runId: string; filters: Filters; onRestart: () => void; restarting: boolean }) {
  const run = useRun(runId);
  const attempt = useAttempt(run.data?.currentAttemptId ?? undefined);
  const next = useNextInRun(runId);
  const end = useEndRun(runId);

  if (run.isError) return <ErrorState message={errorMessage(run.error)} />;
  if (!run.data || !attempt.data) return <Loading text="Dealing the next card" />;

  const r = run.data;
  const ended = r.status === 'ended';
  return (
    <GameView
      attempt={attempt.data}
      header={<RunHeader run={r} onEnd={() => end.mutate()} ending={end.isPending} />}
      label={`Run · Q${r.questionsPlayed + (attempt.data.status === 'active' ? 1 : 0)}`}
      skipLabel="Skip (resets streak)"
      skipAdvances
      onNext={ended ? undefined : () => next.mutate(filters, { onError: (e) => toast.error(errorMessage(e)) })}
      nextLabel="Next card"
      nextPending={next.isPending}
      autoAdvanceMs={ended ? undefined : 2500}
      resultExtra={ended ? <RunSummary run={r} onRestart={onRestart} pending={restarting} /> : undefined}
    />
  );
}
