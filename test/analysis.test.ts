// SYNTHETIC POLICY/TRANSPORT FIXTURES ONLY. These are not real Ezio reports or model outputs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validateAnalysis } from '../server/analysis.js';
import { evaluate, renderNote, hash } from '../server/policy.js';
import { createApp } from '../server/app.js';
import { analyzeReport } from '../server/provider.js';
import type { Mission } from '../shared/types.js';
const report = 'SYNTHETIC TEST ONLY. Alpha is one. Beta is two. Checks passed. Citations checked. Source A.';
function fixture(): any { return {
  claims: [{ id: 'c1', text: 'Alpha is one.', status: 'SUPPORTED', evidenceIds: ['e1'] }, { id: 'c2', text: 'Beta is two.', status: 'SUPPORTED', evidenceIds: ['e2'] }],
  evidence: [{ id: 'e1', text: 'Alpha is one.', source: 'Source A.' }, { id: 'e2', text: 'Beta is two.' }, { id: 'e3', text: 'Checks passed.' }, { id: 'e4', text: 'Citations checked.' }],
  signals: [{ kind: 'FACT_CHECK', assessment: 'POSITIVE', explanation: 'Synthetic finding', evidenceIds: ['e3'] }, { kind: 'CITATIONS', assessment: 'POSITIVE', explanation: 'Synthetic finding', evidenceIds: ['e4'] }, ...['BIAS','SYCOPHANCY','UNCERTAINTY'].map(kind => ({ kind, assessment: 'UNKNOWN', explanation: 'Absent', evidenceIds: [] }))],
  issues: [], actions: [{ id: 'a1', title: 'Prepare Alpha draft', kind: 'CORRECT', claimIds: ['c1'], evidenceIds: ['e1'], dependsOn: [] }, { id: 'a2', title: 'Prepare Beta draft', kind: 'CORRECT', claimIds: ['c2'], evidenceIds: ['e2'], dependsOn: [] }],
  recommendation: 'APPROVE', justification: 'Synthetic low-stakes report summary.', useAssessment: { risk: 'LOW', rationale: 'Test summary only' }, caveats: ['Synthetic fixture, not real evidence.'], nextQuestion: 'None for this synthetic test.'
}; }
function mission(): Mission { const a = validateAnalysis(fixture(), report); const m: Mission = { id: 'test', mode: 'REAL', originalReport: report, intendedUse: 'Low stakes internal summary', importedAt: new Date().toISOString(), analysisStatus: 'READY', analysis: a, claims: structuredClone(a.claims), evidence: structuredClone(a.evidence), actions: [], gateway: { state: 'CLOSED', reason: 'test' }, events: [] }; const content = renderNote(m); m.note = { content, contentHash: hash(content), analyzedHash: hash(content), revision: 1 }; return m; }
const permit = (m: Mission, id = 'finalize') => evaluate(m).find(a => a.id === id)!.permit!;
test('synthetic structured extraction rejects invented excerpts, identifiers, cycles and absent positive signals', () => {
  assert.equal(validateAnalysis(fixture(), report.replace('Alpha is one.', 'Alpha\n is   one.')).evidence[0].state, 'VERIFIED');
  const mutations = [(f: any) => f.evidence[0].text = 'Not in report', (f: any) => f.evidence[0].source = 'Invented source', (f: any) => f.claims[0].evidenceIds = ['missing'], (f: any) => f.actions[0].dependsOn = ['a1'], (f: any) => { f.actions[0].dependsOn = ['a2']; f.actions[1].dependsOn = ['a1']; }, (f: any) => f.signals[0].evidenceIds = [], (f: any) => f.signals.pop(), (f: any) => f.evidence[1].id = 'e1'];
  mutations.forEach(mutate => { const f = fixture(); mutate(f); assert.throws(() => validateAnalysis(f, report)); });
});
test('missing critical evidence suspends only dependent actions; no dependencies is never default approval', () => {
  const m = mission(); m.evidence[0].state = 'MISSING'; assert.equal(permit(m, 'a1').status, 'SUSPENDED'); assert.equal(permit(m, 'a2').status, 'ACTIVE'); assert.equal(permit(m).status, 'SUSPENDED');
  m.analysis!.actions[1].kind = 'APPROVE'; assert.equal(permit(m, 'a2').status, 'ACTIVE');
  m.analysis!.actions[1].dependsOn = ['a1']; assert.equal(permit(m, 'a2').status, 'SUSPENDED');
  const empty = mission(); empty.analysis!.actions[0].evidenceIds = []; assert.equal(permit(empty, 'a1').status, 'SUSPENDED');
});
test('exact content, use, unknown claims, contradictions and experiments constrain finalization', () => {
  assert.equal(permit(mission()).status, 'ACTIVE');
  const m = mission(); m.mode = 'EXPERIMENT'; assert.equal(permit(m).status, 'BLOCKED');
  const research = mission(); research.analysis!.actions[0].kind = 'RESEARCH'; assert.equal(permit(research, 'a1').status, 'ACTIVE'); assert.equal(permit(research).status, 'SUSPENDED');
  const edited = mission(); edited.note!.content += '\nAn invented new assertion.'; assert.equal(permit(edited).status, 'NEEDS_HUMAN');
  const cases = [
    { change: (m: Mission) => { m.analysis!.claims[0].status = 'UNVERIFIABLE'; }, status: 'SUSPENDED' },
    { change: (m: Mission) => { m.analysis!.claims[0].status = 'DISPUTED'; }, status: 'NEEDS_HUMAN' },
    { change: (m: Mission) => { m.intendedUse = 'Medical treatment decision'; }, status: 'NEEDS_HUMAN' },
    { change: (m: Mission) => { m.analysis!.signals[0].assessment = 'UNKNOWN'; m.analysis!.signals[0].evidenceIds = []; }, status: 'SUSPENDED' },
    { change: (m: Mission) => { m.analysis!.issues.push({ id: 'i1', description: 'Explicit refusal', severity: 'BLOCK', claimIds: ['c1'], evidenceIds: ['e1'] }); }, status: 'BLOCKED' },
  ];
  for (const item of cases) { const value = mission(); item.change(value); const content = renderNote(value); value.note = { content, contentHash: hash(content), analyzedHash: hash(content), revision: 1 }; assert.equal(permit(value).status, item.status); assert.equal(permit(value, 'a1').status, 'ACTIVE'); }
  const invalid = mission(); invalid.analysis!.evidence[0].text = 'Fabricated'; assert.equal(permit(invalid).status, 'SUSPENDED');
});
test('API synthetic analyzer: real gate success, content revision refusal, invalid analysis and independent experiment denial', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'plot-twist-phase2-')); let bad = false;
  const app = createApp(directory, async () => bad ? { invalid: true } : fixture());
  await new Promise<void>(resolve => app.listen(0, '127.0.0.1', resolve)); const base = `http://127.0.0.1:${(app.address() as { port: number }).port}/api/missions`;
  const post = (path: string, data?: unknown) => fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data ?? {}) });
  try {
    const m = await (await post('', { originalReport: report, intendedUse: 'Low stakes summary test' })).json();
    assert.equal((await post(`/${m.id}/finalize`)).status, 403);
    const response = await post(`/${m.id}/analyze`); assert.equal(response.status, 200); const analyzed = await response.json(); assert.equal(analyzed.originalReport, report);
    const success = await post(`/${m.id}/finalize`); assert.equal(success.status, 200); const finalized = await success.json(); assert.match(finalized.document, /^FINAL DECISION NOTE/); assert.equal(finalized.mission.gateway.contentHash, hash(analyzed.note.content));
    const copy = await (await post(`/${m.id}/experiments`)).json(); assert.equal(copy.gateway.state, 'CLOSED'); assert.equal((await post(`/${copy.id}/finalize`, { mode: 'REAL' })).status, 403);
    assert.match(await (await fetch(base + `/${copy.id}/export`)).text(), /^EXPERIMENT REPORT — NOT FINAL/);
    const edited = await (await post(`/${m.id}/note`, { content: analyzed.note.content + '\nHuman says this is true.' })).json(); assert.equal(edited.gateway.state, 'CLOSED'); assert.equal((await post(`/${m.id}/finalize`)).status, 403);
    assert.match(await (await fetch(base + `/${m.id}/export`)).text(), /^QUESTION FOR HUMAN REVIEW — NOT FINAL/);
    // Re-evaluation reads current server evidence, never a previously ACTIVE permit.
    const stored = JSON.parse(await readFile(join(directory, `${m.id}.json`), 'utf8')); stored.note = analyzed.note; stored.evidence[0].state = 'MISSING'; await writeFile(join(directory, `${m.id}.json`), JSON.stringify(stored));
    assert.equal((await post(`/${m.id}/finalize`)).status, 403);
    bad = true; assert.equal((await post(`/${m.id}/analyze`)).status, 422); assert.equal((await post(`/${m.id}/finalize`)).status, 403);
    const failed = await (await fetch(base + `/${m.id}`)).json(); assert.equal(failed.analysisStatus, 'FAILED'); assert.equal(failed.note, undefined); assert.equal(failed.events.at(-1).type, 'GATEWAY_DECISION');
  } finally { await new Promise<void>(resolve => app.close(() => resolve())); await rm(directory, { recursive: true, force: true }); }
});
test('provider absent: explicit unavailability, no fallback', async () => {
  const original = process.env.TOKENROUTER_MODEL; delete process.env.TOKENROUTER_MODEL;
  try { await assert.rejects(analyzeReport(report, 'test'), /Analysis unavailable: provider not configured/); }
  finally { if (original !== undefined) process.env.TOKENROUTER_MODEL = original; }
});
test('synthetic provider transport: configured endpoint/model, limits, malformed output and safe errors', async (t) => {
  const keys = ['TOKENROUTER_API_KEY', 'TOKENROUTER_BASE_URL', 'TOKENROUTER_MODEL'];
  const previous = keys.map(key => process.env[key]);
  process.env.TOKENROUTER_API_KEY = 'synthetic-test-key'; process.env.TOKENROUTER_BASE_URL = 'https://synthetic.invalid/custom/v1'; process.env.TOKENROUTER_MODEL = 'synthetic-test-model';
  let mode = 'success';
  t.mock.method(globalThis, 'fetch', async (url: URL, options: RequestInit) => {
    assert.equal(url.toString(), 'https://synthetic.invalid/custom/v1/chat/completions');
    const payload = JSON.parse(options.body as string); assert.equal(payload.model, 'synthetic-test-model'); assert.equal(payload.max_completion_tokens, 6000); assert.equal(options.redirect, 'error'); assert.ok(options.signal);
    assert.equal(JSON.parse(payload.messages[1].content).originalReport, report);
    if (mode === 'http') return new Response('Secret upstream body must never be exposed', { status: 401 });
    if (mode === 'timeout') throw new DOMException('sensitive network detail', 'TimeoutError');
    if (mode === 'oversize') return new Response('x'.repeat(256001));
    if (mode === 'invalid') return new Response('invalid JSON');
    return Response.json({ choices: [{ finish_reason: mode === 'truncated' ? 'length' : 'stop', message: { content: JSON.stringify(fixture()) } }] });
  });
  try {
    assert.equal(validateAnalysis(await analyzeReport(report, 'test'), report).claims.length, 2);
    for (const [value, pattern] of [['http', /HTTP 401/], ['timeout', /timed out/], ['oversize', /too large/], ['invalid', /invalid JSON/], ['truncated', /incomplete provider response/]] as const) { mode = value; await assert.rejects(analyzeReport(report, 'test'), pattern); }
  } finally { keys.forEach((key, index) => { if (previous[index] === undefined) delete process.env[key]; else process.env[key] = previous[index]; }); t.mock.restoreAll(); }
});
