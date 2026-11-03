import bcrypt from 'bcryptjs';
import { and, eq, sql } from 'drizzle-orm';
import { levelFromXp, type UserDTO } from '@ballpark/shared';
import { db, type Tx } from '../db/client';
import { attempts, endlessRuns, userAchievements, userStats, users, type User } from '../db/schema';
import { conflict } from '../lib/http';

const BCRYPT_ROUNDS = 11;

export async function createGuest(): Promise<User> {
  return db.transaction(async (tx) => {
    const [user] = await tx.insert(users).values({ isGuest: true }).returning();
    await tx.insert(userStats).values({ userId: user.id });
    return user;
  });
}

export async function findById(id: string): Promise<User | undefined> {
  const [user] = await db.select().from(users).where(eq(users.id, id));
  return user;
}

export async function findByUsername(username: string): Promise<User | undefined> {
  const [user] = await db
    .select()
    .from(users)
    .where(sql`lower(${users.username}) = lower(${username})`);
  return user;
}

export async function verifyPassword(user: User, password: string): Promise<boolean> {
  if (!user.passwordHash) return false;
  return bcrypt.compare(password, user.passwordHash);
}

/**
 * Registers an account. When the current session belongs to a guest, the guest row
 * is upgraded in place so every attempt, stat and achievement carries over untouched.
 */
export async function register(username: string, password: string, currentGuest?: User | null): Promise<User> {
  if (await findByUsername(username)) throw conflict('That username is taken.', 'username_taken');
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  try {
    if (currentGuest?.isGuest) {
      const [user] = await db
        .update(users)
        .set({ username, passwordHash, isGuest: false })
        .where(eq(users.id, currentGuest.id))
        .returning();
      return user;
    }
    return await db.transaction(async (tx) => {
      const [user] = await tx.insert(users).values({ username, passwordHash, isGuest: false }).returning();
      await tx.insert(userStats).values({ userId: user.id });
      return user;
    });
  } catch (err) {
    // Unique index race between the check above and the insert.
    if ((err as { code?: string }).code === '23505') throw conflict('That username is taken.', 'username_taken');
    throw err;
  }
}

/**
 * Moves a guest's progress into an existing account on login, then deletes the guest.
 * XP adds up, best streaks take the max, and the daily streak keeps whichever is more recent.
 */
export async function mergeGuestInto(guestId: string, accountId: string): Promise<void> {
  if (guestId === accountId) return;
  await db.transaction(async (tx) => {
    const [guest] = await tx.select().from(users).where(eq(users.id, guestId)).for('update');
    if (!guest?.isGuest) return;

    // Both may have a scored daily for the same date; keep the account's and demote the guest's to practice.
    await tx.execute(sql`
      update ${attempts} g set practice = true, points = 0, xp_gained = 0
      where g.user_id = ${guestId} and g.mode = 'daily' and g.practice = false
        and exists (
          select 1 from ${attempts} a
          where a.user_id = ${accountId} and a.mode = 'daily' and a.practice = false and a.daily_date = g.daily_date
        )`);

    await tx.update(attempts).set({ userId: accountId }).where(eq(attempts.userId, guestId));
    await tx.update(endlessRuns).set({ userId: accountId }).where(eq(endlessRuns.userId, guestId));

    await tx.execute(sql`
      insert into ${userAchievements} (user_id, key, unlocked_at)
      select ${accountId}, key, unlocked_at from ${userAchievements} where user_id = ${guestId}
      on conflict do nothing`);

    const [g] = await tx.select().from(userStats).where(eq(userStats.userId, guestId));
    const [a] = await tx.select().from(userStats).where(eq(userStats.userId, accountId));
    if (g && a) {
      const guestNewer = (g.lastDailyDate ?? '') > (a.lastDailyDate ?? '');
      await tx
        .update(userStats)
        .set({
          xp: a.xp + g.xp,
          bestDailyStreak: Math.max(a.bestDailyStreak, g.bestDailyStreak),
          bestEndlessStreak: Math.max(a.bestEndlessStreak, g.bestEndlessStreak),
          dailyStreak: guestNewer ? g.dailyStreak : a.dailyStreak,
          lastDailyDate: guestNewer ? g.lastDailyDate : a.lastDailyDate,
          updatedAt: new Date(),
        })
        .where(eq(userStats.userId, accountId));
    }
    await tx.delete(users).where(and(eq(users.id, guestId), eq(users.isGuest, true)));
  });
}

export async function getXp(tx: Tx, userId: string): Promise<number> {
  const [row] = await tx.select({ xp: userStats.xp }).from(userStats).where(eq(userStats.userId, userId));
  return row?.xp ?? 0;
}

export async function toUserDTO(user: User): Promise<UserDTO> {
  const xp = await getXp(db, user.id);
  return { id: user.id, username: user.username, isGuest: user.isGuest, xp, level: levelFromXp(xp).level };
}
