import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { mkdir, readFile, rename, writeFile, readdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Mission, Event, ResearchRun } from '../shared/types.js';
import { analyzeReport, providerConfigured, ProviderError } from './provider.js';
import { validateAnalysis } from './analysis.js';
import { reevaluate, renderNote, hash, exportDocument } from './policy.js';
import { searchPages, fetchPage, researchMode, ResearchError } from './keenable.js';
const unavailable = 'A valid analysis is required before finalization.';
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
export function createApp(dataDir = resolve('data'), analyzer: (report: string, use: string) => Promise<unknown> = analyzeReport) {
  const queues = new Map<string, Promise<unknown>>();
  const path = (id: string) => { if (!/^[0-9a-f-]{36}$/.test(id)) throw new HttpError(404, 'Mission not found.'); return join(dataDir, `${id}.json`); };
  async function read(id: string): Promise<Mission> { try { return JSON.parse(await readFile(path(id), 'utf8')); } catch (e) { if ((e as NodeJS.ErrnoException).code === 'ENOENT') throw new HttpError(404, 'Mission not found.'); throw e; } }
  async function save(mission: Mission) { await mkdir(dataDir, { recursive: true }); const target = path(mission.id); const temp = `${target}.${randomUUID()}.tmp`; await writeFile(temp, JSON.stringify(mission, null, 2), { mode: 0o600 }); await rename(temp, target); }
  async function locked<T>(id: string, operation: () => Promise<T>): Promise<T> { const next = (queues.get(id) ?? Promise.resolve()).catch(() => {}).then(operation); queues.set(id, next); try { return await next; } finally { if (queues.get(id) === next) queues.delete(id); } }
  const recovered = (async () => {
    await mkdir(dataDir, { recursive: true });
    for (const file of await readdir(dataDir)) {
      if (!/^[0-9a-f-]{36}\.json$/.test(file)) continue;
      const mission = await read(file.slice(0, -5));
      let researchInterrupted = false;
      for (const run of mission.research ?? []) if (run.status === 'RUNNING') { run.status = 'FAILED'; run.error = 'Research interrupted by server restart.'; researchInterrupted = true; mission.events.push(event('RESEARCH_FAILED', run.error)); }
      if (researchInterrupted) { reevaluate(mission); await save(mission); }
      if (mission.analysisStatus === 'RUNNING') { mission.analysisStatus = 'FAILED'; mission.analysisError = 'Analysis interrupted by server restart. Please retry.'; reevaluate(mission); mission.events.push(event('ANALYSIS_FAILED', mission.analysisError)); await save(mission); }
    }
  })();
  // Keep initialization failures handled until the next request reports a safe error.
  void recovered.catch(() => {});
  return createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const send = (status: number, value: unknown) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); res.end(JSON.stringify(value)); };
    try {
      await recovered;
      const url = new URL(req.url ?? '/', 'http://localhost');
      if (req.method === 'GET' && url.pathname === '/api/health') return send(200, { status: 'ok', analysis: providerConfigured() ? 'configured' : 'Analysis unavailable: provider not configured' });
      if (req.method === 'POST' && url.pathname === '/api/missions') {
        const input = await body(req);
        if (input.mode !== undefined && input.mode !== 'REAL') throw new HttpError(400, 'Create an experiment from an existing mission.');
        const mission: Mission = { id: randomUUID(), mode: 'REAL', originalReport: field(input.originalReport, 'Report', 250_000), intendedUse: field(input.intendedUse, 'Intended use', 4000), importedAt: new Date().toISOString(), analysisStatus: 'NOT_AVAILABLE', claims: [], evidence: [], actions: [], gateway: { state: 'CLOSED', reason: unavailable }, events: [event('MISSION_IMPORTED', 'Original report and intended use saved. Ready for analysis when a provider is configured.')] };
        await save(mission); return send(201, mission);
      }
      const match = url.pathname.match(/^\/api\/missions\/([^/]+)(?:\/(events|experiments|finalize|analyze|note|export|research))?$/);
      if (match) {
        const [, id, operation] = match;
        if (req.method === 'GET' && (!operation || operation === 'events')) { const mission = await read(id); return send(200, operation ? mission.events : mission); }
        if (req.method === 'POST' && operation === 'experiments') {
          const source = await read(id);
          if (source.analysisStatus === 'RUNNING' || source.research?.some(run => run.status === 'RUNNING')) throw new HttpError(409, 'Wait for analysis or research to finish before copying.');
          if (source.mode !== 'REAL') throw new HttpError(400, 'An experiment must originate from a real mission.');
          const copy: Mission = { ...structuredClone(source), id: randomUUID(), mode: 'EXPERIMENT', sourceMissionId: source.id, gateway: { state: 'CLOSED', reason: 'Experiments can never finalize.' }, events: [event('EXPERIMENT_CREATED', 'Isolated copy created. Experiments can never finalize.')] };
          reevaluate(copy); await save(copy); return send(201, copy);
        }
        if (req.method === 'POST' && operation === 'analyze') {
          // Persist RUNNING before the network call; reads/polling remain available.
          const snapshot = await locked(id, async () => {
            const mission = await read(id);
            if (mission.analysisStatus === 'RUNNING') throw new HttpError(409, 'Analysis is already running.');
            mission.analysisStatus = 'RUNNING'; delete mission.analysisError; delete mission.analysis; delete mission.note;
            mission.claims = []; mission.evidence = []; mission.actions = []; reevaluate(mission);
            mission.events.push(event('ANALYSIS_STARTED', 'Provider analysis started. Previous content authorization cleared.'));
            await save(mission); return mission;
          });
          let result: unknown; let failure: string | undefined;
          try { result = validateAnalysis(await analyzer(snapshot.originalReport, snapshot.intendedUse), snapshot.originalReport); }
          catch (error) { failure = error instanceof ProviderError ? error.message : 'Analysis rejected: invalid structure, dependencies or report excerpts.'; }
          const mission = await locked(id, async () => {
            const current = await read(id);
            if (failure) { current.analysisStatus = 'FAILED'; current.analysisError = failure; current.events.push(event('ANALYSIS_FAILED', failure)); }
            else {
              current.analysis = result as NonNullable<Mission['analysis']>; current.analysisStatus = 'READY';
              current.claims = structuredClone(current.analysis.claims); current.evidence = structuredClone(current.analysis.evidence);
              const content = renderNote(current); current.note = { content, contentHash: hash(content), analyzedHash: hash(content), revision: 1 };
              current.events.push(event('ANALYSIS_COMPLETED', 'Structured analysis validated. Excerpts matched to the report; interpretation remains model-dependent.'));
            }
            reevaluate(current); current.events.push(event('PERMITS_EVALUATED', 'Server policy evaluated action dependencies and the exact note.'));
            await save(current); return current;
          });
          return send(failure ? 422 : 200, failure ? { error: failure, mission } : mission);
        }
        if (req.method === 'POST' && operation === 'research') {
          const input = await body(req); const query = field(input.query, 'Research query', 1000); const actionId = field(input.actionId, 'Action ID', 64);
          const result = await locked(id, async () => {
            const mission = await read(id); reevaluate(mission);
            const action = mission.actions.find(action => action.id === actionId);
            if (mission.analysisStatus !== 'READY' || action?.kind !== 'RESEARCH' || action.permit?.status !== 'ACTIVE') throw new HttpError(403, 'An ACTIVE server RESEARCH permit is required.');
            const run: ResearchRun = { id: randomUUID(), actionId, query, mode: researchMode(), at: new Date().toISOString(), analysisHash: hash(JSON.stringify(mission.analysis)), status: 'RUNNING', results: [] };
            mission.research ??= []; mission.research.push(run);
            mission.events.push(event('RESEARCH_STARTED', `Keenable search started for ${actionId} (${run.mode}).`)); await save(mission);
            try {
              run.results = await searchPages(query);
              mission.events.push(event('RESEARCH_SEARCHED', `Keenable returned ${run.results.length} eligible search results for ${actionId}.`)); await save(mission);
              if (!run.results.length) throw new ResearchError('No eligible Keenable result to fetch.');
              run.page = await fetchPage(run.results[0].url); run.status = 'COMPLETE';
              mission.events.push(event('RESEARCH_FETCHED', `Page fetched for ${actionId}. Content is UNVERIFIED; no claim or permit has been promoted.`));
            } catch (error) { run.status = 'FAILED'; run.error = error instanceof ResearchError ? error.message : 'Research failed.'; mission.events.push(event('RESEARCH_FAILED', run.error)); }
            // Collection alone does not resolve issues or change factual claim status.
            reevaluate(mission); await save(mission); return { mission, ...(run.error ? { error: run.error } : {}) };
          });
          return send(result.error ? 502 : 200, result);
        }
        if (req.method === 'POST' && operation === 'note') {
          const input = await body(req); const content = field(input.content, 'Decision note', 100000);
          const mission = await locked(id, async () => { const current = await read(id); if (current.analysisStatus !== 'READY' || !current.note) throw new HttpError(409, 'A valid analysis is required before editing.'); current.note = { ...current.note, content, contentHash: hash(content), revision: current.note.revision + 1 }; reevaluate(current); current.events.push(event('CONTENT_CHANGED', 'Decision note changed; exact-content permission re-evaluated.')); await save(current); return current; });
          return send(200, mission);
        }
        if (req.method === 'GET' && operation === 'export') {
          const mission = await read(id); reevaluate(mission);
          res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Content-Disposition': `attachment; filename="plot-twist-${mission.id}-not-final.txt"`, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
          return res.end(exportDocument(mission));
        }
        if (req.method === 'POST' && operation === 'finalize') {
          const result = await locked(id, async () => {
            const mission = await read(id); reevaluate(mission);
            const permit = mission.actions.find(action => action.kind === 'FINALIZE')!.permit!;
            const allowed = mission.mode === 'REAL' && permit.status === 'ACTIVE';
            mission.gateway = { state: allowed ? 'OPEN' : 'CLOSED', reason: permit.reason, contentHash: permit.contentHash };
            mission.events.push(event('GATEWAY_DECISION', `${allowed ? 'ALLOWED' : 'DENIED'}: ${permit.reason} Content SHA-256: ${permit.contentHash ?? 'none'}`));
            await save(mission);
            return { allowed, mission, ...(allowed ? { document: exportDocument(mission, true) } : { error: permit.reason }) };
          });
          return send(result.allowed ? 200 : 403, result);
        }
      }
      throw new HttpError(404, 'Endpoint not found.');
    } catch (error) { send(error instanceof HttpError ? error.status : 500, { error: error instanceof HttpError ? error.message : 'Storage or server error. The Gateway remains closed.' }); }
  });
}
