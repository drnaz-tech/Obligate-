import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { RuleLabel, Stamp } from '@/components/dossier/Dossier';
import { getEntitlements, getMyGroups } from '@/lib/api';
import type { Entitlements, GroupSummary } from '@/types/types';

export default function Billing() {
  const [ent, setEnt] = useState<Entitlements | null>(null);
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [groupId, setGroupId] = useState('');

  useEffect(() => {
    getEntitlements().then(setEnt).catch(() => undefined);
    getMyGroups()
      .then((g) => {
        setGroups(g);
        const owned = g.find((x) => x.role === 'owner');
        if (owned) setGroupId(owned.id);
      })
      .catch(() => undefined);
  }, []);

  return (
    <div className="mx-auto w-full max-w-4xl">
      <RuleLabel>Plan</RuleLabel>
      <h1 className="mt-1 text-balance font-display text-2xl uppercase tracking-wide md:text-3xl">
        Billing
      </h1>
      <p className="mt-2 max-w-prose text-pretty text-sm text-muted-foreground">
        The daily mystery is free forever. A group plan is for people who want their own rooms and
        their own cases.
      </p>

      {ent === null ? (
        <Skeleton className="mt-5 h-24 w-full" />
      ) : (
        <div className="mt-5 panel">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-primary" aria-hidden />
              <span className="font-display text-sm uppercase tracking-wide">Current plan</span>
            </div>
            <Stamp className={ent.plan === 'free' ? 'text-muted-foreground' : 'text-accent'}>{ent.plan}</Stamp>
          </div>
          <div className="grid grid-cols-2 gap-2 p-4 sm:grid-cols-4">
            {[
              ['Private rooms', ent.rooms_limit < 0 ? 'Unlimited' : `${ent.rooms_used}/${ent.rooms_limit}`],
              ['Group cases', ent.group_cases ? 'Unlocked' : 'Locked'],
              ['Can open a room', ent.can_create_room ? 'Yes' : 'No'],
              ['Scope', ent.group ? 'Group' : 'Personal'],
            ].map(([k, v]) => (
              <div key={k} className="border border-border px-3 py-2">
                <p className="font-mono text-[12px] uppercase tracking-[0.1em] text-muted-foreground">{k}</p>
                <p className="mt-0.5 font-display text-base font-semibold">{v}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <div className="flex flex-col panel p-5">
          <p className="font-mono text-[12px] uppercase tracking-[0.12em] text-muted-foreground">Free</p>
          <p className="mt-2 font-display text-3xl font-semibold">Free</p>
          <p className="mt-1 font-mono text-[12px] uppercase tracking-[0.1em] text-primary">During beta</p>
          <ul className="mt-4 flex-1 space-y-2 text-sm text-muted-foreground">
            {['Daily mystery', 'Three private rooms a month', 'Full campaign access', 'Chat (voice coming soon)'].map((f) => (
              <li key={f} className="flex gap-2">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                <span className="text-pretty">{f}</span>
              </li>
            ))}
          </ul>
          <Button asChild variant="outline" className="mt-5 font-mono text-[12px] uppercase tracking-[0.1em]">
            <Link to="/app/lobby">Keep playing</Link>
          </Button>
        </div>

        <div className="flex flex-col border border-primary/50 bg-primary/[0.04] p-5">
          <p className="font-mono text-[12px] uppercase tracking-[0.12em] text-primary">Group</p>
          <p className="mt-2 font-display text-3xl font-semibold">Free</p>
          <p className="mt-1 font-mono text-[12px] uppercase tracking-[0.1em] text-primary">During beta</p>
          <ul className="mt-4 flex-1 space-y-2 text-sm text-muted-foreground">
            {['Unlimited private rooms', 'Group-exclusive cases', 'Group ledger and pairings', 'Up to twelve detectives'].map((f) => (
              <li key={f} className="flex gap-2">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                <span className="text-pretty">{f}</span>
              </li>
            ))}
          </ul>

          <div className="mt-5 border border-primary/40 bg-primary/[0.06] px-3 py-2">
            <p className="font-mono text-[12px] uppercase tracking-[0.1em] text-primary">
              Free during beta
            </p>
            <p className="mt-1 text-pretty text-[13px] leading-relaxed text-muted-foreground">
              Nothing to pay and nothing to cancel. Group features are open to every group while we
              are in beta.
            </p>
          </div>
          <Button asChild variant="outline" className="mt-3 font-mono text-[12px] uppercase tracking-[0.1em]">
            <Link to="/app/groups">Manage groups</Link>
          </Button>
        </div>
      </div>

      <div className="mt-5 panel p-4">
        <RuleLabel>How billing works</RuleLabel>
        <p className="mt-2 text-pretty text-sm leading-relaxed text-muted-foreground">
          Both plans are free while we are in beta. No payment provider is connected, so there is
          nothing to check out and no subscription to cancel. If that changes, this page will show a
          price and say plainly what is active — we never show a subscription you do not have.
        </p>
      </div>
    </div>
  );
}
