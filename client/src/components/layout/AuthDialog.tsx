import { useEffect, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useAuth, useMe } from '@/api/hooks';
import { errorMessage } from '@/api/client';
import { cn } from '@/lib/utils';

type Mode = 'signup' | 'login';

const field =
  'mt-2 h-14 w-full rounded-2xl border-2 border-transparent bg-paper-deep px-4 text-lg font-semibold text-ink outline-none transition placeholder:text-ink-faint focus:border-ink';

export function AuthDialog({ open, onOpenChange, initialMode = 'signup' }: { open: boolean; onOpenChange: (o: boolean) => void; initialMode?: Mode }) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { data: me } = useMe();
  const { login, signup } = useAuth();
  const pending = login.isPending || signup.isPending;
  const hasGuestProgress = !!me?.isGuest && me.xp > 0;

  useEffect(() => {
    if (open) {
      setMode(initialMode);
      setError(null);
    }
  }, [open, initialMode]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const user = await (mode === 'signup' ? signup : login).mutateAsync({ username: username.trim(), password });
      toast(mode === 'signup' ? `Welcome to Ballpark, ${user.username}.` : `Welcome back, ${user.username}.`);
      setPassword('');
      onOpenChange(false);
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>{mode === 'signup' ? 'Keep your record' : 'Welcome back'}</DialogTitle>
        <DialogDescription>
          {mode === 'signup'
            ? hasGuestProgress
              ? `Your ${me?.xp} XP, streaks and badges come with you.`
              : 'An account keeps your stats on every device and puts you on the leaderboard.'
            : hasGuestProgress
              ? 'What you played as a guest gets added to your account.'
              : 'Pick up where you left off.'}
        </DialogDescription>

        <form onSubmit={submit} className="mt-6 space-y-4">
          <label className="block">
            <span className="label-caps text-[10px] text-ink-soft">Username</span>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
              minLength={3}
              maxLength={20}
              pattern="[A-Za-z0-9_]+"
              title="Letters, numbers and underscores"
              className={field}
            />
          </label>
          <label className="block">
            <span className="label-caps text-[10px] text-ink-soft">Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              required
              minLength={mode === 'signup' ? 8 : 1}
              className={field}
            />
            {mode === 'signup' && <span className="mt-1.5 block text-[13px] text-ink-faint">At least 8 characters.</span>}
          </label>
          {error && (
            <p role="alert" className="text-[15px] font-semibold text-miss">
              {error}
            </p>
          )}
          <Button type="submit" size="lg" className="w-full" disabled={pending}>
            {pending && <Loader2 className="animate-spin" />}
            {mode === 'signup' ? 'Create account' : 'Log in'}
          </Button>
        </form>

        <p className="mt-5 text-center text-[15px] text-ink-soft">
          {mode === 'signup' ? 'Already have an account?' : 'New here?'}{' '}
          <button
            type="button"
            onClick={() => {
              setMode(mode === 'signup' ? 'login' : 'signup');
              setError(null);
            }}
            className={cn('font-bold text-ink underline')}
          >
            {mode === 'signup' ? 'Log in' : 'Create an account'}
          </button>
        </p>
      </DialogContent>
    </Dialog>
  );
}
