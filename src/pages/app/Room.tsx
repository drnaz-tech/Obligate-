import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Check,
  Copy,
  Flag,
  Link2,
  Loader2,
  Lock,
  Pin,
  Send,
  Share2,
  Sparkles,
  TriangleAlert,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import {
  EmptyState,
  PaperCard,
  PlayerTag,
  RuleLabel,
  Stamp,
  formatDuration,
} from '@/components/dossier/Dossier';
import {
  abandonRoom,
  addLink,
  confirmVerdict,
  getRoomState,
  heartbeat,
  proposeVerdict,
  rejectVerdict,
  removeLink,
  requestHint,
  savePlayerState,
  setReady,
  shareEvidence,
} from '@/lib/api';
import type { EvidenceItem, RoomState } from '@/types/types';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import ResultReveal from '@/components/room/ResultReveal';
import { CaseOpening } from '@/components/dossier/CaseCurtain';
import { setAmbientDucked } from '@/lib/sfx';
import { openNexconnSession } from '@/lib/nexconn';
import type { NexconnMessage, NexconnSession } from '@/lib/nexconn';
import { playAccusation, playStamp, setSfxEnabled, sfxEnabled } from '@/lib/sfx';

function useRoom(roomId: string) {
  const [state, setState] = useState<RoomState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const alive = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const next = await getRoomState(roomId);
      if (alive.current) {
        setState(next);
        setError(null);
      }
    } catch (e) {
      if (alive.current) setError(e instanceof Error ? e.message : 'Could not open that room.');
    } finally {
      if (alive.current) setLoading(false);
    }
  }, [roomId]);

  useEffect(() => {
    alive.current = true;
    void refresh();
    const beat = window.setInterval(() => {
      void heartbeat(roomId).catch(() => undefined);
    }, 20000);
    const poll = window.setInterval(() => {
      void refresh();
    }, 5000);
    return () => {
      alive.current = false;
      window.clearInterval(beat);
      window.clearInterval(poll);
    };
  }, [refresh, roomId]);

  return { state, error, loading, refresh };
}

function SoundToggle() {
  const [on, setOn] = useState(() => sfxEnabled());
  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
      aria-label={on ? 'Mute sound effects' : 'Unmute sound effects'}
      title={on ? 'Sound on' : 'Sound off'}
      onClick={() => {
        const next = !on;
        setSfxEnabled(next);
        setOn(next);
        if (next) playStamp();
      }}
    >
      {on ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
    </Button>
  );
}

function RoomHeader({ state }: { state: RoomState }) {
  const [copied, setCopied] = useState(false);
  const link = `${window.location.origin}/app/room/${state.room.id}`;
  const bothHere = !!state.partner?.online;

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1.5 panel px-3 py-2">
      <Stamp className="shrink-0 text-primary">
        {state.room.status === 'lobby' ? 'Lobby' : state.room.status === 'active' ? 'In progress' : 'Closed'}
      </Stamp>
      <h1 className="min-w-0 flex-1 truncate font-display text-base uppercase tracking-wide md:text-lg">
        {state.case.title}
      </h1>
      <div className="flex shrink-0 items-center gap-x-3 gap-y-1 font-mono text-[12px] uppercase tracking-[0.1em] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className={cn('h-1.5 w-1.5 rounded-full', bothHere ? 'bg-accent' : 'bg-muted-foreground')} aria-hidden />
          {bothHere ? 'Both here' : 'Partner away'}
        </span>
        <span className="tabular-nums">{formatDuration(state.elapsed_seconds)}</span>
        <span className="tabular-nums">{state.room.attempts}/3</span>
        <span className="hidden items-center gap-1 sm:flex">
          <span className="text-foreground">{state.room.code}</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            aria-label="Copy invite link"
            onClick={() => {
              void navigator.clipboard.writeText(link).then(() => {
                setCopied(true);
                toast.success('Invite link copied.');
                window.setTimeout(() => setCopied(false), 2000);
              });
            }}
          >
            {copied ? <Check className="h-3.5 w-3.5 text-accent" /> : <Copy className="h-3.5 w-3.5" />}
          </Button>
        </span>
        <SoundToggle />
      </div>
    </div>
  );
}

function LobbyPanel({ state, refresh }: { state: RoomState; refresh: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const link = `${window.location.origin}/app/room/${state.room.id}`;
  const meReady = state.me.ready;
  const partnerReady = state.partner?.ready ?? false;

  return (
    <div className="grid gap-3 md:grid-cols-2 md:items-start">
      <div className="panel p-4 md:p-5">
        <RuleLabel>Your half is ready</RuleLabel>
        <p className="mt-2 text-pretty text-sm leading-relaxed text-muted-foreground">
          {state.evidence.length} pieces of evidence are waiting on your side. Your partner holds{' '}
          {state.partner_total} more that you will never see unless they share them.
        </p>
        <div className="mt-4 flex items-center gap-3">
          <PlayerTag slot={state.me.slot} name="You" />
          <span
            className={cn(
              'font-mono text-[12px] uppercase tracking-[0.1em]',
              meReady ? 'text-accent' : 'text-muted-foreground',
            )}
          >
            {meReady ? 'Ready' : 'Not ready'}
          </span>
        </div>
        <Button
          className="mt-4 w-full font-mono text-[13px] uppercase tracking-[0.11em]"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await setReady(state.room.id, !meReady);
              await refresh();
            } catch (e) {
              toast.error(e instanceof Error ? e.message : 'Could not update readiness.');
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {meReady ? 'Stand down' : 'I am ready'}
        </Button>
      </div>

      <div className="panel p-4 md:p-5">
        <RuleLabel>Waiting for your partner</RuleLabel>
        {state.partner ? (
          <>
            <div className="mt-3 flex items-center gap-3">
              <PlayerTag slot={state.partner.slot} name={state.partner.detective_name} />
              <span
                className={cn(
                  'font-mono text-[12px] uppercase tracking-[0.1em]',
                  partnerReady ? 'text-accent' : 'text-muted-foreground',
                )}
              >
                {partnerReady ? 'Ready' : 'Reading their half'}
              </span>
            </div>
            <p className="mt-3 text-pretty text-sm leading-relaxed text-muted-foreground">
              The case begins the moment you are both ready. Nothing is revealed until then.
            </p>
          </>
        ) : (
          <>
            <p className="mt-2 text-pretty text-sm leading-relaxed text-muted-foreground">
              Nobody has joined yet. Send them the code or the link.
            </p>
            <div className="mt-3 flex items-center gap-2 border border-border bg-background px-3 py-2">
              <Link2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
              <span className="min-w-0 flex-1 truncate font-mono text-[13px] text-muted-foreground">{link}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                aria-label="Copy link"
                onClick={() => void navigator.clipboard.writeText(link).then(() => toast.success('Link copied.'))}
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
          </>
        )}
        <Button
          variant="ghost"
          className="mt-4 w-full font-mono text-[12px] uppercase tracking-[0.1em] text-muted-foreground"
          onClick={async () => {
            await abandonRoom(state.room.id).catch(() => undefined);
            toast.message('Room closed.');
          }}
        >
          Close this room
        </Button>
      </div>
    </div>
  );
}

function EvidenceCard({
  item,
  pinned,
  suspicious,
  onPin,
  onSuspicious,
  onShare,
  onLinkStart,
  linking,
}: {
  item: EvidenceItem;
  pinned: boolean;
  suspicious: boolean;
  onPin: () => void;
  onSuspicious: () => void;
  onShare: () => void;
  onLinkStart: () => void;
  linking: boolean;
}) {
  return (
    <PaperCard className={cn('relative p-3', suspicious && 'border-destructive/60')}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-mono text-[12px] uppercase tracking-[0.1em] text-muted-foreground">
            {item.type} · {item.code}
          </p>
          <h3 className="mt-1 text-balance font-display text-sm uppercase tracking-wide text-foreground">
            {item.title}
          </h3>
        </div>
        <div className="flex shrink-0 gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            className={cn('h-7 w-7', pinned ? 'text-primary' : 'text-muted-foreground')}
            aria-label={pinned ? 'Unpin evidence' : 'Pin evidence'}
            aria-pressed={pinned}
            onClick={onPin}
          >
            <Pin className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={cn('h-7 w-7', suspicious ? 'text-destructive' : 'text-muted-foreground')}
            aria-label={suspicious ? 'Clear suspicion mark' : 'Mark as suspicious'}
            aria-pressed={suspicious}
            onClick={onSuspicious}
          >
            <TriangleAlert className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      <p className="mt-2 whitespace-pre-line text-pretty font-mono text-[14px] leading-relaxed text-foreground">
        {item.body}
      </p>
      {item.meta?.source && (
        <p className="mt-2 font-mono text-[12px] uppercase tracking-[0.1em] text-muted-foreground">
          Source: {item.meta.source}
          {item.meta.ref ? ` · ${item.meta.ref}` : ''}
        </p>
      )}
      <div className="mt-2.5 flex flex-wrap gap-1.5 border-t border-border pt-2">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 font-mono text-[12px] uppercase tracking-[0.1em] text-muted-foreground hover:text-foreground"
          onClick={onShare}
        >
          <Share2 className="mr-1 h-3 w-3" /> Share
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            'h-7 px-2 font-mono text-[12px] uppercase tracking-[0.1em]',
            linking ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
          )}
          onClick={onLinkStart}
        >
          <Link2 className="mr-1 h-3 w-3" /> {linking ? 'Pick second' : 'Link'}
        </Button>
      </div>
    </PaperCard>
  );
}

function chatError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  if (raw.includes('NOT_A_MEMBER')) return 'Only the two players in this room can open the wire.';
  if (raw.includes('PARTNER_NOT_JOINED')) return 'Your partner has not joined yet.';
  if (raw.includes('TOKEN')) return 'Could not reach the wire. Check your connection and retry.';
  if (raw.includes('CONNECT_FAILED')) return 'The wire refused the connection. Retry in a moment.';
  if (raw.includes('SEND_FAILED')) return 'That message did not send. Try again.';
  return 'The wire dropped. Retry to reconnect.';
}

function clockOf(sentAt: number): string {
  if (!sentAt) return '';
  return new Date(sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function ChatPanel({ state }: { state: RoomState }) {
  const [session, setSession] = useState<NexconnSession | null>(null);
  const [messages, setMessages] = useState<NexconnMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [status, setStatus] = useState<'connecting' | 'ready' | 'error'>('connecting');
  const [error, setError] = useState<string | null>(null);
  const [partnerTyping, setPartnerTyping] = useState(false);
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);
  const sessionRef = useRef<NexconnSession | null>(null);
  const disposed = useRef(false);
  const typingTimer = useRef<number | null>(null);

  const connect = useCallback(async () => {
    setStatus('connecting');
    setError(null);
    setMessages([]);
    try {
      const next = await openNexconnSession(state.room.id);
      // The panel may have moved to another case while the token was in flight.
      if (disposed.current) {
        void next.close();
        return;
      }
      sessionRef.current = next;
      setSession(next);
      const history = await next.loadHistory();
      setMessages(history);
      setStatus('ready');
    } catch (e) {
      setStatus('error');
      setError(chatError(e));
    }
  }, [state.room.id]);

  useEffect(() => {
    disposed.current = false;
    void connect();
    return () => {
      disposed.current = true;
      const current = sessionRef.current;
      sessionRef.current = null;
      void current?.close();
    };
  }, [connect]);

  useEffect(() => {
    if (!session) return;
    const offMessage = session.onMessage((message) => {
      setMessages((prev) => (prev.some((m) => m.id === message.id) ? prev : [...prev, message]));
    });
    const offTyping = session.onTyping(() => {
      setPartnerTyping(true);
      if (typingTimer.current) window.clearTimeout(typingTimer.current);
      typingTimer.current = window.setTimeout(() => setPartnerTyping(false), 2600);
    });
    return () => {
      offMessage();
      offTyping();
    };
  }, [session]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length, partnerTyping]);

  const send = async () => {
    const text = draft.trim();
    if (!text || !session || sending) return;
    setSending(true);
    try {
      const sent = await session.sendText(text);
      setMessages((prev) => (prev.some((m) => m.id === sent.id) ? prev : [...prev, sent]));
      setDraft('');
    } catch (e) {
      toast.error(chatError(e));
    } finally {
      setSending(false);
    }
  };

  const partnerName = state.partner?.detective_name ?? 'Partner';

  return (
    <div className="flex h-full min-h-0 w-full flex-col panel">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <RuleLabel>Wire</RuleLabel>
          <span className="truncate font-mono text-[12px] uppercase tracking-[0.1em] text-muted-foreground">
            {partnerName}
          </span>
        </div>
        <span className="flex shrink-0 items-center gap-1.5 font-mono text-[12px] uppercase tracking-[0.1em] text-muted-foreground">
          <span
            className={cn(
              'h-1.5 w-1.5 rounded-full',
              status === 'ready' ? 'bg-accent' : status === 'error' ? 'bg-destructive' : 'bg-muted-foreground',
            )}
            aria-hidden
          />
          {status === 'ready' ? 'Live' : status === 'error' ? 'Offline' : 'Linking'}
        </span>
      </div>

      {status === 'error' ? (
        <div className="flex min-h-0 flex-1 flex-col items-start justify-center gap-2 p-4">
          <p className="text-pretty text-sm text-foreground">{error}</p>
          <Button size="sm" variant="outline" onClick={() => void connect()}>
            Retry
          </Button>
        </div>
      ) : (
        <>
          <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto px-3 py-3">
            {messages.length === 0 && status === 'ready' && (
              <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
                The wire is open. Say what you see — your partner cannot see your half.
              </p>
            )}
            {messages.map((message, index) => {
              const mine = message.from === 'me';
              const prev = messages[index - 1];
              const grouped = prev && prev.from === message.from && !prev.evidence && !message.evidence;
              if (message.evidence) {
                return (
                  <div
                    key={message.id}
                    className={cn(
                      'border p-2.5',
                      mine ? 'border-playerA/60 bg-playerA/[0.08]' : 'border-playerB/60 bg-playerB/[0.08]',
                    )}
                  >
                    <p
                      className={cn(
                        'font-mono text-[12px] uppercase tracking-[0.1em]',
                        mine ? 'text-playerA' : 'text-playerB',
                      )}
                    >
                      {mine ? 'You shared' : `${partnerName} shared`} · {message.evidence.code}
                    </p>
                    <p className="mt-1 text-sm font-medium text-foreground">{message.evidence.title}</p>
                    <p className="mt-1 whitespace-pre-line font-mono text-[13px] leading-relaxed text-foreground">
                      {message.evidence.body}
                    </p>
                  </div>
                );
              }
              return (
                <div key={message.id} className={cn('flex flex-col', mine ? 'items-end' : 'items-start')}>
                  {!grouped && (
                    <span className="mb-0.5 px-1 font-mono text-[12px] uppercase tracking-[0.1em] text-muted-foreground">
                      {mine ? 'You' : partnerName}
                    </span>
                  )}
                  <div
                    className={cn(
                      'max-w-[88%] whitespace-pre-line break-words px-3 py-2 text-sm leading-relaxed',
                      mine
                        ? 'rounded-l-md rounded-tr-md bg-playerA/20 text-foreground'
                        : 'rounded-r-md rounded-tl-md bg-playerB/20 text-foreground',
                    )}
                  >
                    {message.text}
                  </div>
                  <span className="mt-0.5 px-1 font-mono text-[12px] tabular-nums text-muted-foreground">
                    {clockOf(message.sentAt)}
                  </span>
                </div>
              );
            })}
            {partnerTyping && (
              <p className="font-mono text-[12px] uppercase tracking-[0.1em] text-muted-foreground">
                {partnerName} is typing…
              </p>
            )}
            <div ref={endRef} />
          </div>

          <div className="flex shrink-0 items-end gap-2 border-t border-border p-2">
            <Textarea
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                session?.sendTyping();
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              rows={1}
              placeholder={status === 'ready' ? 'Message your partner' : 'Linking the wire…'}
              disabled={status !== 'ready'}
              className="min-h-10 flex-1 resize-none px-2.5 py-2 text-sm"
            />
            <Button
              size="icon"
              className="h-10 w-10 shrink-0"
              aria-label="Send message"
              disabled={status !== 'ready' || sending || !draft.trim()}
              onClick={() => void send()}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

function VerdictBar({ state, refresh }: { state: RoomState; refresh: () => Promise<void> }) {
  const questions = state.case.questions ?? [];
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const proposal = state.room.verdict;
  const myId = state.me.slot === 'A' ? state.room.host_id : state.room.guest_id;
  const iProposed = proposal?.proposed_by === myId;
  const proposedAnswers = proposal?.answers ?? {};
  const complete = questions.every((q) => answers[q.id]);
  const answered = questions.filter((q) => answers[q.id]).length;

  async function propose() {
    if (!complete) {
      toast.error('Answer every question before accusing.');
      return;
    }
    setBusy('propose');
    try {
      await proposeVerdict(state.room.id, answers);
      playAccusation();
      await refresh();
      toast.success('Proposal sent. Your partner has to confirm it.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not send that.');
    } finally {
      setBusy(null);
    }
  }

  async function confirm() {
    setBusy('confirm');
    try {
      const res = await confirmVerdict(state.room.id);
      playStamp();
      await refresh();
      if (res.correct) toast.success('Case closed.');
      else toast.error(`Wrong. ${3 - res.attempts} attempts left.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not confirm.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="panel">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-border px-3 py-2.5 md:px-4">
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
          <RuleLabel>Joint accusation</RuleLabel>
          <span className="font-mono text-[12px] uppercase tracking-[0.1em] text-muted-foreground">
            {state.room.attempts}/3 used
          </span>
          {!proposal && (
            <span className="font-mono text-[12px] uppercase tracking-[0.1em] text-muted-foreground">
              {answered}/{questions.length} answered
            </span>
          )}
        </div>
        <span className="font-mono text-[12px] uppercase tracking-[0.1em] text-muted-foreground">
          Both players must agree
        </span>
      </div>

      <div>
        {proposal ? (
          <div className="p-3">
            <p className="font-mono text-[12px] uppercase tracking-[0.1em] text-primary">
              {iProposed ? 'Your proposal is on the table' : 'Your partner proposes'}
            </p>
            <div className="mt-2 grid gap-1.5 md:grid-cols-3">
              {questions.map((q) => {
                const chosen = proposedAnswers[q.id];
                const label = q.options.find((o) => o.id === chosen)?.label ?? chosen;
                return (
                  <div key={q.id} className="border border-border bg-background/40 px-2 py-1.5">
                    <p className="font-mono text-[12px] uppercase tracking-[0.1em] text-muted-foreground">{q.label}</p>
                    <p className="mt-0.5 text-sm text-foreground">{label}</p>
                  </div>
                );
              })}
            </div>
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              {iProposed ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="font-mono text-[12px] uppercase tracking-[0.1em]"
                  disabled={busy === 'reject'}
                  onClick={async () => {
                    setBusy('reject');
                    await rejectVerdict(state.room.id).catch(() => undefined);
                    await refresh();
                    setBusy(null);
                  }}
                >
                  Withdraw
                </Button>
              ) : (
                <>
                  <Button
                    size="sm"
                    className="font-mono text-[12px] uppercase tracking-[0.1em]"
                    disabled={busy === 'confirm'}
                    onClick={confirm}
                  >
                    {busy === 'confirm' && <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />}
                    Confirm accusation
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="font-mono text-[12px] uppercase tracking-[0.1em]"
                    disabled={busy === 'reject'}
                    onClick={async () => {
                      setBusy('reject');
                      await rejectVerdict(state.room.id).catch(() => undefined);
                      await refresh();
                      setBusy(null);
                    }}
                  >
                    Reject
                  </Button>
                </>
              )}
              <p className="text-pretty text-[12px] text-muted-foreground">
                Both of you must agree. A wrong accusation costs one of three attempts.
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="p-3 md:p-4">
              <div className="grid gap-3 md:grid-cols-3">
                {questions.map((q) => (
                  <fieldset key={q.id} className="min-w-0 border border-border bg-background/40 p-2.5">
                    <legend className="px-1 font-mono text-[12px] uppercase tracking-[0.1em] text-primary">
                      {q.label}
                    </legend>
                    <p className="text-pretty text-[13px] leading-snug text-foreground">{q.prompt}</p>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {q.options.map((o) => {
                        const selected = answers[q.id] === o.id;
                        return (
                          <button
                            key={o.id}
                            type="button"
                            onClick={() => setAnswers((prev) => ({ ...prev, [q.id]: o.id }))}
                            aria-pressed={selected}
                            className={cn(
                              'min-h-10 border px-2.5 py-1.5 text-left text-[13px] leading-snug transition-colors',
                              selected
                                ? 'border-primary bg-primary/20 text-foreground'
                                : 'border-border text-muted-foreground hover:border-muted-foreground hover:text-foreground',
                            )}
                          >
                            {o.label}
                          </button>
                        );
                      })}
                    </div>
                  </fieldset>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-3 py-2.5 md:px-4">
              <p className="text-pretty text-[12px] text-muted-foreground">
                Both of you must agree. A wrong accusation costs one of three attempts.
              </p>
              <Button
                size="sm"
                className="ml-auto font-mono text-[12px] uppercase tracking-[0.1em]"
                disabled={!complete || busy === 'propose'}
                onClick={propose}
              >
                {busy === 'propose' && <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />}
                Propose accusation
              </Button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

export default function Room() {
  const { roomId = '' } = useParams();
  const navigate = useNavigate();
  const { state, error, loading, refresh } = useRoom(roomId);
  const [notes, setNotes] = useState('');
  const [notesDirty, setNotesDirty] = useState(false);
  const [linkFrom, setLinkFrom] = useState<string | null>(null);
  const [tab, setTab] = useState<'mine' | 'board'>('mine');
  const [mobileTab, setMobileTab] = useState<'mine' | 'wire' | 'partner'>('mine');
  const [opening, setOpening] = useState(false);

  useEffect(() => {
    setAmbientDucked(true);
    return () => setAmbientDucked(false);
  }, []);

  useEffect(() => {
    if (!state || state.room.status !== 'active') return;
    const key = `ob-open-${state.room.id}`;
    if (window.sessionStorage.getItem(key)) return;
    window.sessionStorage.setItem(key, '1');
    setOpening(true);
  }, [state]);

  useEffect(() => {
    if (state && !notesDirty) setNotes(state.me.notes ?? '');
  }, [state, notesDirty]);

  const pinned = state?.me.pinned ?? [];
  const suspicious = state?.me.suspicious ?? [];

  const persist = useCallback(
    async (nextPinned: string[], nextSuspicious: string[], nextNotes?: string) => {
      if (!state) return;
      try {
        await savePlayerState(state.room.id, nextNotes ?? notes, nextPinned, nextSuspicious);
        await refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Could not save that.');
      }
    },
    [state, notes, refresh],
  );

  const myEvidence = useMemo(() => state?.evidence ?? [], [state]);
  const shared = useMemo(() => state?.shared ?? [], [state]);

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-6xl space-y-3">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error || !state) {
    return (
      <div className="mx-auto w-full max-w-3xl">
        <EmptyState
          title="Room unavailable"
          body={error ?? 'That room is not open to you.'}
          action={
            <Button asChild variant="outline">
              <Link to="/app/lobby">Back to rooms</Link>
            </Button>
          }
        />
      </div>
    );
  }

  if (state.room.status === 'finished' && state.result) {
    return <ResultReveal state={state} />;
  }

  if (state.room.status === 'abandoned') {
    return (
      <div className="mx-auto w-full max-w-3xl">
        <EmptyState
          title="This room was closed"
          body="Nobody rejoined inside the grace window, so the file was shelved. Nothing was lost from your record."
          action={
            <Button asChild>
              <Link to="/app/lobby">Open a new room</Link>
            </Button>
          }
        />
      </div>
    );
  }

  if (state.room.status === 'lobby') {
    return (
      <div className="mx-auto w-full max-w-5xl space-y-3">
        <RoomHeader state={state} />
        <LobbyPanel state={state} refresh={refresh} />
      </div>
    );
  }

  const panelClass = (key: 'mine' | 'wire' | 'partner') =>
    cn(
      'min-h-0 flex-col min-[1024px]:h-[68vh] min-[1024px]:min-h-[560px]',
      mobileTab === key ? 'flex' : 'hidden',
      'min-[1024px]:flex',
    );

  return (
    <div className="mx-auto flex w-full max-w-[1700px] flex-col gap-3">
      {opening && (
        <CaseOpening
          title={state.case.title}
          setting={state.case.setting}
          onDone={() => setOpening(false)}
        />
      )}
      <RoomHeader state={state} />

      <div className="flex shrink-0 gap-1 min-[1024px]:hidden">
        {(
          [
            ['mine', `Your half · ${myEvidence.length}`],
            ['wire', 'Wire'],
            ['partner', 'Partner'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setMobileTab(key)}
            className={cn(
              'min-h-10 flex-1 border px-2 font-mono text-[12px] uppercase tracking-[0.1em] transition-colors',
              mobileTab === key
                ? 'border-primary bg-primary/15 text-primary'
                : 'border-border text-muted-foreground',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid items-start gap-3 min-[1024px]:grid-cols-[minmax(0,1fr)_minmax(0,1.12fr)_minmax(0,1fr)]">
        <section className={cn(panelClass('mine'), 'panel')}>
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-2 py-1.5">
            <div className="flex gap-1">
              {(['mine', 'board'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  className={cn(
                    'min-h-8 px-2 font-mono text-[12px] uppercase tracking-[0.1em] transition-colors',
                    tab === t ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {t === 'mine' ? `Your half · ${myEvidence.length}` : 'Board'}
                </button>
              ))}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 font-mono text-[12px] uppercase tracking-[0.1em] text-muted-foreground hover:text-foreground"
              onClick={async () => {
                try {
                  const res = await requestHint(state.room.id);
                  toast.message('Nudge', { description: res.hint });
                  await refresh();
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : 'No nudge available.');
                }
              }}
            >
              <Sparkles className="mr-1 h-3 w-3" /> Nudge
            </Button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-2.5">
            {tab === 'mine' ? (
              <div className="space-y-2">
                {myEvidence.map((item) => (
                  <EvidenceCard
                    key={item.code}
                    item={item}
                    pinned={pinned.includes(item.code)}
                    suspicious={suspicious.includes(item.code)}
                    linking={linkFrom === item.code}
                    onPin={() =>
                      void persist(
                        pinned.includes(item.code) ? pinned.filter((c) => c !== item.code) : [...pinned, item.code],
                        suspicious,
                      )
                    }
                    onSuspicious={() =>
                      void persist(
                        pinned,
                        suspicious.includes(item.code)
                          ? suspicious.filter((c) => c !== item.code)
                          : [...suspicious, item.code],
                      )
                    }
                    onShare={async () => {
                      try {
                        await shareEvidence(state.room.id, item.code);
                        await refresh();
                        toast.success('Shared with your partner.');
                      } catch (e) {
                        toast.error(e instanceof Error ? e.message : 'Could not share that.');
                      }
                    }}
                    onLinkStart={async () => {
                      if (!linkFrom) {
                        setLinkFrom(item.code);
                        return;
                      }
                      if (linkFrom === item.code) {
                        setLinkFrom(null);
                        return;
                      }
                      try {
                        await addLink(state.room.id, linkFrom, item.code);
                        await refresh();
                        toast.success('Linked.');
                      } catch (e) {
                        toast.error(e instanceof Error ? e.message : 'Could not link those.');
                      } finally {
                        setLinkFrom(null);
                      }
                    }}
                  />
                ))}
                {myEvidence.length === 0 && (
                  <EmptyState title="No evidence on your side" body="That should not happen. Reload the room." />
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="border border-border bg-background/40 p-2.5">
                  <p className="text-pretty text-[13px] leading-relaxed text-muted-foreground">
                    Link two items to record a connection. Links are yours alone until you say them out loud.
                  </p>
                  <div className="mt-2 space-y-1.5">
                    {state.links.length === 0 && (
                      <p className="font-mono text-[12px] uppercase tracking-[0.1em] text-muted-foreground">
                        No strings yet.
                      </p>
                    )}
                    {state.links.map((l) => (
                      <div key={l.id} className="flex items-center gap-2 border border-border px-2 py-1.5">
                        <span className="font-mono text-[12px] uppercase tracking-[0.1em] text-foreground">
                          {l.from_code}
                        </span>
                        <span className="text-muted-foreground">—</span>
                        <span className="font-mono text-[12px] uppercase tracking-[0.1em] text-foreground">
                          {l.to_code}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="ml-auto h-6 w-6 text-muted-foreground hover:text-foreground"
                          aria-label="Remove link"
                          onClick={async () => {
                            await removeLink(l.id).catch(() => undefined);
                            await refresh();
                          }}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <RuleLabel>Private notes</RuleLabel>
                  <Textarea
                    value={notes}
                    onChange={(e) => {
                      setNotes(e.target.value);
                      setNotesDirty(true);
                    }}
                    rows={6}
                    placeholder="What you think, what you doubt, what to ask."
                    className="mt-1.5 px-2.5 font-mono text-[14px] leading-relaxed"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-2 font-mono text-[12px] uppercase tracking-[0.1em]"
                    disabled={!notesDirty}
                    onClick={async () => {
                      await persist(pinned, suspicious, notes);
                      setNotesDirty(false);
                      toast.success('Notes saved.');
                    }}
                  >
                    Save notes
                  </Button>
                </div>
              </div>
            )}
          </div>
        </section>

        <section className={cn(panelClass('wire'), 'h-[calc(100dvh-16rem)] min-h-[420px]')}>
          <ChatPanel state={state} />
        </section>

        <section className={cn(panelClass('partner'), 'panel')}>
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-3 py-2">
            <RuleLabel>Partner's half</RuleLabel>
            <span className="font-mono text-[12px] uppercase tracking-[0.1em] text-muted-foreground">
              {state.partner_shared}/{state.partner_total} shared
            </span>
          </div>
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2.5">
            {shared.length === 0 ? (
              <div className="space-y-2">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="border border-border bg-background/40 p-2.5">
                    <div className="flex items-center gap-2">
                      <Lock className="h-3 w-3 text-muted-foreground" aria-hidden />
                      <span className="font-mono text-[12px] uppercase tracking-[0.1em] text-muted-foreground">
                        Sealed
                      </span>
                    </div>
                    <div className="mt-2 space-y-1">
                      <div className="h-2 w-full bg-foreground/15" />
                      <div className="h-2 w-3/4 bg-foreground/15" />
                    </div>
                  </div>
                ))}
                <p className="pt-1 text-pretty text-[13px] leading-relaxed text-muted-foreground">
                  Your partner has to send these to you. Ask for what you need.
                </p>
              </div>
            ) : (
              shared.map((item) => (
                <div key={item.code} className="border border-playerB/50 bg-playerB/[0.07] p-2.5">
                  <p className="font-mono text-[12px] uppercase tracking-[0.1em] text-playerB">
                    {item.type} · {item.code}
                  </p>
                  <p className="mt-1 text-sm font-medium text-foreground">{item.title}</p>
                  <p className="mt-1 whitespace-pre-line font-mono text-[13px] leading-relaxed text-foreground">
                    {item.body}
                  </p>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      <VerdictBar state={state} refresh={refresh} />

      <div className="flex items-center justify-between gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2 font-mono text-[12px] uppercase tracking-[0.1em] text-muted-foreground hover:text-foreground"
          onClick={async () => {
            await abandonRoom(state.room.id).catch(() => undefined);
            navigate('/app');
          }}
        >
          <Flag className="mr-1 h-3 w-3" /> Shelve this case
        </Button>
        <span className="font-mono text-[12px] uppercase tracking-[0.1em] text-muted-foreground">
          Voice calls · coming soon
        </span>
      </div>
    </div>
  );
}
