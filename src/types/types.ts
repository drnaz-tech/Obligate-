export type Slot = 'A' | 'B';
export type Difficulty = 'Easy' | 'Medium' | 'Hard';
export type CaseKind = 'daily' | 'campaign' | 'group';

export interface Profile {
  id: string;
  detective_name: string;
  avatar_seed: string;
  is_admin: boolean;
  email_opt_in: boolean;
  created_at: string;
}

export interface QuestionOption {
  id: string;
  label: string;
}

export interface Question {
  id: string;
  label: string;
  prompt: string;
  options: QuestionOption[];
}

export interface EvidenceItem {
  code: string;
  player: Slot;
  type: string;
  title: string;
  body: string;
  meta: { source?: string; ref?: string } | null;
  sort_order?: number;
  shared_by?: string;
  shared_at?: string;
}

export interface Deduction {
  question: string;
  option: string;
  kind: 'key' | 'prune';
  requires: string[];
  reasoning: string;
}

export interface CaseSummary {
  id: string;
  slug: string;
  title: string;
  setting: string;
  premise: string;
  difficulty: Difficulty;
  est_minutes: number;
  kind: CaseKind;
  chapter_number: number | null;
  questions?: Question[];
}

export interface RoomState {
  room: {
    id: string;
    code: string;
    status: 'lobby' | 'active' | 'finished' | 'abandoned';
    mode: string;
    host_id: string;
    guest_id: string | null;
    case_id: string;
    attempts: number;
    hints_used: number;
    verdict: {
      proposed_by?: string;
      answers?: Record<string, string>;
      confirmed_by?: string;
      correct?: boolean;
      submitted_at?: string;
    } | null;
    outcome: string | null;
    started_at: string | null;
    finished_at: string | null;
    paused: boolean;
    expires_at: string | null;
    campaign_id: string | null;
    chapter_number: number | null;
    group_id: string | null;
  };
  me: {
    slot: Slot;
    ready: boolean;
    notes: string;
    pinned: string[];
    suspicious: string[];
  };
  partner: {
    id: string;
    slot: Slot;
    ready: boolean;
    detective_name: string;
    avatar_seed: string;
    online: boolean;
  } | null;
  case: CaseSummary;
  evidence: EvidenceItem[];
  shared: EvidenceItem[];
  partner_total: number;
  partner_shared: number;
  events: RoomEvent[];
  links: { id: string; from_code: string; to_code: string; user_id: string }[];
  elapsed_seconds: number;
  result: CaseResult | null;
}

export interface RoomEvent {
  id: number;
  kind: 'chat' | 'share' | 'system' | 'typing' | 'verdict' | 'hint';
  body: string | null;
  payload: Record<string, unknown> | null;
  user_id: string | null;
  created_at: string;
}

export interface CaseResult {
  outcome: 'solved' | 'failed' | 'abandoned';
  attempts: number;
  hints_used: number;
  duration_seconds: number;
  verdict: {
    proposed_by?: string;
    answers?: Record<string, string>;
    confirmed_by?: string;
    correct?: boolean;
  } | null;
  solution: Record<string, string>;
  deduction_chain: Deduction[];
  narrative: string;
  epilogue: string;
}

export interface MyStats {
  solved: number;
  played: number;
  failed: number;
  streak: number;
  best_streak: number;
  avg_seconds: number;
  fastest_seconds: number;
  hints_used: number;
  accuracy: number;
}

export interface RoomListItem {
  id: string;
  code: string;
  status: string;
  mode: string;
  case_title: string;
  case_slug: string;
  difficulty: string;
  partner_name: string | null;
  created_at: string;
  outcome: string | null;
  is_host: boolean;
}

export interface LeaderboardRow {
  rank: number;
  player_a: string;
  player_b: string;
  duration_seconds: number;
  attempts: number;
  hints_used: number;
  created_at: string;
}

export interface GroupSummary {
  id: string;
  name: string;
  invite_code: string;
  plan: string;
  role: string;
  member_count: number;
  solved: number;
  played: number;
  avg_seconds: number;
}

export interface NotificationItem {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
}

export interface Entitlements {
  plan: string;
  personal: boolean;
  group: boolean;
  rooms_used: number;
  rooms_limit: number;
  can_create_room: boolean;
  group_cases: boolean;
}

export interface CampaignSummary {
  id: string;
  slug: string;
  title: string;
  tagline: string;
  description: string;
  chapter_count: number;
  chapters: {
    id: string;
    slug?: string;
    title: string;
    chapter_number: number;
    difficulty: string;
    est_minutes: number;
    completed: boolean;
    locked?: boolean;
    status?: 'locked' | 'unlocked' | 'in_progress' | 'completed';
    setting?: string;
    premise?: string;
  }[];
  progress: { chapters_completed: number; decisions: Record<string, string> } | null;
}

export interface AdminCaseRow {
  id: string;
  slug: string;
  title: string;
  difficulty: string;
  kind: string;
  status: string;
  validated_at: string | null;
  validation_ok: boolean | null;
  evidence_count: number;
}
