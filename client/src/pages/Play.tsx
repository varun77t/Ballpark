import { useEffect, useRef } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { X } from 'lucide-react';
import { toast } from 'sonner';
import { DIFFICULTIES, DIFFICULTY_INFO, type Difficulty } from '@ballpark/shared';
import { useAttempt, useMeta, useStartAttempt, type Filters } from '@/api/hooks';
import { errorMessage } from '@/api/client';
import { GameView } from '@/components/game/GameView';
import { ErrorState, Loading } from '@/components/ui/misc';
import { cardColor } from '@/lib/deck';

function useFilters(): Filters {
  const [params] = useSearchParams();
  const category = params.get('category') ?? undefined;
  const d = params.get('difficulty');
  const difficulty = d && (DIFFICULTIES as readonly string[]).includes(d) ? (d as Difficulty) : undefined;
  return { category, difficulty };
}

function filterQuery(f: Filters) {
  const p = new URLSearchParams();
  if (f.category) p.set('category', f.category);
  if (f.difficulty) p.set('difficulty', f.difficulty);
  const s = p.toString();
  return s ? `?${s}` : '';
}

function FilterBar({ filters }: { filters: Filters }) {
  const { data: meta } = useMeta();
  if (!filters.category && !filters.difficulty) return null;
  const cat = meta?.categories.find((c) => c.slug === filters.category);
  const color = cardColor(filters.category);
  return (
    <div className="mx-auto mb-4 flex max-w-[640px] flex-wrap items-center gap-2 px-6 sm:px-8">
      <span className="label-caps text-[10px] text-ink-soft">Deck</span>
      {cat && (
        <span className="rounded-full px-3.5 py-1.5 text-[13px] font-bold" style={{ background: color.bg, color: color.fg }}>
          {cat.name}
        </span>
      )}
      {filters.difficulty && <span className="rounded-full bg-ink px-3.5 py-1.5 text-[13px] font-bold text-paper">{DIFFICULTY_INFO[filters.difficulty].label}</span>}
      <Link to="/play" className="label-caps inline-flex items-center gap-1 px-2 text-[10px] text-ink-soft hover:text-ink">
        <X className="size-3.5" /> Any deck
      </Link>
    </div>
  );
}

/** /play — picks a question matching the filters and redirects to its attempt. */
export function PlayStartPage() {
  const filters = useFilters();
  const navigate = useNavigate();
  const start = useStartAttempt();
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    start.mutate(filters, { onSuccess: (a) => navigate(`/play/${a.id}${filterQuery(filters)}`, { replace: true }) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (start.isError) {
    return (
      <ErrorState
        title="Couldn’t start a question"
        message={errorMessage(start.error)}
        onRetry={() => start.mutate(filters, { onSuccess: (a) => navigate(`/play/${a.id}${filterQuery(filters)}`, { replace: true }) })}
      />
    );
  }
  return <Loading text="Finding a good question…" />;
}

/** /play/:attemptId — plays (or shows the result of) a single attempt. */
export function PlayAttemptPage() {
  const { attemptId } = useParams();
  const filters = useFilters();
  const navigate = useNavigate();
  const attempt = useAttempt(attemptId);
  const start = useStartAttempt();
  const { data: meta } = useMeta();

  if (attempt.isLoading) return <Loading text="Loading question…" />;
  if (attempt.isError || !attempt.data) {
    return <ErrorState title="Question not found" message={attempt.error ? errorMessage(attempt.error) : 'This attempt does not exist.'} onRetry={() => navigate('/play')} />;
  }
  const a = attempt.data;

  const next = () =>
    start.mutate(
      { ...filters, excludeId: a.question.id },
      { onSuccess: (n) => navigate(`/play/${n.id}${filterQuery(filters)}`), onError: (e) => toast.error(errorMessage(e)) },
    );
  const replay = () =>
    start.mutate(
      { questionId: a.question.id },
      { onSuccess: (n) => navigate(`/play/${n.id}${filterQuery(filters)}`), onError: (e) => toast.error(errorMessage(e)) },
    );

  // Liked this one? The natural next step is more from the same deck.
  const deckName = meta?.categories.find((c) => c.slug === a.question.category)?.name;
  const more = !filters.category && deckName ? { to: `/play?category=${a.question.category}`, label: `More ${deckName.split(' &')[0]}` } : undefined;

  return (
    <>
      <FilterBar filters={filters} />
      <GameView
        attempt={a}
        more={more}
        onNext={next}
        nextPending={start.isPending}
        onReplay={replay}
        replayPending={start.isPending}
        label={a.mode === 'daily' ? `Daily · ${a.dailyDate}` : undefined}
      />
    </>
  );
}
