import React from 'react';
import { DoorOpen, X } from 'lucide-react';
import type { VehicleStatus } from '@riviamigo/types';
import { ResponsiveDialog } from '@riviamigo/ui/primitives';
import { closureReading, doorReadings } from './doorReadings';
import { RLockIcon } from './RLockIcon';

export function RDoorStatus({ status, vehicleModel }: { status: VehicleStatus | null | undefined; vehicleModel: string }) {
  const [open, setOpen] = React.useState(false);
  const titleId = React.useId();
  const readings = doorReadings(status, vehicleModel);
  const opened = readings.filter(door => door.closed === false);
  const unknown = readings.some(door => door.closed === null);
  const label = opened.length ? `${opened.length} ${opened.length === 1 ? 'closure' : 'closures'} open`
    : unknown ? 'Door status unknown' : 'Doors closed';
  const locked = closureReading(status, 'doors_locked');
  const lock = locked === null ? 'Locks unknown' : locked ? 'Locked' : 'Unlocked';
  return <>
    <button className="r-door-status" type="button" data-open={opened.length > 0 || undefined}
      aria-label={`Doors & locks: ${label}, ${lock}`} onClick={() => setOpen(true)}>
      <RLockIcon locked={locked} /><span>{lock}</span>
      {(opened.length > 0 || unknown) && <span className="r-door-open-count"><DoorOpen />{opened.length ? `${opened.length} open` : 'Position unknown'}</span>}
    </button>
    {open && <ResponsiveDialog titleId={titleId} onClose={() => setOpen(false)}>
      <section className="r-door-sheet">
        <header><div><h2 id={titleId}>Doors & locks</h2><p>{label} · {lock}</p></div>
          <button type="button" aria-label="Close door status" onClick={() => setOpen(false)}><X /></button></header>
        <svg className="r-door-diagram" viewBox="0 0 320 300" role="img" aria-label="Top view of vehicle door positions">
          <rect className="r-diagram-body" x="109" y="28" width="102" height="240" rx="34" />
          <path className="r-diagram-glass" d="M125 100 Q160 89 195 100 L193 209 Q160 220 127 209Z" />
          <path className="r-diagram-roof" d="M130 129 H190 V183 H130Z" />
          {readings.slice(0, 4).map((door, index) => {
            const right = index % 2 === 1;
            const x = right ? 210 : 110;
            const y = index < 2 ? 104 : 167;
            return <g key={door.id} data-door={door.id} data-position={door.closed === null ? 'unknown' : door.closed ? 'closed' : 'open'}
              className="r-diagram-door" style={{ transformOrigin: `${x}px ${y}px`, transform: door.closed === false ? `rotate(${right ? -48 : 48}deg)` : 'none' }}>
              <title>{door.label}: {door.closed === null ? 'Unknown' : door.closed ? 'Closed' : 'Open'}</title>
              <path d={`M${x} ${y} l${right ? 5 : -5} 8 v39 l${right ? -5 : 5} 6Z`} />
            </g>;
          })}
          {readings.slice(4).map((door, index) => <path key={door.id} data-door={door.id}
            data-position={door.closed === null ? 'unknown' : door.closed ? 'closed' : 'open'} className="r-diagram-hatch"
            d={index === 0 ? 'M127 48 Q160 35 193 48' : 'M127 248 Q160 261 193 248'}
            style={{ transform: door.closed === false ? `translateY(${index === 0 ? -18 : 18}px)` : 'none' }} />)}
          <text x="160" y="19" textAnchor="middle">FRONT</text>
        </svg>
        <dl className="r-door-list">{readings.map(door => <div key={door.id}>
          <dt>{door.label}</dt><dd data-open={door.closed === false || undefined}>
            {door.closed === null ? 'Position unknown' : door.closed ? 'Closed' : 'Open'}
            <small className="r-door-lock-reading"><RLockIcon locked={door.locked} />
              {door.locked === null ? 'Lock unknown' : door.locked ? 'Locked' : 'Unlocked'}</small>
          </dd>
        </div>)}</dl>
        <p className="r-reading-note">Positions and locks from the latest vehicle snapshot.</p>
        {vehicleModel === 'R2' && <p className="r-reading-note">The rotating car photo does not reflect door positions.</p>}
      </section>
    </ResponsiveDialog>}
  </>;
}
