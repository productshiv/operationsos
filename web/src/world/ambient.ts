/**
 * Ambient life for the floor: stationary props in the common areas and a few roaming workers who
 * wander between them when nothing else is happening — so the office feels lived-in rather than a
 * grid of blinking progress bars. All positions are in world coordinates (see desks.ts), chosen to
 * sit in the gaps between desks so nothing overlaps a workstation.
 */

export type PropKind = 'coffee' | 'cooler' | 'plant' | 'cube';

export interface FloorProp {
  id: string;
  kind: PropKind;
  x: number;
  y: number;
  /** Optional small caption under the prop. */
  label?: string;
}

/** Break-room-ish objects tucked into the open gaps between desks. */
export const PROPS: FloorProp[] = [
  { id: 'coffee', kind: 'coffee', x: 624, y: 86, label: 'COFFEE' },
  { id: 'cooler', kind: 'cooler', x: 300, y: 84, label: 'H₂O' },
  { id: 'plant', kind: 'plant', x: 700, y: 452 },
  { id: 'cube', kind: 'cube', x: 120, y: 300, label: 'v2' },
];

/** Open floor points an agent strolls to when stepping out (near props + a few corridor spots). */
export const WAYPOINTS: Array<{ x: number; y: number }> = [
  { x: 612, y: 140 }, // by the coffee machine
  { x: 300, y: 150 }, // by the water cooler
  { x: 686, y: 430 }, // by the plant
  { x: 150, y: 330 }, // by the cube
  { x: 400, y: 300 }, // rug centre
  { x: 545, y: 345 },
  { x: 250, y: 250 },
  { x: 470, y: 175 },
];
