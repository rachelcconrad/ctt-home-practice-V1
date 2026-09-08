import { useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { listSessions, saveAudio, saveSession } from '../db/db';
import type { Press, PracticeSession, VoiceRole } from '../db/types';
import { useSettings } from '../hooks/useSettings';
import { useSessionActivity } from '../context/SessionActivityContext';
import { pickPrompt } from '../practice/prompts';
import { SESSION_DURATION_MS, SESSION_INTERVALS, formatClock, getCurrentIntervalVoice } from '../practice/protocol';
import { analyzeSessionAudio } from '../analysis/cpps';

type Phase = 'ready' | 'recording' | 'finalizing';

export default function PracticePage() {
  const { settings, loading } = useSettings();
  const navigate = useNavigate();
  const { setActive } = useSessionActivity();

  const [phase, setPhase] = useState<Phase>('ready');
  const [prompt] = useState(() => pickPrompt());
  const [elapsedMs, setElapsedMs] = useState(0);
  const [presses, setPresses] = useState<Press[]>([]);
  const [micError, setMicError] = useState<string | null>(null);
  const [todayCount, setTodayCount] = useState<number | null>(null);

  const sessionIdRef = useRef('');
  const startTimestampRef = useRef(0);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const pressesRef = useRef<Press[]>([]);
  const finalizingRef = useRef(false);

  useEffect(() => {
    if (phase !== 'ready') return;
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    listSessions().then((sessions) => {
      setTodayCount(sessions.filter((s) => s.startedAt >= startOfToday.getTime()).length);
    });
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

    sessionIdRef.current = crypto.randomUUID();
    startTimestampRef.current = Date.now();
    finalizingRef.current = false;
    pressesRef.current = [];
    setPresses([]);
    setElapsedMs(0);
    setActive(true);
    setPhase('recording');
  }

  function handlePress(voice: VoiceRole) {
    if (phase !== 'recording') return;
    const tMs = Date.now() - startTimestampRef.current;
    setPresses((prev) => {
      const next = [...prev, { tMs, voice }];
      pressesRef.current = next;
      return next;
    });
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
      presses: pressesRef.current,
      journal: {},
    };

    await saveSession(session);
    await saveAudio(session.id, audioBlob);

    // Best-effort: analysis must never risk the core recording/press data,
    // which is already durably saved above.
    try {
      const voiceAnalysis = await analyzeSessionAudio(audioBlob, SESSION_INTERVALS);
      if (voiceAnalysis) {
        await saveSession({ ...session, voiceAnalysis });
      }
    } catch (err) {
      console.error('Voice analysis failed', err);
    }

    setActive(false);
    navigate(`/review/${session.id}`);
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
            Session {(todayCount ?? 0) + 1} today · daily goal is 7, more is fine
          </p>
          <div className="prompt-preview">
            <span className="prompt-preview-label">Today's prompt</span>
            <p className="prompt-text">{prompt}</p>
          </div>
          <p className="subtitle">
            You'll speak continuously for 2.5 minutes, switching between{' '}
            <strong>{settings.targetLabel}</strong> and <strong>{settings.inefficientLabel}</strong> as prompted.
            Tap whichever voice you feel you're producing, in the moment.
          </p>
          {micError && (
            <p className="form-error" role="alert">
              {micError}
            </p>
          )}
          <button type="button" onClick={handleStart}>
            Start session
          </button>
        </div>
      </div>
    );
  }

  // phase === 'recording'
  const currentTargetVoice = getCurrentIntervalVoice(elapsedMs);
  const lastFeltVoice = presses.length ? presses[presses.length - 1].voice : null;
  const remainingMs = Math.max(0, SESSION_DURATION_MS - elapsedMs);

  return (
    <div className="page">
      <div className="card wide">
        <div className={`cue-banner voice-${currentTargetVoice}`}>
          <span className="cue-label">Aim for</span>
          <span className="cue-voice">
            {currentTargetVoice === 'target' ? settings.targetLabel : settings.inefficientLabel}
          </span>
        </div>

        <div className="progress-track">
          {SESSION_INTERVALS.map((iv, i) => (
            <div
              key={i}
              className={`progress-segment voice-${iv.voice}`}
              style={{ width: `${((iv.endMs - iv.startMs) / SESSION_DURATION_MS) * 100}%` }}
            />
          ))}
          <div
            className="progress-marker"
            style={{ left: `${Math.min(100, (elapsedMs / SESSION_DURATION_MS) * 100)}%` }}
          />
        </div>
        <p className="timer-text">{formatClock(remainingMs)} remaining</p>

        <p className="prompt-text">{prompt}</p>

        <div className="felt-buttons">
          <button
            type="button"
            className={`felt-button voice-target${lastFeltVoice === 'target' ? ' active' : ''}`}
            onClick={() => handlePress('target')}
          >
            {settings.targetLabel}
          </button>
          <button
            type="button"
            className={`felt-button voice-inefficient${lastFeltVoice === 'inefficient' ? ' active' : ''}`}
            onClick={() => handlePress('inefficient')}
          >
            {settings.inefficientLabel}
          </button>
        </div>

        <button type="button" className="link-button" onClick={handleEndEarly}>
          End session early
        </button>
      </div>
    </div>
  );
}
