import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { DIFFICULTIES } from '@ballpark/shared';
import { db } from '../db/client';
import { asyncHandler } from '../lib/http';
import { currentUser, ensureUser } from '../middleware/user';
import { validate } from '../middleware/validate';
import { buildAttemptDTO, createAttempt, endAttempt, getAttempt, replayQuestion, submitGuess } from '../services/attemptService';
import { selectQuestion } from '../services/questionService';
import { config } from '../config';

const filters = {
  category: z.string().max(48).optional(),
  difficulty: z.enum(DIFFICULTIES).optional(),
};

const startSchema = z.object({
  ...filters,
  /** Replay a specific question. */
  questionId: z.coerce.number().int().positive().optional(),
  /** Avoid immediately repeating the question that was just skipped or finished. */
  excludeId: z.coerce.number().int().positive().optional(),
});

const guessSchema = z.object({
  value: z.union([z.string().max(64), z.number()]),
});

const idParams = z.object({ id: z.string().uuid('Invalid attempt id.') });

const guessLimiter = rateLimit({
  windowMs: 60_000,
  limit: config.isTest ? 10_000 : 120,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Whoa, slow down — too many guesses in a minute.', code: 'rate_limited' },
});

export const playRouter = Router();

playRouter.post(
  '/start',
  ensureUser,
  validate(startSchema),
  asyncHandler(async (req, res) => {
    const user = currentUser(req);
    const body = req.body as z.infer<typeof startSchema>;
    if (body.questionId) return res.status(201).json(await replayQuestion(user.id, body.questionId));
    const dto = await db.transaction(async (tx) => {
      const question = await selectQuestion(tx, user.id, {
        category: body.category,
        difficulty: body.difficulty,
        excludeIds: body.excludeId ? [body.excludeId] : [],
      });
      const attempt = await createAttempt(tx, user.id, { mode: body.category ? 'category' : 'random', questionId: question.id });
      return buildAttemptDTO(tx, attempt, question);
    });
    res.status(201).json(dto);
  }),
);

export const attemptsRouter = Router();

attemptsRouter.use(ensureUser);

attemptsRouter.get(
  '/:id',
  validate(idParams, 'params'),
  asyncHandler(async (req, res) => {
    res.json(await getAttempt(currentUser(req).id, req.params.id));
  }),
);

attemptsRouter.post(
  '/:id/guess',
  guessLimiter,
  validate(idParams, 'params'),
  validate(guessSchema),
  asyncHandler(async (req, res) => {
    res.json(await submitGuess(currentUser(req).id, req.params.id, (req.body as z.infer<typeof guessSchema>).value));
  }),
);

attemptsRouter.post(
  '/:id/reveal',
  validate(idParams, 'params'),
  asyncHandler(async (req, res) => {
    res.json(await endAttempt(currentUser(req).id, req.params.id, 'revealed'));
  }),
);

attemptsRouter.post(
  '/:id/skip',
  validate(idParams, 'params'),
  asyncHandler(async (req, res) => {
    res.json(await endAttempt(currentUser(req).id, req.params.id, 'skipped'));
  }),
);

export { filters as filterSchemaShape };
