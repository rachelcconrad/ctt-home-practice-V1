import JSZip from 'jszip';
import { getAudio, getSettings, listSessions } from '../db/db';
import { summarizeRatingsByInterval, timeToFirstTarget, timeToReturnAfterInefficient } from '../review/metrics';
import { toCsvRow } from './csv';

const INTERVAL_COLUMN_COUNT = 3;

// Confidence-slider columns, one group per practice interval (one rating per
// interval). Ratings are 0-100: 0 = thumbs down, 100 = thumbs up.
const INTERVAL_COLUMNS = Array.from({ length: INTERVAL_COLUMN_COUNT }, (_, i) => [
  `interval${i + 1}_voice`,
  `interval${i + 1}_time_to_rating_s`,
  `interval${i + 1}_rating_0_100`,
]).flat();

function yesNo(value: boolean | null | undefined): string {
  if (value === true) return 'yes';
  if (value === false) return 'no';
  return '';
}

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
  ...INTERVAL_COLUMNS,
  'heard_difference',
  'felt_difference',
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

    // Rating cells are blank for legacy sessions (recorded before the slider) and for
    // intervals with no response.
    const summaries = summarizeRatingsByInterval(session.ratings ?? [], session.intervals);
    const intervalCells: (string | number)[] = [];
    for (let i = 0; i < INTERVAL_COLUMN_COUNT; i++) {
      const s = summaries[i];
      intervalCells.push(
        s ? s.voice : '',
        s?.latencyMs == null ? '' : (s.latencyMs / 1000).toFixed(2),
        s?.rating ?? '',
      );
    }

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
        ...intervalCells,
        yesNo(session.discrimination?.heardDifference),
        yesNo(session.discrimination?.feltDifference),
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
