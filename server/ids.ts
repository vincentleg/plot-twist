import { AsyncLocalStorage } from 'node:async_hooks';
import { createHash, randomUUID } from 'node:crypto';
// Random UUIDs by default. The public demo replays a session's actions per request, so it derives
// the same IDs from a per-session seed (see server/demo.ts).
const scope = new AsyncLocalStorage<() => string>();
export const newId = () => scope.getStore()?.() ?? randomUUID();
export function withSeededIds<T>(seed: string, run: () => Promise<T>): Promise<T> {
  let n = 0;
  return scope.run(() => { const h = createHash('sha256').update(`${seed}:${n++}`).digest('hex'); return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`; }, run);
}
