import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { listSessionsToday } from '../db/db';
import type { PracticeSession } from '../db/types';
import { useSettings } from '../hooks/useSettings';
import { DAILY_GOAL } from '../practice/protocol';
import { summarizeDay } from '../review/daily';
import PaintCluster, { type PaintBlob } from '../review/PaintCluster';

function pct(value: number | null): string {
  return value === null ? '—' : `${value}%`;
}

export default function DailyPage() {
  const { settings, loading } = useSettings();
  const [sessions, setSessions] = useState<PracticeSession[] | null>(null);

  useEffect(() => {
    listSessionsToday().then(setSessions);
  }, []);

  if (loading || sessions === null) return null;
  if (!settings) return <Navigate to="/setup" replace />;
  // The reward is earned: only reachable once the day's sessions are done.
  if (sessions.length < DAILY_GOAL) return <Navigate to="/practice" replace />;

  const day = summarizeDay(sessions);
  // Labels as they were when the most recent session was recorded.
  const targetLabel = sessions[0].targetLabel;
  const inefficientLabel = sessions[0].inefficientLabel;

  const rows: (PaintBlob & { sentence: React.ReactNode })[] = [
    {
      key: 'target',
      percent: day.targetConfidence,
      color: 'var(--ctt-teal)',
      label: targetLabel,
      dir: [-0.75, -0.35],
      seed: 1,
      sentence: (
        <>
          <strong>{pct(day.targetConfidence)}</strong> confident you were in your <strong>{targetLabel}</strong>
        </>
      ),
    },
    {
      key: 'inefficient',
      percent: day.inefficientConfidence,
      color: 'var(--ctt-coral)',
      label: inefficientLabel,
      dir: [0.75, -0.35],
      seed: 2,
      sentence: (
        <>
          <strong>{pct(day.inefficientConfidence)}</strong> confident you were in your{' '}
          <strong>{inefficientLabel}</strong>
        </>
      ),
    },
    {
      key: 'felt',
      percent: day.feltDifferencePercent,
      color: 'var(--ctt-peach)',
      label: 'Felt a difference',
      dir: [-0.78, 0.72],
      seed: 3,
      sentence: (
        <>
          <strong>{pct(day.feltDifferencePercent)}</strong> of the time, you felt a difference in your voices.
        </>
      ),
    },
    {
      key: 'heard',
      percent: day.heardDifferencePercent,
      color: 'var(--ctt-sage)',
      label: 'Heard a difference',
      dir: [0.78, 0.72],
      seed: 4,
      sentence: (
        <>
          <strong>{pct(day.heardDifferencePercent)}</strong> of the time, you heard a difference.
        </>
      ),
    },
  ];

  const Row = ({ row }: { row: (typeof rows)[number] }) => (
    <li className="daily-row">
      <span className="daily-dot" style={{ background: row.color }} />
      <span>{row.sentence}</span>
    </li>
  );

  return (
    <div className="page">
      <div className="card wide daily-card">
        <h1 className="daily-title">Daily Progress Review</h1>

        <PaintCluster blobs={rows} />
        <p className="daily-caption">Bigger circle = higher percentage.</p>

        <p className="daily-lead">Overall, you rated your confidence in achieving your intended voice as…</p>
        <ul className="daily-list">
          <Row row={rows[0]} />
          <Row row={rows[1]} />
        </ul>

        <p className="daily-lead">Across all practice efforts,</p>
        <ul className="daily-list">
          <Row row={rows[2]} />
          <Row row={rows[3]} />
        </ul>

        <Link to="/practice">
          <button type="button" className="start-another-button">
            Back to practice
          </button>
        </Link>
      </div>
    </div>
  );
}
