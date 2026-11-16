import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, Copy, Share2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RuleLabel, Stamp, formatDuration } from '@/components/dossier/Dossier';
import { CaseClosing } from '@/components/dossier/CaseCurtain';
import { getLeaderboard } from '@/lib/api';
import type { LeaderboardRow, RoomState } from '@/types/types';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export default function ResultReveal({ state }: { state: RoomState }) {
  const result = state.result!;
  const [board, setBoard] = useState<LeaderboardRow[]>([]);
  const [joined, setJoined] = useState(false);
  const [curtain, setCurtain] = useState(() => {
    if (typeof window === 'undefined') return false;
    const key = `ob-closed-${state.room.id}`;
    if (window.sessionStorage.getItem(key)) return false;
    window.sessionStorage.setItem(key, '1');
    return true;
  });

  useEffect(() => {
    getLeaderboard(state.room.case_id).then((rows) => setBoard(rows.slice(0, 5))).catch(() => undefined);
    const t = window.setTimeout(() => setJoined(true), 120);
    return () => window.clearTimeout(t);
  }, [state.room.case_id]);

  const mine = new Set(state.evidence.map((e) => e.code));
  const solved = result.outcome === 'solved';
  const questions = state.case.questions ?? [];

  return (
    <>
      {curtain && (
        <CaseClosing solved={solved} title={state.case.title} onDone={() => setCurtain(false)} />
      )}
    <div className="mx-auto w-full max-w-4xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <RuleLabel>Case closed</RuleLabel>
          <h1 className="mt-1 text-balance font-display text-2xl uppercase tracking-wide md:text-3xl">
            {state.case.title}
          </h1>
        </div>
        <Stamp className={solved ? 'text-accent' : 'text-destructive'}>
          {solved ? 'Solved' : result.outcome === 'failed' ? 'Unsolved' : 'Shelved'}
        </Stamp>
      </div>

      <div className="relative mt-5 overflow-hidden panel">
        <div className="grid grid-cols-1 md:grid-cols-2">
          <div
            className={cn(
              'border-b border-border p-4 transition-transform duration-700 md:border-b-0 md:border-r',
              joined ? 'translate-x-0' : '-translate-x-4 opacity-0',
            )}
          >
            <div className="flex items-center justify-between">
              <Stamp className="text-playerA">Your half</Stamp>
              <span className="font-mono text-[12px] uppercase tracking-[0.1em] text-muted-foreground">
                {state.evidence.length} items
              </span>
            </div>
            <ul className="mt-3 space-y-1">
              {state.evidence.slice(0, 6).map((e) => (
                <li key={e.code} className="truncate font-mono text-[13px] text-muted-foreground">
                  {e.code} · {e.title}
                </li>
              ))}
            </ul>
          </div>
          <div
            className={cn(
              'p-4 transition-transform duration-700',
              joined ? 'translate-x-0' : 'translate-x-4 opacity-0',
            )}
          >
            <div className="flex items-center justify-between">
              <Stamp className="text-playerB">Partner's half</Stamp>
              <span className="font-mono text-[12px] uppercase tracking-[0.1em] text-muted-foreground">
                {state.partner_total} items
              </span>
            </div>
            <ul className="mt-3 space-y-1">
              {state.shared.slice(0, 6).map((e) => (
                <li key={e.code} className="truncate font-mono text-[13px] text-muted-foreground">
                  {e.code} · {e.title}
                </li>
              ))}
              {state.shared.length === 0 && (
                <li className="font-mono text-[13px] text-muted-foreground">
                  Nothing was shared during the case.
                </li>
              )}
            </ul>
          </div>
        </div>
        <div className="pointer-events-none absolute inset-y-0 left-1/2 w-px bg-gradient-to-b from-playerA/60 via-primary/60 to-playerB/60" />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          ['Time', formatDuration(result.duration_seconds)],
          ['Attempts', `${result.attempts}/3`],
          ['Hints', String(result.hints_used)],
          ['Outcome', solved ? 'Closed' : 'Open'],
        ].map(([k, v]) => (
          <div key={k} className="panel px-3 py-2">
            <p className="font-mono text-[12px] uppercase tracking-[0.1em] text-muted-foreground">{k}</p>
            <p className="mt-0.5 font-display text-lg font-semibold tabular-nums">{v}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 panel">
        <div className="border-b border-border px-4 py-2.5">
          <RuleLabel>The truth</RuleLabel>
        </div>
        <div className="space-y-2 p-4">
          {questions.map((q) => {
            const truth = result.solution[q.id];
            const label = q.options.find((o) => o.id === truth)?.label ?? truth;
            const said = result.verdict?.answers?.[q.id];
            const right = said === truth;
            return (
              <div key={q.id} className="flex flex-wrap items-baseline gap-2 border-b border-border pb-2 last:border-0">
                <span className="font-mono text-[12px] uppercase tracking-[0.11em] text-primary">{q.label}</span>
                <span className="text-sm">{label}</span>
                {said && (
                  <span className={cn('ml-auto flex items-center gap-1 font-mono text-[12px] uppercase tracking-[0.1em]', right ? 'text-accent' : 'text-destructive')}>
                    {right ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                    {right ? 'you had it' : 'you missed it'}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-4 panel">
        <div className="border-b border-border px-4 py-2.5">
          <RuleLabel>Deduction chain · who held what</RuleLabel>
        </div>
        <div className="divide-y divide-border">
          {result.deduction_chain.map((d, i) => (
            <div key={`${d.question}-${i}`} className="px-4 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-[12px] uppercase tracking-[0.11em] text-muted-foreground">
                  {d.question}
                </span>
                <span
                  className={cn(
                    'font-mono text-[12px] uppercase tracking-[0.1em]',
                    d.kind === 'key' ? 'text-primary' : 'text-muted-foreground',
                  )}
                >
                  {d.kind === 'key' ? 'needed both halves' : 'single-sided prune'}
                </span>
              </div>
              <p className="mt-1 text-pretty text-sm leading-relaxed">{d.reasoning}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {d.requires.map((code) => {
                  const isMine = mine.has(code);
                  return (
                    <span
                      key={code}
                      className={cn(
                        'border px-1.5 py-0.5 font-mono text-[12px] uppercase tracking-[0.1em]',
                        isMine ? 'border-playerA/50 text-playerA' : 'border-playerB/50 text-playerB',
                      )}
                    >
                      {code} · {isMine ? 'you' : 'partner'}
                    </span>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 panel p-4">
        <RuleLabel>What happened</RuleLabel>
        <p className="mt-2 text-pretty text-sm leading-relaxed text-muted-foreground">{result.narrative}</p>
        <p className="mt-2 text-pretty text-sm leading-relaxed text-muted-foreground">{result.epilogue}</p>
      </div>

      <div className="mt-4 panel">
        <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
          <RuleLabel>Fastest on this case</RuleLabel>
          <Link to="/app/leaderboard" className="font-mono text-[12px] uppercase tracking-[0.1em] text-primary">
            Full board
          </Link>
        </div>
        {board.length === 0 ? (
          <p className="px-4 py-4 text-sm text-muted-foreground">
            No pair has closed this case yet. That is the whole board.
          </p>
        ) : (
          <div className="divide-y divide-border">
            {board.map((r) => (
              <div key={`${r.rank}-${r.created_at}`} className="flex items-center gap-3 px-4 py-2">
                <span className="w-5 shrink-0 font-mono text-[12px] tabular-nums text-muted-foreground">{r.rank}</span>
                <span className="min-w-0 flex-1 truncate text-sm">
                  {r.player_a} <span className="text-muted-foreground">+</span> {r.player_b}
                </span>
                <span className="shrink-0 font-mono text-[13px] tabular-nums">{formatDuration(r.duration_seconds)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <Button asChild className="font-mono text-[13px] uppercase tracking-[0.11em]">
          <Link to="/app/lobby">Open another case <ArrowRight className="ml-2 h-4 w-4" /></Link>
        </Button>
        <Button
          variant="outline"
          className="font-mono text-[13px] uppercase tracking-[0.11em]"
          onClick={() => {
            const text = `${state.case.title} — ${solved ? 'closed' : 'unsolved'} in ${formatDuration(result.duration_seconds)}. Two players, different clues, one truth.`;
            void navigator.clipboard.writeText(text).then(() => toast.success('Result copied.'));
          }}
        >
          <Copy className="mr-2 h-4 w-4" /> Copy result
        </Button>
        <Button asChild variant="ghost" className="font-mono text-[13px] uppercase tracking-[0.11em]">
          <Link to="/app"><Share2 className="mr-2 h-4 w-4" /> Back to the desk</Link>
        </Button>
      </div>
    </div>
    </>
  );
}
