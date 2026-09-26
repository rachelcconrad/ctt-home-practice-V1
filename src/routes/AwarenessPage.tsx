import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { getSession, saveSession } from '../db/db';
import type { PracticeSession } from '../db/types';

interface YesNoProps {
  question: string;
  value: boolean | null;
  onChange: (value: boolean) => void;
}

function YesNo({ question, value, onChange }: YesNoProps) {
  return (
    <div className="yesno-question">
      <p className="yesno-text">{question}</p>
      <div className="yesno-buttons" role="group" aria-label={question}>
        <button
          type="button"
          className={`yesno-button${value === true ? ' selected' : ''}`}
          aria-pressed={value === true}
          onClick={() => onChange(true)}
        >
          Yes
        </button>
        <button
          type="button"
          className={`yesno-button${value === false ? ' selected' : ''}`}
          aria-pressed={value === false}
          onClick={() => onChange(false)}
        >
          No
        </button>
      </div>
    </div>
  );
}

export default function AwarenessPage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState<PracticeSession | null | undefined>(undefined);
  const [heardDifference, setHeardDifference] = useState<boolean | null>(null);
  const [feltDifference, setFeltDifference] = useState<boolean | null>(null);

  useEffect(() => {
    if (!sessionId) return;
    getSession(sessionId).then((s) => {
      setSession(s ?? null);
      if (s?.discrimination) {
        setHeardDifference(s.discrimination.heardDifference);
        setFeltDifference(s.discrimination.feltDifference);
      }
    });
  }, [sessionId]);

  if (session === undefined) {
    return null;
  }
  if (session === null) {
    return <Navigate to="/practice" replace />;
  }

  async function handleContinue() {
    if (!session) return;
    if (heardDifference === null || feltDifference === null) return;
    await saveSession({ ...session, discrimination: { heardDifference, feltDifference } });
    navigate(`/review/${session.id}`);
  }

  const both = `${session.targetLabel} and ${session.inefficientLabel}`;
  const answeredBoth = heardDifference !== null && feltDifference !== null;

  return (
    <div className="page">
      <div className="card wide">
        <h1>Sound and Feel Changes</h1>
        <p className="subtitle">Answer both questions to see your review.</p>

        <YesNo
          question={`Did you hear a difference between ${both}?`}
          value={heardDifference}
          onChange={setHeardDifference}
        />
        <YesNo
          question={`Did you feel a difference between ${both}?`}
          value={feltDifference}
          onChange={setFeltDifference}
        />

        <button type="button" className="start-another-button" onClick={handleContinue} disabled={!answeredBoth}>
          Continue
        </button>
      </div>
    </div>
  );
}
