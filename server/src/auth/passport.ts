import bcrypt from 'bcryptjs';
import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import type { User as DbUser } from '../db/schema';
import { findById, findByUsername, verifyPassword } from '../services/userService';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface User extends DbUser {}
  }
}

// Compare against a dummy hash when the user does not exist so response time doesn't reveal valid usernames.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 11);

passport.use(
  new LocalStrategy(async (username, password, done) => {
    try {
      const user = await findByUsername(username.trim());
      const ok = user ? await verifyPassword(user, password) : await verifyPassword({ passwordHash: DUMMY_HASH } as DbUser, password);
      if (!user || !ok || user.isGuest) return done(null, false, { message: 'Wrong username or password.' });
      return done(null, user);
    } catch (err) {
      return done(err);
    }
  }),
);

passport.serializeUser((user, done) => done(null, user.id));

passport.deserializeUser(async (id: string, done) => {
  try {
    const user = await findById(id);
    // A missing user (e.g. merged guest) just yields an anonymous session.
    done(null, user ?? false);
  } catch (err) {
    done(err);
  }
});

export { passport };
