import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, Loader2, Lock, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { DifficultyMark, EmptyState, RuleLabel, Stamp, formatDuration } from '@/components/dossier/Dossier';
import {
  getCaseTeaser,
  getPublicCaseResult,
  getPublicCases,
  sendContactMessage,
} from '@/lib/api';
import type { PublicCase, Teaser } from '@/lib/api';
import { cn } from '@/lib/utils';

function PageHead({ kicker, title, lede }: { kicker: string; title: string; lede?: string }) {
  return (
    <div className="border-b border-border">
      <div className="mx-auto w-full max-w-4xl px-4 py-12 md:px-6 md:py-16">
        <RuleLabel>{kicker}</RuleLabel>
        <h1 className="mt-3 text-balance font-display text-3xl font-semibold uppercase leading-tight tracking-tight md:text-5xl">
          {title}
        </h1>
        {lede && (
          <p className="mt-4 max-w-prose text-pretty text-base leading-relaxed text-muted-foreground">
            {lede}
          </p>
        )}
      </div>
    </div>
  );
}

export function HowItWorks() {
  const steps = [
    {
      n: '01',
      t: 'Open a room',
      b: 'Create a private room and send the code, or join the queue and let us pair you with a real player waiting for the same daily case. No bots, ever.',
    },
    {
      n: '02',
      t: 'Take your half',
      b: 'The server hands you six to ten pieces of evidence. Your partner gets a different six to ten. Neither set is enough — that is checked before the case is published.',
    },
    {
      n: '03',
      t: 'Talk it through',
      b: 'Chat lives inside the case. Pin what matters, mark what smells wrong, and share a card when you decide your partner needs it. Every share is logged.',
    },
    {
      n: '04',
      t: 'Accuse together',
      b: 'One of you proposes the verdict. The other confirms it. Three attempts. Then the file closes and the deduction chain shows exactly who held which clue.',
    },
  ];
  return (
    <div>
      <PageHead
        kicker="The mechanic"
        title="How a case is cut in half"
        lede="Obligate is not a quiz with two players. It is one investigation split across two people, where the answer only exists in the conversation between them."
      />
      <div className="mx-auto w-full max-w-4xl px-4 py-12 md:px-6">
        <div className="divide-y divide-border border-y border-border">
          {steps.map((s) => (
            <div key={s.n} className="grid gap-3 py-6 md:grid-cols-[80px_1fr] md:gap-6">
              <span className="font-display text-2xl font-semibold text-primary/70">{s.n}</span>
              <div>
                <h2 className="font-display text-lg uppercase tracking-wide">{s.t}</h2>
                <p className="mt-2 max-w-prose text-pretty text-sm leading-relaxed text-muted-foreground">
                  {s.b}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-10 panel p-6">
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-primary" aria-hidden />
            <h2 className="font-display text-base uppercase tracking-wide">The split rule</h2>
          </div>
          <p className="mt-3 max-w-prose text-pretty text-sm leading-relaxed text-muted-foreground">
            Every case is run through a validator before it can be published. It checks three things
            for every verdict question: your half alone leaves at least two answers standing, your
            partner's half alone leaves at least two standing, and both halves together leave exactly
            one. A case that fails any of those checks cannot go live.
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            {[
              ['Your half alone', '2+ answers survive'],
              ["Partner's half alone", '2+ answers survive'],
              ['Both halves', 'exactly 1 survives'],
            ].map(([k, v]) => (
              <div key={k} className="border border-border px-3 py-2">
                <p className="font-mono text-[12px] uppercase tracking-[0.1em] text-muted-foreground">
                  {k}
                </p>
                <p className="mt-1 text-sm">{v}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button asChild className="font-mono text-[13px] uppercase tracking-[0.11em]">
            <Link to="/auth?mode=signup">Open a case file</Link>
          </Button>
          <Button asChild variant="outline" className="font-mono text-[13px] uppercase tracking-[0.11em]">
            <Link to="/cases">See the library</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

export function Pricing() {
  const plans = [
    {
      name: 'Free',
      tag: 'Solo detective',
      blurb: 'Everything you need to play a case tonight.',
      features: [
        'The daily mystery, every day',
        'Three private rooms a month',
        'Full campaign access',
        'Live chat in every case (voice coming soon)',
        'Daily leaderboard',
      ],
      cta: 'Start free',
      href: '/auth?mode=signup',
      featured: false,
    },
    {
      name: 'Group',
      tag: 'Up to twelve detectives',
      blurb: 'For a club, a team or a standing Friday night.',
      features: [
        'Everything in Free',
        'Unlimited private rooms',
        'Group-exclusive cases',
        'Group ledger: solve rate, average time, best pairings',
        'Per-member contribution on every case',
      ],
      cta: 'Start free',
      href: '/auth?mode=signup',
      featured: true,
    },
  ];

  return (
    <div>
      <PageHead
        kicker="Plans"
        title="Everything is free during beta."
        lede="Both plans are open while we are in beta. Nothing is charged, no card is taken, and no checkout is connected on this deployment."
      />
      <div className="mx-auto w-full max-w-4xl px-4 py-12 md:px-6">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border border-primary/40 bg-primary/[0.06] px-4 py-3">
          <Stamp className="text-primary">Beta</Stamp>
          <p className="text-pretty text-sm text-foreground">
            Free during beta — both plans, no card, no trial clock.
          </p>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={cn(
                'flex flex-col p-6',
                plan.featured ? 'panel border-primary/50' : 'panel',
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p
                    className={cn(
                      'font-mono text-[12px] uppercase tracking-[0.12em]',
                      plan.featured ? 'text-primary' : 'text-muted-foreground',
                    )}
                  >
                    {plan.name}
                  </p>
                  <p className="mt-1 font-mono text-[12px] uppercase tracking-[0.1em] text-muted-foreground">
                    {plan.tag}
                  </p>
                </div>
                <Stamp className="shrink-0 text-primary">Free during beta</Stamp>
              </div>

              <p className="mt-4 font-display text-3xl font-semibold">Free</p>
              <p className="mt-1 text-pretty text-sm text-muted-foreground">{plan.blurb}</p>

              <ul className="mt-5 flex-1 space-y-2.5 text-sm">
                {plan.features.map((f) => (
                  <li key={f} className="flex gap-2 text-muted-foreground">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                    <span className="text-pretty">{f}</span>
                  </li>
                ))}
              </ul>

              <Button
                asChild
                variant={plan.featured ? 'default' : 'outline'}
                className="mt-6 font-mono text-[13px] uppercase tracking-[0.11em]"
              >
                <Link to={plan.href}>{plan.cta}</Link>
              </Button>
            </div>
          ))}
        </div>

        <div className="mt-8 panel p-5">
          <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
            No payment provider is connected while we are in beta, so there is nothing to check out
            and no subscription to cancel. If that changes, the plans above will show a price and the
            billing page will say plainly what is active — we never show a subscription you do not
            have.
          </p>
        </div>
      </div>
    </div>
  );
}

export function Privacy() {
  return (
    <div>
      <PageHead kicker="Legal" title="Privacy policy" lede="Last updated 16 November 2026." />
      <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-12 text-sm leading-relaxed text-muted-foreground md:px-6">
        {[
          ['What we store', 'Your email address, your detective name, an avatar seed, and the record of the cases you have played: rooms, verdicts, attempts, hints used, durations and outcomes. We store the messages you send inside a case room so both players can read the history.'],
          ['Voice', 'Voice calls are coming soon and are not available yet. When they ship they will run through Nexconn, and Obligate will not record, transcribe or store audio.'],
          ['Evidence and solutions', 'Each player receives only their own half of the evidence. The other half and the solution stay on the server until a verdict is submitted. This is enforced by database access rules, not by the interface.'],
          ['Who can see your data', 'You can see your own profile, rooms and results. Your partner can see your detective name, your readiness, the evidence you deliberately share, and the messages you send. Administrators can see reports and moderation records. Nobody can read your private notes.'],
          ['Retention', 'Case records are kept so leaderboards and statistics stay accurate. You can delete your account from Settings, which removes your profile, rooms and messages.'],
          ['Cookies', 'We use a single session cookie to keep you signed in. No advertising or tracking cookies are set.'],
          ['Contact', 'Questions about this policy go through the contact page.'],
        ].map(([h, b]) => (
          <section key={h}>
            <h2 className="font-display text-base uppercase tracking-wide text-foreground">{h}</h2>
            <p className="mt-2 text-pretty">{b}</p>
          </section>
        ))}
      </div>
    </div>
  );
}

export function Terms() {
  return (
    <div>
      <PageHead kicker="Legal" title="Terms of service" lede="Last updated 16 November 2026." />
      <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-12 text-sm leading-relaxed text-muted-foreground md:px-6">
        {[
          ['The service', 'Obligate is a two-player cooperative deduction game. Cases are fictional. Names, businesses and events in the case library are invented and any resemblance is coincidental.'],
          ['Your account', 'One account per person. You are responsible for keeping your credentials private. Do not share an account between two players — the split only works if each half has one owner.'],
          ['Fair play', 'Do not attempt to obtain the other player\'s evidence, the solution, or the deduction chain by any means other than playing. Do not scrape, automate, or reverse-engineer the case library. Accounts that do may be closed.'],
          ['Conduct', 'Chat is for the case. Harassment, threats and hate speech are grounds for removal. Every room has a report control.'],
          ['Subscriptions', 'Group plans are billed monthly through Stripe and renew until cancelled. Cancelling stops the next renewal; access continues to the end of the paid period.'],
          ['Availability', 'We aim to keep the service up but do not guarantee uninterrupted access. Cases in progress pause if a player disconnects.'],
          ['Liability', 'The service is provided as is. Nothing here limits liability that cannot be limited by law.'],
        ].map(([h, b]) => (
          <section key={h}>
            <h2 className="font-display text-base uppercase tracking-wide text-foreground">{h}</h2>
            <p className="mt-2 text-pretty">{b}</p>
          </section>
        ))}
      </div>
    </div>
  );
}

export function Contact() {
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [state, setState] = useState<'idle' | 'busy' | 'sent' | 'error'>('idle');
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState('busy');
    setError('');
    try {
      await sendContactMessage(form);
      setState('sent');
      setForm({ name: '', email: '', subject: '', message: '' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send that.');
      setState('error');
    }
  }

  return (
    <div>
      <PageHead
        kicker="Contact"
        title="Write to the bureau"
        lede="Case problems, billing, a bug, or a case you think we should build. A person reads these."
      />
      <div className="mx-auto w-full max-w-2xl px-4 py-12 md:px-6">
        {state === 'sent' ? (
          <div className="border border-accent/50 bg-accent/[0.06] p-6">
            <p className="font-display text-base uppercase tracking-wide text-accent">Message logged</p>
            <p className="mt-2 text-pretty text-sm text-muted-foreground">
              It is in the queue. We reply to the address you gave.
            </p>
            <Button variant="outline" className="mt-4" onClick={() => setState('idle')}>
              Send another
            </Button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4 panel p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="c-name" className="font-mono text-[12px] uppercase tracking-[0.11em]">Name</Label>
                <Input id="c-name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="px-2" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="c-email" className="font-mono text-[12px] uppercase tracking-[0.11em]">Email</Label>
                <Input id="c-email" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="px-2" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-subject" className="font-mono text-[12px] uppercase tracking-[0.11em]">Subject</Label>
              <Input id="c-subject" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} className="px-2" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-message" className="font-mono text-[12px] uppercase tracking-[0.11em]">Message</Label>
              <Textarea id="c-message" required rows={6} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} className="px-2" />
            </div>
            {state === 'error' && (
              <p role="alert" className="border-l-2 border-destructive bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
            )}
            <Button type="submit" disabled={state === 'busy'} className="font-mono text-[13px] uppercase tracking-[0.11em]">
              {state === 'busy' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Send
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}

export function CaseLibrary() {
  const [cases, setCases] = useState<PublicCase[] | null>(null);
  useEffect(() => {
    getPublicCases().then(setCases).catch(() => setCases([]));
  }, []);

  return (
    <div>
      <PageHead
        kicker="Library"
        title="Every case on file"
        lede="Each one is cut for two players and checked against the split rule before it was published."
      />
      <div className="mx-auto w-full max-w-5xl px-4 py-12 md:px-6">
        {cases === null ? (
          <div className="grid gap-3 md:grid-cols-2">
            {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-40 w-full" />)}
          </div>
        ) : cases.length === 0 ? (
          <EmptyState title="The library is empty" body="No cases have been published yet." />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {cases.map((c) => (
              <Link
                key={c.id}
                to={`/cases/${c.slug}`}
                className="group flex flex-col panel p-5 transition-colors hover:border-primary/60"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Stamp className="text-muted-foreground">{c.kind}</Stamp>
                  <DifficultyMark level={c.difficulty} />
                </div>
                <h2 className="mt-3 text-balance font-display text-lg uppercase tracking-wide group-hover:text-primary">
                  {c.title}
                </h2>
                <p className="mt-1 font-mono text-[12px] uppercase tracking-[0.1em] text-muted-foreground">
                  {c.setting}
                </p>
                <p className="mt-2 line-clamp-3 text-pretty text-sm text-muted-foreground">{c.premise}</p>
                <p className="mt-auto pt-4 font-mono text-[12px] uppercase tracking-[0.1em] text-muted-foreground">
                  {c.est_minutes} min · {c.solved_count} closed
                </p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function CaseDetail() {
  const { slug = '' } = useParams();
  const [teaser, setTeaser] = useState<Teaser | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    getCaseTeaser(slug).then(setTeaser).catch((e) => setError(e instanceof Error ? e.message : 'Not found'));
  }, [slug]);

  if (error) {
    const locked = error.includes('CHAPTER_LOCKED');
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-16 md:px-6">
        <EmptyState
          title={locked ? 'This level is sealed' : 'No such case'}
          body={
            locked
              ? 'Campaign levels open in order. Close the previous chapter with your partner and this file unlocks.'
              : error
          }
          action={
            <Button asChild variant="outline">
              <Link to={locked ? '/app/campaigns' : '/cases'}>
                {locked ? 'Open the campaign' : 'Back to the library'}
              </Link>
            </Button>
          }
        />
      </div>
    );
  }
  if (!teaser) {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-3 px-4 py-16 md:px-6">
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div>
      <div className="border-b border-border">
        <div className="mx-auto w-full max-w-4xl px-4 py-10 md:px-6 md:py-14">
          <Link to="/cases" className="inline-flex items-center gap-1 font-mono text-[12px] uppercase tracking-[0.11em] text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3 w-3" /> Library
          </Link>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Stamp className="text-primary">Case file</Stamp>
            <DifficultyMark level={teaser.difficulty} />
            <span className="font-mono text-[12px] uppercase tracking-[0.1em] text-muted-foreground">
              {teaser.est_minutes} min
            </span>
          </div>
          <h1 className="mt-3 text-balance font-display text-3xl font-semibold uppercase leading-tight tracking-tight md:text-5xl">
            {teaser.title}
          </h1>
          <p className="mt-2 font-mono text-[13px] uppercase tracking-[0.11em] text-muted-foreground">
            {teaser.setting}
          </p>
          <p className="mt-4 max-w-prose text-pretty text-base leading-relaxed text-muted-foreground">
            {teaser.premise}
          </p>
          <Button asChild className="mt-6 font-mono text-[13px] uppercase tracking-[0.11em]">
            <Link to="/app/lobby">Play this case <ArrowRight className="ml-2 h-4 w-4" /></Link>
          </Button>
        </div>
      </div>

      <div className="mx-auto grid w-full max-w-4xl gap-8 px-4 py-10 md:grid-cols-2 md:px-6">
        <div>
          <RuleLabel>What you will be asked</RuleLabel>
          <div className="mt-3 space-y-3">
            {teaser.questions.map((q) => (
              <div key={q.id} className="panel p-4">
                <p className="font-mono text-[12px] uppercase tracking-[0.12em] text-primary">{q.label}</p>
                <p className="mt-1 text-sm">{q.prompt}</p>
                <ul className="mt-2 space-y-1">
                  {q.options.map((o) => (
                    <li key={o.id} className="text-xs text-muted-foreground">— {o.label}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
        <div>
          <RuleLabel>Sample evidence · one half only</RuleLabel>
          <div className="mt-3 divide-y divide-border panel">
            {teaser.sample.slice(0, 4).map((e) => (
              <div key={e.code} className="px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <p className="min-w-0 text-sm font-medium">{e.title}</p>
                  <span className={cn('shrink-0 font-mono text-[12px] uppercase', e.player === 'A' ? 'text-playerA' : 'text-playerB')}>
                    {e.code}
                  </span>
                </div>
                <p className="mt-1 text-pretty font-mono text-[14px] leading-relaxed text-muted-foreground">{e.body}</p>
              </div>
            ))}
            {teaser.sample.length === 0 && (
              <p className="px-4 py-6 text-sm text-muted-foreground">Evidence is sealed until you are in a room.</p>
            )}
          </div>
          <p className="mt-3 text-pretty text-xs text-muted-foreground">
            The other half is held on the server. You will never receive it in your browser.
          </p>
        </div>
      </div>
    </div>
  );
}

export function PublicResult() {
  const { slug = '' } = useParams();
  const [data, setData] = useState<Awaited<ReturnType<typeof getPublicCaseResult>> | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    getPublicCases()
      .then((rows) => {
        const found = rows.find((r) => r.slug === slug);
        if (!found) throw new Error('That case is not in the library.');
        return getPublicCaseResult(found.id);
      })
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : 'Not found'));
  }, [slug]);

  if (error) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-16 md:px-6">
        <EmptyState title="Nothing to show" body={error} action={<Button asChild variant="outline"><Link to="/cases">Library</Link></Button>} />
      </div>
    );
  }
  if (!data) {
    return <div className="mx-auto w-full max-w-3xl px-4 py-16 md:px-6"><Skeleton className="h-64 w-full" /></div>;
  }

  return (
    <div>
      <PageHead kicker="Case closed" title={data.title} lede={data.setting} />
      <div className="mx-auto w-full max-w-3xl px-4 py-10 md:px-6">
        {data.gated ? (
          <div className="panel p-6">
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-primary" aria-hidden />
              <p className="font-display text-base uppercase tracking-wide">Sealed until the day closes</p>
            </div>
            <p className="mt-2 text-pretty text-sm text-muted-foreground">
              This is today's case. The solution opens once the day is over, or once you have played it
              yourself.
            </p>
            <Button asChild className="mt-4 font-mono text-[13px] uppercase tracking-[0.11em]">
              <Link to="/app">Play today's case</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                ['Pairs closed', String(data.solved_count)],
                ['Fastest', formatDuration(data.fastest_seconds)],
                ['Questions', String(data.questions.length)],
              ].map(([k, v]) => (
                <div key={k} className="panel px-4 py-3">
                  <p className="font-mono text-[12px] uppercase tracking-[0.1em] text-muted-foreground">{k}</p>
                  <p className="mt-1 font-display text-xl font-semibold tabular-nums">{v}</p>
                </div>
              ))}
            </div>
            <div className="panel p-5">
              <RuleLabel>The verdict</RuleLabel>
              <div className="mt-3 space-y-2">
                {data.questions.map((q) => {
                  const chosen = data.solution[q.id];
                  const label = q.options.find((o) => o.id === chosen)?.label ?? chosen;
                  return (
                    <div key={q.id} className="flex flex-wrap items-baseline gap-2 border-b border-border pb-2 last:border-0">
                      <span className="font-mono text-[12px] uppercase tracking-[0.12em] text-primary">{q.label}</span>
                      <span className="text-sm">{label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="panel p-5">
              <RuleLabel>What happened</RuleLabel>
              <p className="mt-3 text-pretty text-sm leading-relaxed text-muted-foreground">{data.narrative}</p>
              <p className="mt-3 text-pretty text-sm leading-relaxed text-muted-foreground">{data.epilogue}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function NotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-2xl flex-col items-center justify-center px-4 text-center">
      <Stamp className="text-destructive">File not found</Stamp>
      <h1 className="mt-4 font-display text-4xl font-semibold uppercase tracking-tight">404</h1>
      <p className="mt-3 max-w-prose text-pretty text-sm text-muted-foreground">
        That drawer is empty. The case may have been moved, or the link was cut short.
      </p>
      <div className="mt-6 flex gap-3">
        <Button asChild className="font-mono text-[13px] uppercase tracking-[0.11em]">
          <Link to="/">Front desk</Link>
        </Button>
        <Button asChild variant="outline" className="font-mono text-[13px] uppercase tracking-[0.11em]">
          <Link to="/cases">Case library</Link>
        </Button>
      </div>
    </div>
  );
}

export function Unauthorized() {
  return (
    <div className="mx-auto flex min-h-[50vh] w-full max-w-2xl flex-col items-center justify-center px-4 text-center">
      <X className="h-6 w-6 text-destructive" aria-hidden />
      <h1 className="mt-3 font-display text-2xl uppercase tracking-wide">Restricted</h1>
      <p className="mt-2 text-pretty text-sm text-muted-foreground">
        That area is for administrators.
      </p>
      <Button asChild variant="outline" className="mt-5">
        <Link to="/app">Back to the desk</Link>
      </Button>
    </div>
  );
}
