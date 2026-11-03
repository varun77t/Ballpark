import { Link, Route, Routes } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { HomePage } from '@/pages/Home';
import { PlayAttemptPage, PlayStartPage } from '@/pages/Play';
import { DailyPage } from '@/pages/Daily';
import { EndlessPage } from '@/pages/Endless';
import { ProfilePage } from '@/pages/Profile';
import { LeaderboardPage } from '@/pages/Leaderboard';

function NotFound() {
  return (
    <div className="py-20 text-center">
      <div className="display text-[clamp(5rem,20vw,10rem)]">404</div>
      <p className="mx-auto mt-4 max-w-[36ch] text-[17px] text-ink-soft">Your estimate of this page’s existence was a little high.</p>
      <Button asChild size="lg" className="mt-8">
        <Link to="/">Back home</Link>
      </Button>
    </div>
  );
}

export function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/play" element={<PlayStartPage />} />
        <Route path="/play/:attemptId" element={<PlayAttemptPage />} />
        <Route path="/daily" element={<DailyPage />} />
        <Route path="/endless" element={<EndlessPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/leaderboard" element={<LeaderboardPage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AppShell>
  );
}
