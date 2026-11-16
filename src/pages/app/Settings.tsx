import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bell, LogOut, ShieldOff, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { RuleLabel, Stamp } from '@/components/dossier/Dossier';
import { getMyBlocks, unblockUser } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export default function Settings() {
  const { profile, session, signOut, updateProfile } = useAuth();
  const navigate = useNavigate();
  const [optIn, setOptIn] = useState(false);
  const [blocks, setBlocks] = useState<{ id: string; detective_name: string; created_at: string }[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (profile) setOptIn(profile.email_opt_in);
  }, [profile]);

  useEffect(() => {
    getMyBlocks().then(setBlocks).catch(() => setBlocks([]));
  }, []);

  async function toggleOptIn(next: boolean) {
    if (!session?.user) return;
    setOptIn(next);
    try {
      await updateProfile({ email_opt_in: next });
      toast.success(next ? 'Daily case emails on.' : 'Daily case emails off.');
    } catch {
      setOptIn(!next);
      toast.error('Could not save that preference.');
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl">
      <RuleLabel>Settings</RuleLabel>
      <h1 className="mt-1 text-balance font-display text-2xl uppercase tracking-wide md:text-3xl">
        Preferences
      </h1>

      <div className="mt-5 space-y-4">
        <div className="panel">
          <div className="border-b border-border px-4 py-2.5">
            <RuleLabel>Account</RuleLabel>
          </div>
          <div className="space-y-3 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-medium">{profile?.detective_name ?? 'Detective'}</p>
                <p className="truncate font-mono text-[12px] uppercase tracking-[0.1em] text-muted-foreground">
                  {session?.user?.email}
                </p>
              </div>
              <Button asChild variant="outline" size="sm" className="shrink-0 font-mono text-[12px] uppercase tracking-[0.1em]">
                <Link to="/app/profile">Edit name</Link>
              </Button>
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
              <div className="flex min-w-0 items-center gap-2">
                <Bell className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                <div className="min-w-0">
                  <Label htmlFor="optin" className="text-sm">Daily case email</Label>
                  <p className="text-pretty text-xs text-muted-foreground">
                    One message when the new case drops. Nothing else.
                  </p>
                </div>
              </div>
              <Switch id="optin" checked={optIn} onCheckedChange={(v) => void toggleOptIn(v)} className="shrink-0" />
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
            <RuleLabel>Blocked detectives</RuleLabel>
            <Stamp className="text-muted-foreground">{blocks.length}</Stamp>
          </div>
          {blocks.length === 0 ? (
            <p className="px-4 py-4 text-sm text-muted-foreground">
              Nobody blocked. You can block a partner from inside a room.
            </p>
          ) : (
            <div className="divide-y divide-border">
              {blocks.map((b) => (
                <div key={b.id} className="flex items-center gap-3 px-4 py-2.5">
                  <ShieldOff className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="min-w-0 flex-1 truncate text-sm">{b.detective_name}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="shrink-0 font-mono text-[12px] uppercase tracking-[0.1em]"
                    onClick={async () => {
                      await unblockUser(b.id).catch(() => undefined);
                      setBlocks((prev) => prev.filter((x) => x.id !== b.id));
                      toast.success('Unblocked.');
                    }}
                  >
                    Unblock
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="panel">
          <div className="border-b border-border px-4 py-2.5">
            <RuleLabel>Privacy</RuleLabel>
          </div>
          <div className="space-y-2 p-4 text-sm text-muted-foreground">
            <p className="text-pretty">
              Voice calls are coming soon and are not available yet. Chat messages are stored so both
              players can read the case history.
            </p>
            <p className="text-pretty">
              Your private notes never leave your account. Your partner only sees evidence you
              deliberately share.
            </p>
            <Link to="/privacy" className="inline-block font-mono text-[12px] uppercase tracking-[0.1em] text-primary">
              Read the privacy policy
            </Link>
          </div>
        </div>

        <div className="panel">
          <div className="border-b border-border px-4 py-2.5">
            <RuleLabel>Account removal</RuleLabel>
          </div>
          <div className="space-y-3 p-4">
            <p className="text-pretty text-sm text-muted-foreground">
              Deleting an account removes your profile, rooms and messages. Because deletion touches
              records shared with other players, it is handled by a person rather than a button.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline" size="sm" className="font-mono text-[12px] uppercase tracking-[0.1em]">
                <Link to="/contact"><Trash2 className="mr-1.5 h-3.5 w-3.5" /> Request deletion</Link>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="font-mono text-[12px] uppercase tracking-[0.1em]"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  await signOut();
                  navigate('/');
                }}
              >
                <LogOut className="mr-1.5 h-3.5 w-3.5" /> Sign out
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
