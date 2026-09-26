import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { countSessionsToday, saveAudio, saveSession } from '../db/db';
import type { PracticeSession, Rating } from '../db/types';
import { useSettings } from '../hooks/useSettings';
import { useSessionActivity } from '../context/SessionActivityContext';
import { pickPrompt } from '../practice/prompts';
import {
  DAILY_GOAL,
  SESSION_DURATION_MS,
  SESSION_INTERVALS,
  getCurrentIntervalIndex,
  getCurrentIntervalVoice,
} from '../practice/protocol';
import ConfidenceSlider from '../practice/ConfidenceSlider';
import { ThumbsDown, ThumbsUp } from '../practice/ThumbIcons';

type Phase = 'ready' | 'recording' | 'finalizing';

export default function PracticePage() {
  const { settings, loading } = useSettings();
  const navigate = useNavigate();
  const { setActive } = useSessionActivity();

  const [phase, setPhase] = useState<Phase>('ready');
  const [prompt] = useState(() => pickPrompt());
  const [elapsedMs, setElapsedMs] = useState(0);
  const [micError, setMicError] = useState<string | null>(null);
  const [todayCount, setTodayCount] = useState<number | null>(null);
  const [sessionNumber, setSessionNumber] = useState(1);

  const sessionIdRef = useRef('');
  const startTimestampRef = useRef(0);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const ratingsRef = useRef<Rating[]>([]);
  const finalizingRef = useRef(false);

  useEffect(() => {
    if (phase !== 'ready') return;
    countSessionsToday().then(setTodayCount);
  }, [phase]);

  useEffect(() => {
    if (phase !== 'recording') return;
    const id = window.setInterval(() => {
      const elapsed = Date.now() - startTimestampRef.current;
      setElapsedMs(elapsed);
      if (elapsed >= SESSION_DURATION_MS) {
        finalizeSession('completed');
      }
    }, 100);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  useEffect(() => {
    if (phase !== 'recording') return;
    function handler(e: BeforeUnloadEvent) {
      e.preventDefault();
      e.returnValue = '';
    }
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [phase]);

  useEffect(() => () => setActive(false), [setActive]);

  async function handleStart() {
    if (!settings) return;
    setMicError(null);

    if (typeof MediaRecorder === 'undefined') {
      setMicError('This browser does not support audio recording, which practice sessions require.');
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setMicError('Microphone access is required to record this session. Please allow microphone access and try again.');
      return;
    }

    streamRef.current = stream;
    chunksRef.current = [];
    const recorder = new MediaRecorder(stream);
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorderRef.current = recorder;
    recorder.start();

    // Re-counted at start (not reused from the ready screen) so a page left
    // open across midnight still numbers the session correctly.
    setSessionNumber((await countSessionsToday()) + 1);

    sessionIdRef.current = crypto.randomUUID();
    startTimestampRef.current = Date.now();
    finalizingRef.current = false;
    ratingsRef.current = [];
    setElapsedMs(0);
    setActive(true);
    setPhase('recording');
  }

  // One rating per practice period: the slider locks after the first release,
  // and this guard keeps the record to a single entry per period as well.
  function handleRate(value: number) {
    if (phase !== 'recording') return;
    const tMs = Date.now() - startTimestampRef.current;
    const intervalIndex = getCurrentIntervalIndex(tMs);
    const alreadyRated = ratingsRef.current.some((r) => getCurrentIntervalIndex(r.tMs) === intervalIndex);
    if (alreadyRated) return;
    ratingsRef.current.push({ tMs, voice: getCurrentIntervalVoice(tMs), value });
  }

  function handleEndEarly() {
    if (phase !== 'recording') return;
    if (!window.confirm('End this session early? It will be saved as incomplete.')) return;
    finalizeSession('aborted');
  }

  async function finalizeSession(status: 'completed' | 'aborted') {
    if (finalizingRef.current || !settings) return;
    finalizingRef.current = true;
    setPhase('finalizing');

    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      await new Promise<void>((resolve) => {
        recorder.addEventListener('stop', () => resolve(), { once: true });
        recorder.stop();
      });
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;

    const audioBlob = new Blob(chunksRef.current, { type: recorderRef.current?.mimeType || 'audio/webm' });

    const session: PracticeSession = {
      id: sessionIdRef.current,
      startedAt: startTimestampRef.current,
      endedAt: Date.now(),
      status,
      targetLabel: settings.targetLabel,
      inefficientLabel: settings.inefficientLabel,
      prompt,
      intervals: SESSION_INTERVALS,
      presses: [],
      ratings: ratingsRef.current,
    };

    await saveSession(session);
    await saveAudio(session.id, audioBlob);

    setActive(false);
    navigate(`/awareness/${session.id}`);
  }

  if (loading) {
    return null;
  }
  if (!settings) {
    return <Navigate to="/setup" replace />;
  }

  if (phase === 'finalizing') {
    return (
      <div className="page">
        <div className="card">
          <h1>Saving session…</h1>
        </div>
      </div>
    );
  }

  if (phase === 'ready') {
    return (
      <div className="page">
        <div className="card wide">
          <h1>Practice session</h1>
          <p className="subtitle">
            Session {(todayCount ?? 0) + 1} today · daily goal is {DAILY_GOAL}, more is fine
          </p>
          <div className="prompt-preview">
            <span className="prompt-preview-label">Today's prompt</span>
            <p className="prompt-text">{prompt}</p>
          </div>
          <p className="subtitle">
            Speak continuously for 2.5 minutes, switching between <strong>{settings.targetLabel}</strong> and{' '}
            <strong>{settings.inefficientLabel}</strong> as prompted.
          </p>
          <p className="subtitle">
            As you talk, use the slider button to select your confidence level in achieving your{' '}
            <strong>{settings.targetLabel}</strong> and <strong>{settings.inefficientLabel}</strong>. Only tell us how
            confident you are WHEN you reach your intended voice.
          </p>
          {micError && (
            <p className="form-error" role="alert">
              {micError}
            </p>
          )}
          <button type="button" onClick={handleStart}>
            Start session
          </button>
          {(todayCount ?? 0) >= DAILY_GOAL && (
            <Link to="/daily" className="link-button back-link daily-link">
              See today's Daily Progress Review
            </Link>
          )}
        </div>
      </div>
    );
  }

  // phase === 'recording'
  const currentVoice = getCurrentIntervalVoice(elapsedMs);
  const currentIntervalIndex = getCurrentIntervalIndex(elapsedMs);
  const currentVoiceLabel = currentVoice === 'target' ? settings.targetLabel : settings.inefficientLabel;

  return (
    <div className="page">
      <div className="card wide">
        <h1>
          Practice Session {sessionNumber}/{DAILY_GOAL}
        </h1>

        <div className="progress-wrap">
          <div className="progress-track">
            {SESSION_INTERVALS.map((iv, i) => (
              <div
                key={i}
                className={`progress-segment voice-${iv.voice}`}
                style={{ width: `${((iv.endMs - iv.startMs) / SESSION_DURATION_MS) * 100}%` }}
              />
            ))}
          </div>
          <svg
            className="progress-arrow"
            viewBox="0 0 24 44"
            aria-hidden="true"
            style={{ left: `${Math.min(100, (elapsedMs / SESSION_DURATION_MS) * 100)}%` }}
          >
            <polygon points="2,2 12,2 22,22 12,42 2,42 12,22" />
          </svg>
        </div>

        <p className="prompt-text">{prompt}</p>

        <div className={`rating-panel voice-${currentVoice}`}>
          <span className="rating-voice">{currentVoiceLabel}</span>
          <p className="rating-question">How confident are you that you are in {currentVoiceLabel}?</p>
          <div className="rating-scale">
            <ThumbsDown />
            <ConfidenceSlider
              key={currentIntervalIndex}
              ariaLabel={`Confidence that you are in ${currentVoiceLabel}`}
              onCommit={handleRate}
            />
            <ThumbsUp />
          </div>
        </div>

        <button type="button" className="link-button" onClick={handleEndEarly}>
          End session early
        </button>
      </div>
    </div>
  );
}
