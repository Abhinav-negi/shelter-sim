import { MountainSnow, Moon, Sun } from 'lucide-react';
import { HowToUseSheet } from '@/components/HowToUseSheet';
import { Button } from '@/components/ui/button';
import { useServerStatus } from '@/hooks/useServerStatus';
import { useTheme } from '@/hooks/useTheme';
import { cn } from '@/lib/utils';

function ServerStatusDot() {
  const status = useServerStatus();
  const label =
    status === 'online' ? 'Server online' : status === 'offline' ? 'Server offline' : 'Checking…';
  const dot =
    status === 'online'
      ? 'bg-emerald-500'
      : status === 'offline'
        ? 'bg-red-500'
        : 'bg-muted-foreground';

  return (
    <div className="text-muted-foreground hidden items-center gap-1.5 text-sm sm:flex">
      <span className={cn('size-2 rounded-full', dot)} aria-hidden />
      {label}
    </div>
  );
}

export function Header() {
  const { theme, toggle } = useTheme();

  return (
    <header className="bg-background/80 sticky top-0 z-40 border-b backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="bg-primary text-primary-foreground flex size-8 shrink-0 items-center justify-center rounded-lg">
            <MountainSnow className="size-4.5" />
          </div>
          <div className="flex min-w-0 items-baseline gap-2">
            <span className="truncate text-base font-semibold tracking-tight">ShelterSim</span>
            <span className="text-muted-foreground hidden truncate text-xs sm:inline">
              DRDO · DIHAR Leh
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <ServerStatusDot />
          <HowToUseSheet />
          <Button
            variant="ghost"
            size="icon"
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            onClick={toggle}
          >
            {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </Button>
        </div>
      </div>
    </header>
  );
}
