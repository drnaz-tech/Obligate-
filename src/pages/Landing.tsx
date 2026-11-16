import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  FileText,
  Folder,
  Lightbulb,
  Lock,
  MessageSquare,
  Mic,
  Play,
  Scale,
  Search,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { DifficultyMark, RuleLabel, Stamp } from '@/components/dossier/Dossier';
import { getCaseTeaser, getPublicCases, getPublicStats } from '@/lib/api';
import type { PublicCase, PublicStats, Teaser } from '@/lib/api';
import { cn } from '@/lib/utils';

function SplitHero() {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/12 bg-white/[0.055] p-4 shadow-[0_28px_90px_-28px_rgba(0,0,0,0.95)] backdrop-blur-xl md:p-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-0">
        <div className="min-w-0 sm:border-r sm:border-white/10 sm:pr-4">
          <div className="flex items-center justify-between gap-2">
            <span className="rounded-md border border-primary/60 bg-primary/10 px-2 py-0.5 font-mono text-[11px] uppercase tracking-[0.14em] text-primary">
              Player A
            </span>
            <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-white/45">
              Half one
            </span>
          </div>
          <p className="mt-3 font-mono text-[13px] leading-relaxed text-white/90">
            “I locked the reading room at 18:40 and took key #4 home on my ring.”
          </p>
          <p className="mt-3 flex items-start gap-1.5 font-mono text-[11px] uppercase leading-snug tracking-[0.1em] text-white/50">
            <FileText className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
            Statement — archivist · STMT-01
          </p>
          <div className="mt-3 space-y-1.5" aria-hidden>
            <div className="h-1.5 w-full rounded-full bg-white/10" />
            <div className="h-1.5 w-4/5 rounded-full bg-white/10" />
          </div>
        </div>

        <div className="min-w-0 sm:pl-4">
          <div className="flex items-center justify-between gap-2">
            <span className="rounded-md border border-accent/60 bg-accent/10 px-2 py-0.5 font-mono text-[11px] uppercase tracking-[0.14em] text-accent">
              Player B
            </span>
            <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-white/45">
              Half two
            </span>
          </div>
          <p className="mt-3 font-mono text-[13px] leading-relaxed text-white/90">
            “18:41 LOCK. 19:06 UNLOCK (key #4). 19:09 LOCK. 19:11 UNLOCK (key #4).”
          </p>
          <p className="mt-3 flex items-start gap-1.5 font-mono text-[11px] uppercase leading-snug tracking-[0.1em] text-white/50">
            <FileText className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
            Door log — controller export · LOG-14
          </p>
          <div className="mt-3 space-y-1.5" aria-hidden>
            <div className="h-1.5 w-full rounded-full bg-white/10" />
            <div className="h-1.5 w-3/5 rounded-full bg-white/10" />
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-start gap-2 rounded-xl border border-white/10 bg-black/30 px-3 py-2.5">
        <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
        <p className="text-pretty text-[13px] leading-relaxed text-white/80">
          She says she went home. The door says she came back. Neither of you can prove it alone.
        </p>
      </div>
    </div>
  );
}

function TeaserPanel({ teaser }: { teaser: Teaser }) {
  const [side, setSide] = useState<'A' | 'B'>('A');
  const items = useMemo(
    () => teaser.sample.filter((e) => e.player === side).slice(0, 3),
    [teaser.sample, side],
  );
  return (
    <div className="panel">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <RuleLabel>Playable teaser · from the library</RuleLabel>
          <p className="mt-1 truncate font-display text-base uppercase tracking-wide">{teaser.title}</p>
        </div>
        <DifficultyMark level={teaser.difficulty} />
      </div>
      <div className="flex border-b border-border">
        {(['A', 'B'] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSide(s)}
            className={cn(
              'flex min-h-11 flex-1 items-center justify-center gap-2 font-mono text-[13px] uppercase tracking-[0.11em] transition-colors',
              side === s
                ? s === 'A'
                  ? 'bg-playerA/10 text-playerA'
                  : 'bg-playerB/10 text-playerB'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <span
              className={cn(
                'flex h-4 w-4 items-center justify-center text-[12px] font-bold',
                s === 'A' ? 'bg-playerA text-playerA-foreground' : 'bg-playerB text-playerB-foreground',
              )}
            >
              {s}
            </span>
            {s === 'A' ? 'Your half' : "Partner's half"}
          </button>
        ))}
      </div>
      <div className="divide-y divide-border">
        {items.map((e) => (
          <div key={e.code} className="px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <p className="min-w-0 text-sm font-medium">{e.title}</p>
              <span className="shrink-0 font-mono text-[12px] uppercase tracking-widest text-muted-foreground">
                {e.code}
              </span>
            </div>
            <p className="mt-1 text-pretty font-mono text-[14px] leading-relaxed text-muted-foreground">
              {e.body}
            </p>
          </div>
        ))}
        {items.length === 0 && (
          <p className="px-4 py-6 text-sm text-muted-foreground">
            This half is sealed until you are in a room.
          </p>
        )}
      </div>
      <div className="border-t border-border px-4 py-3">
        <p className="text-pretty text-xs text-muted-foreground">
          You are seeing one half only. The other half is held on the server and never reaches your
          browser until your partner shares it.
        </p>
      </div>
    </div>
  );
}

export default function Landing() {
  const [stats, setStats] = useState<PublicStats | null>(null);
  const [cases, setCases] = useState<PublicCase[]>([]);
  const [teaser, setTeaser] = useState<Teaser | null>(null);

  useEffect(() => {
    let alive = true;
    getPublicStats().then((s) => alive && setStats(s)).catch(() => undefined);
    getPublicCases()
      .then((rows) => {
        if (!alive) return;
        setCases(rows);
        const first = rows.find((r) => r.kind === 'daily') ?? rows[0];
        if (first) getCaseTeaser(first.slug).then((t) => alive && setTeaser(t)).catch(() => undefined);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  const statItems = [
    { icon: Folder, label: 'Cases in the library', value: stats ? String(stats.cases) : '—' },
    { icon: Lock, label: 'Cases closed', value: stats ? String(stats.solved) : '—' },
    { icon: Search, label: 'Detectives on file', value: stats ? String(stats.detectives) : '—' },
  ];

  return (
    <div>
      <section className="relative isolate overflow-hidden">
        <div className="absolute inset-0 -z-10" aria-hidden>
          <picture>
            <source media="(max-width: 767px)" srcSet="/img/hero-room-v2-sm.webp" type="image/webp" />
            <source srcSet="/img/hero-room-v2.webp" type="image/webp" />
            <img
              src="/img/hero-room-v2.jpg"
              alt=""
              className="h-full w-full object-cover object-[58%_center]"
              loading="eager"
              decoding="async"
            />
          </picture>
          <div className="absolute inset-0 bg-gradient-to-r from-background via-background/92 to-background/45 md:via-background/80 md:to-background/10" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-background/55" />
        </div>

        <div className="mx-auto w-full max-w-6xl px-4 pb-8 pt-8 md:px-6 md:pb-10 md:pt-14">
          <div className="grid gap-8 md:grid-cols-[1.02fr_0.98fr] md:items-center md:gap-10">
            <div className="min-w-0">
              <span className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/[0.09] px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-primary backdrop-blur-sm">
                <Folder className="h-3.5 w-3.5" aria-hidden />
                Cooperative deduction · two players
              </span>

              <h1 className="mt-5 text-balance font-display text-[2.15rem] font-bold uppercase leading-[0.98] tracking-tight text-white sm:text-5xl md:text-[3.6rem]">
                Two players.
                <br />
                Different clues.
                <br />
                <span className="text-primary">One truth.</span>
              </h1>

              <p className="mt-5 max-w-prose text-pretty text-[15px] leading-relaxed text-white/75 md:text-base">
                Every case is cut in half. You get the statements. Your partner gets the records.
                Neither half is enough — and the answer only exists in the space between you.
              </p>

              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <Button
                  asChild
                  size="lg"
                  className="rounded-full font-mono text-[12px] uppercase tracking-[0.11em] shadow-[0_0_34px_-6px_hsl(var(--primary)/0.85)]"
                >
                  <Link to="/auth?mode=signup">
                    Open a case file <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
                  </Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="ghost"
                  className="rounded-full border border-white/25 bg-white/[0.04] font-mono text-[12px] uppercase tracking-[0.11em] text-white backdrop-blur-sm hover:bg-white/10 hover:text-white"
                >
                  <Link to="/how-it-works">
                    <Play className="mr-2 h-3.5 w-3.5" aria-hidden />
                    How the split works
                  </Link>
                </Button>
              </div>
            </div>

            <div className="min-w-0">
              <SplitHero />
            </div>
          </div>

          <div className="mt-8 rounded-2xl border border-white/10 bg-black/45 px-4 py-3 backdrop-blur-xl md:mt-10 md:px-6 md:py-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <dl className="grid grid-cols-3 gap-3 sm:gap-8">
                {statItems.map((item) => (
                  <div key={item.label} className="flex items-center gap-2.5">
                    <item.icon className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                    <div className="min-w-0">
                      <dd className="font-display text-xl font-semibold tabular-nums leading-none text-white md:text-2xl">
                        {item.value}
                      </dd>
                      <dt className="mt-1 font-mono text-[10px] uppercase leading-tight tracking-[0.1em] text-white/50 md:text-[11px]">
                        {item.label}
                      </dt>
                    </div>
                  </div>
                ))}
              </dl>
              <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-white/40">
                Think · Share · Solve
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-white/5 bg-white/[0.02]">
        <div className="mx-auto w-full max-w-6xl px-4 py-8 md:px-6 md:py-10">
          <div className="grid gap-4 md:grid-cols-3">
            {[
              {
                n: '01',
                t: 'Open a file',
                b: 'Pick a case and a partner. The server deals each of you a different half — you never see theirs.',
              },
              {
                n: '02',
                t: 'Talk it through',
                b: 'Live chat sits inside the case. Share a card when you decide they need it. Every share is logged.',
              },
              {
                n: '03',
                t: 'Accuse together',
                b: 'One proposes, both confirm. Three attempts. If you are wrong, the file closes and the truth comes out anyway.',
              },
            ].map((s) => (
              <div key={s.n} className="flex gap-3">
                <span className="mt-0.5 font-mono text-[12px] tabular-nums tracking-[0.1em] text-primary">
                  {s.n}
                </span>
                <div className="min-w-0">
                  <p className="font-display text-sm uppercase tracking-wide">{s.t}</p>
                  <p className="mt-1 text-pretty text-sm leading-relaxed text-muted-foreground">{s.b}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-white/5">
        <div className="mx-auto w-full max-w-6xl px-4 py-14 md:px-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <RuleLabel>The mechanic</RuleLabel>
              <h2 className="mt-2 text-balance font-display text-2xl uppercase tracking-wide md:text-3xl">
                Neither half can close the case
              </h2>
            </div>
            <p className="max-w-md text-pretty text-sm text-muted-foreground">
              Every case is checked by a validator before it goes live. If one player could solve it
              alone, it does not get published.
            </p>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {[
              {
                icon: Lock,
                title: 'The split rule',
                body: 'Alone, each half leaves at least two answers standing. Together, exactly one survives. That is enforced in the database, not the interface.',
              },
              {
                icon: MessageSquare,
                title: 'Talk or lose',
                body: 'Live chat sits inside the case. Share an evidence card when you decide your partner needs it — every share is logged. Voice is coming soon.',
              },
              {
                icon: Scale,
                title: 'Joint accusation',
                body: 'Either of you proposes. Both of you confirm. Three attempts, then the file closes unsolved and the truth comes out anyway.',
              },
            ].map((f) => (
              <div key={f.title} className="panel p-5">
                <f.icon className="h-5 w-5 text-primary" aria-hidden />
                <h3 className="mt-3 font-display text-base uppercase tracking-wide">{f.title}</h3>
                <p className="mt-2 text-pretty text-sm leading-relaxed text-muted-foreground">
                  {f.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-white/5">
        <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-14 md:grid-cols-2 md:items-start md:px-6">
          <div className="min-w-0">
            <RuleLabel>Try the split</RuleLabel>
            <h2 className="mt-2 text-balance font-display text-2xl uppercase tracking-wide md:text-3xl">
              Read one half. Feel the gap.
            </h2>
            <p className="mt-3 max-w-prose text-pretty text-sm leading-relaxed text-muted-foreground">
              This is a real case from the library, cut exactly as it is cut in play. Switch sides to
              see what your partner would hold — then notice that you still cannot name the culprit.
            </p>
            <ul className="mt-6 space-y-3">
              {[
                'Statements that contradict the records.',
                'Red herrings that only collapse when both halves meet.',
                'A deduction chain that names which clue came from whom.',
              ].map((t) => (
                <li key={t} className="flex gap-3 text-sm text-muted-foreground">
                  <span className="mt-1.5 h-1 w-1 shrink-0 bg-primary" aria-hidden />
                  <span className="text-pretty">{t}</span>
                </li>
              ))}
            </ul>
            <Button asChild variant="outline" className="mt-6 font-mono text-[13px] uppercase tracking-[0.11em]">
              <Link to="/cases">Browse the case files</Link>
            </Button>
          </div>
          <div className="min-w-0">
            {teaser ? (
              <TeaserPanel teaser={teaser} />
            ) : (
              <div className="space-y-2 panel p-4">
                <Skeleton className="h-6 w-2/3" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="border-b border-white/5">
        <div className="mx-auto w-full max-w-6xl px-4 py-14 md:px-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <RuleLabel>In the library</RuleLabel>
              <h2 className="mt-2 font-display text-2xl uppercase tracking-wide md:text-3xl">
                {cases.length} cases on file
              </h2>
            </div>
            <Button asChild variant="ghost" className="font-mono text-[13px] uppercase tracking-[0.11em]">
              <Link to="/cases">All case files</Link>
            </Button>
          </div>
          <div className="mt-6 grid gap-3 md:grid-cols-3">
            {cases.slice(0, 6).map((c) => (
              <Link
                key={c.id}
                to={`/cases/${c.slug}`}
                className="group flex flex-col panel p-4 transition-colors hover:border-primary/60"
              >
                <div className="flex items-center justify-between gap-2">
                  <Stamp className="text-muted-foreground">{c.kind}</Stamp>
                  <DifficultyMark level={c.difficulty} />
                </div>
                <h3 className="mt-3 text-balance font-display text-base uppercase tracking-wide group-hover:text-primary">
                  {c.title}
                </h3>
                <p className="mt-1 font-mono text-[12px] uppercase tracking-[0.1em] text-muted-foreground">
                  {c.setting}
                </p>
                <p className="mt-2 line-clamp-3 text-pretty text-sm text-muted-foreground">
                  {c.premise}
                </p>
                <p className="mt-auto pt-3 font-mono text-[12px] uppercase tracking-[0.1em] text-muted-foreground">
                  {c.est_minutes} min · {c.solved_count} closed
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-white/5">
        <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-14 md:grid-cols-2 md:px-6">
          <div>
            <RuleLabel>Plans</RuleLabel>
            <h2 className="mt-2 text-balance font-display text-2xl uppercase tracking-wide md:text-3xl">
              Everything is free during beta.
            </h2>
            <p className="mt-3 max-w-prose text-pretty text-sm leading-relaxed text-muted-foreground">
              Both plans are open and nothing is charged while we are in beta. No card, no checkout,
              no trial clock. When that changes, we will say so here first.
            </p>
            <Button asChild className="mt-6 font-mono text-[13px] uppercase tracking-[0.11em]">
              <Link to="/pricing">Compare plans</Link>
            </Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="panel p-5">
              <p className="font-mono text-[12px] uppercase tracking-[0.12em] text-muted-foreground">
                Free
              </p>
              <p className="mt-2 font-display text-3xl font-semibold">Free</p>
              <p className="mt-1 font-mono text-[12px] uppercase tracking-[0.1em] text-primary">
                During beta
              </p>
              <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                <li>Daily mystery, every day</li>
                <li>3 private rooms a month</li>
                <li>Full campaign access</li>
              </ul>
            </div>
            <div className="border border-primary/50 bg-primary/5 p-5">
              <p className="font-mono text-[12px] uppercase tracking-[0.12em] text-primary">
                Group
              </p>
              <p className="mt-2 font-display text-3xl font-semibold">Free</p>
              <p className="mt-1 font-mono text-[12px] uppercase tracking-[0.1em] text-primary">
                During beta
              </p>
              <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                <li>Unlimited private rooms</li>
                <li>Group-exclusive cases</li>
                <li>Group ledger and pairings</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-white/5">
        <div className="mx-auto w-full max-w-6xl px-4 py-10 md:px-6">
          <div className="flex flex-col gap-4 panel p-5 md:flex-row md:items-center md:justify-between md:p-6">
            <div className="min-w-0">
              <RuleLabel>Built on</RuleLabel>
              <p className="mt-2 font-display text-lg uppercase tracking-wide">Nexconn Chat SDK</p>
              <p className="mt-1 max-w-prose text-pretty text-sm leading-relaxed text-muted-foreground">
                Every case room runs on the Nexconn Chat SDK for real-time messaging between the two
                players. Messages arrive live, and the room survives a dropped connection.
              </p>
            </div>
            <span className="shrink-0 font-mono text-[12px] uppercase tracking-[0.1em] text-muted-foreground">
              Voice calls · coming soon
            </span>
          </div>
        </div>
      </section>

      <section>
        <div className="mx-auto w-full max-w-3xl px-4 py-14 md:px-6">
          <RuleLabel>Questions</RuleLabel>
          <h2 className="mt-2 font-display text-2xl uppercase tracking-wide md:text-3xl">
            Before you open a file
          </h2>
          <div className="mt-6 divide-y divide-border border-y border-border">
            {[
              {
                q: 'Can I play alone?',
                a: 'No. Every case is cut for two. There is no single-player mode and no bot partner — if nobody is in the queue, we say so.',
              },
              {
                q: 'Can my partner see my evidence?',
                a: 'Only what you deliberately share. Your half is delivered to your browser alone; theirs never leaves the server until they send it.',
              },
              {
                q: 'What happens if my partner disconnects?',
                a: 'The clock pauses for a five-minute grace window. Reconnect and the case resumes exactly where it stopped.',
              },
              {
                q: 'Is there voice chat?',
                a: 'Not yet. Voice calls are coming soon. Chat is live in every case room today.',
              },
            ].map((f) => (
              <details key={f.q} className="group py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-display text-sm uppercase tracking-wide">
                  {f.q}
                  <span className="shrink-0 font-mono text-xs text-muted-foreground group-open:hidden">+</span>
                  <span className="hidden shrink-0 font-mono text-xs text-muted-foreground group-open:inline">−</span>
                </summary>
                <p className="mt-2 max-w-prose text-pretty text-sm leading-relaxed text-muted-foreground">
                  {f.a}
                </p>
              </details>
            ))}
          </div>
          <div className="mt-10 flex flex-col items-start gap-3 panel p-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="font-display text-lg uppercase tracking-wide">Bring a partner.</p>
              <p className="mt-1 text-pretty text-sm text-muted-foreground">
                <Users className="mr-1 inline h-3.5 w-3.5" aria-hidden />
                One case, two halves, one conversation.
              </p>
            </div>
            <Button asChild className="shrink-0 font-mono text-[13px] uppercase tracking-[0.11em]">
              <Link to="/auth?mode=signup">Start a file</Link>
            </Button>
          </div>
          <p className="mt-6 flex items-center gap-2 font-mono text-[12px] uppercase tracking-[0.1em] text-muted-foreground">
            <Mic className="h-3 w-3" aria-hidden /> Voice calls are coming soon. Chat is live now.
          </p>
        </div>
      </section>
    </div>
  );
}
