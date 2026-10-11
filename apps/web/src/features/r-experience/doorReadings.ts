import type { VehicleStatus } from '@riviamigo/types';

const closures = [
  ['front-left', 'Front left door', 'door_front_left'],
  ['front-right', 'Front right door', 'door_front_right'],
  ['rear-left', 'Rear left door', 'door_rear_left'],
  ['rear-right', 'Rear right door', 'door_rear_right'],
  ['frunk', 'Frunk', 'closure_frunk'],
  ['gate', 'Rear gate', 'closure_liftgate'],
] as const;

export function closureReading(status: VehicleStatus | null | undefined, field: keyof VehicleStatus): boolean | null {
  const availability = status?.field_availability?.[field];
  if (availability?.availability === 'never_seen' || availability?.reason_code === 'invalid_sensor') return null;
  return typeof status?.[field] === 'boolean' ? status[field] as boolean : null;
}

export function doorReadings(status: VehicleStatus | null | undefined, vehicleModel = 'R2') {
  return closures.map(([id, label, prefix]) => ({
    id, label,
    closed: closureReading(status, `${id === 'gate' && vehicleModel === 'R1T' ? 'closure_tailgate' : prefix}_closed`),
    locked: closureReading(status, `${id === 'gate' && vehicleModel === 'R1T' ? 'closure_tailgate' : prefix}_locked`),
  }));
}
