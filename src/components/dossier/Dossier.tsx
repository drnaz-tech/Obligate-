import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import type { Slot } from '@/types/types';

export function Stamp({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn('stamp', className)}>{children}</span>;
}

export function RuleLabel({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('rule-label', className)}>{children}</div>;
}

export function PlayerTag({
  slot,
  name,
  online,
  ready,
  compact,
}: {
  slot: Slot;
  name: string;
  online?: boolean;
  ready?: boolean;
  compact?: boolean;
}) {
  const isA = slot === 'A';
  return (
    <div
      className={cn(
        'flex items-center gap-2 border px-2 py-1',
        isA ? 'border-playerA/50 text-playerA' : 'border-playerB/50 text-playerB',
        compact && 'px-1.5 py-0.5',
      )}
    >
      <span
        className={cn(
          'flex h-5 w-5 shrink-0 items-center justify-center font-mono text-[13px] font-bold',
          isA ? 'bg-playerA text-playerA-foreground' : 'bg-playerB text-playerB-foreground',
        )}
        aria-hidden
      >
        {slot}
      </span>
      <span className="min-w-0 truncate font-mono text-xs uppercase tracking-wider">{name}</span>
      {typeof online === 'boolean' && (
        <span
          className={cn(
            'h-1.5 w-1.5 shrink-0 rounded-full',
            online ? 'bg-current animate-seam-pulse' : 'bg-muted-foreground/40',
          )}
          title={online ? 'Present' : 'Away'}
        />
      )}
      {ready && <span className="shrink-0 font-mono text-[12px] uppercase">ready</span>}
    </div>
  );
}

export function PaperCard({
  children,
  className,
  tone = 'ink',
}: {
  children: ReactNode;
  className?: string;
  tone?: 'ink' | 'paper';
}) {
  return (
    <div
      className={cn(
        'relative border border-border',
        tone === 'paper' ? 'paper' : 'paper-dark',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function Seam({ live, className }: { live?: boolean; className?: string }) {
  return (
    <div
      aria-hidden
      className={cn('seam pointer-events-none absolute inset-y-0 left-1/2 w-px', live && 'seam-live', className)}
    />
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="border border-dashed border-border px-6 py-10 text-center">
      <p className="font-display text-base uppercase tracking-wide text-foreground">{title}</p>
      <p className="mx-auto mt-2 max-w-prose text-pretty text-sm text-muted-foreground">{body}</p>
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

export function useCountdown(target: string | null | undefined) {
  const [left, setLeft] = useState<number>(0);
  useEffect(() => {
    if (!target) return;
    const tick = () => setLeft(Math.max(0, new Date(target).getTime() - Date.now()));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [target]);
  const total = Math.floor(left / 1000);
  return {
    hours: String(Math.floor(total / 3600)).padStart(2, '0'),
    minutes: String(Math.floor((total % 3600) / 60)).padStart(2, '0'),
    seconds: String(total % 60).padStart(2, '0'),
    done: left === 0,
  };
}

export function formatDuration(seconds: number | null | undefined) {
  if (!seconds || seconds < 0) return '—';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function DifficultyMark({ level }: { level: string }) {
  const bars = level === 'Hard' ? 3 : level === 'Medium' ? 2 : 1;
  return (
    <span className="inline-flex items-center gap-1" title={`${level} difficulty`}>
      {[1, 2, 3].map((i) => (
        <span
          key={i}
          className={cn('h-2.5 w-1', i <= bars ? 'bg-primary' : 'bg-border')}
          aria-hidden
        />
      ))}
      <span className="ml-1 font-mono text-[12px] uppercase tracking-widest text-muted-foreground">
        {level}
      </span>
    </span>
  );
}
