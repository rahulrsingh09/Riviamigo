import React from 'react';
import { Link } from '@tanstack/react-router';
import { Lock, Unlock, ArrowUpRight } from 'lucide-react';
import { AuthenticatedVehicleArtwork, resolveVehicleArtwork } from '@riviamigo/hooks';
import type { Vehicle, VehicleStatus } from '@riviamigo/types';
import { useDocumentTheme } from '@riviamigo/ui/hooks';
import { formatMiles, formatPercent, formatPressure, formatTemp } from '@riviamigo/ui/lib/utils';
import { formatAppDateTime } from '@riviamigo/ui/lib/dateTime';
import { isConfiguredR2, vehicleReading, vehicleState } from './readings';
import { RVehicleOrbit } from './RVehicleOrbit';

export function RVehicleStage({ vehicle, status, actions, efficiency }: {
  vehicle: Vehicle; status: VehicleStatus | null | undefined; actions: React.ReactNode; efficiency: React.ReactNode;
}) {
  const [tab, setTab] = React.useState<'Energy' | 'Cabin' | 'Tires'>('Energy');
  const dark = useDocumentTheme();
  const artwork = resolveVehicleArtwork(vehicle.images, vehicle.model, 'vehicle-card');
  const configured = isConfiguredR2(vehicle);
  const battery = vehicleReading(status, 'battery_level');
  const rearLock = vehicle.model === 'R1T' ? status?.closure_tailgate_locked : status?.closure_liftgate_locked ?? status?.closure_tailgate_locked;
  const lockLabel = status?.doors_locked == null ? 'Locks pending' : status.doors_locked ? 'Locked' : 'Unlocked';
  const readings = tab === 'Energy' ? [
    ['Battery', battery == null ? '—' : formatPercent(battery), 'battery_level'],
    ['Range', formatMiles(vehicleReading(status, 'range_miles')), 'range_miles'],
  ] : tab === 'Cabin' ? [
    ['Inside', formatTemp(vehicleReading(status, 'cabin_temp_c')), 'cabin_temp_c'],
    ['Outside', formatTemp(vehicleReading(status, 'outside_temp_c')), 'outside_temp_c'],
  ] : [
    ['Front left', 'tire_fl_psi'], ['Front right', 'tire_fr_psi'], ['Rear left', 'tire_rl_psi'], ['Rear right', 'tire_rr_psi'],
  ].map(([label, field]) => [label, formatPressure(vehicleReading(status, field as keyof VehicleStatus)), field]);
  return (
    <section className="r-vehicle-stage" aria-label="Vehicle snapshot">
      <header className="r-scene-heading">
        <div><h1>{vehicle.display_name || vehicle.model}</h1><p>{[vehicle.trim, vehicle.color].filter(Boolean).join(' · ') || vehicle.model}</p>
          {vehicle.is_demo && <small>Demo vehicle · Illustrative data</small>}</div>
        <div className="r-car-status"><span>{vehicleState(status)}</span>
          <span>{status?.doors_locked ? <Lock /> : <Unlock />}{lockLabel}</span></div>
      </header>
      <div className="r-scene-controls">
      <div className="r-car-tabs" aria-label="Vehicle readings">
        <span aria-hidden="true" className="r-car-tab-marker" style={{ transform: `translateX(${['Energy', 'Cabin', 'Tires'].indexOf(tab) * 100}%)` }} />
        {(['Energy', 'Cabin', 'Tires'] as const).map(label => <button type="button" key={label} aria-pressed={tab === label} onClick={() => setTab(label)}>{label}</button>)}
      </div>
      {actions}
      </div>
      <div className="r-instrument-strip">
      <dl className={`r-car-readings ${tab === 'Tires' ? 'r-tires' : ''}`} key={tab}>
        {readings.map(([label, value, field]) => <div key={label}><dt>{label}</dt><dd>{value}</dd>
          {status?.field_availability?.[field!]?.availability === 'historical' && <small>Last known</small>}
        </div>)}
      </dl>
      {efficiency}
      </div>
      {configured ? <RVehicleOrbit key={vehicle.id} vehicleId={vehicle.id} /> : (
        <div className="r-static-car">
          <AuthenticatedVehicleArtwork source={dark ? artwork.dark ?? artwork.light : artwork.light} fallbackSource={artwork.fallback}
            alt={`${vehicle.model} vehicle artwork`} />
        </div>
      )}
      <div className="r-car-foot">
        <span title={vehicle.model === 'R1T' ? 'Tailgate lock' : 'Rear gate lock'}>
          {rearLock == null ? 'Gate lock unknown' : rearLock ? 'Gate locked' : 'Gate unlocked'}
        </span>
        <Link to="/vehicle-health">All readings <ArrowUpRight /></Link>
      </div>
      <p className="r-reading-note">{status?.last_updated ? `Snapshot ${formatAppDateTime(status.last_updated)}` : 'Waiting for a vehicle snapshot.'}
        {configured && <span> · Configured artwork: 21-inch wheels, black interior.</span>}
      </p>
    </section>
  );
}
