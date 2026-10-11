import React from 'react';
import { DashboardRenderer } from '@riviamigo/dashboards';
import type { DashboardPageShellRenderState } from '../../components/dashboard/dashboardShellTypes';
import { getTimeframeLabel } from '../../lib/dates';
import { usesBundledLayout } from './defaultLayout';
import { RDashboardTools } from './RDashboardTools';
import { HomeVehicleHeadingContext } from './RDashboardVehicle';
import './r-full-dashboard.css';

export function RHomeWorkspace({ state, actions }: { state: DashboardPageShellRenderState; actions: React.ReactNode }) {
  const config = state.activeConfig;
  if (!config) return null;
  const vehicleWidget = config.widgets.find(widget => widget.componentType === 'custom' && widget.definitionId === 'overview.vehicle');
  return <section className="r-home-workspace r-dashboard-surface" aria-label="Dashboard analysis"
    data-r-default-layout={usesBundledLayout(state.activeConfig) || undefined}>
    <header className="r-workspace-heading">
      <div className="r-workspace-period">{!vehicleWidget && <h1>Overview</h1>}<span>Driving summary · {getTimeframeLabel(state.timeframe)}</span></div>
      <div className="r-workspace-actions">{actions}<RDashboardTools state={state} /></div>
    </header>
    <HomeVehicleHeadingContext.Provider value={vehicleWidget?.id}>
      <DashboardRenderer config={config} ctx={state.ctx} />
    </HomeVehicleHeadingContext.Provider>
  </section>;
}
