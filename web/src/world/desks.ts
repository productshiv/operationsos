export const WORLD_W = 980;
export const WORLD_H = 580;

export type DeskKind = 'agent' | 'inbox' | 'door';
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
  { id: 'analyst', name: 'ANALYST.rpt', plate: 'ANALYST', x: 66, y: 78, w: 172, h: 96, kind: 'agent', stat: 'query running…', act: 'bars' },
  { id: 'scout', name: 'SCOUT.crm', plate: 'SCOUT', x: 404, y: 66, w: 168, h: 92, kind: 'agent', stat: 'profile → CRM', act: 'cursor' },
  { id: 'handler', name: 'HANDLER.op', plate: 'HANDLER', x: 748, y: 78, w: 176, h: 96, kind: 'agent', stat: 'coordinating OP-4471', act: 'cursor', flag: true },
  { id: 'medic', name: 'MEDIC.tix', plate: 'MEDIC', x: 770, y: 300, w: 158, h: 92, kind: 'agent', stat: '2 tickets open', act: 'bars' },
  { id: 'watch', name: 'WATCH.mon', plate: 'WATCH', x: 770, y: 448, w: 158, h: 92, kind: 'agent', stat: 'systems nominal', act: 'cursor' },
  { id: 'inbox', name: 'INBOX', plate: 'YOUR BOX', x: 64, y: 430, w: 170, h: 110, kind: 'inbox' },
  { id: 'sales', name: '', plate: 'SALES · v2', x: 300, y: 452, w: 120, h: 74, kind: 'door' },
  { id: 'pm', name: '', plate: 'PM · v2', x: 470, y: 452, w: 120, h: 74, kind: 'door' },
];
