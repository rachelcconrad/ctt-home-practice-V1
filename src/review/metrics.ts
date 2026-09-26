import type { Press, Rating, SessionInterval, VoiceRole } from '../db/types';

export interface IntervalRatingSummary {
  index: number;
  voice: VoiceRole;
  // Ms from the interval's start until the patient locked in their rating.
  latencyMs: number | null;
  // 0-100 confidence from the slider.
  rating: number | null;
}

// One summary per practice interval. Patients make a single rating per
// interval; null = no rating was made in that interval.
export function summarizeRatingsByInterval(ratings: Rating[], intervals: SessionInterval[]): IntervalRatingSummary[] {
  const sorted = [...ratings].sort((a, b) => a.tMs - b.tMs);
  return intervals.map((iv, index) => {
    const made = sorted.find((r) => r.tMs >= iv.startMs && r.tMs < iv.endMs);
    return {
      index,
      voice: iv.voice,
      latencyMs: made ? made.tMs - iv.startMs : null,
      rating: made ? made.value : null,
    };
  });
}

// Elapsed ms from session start to the patient's first "target" press,
// wherever it occurs — null if they never registered feeling the target
// voice at all.
export function timeToFirstTarget(presses: Press[]): number | null {
  const sorted = [...presses].sort((a, b) => a.tMs - b.tMs);
  const first = sorted.find((p) => p.voice === 'target');
  return first ? first.tMs : null;
}

// Elapsed ms from the end of the structured inefficient interval to the
// first "target" press after it — null if they never returned.
export function timeToReturnAfterInefficient(presses: Press[], intervals: SessionInterval[]): number | null {
  const inefficient = intervals.find((iv) => iv.voice === 'inefficient');
  if (!inefficient) return null;
  const sorted = [...presses].sort((a, b) => a.tMs - b.tMs);
  const returned = sorted.find((p) => p.voice === 'target' && p.tMs >= inefficient.endMs);
  return returned ? returned.tMs - inefficient.endMs : null;
}

export function formatSecondsMetric(ms: number | null, emptyLabel = 'Not reached'): string {
  if (ms === null) return emptyLabel;
  return `${(ms / 1000).toFixed(1)}s`;
}
