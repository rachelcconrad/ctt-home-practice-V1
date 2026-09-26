// Clinician-defined voice labels, used throughout the app and snapshotted
// onto each session at record time so edits to labels never rewrite history.
export interface AppSettings {
  targetLabel: string;
  inefficientLabel: string;
  createdAt: number;
  updatedAt: number;
}

export type VoiceRole = 'target' | 'inefficient';

// One segment of the structured protocol (the "Target" timeline), in ms
// elapsed since session start. Stored per session rather than assumed, so
// the review screen never hardcodes the 60/30/60 structure.
export interface SessionInterval {
  voice: VoiceRole;
  startMs: number;
  endMs: number;
}

// LEGACY (sessions recorded before the confidence slider): one voice-button
// tap. Kept so older sessions still open; new sessions use `Rating`.
export interface Press {
  tMs: number;
  voice: VoiceRole;
}

// One confidence-slider reading, in ms since session start. `voice` is the
// voice the patient was being asked about at that moment. `value` is 0-100
// (0 = thumbs down, 100 = thumbs up); the number is never shown to patients,
// it exists for clinician review and export.
export interface Rating {
  tMs: number;
  voice: VoiceRole;
  value: number;
}

// Post-practice yes/no questions; null = left unanswered.
export interface DifferenceAnswers {
  heardDifference: boolean | null;
  feltDifference: boolean | null;
}

export interface PracticeSession {
  id: string;
  startedAt: number;
  endedAt: number | null;
  status: 'completed' | 'aborted';
  // Snapshotted from AppSettings at session start.
  targetLabel: string;
  inefficientLabel: string;
  prompt: string;
  intervals: SessionInterval[];
  // Legacy voice-button taps; empty for sessions recorded with the slider.
  presses: Press[];
  // Undefined = recorded before the confidence slider existed (legacy).
  ratings?: Rating[];
  discrimination?: DifferenceAnswers;
}
