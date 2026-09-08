import JSZip from 'jszip';
import { getAudio, getSettings, listSessions } from '../db/db';
import { timeToFirstTarget, timeToReturnAfterInefficient } from '../review/metrics';
import { toCsvRow } from './csv';

const CSV_HEADER = [
  'session_id',
  'started_at',
  'status',
  'target_label',
  'inefficient_label',
  'prompt',
  'duration_s',
  'button_presses',
  'time_to_target_s',
  'time_to_return_after_inefficient_s',
  'best_voice_score_cpps_db',
  'time_in_clear_voice_pct',
  'journal_target',
  'journal_inefficient',
];

function audioExtension(mimeType: string): string {
  if (mimeType.includes('webm')) return 'webm';
  if (mimeType.includes('mp4') || mimeType.includes('m4a')) return 'm4a';
  if (mimeType.includes('ogg')) return 'ogg';
  if (mimeType.includes('wav')) return 'wav';
  return 'audio';
}

// Builds a single downloadable zip: sessions.json (full-fidelity, matches the
// on-device data model 1:1), sessions_summary.csv (one row per session, for
// spreadsheet/stats tools), and audio/<sessionId>.<ext> per recorded session.
export async function buildExportZip(): Promise<Blob> {
  const [settings, sessions] = await Promise.all([getSettings(), listSessions()]);
  const zip = new JSZip();

  const csvRows = [toCsvRow(CSV_HEADER)];
  const sessionRecords = [];

  for (const session of sessions) {
    const audioBlob = await getAudio(session.id);
    let audioFile: string | null = null;
    if (audioBlob && audioBlob.size > 0) {
      const ext = audioExtension(audioBlob.type);
      audioFile = `audio/${session.id}.${ext}`;
      zip.file(audioFile, audioBlob);
    }

    sessionRecords.push({ ...session, audioFile });

    const durationS = ((session.endedAt ?? session.startedAt) - session.startedAt) / 1000;
    const timeToTargetMs = timeToFirstTarget(session.presses);
    const timeToReturnMs = timeToReturnAfterInefficient(session.presses, session.intervals);

    csvRows.push(
      toCsvRow([
        session.id,
        new Date(session.startedAt).toISOString(),
        session.status,
        session.targetLabel,
        session.inefficientLabel,
        session.prompt,
        durationS.toFixed(1),
        session.presses.length,
        timeToTargetMs === null ? '' : (timeToTargetMs / 1000).toFixed(1),
        timeToReturnMs === null ? '' : (timeToReturnMs / 1000).toFixed(1),
        session.voiceAnalysis ? session.voiceAnalysis.bestCppsDb : '',
        session.voiceAnalysis ? session.voiceAnalysis.percentTimeClear : '',
        session.journal.target ?? '',
        session.journal.inefficient ?? '',
      ]),
    );
  }

  zip.file(
    'sessions.json',
    JSON.stringify({ exportedAt: new Date().toISOString(), settings: settings ?? null, sessions: sessionRecords }, null, 2),
  );
  zip.file('sessions_summary.csv', csvRows.join(''));

  return zip.generateAsync({ type: 'blob' });
}

export function exportFileName(): string {
  const date = new Date().toISOString().slice(0, 10);
  return `ctt-practice-export-${date}.zip`;
}
