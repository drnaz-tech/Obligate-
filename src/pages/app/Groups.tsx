import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Copy, Loader2, Plus, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState, RuleLabel, Stamp, formatDuration } from '@/components/dossier/Dossier';
import { createGroup, getGroupCases, getGroupDetail, getMyGroups, joinGroup } from '@/lib/api';
import type { GroupDetail } from '@/lib/api';
import type { GroupSummary } from '@/types/types';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export default function Groups() {
  const [groups, setGroups] = useState<GroupSummary[] | null>(null);
  const [activeId, setActiveId] = useState<string>('');
  const [detail, setDetail] = useState<GroupDetail | null>(null);
  const [groupCases, setGroupCases] = useState<{ id: string; title: string; difficulty: string; est_minutes: number }[]>([]);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    try {
      const list = await getMyGroups();
      setGroups(list);
      if (!activeId && list[0]) setActiveId(list[0].id);
    } catch {
      setGroups([]);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!activeId) return;
    setDetail(null);
    getGroupDetail(activeId).then(setDetail).catch(() => setDetail(null));
    getGroupCases(activeId).then(setGroupCases).catch(() => setGroupCases([]));
  }, [activeId]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (name.trim().length < 2) {
      toast.error('Give the group a name.');
      return;
    }
    setBusy('create');
    try {
      const res = await createGroup(name.trim());
      setName('');
      await load();
      setActiveId(res.group_id);
      toast.success(`Group opened. Code ${res.invite_code}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not create that group.');
    } finally {
      setBusy(null);
    }
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (code.trim().length < 4) {
      toast.error('Enter the invite code.');
      return;
    }
    setBusy('join');
    try {
      const res = await joinGroup(code);
      setCode('');
      await load();
      setActiveId(res.group_id);
      toast.success('You are in.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No group with that code.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto w-full max-w-4xl">
      <RuleLabel>Groups</RuleLabel>
      <h1 className="mt-1 text-balance font-display text-2xl uppercase tracking-wide md:text-3xl">
        Your people
      </h1>
      <p className="mt-2 max-w-prose text-pretty text-sm text-muted-foreground">
        A group is a private space: unlimited rooms, group-exclusive cases and a ledger of how every
        pair performs.
      </p>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <form onSubmit={handleCreate} className="panel p-4">
          <Label htmlFor="gname" className="font-mono text-[12px] uppercase tracking-[0.11em]">Open a group</Label>
          <div className="mt-2 flex gap-2">
            <Input id="gname" value={name} onChange={(e) => setName(e.target.value)} placeholder="The Thursday Club" className="px-2" maxLength={40} />
            <Button type="submit" size="icon" disabled={busy === 'create'} aria-label="Create group">
              {busy === 'create' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            </Button>
          </div>
        </form>
        <form onSubmit={handleJoin} className="panel p-4">
          <Label htmlFor="gcode" className="font-mono text-[12px] uppercase tracking-[0.11em]">Join with a code</Label>
          <div className="mt-2 flex gap-2">
            <Input id="gcode" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="ABC123" className="px-2 font-mono uppercase tracking-[0.12em]" maxLength={8} />
            <Button type="submit" variant="outline" disabled={busy === 'join'}>
              {busy === 'join' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Join'}
            </Button>
          </div>
        </form>
      </div>

      {groups === null ? (
        <Skeleton className="mt-6 h-40 w-full" />
      ) : groups.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            title="No groups yet"
            body="Open one above and share the code, or join a group someone sent you."
          />
        </div>
      ) : (
        <>
          <div className="mt-6 flex flex-wrap gap-1.5">
            {groups.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => setActiveId(g.id)}
                className={cn(
                  'min-h-9 border px-3 font-mono text-[12px] uppercase tracking-[0.1em] transition-colors',
                  activeId === g.id ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:text-foreground',
                )}
              >
                {g.name}
              </button>
            ))}
          </div>

          {detail && (
            <div className="mt-4 space-y-4">
              <div className="panel">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
                  <div className="min-w-0">
                    <h2 className="truncate font-display text-lg uppercase tracking-wide">{detail.group.name}</h2>
                    <p className="font-mono text-[12px] uppercase tracking-[0.1em] text-muted-foreground">
                      {detail.members.length} members · {detail.group.plan} plan
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Stamp className={detail.group.plan === 'free' ? 'text-muted-foreground' : 'text-accent'}>
                      {detail.group.plan}
                    </Stamp>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      aria-label="Copy invite code"
                      onClick={() => void navigator.clipboard.writeText(detail.group.invite_code).then(() => toast.success('Invite code copied.'))}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                    <span className="font-mono text-sm tracking-[0.12em]">{detail.group.invite_code}</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 p-4 sm:grid-cols-4">
                  {[
                    ['Closed', String(detail.stats.solved)],
                    ['Played', String(detail.stats.played)],
                    ['Average', formatDuration(detail.stats.avg_seconds)],
                    ['Best pair', detail.stats.best_pair ?? '—'],
                  ].map(([k, v]) => (
                    <div key={k} className="border border-border px-3 py-2">
                      <p className="font-mono text-[12px] uppercase tracking-[0.1em] text-muted-foreground">{k}</p>
                      <p className="mt-0.5 truncate font-display text-base font-semibold tabular-nums">{v}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="panel">
                <div className="border-b border-border px-4 py-2.5">
                  <RuleLabel>Roster</RuleLabel>
                </div>
                <div className="w-full overflow-x-auto">
                  <table className="w-full min-w-[420px] border-collapse">
                    <thead>
                      <tr className="border-b border-border">
                        {['Detective', 'Role', 'Closed', 'Played'].map((h) => (
                          <th key={h} className={cn('whitespace-nowrap px-3 py-2 font-mono text-[12px] uppercase tracking-[0.1em] text-muted-foreground', h === 'Closed' || h === 'Played' ? 'text-right' : 'text-left')}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {detail.members.map((m) => (
                        <tr key={m.user_id} className="border-b border-border last:border-0">
                          <td className="whitespace-nowrap px-3 py-2 text-sm">{m.detective_name}</td>
                          <td className="whitespace-nowrap px-3 py-2 font-mono text-[12px] uppercase tracking-[0.1em] text-muted-foreground">{m.role}</td>
                          <td className="whitespace-nowrap px-3 py-2 text-right font-mono text-[13px] tabular-nums">{m.solved}</td>
                          <td className="whitespace-nowrap px-3 py-2 text-right font-mono text-[13px] tabular-nums text-muted-foreground">{m.played}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="panel">
                <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
                  <RuleLabel>Group-exclusive cases</RuleLabel>
                  <Link to="/app/billing" className="font-mono text-[12px] uppercase tracking-[0.1em] text-primary">
                    Plan
                  </Link>
                </div>
                {groupCases.length === 0 ? (
                  <p className="px-4 py-4 text-sm text-muted-foreground">
                    No group cases are published yet.
                  </p>
                ) : (
                  <div className="divide-y divide-border">
                    {groupCases.map((c) => (
                      <div key={c.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm">{c.title}</p>
                          <p className="font-mono text-[12px] uppercase tracking-[0.1em] text-muted-foreground">
                            {c.difficulty} · {c.est_minutes} min
                          </p>
                        </div>
                        <Button asChild size="sm" variant="outline" className="shrink-0 font-mono text-[12px] uppercase tracking-[0.1em]">
                          <Link to={`/app/lobby?case=${c.id}`}>Open</Link>
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      <div className="mt-6 flex items-start gap-2 panel px-4 py-3">
        <Users className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        <p className="text-pretty text-xs text-muted-foreground">
          Group cases and unlimited rooms need an active group plan. The ledger and roster work on any
          plan.
        </p>
      </div>
    </div>
  );
}
