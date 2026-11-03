import { Router } from 'express';
import { z } from 'zod';
import { passport } from '../auth/passport';
import { asyncHandler, unauthorized } from '../lib/http';
import { validate } from '../middleware/validate';
import { mergeGuestInto, register, toUserDTO } from '../services/userService';
import type { User } from '../db/schema';
import type { Request } from 'express';

const credentials = z.object({
  username: z
    .string()
    .trim()
    .min(3, 'Username must be at least 3 characters.')
    .max(20, 'Username must be at most 20 characters.')
    .regex(/^[a-zA-Z0-9_]+$/, 'Use letters, numbers and underscores only.'),
  password: z.string().min(8, 'Password must be at least 8 characters.').max(128),
});

function login(req: Request, user: User): Promise<void> {
  return new Promise((resolve, reject) => req.login(user, (err) => (err ? reject(err) : resolve())));
}

export const authRouter = Router();

authRouter.get(
  '/me',
  asyncHandler(async (req, res) => {
    res.json(req.user ? await toUserDTO(req.user) : null);
  }),
);

authRouter.post(
  '/signup',
  validate(credentials),
  asyncHandler(async (req, res) => {
    const { username, password } = req.body as z.infer<typeof credentials>;
    const user = await register(username, password, req.user?.isGuest ? req.user : null);
    await login(req, user);
    res.status(201).json(await toUserDTO(user));
  }),
);

authRouter.post(
  '/login',
  validate(credentials.pick({ username: true }).extend({ password: z.string().min(1).max(128) })),
  (req, res, next) => {
    passport.authenticate('local', (err: unknown, user: User | false, info?: { message?: string }) => {
      if (err) return next(err);
      if (!user) return next(unauthorized(info?.message ?? 'Wrong username or password.'));
      const guestId = req.user?.isGuest ? req.user.id : null;
      (async () => {
        if (guestId) await mergeGuestInto(guestId, user.id);
        await login(req, user);
        res.json(await toUserDTO(user));
      })().catch(next);
    })(req, res, next);
  },
);

authRouter.post('/logout', (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);
    req.session.destroy(() => {
      res.clearCookie('ballpark.sid');
      res.status(204).end();
    });
  });
});
