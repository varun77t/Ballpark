import { useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { ArrowUpRight, Menu, User, X } from 'lucide-react';
import { levelFromXp } from '@ballpark/shared';
import { useAuth, useMe } from '@/api/hooks';
import { cn } from '@/lib/utils';
import { Wordmark } from './Logo';
import { AuthDialog } from './AuthDialog';

const NAV = [
  { to: '/play', label: 'Play', note: 'A random question' },
  { to: '/daily', label: 'Daily', note: 'Same question for everyone today' },
  { to: '/endless', label: 'Endless', note: 'Keep hitting, keep going' },
  { to: '/profile', label: 'Record', note: 'Your stats and badges' },
  { to: '/leaderboard', label: 'Leaderboard', note: 'Registered players' },
];

const round =
  'fixed top-4 z-40 grid size-12 place-items-center rounded-full shadow-[0_10px_24px_-12px_rgba(27,26,23,0.5)] transition-transform hover:-translate-y-px active:scale-95 sm:top-6';

export function AppShell({ children }: { children: ReactNode }) {
  const location = useLocation();
  const { data: me } = useMe();
  const { logout } = useAuth();
  const [menu, setMenu] = useState(false);
  const [auth, setAuth] = useState<{ open: boolean; mode: 'signup' | 'login' }>({ open: false, mode: 'signup' });
  const level = levelFromXp(me?.xp ?? 0).level;
  const registered = !!me && !me.isGuest;

  useEffect(() => setMenu(false), [location.pathname]);

  return (
    <div className="min-h-dvh">
      <button className={cn(round, 'left-4 bg-ink text-paper sm:left-6')} onClick={() => setMenu(true)} aria-label="Open menu">
        <Menu className="size-5" />
      </button>

      {registered ? (
        <Link to="/profile" className={cn(round, 'right-4 bg-paper text-ink ring-1 ring-paper-line sm:right-6')} aria-label={`Your record, level ${level}`}>
          <span className="text-[15px] font-[850] tabular">{level}</span>
        </Link>
      ) : (
        <button
          className={cn(round, 'right-4 bg-paper text-ink ring-1 ring-paper-line sm:right-6')}
          onClick={() => setAuth({ open: true, mode: 'signup' })}
          aria-label="Sign up or log in"
        >
          <User className="size-5" />
        </button>
      )}

      <motion.main
        key={location.pathname.split('/')[1] ?? ''}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="mx-auto w-full max-w-[880px] px-4 pb-20 pt-20 sm:px-6 sm:pt-24"
      >
        {children}
      </motion.main>

      <DialogPrimitive.Root open={menu} onOpenChange={setMenu}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Content className="fixed inset-0 z-50 overflow-y-auto bg-paper px-4 pb-10 pt-4 focus:outline-none sm:px-6 sm:pt-6">
            <DialogPrimitive.Title className="sr-only">Menu</DialogPrimitive.Title>
            <div className="flex items-center justify-between">
              <DialogPrimitive.Close className="grid size-12 place-items-center rounded-full bg-ink text-paper" aria-label="Close menu">
                <X className="size-5" />
              </DialogPrimitive.Close>
              <Link to="/" onClick={() => setMenu(false)}>
                <Wordmark />
              </Link>
              <span className="size-12" />
            </div>
            <nav className="mx-auto mt-10 max-w-[880px] sm:mt-16" aria-label="Main">
              <ul>
                {NAV.map((n, i) => (
                  <motion.li
                    key={n.to}
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.04 * i, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                    className="border-b-2 border-paper-line"
                  >
                    <NavLink to={n.to} className="group flex items-center justify-between gap-4 py-5">
                      {({ isActive }) => (
                        <>
                          <span>
                            <span className={cn('display block text-5xl sm:text-6xl', isActive ? 'text-ink' : 'text-ink/85 group-hover:text-ink')}>{n.label}</span>
                            <span className="mt-1 block text-[15px] text-ink-soft">{n.note}</span>
                          </span>
                          <ArrowUpRight className="size-8 shrink-0 text-ink-faint transition group-hover:-translate-y-1 group-hover:translate-x-1 group-hover:text-ink" />
                        </>
                      )}
                    </NavLink>
                  </motion.li>
                ))}
              </ul>
              <div className="mt-10 flex flex-wrap items-center gap-3">
                {registered ? (
                  <>
                    <span className="text-[15px] text-ink-soft">
                      Signed in as <b className="text-ink">{me.username}</b>
                    </span>
                    <button
                      className="label-caps text-[11px] underline"
                      onClick={() => logout.mutate(undefined, { onSuccess: () => toast('Logged out. See you tomorrow.') })}
                    >
                      Log out
                    </button>
                  </>
                ) : (
                  <>
                    <button className="label-caps h-12 rounded-full bg-ink px-6 text-xs text-paper" onClick={() => { setMenu(false); setAuth({ open: true, mode: 'signup' }); }}>
                      Create account
                    </button>
                    <button className="label-caps h-12 rounded-full px-6 text-xs underline" onClick={() => { setMenu(false); setAuth({ open: true, mode: 'login' }); }}>
                      Log in
                    </button>
                  </>
                )}
              </div>
            </nav>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      <AuthDialog open={auth.open} initialMode={auth.mode} onOpenChange={(open) => setAuth((a) => ({ ...a, open }))} />
    </div>
  );
}
