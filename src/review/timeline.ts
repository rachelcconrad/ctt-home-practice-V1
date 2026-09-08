import type { Press, VoiceRole } from '../db/types';

export interface TimelineSegment {
  voice: VoiceRole | null;
  startMs: number;
  endMs: number;
}

// Turns discrete button presses into a step-function timeline: whatever the
// patient last pressed stays "felt" until the next press. Before the first
// press, the voice is unknown (null) rather than assumed.
export function computeFeltSegments(presses: Press[], durationMs: number): TimelineSegment[] {
  if (presses.length === 0) return [{ voice: null, startMs: 0, endMs: durationMs }];

  const sorted = [...presses].sort((a, b) => a.tMs - b.tMs);
  const segments: TimelineSegment[] = [];

  if (sorted[0].tMs > 0) {
    segments.push({ voice: null, startMs: 0, endMs: Math.min(sorted[0].tMs, durationMs) });
  }
  for (let i = 0; i < sorted.length; i++) {
    const start = Math.min(sorted[i].tMs, durationMs);
    const end = Math.min(i + 1 < sorted.length ? sorted[i + 1].tMs : durationMs, durationMs);
    if (end > start) segments.push({ voice: sorted[i].voice, startMs: start, endMs: end });
  }
  return segments;
}
