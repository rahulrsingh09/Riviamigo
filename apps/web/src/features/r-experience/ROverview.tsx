import React from 'react';
import { Link } from '@tanstack/react-router';
import { ArrowUpRight, ChevronRight, Route, Zap } from 'lucide-react';
import { useChargeSessions, useCurrentVehicleStatus, useMetricBatch, useResolvedVehicleSelection, useTrips } from '@riviamigo/hooks';
import { formatCurrency, formatDuration, formatEfficiency, formatEfficiencyValue, getEfficiencyUnitLabel, formatKwh, formatMiles, formatNumber } from '@riviamigo/ui/lib/utils';
import { formatAppDateTime } from '@riviamigo/ui/lib/dateTime';
import type { DashboardPageShellRenderState } from '../../components/dashboard/dashboardShellTypes';
import { getTimeframeLabel } from '../../lib/dates';
import { finiteReading } from './readings';
import { RVehicleStage } from './RVehicleStage';
import './r-overview.css';

const metrics = ['trip_miles', 'total_trips', 'avg_efficiency'].map(metric => ({
  metric, include_latest: true, include_series: false,
}));

export function ROverview({ state, actions }: { state: DashboardPageShellRenderState; actions: React.ReactNode }) {
  const { vehicles } = useResolvedVehicleSelection();
  const vehicle = vehicles.find(item => item.id === state.vehicleId);
  const snapshot = useCurrentVehicleStatus(state.vehicleId);
  const status = !snapshot.isPlaceholderData && snapshot.data?.vehicle_id === state.vehicleId ? snapshot.data : null;
  const { from, to } = state.ctx;
  const batch = useMetricBatch(state.vehicleId, metrics, from ?? null, to ?? null, state.timeframe.kind === 'lifetime');
  const trips = useTrips(state.vehicleId, from ?? null, to ?? null, 1, 2);
  const charges = useChargeSessions(state.vehicleId, from ?? null, to ?? null, 1, 1);
  const metric = (name: string) => batch.isPlaceholderData ? null : finiteReading(batch.data?.values?.find(item => item.metric === name)?.value);
  const charge = charges.isPlaceholderData ? undefined : charges.data?.items?.[0];
  if (!vehicle) return null;
  return (
    <div className="r-overview">
        <RVehicleStage vehicle={vehicle} status={status} actions={actions} efficiency={
          <Link className="r-efficiency-card" to="/efficiency">
            <span className="r-card-top">Efficiency <ArrowUpRight /></span>
            <div><strong>{formatEfficiencyValue(metric('avg_efficiency'))}</strong><span className="r-metric-unit">{getEfficiencyUnitLabel()}</span></div>
          </Link>
        } />
        <aside className="r-activity-rail" aria-label="Mileage and recent activity">
          <section className="r-distance-card" aria-label="Distance summary">
            <div><span>Distance this period</span><strong>{formatMiles(metric('trip_miles'))}</strong><small>{getTimeframeLabel(state.timeframe)}</small></div>
            <div className="r-period-distance"><strong>{formatNumber(metric('total_trips'), 0)}</strong><small>Trips recorded</small></div>
          </section>
      {batch.isError && <p className="r-reading-note" role="alert">Period totals could not be loaded. <button type="button" onClick={() => void batch.refetch()}>Retry</button></p>}
      <section className="r-recent">
        <div className="r-section-heading"><h2>Recent trips</h2><Link to="/trips">All trips <ArrowUpRight /></Link></div>
        {trips.isLoading || trips.isPlaceholderData ? <p className="r-empty" role="status">Loading trips…</p>
          : trips.isError ? <p className="r-empty" role="alert">Trips could not be loaded. <button type="button" onClick={() => void trips.refetch()}>Retry</button></p>
          : !trips.data?.items?.length ? <p className="r-empty">No trips in this period.</p>
          : <div className="r-trip-list">{trips.data.items.map(trip => <Link key={trip.id} to="/trips/$tripId" params={{ tripId: trip.id }} className="r-trip-row">
            <span className="r-route-tile"><Route aria-hidden="true" /></span>
            <span className="r-trip-description"><strong>{trip.start_place || trip.start_address || 'Start'} → {trip.end_place || trip.end_address || 'Destination'}</strong>
              <small>{formatAppDateTime(trip.started_at)} · {formatDuration(trip.duration_min)}</small></span>
            <span className="r-trip-value">{formatMiles(trip.distance_mi)}<small>{formatEfficiency(trip.efficiency_wh_mi)}</small></span><ChevronRight aria-hidden="true" />
          </Link>)}</div>}
      </section>
      <section className="r-last-charge">
        <div className="r-section-heading"><h2>Last charge in this period</h2><Link to="/charging">Charging <ArrowUpRight /></Link></div>
        {charges.isError ? <p className="r-empty" role="alert">Charging history could not be loaded. <button type="button" onClick={() => void charges.refetch()}>Retry</button></p>
          : charges.isLoading || charges.isPlaceholderData ? <p className="r-empty" role="status">Loading charging history…</p>
          : !charge ? <p className="r-empty">No charging sessions in this period.</p>
          : <Link className="r-charge-summary" to="/charging/$sessionId" params={{ sessionId: charge.id }}>
            <Zap /><span><strong>{charge.location_name || 'Charging session'}</strong><small>{formatAppDateTime(charge.started_at)}</small></span>
            <span>{formatKwh(charge.energy_added_kwh)}<small>{formatCurrency(charge.cost_usd)}</small></span><ChevronRight />
          </Link>}
      </section>
      <Link className="r-dashboard-link" to="/d/$slug" params={{ slug: 'dashboard' }}>Open full dashboard <ArrowUpRight /></Link>
      </aside>
    </div>
  );
}
