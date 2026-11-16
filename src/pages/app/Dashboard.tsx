import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Clock, Flame, Plus, Target, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { DifficultyMark, EmptyState, RuleLabel, Stamp, formatDuration, useCountdown } from '@/components/dossier/Dossier';
import { getDailyCase, getMyPendingInvites, getMyRooms, getMyStats } from '@/lib/api';
import type { DailyCase } from '@/lib/api';
import type { MyStats, RoomListItem } from '@/types/types';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex flex-col justify-between panel px-3 py-2.5">
      <p className="font-mono text-[12px] uppercase tracking-[0.1em] text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-xl font-semibold tabular-nums text-foreground md:text-2xl">{value}</p>
      {hint && (
        <p className="mt-0.5 font-mono text-[12px] uppercase tracking-[0.1em] text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-display text-base uppercase tracking-wide text-foreground">{title}</h2>
        {typeof count === 'number' && count > 0 && (
          <span className="font-mono text-[12px] uppercase tracking-[0.1em] text-muted-foreground">
            {count} {count === 1 ? 'file' : 'files'}
          </span>
        )}
      </div>
      <div className="mt-2.5">{children}</div>
    </section>
  );
}

function RoomRow({
  room,
  action,
  meta,
}: {
  room: RoomListItem;
  action: { label: string; to: string; variant?: 'default' | 'outline' | 'ghost' };
  meta: string;
}) {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 md:px-4">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{room.case_title}</p>
        <p className="truncate font-mono text-[12px] uppercase tracking-[0.1em] text-muted-foreground">{meta}</p>
      </div>
      <Button
        asChild
        size="sm"
        variant={action.variant ?? 'outline'}
        className="shrink-0 font-mono text-[12px] uppercase tracking-[0.1em]"
      >
        <Link to={action.to}>{action.label}</Link>
      </Button>
    </div>
  );
}

export default function Dashboard() {
  const { profile } = useAuth();
  const [daily, setDaily] = useState<DailyCase | null>(null);
  const [stats, setStats] = useState<MyStats | null>(null);
  const [rooms, setRooms] = useState<RoomListItem[]>([]);
  const [invites, setInvites] = useState<RoomListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const countdown = useCountdown(daily?.next_reset);

  useEffect(() => {
    let alive = true;
    Promise.all([
      getDailyCase().catch(() => null),
      getMyStats().catch(() => null),
      getMyRooms().catch(() => []),
      getMyPendingInvites().catch(() => []),
    ]).then(([d, s, r, i]) => {
      if (!alive) return;
      setDaily(d);
      setStats(s);
      setRooms(r);
      setInvites(i);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, []);

  const active = rooms.filter((r) => r.status === 'active' || r.status === 'lobby');
  const recent = rooms.filter((r) => r.status === 'finished').slice(0, 4);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <RuleLabel>Bureau · today</RuleLabel>
          <h1 className="mt-1 text-balance font-display text-2xl uppercase tracking-wide md:text-3xl">
            {profile?.detective_name ? `Desk of ${profile.detective_name}` : 'Your desk'}
          </h1>
        </div>
        <Button asChild className="shrink-0 font-mono text-[12px] uppercase tracking-[0.11em]">
          <Link to="/app/lobby">
            <Plus className="mr-2 h-4 w-4" /> New room
          </Link>
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        <div className="flex flex-col panel">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2.5 md:px-4">
            <div className="flex items-center gap-2">
              <Stamp className="text-primary">Daily mystery</Stamp>
              {daily && <DifficultyMark level={daily.difficulty} />}
            </div>
            <div className="flex items-center gap-1.5 font-mono text-[12px] uppercase tracking-[0.1em] text-muted-foreground">
              <Clock className="h-3 w-3" aria-hidden />
              <span className="tabular-nums">
                {countdown.hours}:{countdown.minutes}:{countdown.seconds}
              </span>
              <span>to next</span>
            </div>
          </div>
          {loading ? (
            <div className="space-y-2 p-4">
              <Skeleton className="h-6 w-2/3" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : daily ? (
            <div className="flex flex-1 flex-col p-3 md:p-4">
              <h2 className="text-balance font-display text-xl uppercase tracking-wide text-foreground">
                {daily.title}
              </h2>
              <p className="mt-1 font-mono text-[12px] uppercase tracking-[0.1em] text-muted-foreground">
                {daily.setting}
              </p>
              <p className="mt-2.5 text-pretty text-sm leading-relaxed text-muted-foreground">{daily.premise}</p>
              <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-2 pt-4">
                <Button asChild className="font-mono text-[12px] uppercase tracking-[0.11em]">
                  <Link to={daily.my_room_id ? `/app/room/${daily.my_room_id}` : `/app/lobby?case=${daily.id}`}>
                    {daily.my_room_id ? 'Resume today’s case' : 'Take today’s case'}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <span className="text-pretty font-mono text-[12px] uppercase tracking-[0.1em] text-muted-foreground">
                  {daily.solved_today === 0
                    ? 'Nobody has closed it yet today.'
                    : `${daily.solved_today} ${daily.solved_today === 1 ? 'pair has' : 'pairs have'} closed it today.`}
                </span>
              </div>
            </div>
          ) : (
            <div className="p-4">
              <EmptyState
                title="No case scheduled"
                body="The daily mystery has not been assigned yet. Check back shortly."
              />
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <Stat
            label="Cases closed"
            value={stats ? String(stats.solved) : '—'}
            hint={stats ? `${stats.played} played` : undefined}
          />
          <Stat
            label="Streak"
            value={stats ? String(stats.streak) : '—'}
            hint={stats ? `best ${stats.best_streak}` : undefined}
          />
          <Stat label="Average" value={stats ? formatDuration(stats.avg_seconds) : '—'} hint="per case" />
          <Stat
            label="Accuracy"
            value={stats ? `${Math.round(stats.accuracy * 100)}%` : '—'}
            hint="verdicts correct"
          />
        </div>
      </div>

      {invites.length > 0 && (
        <Section title="Waiting on you" count={invites.length}>
          <div className="divide-y divide-border panel">
            {invites.map((r) => (
              <RoomRow
                key={r.id}
                room={r}
                meta={`${r.partner_name ? `${r.partner_name} opened this room` : 'Room open'} · code ${r.code}`}
                action={{ label: 'Join', to: `/app/room/${r.id}`, variant: 'default' }}
              />
            ))}
          </div>
        </Section>
      )}

      <Section title="Open files" count={active.length}>
        {loading ? (
          <Skeleton className="h-24 w-full" />
        ) : active.length === 0 ? (
          <EmptyState
            title="No open files"
            body="Nothing in progress. Open a room and send the code to a partner, or take today's case."
            action={
              <Button asChild variant="outline" className="font-mono text-[12px] uppercase tracking-[0.11em]">
                <Link to="/app/lobby">Open a room</Link>
              </Button>
            }
          />
        ) : (
          <div className="divide-y divide-border panel">
            {active.map((r) => (
              <RoomRow
                key={r.id}
                room={r}
                meta={`${r.status === 'lobby' ? 'In the lobby' : 'In progress'} · ${r.partner_name ?? 'no partner yet'} · ${r.code}`}
                action={{
                  label: r.status === 'lobby' ? 'Lobby' : 'Resume',
                  to: `/app/room/${r.id}`,
                  variant: 'outline',
                }}
              />
            ))}
          </div>
        )}
      </Section>

      {recent.length > 0 && (
        <Section title="Recently closed" count={recent.length}>
          <div className="divide-y divide-border panel">
            {recent.map((r) => (
              <RoomRow
                key={r.id}
                room={r}
                meta={`${r.outcome === 'solved' ? 'Solved' : r.outcome === 'failed' ? 'Unsolved' : 'Abandoned'} · ${r.partner_name ?? 'solo'}`}
                action={{ label: 'Read file', to: `/app/room/${r.id}`, variant: 'ghost' }}
              />
            ))}
          </div>
        </Section>
      )}

      <div className="grid gap-2.5 md:grid-cols-3">
        {[
          { to: '/app/campaigns', icon: Target, t: 'Campaigns', b: 'Level-based mysteries that carry decisions forward.' },
          { to: '/app/leaderboard', icon: Flame, t: 'Leaderboard', b: 'Real times from real pairs, per case.' },
          { to: '/app/groups', icon: Users, t: 'Groups', b: 'Your people, your rooms, your ledger.' },
        ].map((c) => (
          <Link
            key={c.to}
            to={c.to}
            className={cn(
              'group flex flex-col panel p-3.5 transition-colors hover:border-primary/60',
            )}
          >
            <c.icon className="h-4 w-4 text-primary" aria-hidden />
            <p className="mt-2 font-display text-sm uppercase tracking-wide text-foreground group-hover:text-primary">
              {c.t}
            </p>
            <p className="mt-1 text-pretty text-[13px] leading-relaxed text-muted-foreground">{c.b}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
