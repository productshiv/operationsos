import { useSyncExternalStore } from 'react';

/**
 * The floor's shared task + attention board. A tiny module-level store (subscribable, localStorage-
 * backed) so any part of the world can read it without prop-drilling:
 *
 * - **tasks** — routed work items. When a specialist files a ticket, a task is created and assigned
 *   to the Operations Manager to coordinate; each agent desk shows a badge with its open-task count.
 * - **attention** — which agents are currently blocked on the CEO (a tool paused at the approval
 *   gate). Drives the number badge on "YOU"; clicking it lists who needs you and why.
 *
 * Persisted per-browser so counts survive a reload; it is a local operational view, not the system
 * of record (the tickets themselves live in Jira).
 */

export interface Task {
  id: string;
  title: string;
  /** Agent id that raised it. */
  createdBy: string;
  /** Agent id it's routed to (the Operations Manager coordinates by default). */
  assignedTo: string;
  ts: number;
  done?: boolean;
}

export interface AttentionItem {
  agentId: string;
  /** What's awaiting the CEO, e.g. "createJiraIssue". */
  label: string;
  ts: number;
}

interface Board {
  tasks: Task[];
  attention: Record<string, AttentionItem>;
}

const KEY = 'oos.taskboard.v1';

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const isTask = (v: unknown): v is Task =>
  isObject(v) && typeof v.id === 'string' && typeof v.title === 'string' && typeof v.assignedTo === 'string';
const isAttentionItem = (v: unknown): v is AttentionItem =>
  isObject(v) && typeof v.agentId === 'string' && typeof v.label === 'string' && typeof v.ts === 'number';

function load(): Board {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      // Validate runtime shapes — valid JSON with the wrong types (e.g. `{"tasks":{}}` or
      // `{"attention":{"x":null}}`) must not slip through and crash a later `.filter`/`.sort`.
      const p = JSON.parse(raw) as unknown;
      const obj = isObject(p) ? p : {};
      const tasks = Array.isArray(obj.tasks) ? obj.tasks.filter(isTask) : [];
      const attention: Record<string, AttentionItem> = {};
      if (isObject(obj.attention)) {
        for (const [k, v] of Object.entries(obj.attention)) {
          if (isAttentionItem(v)) attention[k] = v;
        }
      }
      return { tasks, attention };
    }
  } catch {
    /* storage disabled / corrupt — start empty */
  }
  return { tasks: [], attention: {} };
}

let board: Board = load();
const subscribers = new Set<() => void>();

function commit(next: Board) {
  board = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(board));
  } catch {
    /* storage disabled — in-memory still updates for this session */
  }
  subscribers.forEach((fn) => fn());
}

function subscribe(fn: () => void) {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}

function newId() {
  try {
    return crypto.randomUUID();
  } catch {
    return `t-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  }
}

/* -------------------------------- mutations -------------------------------- */

/** Route a new task to an agent (default: the Operations Manager). */
export function addTask(input: { title: string; createdBy: string; assignedTo?: string }) {
  const task: Task = {
    id: newId(),
    title: input.title,
    createdBy: input.createdBy,
    assignedTo: input.assignedTo ?? 'handler',
    ts: Date.now(),
  };
  commit({ ...board, tasks: [task, ...board.tasks] });
}

export function resolveTask(id: string) {
  commit({ ...board, tasks: board.tasks.map((t) => (t.id === id ? { ...t, done: true } : t)) });
}

/** Mark that an agent is waiting on the CEO (a paused approval), or clear it. */
export function setAttention(agentId: string, label: string) {
  if (board.attention[agentId]?.label === label) return;
  commit({ ...board, attention: { ...board.attention, [agentId]: { agentId, label, ts: Date.now() } } });
}
export function clearAttention(agentId: string) {
  if (!board.attention[agentId]) return;
  const next = { ...board.attention };
  delete next[agentId];
  commit({ ...board, attention: next });
}

/* --------------------------------- reads ---------------------------------- */

function useBoard(): Board {
  return useSyncExternalStore(subscribe, () => board, () => board);
}

/** Open (not-done) tasks assigned to an agent — the desk badge count. */
export function useOpenTaskCount(agentId: string): number {
  const b = useBoard();
  return b.tasks.filter((t) => t.assignedTo === agentId && !t.done).length;
}

/** All open tasks, newest first (for the board panel). */
export function useOpenTasks(): Task[] {
  return useBoard().tasks.filter((t) => !t.done);
}

/** Agents currently waiting on the CEO — the "YOU" badge + its panel. */
export function useAttention(): AttentionItem[] {
  const b = useBoard();
  return Object.values(b.attention).sort((a, z) => a.ts - z.ts);
}
