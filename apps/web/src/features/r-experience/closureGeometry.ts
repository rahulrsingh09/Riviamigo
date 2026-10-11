import { doorReadings } from './doorReadings';

export type ClosureId = ReturnType<typeof doorReadings>[number]['id'];
type Point = readonly [number, number, number];
type ScreenPoint = readonly [number, number];

const front: Point[] = [
  [-.30, -.92, 1.72], [.16, -.82, 1.72], [.82, -.98, 1.28],
  [.82, -1, .55], [-.30, -1, .58], [-.30, -.98, 1.28],
];
const rear: Point[] = [
  [-1.04, -.82, 1.72], [-.30, -.92, 1.72], [-.30, -1, .58],
  [-1.10, -1, .62], [-1.30, -1, 1.02], [-1.23, -.95, 1.28],
];
const frunk: Point[] = [[.82, -.8, 1.26], [.82, .8, 1.26], [2.15, .76, 1.12], [2.15, -.76, 1.12]];
const gate: Point[] = [[-2.12, -.8, 1.75], [-2.12, .8, 1.75], [-2.17, .95, .70], [-2.17, -.95, .70]];

function project([x, y, z]: Point, frame: number): ScreenPoint {
  const yaw = (frame - 68) * Math.PI / 36;
  const elevation = Math.PI / 36;
  return [
    420 + 140 * (-Math.sin(yaw) * x + Math.cos(yaw) * y),
    309 + 140 * (Math.sin(elevation) * (Math.cos(yaw) * x + Math.sin(yaw) * y) - Math.cos(elevation) * z),
  ];
}

function path(points: ScreenPoint[]) {
  return `${points.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(2)},${y.toFixed(2)}`).join(' ')} Z`;
}

export function closureGeometry(id: ClosureId, frame: number, progress: number) {
  const side = id.endsWith('-left') ? -1 : id.endsWith('-right') ? 1 : 0;
  const isFront = id.startsWith('front');
  const points = side ? isFront ? front : rear : id === 'frunk' ? frunk : gate;
  const hinge: Point = side ? [isFront ? .82 : -.30, side * .99, 0]
    : id === 'frunk' ? [.82, 0, 1.26] : [-2.12, 0, 1.75];
  const angle = progress * (side ? -.85 * side : id === 'frunk' ? -.65 : 1.8);
  const closed = points.map(([x, y, z]): Point => [x, side ? -side * y : y, z]);
  const opened = closed.map(([x, y, z]): Point => {
    const dx = x - hinge[0], dy = y - hinge[1], dz = z - hinge[2];
    return side
      ? [hinge[0] + dx * Math.cos(angle) - dy * Math.sin(angle), hinge[1] + dx * Math.sin(angle) + dy * Math.cos(angle), z]
      : [hinge[0] + dx * Math.cos(angle) + dz * Math.sin(angle), y, hinge[2] - dx * Math.sin(angle) + dz * Math.cos(angle)];
  });
  const yaw = (frame - 68) * Math.PI / 36;
  const facing = side ? side * Math.sin(yaw) : (id === 'frunk' ? 1 : -1) * Math.cos(yaw);
  const start = closed.map(point => project(point, frame));
  const end = opened.map(point => project(point, frame));
  const corner = start.length - 2;
  return {
    closed: path(start), opened: path(end),
    travel: `M${start[corner]!.join(',')} L${end[corner]!.join(',')}`,
    opacity: Math.min(1, Math.max(0, (facing + .08) * 5)) * Math.min(1, progress * 4),
  };
}
