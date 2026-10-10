import React from 'react';
import { AuthenticatedVehicleArtwork } from '@riviamigo/hooks';
import type { Vehicle } from '@riviamigo/types';
import { isConfiguredR2 } from './readings';
import heroUrl from './assets/r2-hero.webp';

export function RHealthHero({ vehicle, name, model, vin, source, fallback, children }: {
  vehicle: Vehicle | undefined; name: string; model: string; vin: string | null | undefined;
  source: string | null | undefined; fallback: string | null | undefined; children: React.ReactNode;
}) {
  return <section className="r-health-hero">
    <div className="r-health-identity"><h2>{name}</h2><p>{model || 'Vehicle identity pending telemetry'}</p>{vin && <small>VIN {vin}</small>}</div>
    <div className="r-health-art">
      {isConfiguredR2(vehicle) ? <img src={heroUrl} alt="Catalina Cove R2 Performance" />
        : <AuthenticatedVehicleArtwork source={source} fallbackSource={fallback} alt="Vehicle three-quarter view" />}
    </div>
    <div className="r-health-summary">{children}</div>
  </section>;
}
