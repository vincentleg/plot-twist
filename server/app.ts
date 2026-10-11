import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { mkdir, readFile, rename, writeFile, readdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { newId } from './ids.js';
import type { Mission, Event, ResearchRun, HumanReview, Revision } from '../shared/types.js';
import { analyzeReport, providerConfigured, ProviderError } from './provider.js';
import { validateAnalysis } from './analysis.js';
import { reevaluate, renderNote, hash, exportDocument, analysisHash } from './policy.js';
import { createRevision, evaluateRevision, revisionPdf } from './revision.js';
import { searchPages, fetchPage, researchMode, ResearchError, assessSource } from './keenable.js';
const unavailable = 'A valid analysis is required before finalization.';
class HttpError extends Error { constructor(public status: number, message: string) { super(message); } }
function event(type: Event['type'], message: string): Event { return { id: newId(), at: new Date().toISOString(), type, message }; }
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
export function createHandler(dataDir = resolve('data'), analyzer: (report: string, use: string) => Promise<unknown> = analyzeReport) {
  const queues = new Map<string, Promise<unknown>>();
  const path = (id: string) => { if (!/^[0-9a-f-]{36}$/.test(id)) throw new HttpError(404, 'Mission not found.'); return join(dataDir, `${id}.json`); };
  async function read(id: string): Promise<Mission> { try { return JSON.parse(await readFile(path(id), 'utf8')); } catch (e) { if ((e as NodeJS.ErrnoException).code === 'ENOENT') throw new HttpError(404, 'Mission not found.'); throw e; } }
  async function save(mission: Mission) { await mkdir(dataDir, { recursive: true }); const target = path(mission.id); const temp = `${target}.${newId()}.tmp`; await writeFile(temp, JSON.stringify(mission, null, 2), { mode: 0o600 }); await rename(temp, target); }
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
  return async (req: IncomingMessage, res: ServerResponse) => {
    const send = (status: number, value: unknown) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); res.end(JSON.stringify(value)); };
    try {
      await recovered;
      const url = new URL(req.url ?? '/', 'http://localhost');
      if (req.method === 'GET' && url.pathname === '/api/health') return send(200, { status: 'ok', analysis: providerConfigured() ? 'configured' : 'Analysis unavailable: provider not configured' });
      // Local real report exports (ignored by Git). Declared uses are the user's briefs; no verdicts are stored.
      if (req.method === 'GET' && url.pathname === '/api/samples') {
        const samples = [
          { id: 'ev-market', title: 'EV market 2024', intendedUse: 'An analyst decides whether this 2024 EV market summary can go into a note for a client. Examine the inconsistent Geely flag (contested and cited figures identical: keep the original verdict, check entity, year and scope), the unverified Top 3 ranking (not shown false) and the unassessed claims. Validation of the heading does not validate the whole text. Do not approve the whole text automatically.' },
          { id: 'work-from-home', title: 'Work from home', intendedUse: 'A communication lead decides whether this article can be published as a balanced analysis of working models. Accuracy "Not scored" means not evaluated, never zero. One claim is Supported, four lack evidence (unverified, not false). The CRITICAL framing bias calls for editorial revision and targeted human review for this use; it does not show that all claims are false.' },
        ];
        const available = [];
        for (const sample of samples) { try { available.push({ ...sample, report: await readFile(join(dataDir, 'reports', `${sample.id}.md`), 'utf8') }); } catch { /* not present locally */ } }
        return send(200, available);
      }
      if (req.method === 'POST' && url.pathname === '/api/missions') {
        const input = await body(req);
        if (input.mode !== undefined && input.mode !== 'REAL') throw new HttpError(400, 'Create an experiment from an existing mission.');
        const mission: Mission = { id: newId(), mode: 'REAL', originalReport: field(input.originalReport, 'Report', 250_000), intendedUse: field(input.intendedUse, 'Intended use', 4000), importedAt: new Date().toISOString(), analysisStatus: 'NOT_AVAILABLE', claims: [], evidence: [], actions: [], gateway: { state: 'CLOSED', reason: unavailable }, events: [event('MISSION_IMPORTED', 'Original report and intended use saved. Ready for analysis when a provider is configured.')] };
        await save(mission); return send(201, mission);
      }
      const rev = url.pathname.match(/^\/api\/missions\/([^/]+)\/revisions(?:\/([0-9a-f-]{36})(?:\/(review|finalize|pdf))?)?$/);
      if (rev) {
        const [, id, rid, op] = rev;
        const find = (m: Mission): Revision => { const r = m.revisions?.find(x => x.id === rid); if (!r) throw new HttpError(404, 'Revision not found.'); return r; };
        const refresh = (m: Mission, r: Revision) => { const e = evaluateRevision(m, r); r.permit = e.permit; r.humanReasons = e.humanReasons; return e.permit; };
        if (req.method === 'POST' && !rid) {
          const result = await locked(id, async () => {
            const m = await read(id);
            if (m.mode !== 'REAL') throw new HttpError(403, 'Experiments can never produce a finalizable revision.');
            if (m.analysisStatus !== 'READY' || !m.analysis) throw new HttpError(409, 'A valid analysis is required.');
            const r = createRevision(m); refresh(m, r); m.revisions ??= []; m.revisions.push(r);
            m.events.push(event('REVISION_CREATED', `Revision ${r.id.slice(0, 8)}: kept ${r.keptClaimIds.length}, removed ${r.removed.length}. Permit ${r.permit!.status}: ${r.permit!.reason}`));
            await save(m); return { mission: m, revision: r };
          });
          return send(201, result);
        }
        if (req.method === 'POST' && op === 'review') {
          const input = await body(req); const decision = input.decision;
          if (decision !== 'ACCEPT_LIMITED_USE' && decision !== 'DECLINE') throw new HttpError(400, 'Decision must be ACCEPT_LIMITED_USE or DECLINE.');
          const reviewer = field(input.reviewer, 'Reviewer role', 120); const comment = typeof input.comment === 'string' ? input.comment.slice(0, 2000) : '';
          const result = await locked(id, async () => {
            const m = await read(id); const r = find(m);
            r.reviews.push({ at: new Date().toISOString(), reviewer, decision, comment, acceptedUse: r.proposedUse, contentHash: r.contentHash });
            refresh(m, r); m.events.push(event('REVISION_REVIEWED', `${reviewer}: ${decision} on revision ${r.id.slice(0, 8)} (human judgment, not evidence). Permit ${r.permit!.status}.`));
            await save(m); return { mission: m, revision: r };
          });
          return send(200, result);
        }
        if (req.method === 'POST' && op === 'finalize') {
          const result = await locked(id, async () => {
            const m = await read(id); const r = find(m); const permit = refresh(m, r);
            const allowed = m.mode === 'REAL' && permit.status === 'ACTIVE';
            if (allowed) r.finalized = { at: new Date().toISOString(), contentHash: r.contentHash };
            m.events.push(event('GATEWAY_DECISION', `${allowed ? 'ALLOWED' : 'DENIED'} revision ${r.id.slice(0, 8)}: ${permit.reason} Content SHA-256: ${r.contentHash}`));
            await save(m); return { allowed, mission: m, revision: r, ...(allowed ? {} : { error: permit.reason }) };
          });
          return send(result.allowed ? 200 : 403, result);
        }
        if (req.method === 'GET' && op === 'pdf') {
          const m = await read(id); const r = find(m); const { file, approved } = revisionPdf(m, r);
          res.writeHead(200, { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="plot-twist-revision-${r.id.slice(0, 8)}-${approved ? 'approved' : 'DRAFT'}.pdf"`, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
          return res.end(file);
        }
      }
      const match = url.pathname.match(/^\/api\/missions\/([^/]+)(?:\/(events|experiments|finalize|analyze|note|export|research|human|mask|reset))?$/);
      if (match) {
        const [, id, operation] = match;
        if (req.method === 'GET' && (!operation || operation === 'events')) { const mission = await read(id); return send(200, operation ? mission.events : mission); }
        if (req.method === 'POST' && operation === 'experiments') {
          const source = await read(id);
          if (source.analysisStatus === 'RUNNING' || source.research?.some(run => run.status === 'RUNNING')) throw new HttpError(409, 'Wait for analysis or research to finish before copying.');
          if (source.mode !== 'REAL') throw new HttpError(400, 'An experiment must originate from a real mission.');
          const copy: Mission = { ...structuredClone(source), id: newId(), mode: 'EXPERIMENT', sourceMissionId: source.id, gateway: { state: 'CLOSED', reason: 'Experiments can never finalize.' }, events: [event('EXPERIMENT_CREATED', 'Isolated copy created. Experiments can never finalize.')] };
          reevaluate(copy); await save(copy); return send(201, copy);
        }
        if (req.method === 'POST' && operation === 'analyze') {
          // Persist RUNNING before the network call; reads/polling remain available.
          const snapshot = await locked(id, async () => {
            const mission = await read(id);
            if (mission.analysisStatus === 'RUNNING') throw new HttpError(409, 'Analysis is already running.');
            mission.analysisStatus = 'RUNNING'; delete mission.analysisError; delete mission.analysis; delete mission.note; // Earlier human reviews become stale through analysisHash; they are kept for the audit trail.
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
          // Search and assessment run outside the lock; only short state writes are locked.
          const start = await locked(id, async () => {
            const mission = await read(id); reevaluate(mission);
            const action = mission.actions.find(action => action.id === actionId);
            if (mission.analysisStatus !== 'READY' || action?.kind !== 'RESEARCH' || action.permit?.status !== 'ACTIVE') throw new HttpError(403, 'An ACTIVE server RESEARCH permit is required.');
            const claimId = typeof input.claimId === 'string' ? input.claimId : action.claimIds[0];
            if (!action.claimIds.includes(claimId)) throw new HttpError(400, 'The claim must belong to this RESEARCH action.');
            const run: ResearchRun = { id: newId(), actionId, claimId, claimIds: [claimId], query, mode: researchMode(), at: new Date().toISOString(), analysisHash: hash(JSON.stringify(mission.analysis)), status: 'RUNNING', results: [], pages: [], assessments: [] };
            mission.research ??= []; mission.research.push(run);
            mission.events.push(event('RESEARCH_STARTED', `Keenable search started for ${claimId} via ${actionId} (${run.mode}).`)); await save(mission);
            const analyzed = /```[a-z]*\n([\s\S]*?)```/.exec(mission.originalReport)?.[1] ?? '';
            return { run, claim: mission.analysis!.claims.find(c => c.id === claimId)!.text, analyzed };
          });
          const { run, claim, analyzed } = start; const notes: Event[] = [];
          try {
            run.results = await searchPages(query);
            notes.push(event('RESEARCH_SEARCHED', `Keenable returned ${run.results.length} eligible result(s) for ${run.claimId} (max 2).`));
            if (!run.results.length) throw new ResearchError('No eligible Keenable result to fetch.');
            for (const result of run.results) {
              try { const page = await fetchPage(result.url); run.pages!.push(page); run.page ??= page; notes.push(event('RESEARCH_FETCHED', `Fetched ${page.url} (${page.content.length} chars). Content UNVERIFIED.`)); }
              catch (error) { notes.push(event('RESEARCH_FAILED', `Fetch failed for ${result.url}: ${error instanceof ResearchError ? error.message : 'error'}`)); continue; }
              try { const assessment = await assessSource(claim, run.pages!.at(-1)!, run.claimId!, result.publishedAt, analyzed); run.assessments!.push(assessment); notes.push(event('RESEARCH_ASSESSED', `${run.claimId} vs ${assessment.url}: ${assessment.stance} (quote found: ${assessment.quoteFound}; entity/period/scope: ${assessment.context.entity}/${assessment.context.period}/${assessment.context.scope}).`)); }
              catch (error) { notes.push(event('RESEARCH_FAILED', `Assessment failed for ${result.url}: ${error instanceof ProviderError ? error.message : 'error'}`)); }
            }
            if (!run.pages!.length) throw new ResearchError('No page could be fetched.');
            run.status = 'COMPLETE';
          } catch (error) { run.status = 'FAILED'; run.error = error instanceof ResearchError ? error.message : 'Research failed.'; notes.push(event('RESEARCH_FAILED', run.error)); }
          const result = await locked(id, async () => {
            const mission = await read(id); const index = (mission.research ?? []).findIndex(r => r.id === run.id);
            if (index >= 0) mission.research![index] = run; mission.events.push(...notes);
            // Assessments can escalate a contradiction; they never promote a claim to verified.
            reevaluate(mission); mission.events.push(event('PERMITS_EVALUATED', 'Permits re-evaluated after source assessment.')); await save(mission); return { mission, ...(run.error ? { error: run.error } : {}) };
          });
          return send(result.error ? 502 : 200, result);
        }
        if (req.method === 'POST' && operation === 'human') {
          const input = await body(req);
          const decision = input.decision; if (decision !== 'ACCEPT_QUALIFIED' && decision !== 'REQUIRE_CHANGES' && decision !== 'REFUSE') throw new HttpError(400, 'Decision must be ACCEPT_QUALIFIED, REQUIRE_CHANGES or REFUSE.');
          const reviewer = field(input.reviewer, 'Reviewer role', 120); const comment = field(input.comment, 'Review comment', 4000);
          const list = (value: unknown, name: string) => { if (value === undefined) return []; if (!Array.isArray(value) || value.length > 20 || value.some(v => typeof v !== 'string')) throw new HttpError(400, `${name} must be a list of IDs.`); return value as string[]; };
          const actionIds = list(input.actionIds, 'actionIds'); const issueIds = list(input.issueIds, 'issueIds'); const withdrawClaimIds = list(input.withdrawClaimIds, 'withdrawClaimIds');
          const clarifiedUse = input.clarifiedUse === undefined || input.clarifiedUse === '' ? undefined : field(input.clarifiedUse, 'Clarified use', 2000);
          const mission = await locked(id, async () => {
            const current = await read(id);
            if (current.analysisStatus !== 'READY' || !current.analysis || !current.note) throw new HttpError(409, 'A valid analysis and decision note are required before a human review.');
            if (actionIds.some(a => !current.analysis!.actions.some(x => x.id === a && x.kind === 'REQUEST_HUMAN'))) throw new HttpError(400, 'Only REQUEST_HUMAN actions can be completed by a human review.');
            if (issueIds.some(i => !current.analysis!.issues.some(x => x.id === i && x.severity === 'HUMAN'))) throw new HttpError(400, 'Only HUMAN judgment issues can be settled by a human; missing information still needs evidence.');
            if (withdrawClaimIds.some(c => !current.analysis!.claims.some(x => x.id === c))) throw new HttpError(400, 'Unknown claim to withdraw.');
            const review: HumanReview = { id: newId(), at: new Date().toISOString(), reviewer, decision, comment, actionIds, issueIds, withdrawClaimIds, ...(clarifiedUse ? { clarifiedUse } : {}), question: current.analysis.nextQuestion, analysisHash: analysisHash(current), noteHash: '' };
            current.humanReviews ??= []; current.humanReviews.push(review);
            // Scope changes regenerate the server-rendered note only if it was unedited; the review binds to the resulting exact content.
            if (hash(current.note.content) === current.note.analyzedHash) { const content = renderNote(current); if (content !== current.note.content) { current.note = { content, contentHash: hash(content), analyzedHash: hash(content), revision: current.note.revision + 1 }; current.events.push(event('CONTENT_CHANGED', 'Server regenerated the note from the human scope change; the new exact content is re-evaluated.')); } }
            review.noteHash = hash(current.note.content);
            current.events.push(event('HUMAN_REVIEW_RECORDED', `${reviewer}: ${decision}. Recorded as human judgment, not factual evidence; bound to note SHA-256 ${review.noteHash.slice(0, 12)}.`));
            reevaluate(current); current.events.push(event('PERMITS_EVALUATED', 'Server policy re-evaluated after the human review.'));
            await save(current); return current;
          });
          return send(200, mission);
        }
        if (req.method === 'POST' && (operation === 'mask' || operation === 'reset')) {
          const input = await body(req);
          const mission = await locked(id, async () => {
            const current = await read(id);
            if (current.mode !== 'EXPERIMENT') throw new HttpError(403, 'Evidence can only be masked in an isolated experiment.');
            if (current.analysisStatus !== 'READY' || !current.analysis) throw new HttpError(409, 'A valid analysis is required.');
            if (operation === 'reset') { current.evidence = structuredClone(current.analysis.evidence); current.events.push(event('EXPERIMENT_RESET', 'All excerpts restored from the validated analysis.')); }
            else {
              const evidenceId = field(input.evidenceId, 'Evidence ID', 64); const item = current.evidence.find(e => e.id === evidenceId); const original = current.analysis.evidence.find(e => e.id === evidenceId);
              if (!item || !original) throw new HttpError(404, 'Evidence not found.');
              const masked = input.masked !== false; item.state = masked ? 'MASKED' : original.state;
              current.events.push(event(masked ? 'EVIDENCE_MASKED' : 'EVIDENCE_RESTORED', `${evidenceId} ${masked ? 'masked' : 'restored'} in this experiment only.`));
            }
            reevaluate(current); current.events.push(event('PERMITS_EVALUATED', 'Dependent actions re-evaluated against the current excerpts.'));
            await save(current); return current;
          });
          return send(200, mission);
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
  };
}
export const createApp = (...args: Parameters<typeof createHandler>) => createServer(createHandler(...args));
