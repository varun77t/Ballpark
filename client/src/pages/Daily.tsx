import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAttempt, useDaily, useStartDaily } from '@/api/hooks';
import { errorMessage } from '@/api/client';
import { GameView } from '@/components/game/GameView';
import { ErrorState, Loading } from '@/components/ui/misc';

function useCountdown() {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  const mins = Math.max(0, Math.round((midnight.getTime() - now.getTime()) / 60000));
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

export function DailyPage() {
  const navigate = useNavigate();
  const daily = useDaily();
  const start = useStartDaily();
  const started = useRef(false);
  // A practice replay temporarily replaces the scored attempt on screen.
  const [practiceId, setPracticeId] = useState<string | undefined>();
  const attemptId = practiceId ?? daily.data?.attempt?.id;
  const attempt = useAttempt(attemptId);
  const countdown = useCountdown();

  // Opening the daily starts (or resumes) today's scored attempt.
  useEffect(() => {
    if (daily.data && !daily.data.attempt && !started.current) {
      started.current = true;
      start.mutate({});
    }
  }, [daily.data, start]);

  if (daily.isError) return <ErrorState message={errorMessage(daily.error)} onRetry={() => daily.refetch()} />;
  if (start.isError) return <ErrorState message={errorMessage(start.error)} onRetry={() => start.mutate({})} />;
  if (!daily.data || !attempt.data) return <Loading text="Loading today’s question" />;

  const d = daily.data;
  const dateLabel = new Date(`${d.date}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

  const header = (
    <p className="label-caps mb-5 text-center text-[10px] text-ink-soft">
      {d.streak > 0 ? `${d.streak}-day streak · best ${d.bestStreak}` : 'Play today to start a streak'} · {d.solvers.toLocaleString()} {d.solvers === 1 ? 'hit' : 'hits'} today
    </p>
  );

  const resultExtra = (
    <p className="text-[17px] leading-relaxed text-ink-soft">
      {attempt.data.practice ? 'Practice round. Your scored guess for today is kept. ' : 'Everyone in the world gets this same question today. '}
      The next daily arrives in <b className="text-ink">{countdown}</b>. Until then, the rest of the deck is unlimited.
    </p>
  );

  return (
    <GameView
      attempt={attempt.data}
      header={header}
      label={attempt.data.practice ? `Practice · ${dateLabel}` : `Daily · ${dateLabel}`}
      allowSkip={false}
      onNext={() => navigate('/play')}
      nextLabel="Keep playing"
      onReplay={() => start.mutate({ practice: true }, { onSuccess: (a) => setPracticeId(a.id) })}
      replayPending={start.isPending}
      resultExtra={resultExtra}
    />
  );
}
