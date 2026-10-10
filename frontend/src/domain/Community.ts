// site.community and site_note in contracts v1.8 (decision 20261010-1630).
export const NOTE_TEXT_MAX = 280;

export const SIGNAL_FLAGS = [
  'recurring',
  'burning',
  'smell',
  'blocked_drain',
  'animals',
  'near_school',
  'near_hospital',
  'access_issue',
] as const;

export type SignalFlag = (typeof SIGNAL_FLAGS)[number];

export interface CommunitySignals {
  readonly duration_days: number | null;
  readonly recurring: boolean | null;
  readonly burning: boolean;
  readonly smell: boolean;
  readonly blocked_drain: boolean;
  readonly animals: boolean;
  readonly near_school: boolean;
  readonly near_hospital: boolean;
  readonly access_issue: boolean;
}

export interface SiteCommunity {
  readonly notes_count: number;
  readonly people: number;
  readonly signals: CommunitySignals;
  readonly summary_en: string;
  readonly summary_hi: string;
  readonly provider: 'bedrock' | 'junksnap';
  readonly model: string;
  readonly version: string;
  readonly updated_at: string;
}

export type NoteLanguage = 'en' | 'hi';

export interface NoteRequest {
  readonly text: string;
  readonly language: NoteLanguage;
  readonly device_token: string;
}

/** Never carries its author; a hidden note has no text. */
export interface SiteNote {
  readonly note_id: string;
  readonly site_id: string;
  readonly status: 'shown' | 'hidden';
  readonly text: string | null;
  readonly language: NoteLanguage;
  readonly created_at: string;
}

/** The flags residents raised, in display order. */
export function raisedSignals(signals: CommunitySignals): SignalFlag[] {
  return SIGNAL_FLAGS.filter((flag) => signals[flag] === true);
}
