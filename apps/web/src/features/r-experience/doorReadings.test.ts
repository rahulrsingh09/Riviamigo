import { describe, expect, it } from 'vitest';
import type { VehicleStatus } from '@riviamigo/types';
import { closureReading, doorReadings } from './doorReadings';

const snapshot = (fields: Partial<VehicleStatus>) => fields as VehicleStatus;
describe('door telemetry', () => {
  it('keeps opening and locking independent', () => {
    const result = doorReadings(snapshot({ door_front_left_closed: false, door_front_left_locked: true, door_front_right_closed: true, door_front_right_locked: false }));
    expect(result[0]).toMatchObject({ closed: false, locked: true });
    expect(result[1]).toMatchObject({ closed: true, locked: false });
  });
  it('does not infer a closed door from a lock or missing snapshot', () => {
    expect(doorReadings(snapshot({ doors_locked: true }))).toEqual(doorReadings(null));
    expect(doorReadings(null).every(door => door.closed === null && door.locked === null)).toBe(true);
  });
  it('rejects unavailable closure fields even when a stale value is present', () => {
    const result = doorReadings(snapshot({ door_front_left_closed: true, field_availability: {
      door_front_left_closed: { availability: 'never_seen', ever_seen: false, last_seen_at: null, latest_event_at: null, reason_code: 'never_seen' },
    } }));
    expect(result[0]!.closed).toBeNull();
  });
  it('uses the tailgate sensor for an R1T', () => {
    expect(doorReadings(snapshot({ closure_tailgate_closed: false, closure_tailgate_locked: true }), 'R1T').at(-1)).toMatchObject({ closed: false, locked: true });
  });
  it('reports all four doors, the frunk and rear gate separately', () => {
    const result = doorReadings(snapshot({ closure_frunk_closed: false, closure_liftgate_closed: false }));
    expect(result).toHaveLength(6);
    expect(result.filter(door => door.closed === false).map(door => door.id)).toEqual(['frunk', 'gate']);
  });
  it('does not promote unavailable or missing lock readings to the overall lock value', () => {
    const result = doorReadings(snapshot({
      doors_locked: true, closure_frunk_locked: true, closure_liftgate_locked: false,
      field_availability: { closure_frunk_locked: {
        availability: 'never_seen', ever_seen: false, last_seen_at: null,
        latest_event_at: null, reason_code: 'invalid_sensor',
      } },
    }));
    expect(result.map(door => door.locked)).toEqual([null, null, null, null, null, false]);
    expect(closureReading(snapshot({ doors_locked: true, field_availability: {
      doors_locked: { availability: 'never_seen', ever_seen: false, last_seen_at: null, latest_event_at: null, reason_code: 'never_seen' },
    } }), 'doors_locked')).toBeNull();
  });
});
