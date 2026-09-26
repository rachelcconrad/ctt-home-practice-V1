import { HashRouter, Link, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { useSettings } from './hooks/useSettings';
import { SessionActivityProvider, useSessionActivity } from './context/SessionActivityContext';
import SetupPage from './routes/SetupPage';
import PracticePage from './routes/PracticePage';
import AwarenessPage from './routes/AwarenessPage';
import ReviewPage from './routes/ReviewPage';
import DailyPage from './routes/DailyPage';

function Layout() {
  const { active } = useSessionActivity();
  return (
    <div className="app-shell">
      <header className="app-header">
        <Link to="/" className="app-title">
          CTT Practice
        </Link>
        {!active && (
          <Link to="/setup" className="settings-link" aria-label="Voice label settings" title="Voice label settings">
            <GearIcon />
          </Link>
        )}
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  );
}

function GearIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function RootRedirect() {
  const { settings, loading } = useSettings();
  if (loading) {
    return null;
  }
  return <Navigate to={settings ? '/practice' : '/setup'} replace />;
}

export default function App() {
  return (
    <SessionActivityProvider>
      <HashRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<RootRedirect />} />
            <Route path="/setup" element={<SetupPage />} />
            <Route path="/practice" element={<PracticePage />} />
            <Route path="/awareness/:sessionId" element={<AwarenessPage />} />
            <Route path="/review/:sessionId" element={<ReviewPage />} />
            <Route path="/daily" element={<DailyPage />} />
          </Route>
        </Routes>
      </HashRouter>
    </SessionActivityProvider>
  );
}
