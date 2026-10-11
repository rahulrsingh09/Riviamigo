import React from 'react';
import type { VehicleStatus } from '@riviamigo/types';
import { closureGeometry } from './closureGeometry';
import { doorReadings } from './doorReadings';

type Position = 'open' | 'closed' | 'unknown';
type Motion = { position: Position; value: number; from: number; target: number; started: number };
const positionValue = (position: Position) => position === 'open' ? 1 : 0;

function useOpeningMotion(key: string) {
  const slots = React.useRef<Motion[]>(key.split('|').map(position => ({
    position: position as Position, value: positionValue(position as Position),
    from: positionValue(position as Position), target: positionValue(position as Position), started: 0,
  })));
  const [values, setValues] = React.useState(() => slots.current.map(slot => slot.value));
  React.useEffect(() => {
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    let request = 0;
    const now = performance.now();
    key.split('|').forEach((value, index) => {
      const position = value as Position;
      const slot = slots.current[index]!;
      if (position === slot.position) return;
      const target = positionValue(position);
      const animate = position !== 'unknown' && slot.position !== 'unknown' && !reduced.matches && !document.hidden;
      slot.from = animate ? slot.value : target;
      slot.value = slot.from;
      slot.target = target;
      slot.started = now;
      slot.position = position;
    });
    const paint = (time: number) => {
      let moving = false;
      for (const slot of slots.current) {
        const progress = Math.min(1, (time - slot.started) / 480);
        slot.value = slot.from + (slot.target - slot.from) * (1 - Math.pow(1 - progress, 3));
        moving ||= progress < 1 && slot.from !== slot.target;
      }
      setValues(slots.current.map(slot => slot.value));
      if (moving) request = requestAnimationFrame(paint);
    };
    const settle = () => {
      if (!reduced.matches && !document.hidden) return;
      cancelAnimationFrame(request);
      for (const slot of slots.current) slot.value = slot.from = slot.target;
      setValues(slots.current.map(slot => slot.value));
    };
    paint(now);
    reduced.addEventListener('change', settle);
    document.addEventListener('visibilitychange', settle);
    return () => {
      cancelAnimationFrame(request);
      reduced.removeEventListener('change', settle);
      document.removeEventListener('visibilitychange', settle);
    };
  }, [key]);
  return values;
}

export function RVehicleOpenings({ frame, status }: { frame: number; status: VehicleStatus | null | undefined }) {
  const readings = doorReadings(status);
  const positions = readings.map(reading => reading.closed === null ? 'unknown' : reading.closed ? 'closed' : 'open');
  const values = useOpeningMotion(positions.join('|'));
  return <svg className="r-orbit-openings" viewBox="0 0 840 430" aria-hidden="true">
    {readings.map((reading, index) => {
      const progress = positions[index] === 'unknown' ? 0 : values[index]!;
      const geometry = closureGeometry(reading.id, frame, progress);
      return <g key={reading.id} data-car-closure={reading.id} data-position={positions[index]}
        data-open-progress={progress.toFixed(3)} opacity={geometry.opacity}>
        <path className="r-opening-rest" d={geometry.closed} />
        <path className="r-opening-panel" d={geometry.opened} />
        <path className="r-opening-travel" d={geometry.travel} />
      </g>;
    })}
  </svg>;
}
