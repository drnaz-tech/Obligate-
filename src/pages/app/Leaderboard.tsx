import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Trophy } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState, RuleLabel, Stamp, formatDuration } from '@/components/dossier/Dossier';
import { getLeaderboard, getPublicCases } from '@/lib/api';
import type { PublicCase } from '@/lib/api';
import type { LeaderboardRow } from '@/types/types';
import { cn } from '@/lib/utils';

export default function Leaderboard() {
  const [cases, setCases] = useState<PublicCase[]>([]);
  const [caseId, setCaseId] = useState('');
  const [rows, setRows] = useState<LeaderboardRow[] | null>(null);

  useEffect(() => {
    getPublicCases()
      .then((list) => {
        setCases(list);
        if (list[0]) setCaseId(list[0].id);
      })
      .catch(() => setCases([]));
  }, []);

  useEffect(() => {
    if (!caseId) return;
    setRows(null);
    getLeaderboard(caseId).then(setRows).catch(() => setRows([]));
  }, [caseId]);

  const selected = cases.find((c) => c.id === caseId);

  return (
    <div className="mx-auto w-full max-w-4xl">
      <RuleLabel>Leaderboard</RuleLabel>
      <h1 className="mt-1 text-balance font-display text-2xl uppercase tracking-wide md:text-3xl">
        Fastest pairs on file
      </h1>
      <p className="mt-2 max-w-prose text-pretty text-sm text-muted-foreground">
        Every row is a real pair who closed the case. Times are server-measured, attempts and hints
        included.
      </p>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <label htmlFor="case" className="font-mono text-[12px] uppercase tracking-[0.11em] text-muted-foreground">
          Case
        </label>
        <select
          id="case"
          value={caseId}
          onChange={(e) => setCaseId(e.target.value)}
          className="h-9 min-w-0 max-w-full flex-1 border border-input bg-background px-2 text-sm sm:max-w-sm"
        >
          {cases.map((c) => (
            <option key={c.id} value={c.id}>{c.title}</option>
          ))}
        </select>
      </div>

      {selected && (
        <div className="mt-4 flex flex-wrap items-center gap-3 panel px-4 py-2.5">
          <Stamp className="text-primary">{selected.kind}</Stamp>
          <span className="font-mono text-[12px] uppercase tracking-[0.1em] text-muted-foreground">
            {selected.setting} · {selected.est_minutes} min · {selected.solved_count} closed
          </span>
          <Link to={`/cases/${selected.slug}`} className="ml-auto font-mono text-[12px] uppercase tracking-[0.1em] text-primary">
            Case file
          </Link>
        </div>
      )}

      <div className="mt-4 panel">
        {rows === null ? (
          <div className="space-y-2 p-4">
            {[0, 1, 2].map((i) => <Skeleton key={i} className="h-8 w-full" />)}
          </div>
        ) : rows.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title="Nobody has closed this case yet"
              body="The board is empty because no pair has solved it. Be the first and this row is yours."
              action={<Link to="/app/lobby" className="font-mono text-[12px] uppercase tracking-[0.1em] text-primary">Open a room</Link>}
            />
          </div>
        ) : (
          <div className="w-full overflow-x-auto">
            <table className="w-full min-w-[520px] border-collapse">
              <thead>
                <tr className="border-b border-border">
                  {['#', 'Pair', 'Time', 'Attempts', 'Hints', 'Closed'].map((h) => (
                    <th
                      key={h}
                      className={cn(
                        'whitespace-nowrap px-3 py-2 font-mono text-[12px] uppercase tracking-[0.1em] text-muted-foreground',
                        h === '#' || h === 'Time' || h === 'Attempts' || h === 'Hints' ? 'text-right' : 'text-left',
                      )}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={`${r.rank}-${r.created_at}`} className="border-b border-border last:border-0">
                    <td className="whitespace-nowrap px-3 py-2 text-right font-mono text-[13px] tabular-nums text-muted-foreground">
                      {r.rank === 1 ? <Trophy className="ml-auto h-3.5 w-3.5 text-primary" aria-label="First" /> : r.rank}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-sm">
                      {r.player_a} <span className="text-muted-foreground">+</span> {r.player_b}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right font-mono text-[13px] tabular-nums">
                      {formatDuration(r.duration_seconds)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right font-mono text-[13px] tabular-nums text-muted-foreground">
                      {r.attempts}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right font-mono text-[13px] tabular-nums text-muted-foreground">
                      {r.hints_used}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 font-mono text-[12px] uppercase tracking-[0.1em] text-muted-foreground">
                      {new Date(r.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
