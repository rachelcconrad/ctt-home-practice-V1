import type { Press, SessionInterval } from '../db/types';

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

export function formatSecondsMetric(ms: number | null): string {
  if (ms === null) return 'Not reached';
  return `${(ms / 1000).toFixed(1)}s`;
}
