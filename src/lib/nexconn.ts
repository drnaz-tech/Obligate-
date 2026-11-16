import {
  AreaCode,
  ChannelHandler,
  DirectChannel,
  LogLevel,
  MessageHandler,
  NCEngine,
  SendTextMessageParams,
} from "@nexconn/chat";
import { supabase } from "./supabase";

/**
 * Every message carries the room it belongs to. The Nexconn direct channel is
 * keyed by the partner, not by the case, so the room tag is what keeps two
 * cases between the same two detectives from bleeding into each other.
 */
const ENVELOPE_PREFIX = "\u0001OB\u0001";
const HANDLER_PREFIX = "obligate-room";

export interface EvidenceCard {
  code: string;
  title: string;
  body: string;
  player: string;
  type?: string;
}

export interface NexconnMessage {
  id: string;
  from: "me" | "partner";
  text: string;
  evidence?: EvidenceCard;
  sentAt: number;
}

export interface NexconnSession {
  userId: string;
  peerId: string;
  roomId: string;
  sendText: (text: string) => Promise<NexconnMessage>;
  sendEvidence: (card: EvidenceCard) => Promise<NexconnMessage>;
  sendTyping: () => void;
  loadHistory: () => Promise<NexconnMessage[]>;
  onMessage: (cb: (message: NexconnMessage) => void) => () => void;
  onTyping: (cb: () => void) => () => void;
  close: () => Promise<void>;
}

interface TokenPayload {
  appKey: string;
  userId: string;
  peerId: string;
  token: string;
  roomId: string;
}

interface Envelope {
  r: string;
  t: string;
  e?: EvidenceCard;
}

let engineReady = false;
let activeSessions = 0;

const compact = (uuid: string) => uuid.replace(/-/g, "").toLowerCase();

const encode = (roomId: string, text: string, evidence?: EvidenceCard) =>
  `${ENVELOPE_PREFIX}${JSON.stringify(evidence ? { r: roomId, t: text, e: evidence } : { r: roomId, t: text })}`;

/** Returns null when the payload belongs to another case or predates room tagging. */
const decode = (raw: string, roomId: string): { text: string; evidence?: EvidenceCard } | null => {
  if (!raw.startsWith(ENVELOPE_PREFIX)) return null;
  try {
    const envelope = JSON.parse(raw.slice(ENVELOPE_PREFIX.length)) as Envelope;
    if (!envelope || envelope.r !== roomId) return null;
    return { text: typeof envelope.t === "string" ? envelope.t : "", evidence: envelope.e };
  } catch {
    return null;
  }
};

const localId = () => `me-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export async function requestNexconnToken(roomId: string): Promise<TokenPayload> {
  const { data, error } = await supabase.functions.invoke("nexconn-token", {
    body: { roomId },
  });
  if (error) {
    const detail = (data as { error?: string } | null)?.error;
    throw new Error(detail ?? error.message ?? "TOKEN_REQUEST_FAILED");
  }
  const payload = data as TokenPayload | null;
  if (!payload?.token) throw new Error("TOKEN_MISSING");
  return payload;
}

export async function openNexconnSession(roomId: string): Promise<NexconnSession> {
  const payload = await requestNexconnToken(roomId);

  if (!engineReady) {
    NCEngine.initialize({
      appKey: payload.appKey,
      logLevel: LogLevel.WARN,
      areaCode: AreaCode.SG,
    });
    engineReady = true;
  }

  const connected = await NCEngine.connect({ token: payload.token });
  if (!connected.isOk) {
    throw new Error(`CONNECT_FAILED:${connected.code ?? "unknown"}`);
  }
  activeSessions += 1;

  const channel = new DirectChannel(payload.peerId);
  const messageListeners = new Set<(message: NexconnMessage) => void>();
  const typingListeners = new Set<() => void>();
  const messageHandlerId = `${HANDLER_PREFIX}-msg-${roomId}`;
  const channelHandlerId = `${HANDLER_PREFIX}-ch-${roomId}`;

  NCEngine.addMessageHandler(
    messageHandlerId,
    new MessageHandler({
      onMessageReceived: (event) => {
        for (const raw of event.messages ?? []) {
          const message = raw as {
            messageId?: string;
            sentTime?: number;
            senderUserId?: string;
            content?: { text?: string };
          };
          // Our own messages are appended locally the moment they are sent.
          if (message.senderUserId && message.senderUserId === payload.userId) continue;
          const decoded = decode(message.content?.text ?? "", roomId);
          // Traffic from another case, or an untagged legacy message: drop it.
          if (!decoded) continue;
          const next: NexconnMessage = {
            id:
              message.messageId ??
              `rx-${message.sentTime ?? Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            from: "partner",
            text: decoded.text,
            evidence: decoded.evidence,
            sentAt: message.sentTime ?? Date.now(),
          };
          for (const listener of messageListeners) listener(next);
        }
      },
    }),
  );

  NCEngine.addChannelHandler(
    channelHandlerId,
    new ChannelHandler({
      onTypingStatusChanged: (event) => {
        const typing = (event.userTypingStatus ?? []).some(
          (entry) => entry.userId === payload.peerId,
        );
        if (typing) for (const listener of typingListeners) listener();
      },
    }),
  );

  const persist = async (body: string, card: EvidenceCard | null) => {
    await supabase.rpc("send_message", {
      p_room_id: roomId,
      p_body: body,
      p_payload: card,
    });
  };

  const sendText = async (text: string): Promise<NexconnMessage> => {
    const trimmed = text.trim();
    if (!trimmed) throw new Error("EMPTY_MESSAGE");
    const result = await channel.sendMessage(
      new SendTextMessageParams({ text: encode(roomId, trimmed) }),
    );
    if (!result.isOk) throw new Error(`SEND_FAILED:${result.code ?? "unknown"}`);
    await persist(trimmed, null).catch(() => undefined);
    return { id: localId(), from: "me", text: trimmed, sentAt: Date.now() };
  };

  const sendEvidence = async (card: EvidenceCard): Promise<NexconnMessage> => {
    const result = await channel.sendMessage(
      new SendTextMessageParams({ text: encode(roomId, card.title, card) }),
    );
    if (!result.isOk) throw new Error(`SEND_FAILED:${result.code ?? "unknown"}`);
    await persist(`Shared evidence: ${card.title}`, card).catch(() => undefined);
    return {
      id: localId(),
      from: "me",
      text: card.title,
      evidence: card,
      sentAt: Date.now(),
    };
  };

  /**
   * History is read from the room's own event log, so a case keeps its
   * conversation when it is closed, shelved and reopened later.
   */
  const loadHistory = async (): Promise<NexconnMessage[]> => {
    const { data, error } = await supabase
      .from("room_events")
      .select("id, body, user_id, payload, created_at")
      .eq("room_id", roomId)
      .eq("kind", "chat")
      .order("id", { ascending: true })
      .limit(200);
    if (error) return [];
    return (data ?? []).map((row) => ({
      id: `db-${row.id}`,
      from: compact(String(row.user_id)) === payload.userId ? "me" : "partner",
      text: row.body ?? "",
      evidence: (row.payload as EvidenceCard | null) ?? undefined,
      sentAt: new Date(row.created_at).getTime(),
    }));
  };

  return {
    userId: payload.userId,
    peerId: payload.peerId,
    roomId,
    sendText,
    sendEvidence,
    sendTyping: () => {
      channel.sendTypingStatus("RC:TxtMsg").catch(() => undefined);
    },
    loadHistory,
    onMessage: (cb) => {
      messageListeners.add(cb);
      return () => messageListeners.delete(cb);
    },
    onTyping: (cb) => {
      typingListeners.add(cb);
      return () => typingListeners.delete(cb);
    },
    close: async () => {
      messageListeners.clear();
      typingListeners.clear();
      (NCEngine as unknown as { removeMessageHandler?: (id: string) => void })
        .removeMessageHandler?.(messageHandlerId);
      (NCEngine as unknown as { removeChannelHandler?: (id: string) => void })
        .removeChannelHandler?.(channelHandlerId);
      activeSessions = Math.max(0, activeSessions - 1);
      if (activeSessions === 0) await NCEngine.disconnect().catch(() => undefined);
    },
  };
}
