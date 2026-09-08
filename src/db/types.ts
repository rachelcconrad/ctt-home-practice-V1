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

// One button press (the "Felt" timeline). Logged as-is, every tap, even if
// it repeats the current voice — this is the raw ground truth of what the
// patient reported feeling, not a derived state machine.
export interface Press {
  tMs: number;
  voice: VoiceRole;
}

// Short, skippable post-session reflections, one per voice mode.
export interface JournalEntry {
  target?: string;
  inefficient?: string;
}

// Post-hoc acoustic analysis (Smoothed Cepstral Peak Prominence) computed
// from the session recording. Kept separate from `presses` deliberately —
// this is an independent acoustic signal, not a comparison against the
// patient's own self-reported timeline. dB is the standard CPPS unit in the
// literature; the patient-facing UI omits the unit, but it's kept here for
// clinician export accuracy.
export interface VoiceAnalysis {
  bestCppsDb: number;
  percentTimeClear: number;
  thresholdDb: number;
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
  presses: Press[];
  journal: JournalEntry;
  // Absent if the recording was too short/quiet to analyze, or analysis failed.
  voiceAnalysis?: VoiceAnalysis;
}
