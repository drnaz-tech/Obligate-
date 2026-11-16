import { useCallback, useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function useCurtain(onDone: () => void, holdMs: number) {
  const [leaving, setLeaving] = useState(false);
  const done = useRef(false);

  const finish = useCallback(() => {
    if (done.current) return;
    done.current = true;
    onDone();
  }, [onDone]);

  useEffect(() => {
    if (prefersReducedMotion()) {
      finish();
      return;
    }
    const out = window.setTimeout(() => setLeaving(true), holdMs);
    const end = window.setTimeout(finish, holdMs + 420);
    return () => {
      window.clearTimeout(out);
      window.clearTimeout(end);
    };
  }, [finish, holdMs]);

  return { leaving, finish };
}

function SkipButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="absolute right-3 top-3 z-10 flex min-h-10 items-center gap-1.5 border border-border bg-background/80 px-2.5 font-mono text-[12px] uppercase tracking-[0.1em] text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground md:right-5 md:top-5"
    >
      Skip <X className="h-3 w-3" aria-hidden />
    </button>
  );
}

export function CaseOpening({
  title,
  setting,
  onDone,
}: {
  title: string;
  setting: string;
  onDone: () => void;
}) {
  const { leaving, finish } = useCurtain(onDone, 2200);

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 flex items-center justify-center bg-background/95 px-4 backdrop-blur-sm',
        leaving ? 'animate-[curtain-out_400ms_ease-in_forwards]' : 'animate-[curtain-in_220ms_ease-out]',
      )}
      role="status"
      aria-live="polite"
    >
      <SkipButton onClick={finish} />
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="h-24 w-full bg-gradient-to-b from-transparent via-primary/10 to-transparent animate-[scan-sweep_2.4s_ease-in-out_infinite]" />
      </div>

      <div className="relative w-full max-w-lg animate-[folder-open_620ms_cubic-bezier(0.22,1,0.36,1)_forwards]">
        <div className="paper relative border border-ink/20 p-6 shadow-[6px_6px_0_0_hsl(218_26%_3%)] md:p-8">
          <div className="flex items-center justify-between gap-3 border-b border-ink/25 pb-3">
            <span className="font-mono text-[12px] uppercase tracking-[0.14em] text-ink/60">
              Case file · sealed
            </span>
            <span className="font-mono text-[12px] uppercase tracking-[0.14em] text-ink/60">
              Two players
            </span>
          </div>
          <p className="mt-5 font-mono text-[12px] uppercase tracking-[0.14em] text-ink/55">{setting}</p>
          <h2 className="mt-2 text-balance font-display text-2xl font-semibold uppercase leading-tight tracking-tight text-ink md:text-3xl">
            {title}
          </h2>
          <p className="mt-4 max-w-prose text-pretty text-sm leading-relaxed text-ink/70">
            Your half is on the left. Your partner holds the other half. Neither of you can close this
            alone.
          </p>
          <div className="mt-6 flex items-center justify-between gap-3 border-t border-ink/25 pt-4">
            <span className="font-mono text-[12px] uppercase tracking-[0.14em] text-ink/55">
              Opening the file
            </span>
            <span className="inline-flex items-center gap-1.5 font-mono text-[12px] uppercase tracking-[0.14em] text-ink/55">
              <span className="h-1.5 w-1.5 animate-pulse bg-ink/60" aria-hidden />
              <span className="h-1.5 w-1.5 animate-pulse bg-ink/60 [animation-delay:150ms]" aria-hidden />
              <span className="h-1.5 w-1.5 animate-pulse bg-ink/60 [animation-delay:300ms]" aria-hidden />
            </span>
          </div>
        </div>

        <div className="pointer-events-none absolute -bottom-5 right-4 animate-[stamp-slam_520ms_cubic-bezier(0.2,1.4,0.4,1)_360ms_both] md:right-8">
          <span className="inline-flex rotate-[-1.5deg] items-center border-2 border-primary bg-background/90 px-3 py-1 font-mono text-[13px] font-bold uppercase tracking-[0.18em] text-primary">
            Open
          </span>
        </div>
      </div>
    </div>
  );
}

export function CaseClosing({
  solved,
  title,
  onDone,
}: {
  solved: boolean;
  title: string;
  onDone: () => void;
}) {
  const { leaving, finish } = useCurtain(onDone, 1900);

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 flex items-center justify-center bg-background/95 px-4 backdrop-blur-sm',
        leaving ? 'animate-[curtain-out_400ms_ease-in_forwards]' : 'animate-[curtain-in_220ms_ease-out]',
      )}
      role="status"
      aria-live="polite"
    >
      <SkipButton onClick={finish} />
      <div className="relative w-full max-w-md animate-[folder-open_520ms_cubic-bezier(0.22,1,0.36,1)_forwards]">
        <div className="paper relative border border-ink/20 p-6 text-center shadow-[6px_6px_0_0_hsl(218_26%_3%)] md:p-8">
          <p className="font-mono text-[12px] uppercase tracking-[0.14em] text-ink/55">{title}</p>
          <div className="mt-6 flex justify-center">
            <span
              className={cn(
                'inline-flex rotate-[-1.5deg] items-center border-[3px] px-4 py-2 font-display text-xl font-bold uppercase tracking-[0.16em] animate-[stamp-slam_560ms_cubic-bezier(0.2,1.4,0.4,1)_260ms_both] md:text-2xl',
                solved ? 'border-ink/80 text-ink/80' : 'border-destructive text-destructive',
              )}
            >
              {solved ? 'Case closed' : 'Unsolved'}
            </span>
          </div>
          <p className="mt-6 text-pretty text-sm leading-relaxed text-ink/70">
            {solved
              ? 'Both halves met. The file goes to the archive.'
              : 'The file closes without an answer. The truth comes out anyway.'}
          </p>
        </div>
      </div>
    </div>
  );
}
