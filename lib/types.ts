export type ChallengeType = "blink" | "turn_head" | "say_digits";

export type HeadDirection = "left" | "right";

export interface Challenge {
  id: string;
  type: ChallengeType;
  prompt: string;
  timeout_sec: number;
  blinks?: number;
  direction?: HeadDirection;
  code?: string;
}

export interface ChallengeResult {
  id: string;
  type: ChallengeType;
  passed: boolean;
  detail: string;
  duration_ms: number;
}

export interface SessionStart {
  session_id: string;
  challenges: Challenge[];
}

export interface SignalBreakdown {
  challenges: number;
  replay: number;
  texture: number;
  antispoof: number;
}

export interface SessionResult {
  session_id: string;
  risk_score: number;
  risk_level: "low" | "medium" | "high";
  summary: string;
  reasons: string[];
  breakdown: SignalBreakdown;
  challenge_results: ChallengeResult[];
  antispoof_spoof_prob: number | null;
  frames_analyzed: number;
}

export interface CompletePayload {
  challenge_results: ChallengeResult[];
  speech_transcript?: string;
  face_lost_count?: number;
  frozen_suspicion?: boolean;
}
