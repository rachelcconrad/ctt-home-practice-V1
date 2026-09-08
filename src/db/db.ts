import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { AppSettings, PracticeSession } from './types';

interface CTTDB extends DBSchema {
  settings: {
    key: string;
    value: AppSettings;
  };
  sessions: {
    key: string;
    value: PracticeSession;
    indexes: { 'by-startedAt': number };
  };
  audio: {
    key: string; // session id
    value: Blob;
  };
}

const DB_NAME = 'ctt-practice';
const DB_VERSION = 2;
const SETTINGS_KEY = 'config';

let dbPromise: Promise<IDBPDatabase<CTTDB>> | null = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<CTTDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings');
        }
        if (!db.objectStoreNames.contains('sessions')) {
          const sessions = db.createObjectStore('sessions', { keyPath: 'id' });
          sessions.createIndex('by-startedAt', 'startedAt');
        }
        if (!db.objectStoreNames.contains('audio')) {
          db.createObjectStore('audio');
        }
      },
    });
  }
  return dbPromise;
}

export async function getSettings(): Promise<AppSettings | undefined> {
  const db = await getDB();
  return db.get('settings', SETTINGS_KEY);
}

export async function saveSettings(labels: {
  targetLabel: string;
  inefficientLabel: string;
}): Promise<AppSettings> {
  const db = await getDB();
  const existing = await db.get('settings', SETTINGS_KEY);
  const now = Date.now();
  const settings: AppSettings = {
    targetLabel: labels.targetLabel,
    inefficientLabel: labels.inefficientLabel,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  await db.put('settings', settings, SETTINGS_KEY);
  return settings;
}

// Upserts by id, so the practice screen can persist a session incrementally
// (e.g. after each press, or on unmount) rather than only at a clean finish.
export async function saveSession(session: PracticeSession): Promise<void> {
  const db = await getDB();
  await db.put('sessions', session);
}

export async function getSession(id: string): Promise<PracticeSession | undefined> {
  const db = await getDB();
  return db.get('sessions', id);
}

// Most recent first.
export async function listSessions(): Promise<PracticeSession[]> {
  const db = await getDB();
  const all = await db.getAllFromIndex('sessions', 'by-startedAt');
  return all.reverse();
}

export async function saveAudio(sessionId: string, blob: Blob): Promise<void> {
  const db = await getDB();
  await db.put('audio', blob, sessionId);
}

export async function getAudio(sessionId: string): Promise<Blob | undefined> {
  const db = await getDB();
  return db.get('audio', sessionId);
}
