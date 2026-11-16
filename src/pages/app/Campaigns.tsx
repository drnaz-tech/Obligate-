import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, BookOpen, Check, Loader2, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { DifficultyMark, EmptyState, RuleLabel, Stamp } from '@/components/dossier/Dossier';
import { createRoom, getCampaignDetail, getCampaigns } from '@/lib/api';
import type { CampaignRow } from '@/lib/api';
import type { CampaignSummary } from '@/types/types';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type Level = CampaignSummary['chapters'][number];

function levelState(ch: Level, index: number, completed: number): 'completed' | 'current' | 'locked' {
  if (ch.completed || ch.status === 'completed') return 'completed';
  if (ch.locked || ch.status === 'locked') return 'locked';
  if (ch.status === 'in_progress') return 'current';
  return index <= completed ? 'current' : 'locked';
}

function LevelNode({ ch, state }: { ch: Level; state: 'completed' | 'current' | 'locked' }) {
  return (
    <span
      className={cn(
        'relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 font-display text-sm font-semibold tabular-nums',
        state === 'completed' && 'border-primary bg-primary text-primary-foreground',
        state === 'current' && 'border-primary bg-primary/15 text-primary ring-4 ring-primary/15',
        state === 'locked' && 'border-border bg-muted text-muted-foreground',
      )}
      aria-hidden
    >
      {state === 'completed' ? (
        <Check className="h-4 w-4" />
      ) : state === 'locked' ? (
        <Lock className="h-3.5 w-3.5" />
      ) : (
        String(ch.chapter_number).padStart(2, '0')
      )}
    </span>
  );
}

export default function Campaigns() {
  const [rows, setRows] = useState<CampaignRow[] | null>(null);

  useEffect(() => {
    getCampaigns().then(setRows).catch(() => setRows([]));
  }, []);

  return (
    <div className="mx-auto w-full max-w-5xl">
      <RuleLabel>Campaigns</RuleLabel>
      <h1 className="mt-1 text-balance font-display text-2xl uppercase tracking-wide md:text-3xl">Long cases</h1>
      <p className="mt-2 max-w-prose text-pretty text-sm leading-relaxed text-muted-foreground">
        Multi-chapter mysteries. Each level is its own split case, and what you decide carries into the
        next file. Levels open in order and progress is saved per pair.
      </p>

      <div className="mt-6 space-y-3">
        {rows === null ? (
          [0, 1].map((i) => <Skeleton key={i} className="h-40 w-full" />)
        ) : rows.length === 0 ? (
          <EmptyState title="No campaigns yet" body="The archive is empty. Daily cases are still open." />
        ) : (
          rows.map((c) => {
            const pct = c.chapter_count ? Math.round((c.chapters_completed / c.chapter_count) * 100) : 0;
            return (
              <Link
                key={c.id}
                to={`/app/campaigns/${c.slug}`}
                className="group block panel p-4 transition-colors hover:border-primary/60 md:p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <BookOpen className="h-3.5 w-3.5 text-primary" aria-hidden />
                      <Stamp className="text-muted-foreground">{c.chapter_count} levels</Stamp>
                    </div>
                    <h2 className="mt-2 text-balance font-display text-xl uppercase tracking-wide group-hover:text-primary">
                      {c.title}
                    </h2>
                    <p className="mt-1 font-mono text-[12px] uppercase tracking-[0.1em] text-muted-foreground">
                      {c.tagline}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-display text-2xl font-semibold tabular-nums text-foreground">{pct}%</p>
                    <p className="font-mono text-[12px] uppercase tracking-[0.1em] text-muted-foreground">
                      {c.chapters_completed}/{c.chapter_count} closed
                    </p>
                  </div>
                </div>
                <p className="mt-3 max-w-prose text-pretty text-sm leading-relaxed text-muted-foreground">
                  {c.description}
                </p>
                <div className="mt-4 flex items-center gap-1.5" aria-hidden>
                  {Array.from({ length: c.chapter_count }).map((_, i) => (
                    <span
                      key={i}
                      className={cn(
                        'h-1.5 flex-1',
                        i < c.chapters_completed
                          ? 'bg-primary'
                          : i === c.chapters_completed
                            ? 'bg-primary/30'
                            : 'bg-muted',
                      )}
                    />
                  ))}
                </div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <span className="font-mono text-[12px] uppercase tracking-[0.1em] text-muted-foreground">
                    {c.chapters_completed} closed · {Math.max(c.chapter_count - c.chapters_completed - 1, 0)} locked
                  </span>
                  <span className="font-mono text-[12px] uppercase tracking-[0.1em] text-primary">
                    Open map
                  </span>
                </div>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}

export function CampaignDetail() {
  const { slug = '' } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<CampaignSummary | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    getCampaignDetail(slug)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : 'Not found'));
  }, [slug]);

  async function start(caseId: string) {
    setBusy(caseId);
    try {
      const res = await createRoom(caseId, 'campaign');
      navigate(`/app/room/${res.room_id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not open that level.');
    } finally {
      setBusy(null);
    }
  }

  if (error) {
    return (
      <div className="mx-auto w-full max-w-3xl">
        <EmptyState
          title="Campaign unavailable"
          body={error}
          action={
            <Button asChild variant="outline">
              <Link to="/app/campaigns">All campaigns</Link>
            </Button>
          }
        />
      </div>
    );
  }
  if (!data) {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const completed = data.progress?.chapters_completed ?? 0;
  const levels = data.chapters.map((ch, i) => ({ ch, state: levelState(ch, i, completed) }));
  const currentIndex = levels.findIndex((l) => l.state === 'current');
  const closedLevels = levels.filter((l) => l.state === 'completed');
  const activeId =
    levels[currentIndex]?.ch.id ??
    closedLevels[closedLevels.length - 1]?.ch.id ??
    levels[0]?.ch.id ??
    null;
  const activeLevel = levels.find((l) => l.ch.id === (selected ?? activeId)) ?? null;

  return (
    <div className="mx-auto w-full max-w-5xl">
      <Link
        to="/app/campaigns"
        className="inline-flex items-center gap-1 font-mono text-[12px] uppercase tracking-[0.11em] text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3 w-3" /> Campaigns
      </Link>
      <h1 className="mt-3 text-balance font-display text-2xl uppercase tracking-wide md:text-3xl">{data.title}</h1>
      <p className="mt-1 font-mono text-[12px] uppercase tracking-[0.1em] text-muted-foreground">{data.tagline}</p>
      <p className="mt-3 max-w-prose text-pretty text-sm leading-relaxed text-muted-foreground">
        {data.description}
      </p>

      <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 panel px-4 py-2.5">
        <Stamp className="text-primary">
          {completed}/{data.chapter_count} closed
        </Stamp>
        <span className="font-mono text-[12px] uppercase tracking-[0.1em] text-muted-foreground">
          Progress is saved per pair
        </span>
        <span className="ml-auto flex flex-wrap items-center gap-3 font-mono text-[12px] uppercase tracking-[0.1em] text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-primary" aria-hidden /> Closed
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full border border-primary bg-primary/20" aria-hidden /> Current
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-muted-foreground/60" aria-hidden /> Locked
          </span>
        </span>
      </div>

      <section className="mt-6" aria-label="Campaign map">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <RuleLabel>The path</RuleLabel>
          <span className="font-mono text-[12px] uppercase tracking-[0.1em] text-muted-foreground">
            {currentIndex >= 0 ? `Level ${currentIndex + 1} of ${levels.length}` : 'All levels closed'}
          </span>
        </div>

        {/* Desktop: one horizontal path */}
        <ol className="mt-5 hidden md:flex md:items-start">
          {levels.map(({ ch, state }, i) => {
            const active = (selected ?? activeId) === ch.id;
            return (
              <li key={ch.id} className="relative flex min-w-0 flex-1 flex-col items-center px-1.5">
                {i < levels.length - 1 && (
                  <span
                    className={cn(
                      'absolute left-1/2 top-5 h-0.5 w-full',
                      state === 'completed' ? 'bg-primary' : 'bg-border',
                    )}
                    aria-hidden
                  />
                )}
                <button
                  type="button"
                  onClick={() => setSelected(ch.id)}
                  aria-pressed={active}
                  aria-label={`Level ${ch.chapter_number}: ${ch.title} — ${state}`}
                  className={cn(
                    'relative z-10 rounded-full transition-transform hover:scale-105',
                    active && 'ring-4 ring-primary/25',
                  )}
                >
                  <LevelNode ch={ch} state={state} />
                </button>
                <p
                  className={cn(
                    'mt-2 w-full truncate text-center font-mono text-[12px] uppercase tracking-[0.1em]',
                    active ? 'text-primary' : 'text-muted-foreground',
                  )}
                >
                  {ch.title}
                </p>
              </li>
            );
          })}
        </ol>

        {/* Mobile: vertical path */}
        <ol className="mt-4 md:hidden">
          {levels.map(({ ch, state }, i) => {
            const active = (selected ?? activeId) === ch.id;
            return (
              <li key={ch.id} className="relative flex gap-3 pb-2 last:pb-0">
                {i < levels.length - 1 && (
                  <span
                    className={cn(
                      'absolute bottom-0 left-5 top-10 w-0.5',
                      state === 'completed' ? 'bg-primary' : 'bg-border',
                    )}
                    aria-hidden
                  />
                )}
                <button
                  type="button"
                  onClick={() => setSelected(ch.id)}
                  aria-pressed={active}
                  aria-label={`Level ${ch.chapter_number}: ${ch.title} — ${state}`}
                  className={cn('relative z-10 shrink-0 rounded-full', active && 'ring-4 ring-primary/25')}
                >
                  <LevelNode ch={ch} state={state} />
                </button>
                <button
                  type="button"
                  onClick={() => setSelected(ch.id)}
                  className="flex min-h-12 min-w-0 flex-1 items-center panel px-3 text-left"
                >
                  <span
                    className={cn(
                      'truncate font-mono text-[12px] uppercase tracking-[0.1em]',
                      active ? 'text-primary' : 'text-muted-foreground',
                    )}
                  >
                    {ch.title}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </section>

      {activeLevel && (
        <div className="mt-4 panel p-4 md:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-mono text-[12px] uppercase tracking-[0.1em] text-muted-foreground">
                Level {String(activeLevel.ch.chapter_number).padStart(2, '0')} ·{' '}
                {activeLevel.state === 'completed'
                  ? 'Closed'
                  : activeLevel.state === 'current'
                    ? 'Active'
                    : 'Locked'}
              </p>
              <h2 className="mt-1 text-balance font-display text-lg uppercase tracking-wide">
                {activeLevel.ch.title}
              </h2>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <DifficultyMark level={activeLevel.ch.difficulty} />
                <span className="font-mono text-[12px] uppercase tracking-[0.1em] text-muted-foreground">
                  {activeLevel.ch.est_minutes} min
                </span>
              </div>
            </div>
            <div className="shrink-0">
              {activeLevel.state === 'completed' ? (
                <span className="inline-flex items-center gap-1 font-mono text-[12px] uppercase tracking-[0.1em] text-primary">
                  <Check className="h-3 w-3" /> Closed
                </span>
              ) : activeLevel.state === 'locked' ? (
                <span className="inline-flex items-center gap-1 font-mono text-[12px] uppercase tracking-[0.1em] text-muted-foreground">
                  <Lock className="h-3 w-3" /> Locked
                </span>
              ) : (
                <Button
                  size="sm"
                  className="font-mono text-[12px] uppercase tracking-[0.1em]"
                  disabled={busy === activeLevel.ch.id}
                  onClick={() => void start(activeLevel.ch.id)}
                >
                  {busy === activeLevel.ch.id ? (
                    <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                  ) : (
                    <ArrowRight className="mr-1.5 h-3 w-3" />
                  )}
                  {activeLevel.ch.status === 'in_progress' ? 'Resume' : 'Open'}
                </Button>
              )}
            </div>
          </div>
          <p className="mt-3 text-pretty text-[13px] leading-relaxed text-muted-foreground">
            {activeLevel.state === 'completed'
              ? 'This level is closed. The next one is open to you.'
              : activeLevel.state === 'current'
                ? 'This is where your pair left off. Open it to pick the case back up.'
                : 'Locked until the level before it is closed with a correct joint accusation.'}
          </p>
        </div>
      )}

      <p className="mt-5 text-pretty text-[13px] leading-relaxed text-muted-foreground">
        A level opens only when the pair before it is closed with a correct joint accusation. A failed
        attempt does not advance the story, and locked levels cannot be opened by changing the link.
      </p>
    </div>
  );
}
