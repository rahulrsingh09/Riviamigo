import React from 'react';
import { Link } from '@tanstack/react-router';

export function RBatteryNavigation({ pathname }: { pathname: string }) {
  if (pathname !== '/battery' && pathname !== '/battery/phantom-drain') return null;
  return <nav className="r-battery-navigation" aria-label="Battery sections">
    <Link to="/battery" aria-current={pathname === '/battery' ? 'page' : undefined}>Battery overview</Link>
    <Link to="/battery/phantom-drain" aria-current={pathname === '/battery/phantom-drain' ? 'page' : undefined}>Phantom drain</Link>
  </nav>;
}
