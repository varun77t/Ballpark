import type { Request, RequestHandler } from 'express';
import { createGuest } from '../services/userService';
import { unauthorized } from '../lib/http';
import type { User } from '../db/schema';

/** Gives anonymous visitors a guest identity the first time they actually play. */
export const ensureUser: RequestHandler = (req, _res, next) => {
  if (req.user) return next();
  createGuest()
    .then((guest) => req.login(guest, (err) => next(err)))
    .catch(next);
};

export const requireAccount: RequestHandler = (req, _res, next) => {
  if (!req.user || req.user.isGuest) return next(unauthorized('Create an account to do that.'));
  next();
};

export function currentUser(req: Request): User {
  if (!req.user) throw unauthorized();
  return req.user;
}
