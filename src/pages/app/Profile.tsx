import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState, RuleLabel, Stamp, formatDuration } from '@/components/dossier/Dossier';
import { getMyRooms, getMyStats } from '@/lib/api';
import type { MyStats, RoomListItem } from '@/types/types';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export default function Profile() {
  const { profile, session, updateProfile } = useAuth();
  const [stats, setStats] = useState<MyStats | null>(null);
  const [rooms, setRooms] = useState<RoomListItem[] | null>(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (profile) setName(profile.detective_name);
  }, [profile]);

  useEffect(() => {
    getMyStats().then(setStats).catch(() => undefined);
    getMyRooms().then(setRooms).catch(() => setRooms([]));
  }, []);

  async function save() {
    if (!session?.user) return;
    if (name.trim().length < 2) {
      toast.error('Names need at least two characters.');
      return;
    }
    setBusy(true);
    try {
      await updateProfile({ detective_name: name.trim() });
      toast.success('Name updated.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save that.');
    } finally {
      setBusy(false);
    }
  }

  const closed = rooms?.filter((r) => r.status === 'finished') ?? [];

  return (
    <div className="mx-auto w-full max-w-4xl">
      <RuleLabel>Profile</RuleLabel>
      <h1 className="mt-1 text-balance font-display text-2xl uppercase tracking-wide md:text-3xl">
        {profile?.detective_name ?? 'Detective'}
      </h1>
      <p className="mt-1 font-mono text-[12px] uppercase tracking-[0.1em] text-muted-foreground">
        On file since {profile ? new Date(profile.created_at).toLocaleDateString() : '—'}
        {profile?.is_admin ? ' · curator' : ''}
      </p>

      <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          ['Closed', stats ? String(stats.solved) : '—'],
          ['Played', stats ? String(stats.played) : '—'],
          ['Streak', stats ? String(stats.streak) : '—'],
          ['Best streak', stats ? String(stats.best_streak) : '—'],
          ['Average', stats ? formatDuration(stats.avg_seconds) : '—'],
          ['Fastest', stats ? formatDuration(stats.fastest_seconds) : '—'],
          ['Accuracy', stats ? `${Math.round(stats.accuracy * 100)}%` : '—'],
          ['Hints used', stats ? String(stats.hints_used) : '—'],
        ].map(([k, v]) => (
          <div key={k} className="panel px-3 py-2">
            <p className="font-mono text-[12px] uppercase tracking-[0.1em] text-muted-foreground">{k}</p>
            <p className="mt-0.5 font-display text-lg font-semibold tabular-nums">{v}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-[1fr_1.2fr]">
        <div className="panel p-4">
          <RuleLabel>Detective name</RuleLabel>
          <Label htmlFor="dn" className="sr-only">Detective name</Label>
          <Input id="dn" value={name} onChange={(e) => setName(e.target.value)} className="mt-2 px-2" maxLength={32} />
          <Button
            size="sm"
            className="mt-3 font-mono text-[12px] uppercase tracking-[0.1em]"
            disabled={busy || name === profile?.detective_name}
            onClick={save}
          >
            {busy ? <Loader2 className="mr-1.5 h-3 w-3 animate-spin" /> : <Save className="mr-1.5 h-3 w-3" />}
            Save
          </Button>
          <p className="mt-3 text-pretty text-xs text-muted-foreground">
            Your partner sees this name in the room. It appears on leaderboards next to theirs.
          </p>
        </div>

        <div className="panel">
          <div className="border-b border-border px-4 py-2.5">
            <RuleLabel>Case history</RuleLabel>
          </div>
          {rooms === null ? (
            <div className="space-y-2 p-4"><Skeleton className="h-6 w-full" /><Skeleton className="h-6 w-full" /></div>
          ) : closed.length === 0 ? (
            <div className="p-4">
              <EmptyState title="No closed cases" body="Your record starts with the first case you finish." />
            </div>
          ) : (
            <div className="max-h-72 divide-y divide-border overflow-y-auto">
              {closed.map((r) => (
                <Link key={r.id} to={`/app/room/${r.id}`} className="flex items-center gap-3 px-4 py-2 hover:bg-muted/40">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{r.case_title}</p>
                    <p className="font-mono text-[12px] uppercase tracking-[0.1em] text-muted-foreground">
                      {r.partner_name ?? 'solo'} · {new Date(r.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <Stamp className={r.outcome === 'solved' ? 'text-accent' : 'text-destructive'}>
                    {r.outcome ?? 'open'}
                  </Stamp>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
