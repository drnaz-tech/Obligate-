# OBLIGATE

**Two players. Different clues. One truth.**

[**Play the live app**](https://app-ft9ub2li99tt.appmedo.com/)

OBLIGATE is a cooperative deduction game for exactly two players. Each detective is dealt a different half of the same case file. Neither half is solvable alone — the truth only appears when the two players talk, compare what they can see, and agree on a single joint accusation.

Built entirely using a **vibe-coding platform** for the **NexConn Challenge**; the app is currently in **beta**.

---

## Table of contents

1. [Overview](#overview)

1. [How the game works](#how-the-game-works)

1. [Features](#features)

1. [Tech stack](#tech-stack)

1. [Project structure](#project-structure)

1. [Nexconn Chat SDK integration](#nexconn-chat-sdk-integration)

1. [Per-case conversation isolation](#per-case-conversation-isolation)

1. [Data model](#data-model)

1. [Local setup](#local-setup)

1. [Environment variables](#environment-variables)

1. [Scripts](#scripts)

1. [Credits](#credits)

---

## Overview

Most detective games give every player the same information and call it multiplayer. OBLIGATE does the opposite.

A case is split down the middle. Player A receives one set of evidence, Player B receives another, and the two sets are deliberately incomplete in different places. A witness statement on one side contradicts a timestamp on the other. A name appears in a ledger that only one player can read. The case is designed so that **no single player can reach the answer**, and there is exactly one valid joint accusation.

The product is a full web application: a public site explaining the mechanic, an account system, a case library, a live two-player case desk with real-time chat, level-based campaigns, daily cases, group play, results and a curator admin panel.

---

## How the game works

1. **Open a case.** One player creates a room and shares the room code, or both players join matchmaking for the same case.

1. **Read your half.** Each player sees only their own evidence. The partner's half is visible as sealed cards — you can see that something exists, never what it says.

1. **Talk on the wire.** The centre column is a live chat. This is the only channel between the two halves.

1. **Share deliberately.** Any evidence card can be shared to the partner's half. Every share is logged, so the room can see who revealed what and when.

1. **Build the theory.** Pin cards, mark them suspicious, keep private notes, and draw links between pieces of evidence.

1. **Accuse together.** The case questions sit below the desk. Both players must propose the same answers before the case can be closed. A wrong accusation costs an attempt.

The **Split Rule** is non-negotiable: a case cannot be solved by one player, and there is exactly one correct joint answer.

---

## Features

**Case desk**

- Three-column desk: your half, the live wire, your partner's half, with the joint accusation below.

- Full-height evidence panels with pin, mark-as-suspicious, private notes and share.

- Sealed partner evidence that stays visibly unreadable until shared.

- Case header with title, status, partner presence, timer, attempts and room code.

- Responsive: three columns on desktop, a tabbed single-panel view on tablet and phone.

**Chat**

- Real-time one-to-one chat over the Nexconn Chat SDK.

- Your own messages appear instantly; your partner's arrive live.

- Typing indicator, delivery state and connection status.

- Every case has its own conversation. History survives closing, shelving and reopening a case.

- No voice or call features — voice is marked "coming soon".

**Cases and progression**

- 21 published cases across daily, campaign and group modes.

- Level-based campaigns with locked and unlocked levels and an interactive progression map.

- Long-form multi-chapter campaign cases.

- Case opening and closing animations, skippable and reduced-motion aware.

**Accounts and platform**

- Email/password authentication with profiles and detective names.

- Dashboard, room lobby, results and leaderboards.

- Groups for playing with a regular partner.

- Curator admin panel for authoring and validating cases.

- Free during beta — no payment is taken and no checkout is shown.

---

## Tech stack

| Layer | Choice |
| --- | --- |
| UI | React 18, TypeScript, Vite |
| Styling | Tailwind CSS, shadcn/ui, semantic design tokens |
| Routing | React Router |
| Backend | Supabase — Postgres, Auth, Row Level Security, Edge Functions |
| Chat | Nexconn Chat SDK (`@nexconn/chat`) |
| Icons | lucide-react |
| Notifications | sonner |

---

## Project structure

```
.
├── public/
│   └── img/                     # Optimised hero artwork (WebP + JPEG fallback)
├── src/
│   ├── components/
│   │   ├── layouts/             # Public shell, app shell, sidebar, footer
│   │   ├── room/                # Case desk panels, verdict bar, result reveal
│   │   ├── dossier/             # Case opening / closing curtains
│   │   └── ui/                  # shadcn/ui primitives
│   ├── lib/
│   │   ├── api.ts               # Typed wrappers around every RPC
│   │   ├── nexconn.ts           # Nexconn Chat SDK session + per-case chat logic
│   │   ├── sfx.ts               # Web Audio room tone and click feedback
│   │   └── supabase.ts          # Supabase client
│   ├── pages/
│   │   ├── Landing.tsx          # Public landing page
│   │   ├── PublicPages.tsx      # How it works, plans, contact, legal
│   │   └── app/                 # Dashboard, lobby, room, campaigns, groups, admin
│   └── index.css                # Design tokens and shared surface classes
└── supabase/
    ├── functions/nexconn-token/ # Server-side Nexconn token issuing
    └── migrations/              # Schema, RPC layer, RLS policies
```

---

## Nexconn Chat SDK integration

Chat is the spine of the game, so the integration is deliberately small and explicit.

### 1. Token issuing stays on the server

The browser never holds the Nexconn app secret. `supabase/functions/nexconn-token` is an Edge Function that:

1. Verifies the caller's Supabase JWT.

1. Confirms the caller is a member of the requested room using the `is_room_member` RPC — membership is decided by the database, never by the client.

1. Looks up the partner from the room row.

1. Signs a request to the Nexconn token endpoint with the app key and secret held in Edge Function secrets.

1. Returns only `{ appKey, userId, peerId, token, roomId }` to the client.

Nexconn user IDs accept letters and digits only, so Supabase UUIDs are compacted (dashes removed) before being sent upstream.

### 2. One engine, one direct channel

`src/lib/nexconn.ts` owns the whole client side:

```
NCEngine.initialize({ appKey, logLevel, areaCode });   // once per page load
await NCEngine.connect({ token });                     // per session
const channel = new DirectChannel(peerId);             // 1:1 with the partner
```

A module-level session counter means the engine is only disconnected when the last open session closes, so moving quickly between rooms cannot tear down a connection that another view still needs.

### 3. Sending

Sending is optimistic. The message is appended to the local list the moment the SDK accepts it, so the sender always sees their own message immediately — no round trip, no waiting for an echo:

```
const result = await channel.sendMessage(new SendTextMessageParams({ text: envelope }));
if (!result.isOk) throw new Error(`SEND_FAILED:${result.code}`);
await persist(text);                       // mirror into the room's own log
return { id, from: 'me', text, sentAt };   // appended by the chat panel
```

### 4. Receiving

Incoming messages pass through two filters before they reach the UI:

- **Own echo filter** — anything whose `senderUserId` matches the current user is dropped, because it is already on screen.

- **Room filter** — the payload must carry the current room's tag (see below).

Typing indicators use the SDK's channel handler and are scoped to the partner's user ID.

### 5. Failure behaviour

If the token request, connection or send fails, the chat panel shows an explicit state (`Linking`, `Live`, `Offline`) with a retry action. A failed send surfaces a toast and leaves the draft intact. Chat never blocks the rest of the desk.

---

## Per-case conversation isolation

A Nexconn `DirectChannel` is keyed by the **partner**, not by the case. Two detectives who play three cases together share one channel. Without extra logic, case three would inherit the conversation from case one.

OBLIGATE solves this with a room-scoped envelope plus a per-room event log.

### The envelope

Every message body is wrapped before it leaves the client:

```
\u0001OB\u0001{"r":"<room-id>","t":"<text>","e":<optional evidence card>}
```

- `r` — the room (case) the message belongs to.

- `t` — the visible text.

- `e` — an optional evidence card, when the message is a shared exhibit.

On receipt the client parses the envelope and **drops anything whose ****`r`**** does not match the room currently open**. Messages from another case, or untagged legacy messages, never reach the UI.

### The event log

Every accepted message is also written to `room_events` through the `send_message` RPC:

```sql
send_message(p_room_id uuid, p_body text, p_payload jsonb default null)
```

The function is `SECURITY DEFINER` and enforces, in order: room membership, non-empty body, a 1,200-character ceiling, and a rate limit of 12 messages per 20 seconds per player.

History is read back from that log, filtered by `room_id` and `kind = 'chat'`, ordered by insertion. The `from` field is derived from `user_id`, so a reloaded conversation shows the correct side for each message.

### Why history survives

Rooms move through `lobby → active → finished` (closed) or `abandoned` (shelved). Closing or shelving only changes the room's status — **no event rows are deleted**. Reopening a case navigates back to the same room ID, so the original conversation is restored exactly as it was left.

The result is four guarantees:

| Requirement | How it is met |
| --- | --- |
| A new case starts with a fresh chat | History is queried by `room_id`; a new room has no rows |
| Each case has an independent history | Envelope room tag + `room_id` filter on every read |
| Closing or shelving preserves history | Status changes only; `room_events` rows are never removed |
| Reopening restores the original chat | Same room ID, same rows, replayed in order |
| No message ever crosses cases | Mismatched envelopes are discarded before rendering |

---

## Data model

The core tables:

| Table | Purpose |
| --- | --- |
| `cases` | Case files: title, difficulty, mode, questions, solution |
| `case_evidence` | Evidence items, split by player (A / B) |
| `rooms` | A live case instance: case, host, guest, status, outcome, attempts |
| `room_events` | Append-only log: chat messages, shares, system events |
| `room_player_state` | Per-player notes, pinned and suspicious evidence |
| `profiles` | Detective name, avatar, stats |
| `campaigns` / `campaign_levels` | Level-based progression |
| `groups` | Persistent play groups |

Row Level Security is enabled throughout. Players can only read rooms they belong to, and only their own half of the evidence. Case solutions are never exposed to the client before a verdict is confirmed.

---

## Local setup

### Prerequisites

- Node.js 20+

- A Supabase project

- A Nexconn application (app key and secret)

### 1. Install

```bash
npm install
```

### 2. Configure the client

Create `.env` in the project root:

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

Only the anon key belongs in the browser. Never place a service role key or a Nexconn secret in a `VITE_` variable — anything prefixed with `VITE_` is shipped to the client.

### 3. Apply the database migrations

```bash
supabase db push
```

Migrations create the schema, the RPC layer, RLS policies and the case validator.

### 4. Deploy the token function

```bash
supabase functions deploy nexconn-token
```

Set its secrets in the Supabase dashboard (Edge Functions → Secrets):

```bash
NEXCONN_APP_KEY=...
NEXCONN_APP_SECRET=...
NEXCONN_API_BASE=https://api.sg-light-api.com   # optional
```

These are read only inside the Edge Function and are never returned to the browser.

### 5. Run

```bash
npm run dev
```

---

## Environment variables

| Variable | Where | Purpose |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | client `.env` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | client `.env` | Public anon key, protected by RLS |
| `NEXCONN_APP_KEY` | Edge Function secret | Nexconn application key |
| `NEXCONN_APP_SECRET` | Edge Function secret | Nexconn signing secret |
| `NEXCONN_API_BASE` | Edge Function secret | Optional regional API base |

No secret is committed to this repository. `.env` is ignored by git.

---

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Type-check and build for production |
| `npm run preview` | Preview the production build |

---

## Credits

**Chat** — powered by the [Nexconn Chat SDK](https://www.nexconn.ai). Token issuing, direct-channel messaging, typing indicators and per-case conversation scoping are all built on it.

**Built for the NexCon Challenge.**

**Status** — OBLIGATE is currently in beta. Features may change, and everything is free to play while the beta runs.

---

## License

Released for the NexConn Challenge. Case content and artwork are original to this project.
