import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { eq } from 'drizzle-orm';
import type { AttemptDTO, DailyDTO, EndlessRunDTO, FinishPayload, GuessResponse, LeaderboardDTO, StatsDTO } from '@ballpark/shared';
import { createApp } from '../src/app';
import { db, pool } from '../src/db/client';
import { questions } from '../src/db/schema';
import { OTHER_USER, TEST_USER } from './fixtures';

const app = createApp();
const agent = () => request.agent(app);

async function answerOf(questionId: number): Promise<number> {
  const [q] = await db.select().from(questions).where(eq(questions.id, questionId));
  return q.answer;
}

async function reset() {
  await pool.query('delete from daily_challenges; delete from users; delete from session');
}

beforeEach(reset);
afterAll(async () => {
  await reset();
  await pool.end();
});

describe('guess flow (one shot per question)', () => {
  it('hides the answer until the single guess, then finishes immediately', async () => {
    const a = agent();
    const attempt = (await a.post('/api/play/start').send({}).expect(201)).body as AttemptDTO;
    expect(attempt.status).toBe('active');
    expect(JSON.stringify(attempt)).not.toMatch(/"answer"|"explanation"|"reasoning"/);

    const answer = await answerOf(attempt.question.id);
    const miss = (await a.post(`/api/attempts/${attempt.id}/guess`).send({ value: String(answer * 1000) }).expect(200)).body as GuessResponse;
    expect(miss.feedback.direction).toBe('high');
    expect(miss.feedback.tier).toBe('keep_thinking');
    expect(miss.feedback.solved).toBe(false);
    expect(miss.attempt.status).toBe('revealed');
    expect((miss.attempt.question as { answer: number }).answer).toBe(answer);
    expect(miss.attempt.number).toBe(1);

    // No second guess on the same question.
    await a.post(`/api/attempts/${attempt.id}/guess`).send({ value: answer }).expect(409);

    const next = (await a.post('/api/play/start').send({ excludeId: attempt.question.id }).expect(201)).body as AttemptDTO;
    const hit = (await a.post(`/api/attempts/${next.id}/guess`).send({ value: (await answerOf(next.question.id)) * 1.02 }).expect(200)).body as GuessResponse;
    expect(hit.feedback.solved).toBe(true);
    expect(hit.attempt.status).toBe('solved');
    expect(hit.attempt.result!.score.total).toBeGreaterThan(miss.attempt.result!.score.total);
    expect(hit.finish.newAchievements.map((x) => x.key)).toContain('first_blood');

    const stats = (await a.get('/api/stats/me').expect(200)).body as StatsDTO;
    expect(stats.attempted).toBe(2);
    expect(stats.solved).toBe(1);
    expect(stats.totalGuesses).toBe(2);
  });

  it('treats different notations identically and rejects invalid input', async () => {
    const a = agent();
    const first = (await a.post('/api/play/start').send({}).expect(201)).body as AttemptDTO;
    const g1 = (await a.post(`/api/attempts/${first.id}/guess`).send({ value: '1,000,000' }).expect(200)).body as GuessResponse;
    const replay = (await a.post('/api/play/start').send({ questionId: first.question.id }).expect(201)).body as AttemptDTO;
    const g2 = (await a.post(`/api/attempts/${replay.id}/guess`).send({ value: '1 million' }).expect(200)).body as GuessResponse;
    expect(g1.feedback.logError).toBeCloseTo(g2.feedback.logError, 10);

    const fresh = (await a.post('/api/play/start').send({}).expect(201)).body as AttemptDTO;
    const zero = await a.post(`/api/attempts/${fresh.id}/guess`).send({ value: '0' }).expect(400);
    expect(zero.body.code).toBe('guess_zero');
    await a.post(`/api/attempts/${fresh.id}/guess`).send({ value: '-3' }).expect(400);
    await a.post(`/api/attempts/${fresh.id}/guess`).send({ value: 'lots' }).expect(400);
    // Invalid input does not use up the shot.
    const after = (await a.get(`/api/attempts/${fresh.id}`).expect(200)).body as AttemptDTO;
    expect(after.status).toBe('active');
  });

  it('does not let one player touch another player’s attempt', async () => {
    const owner = agent();
    const { body: attempt } = await owner.post('/api/play/start').send({}).expect(201);
    await agent().post(`/api/attempts/${attempt.id}/guess`).send({ value: 10 }).expect(404);
  });

  it('respects category and difficulty filters, and replays a question', async () => {
    const a = agent();
    const { body } = await a.post('/api/play/start').send({ category: 'india', difficulty: 'easy' }).expect(201);
    expect(body.question.category).toBe('india');
    expect(body.question.difficulty).toBe('easy');
    expect(body.mode).toBe('category');
    const replay = (await a.post('/api/play/start').send({ questionId: body.question.id }).expect(201)).body as AttemptDTO;
    expect(replay.question.id).toBe(body.question.id);
    expect(replay.id).not.toBe(body.id);
  });

  it('scores a near miss on closeness and a skip as zero', async () => {
    const a = agent();
    const { body: attempt } = await a.post('/api/play/start').send({}).expect(201);
    const answer = await answerOf(attempt.question.id);
    const res = (await a.post(`/api/attempts/${attempt.id}/guess`).send({ value: answer * 3 }).expect(200)).body as GuessResponse;
    expect(res.attempt.status).toBe('revealed');
    expect(res.attempt.result!.score.total).toBeGreaterThan(0);

    const { body: next } = await a.post('/api/play/start').send({ excludeId: attempt.question.id }).expect(201);
    expect(next.question.id).not.toBe(attempt.question.id);
    const skipped = (await a.post(`/api/attempts/${next.id}/skip`).expect(200)).body as FinishPayload;
    expect(skipped.attempt.result!.score.total).toBe(0);
  });
});

describe('daily challenge', () => {
  it('gives everyone the same question and tracks the streak', async () => {
    const date = new Date().toISOString().slice(0, 10);
    const a = agent();
    const b = agent();
    const da = (await a.get(`/api/daily?date=${date}`).expect(200)).body as DailyDTO;
    const db2 = (await b.get(`/api/daily?date=${date}`).expect(200)).body as DailyDTO;
    expect(da.question.id).toBe(db2.question.id);

    const attempt = (await a.post('/api/daily/start').send({ date }).expect(201)).body as AttemptDTO;
    const again = (await a.post('/api/daily/start').send({ date }).expect(201)).body as AttemptDTO;
    expect(again.id).toBe(attempt.id);

    const answer = await answerOf(attempt.question.id);
    const res = (await a.post(`/api/attempts/${attempt.id}/guess`).send({ value: answer }).expect(200)).body as GuessResponse;
    expect(res.finish.daily).toEqual({ streak: 1, best: 1 });

    const after = (await a.get(`/api/daily?date=${date}`).expect(200)).body as DailyDTO;
    expect(after.completed).toBe(true);
    expect(after.streak).toBe(1);
    expect(after.solvers).toBe(1);

    // A replay is practice: no points, streak unchanged.
    const practice = (await a.post('/api/daily/start').send({ date, practice: true }).expect(201)).body as AttemptDTO;
    expect(practice.practice).toBe(true);
    const p = (await a.post(`/api/attempts/${practice.id}/guess`).send({ value: answer }).expect(200)).body as GuessResponse;
    expect(p.attempt.points).toBe(0);
  });
});

describe('endless mode', () => {
  it('grows a streak on hits, resets it on a miss, and keeps going until ended', async () => {
    const a = agent();
    const { run, attempt } = (await a.post('/api/endless/start').send({}).expect(201)).body as { run: EndlessRunDTO; attempt: AttemptDTO };
    expect(run.status).toBe('active');

    const s1 = (await a.post(`/api/attempts/${attempt.id}/guess`).send({ value: await answerOf(attempt.question.id) }).expect(200)).body as GuessResponse;
    expect(s1.finish.endless!.currentStreak).toBe(1);

    const next = (await a.post(`/api/endless/${run.id}/next`).send({}).expect(200)).body as { run: EndlessRunDTO; attempt: AttemptDTO };
    expect(next.attempt.question.id).not.toBe(attempt.question.id);
    // Asking again mid-question returns the same attempt.
    const same = (await a.post(`/api/endless/${run.id}/next`).send({}).expect(200)).body as { attempt: AttemptDTO };
    expect(same.attempt.id).toBe(next.attempt.id);

    // A miss resets the streak but the run keeps dealing cards.
    const miss = (await a.post(`/api/attempts/${next.attempt.id}/guess`).send({ value: (await answerOf(next.attempt.question.id)) * 100 }).expect(200)).body as GuessResponse;
    expect(miss.finish.endless!.status).toBe('active');
    expect(miss.finish.endless!.currentStreak).toBe(0);
    expect(miss.finish.endless!.bestStreak).toBe(1);
    const third = (await a.post(`/api/endless/${run.id}/next`).send({}).expect(200)).body as { attempt: AttemptDTO };
    expect(third.attempt.status).toBe('active');

    // Only the player ends a run.
    const ended = (await a.post(`/api/endless/${run.id}/end`).expect(200)).body as EndlessRunDTO;
    expect(ended.status).toBe('ended');
    await a.post(`/api/endless/${run.id}/next`).send({}).expect(409);

    const stats = (await a.get('/api/stats/me').expect(200)).body as StatsDTO;
    expect(stats.bestEndlessStreak).toBe(1);
  });
});

describe('accounts', () => {
  it('keeps guest progress on signup and appears on the leaderboard', async () => {
    const a = agent();
    const { body: attempt } = await a.post('/api/play/start').send({}).expect(201);
    await a.post(`/api/attempts/${attempt.id}/guess`).send({ value: await answerOf(attempt.question.id) }).expect(200);
    const before = (await a.get('/api/auth/me').expect(200)).body;
    expect(before.isGuest).toBe(true);

    const user = (await a.post('/api/auth/signup').send(TEST_USER).expect(201)).body;
    expect(user.isGuest).toBe(false);
    expect(user.xp).toBe(before.xp);

    const lb = (await a.get('/api/leaderboard?board=xp').expect(200)).body as LeaderboardDTO;
    expect(lb.rows[0].username).toBe(TEST_USER.username);
    expect(lb.me?.isMe).toBe(true);

    await a.post('/api/auth/signup').send({ ...TEST_USER, username: TEST_USER.username.toUpperCase() }).expect(409);
  });

  it('merges a guest session into an existing account on login', async () => {
    const owner = agent();
    await owner.post('/api/auth/signup').send(OTHER_USER).expect(201);
    await owner.post('/api/auth/logout').expect(204);

    const guest = agent();
    const { body: attempt } = await guest.post('/api/play/start').send({}).expect(201);
    await guest.post(`/api/attempts/${attempt.id}/guess`).send({ value: await answerOf(attempt.question.id) }).expect(200);
    const guestXp = (await guest.get('/api/auth/me').expect(200)).body.xp;

    await guest.post('/api/auth/login').send({ username: OTHER_USER.username, password: 'wrong-password' }).expect(401);
    const me = (await guest.post('/api/auth/login').send(OTHER_USER).expect(200)).body;
    expect(me.xp).toBe(guestXp);
    const stats = (await guest.get('/api/stats/me').expect(200)).body as StatsDTO;
    expect(stats.solved).toBe(1);
  });

  it('validates signup input', async () => {
    const res = await agent().post('/api/auth/signup').send({ username: 'a b', password: 'short' }).expect(400);
    expect(res.body.code).toBe('validation_error');
  });
});

describe('meta', () => {
  it('lists categories with question counts', async () => {
    const res = await agent().get('/api/meta').expect(200);
    expect(res.body.categories).toHaveLength(11);
    expect(res.body.totalQuestions).toBeGreaterThanOrEqual(100);
    expect(res.body.categories.every((c: { questionCount: number }) => c.questionCount >= 10)).toBe(true);
  });
});
