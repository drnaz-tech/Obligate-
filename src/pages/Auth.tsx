import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { RuleLabel, Stamp } from '@/components/dossier/Dossier';
import { cn } from '@/lib/utils';

export default function Auth() {
  const [params] = useSearchParams();
  const [mode, setMode] = useState<'signin' | 'signup'>(
    params.get('mode') === 'signup' ? 'signup' : 'signin',
  );
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    if (mode === 'signup' && name.trim().length < 2) {
      setError('Give yourself a detective name — at least two characters.');
      return;
    }
    if (password.length < 6) {
      setError('Passwords need at least six characters.');
      return;
    }
    setBusy(true);
    try {
      if (mode === 'signin') {
        await signIn(email.trim(), password);
        navigate('/app');
      } else {
        const { needsConfirm } = await signUp(email.trim(), password, name.trim());
        if (needsConfirm) {
          setNotice('Check your inbox to confirm the address, then sign in.');
          setMode('signin');
        } else {
          navigate('/app');
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That did not work.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden px-4 py-12">
      <div className="pointer-events-none absolute inset-0 grid grid-cols-2">
        <div className="bg-gradient-to-br from-playerA/[0.07] to-transparent" />
        <div className="bg-gradient-to-bl from-playerB/[0.07] to-transparent" />
      </div>
      <div className="pointer-events-none absolute inset-y-0 left-1/2 w-px bg-gradient-to-b from-transparent via-primary/50 to-accent/50" />

      <div className="relative w-full max-w-md">
        <div className="mb-6 text-center">
          <Link to="/" className="font-display text-2xl font-semibold uppercase tracking-[0.3em]">
            Obligate
          </Link>
          <p className="mt-2 font-mono text-[12px] uppercase tracking-[0.12em] text-muted-foreground">
            Two players. Different clues. One truth.
          </p>
        </div>

        <div className="panel">
          <div className="flex border-b border-border">
            {(['signin', 'signup'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setMode(m);
                  setError(null);
                  setNotice(null);
                }}
                className={cn(
                  'min-h-12 flex-1 font-mono text-[13px] uppercase tracking-[0.11em] transition-colors',
                  mode === m
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {m === 'signin' ? 'Sign in' : 'Open a file'}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="space-y-4 p-5">
            <div className="flex items-center justify-between">
              <RuleLabel>{mode === 'signin' ? 'Return to the bureau' : 'New detective'}</RuleLabel>
              <Stamp className="text-muted-foreground">Form 2A</Stamp>
            </div>

            {mode === 'signup' && (
              <div className="space-y-1.5">
                <Label htmlFor="name" className="font-mono text-[12px] uppercase tracking-[0.11em]">
                  Detective name
                </Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="How your partner will see you"
                  autoComplete="nickname"
                  className="px-2"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="email" className="font-mono text-[12px] uppercase tracking-[0.11em]">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                className="px-2"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="font-mono text-[12px] uppercase tracking-[0.11em]">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least six characters"
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                className="px-2"
              />
            </div>

            {error && (
              <p role="alert" className="border-l-2 border-destructive bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}
            {notice && (
              <p role="status" className="border-l-2 border-accent bg-accent/10 px-3 py-2 text-sm text-accent">
                {notice}
              </p>
            )}

            <Button type="submit" disabled={busy} className="w-full font-mono text-[13px] uppercase tracking-[0.11em]">
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {mode === 'signin' ? 'Sign in' : 'Create account'}
            </Button>

            <p className="text-pretty text-center text-xs text-muted-foreground">
              By continuing you accept the{' '}
              <Link to="/terms" className="text-foreground underline underline-offset-2">
                terms
              </Link>{' '}
              and the{' '}
              <Link to="/privacy" className="text-foreground underline underline-offset-2">
                privacy policy
              </Link>
              .
            </p>
          </form>
        </div>

        <p className="mt-4 text-center font-mono text-[12px] uppercase tracking-[0.1em] text-muted-foreground">
          <Link to="/" className="hover:text-foreground">
            ← Back to the front desk
          </Link>
        </p>
      </div>
    </div>
  );
}
