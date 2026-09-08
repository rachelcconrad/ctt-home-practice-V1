import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { listSessions, saveSettings } from '../db/db';
import { useSettings } from '../hooks/useSettings';
import { buildExportZip, exportFileName } from '../export/exportData';

export default function SetupPage() {
  const { settings, loading, reload } = useSettings();
  const navigate = useNavigate();

  const [targetLabel, setTargetLabel] = useState('');
  const [inefficientLabel, setInefficientLabel] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [sessionCount, setSessionCount] = useState<number | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  // Only prefill from stored settings once, on first load — otherwise every
  // reload() after saving would stomp on whatever the clinician is typing.
  const prefilled = useRef(false);
  useEffect(() => {
    if (!loading && !prefilled.current) {
      prefilled.current = true;
      if (settings) {
        setTargetLabel(settings.targetLabel);
        setInefficientLabel(settings.inefficientLabel);
      }
    }
  }, [loading, settings]);

  const isFirstTimeSetup = !loading && !settings;

  useEffect(() => {
    if (isFirstTimeSetup) return;
    listSessions().then((sessions) => setSessionCount(sessions.length));
  }, [isFirstTimeSetup]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);

    const trimmedTarget = targetLabel.trim();
    const trimmedInefficient = inefficientLabel.trim();

    if (!trimmedTarget || !trimmedInefficient) {
      setError('Both voice labels are required.');
      return;
    }
    if (trimmedTarget.toLowerCase() === trimmedInefficient.toLowerCase()) {
      setError('The two voice labels must be different from each other.');
      return;
    }

    const wasFirstTime = isFirstTimeSetup;
    await saveSettings({ targetLabel: trimmedTarget, inefficientLabel: trimmedInefficient });
    await reload();

    if (wasFirstTime) {
      navigate('/practice');
      return;
    }
    setSaved(true);
  }

  async function handleExport() {
    setExportError(null);
    setExporting(true);
    try {
      const blob = await buildExportZip();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = exportFileName();
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setExportError('Export failed. Please try again.');
    } finally {
      setExporting(false);
    }
  }

  if (loading) {
    return null;
  }

  return (
    <div className="page">
      <div className="page-stack">
      <div className="card">
        <h1>Voice labels</h1>
        <p className="subtitle">
          {isFirstTimeSetup
            ? "Set the patient's two personalized voice labels before their first session. These appear everywhere in the app."
            : 'Update the voice labels used throughout the app.'}
        </p>

        {!isFirstTimeSetup && (
          <Link to="/practice" className="link-button back-link">
            ← Back to practice
          </Link>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <label htmlFor="targetLabel">Target voice label</label>
          <input
            id="targetLabel"
            type="text"
            value={targetLabel}
            onChange={(e) => setTargetLabel(e.target.value)}
            placeholder="e.g. Clear voice"
            autoComplete="off"
          />

          <label htmlFor="inefficientLabel">Inefficient voice label</label>
          <input
            id="inefficientLabel"
            type="text"
            value={inefficientLabel}
            onChange={(e) => setInefficientLabel(e.target.value)}
            placeholder="e.g. Pressed voice"
            autoComplete="off"
          />

          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          {saved && (
            <p className="form-success" role="status">
              Saved.
            </p>
          )}

          <button type="submit">{isFirstTimeSetup ? 'Save and continue' : 'Save changes'}</button>
        </form>
      </div>

      {!isFirstTimeSetup && (
        <div className="card export-card">
          <h1>Practice data</h1>
          <p className="subtitle">
            {sessionCount === null
              ? 'Loading session history…'
              : `${sessionCount} session${sessionCount === 1 ? '' : 's'} recorded on this device.`}
          </p>
          <p className="subtitle">
            Downloads a single file with full session data (timings, presses, journal notes, CPPS voice scores), a
            spreadsheet-ready summary, and the session recordings.
          </p>
          {exportError && (
            <p className="form-error" role="alert">
              {exportError}
            </p>
          )}
          <button type="button" onClick={handleExport} disabled={exporting || sessionCount === 0}>
            {exporting ? 'Preparing export…' : 'Export practice data'}
          </button>
        </div>
      )}
      </div>
    </div>
  );
}
