import { useEffect, useState } from 'react';
import { Check, Loader2, ShieldCheck, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EmptyState, RuleLabel, Stamp } from '@/components/dossier/Dossier';
import {
  getAdminCases,
  getAdminReports,
  getAdminUsers,
  publishCase,
  setReportStatus,
  unpublishCase,
  validateCase,
} from '@/lib/api';
import type { ValidationCheck } from '@/lib/api';
import type { AdminCaseRow } from '@/types/types';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export default function Admin() {
  const [cases, setCases] = useState<AdminCaseRow[] | null>(null);
  const [reports, setReports] = useState<Awaited<ReturnType<typeof getAdminReports>>>([]);
  const [users, setUsers] = useState<Awaited<ReturnType<typeof getAdminUsers>>>([]);
  const [checks, setChecks] = useState<Record<string, ValidationCheck[]>>({});
  const [busy, setBusy] = useState<string | null>(null);

  async function loadCases() {
    try {
      setCases(await getAdminCases());
    } catch {
      setCases([]);
    }
  }

  useEffect(() => {
    void loadCases();
    getAdminReports().then(setReports).catch(() => setReports([]));
    getAdminUsers().then(setUsers).catch(() => setUsers([]));
  }, []);

  async function runValidate(id: string) {
    setBusy(`v-${id}`);
    try {
      const res = await validateCase(id);
      setChecks((prev) => ({ ...prev, [id]: res.checks }));
      toast[res.ok ? 'success' : 'error'](res.ok ? 'Split rule holds.' : 'Split rule broken.');
      await loadCases();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Validation failed.');
    } finally {
      setBusy(null);
    }
  }

  async function togglePublish(row: AdminCaseRow) {
    setBusy(`p-${row.id}`);
    try {
      if (row.status === 'published') await unpublishCase(row.id);
      else await publishCase(row.id);
      await loadCases();
      toast.success(row.status === 'published' ? 'Pulled from the library.' : 'Published.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not change that.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-destructive" aria-hidden />
        <RuleLabel>Curator</RuleLabel>
      </div>
      <h1 className="mt-1 text-balance font-display text-2xl uppercase tracking-wide md:text-3xl">
        Case control
      </h1>
      <p className="mt-2 max-w-prose text-pretty text-sm text-muted-foreground">
        A case cannot be published unless the split rule validator passes. Run it here before you push
        anything live.
      </p>

      <Tabs defaultValue="cases" className="mt-5">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="cases" className="font-mono text-[12px] uppercase tracking-[0.1em]">Cases</TabsTrigger>
          <TabsTrigger value="reports" className="font-mono text-[12px] uppercase tracking-[0.1em]">Reports</TabsTrigger>
          <TabsTrigger value="users" className="font-mono text-[12px] uppercase tracking-[0.1em]">Users</TabsTrigger>
        </TabsList>

        <TabsContent value="cases" className="mt-4">
          {cases === null ? (
            <Skeleton className="h-64 w-full" />
          ) : cases.length === 0 ? (
            <EmptyState title="No cases" body="The library is empty." />
          ) : (
            <div className="space-y-2">
              {cases.map((row) => (
                <div key={row.id} className="panel">
                  <div className="flex flex-wrap items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{row.title}</p>
                      <p className="font-mono text-[12px] uppercase tracking-[0.1em] text-muted-foreground">
                        {row.kind} · {row.difficulty} · {row.evidence_count} evidence · {row.slug}
                      </p>
                    </div>
                    <Stamp className={row.status === 'published' ? 'text-accent' : 'text-muted-foreground'}>
                      {row.status}
                    </Stamp>
                    <Stamp className={row.validation_ok ? 'text-accent' : 'text-destructive'}>
                      {row.validation_ok ? 'valid' : 'unchecked'}
                    </Stamp>
                    <div className="flex shrink-0 gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        className="font-mono text-[12px] uppercase tracking-[0.1em]"
                        disabled={busy === `v-${row.id}`}
                        onClick={() => void runValidate(row.id)}
                      >
                        {busy === `v-${row.id}` ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
                        Validate
                      </Button>
                      <Button
                        size="sm"
                        variant={row.status === 'published' ? 'ghost' : 'default'}
                        className="font-mono text-[12px] uppercase tracking-[0.1em]"
                        disabled={busy === `p-${row.id}`}
                        onClick={() => void togglePublish(row)}
                      >
                        {row.status === 'published' ? 'Unpublish' : 'Publish'}
                      </Button>
                    </div>
                  </div>
                  {checks[row.id] && (
                    <div className="border-t border-border px-4 py-2">
                      {checks[row.id].map((c) => (
                        <div key={c.id} className="flex items-start gap-2 py-0.5">
                          {c.pass ? (
                            <Check className="mt-0.5 h-3 w-3 shrink-0 text-accent" aria-hidden />
                          ) : (
                            <X className="mt-0.5 h-3 w-3 shrink-0 text-destructive" aria-hidden />
                          )}
                          <p className={cn('text-pretty text-[13px]', c.pass ? 'text-muted-foreground' : 'text-destructive')}>
                            <span className="font-mono uppercase tracking-[0.12em]">{c.label}</span> — {c.detail}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="reports" className="mt-4">
          {reports.length === 0 ? (
            <EmptyState title="No reports" body="Nobody has reported anyone. That is the ideal state." />
          ) : (
            <div className="divide-y divide-border panel">
              {reports.map((r) => (
                <div key={r.id} className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">{r.reporter_name}</span>
                    <span className="text-muted-foreground">→</span>
                    <span className="text-sm font-medium">{r.reported_name}</span>
                    <Stamp className={r.status === 'open' ? 'text-destructive' : 'text-muted-foreground'}>{r.status}</Stamp>
                    <span className="ml-auto font-mono text-[12px] uppercase tracking-[0.1em] text-muted-foreground">
                      {new Date(r.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="mt-1 font-mono text-[12px] uppercase tracking-[0.1em] text-muted-foreground">{r.reason}</p>
                  {r.details && <p className="mt-1 text-pretty text-sm text-muted-foreground">{r.details}</p>}
                  {r.status === 'open' && (
                    <div className="mt-2 flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="font-mono text-[12px] uppercase tracking-[0.1em]"
                        onClick={async () => {
                          await setReportStatus(r.id, 'reviewed').catch(() => undefined);
                          setReports((prev) => prev.map((x) => (x.id === r.id ? { ...x, status: 'reviewed' } : x)));
                        }}
                      >
                        Mark reviewed
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="font-mono text-[12px] uppercase tracking-[0.1em]"
                        onClick={async () => {
                          await setReportStatus(r.id, 'dismissed').catch(() => undefined);
                          setReports((prev) => prev.map((x) => (x.id === r.id ? { ...x, status: 'dismissed' } : x)));
                        }}
                      >
                        Dismiss
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="users" className="mt-4">
          <div className="w-full overflow-x-auto panel">
            <table className="w-full min-w-[520px] border-collapse">
              <thead>
                <tr className="border-b border-border">
                  {['Detective', 'Joined', 'Played', 'Closed', 'Reports'].map((h) => (
                    <th key={h} className={cn('whitespace-nowrap px-3 py-2 font-mono text-[12px] uppercase tracking-[0.1em] text-muted-foreground', h === 'Detective' || h === 'Joined' ? 'text-left' : 'text-right')}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-border last:border-0">
                    <td className="whitespace-nowrap px-3 py-2 text-sm">
                      {u.detective_name}
                      {u.is_admin && <span className="ml-2 font-mono text-[12px] uppercase tracking-[0.1em] text-destructive">curator</span>}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 font-mono text-[12px] uppercase tracking-[0.1em] text-muted-foreground">
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right font-mono text-[13px] tabular-nums">{u.played}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-right font-mono text-[13px] tabular-nums">{u.solved}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-right font-mono text-[13px] tabular-nums">{u.reports}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
