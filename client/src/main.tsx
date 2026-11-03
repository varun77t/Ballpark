import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import '@fontsource-variable/archivo/wdth.css';
import './styles/index.css';
import { App } from './App';
import { TooltipProvider } from './components/ui/tooltip';
import { RequestError } from './api/client';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      refetchOnWindowFocus: false,
      // Don't hammer the server on 4xx — those won't fix themselves.
      retry: (count, err) => !(err instanceof RequestError && err.status >= 400 && err.status < 500) && count < 2,
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <TooltipProvider>
          <App />
          <Toaster
            position="bottom-center"
            theme="light"
            toastOptions={{
              classNames: {
                toast: '!rounded-full !border-0 !bg-ink !px-5 !text-paper !shadow-[0_16px_32px_-16px_rgba(27,26,23,0.7)] !font-sans !font-bold',
                description: '!text-paper/75 !font-medium',
              },
            }}
          />
        </TooltipProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
