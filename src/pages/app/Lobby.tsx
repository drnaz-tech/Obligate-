import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Copy, Loader2, Radio, Search, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DifficultyMark, EmptyState, RuleLabel, Stamp } from '@/components/dossier/Dossier';
import {
  createRoom,
  getDailyCase,
  getEntitlements,
  getMyGroups,
  getPublicCases,
  joinMatchmaking,
  joinRoom,
  leaveMatchmaking,
  pollMatchmaking,
} from '@/lib/api';
import type { PublicCase } from '@/lib/api';
import type { Entitlements, GroupSummary } from '@/types/types';
import { toast } from 'sonner';

export default function Lobby() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [cases, setCases] = useState<PublicCase[] | null>(null);
  const [daily, setDaily] = useState<{ id: string; title: string } | null>(null);
  const [ent, setEnt] = useState<Entitlements | null>(null);
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [selected, setSelected] = useState<string>(params.get('case') ?? '');
  const [groupId, setGroupId] = useState<string>('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [queue, setQueue] = useState<'idle' | 'waiting'>('idle');
  const [waited, setWaited] = useState(0);

  useEffect(() => {
    let alive = true;
    Promise.all([
      getPublicCases().catch(() => []),
      getDailyCase().catch(() => null),
      getEntitlements().catch(() => null),
      getMyGroups().catch(() => []),
    ]).then(([c, d, e, g]) => {
      if (!alive) return;
      setCases(c);
      setDaily(d ? { id: d.id, title: d.title } : null);
      setEnt(e);
      setGroups(g);
      if (!params.get('case') && d) setSelected(d.id);
    });
    return () => {
      alive = false;
    };
  }, [params]);

  useEffect(() => {
    if (queue !== 'waiting') return;
    const id = window.setInterval(async () => {
      setWaited((w) => w + 2);
      try {
        const res = await pollMatchmaking();
        if (res.status === 'matched' && res.room_id) {
          window.clearInterval(id);
          setQueue('idle');
          navigate(`/app/room/${res.room_id}`);
        }
      } catch {
        /* keep waiting */
      }
    }, 2000);
    return () => window.clearInterval(id);
  }, [queue, navigate]);

  const playable = useMemo(
    () => (cases ?? []).filter((c) => c.kind !== 'group'),
    [cases],
  );
  const groupCases = useMemo(() => (cases ?? []).filter((c) => c.kind === 'group'), [cases]);

  async function handleCreate() {
    if (!selected) {
      toast.error('Pick a case first.');
      return;
    }
    setBusy('create');
    try {
      const res = await createRoom(selected, groupId ? 'group' : 'private', groupId || undefined);
      navigate(`/app/room/${res.room_id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not open that room.');
    } finally {
      setBusy(null);
    }
  }

  async function handleJoin() {
    if (code.trim().length < 4) {
      toast.error('Enter the six-character room code.');
      return;
    }
    setBusy('join');
    try {
      const res = await joinRoom(code);
      navigate(`/app/room/${res.room_id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No room with that code.');
    } finally {
      setBusy(null);
    }
  }

  async function handleQueue() {
    if (!daily) {
      toast.error('No daily case is scheduled yet.');
      return;
    }
    setBusy('queue');
    try {
      const res = await joinMatchmaking(daily.id);
      if (res.status === 'matched' && res.room_id) {
        navigate(`/app/room/${res.room_id}`);
      } else {
        setQueue('waiting');
        setWaited(0);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not join the queue.');
    } finally {
      setBusy(null);
    }
  }

  async function handleLeaveQueue() {
    await leaveMatchmaking().catch(() => undefined);
    setQueue('idle');
  }

  return (
    <div className="mx-auto w-full max-w-5xl">
      <RuleLabel>Rooms</RuleLabel>
      <h1 className="mt-1 text-balance font-display text-2xl uppercase tracking-wide md:text-3xl">
        Open a file
      </h1>
      <p className="mt-2 max-w-prose text-pretty text-sm leading-relaxed text-muted-foreground">
        Two players per case. Create a room and send the code, join one you were given, or wait in the
        queue for a real partner.
      </p>

      {ent && (
        <div className="mt-4 flex flex-wrap items-center gap-3 panel px-4 py-2.5">
          <Stamp className={ent.can_create_room ? 'text-accent' : 'text-destructive'}>
            {ent.plan === 'free' ? 'Free plan' : ent.plan}
          </Stamp>
          <span className="font-mono text-[12px] uppercase tracking-[0.1em] text-muted-foreground">
            {ent.rooms_limit < 0
              ? 'Unlimited private rooms'
              : `${ent.rooms_used} of ${ent.rooms_limit} private rooms used this month`}
          </span>
          {!ent.can_create_room && (
            <Button asChild size="sm" variant="outline" className="ml-auto font-mono text-[12px] uppercase tracking-[0.1em]">
              <Link to="/app/billing">Upgrade</Link>
            </Button>
          )}
        </div>
      )}

      <div className="mt-5 grid gap-4 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] md:items-start">
      <Tabs defaultValue="create">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="create" className="font-mono text-[12px] uppercase tracking-[0.1em]">Create</TabsTrigger>
          <TabsTrigger value="join" className="font-mono text-[12px] uppercase tracking-[0.1em]">Join</TabsTrigger>
          <TabsTrigger value="queue" className="font-mono text-[12px] uppercase tracking-[0.1em]">Find a partner</TabsTrigger>
        </TabsList>

        <TabsContent value="create" className="mt-4">
          <div className="panel p-4">
            <Label className="font-mono text-[12px] uppercase tracking-[0.11em]">Case</Label>
            {cases === null ? (
              <Skeleton className="mt-2 h-40 w-full" />
            ) : (
              <div className="mt-2 max-h-80 space-y-1.5 overflow-y-auto pr-1">
                {playable.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelected(c.id)}
                    className={`flex w-full items-start gap-3 border px-3 py-2.5 text-left transition-colors ${
                      selected === c.id ? 'border-primary bg-primary/10' : 'border-border hover:border-border/80 hover:bg-muted/50'
                    }`}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{c.title}</span>
                      <span className="mt-0.5 block font-mono text-[12px] uppercase tracking-[0.1em] text-muted-foreground">
                        {c.kind} · {c.setting}
                      </span>
                    </span>
                    <span className="shrink-0"><DifficultyMark level={c.difficulty} /></span>
                  </button>
                ))}
                {groupCases.length > 0 && (
                  <>
                    <p className="pt-2 font-mono text-[12px] uppercase tracking-[0.11em] text-muted-foreground">
                      Group-exclusive
                    </p>
                    {groupCases.map((c) => {
                      const unlocked = ent?.group_cases;
                      return (
                        <button
                          key={c.id}
                          type="button"
                          disabled={!unlocked}
                          onClick={() => setSelected(c.id)}
                          className={`flex w-full items-start gap-3 border px-3 py-2.5 text-left transition-colors disabled:border-border disabled:text-muted-foreground ${
                            selected === c.id ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted/50'
                          }`}
                        >
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium">{c.title}</span>
                            <span className="mt-0.5 block font-mono text-[12px] uppercase tracking-[0.1em] text-muted-foreground">
                              {unlocked ? c.setting : 'Needs a group plan'}
                            </span>
                          </span>
                          <span className="shrink-0"><DifficultyMark level={c.difficulty} /></span>
                        </button>
                      );
                    })}
                  </>
                )}
              </div>
            )}

            {groups.length > 0 && (
              <div className="mt-4 space-y-1.5">
                <Label htmlFor="group" className="font-mono text-[12px] uppercase tracking-[0.11em]">
                  Play under a group (optional)
                </Label>
                <select
                  id="group"
                  value={groupId}
                  onChange={(e) => setGroupId(e.target.value)}
                  className="h-10 w-full border border-input bg-background px-2 text-sm"
                >
                  <option value="">No group</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </div>
            )}

            <Button
              onClick={handleCreate}
              disabled={busy === 'create' || !selected || (ent ? !ent.can_create_room : false)}
              className="mt-4 w-full font-mono text-[13px] uppercase tracking-[0.11em]"
            >
              {busy === 'create' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Open room
            </Button>
            {ent && !ent.can_create_room && (
              <p className="mt-2 text-pretty text-xs text-destructive">
                You have used your free private rooms this month. The daily mystery and the queue stay
                open, or upgrade for unlimited rooms.
              </p>
            )}
          </div>
        </TabsContent>

        <TabsContent value="join" className="mt-4">
          <div className="panel p-4">
            <Label htmlFor="code" className="font-mono text-[12px] uppercase tracking-[0.11em]">
              Room code
            </Label>
            <Input
              id="code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="ABC123"
              maxLength={8}
              className="mt-2 px-2 font-mono text-lg uppercase tracking-[0.3em]"
            />
            <Button
              onClick={handleJoin}
              disabled={busy === 'join'}
              className="mt-4 w-full font-mono text-[13px] uppercase tracking-[0.11em]"
            >
              {busy === 'join' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Join room
            </Button>
            <p className="mt-3 text-pretty text-xs text-muted-foreground">
              Your partner shares a six-character code or a link. If the room is already full, the code
              will tell you.
            </p>
          </div>
        </TabsContent>

        <TabsContent value="queue" className="mt-4">
          <div className="panel p-4">
            <div className="flex items-center gap-2">
              <Radio className="h-4 w-4 text-primary" aria-hidden />
              <p className="font-display text-sm uppercase tracking-wide">Today's mystery</p>
            </div>
            <p className="mt-1 text-pretty text-sm text-muted-foreground">
              {daily ? daily.title : 'No daily case is scheduled yet.'}
            </p>

            {queue === 'waiting' ? (
              <div className="mt-4 border border-accent/40 bg-accent/[0.06] p-4">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-accent" aria-hidden />
                  <p className="font-mono text-[13px] uppercase tracking-[0.1em] text-accent">
                    In the queue · {waited}s
                  </p>
                </div>
                <p className="mt-2 text-pretty text-sm text-muted-foreground">
                  Nobody else is waiting right now. We will pair you the moment a real player joins —
                  there is no bot partner. You can leave the queue and share a room code instead.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={handleLeaveQueue} className="font-mono text-[12px] uppercase tracking-[0.1em]">
                    Leave queue
                  </Button>
                  <Button asChild size="sm" variant="ghost" className="font-mono text-[12px] uppercase tracking-[0.1em]">
                    <Link to="/app/lobby?case=">Open a private room instead</Link>
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                onClick={handleQueue}
                disabled={busy === 'queue' || !daily}
                className="mt-4 w-full font-mono text-[13px] uppercase tracking-[0.11em]"
              >
                {busy === 'queue' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                Find a partner
              </Button>
            )}
          </div>
        </TabsContent>
      </Tabs>

        <aside className="space-y-3">
          <div className="panel p-4">
            <RuleLabel>How a room works</RuleLabel>
            <ol className="mt-2 space-y-1.5 text-[13px] leading-relaxed text-muted-foreground">
              <li>1. Pick a case and open the room.</li>
              <li>2. Send the code or the link to your partner.</li>
              <li>3. Both mark ready — the clock starts.</li>
            </ol>
          </div>
          <div className="flex items-start gap-2 panel px-4 py-3">
            <Users className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            <p className="text-pretty text-[13px] leading-relaxed text-muted-foreground">
              Rooms expire if nobody joins. If your partner drops mid-case, the clock pauses for five
              minutes and the room waits for them.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
