import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { getAudio, getSession, saveSession } from '../db/db';
import type { PracticeSession } from '../db/types';
import { useSettings } from '../hooks/useSettings';
import { computeFeltSegments, type TimelineSegment } from '../review/timeline';
import { formatSecondsMetric, timeToFirstTarget, timeToReturnAfterInefficient } from '../review/metrics';
import TimelineBar from '../review/TimelineBar';

export default function ReviewPage() {
  const { settings, loading: settingsLoading } = useSettings();
  const { sessionId } = useParams();
  const [session, setSession] = useState<PracticeSession | null | undefined>(undefined);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [currentTimeMs, setCurrentTimeMs] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  const [targetFeel, setTargetFeel] = useState('');
  const [inefficientFeel, setInefficientFeel] = useState('');
  const [journalSaved, setJournalSaved] = useState(false);

  useEffect(() => {
    if (!sessionId) return;
    getSession(sessionId).then((s) => {
      setSession(s ?? null);
      if (s) {
        setTargetFeel(s.journal.target ?? '');
        setInefficientFeel(s.journal.inefficient ?? '');
      }
    });
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) return;
    let url: string | null = null;
    getAudio(sessionId).then((blob) => {
      if (blob) {
        url = URL.createObjectURL(blob);
        setAudioUrl(url);
      }
    });
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
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
  const targetSegments: TimelineSegment[] = session.intervals.map((iv) => ({
    voice: iv.voice,
    startMs: Math.min(iv.startMs, durationMs),
    endMs: Math.min(iv.endMs, durationMs),
  }));
  const feltSegments = computeFeltSegments(session.presses, durationMs);
  const scrubberPercent = Math.min(100, Math.max(0, (currentTimeMs / durationMs) * 100));

  function handleSeek(fraction: number) {
    if (!audioRef.current) return;
    audioRef.current.currentTime = (fraction * durationMs) / 1000;
  }

  async function handleSaveJournal() {
    if (!session) return;
    const updated: PracticeSession = {
      ...session,
      journal: {
        target: targetFeel.trim() || undefined,
        inefficient: inefficientFeel.trim() || undefined,
      },
    };
    await saveSession(updated);
    setSession(updated);
    setJournalSaved(true);
  }

  const timeToTarget = timeToFirstTarget(session.presses);
  const timeToReturn = timeToReturnAfterInefficient(session.presses, session.intervals);

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

          <TimelineBar
            rowLabel="Target"
            segments={targetSegments}
            durationMs={durationMs}
            scrubberPercent={audioUrl ? scrubberPercent : null}
            onSeek={audioUrl ? handleSeek : undefined}
          />
          <TimelineBar
            rowLabel="Felt"
            segments={feltSegments}
            durationMs={durationMs}
            scrubberPercent={audioUrl ? scrubberPercent : null}
            onSeek={audioUrl ? handleSeek : undefined}
          />

          {audioUrl ? (
            <audio
              ref={audioRef}
              src={audioUrl}
              controls
              className="audio-player"
              onTimeUpdate={(e) => setCurrentTimeMs(e.currentTarget.currentTime * 1000)}
            />
          ) : (
            <p className="subtitle">No audio was saved for this session.</p>
          )}

          <dl className="summary-list">
            <dt>Time to reach {session.targetLabel}</dt>
            <dd>{formatSecondsMetric(timeToTarget)}</dd>
            <dt>Time to return to {session.targetLabel} after {session.inefficientLabel}</dt>
            <dd>{formatSecondsMetric(timeToReturn)}</dd>
          </dl>
        </div>

        {session.voiceAnalysis ? (
          <div className="score-card">
            <div className="score-item">
              <span className="score-value">{session.voiceAnalysis.bestCppsDb}</span>
              <span className="score-label">Best Voice Score</span>
              <span className="score-subnote">
                Goal is {Math.round(session.voiceAnalysis.thresholdDb)}+. Bigger is better, not a percent.
              </span>
            </div>
            <div className="score-item">
              <span className="score-value">{session.voiceAnalysis.percentTimeClear}%</span>
              <span className="score-label">Time in {session.targetLabel}</span>
            </div>
          </div>
        ) : (
          <p className="subtitle">Voice clarity score isn't available for this session.</p>
        )}

        <dl className="summary-list">
          <dt>Prompt</dt>
          <dd>{session.prompt}</dd>
          <dt>Button presses</dt>
          <dd>{session.presses.length}</dd>
        </dl>

        <div className="journal-section">
          <label htmlFor="targetFeel">How did {session.targetLabel} feel?</label>
          <textarea
            id="targetFeel"
            rows={2}
            value={targetFeel}
            onChange={(e) => setTargetFeel(e.target.value)}
            placeholder="Optional"
          />
          <label htmlFor="inefficientFeel">How did {session.inefficientLabel} feel?</label>
          <textarea
            id="inefficientFeel"
            rows={2}
            value={inefficientFeel}
            onChange={(e) => setInefficientFeel(e.target.value)}
            placeholder="Optional"
          />
          {journalSaved && (
            <p className="form-success" role="status">
              Saved.
            </p>
          )}
          <button type="button" onClick={handleSaveJournal}>
            Save notes
          </button>
        </div>

        <Link to="/practice">
          <button type="button" className="start-another-button">
            Start another session
          </button>
        </Link>
      </div>
    </div>
  );
}
