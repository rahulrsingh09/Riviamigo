import React from 'react';
import { Link, useLocation, useNavigate } from '@tanstack/react-router';
import { CarFront, Compass, Gauge, LogOut, Moon, Route, Settings2, Sun, Zap } from 'lucide-react';
import { useAuth } from '@riviamigo/hooks';
import { useDocumentTheme } from '@riviamigo/ui/hooks';
import { useThemePreferenceController } from '../../hooks/useThemePreferenceController';
import { RMark } from './RMark';
import { useRConnection } from './useRConnection';

const navigation = [
  { key: 'dashboard', label: 'Overview', to: '/', icon: CarFront },
  { key: 'trips', label: 'Trips', to: '/trips', icon: Route },
  { key: 'charging', label: 'Charging', to: '/charging', icon: Zap },
  { key: 'efficiency', label: 'Efficiency', to: '/efficiency', icon: Gauge },
  { key: 'explore', label: 'Explore', to: '/explore', icon: Compass },
] as const;

export function RAppLayout({ children, activeKey }: { children: React.ReactNode; activeKey: string }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const logout = useAuth(state => state.logout);
  const theme = useThemePreferenceController();
  const dark = useDocumentTheme();
  const connection = useRConnection();
  const active = navigation.some(item => item.key === activeKey) ? activeKey : 'explore';
  return (
    <div className="r-app" data-area={activeKey}>
      <a className="r-skip-link" href="#r-content">Skip to content</a>
      <header className="r-header">
        <Link to="/" aria-label="R overview" className="r-brand"><RMark /></Link>
        <nav className="r-navigation" aria-label="Primary navigation">
          {navigation.map(({ key, label, to, icon: Icon }) => (
            <Link key={key} to={to} aria-label={label} aria-current={active === key ? 'page' : undefined}>
              <Icon aria-hidden="true" /><span>{label}</span>
            </Link>
          ))}
        </nav>
        <div className="r-header-actions">
          <button type="button" aria-label={`Switch to ${dark ? 'light' : 'dark'} mode`}
            disabled={theme.isPending} onClick={() => theme.onModeChange(dark ? 'light' : 'dark')}>
            {dark ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
          </button>
          <Link to="/settings" aria-label="Settings"><Settings2 aria-hidden="true" /></Link>
          <button type="button" aria-label="Sign out" onClick={async () => {
            await logout();
            await navigate({ to: '/login' });
          }}><LogOut aria-hidden="true" /></button>
        </div>
      </header>
      <main id="r-content" className="r-main" tabIndex={-1}>
        {connection.onlineState === 'connecting' && <p className="r-connection-status" role="status">
          Reconnecting live updates · Showing last recorded readings.
        </p>}
        {connection.feed && <p className="r-notice" role="alert">{connection.feed.title}.{' '}
          <Link to="/vehicle-health">Check vehicle health</Link></p>}
        {connection.renewal && <p className="r-notice">
          <Link to="/settings" search={{ section: 'vehicles' }}>{connection.renewal.message}</Link>
        </p>}
        <div className="r-page" key={pathname}>{children}</div>
      </main>
    </div>
  );
}
