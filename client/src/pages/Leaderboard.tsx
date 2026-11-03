import { useState } from 'react';
import type { LeaderboardBoard } from '@ballpark/shared';
import { useLeaderboard, useMe } from '@/api/hooks';
import { errorMessage } from '@/api/client';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ErrorState, GameCard, Skeleton } from '@/components/ui/misc';
import { Wordmark } from '@/components/layout/Logo';
import { INK_CARD } from '@/lib/deck';
import { cn } from '@/lib/utils';

const BOARDS: { key: LeaderboardBoard; label: string; value: string; secondary: string; blurb: string }[] = [
  { key: 'xp', label: 'All time', value: 'XP', secondary: 'Best streak', blurb: 'Total experience earned.' },
  { key: 'weekly', label: 'This week', value: 'Points', secondary: 'Hits', blurb: 'Points from the last seven days.' },
  { key: 'daily', label: 'Today', value: 'Points', secondary: 'Guesses', blurb: 'Scores on today’s daily question.' },
];

export function LeaderboardPage() {
  const [board, setBoard] = useState<LeaderboardBoard>('xp');
  const { data: me } = useMe();
  const lb = useLeaderboard(board);
  const meta = BOARDS.find((b) => b.key === board)!;
  const top = lb.data?.rows[0];

  return (
    <div>
      <GameCard color={INK_CARD} className="px-6 pb-8 pt-6 sm:px-12 sm:pb-10 sm:pt-8">
        <Wordmark />
        <h1 className="display mt-14 text-[clamp(2.75rem,9vw,5.5rem)]">Leaderboard</h1>
        <p className="mt-4 text-[17px] font-semibold opacity-85">
          {meta.blurb} Registered players only.
          {top && ` ${top.username} leads with ${top.value.toLocaleString()} ${meta.value.toLowerCase()}.`}
        </p>
      </GameCard>

      <Tabs value={board} onValueChange={(v) => setBoard(v as LeaderboardBoard)} className="mt-10">
        <TabsList>
          {BOARDS.map((b) => (
            <TabsTrigger key={b.key} value={b.key}>
              {b.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {me?.isGuest !== false && <p className="mt-6 text-[16px] text-ink-soft">You’re playing as a guest. Create an account from the menu to put your name here; your progress comes with you.</p>}

      <div className="mt-6">
        {lb.isLoading ? (
          <Skeleton className="h-72" />
        ) : lb.isError ? (
          <ErrorState message={errorMessage(lb.error)} onRetry={() => lb.refetch()} />
        ) : lb.data!.rows.length === 0 ? (
          <p className="py-10 text-[17px] text-ink-soft">Nobody on this board yet. First guess wins the spot.</p>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr className="label-caps text-left text-[10px] text-ink-soft">
                <th className="w-14 pb-3 font-bold">Rank</th>
                <th className="pb-3 font-bold">Player</th>
                <th className="pb-3 text-right font-bold">{meta.value}</th>
                <th className="hidden pb-3 text-right font-bold sm:table-cell">{meta.secondary}</th>
              </tr>
            </thead>
            <tbody>
              {lb.data!.rows.map((r) => (
                <tr key={`${r.rank}-${r.username}`} className={cn('border-t-2 border-paper-line', r.isMe && 'bg-paper-deep')}>
                  <td className="py-4 pl-1 text-2xl font-[850] tabular">{r.rank}</td>
                  <td className="py-4 text-[17px] font-bold">
                    {r.username} {r.isMe && <span className="label-caps ml-1 text-[10px] text-ink-soft">you</span>}
                  </td>
                  <td className="py-4 text-right text-[17px] font-[800] tabular">{r.value.toLocaleString()}</td>
                  <td className="hidden py-4 pr-1 text-right text-[15px] text-ink-soft tabular sm:table-cell">{r.secondary ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {lb.data?.me && !lb.data.rows.some((r) => r.isMe) && (
          <p className="mt-4 text-[16px] text-ink-soft">
            You’re <b className="text-ink">#{lb.data.me.rank}</b> with {lb.data.me.value.toLocaleString()} {meta.value.toLowerCase()}.
          </p>
        )}
      </div>
    </div>
  );
}
