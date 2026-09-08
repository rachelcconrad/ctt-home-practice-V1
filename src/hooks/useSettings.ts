import { useCallback, useEffect, useState } from 'react';
import { getSettings } from '../db/db';
import type { AppSettings } from '../db/types';

// undefined = still loading, null = no settings saved yet
type SettingsState = AppSettings | null | undefined;

export function useSettings() {
  const [settings, setSettings] = useState<SettingsState>(undefined);

  const reload = useCallback(async () => {
    const s = await getSettings();
    setSettings(s ?? null);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { settings, loading: settings === undefined, reload };
}
