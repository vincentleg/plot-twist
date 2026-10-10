import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Mission, Event } from '../shared/types.js';
const unavailable = 'The permit engine is not available. Finalization is disabled.';
class HttpError extends Error { constructor(public status: number, message: string) { super(message); } }
function event(type: Event['type'], message: string): Event { return { id: randomUUID(), at: new Date().toISOString(), type, message }; }
async function body(req: IncomingMessage): Promise<Record<string, unknown>> {
  if (!req.headers['content-type']?.startsWith('application/json')) throw new HttpError(415, 'Send application/json.');
  let size = 0; const chunks: Buffer[] = [];
  for await (const chunk of req) { size += chunk.length; if (size > 1_100_000) throw new HttpError(413, 'Request is too large.'); chunks.push(chunk); }
  try { const value = JSON.parse(Buffer.concat(chunks).toString('utf8')); if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(); return value; }
  catch { throw new HttpError(400, 'Invalid JSON object.'); }
}
function field(value: unknown, name: string, limit: number): string {
  if (typeof value !== 'string' || !value.trim() || value.length > limit) throw new HttpError(400, `${name} must contain 1–${limit} characters and cannot be blank.`);
  return value;
}
export function createApp(dataDir = resolve('data')) {
  const queues = new Map<string, Promise<unknown>>();
  const path = (id: string) => { if (!/^[0-9a-f-]{36}$/.test(id)) throw new HttpError(404, 'Mission not found.'); return join(dataDir, `${id}.json`); };
  async function read(id: string): Promise<Mission> { try { return JSON.parse(await readFile(path(id), 'utf8')); } catch (e) { if ((e as NodeJS.ErrnoException).code === 'ENOENT') throw new HttpError(404, 'Mission not found.'); throw e; } }
  async function save(mission: Mission) { await mkdir(dataDir, { recursive: true }); const target = path(mission.id); const temp = `${target}.${randomUUID()}.tmp`; await writeFile(temp, JSON.stringify(mission, null, 2), { mode: 0o600 }); await rename(temp, target); }
  async function locked<T>(id: string, operation: () => Promise<T>): Promise<T> { const next = (queues.get(id) ?? Promise.resolve()).catch(() => {}).then(operation); queues.set(id, next); try { return await next; } finally { if (queues.get(id) === next) queues.delete(id); } }
  return createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const send = (status: number, value: unknown) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); res.end(JSON.stringify(value)); };
    try {
      const url = new URL(req.url ?? '/', 'http://localhost');
      if (req.method === 'GET' && url.pathname === '/api/health') return send(200, { status: 'ok', analysis: 'not_available' });
      if (req.method === 'POST' && url.pathname === '/api/missions') {
        const input = await body(req);
        if (input.mode !== undefined && input.mode !== 'REAL') throw new HttpError(400, 'Create an experiment from an existing mission.');
        const mission: Mission = { id: randomUUID(), mode: 'REAL', originalReport: field(input.originalReport, 'Report', 250_000), intendedUse: field(input.intendedUse, 'Intended use', 4000), importedAt: new Date().toISOString(), analysisStatus: 'NOT_AVAILABLE', claims: [], evidence: [], actions: [], gateway: { state: 'CLOSED', reason: unavailable }, events: [event('MISSION_IMPORTED', 'Original report and intended use saved. Analysis is not available yet.')] };
        await save(mission); return send(201, mission);
      }
      const match = url.pathname.match(/^\/api\/missions\/([^/]+)(?:\/(events|experiments|finalize))?$/);
      if (match) {
        const [, id, operation] = match;
        if (req.method === 'GET' && (!operation || operation === 'events')) { const mission = await read(id); return send(200, operation ? mission.events : mission); }
        if (req.method === 'POST' && operation === 'experiments') {
          const source = await read(id);
          if (source.mode !== 'REAL') throw new HttpError(400, 'An experiment must originate from a real mission.');
          const copy: Mission = { ...structuredClone(source), id: randomUUID(), mode: 'EXPERIMENT', sourceMissionId: source.id, gateway: { state: 'CLOSED', reason: 'Experiments can never finalize.' }, events: [event('EXPERIMENT_CREATED', 'Isolated copy created. Experiments can never finalize.')] };
          await save(copy); return send(201, copy);
        }
        if (req.method === 'POST' && operation === 'finalize') {
          const result = await locked(id, async () => { const mission = await read(id); const reason = mission.mode === 'EXPERIMENT' ? 'Experiments can never finalize.' : unavailable; mission.gateway = { state: 'CLOSED', reason }; mission.events.push(event('FINALIZATION_DENIED', reason)); await save(mission); return { error: reason, mission }; });
          return send(403, result);
        }
      }
      throw new HttpError(404, 'Endpoint not found.');
    } catch (error) { send(error instanceof HttpError ? error.status : 500, { error: error instanceof HttpError ? error.message : 'Storage or server error. The Gateway remains closed.' }); }
  });
}
