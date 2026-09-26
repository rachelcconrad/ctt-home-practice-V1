import type { PracticeSession } from '../db/types';

export interface DailySummary {
  // Mean 0-100 confidence across every rating made in target periods / in
  // negative-practice periods, over all of the day's sessions. Null = no ratings.
  targetConfidence: number | null;
  inefficientConfidence: number | null;
  // % of the day's answered sessions where the patient said yes. Null = no answers.
  feltDifferencePercent: number | null;
  heardDifferencePercent: number | null;
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}

function yesPercent(answers: (boolean | null | undefined)[]): number | null {
  const answered = answers.filter((a): a is boolean => typeof a === 'boolean');
  if (answered.length === 0) return null;
  return Math.round((100 * answered.filter(Boolean).length) / answered.length);
}

// Sessions recorded before the slider / awareness questions simply contribute
// nothing to the numbers they don't have.
export function summarizeDay(sessions: PracticeSession[]): DailySummary {
  const target: number[] = [];
  const inefficient: number[] = [];
  for (const s of sessions) {
    for (const r of s.ratings ?? []) (r.voice === 'target' ? target : inefficient).push(r.value);
  }
  return {
    targetConfidence: mean(target),
    inefficientConfidence: mean(inefficient),
    feltDifferencePercent: yesPercent(sessions.map((s) => s.discrimination?.feltDifference)),
    heardDifferencePercent: yesPercent(sessions.map((s) => s.discrimination?.heardDifference)),
  };
}
