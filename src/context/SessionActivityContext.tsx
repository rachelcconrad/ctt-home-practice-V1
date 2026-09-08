import { createContext, useContext, useState, type ReactNode } from 'react';

interface SessionActivityValue {
  active: boolean;
  setActive: (active: boolean) => void;
}

const SessionActivityContext = createContext<SessionActivityValue | null>(null);

export function SessionActivityProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState(false);
  return (
    <SessionActivityContext.Provider value={{ active, setActive }}>{children}</SessionActivityContext.Provider>
  );
}

export function useSessionActivity() {
  const ctx = useContext(SessionActivityContext);
  if (!ctx) {
    throw new Error('useSessionActivity must be used within SessionActivityProvider');
  }
  return ctx;
}
