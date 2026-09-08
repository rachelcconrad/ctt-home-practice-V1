import type { SessionInterval, VoiceRole } from '../db/types';

export const SESSION_INTERVALS: SessionInterval[] = [
  { voice: 'target', startMs: 0, endMs: 60_000 },
  { voice: 'inefficient', startMs: 60_000, endMs: 90_000 },
  { voice: 'target', startMs: 90_000, endMs: 150_000 },
];

export const SESSION_DURATION_MS = SESSION_INTERVALS[SESSION_INTERVALS.length - 1].endMs;

export function getCurrentIntervalVoice(elapsedMs: number): VoiceRole {
  const clamped = Math.min(elapsedMs, SESSION_DURATION_MS - 1);
  const interval = SESSION_INTERVALS.find((iv) => clamped >= iv.startMs && clamped < iv.endMs);
  return interval?.voice ?? SESSION_INTERVALS[SESSION_INTERVALS.length - 1].voice;
}

export function formatClock(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
