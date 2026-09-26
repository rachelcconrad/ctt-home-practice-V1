import { useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { countSessionsToday, getSession } from '../db/db';
import type { PracticeSession } from '../db/types';
import { useSettings } from '../hooks/useSettings';
import { computeFeltSegments } from '../review/timeline';
import { DAILY_GOAL } from '../practice/protocol';
import { summarizeRatingsByInterval } from '../review/metrics';
import TimelineBar from '../review/TimelineBar';

export default function ReviewPage() {
  const { settings, loading: settingsLoading } = useSettings();
  const { sessionId } = useParams();
  const [session, setSession] = useState<PracticeSession | null | undefined>(undefined);

  const [todayCount, setTodayCount] = useState(0);

  useEffect(() => {
    if (!sessionId) return;
    getSession(sessionId).then((s) => setSession(s ?? null));
    countSessionsToday().then(setTodayCount);
  }, [sessionId]);

  if (settingsLoading || session === undefined) {
    return null;
  }
  if (!settings) {
    return <Navigate to="/setup" replace />;
  }
  if (!sessionId || session === null) {
    return (
      <div className="page">
        <div className="card">
          <h1>Session not found</h1>
          <p className="subtitle">This session may have been cleared from this device.</p>
          <Link to="/practice">
            <button type="button">Back to practice</button>
          </Link>
        </div>
      </div>
    );
  }

  const durationMs = Math.max(1, (session.endedAt ?? session.startedAt) - session.startedAt);
  const feltSegments = computeFeltSegments(session.presses, durationMs);

  // Sessions recorded before the confidence slider have voice-button taps
  // instead of ratings; they keep their original Felt bar.
  const isLegacy = session.ratings === undefined;
  const ratingSummaries = summarizeRatingsByInterval(session.ratings ?? [], session.intervals);

  return (
    <div className="page">
      <div className="card wide">
        <h1>Session review</h1>
        <p className="subtitle">
          {new Date(session.startedAt).toLocaleString()} · {session.status}
        </p>

        <div className="timeline-section">
          <div className="timeline-legend">
            <span className="legend-item">
              <span className="legend-swatch voice-target" /> {session.targetLabel}
            </span>
            <span className="legend-item">
              <span className="legend-swatch voice-inefficient" /> {session.inefficientLabel}
            </span>
          </div>

          {isLegacy ? (
            <TimelineBar rowLabel="Felt" segments={feltSegments} durationMs={durationMs} />
          ) : (
            <div className="timeline-row">
              <span className="timeline-row-label sentence-case">% Confident that you produced your intended voice</span>
              <div className="rating-boxes">
                {ratingSummaries.map((summary) => (
                  <div key={summary.index} className={`rating-box voice-${summary.voice}`}>
                    <span className="rating-box-value">{summary.rating === null ? '—' : `${summary.rating}%`}</span>
                    <span className="rating-box-label">
                      {summary.voice === 'target' ? session.targetLabel : session.inefficientLabel}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {todayCount >= DAILY_GOAL && (
          <Link to="/daily">
            <button type="button" className="start-another-button reward-button">
              See your Daily Progress Review
            </button>
          </Link>
        )}

        <Link to="/practice">
          <button type="button" className="start-another-button">
            Start another session
          </button>
        </Link>
      </div>
    </div>
  );
}
