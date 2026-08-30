export const WORLD_W = 980;
export const WORLD_H = 580;

export type DeskKind = 'agent' | 'door' | 'hr';
export type Activity = 'bars' | 'cursor';

export interface Desk {
  id: string;
  name: string;
  plate: string;
  x: number;
  y: number;
  w: number;
  h: number;
  kind: DeskKind;
  stat?: string;
  act?: Activity;
  flag?: boolean;
}

/**
 * The office floor plan, in world coordinates. Desks double as collision solids, so keep a
 * walkable corridor between them. Agents sit behind their screens; doors are locked (roadmap).
 */
export const DESKS: Desk[] = [
  { id: 'analyst', name: 'DATA ANALYST', plate: 'DATA ANALYST', x: 66, y: 74, w: 180, h: 104, kind: 'agent', stat: 'query running…', act: 'bars' },
  { id: 'scout', name: 'MARKET RESEARCH', plate: 'MARKET RESEARCH', x: 396, y: 62, w: 184, h: 104, kind: 'agent', stat: 'researching market', act: 'cursor' },
  { id: 'handler', name: 'OPERATIONS MANAGER', plate: 'OPERATIONS MANAGER', x: 730, y: 74, w: 200, h: 104, kind: 'agent', stat: 'routing OP-4471', act: 'cursor' },
  { id: 'medic', name: 'SUPPORT LEAD', plate: 'SUPPORT LEAD', x: 748, y: 296, w: 182, h: 104, kind: 'agent', stat: 'triaging tickets', act: 'bars' },
  { id: 'watch', name: 'INCIDENT RESPONSE', plate: 'INCIDENT RESPONSE', x: 738, y: 444, w: 192, h: 104, kind: 'agent', stat: 'systems nominal', act: 'cursor' },
  { id: 'sales', name: '', plate: 'SALES · v2', x: 300, y: 452, w: 120, h: 74, kind: 'door' },
  { id: 'pm', name: '', plate: 'PM · v2', x: 470, y: 452, w: 120, h: 74, kind: 'door' },
  { id: 'hr', name: 'HR', plate: 'HR ROOM', x: 66, y: 250, w: 150, h: 96, kind: 'hr' },
];

/**
 * Where everyone stands when the CEO calls a floor party. The rug is the dance floor; these sit below
 * the bar (which runs along its top, y≈216–256) and leave room for the shared step routine, which
 * travels ±20px horizontally.
 */
export const DANCE_SPOTS: Array<{ x: number; y: number }> = [
  { x: 355, y: 288 },
  { x: 435, y: 332 },
  { x: 510, y: 288 },
  { x: 590, y: 332 },
  { x: 395, y: 366 },
  { x: 550, y: 366 },
];
