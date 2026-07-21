import type { Role } from "../shared/game";

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
