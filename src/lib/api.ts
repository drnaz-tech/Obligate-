import { supabase } from './supabase';
import type {
  AdminCaseRow,
  CampaignSummary,
  CaseResult,
  Entitlements,
  EvidenceItem,
  GroupSummary,
  LeaderboardRow,
  MyStats,
  NotificationItem,
  Question,
  RoomListItem,
  RoomState,
} from '@/types/types';

const MESSAGES: Record<string, string> = {
  AUTH_REQUIRED: 'Sign in to continue.',
  ROOM_NOT_FOUND: 'That room no longer exists.',
  NOT_A_MEMBER: 'You are not in this room.',
  ADMIN_ONLY: 'That area is restricted.',
  CASE_NOT_FOUND: 'That case is not in the library.',
  ROOM_FULL: 'That room already has two players.',
  ROOM_STARTED: 'That case has already begun.',
  ROOM_FINISHED: 'That case is closed.',
  NOT_READY: 'Both players must be ready.',
  NO_ATTEMPTS: 'No attempts left on this case.',
  NO_HINTS: 'No hints left on this case.',
  INVALID_CODE: 'No room with that code.',
  PLAN_REQUIRED: 'That needs a group plan.',
  ROOM_LIMIT: 'You have used your free private rooms this month.',
  ALREADY_QUEUED: 'You are already in the queue.',
  BLOCKED: 'You cannot pair with that player.',
};

export function readableError(error: unknown): string {
  const raw =
    typeof error === 'string'
      ? error
      : (error as { message?: string })?.message || 'Something went wrong.';
  const key = Object.keys(MESSAGES).find((k) => raw.includes(k));
  if (key) return MESSAGES[key];
  if (raw.includes('duplicate key')) return 'That already exists.';
  if (raw.includes('Failed to fetch')) return 'Connection lost. Check your network.';
  return raw.replace(/^.*?:\s*/, '').slice(0, 160) || 'Something went wrong.';
}

async function rpc<T>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new Error(readableError(error));
  return data as T;
}

const arr = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

/* ---------- public ---------- */

export interface PublicStats {
  cases: number;
  solved: number;
  detectives: number;
  avg_seconds: number;
}

export const getPublicStats = () => rpc<PublicStats>('get_public_stats');

export interface PublicCase {
  id: string;
  slug: string;
  title: string;
  setting: string;
  premise: string;
  difficulty: string;
  est_minutes: number;
  kind: string;
  daily_order: number | null;
  solved_count: number;
}

export const getPublicCases = async () => arr<PublicCase>(await rpc('get_public_cases'));

export interface Teaser {
  id: string;
  slug: string;
  title: string;
  setting: string;
  premise: string;
  difficulty: string;
  est_minutes: number;
  questions: Question[];
  sample: EvidenceItem[];
}

export const getCaseTeaser = (slug: string) => rpc<Teaser>('get_case_teaser', { p_slug: slug });

export const getPublicCaseResult = (caseId: string) =>
  rpc<{
    title: string;
    setting: string;
    premise: string;
    narrative: string;
    epilogue: string;
    solution: Record<string, string>;
    questions: Question[];
    solved_count: number;
    fastest_seconds: number | null;
    gated: boolean;
  }>('get_public_case_result', { p_case_id: caseId });

/* ---------- daily / dashboard ---------- */

export interface DailyCase {
  id: string;
  slug: string;
  title: string;
  setting: string;
  premise: string;
  difficulty: string;
  est_minutes: number;
  daily_order: number | null;
  day_key: string;
  next_reset: string;
  solved_today: number;
  my_room_id: string | null;
}

export const getDailyCase = () => rpc<DailyCase>('get_daily_case');

export const getMyStats = async (): Promise<MyStats> => {
  const raw = await rpc<Record<string, number>>('get_my_stats');
  const played = Number(raw?.cases_played ?? 0);
  const solved = Number(raw?.cases_solved ?? 0);
  return {
    solved,
    played,
    failed: Math.max(0, played - solved),
    streak: Number(raw?.streak ?? 0),
    best_streak: Number(raw?.streak ?? 0),
    avg_seconds: Number(raw?.avg_seconds ?? 0),
    fastest_seconds: Number(raw?.best_seconds ?? 0),
    hints_used: Number(raw?.hints_used ?? 0),
    accuracy: Number(raw?.solve_rate ?? 0) / 100,
  };
};

interface RawRoomRow {
  id: string;
  code: string;
  status: string;
  mode: string;
  case_title: string;
  case_slug: string;
  difficulty: string;
  created_at: string;
  outcome: string | null;
  partner?: string | null;
  partner_name?: string | null;
  is_host?: boolean;
}

const toRoomItem = (r: RawRoomRow): RoomListItem => ({
  id: r.id,
  code: r.code,
  status: r.status,
  mode: r.mode,
  case_title: r.case_title,
  case_slug: r.case_slug,
  difficulty: r.difficulty,
  partner_name: r.partner_name ?? r.partner ?? null,
  created_at: r.created_at,
  outcome: r.outcome,
  is_host: r.is_host ?? false,
});

export const getMyRooms = async () =>
  arr<RawRoomRow>(await rpc('get_my_rooms')).map(toRoomItem);

export const getMyPendingInvites = async () =>
  arr<RawRoomRow>(await rpc('get_my_pending_invites')).map(toRoomItem);

export const getMyNotifications = async () =>
  arr<NotificationItem>(await rpc('get_my_notifications'));

export const markNotificationsRead = () => rpc('mark_notifications_read');

/* ---------- rooms ---------- */

export const createRoom = (caseId: string, mode = 'private', groupId?: string) =>
  rpc<{ room_id: string; code: string }>('create_room', {
    p_case_id: caseId,
    p_mode: mode,
    p_group_id: groupId ?? null,
  });

export const joinRoom = (code: string) =>
  rpc<{ room_id: string; code: string }>('join_room', { p_code: code.trim().toUpperCase() });

export const getRoomState = (roomId: string) => rpc<RoomState>('get_room_state', { p_room_id: roomId });

export const setReady = (roomId: string, ready: boolean) =>
  rpc('set_ready', { p_room_id: roomId, p_ready: ready });

export const heartbeat = (roomId: string) => rpc('heartbeat', { p_room_id: roomId });

export const abandonRoom = (roomId: string) => rpc('abandon_room', { p_room_id: roomId });

export const savePlayerState = (
  roomId: string,
  notes: string,
  pinned: string[],
  suspicious: string[],
) =>
  rpc('save_player_state', {
    p_room_id: roomId,
    p_notes: notes,
    p_pinned: pinned,
    p_suspicious: suspicious,
  });

export const shareEvidence = (roomId: string, code: string) =>
  rpc('share_evidence', { p_room_id: roomId, p_code: code });

export const sendMessage = (roomId: string, body: string) =>
  rpc('send_message', { p_room_id: roomId, p_body: body });

export const addLink = (roomId: string, from: string, to: string) =>
  rpc('add_link', { p_room_id: roomId, p_from: from, p_to: to });

export const removeLink = (linkId: string) => rpc('remove_link', { p_link_id: linkId });

export const proposeVerdict = (roomId: string, answers: Record<string, string>) =>
  rpc('propose_verdict', { p_room_id: roomId, p_answers: answers });

export const confirmVerdict = (roomId: string) =>
  rpc<{ outcome: string; correct: boolean; attempts: number; result?: CaseResult }>(
    'confirm_verdict',
    { p_room_id: roomId },
  );

export const rejectVerdict = (roomId: string) => rpc('reject_verdict', { p_room_id: roomId });

export const requestHint = (roomId: string) =>
  rpc<{ hint: string; hints_used: number }>('request_hint', { p_room_id: roomId });

/* ---------- matchmaking ---------- */

export const joinMatchmaking = (caseId: string) =>
  rpc<{ status: string; room_id?: string; code?: string }>('join_matchmaking', {
    p_case_id: caseId,
  });

export const pollMatchmaking = () =>
  rpc<{ status: string; room_id?: string; code?: string; waiting?: number }>('poll_matchmaking');

export const leaveMatchmaking = () => rpc('leave_matchmaking');

/* ---------- leaderboard ---------- */

export const getLeaderboard = async (caseId: string) => {
  const raw = arr<{
    id: string;
    duration_seconds: number;
    attempts: number;
    hints_used: number;
    created_at: string;
    player_a_name: string;
    player_b_name: string;
  }>(await rpc('get_leaderboard', { p_case_id: caseId }));
  return raw.map((r, i) => ({
    rank: i + 1,
    player_a: r.player_a_name,
    player_b: r.player_b_name,
    duration_seconds: r.duration_seconds,
    attempts: r.attempts,
    hints_used: r.hints_used,
    created_at: r.created_at,
  })) as LeaderboardRow[];
};

/* ---------- campaigns ---------- */

export interface CampaignRow {
  id: string;
  slug: string;
  title: string;
  tagline: string;
  description: string;
  chapter_count: number;
  sort_order: number;
  chapters_completed: number;
}

export const getCampaigns = async () => arr<CampaignRow>(await rpc('get_campaigns'));

export const getCampaignDetail = async (slug: string): Promise<CampaignSummary> => {
  const raw = await rpc<{
    campaign: {
      id: string;
      slug: string;
      title: string;
      tagline: string;
      description: string;
      chapter_count: number;
    };
    chapters: {
      id: string;
      slug?: string;
      title: string;
      chapter_number: number;
      difficulty?: string;
      est_minutes?: number;
      locked?: boolean;
      status?: 'locked' | 'unlocked' | 'in_progress' | 'completed';
      setting?: string;
      premise?: string;
    }[];
    progress: { chapters_completed: number; decisions: Record<string, string> } | null;
  }>('get_campaign_detail', { p_slug: slug });
  const done = raw?.progress?.chapters_completed ?? 0;
  return {
    ...raw.campaign,
    chapters: (raw.chapters ?? []).map((c) => {
      const status =
        c.status ??
        (c.chapter_number <= done
          ? 'completed'
          : c.chapter_number === done + 1
            ? 'unlocked'
            : 'locked');
      return {
        ...c,
        difficulty: c.difficulty ?? 'standard',
        est_minutes: c.est_minutes ?? 0,
        status,
        locked: c.locked ?? status === 'locked',
        completed: status === 'completed',
      };
    }),
    progress: raw.progress ?? null,
  };
};

/* ---------- groups ---------- */

export const getMyGroups = async () => {
  const raw = arr<{
    id: string;
    name: string;
    plan: string;
    invite_code: string;
    role: string;
    member_count: number;
    solved?: number;
    played?: number;
    avg_seconds?: number;
  }>(await rpc('get_my_groups'));
  return raw.map((g) => ({
    id: g.id,
    name: g.name,
    invite_code: g.invite_code,
    plan: g.plan,
    role: g.role,
    member_count: g.member_count,
    solved: g.solved ?? 0,
    played: g.played ?? 0,
    avg_seconds: g.avg_seconds ?? 0,
  })) as GroupSummary[];
};

export const createGroup = (name: string) =>
  rpc<{ group_id: string; invite_code: string }>('create_group', { p_name: name });

export const joinGroup = (code: string) =>
  rpc<{ group_id: string }>('join_group', { p_code: code.trim().toUpperCase() });

export interface GroupDetail {
  group: { id: string; name: string; invite_code: string; plan: string; owner_id: string };
  members: {
    user_id: string;
    detective_name: string;
    role: string;
    solved: number;
    played: number;
    joined_at: string;
  }[];
  stats: { solved: number; played: number; avg_seconds: number; best_pair: string | null };
}

export const getGroupDetail = (groupId: string) =>
  rpc<GroupDetail>('get_group_detail', { p_group_id: groupId });

export const getGroupCases = async (groupId: string) =>
  arr<PublicCase>(await rpc('get_group_cases', { p_group_id: groupId }));

/* ---------- entitlements ---------- */

export const getEntitlements = async (): Promise<Entitlements> => {
  const raw = await rpc<{
    plan: string;
    private_rooms_used: number;
    private_rooms_limit: number | null;
    group_plan: boolean;
    personal_plan: boolean;
  }>('get_entitlements');
  const limit = raw?.private_rooms_limit;
  const used = Number(raw?.private_rooms_used ?? 0);
  return {
    plan: raw?.plan ?? 'free',
    personal: !!raw?.personal_plan,
    group: !!raw?.group_plan,
    rooms_used: used,
    rooms_limit: limit === null || limit === undefined ? -1 : Number(limit),
    can_create_room: limit === null || limit === undefined || used < Number(limit),
    group_cases: !!raw?.group_plan,
  };
};

/* ---------- safety ---------- */

export const getMyBlocks = async () =>
  arr<{ id: string; detective_name: string; created_at: string }>(await rpc('get_my_blocks'));

export const blockUser = (userId: string) => rpc('block_user', { p_blocked: userId });
export const unblockUser = (userId: string) => rpc('unblock_user', { p_blocked: userId });

export const reportUser = (
  reportedId: string,
  roomId: string | null,
  reason: string,
  details: string,
) =>
  rpc('report_user', {
    p_reported: reportedId,
    p_room_id: roomId,
    p_reason: reason,
    p_details: details,
  });

/* ---------- admin ---------- */

export const getAdminCases = async () => arr<AdminCaseRow>(await rpc('get_admin_cases'));

export const getAdminCase = (caseId: string) => rpc<Record<string, unknown>>('get_admin_case', { p_case_id: caseId });

export const saveCase = (payload: Record<string, unknown>) =>
  rpc<{ case_id: string; validation: { ok: boolean; checks: ValidationCheck[] } }>('save_case', {
    p_payload: payload,
  });

export interface ValidationCheck {
  id: string;
  label: string;
  pass: boolean;
  detail: string;
}

export const validateCase = (caseId: string) =>
  rpc<{ ok: boolean; checks: ValidationCheck[] }>('validate_case', { p_case_id: caseId });

export const publishCase = (caseId: string) => rpc('publish_case', { p_case_id: caseId });
export const unpublishCase = (caseId: string) => rpc('unpublish_case', { p_case_id: caseId });

export const getAdminUsers = async () =>
  arr<{
    id: string;
    detective_name: string;
    is_admin: boolean;
    created_at: string;
    played: number;
    solved: number;
    reports: number;
  }>(await rpc('get_admin_users'));

export const getAdminReports = async () =>
  arr<{
    id: string;
    reporter_name: string;
    reported_name: string;
    reason: string;
    details: string;
    status: string;
    created_at: string;
  }>(await rpc('get_admin_reports'));

export const setReportStatus = (reportId: string, status: string) =>
  rpc('set_report_status', { p_report_id: reportId, p_status: status });

/* ---------- contact ---------- */

export async function sendContactMessage(input: {
  name: string;
  email: string;
  subject: string;
  message: string;
}) {
  const { error } = await supabase.from('contact_messages').insert({
    name: input.name,
    email: input.email,
    subject: input.subject || null,
    message: input.message,
  });
  if (error) throw new Error(readableError(error));
}
