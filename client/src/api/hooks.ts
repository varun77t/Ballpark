import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import type {
  AchievementDTO,
  AttemptDTO,
  DailyDTO,
  Difficulty,
  EndlessRunDTO,
  FinishPayload,
  GuessResponse,
  LeaderboardBoard,
  LeaderboardDTO,
  MetaDTO,
  RecentAttemptDTO,
  StatsDTO,
  UserDTO,
} from '@ballpark/shared';
import { api } from './client';
import { localDate } from '@/lib/utils';

export const keys = {
  me: ['me'] as const,
  meta: ['meta'] as const,
  stats: ['stats'] as const,
  recent: ['recent'] as const,
  achievements: ['achievements'] as const,
  attempt: (id: string) => ['attempt', id] as const,
  daily: (date: string) => ['daily', date] as const,
  endless: (id: string) => ['endless', id] as const,
  endlessActive: ['endless', 'active'] as const,
  leaderboard: (board: LeaderboardBoard) => ['leaderboard', board] as const,
};

export interface Filters {
  category?: string;
  difficulty?: Difficulty;
}

/** Everything derived from play history goes stale when an attempt changes. */
function invalidateProgress(qc: QueryClient) {
  qc.invalidateQueries({ queryKey: keys.me });
  qc.invalidateQueries({ queryKey: keys.stats });
  qc.invalidateQueries({ queryKey: keys.recent });
  qc.invalidateQueries({ queryKey: keys.achievements });
  qc.invalidateQueries({ queryKey: ['daily'] });
  qc.invalidateQueries({ queryKey: ['leaderboard'] });
}

export const useMe = () => useQuery({ queryKey: keys.me, queryFn: () => api.get<UserDTO | null>('/auth/me') });
export const useMeta = () => useQuery({ queryKey: keys.meta, queryFn: () => api.get<MetaDTO>('/meta'), staleTime: 5 * 60_000 });
export const useStats = () => useQuery({ queryKey: keys.stats, queryFn: () => api.get<StatsDTO | null>('/stats/me') });
export const useRecent = (limit = 8) =>
  useQuery({ queryKey: [...keys.recent, limit], queryFn: () => api.get<RecentAttemptDTO[]>(`/stats/recent?limit=${limit}`) });
export const useAchievements = () => useQuery({ queryKey: keys.achievements, queryFn: () => api.get<AchievementDTO[]>('/stats/achievements') });
export const useLeaderboard = (board: LeaderboardBoard) =>
  useQuery({ queryKey: keys.leaderboard(board), queryFn: () => api.get<LeaderboardDTO>(`/leaderboard?board=${board}&date=${localDate()}`) });

export const useDaily = (date = localDate()) => useQuery({ queryKey: keys.daily(date), queryFn: () => api.get<DailyDTO>(`/daily?date=${date}`) });

export const useAttempt = (id: string | undefined) =>
  useQuery({ queryKey: keys.attempt(id ?? ''), queryFn: () => api.get<AttemptDTO>(`/attempts/${id}`), enabled: !!id });

export function useStartAttempt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Filters & { questionId?: number; excludeId?: number }) => api.post<AttemptDTO>('/play/start', body),
    onSuccess: (attempt) => {
      qc.setQueryData(keys.attempt(attempt.id), attempt);
      qc.invalidateQueries({ queryKey: keys.me });
    },
  });
}

export function useStartDaily() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { practice?: boolean } = {}) => api.post<AttemptDTO>('/daily/start', { date: localDate(), ...body }),
    onSuccess: (attempt) => {
      qc.setQueryData(keys.attempt(attempt.id), attempt);
      qc.invalidateQueries({ queryKey: ['daily'] });
      qc.invalidateQueries({ queryKey: keys.me });
    },
  });
}

export function useGuess(attemptId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (value: string) => api.post<GuessResponse>(`/attempts/${attemptId}/guess`, { value }),
    onSuccess: (res) => {
      qc.setQueryData(keys.attempt(attemptId), res.attempt);
      if (res.finish) afterFinish(qc, res.finish);
    },
  });
}

export function useEndAttempt(attemptId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (action: 'reveal' | 'skip') => api.post<FinishPayload>(`/attempts/${attemptId}/${action}`),
    onSuccess: (finish) => {
      qc.setQueryData(keys.attempt(attemptId), finish.attempt);
      afterFinish(qc, finish);
    },
  });
}

function afterFinish(qc: QueryClient, finish: FinishPayload) {
  if (finish.endless) qc.setQueryData(keys.endless(finish.endless.id), finish.endless);
  qc.invalidateQueries({ queryKey: keys.endlessActive });
  invalidateProgress(qc);
}

export const useActiveRun = () => useQuery({ queryKey: keys.endlessActive, queryFn: () => api.get<EndlessRunDTO | null>('/endless/active') });
export const useRun = (id: string | undefined) =>
  useQuery({ queryKey: keys.endless(id ?? ''), queryFn: () => api.get<EndlessRunDTO>(`/endless/${id}`), enabled: !!id });

type RunStart = { run: EndlessRunDTO; attempt: AttemptDTO };

export function useStartRun() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (filters: Filters) => api.post<RunStart>('/endless/start', filters),
    onSuccess: ({ run, attempt }) => {
      qc.setQueryData(keys.endless(run.id), run);
      qc.setQueryData(keys.attempt(attempt.id), attempt);
      qc.invalidateQueries({ queryKey: keys.endlessActive });
      qc.invalidateQueries({ queryKey: keys.me });
    },
  });
}

export function useNextInRun(runId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (filters: Filters) => api.post<RunStart>(`/endless/${runId}/next`, filters),
    onSuccess: ({ run, attempt }) => {
      qc.setQueryData(keys.endless(run.id), run);
      qc.setQueryData(keys.attempt(attempt.id), attempt);
    },
  });
}

export function useEndRun(runId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<EndlessRunDTO>(`/endless/${runId}/end`),
    onSuccess: (run) => {
      qc.setQueryData(keys.endless(run.id), run);
      qc.invalidateQueries({ queryKey: keys.endlessActive });
      invalidateProgress(qc);
    },
  });
}

export function useAuth() {
  const qc = useQueryClient();
  const onAuth = () => {
    // A different identity means every cached query may be wrong.
    qc.invalidateQueries();
  };
  return {
    login: useMutation({ mutationFn: (b: { username: string; password: string }) => api.post<UserDTO>('/auth/login', b), onSuccess: onAuth }),
    signup: useMutation({ mutationFn: (b: { username: string; password: string }) => api.post<UserDTO>('/auth/signup', b), onSuccess: onAuth }),
    logout: useMutation({
      mutationFn: () => api.post<void>('/auth/logout'),
      onSuccess: () => {
        qc.clear();
        qc.invalidateQueries();
      },
    }),
  };
}
