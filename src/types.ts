import type { Role } from "../shared/game";
import type { Draft } from "../shared/game";

export type Person = {
  id: string;
  nickname: string;
  role: Role;
  roleLabel: string;
};

export type Participant = Person & {
  eligible_for_prize: number;
};

export type LockedSubmission = {
  line_id?: string;
  lineId?: string;
  lineLabel?: string;
  correct_count?: number;
  correctCount?: number;
  total_count?: number;
  totalCount?: number;
  accuracy: number;
  valid: number | boolean;
  submitted_at?: string;
  submittedAt?: string;
};

export type Ranking = {
  rank: number;
  nickname: string;
  accuracy: number;
  submitted_at: string;
};

export type SupportRanking = Ranking & {
  role: Exclude<Role, "camper">;
  valid?: boolean;
};

export type AnswerDirectoryPerson = Pick<Person, "id" | "nickname" | "role">;

export type AnswerDirectoryEntry = {
  topic_id: string;
  yes: AnswerDirectoryPerson[];
  no: AnswerDirectoryPerson[];
};

export type CloudDraft = {
  entries: Draft;
  updatedAt: string | null;
};

export type OwnAnswer = {
  topic_id: string;
  interested: boolean;
  updated_at?: string;
  self_edit_used?: boolean;
  self_edited_at?: string | null;
};

export type AdminAnswersDetail = {
  participant: Pick<Participant, "id" | "nickname" | "role">;
  answers: OwnAnswer[];
};

export type AdminParticipantSummary = {
  id: string;
  nickname: string;
  role: Role;
  status: "not_started" | "draft" | "submitted";
  filled_count: number;
  updated_at: string | null;
  line_id: string | null;
  accuracy: number | null;
  valid: boolean | null;
};

export type AdminAuditChoice = {
  participant_id: string;
  nickname: string;
  correct: boolean;
};

export type AdminAuditEntry = {
  topic_id: string;
  label: string;
  special: boolean;
  free: boolean;
  yes: AdminAuditChoice | null;
  no: AdminAuditChoice | null;
};

export type AdminParticipantDetail = {
  participant: Omit<AdminParticipantSummary, "filled_count">;
  entries: AdminAuditEntry[];
};
