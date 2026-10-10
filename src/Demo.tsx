import { useRef, useState } from 'react';
import type { Mission, PermitStatus } from '../shared/types';
import { kindLabel, permitWord, dependsOnEvidence, type SceneFocus } from './World';
import { download } from './AnalysisPanel';

// Recorded real missions (analysis and research already run). The demo only re-reads them and calls
// the live server permission endpoints; it never calls TokenRouter or Keenable.
export const DEMO_MISSIONS = { ev: '0a1afcf5-f6d5-484d-b880-1e3eeaa7ba4e', wfh: 'e984e024-2d3c-4509-ac49-b17afffd6132' };
export type Tone = 'ok' | 'warn' | 'bad' | 'human' | 'neutral' | 'test';
export interface Item { label: string; status: string; tone: Tone; note?: string }
export interface DemoView {
  status: 'idle' | 'running' | 'paused' | 'done' | 'error';
  step: number; title: string; sentence: string; found: Item[]; why: string; next: string;
  focus?: SceneFocus; testWorld: boolean; gateway?: { text: string; tone: Tone }; exportText?: string; exportName?: string; error?: string; ending: boolean;
}
const TOTAL = 7;
const initial: DemoView = { status: 'idle', step: 0, title: 'Ready', sentence: 'Click “Run demo” to follow an AI-generated answer from report to decision.', found: [], why: 'A fluent answer, or one global trust score, is not enough to act on.', next: 'The agent will read a real Ezio report, plan actions, and ask the server for permission.', testWorld: false, ending: false };
const tone = (s?: PermitStatus): Tone => s === 'ACTIVE' ? 'ok' : s === 'SUSPENDED' ? 'warn' : s === 'BLOCKED' ? 'bad' : s === 'NEEDS_HUMAN' ? 'human' : 'neutral';
const claimWord: Record<string, [string, Tone]> = { SUPPORTED: ['Supported by Ezio’s checks', 'ok'], DISPUTED: ['Disputed', 'human'], UNVERIFIABLE: ['Not enough evidence', 'warn'], UNASSESSED: ['Not checked', 'neutral'] };
const short = (text: string, n = 90) => { const first = text.split(/(?<=\.)\s/)[0]; return first.length > n ? first.slice(0, n - 1) + '…' : first; };
const host = (url: string) => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; } };
class Cancelled extends Error {}

export function useDemo(show: (m: Mission) => void) {
  const [view, setView] = useState<DemoView>(initial);
  const ctl = useRef({ token: 0, paused: false, running: false });
  const patch = (token: number, value: Partial<DemoView>) => { if (ctl.current.token === token) setView(v => ({ ...v, ...value })); };
  async function wait(token: number, ms: number) {
    let left = ms;
    while (left > 0) { if (ctl.current.token !== token) throw new Cancelled(); if (!ctl.current.paused) left -= 100; await new Promise(r => setTimeout(r, 100)); }
    while (ctl.current.paused) { if (ctl.current.token !== token) throw new Cancelled(); await new Promise(r => setTimeout(r, 100)); }
  }
  async function api(token: number, path: string, method: 'GET' | 'POST' = 'GET', body?: unknown, text = false) {
    const response = await fetch(`/api${path}`, method === 'POST' ? { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body ?? {}) } : undefined);
    if (ctl.current.token !== token) throw new Cancelled();
    const data = text ? await response.text() : await response.json();
    return { ok: response.ok, status: response.status, data };
  }
  async function load(token: number, id: string, name: string): Promise<Mission> {
    const r = await api(token, `/missions/${id}`);
    if (!r.ok) throw new Error(`The recorded ${name} mission is missing on this server (${r.data?.error ?? r.status}). Nothing is invented: import it from Advanced first.`);
    if (!r.data.analysis) throw new Error(`The ${name} mission has no recorded analysis.`);
    return r.data as Mission;
  }

  async function script(token: number) {
    // 1 — Mission
    const ev = await load(token, DEMO_MISSIONS.ev, 'EV market');
    show(ev);
    patch(token, { step: 1, title: 'The mission', testWorld: false, gateway: undefined, exportText: undefined, ending: false, focus: { kind: 'scout' },
      sentence: 'An analyst wants to use an AI-generated EV market summary in a client briefing.',
      found: [{ label: 'Declared use', status: 'Client briefing', tone: 'neutral', note: short(ev.intendedUse, 160) }],
      why: 'The same answer can be fine for a chat and unsafe for a client. The use decides how strict we are.',
      next: 'Scout reads Ezio’s trust report on this answer, claim by claim.' });
    await wait(token, 9000);

    // 2 — Ezio report
    const a = ev.analysis!;
    const order = ['DISPUTED', 'UNVERIFIABLE', 'SUPPORTED', 'UNASSESSED'];
    const claims = [...ev.claims].sort((x, y) => order.indexOf(x.status) - order.indexOf(y.status));
    const counts = order.map(s => `${ev.claims.filter(c => c.status === s).length} ${claimWord[s][0].toLowerCase()}`).join(' · ');
    const flagged = ev.claims.filter(c => c.status === 'DISPUTED' || c.status === 'UNVERIFIABLE');
    patch(token, { step: 2, title: 'What the Ezio report says', focus: { kind: 'evidence', ids: flagged.flatMap(c => c.evidenceIds).slice(0, 4) },
      sentence: 'Some statements are supported. Others are disputed or lack evidence.',
      found: claims.slice(0, 5).map(c => ({ label: short(c.text, 70), status: claimWord[c.status][0], tone: claimWord[c.status][1] })).concat([{ label: 'All claims', status: counts, tone: 'neutral' }]),
      why: 'Each crystal is the exact passage of the report behind a claim. It shows where Ezio says it — not that the claim is true.',
      next: `The agent plans work: ${a.actions.map(x => kindLabel[x.kind] ?? x.kind).join(', ').toLowerCase()}.` });
    await wait(token, 6500);
    patch(token, { focus: { kind: 'action', ids: ev.actions.filter(x => x.kind !== 'FINALIZE').map(x => x.id) },
      found: ev.actions.filter(x => x.kind !== 'FINALIZE').map(x => ({ label: `${kindLabel[x.kind] ?? x.kind}: ${short(x.title, 70)}`, status: permitWord[x.permit!.status], tone: tone(x.permit?.status) })),
      why: 'Green work actions mean “allowed to start this work”. They do NOT mean the document is approved.' });
    await wait(token, 6500);

    // 3 — Recorded investigation
    const run = [...(ev.research ?? [])].reverse().find(r => r.status === 'COMPLETE' && r.assessments?.length);
    if (run) {
      const claim = ev.claims.find(c => c.id === run.claimId);
      const anyInsufficient = run.assessments!.some(x => x.stance !== 'SUPPORTS');
      patch(token, { step: 3, title: 'Recorded investigation', focus: { kind: 'source' },
        sentence: anyInsufficient ? 'A source can look relevant and still fail to support this claim.' : 'A recorded source supports this claim — as a candidate, not as proof.',
        found: ([{ label: 'Claim investigated', status: claim ? claimWord[claim.status][0] : '', tone: 'neutral', note: claim ? short(claim.text, 120) : run.query }] as Item[])
          .concat(run.assessments!.map(x => ({ label: `${host(x.url)} · published ${x.publishedAt?.slice(0, 4) ?? 'date unknown'}`, status: x.stance === 'SUPPORTS' ? 'Candidate support' : x.stance === 'CONTRADICTS' ? 'Contradicts' : 'Not sufficient', tone: (x.stance === 'SUPPORTS' ? 'ok' : x.stance === 'CONTRADICTS' ? 'human' : 'warn') as Tone, note: short(x.rationale, 170) }))),
        why: 'Recorded research from an actual Keenable run. The quote must be in the page, about the same entity, year and scope.',
        next: 'Now the plot twist: what if one piece of evidence disappears?' });
      await wait(token, 11000);
    }

    // 4 — Experiment (real copy, real mask, real re-evaluation)
    patch(token, { step: 4, title: 'Plot twist — a test world', testWorld: true, focus: { kind: 'overview' }, sentence: 'Creating an isolated copy on the server…', found: [], why: 'Experiments never touch the original mission.', next: 'Remove one piece of evidence.' });
    const copyR = await api(token, `/missions/${ev.id}/experiments`, 'POST');
    if (!copyR.ok) throw new Error(`Could not create the test world: ${copyR.data?.error ?? copyR.status}`);
    const copy = copyR.data as Mission; show(copy);
    const plan = copy.actions.filter(x => x.kind !== 'FINALIZE');
    // Choose an excerpt from the real dependencies: affects some actions but not all, if possible.
    const scored = copy.evidence.map(e => ({ e, n: plan.filter(x => dependsOnEvidence(copy, x, e.id)).length })).filter(x => x.n > 0);
    const pick = (scored.filter(x => x.n < plan.length).sort((x, y) => y.n - x.n)[0] ?? scored[0])?.e;
    if (!pick) throw new Error('No excerpt in this mission is linked to an action; nothing to mask.');
    const owner = copy.claims.find(c => c.evidenceIds.includes(pick.id));
    patch(token, { focus: { kind: 'evidence', ids: [pick.id], links: true }, sentence: 'Remove one piece of evidence. Only dependent permissions are affected.',
      found: [{ label: 'Evidence to remove', status: owner ? short(owner.text, 60) : 'Report excerpt', tone: 'test', note: `“${short(pick.text, 120)}”` }],
      why: 'The lines show which actions rely on this passage.' });
    await wait(token, 5000);
    const before = new Map(plan.map(x => [x.id, x.permit?.status]));
    const maskR = await api(token, `/missions/${copy.id}/mask`, 'POST', { evidenceId: pick.id, masked: true });
    if (!maskR.ok) throw new Error(`The server refused the mask: ${maskR.data?.error ?? maskR.status}`);
    const masked = maskR.data as Mission; show(masked);
    const after = masked.actions.filter(x => x.kind !== 'FINALIZE');
    const stopped = after.filter(x => x.permit?.status !== 'ACTIVE' && before.get(x.id) === 'ACTIVE');
    patch(token, { focus: stopped.length ? { kind: 'action', ids: stopped.map(x => x.id) } : { kind: 'overview' },
      sentence: stopped.length < after.length ? 'Only the dependent actions stop. Independent work stays allowed.' : 'Every planned action relied on this passage, so all of them stop.',
      found: after.map(x => ({ label: kindLabel[x.kind] ?? x.kind, status: `${permitWord[before.get(x.id) ?? 'SUSPENDED']} → ${permitWord[x.permit!.status]}`, tone: tone(x.permit?.status), note: before.get(x.id) !== x.permit?.status ? x.permit?.reason : 'Unchanged — does not depend on this passage.' })),
      why: 'These permits were recalculated by the server, not by the animation.' });
    await wait(token, 8000);
    patch(token, { focus: { kind: 'gateway' }, sentence: 'Can a test world produce a final document?', gateway: { text: 'Checking permission…', tone: 'neutral' } });
    const expFinal = await api(token, `/missions/${copy.id}/finalize`, 'POST').catch(() => null);
    patch(token, { gateway: expFinal && !expFinal.ok ? { text: `Refused: ${expFinal.data?.error ?? 'closed'}`, tone: 'bad' } : { text: 'Check unavailable — Gateway remains closed', tone: 'bad' }, sentence: 'No. The server refuses to finalize anything from an experiment.' });
    if (expFinal?.data?.mission) show(expFinal.data.mission);
    await wait(token, 4500);
    const resetR = await api(token, `/missions/${copy.id}/reset`, 'POST');
    if (resetR.ok) show(resetR.data);
    patch(token, { sentence: resetR.ok ? 'Reset: the passage is restored and permits are re-evaluated. Back to the original mission.' : 'Reset failed; the original mission is unaffected either way.' });
    await wait(token, 3500);

    // 5 — Gateway on the original
    const original = await load(token, DEMO_MISSIONS.ev, 'EV market'); show(original);
    patch(token, { step: 5, title: 'The Gateway', testWorld: false, focus: { kind: 'gateway' }, found: [], gateway: { text: 'Checking permission…', tone: 'neutral' },
      sentence: 'The server checks the document before allowing a final version.', why: 'It reloads the mission and re-checks the exact text, its evidence and every open question.', next: 'Waiting for the server…' });
    let final: { ok: boolean; data: any } | null = null;
    try { final = await api(token, `/missions/${original.id}/finalize`, 'POST'); } catch (e) { if (e instanceof Cancelled) throw e; final = null; }
    if (!final) patch(token, { gateway: { text: 'Check unavailable — Gateway remains closed', tone: 'bad' } });
    else {
      if (final.data?.mission) show(final.data.mission);
      const permit = (final.data?.mission as Mission | undefined)?.actions.find(x => x.kind === 'FINALIZE')?.permit;
      patch(token, { gateway: final.ok ? { text: 'Authorized by the server for this exact text.', tone: 'ok' } : { text: `Not authorized — ${permitWord[permit?.status ?? 'SUSPENDED']}`, tone: tone(permit?.status) },
        sentence: final.ok ? 'The server authorized this exact document.' : 'Scout stops at the Gateway. The final version is not allowed yet.',
        found: [{ label: 'Server decision', status: final.ok ? 'Final version allowed' : 'Final version refused', tone: final.ok ? 'ok' : tone(permit?.status), note: final.data?.error ?? '' }, { label: 'Question for the analyst', status: 'Open', tone: 'human', note: original.analysis!.nextQuestion }],
        why: 'A refusal with a reason is a valid result: it says exactly what must happen first.', next: 'Same engine, different report.' });
    }
    await wait(token, 9000);

    // 6 — Second report
    const wfh = await load(token, DEMO_MISSIONS.wfh, 'Work from home'); show(wfh);
    const w = wfh.analysis!; const bias = w.signals.find(s => s.kind === 'BIAS');
    const notScored = /Accuracy:\s*Not scored/i.test(wfh.originalReport);
    const reviews = wfh.humanReviews ?? []; const review = reviews.at(-1);
    const wfinal = wfh.actions.find(x => x.kind === 'FINALIZE')?.permit;
    const human = wfh.actions.find(x => x.kind === 'REQUEST_HUMAN');
    patch(token, { step: 6, title: 'A different report', gateway: wfinal ? { text: `Not authorized — ${permitWord[wfinal.status]}`, tone: tone(wfinal.status) } : undefined, focus: { kind: 'overview' },
      sentence: 'A communication lead wants to publish an article on remote work as a balanced analysis.',
      found: [
        ...(bias ? [{ label: 'Framing bias (Ezio: CRITICAL)', status: bias.assessment === 'CONCERN' ? 'Concern' : bias.assessment, tone: (bias.assessment === 'CONCERN' ? 'bad' : 'neutral') as Tone, note: short(bias.explanation, 150) }] : []),
        ...(notScored ? [{ label: 'Accuracy', status: 'Not evaluated', tone: 'neutral' as Tone, note: 'Ezio says “Not scored”: too few checkable claims. Not evaluated is not zero.' }] : []),
        { label: 'Claims', status: ['SUPPORTED', 'UNVERIFIABLE', 'UNASSESSED'].map(s => `${wfh.claims.filter(c => c.status === s).length} ${claimWord[s][0].toLowerCase()}`).join(' · '), tone: 'warn', note: 'Missing evidence is unknown, not false.' },
      ], why: 'The problem here is one-sided framing and thin evidence, not a wrong number.', next: 'A person is needed for the editorial judgment.' });
    await wait(token, 9000);
    patch(token, { focus: human ? { kind: 'action', ids: [human.id] } : { kind: 'gateway' },
      sentence: 'Human review can address editorial concerns. It does not create missing evidence.',
      found: review ? [{ label: `Recorded review · ${review.reviewer}`, status: review.decision === 'ACCEPT_QUALIFIED' ? 'Accepts a qualified rewrite' : review.decision === 'REFUSE' ? 'Refuses' : 'Requires changes', tone: 'human', note: review.comment },
        { label: 'Effect after re-evaluation', status: wfinal ? permitWord[wfinal.status] : '—', tone: tone(wfinal?.status), note: wfinal?.reason }] : [{ label: 'Human review', status: 'None recorded on this mission', tone: 'neutral' }],
      why: 'A person’s judgment is recorded and re-checked by the server — but it is never counted as evidence.', next: 'What does the user actually receive?' });
    await wait(token, 10000);

    // 7 — Useful result
    patch(token, { step: 7, title: 'The useful result', focus: { kind: 'gateway' }, sentence: 'Fetching the real export from the server…' });
    const exp = await api(token, `/missions/${wfh.id}/export`, 'GET', undefined, true);
    if (!exp.ok) throw new Error('The export could not be retrieved.');
    const text = exp.data as string; const lines = text.split('\n');
    const section = (title: string) => { const i = lines.findIndex(l => l.startsWith(title)); if (i < 0) return []; const out: string[] = []; for (const l of lines.slice(i + 1)) { if (!l.trim()) break; out.push(l); } return out; };
    const unknown = section('Unknown — not evaluated or lacking evidence');
    patch(token, { exportText: text, exportName: `plot-twist-${wfh.id}-not-final.txt`,
      sentence: `Not a fake approval: a ${lines[0].replace(' — NOT FINAL', '').toLowerCase()}, clearly marked NOT FINAL.`,
      found: [{ label: 'Status', status: 'Not final', tone: 'warn', note: lines[0] }, { label: 'Why it is not final', status: '', tone: 'neutral', note: (lines.find(l => l.startsWith('Gateway:')) ?? '').replace('Gateway: ', '') },
        ...unknown.slice(0, 3).map(l => ({ label: 'Kept as unknown', status: '', tone: 'neutral' as Tone, note: short(l.replace(/^- /, '').replace(/^\[c\d+\]\s*/, ''), 120) })),
        { label: 'Next action requested', status: '', tone: 'human', note: section('Next question')[0] ?? w.nextQuestion }],
      why: 'The user gets what can be said, what cannot, and what must happen next.', next: 'Download the result below.' });
    await wait(token, 11000);
    patch(token, { ending: true, status: 'done', focus: { kind: 'overview' } });
  }

  async function run() {
    if (ctl.current.running) return;
    const token = ++ctl.current.token; ctl.current.paused = false; ctl.current.running = true;
    setView({ ...initial, status: 'running', sentence: 'Loading the recorded missions…' });
    try { await script(token); }
    catch (e) { if (!(e instanceof Cancelled) && ctl.current.token === token) setView(v => ({ ...v, status: 'error', error: (e as Error).message || 'The demo could not continue.', gateway: v.gateway?.text === 'Checking permission…' ? { text: 'Check unavailable — Gateway remains closed', tone: 'bad' } : v.gateway })); }
    finally { if (ctl.current.token === token) ctl.current.running = false; }
  }
  function toggle() {
    if (view.status === 'running') { ctl.current.paused = true; setView(v => ({ ...v, status: 'paused' })); }
    else if (view.status === 'paused') { ctl.current.paused = false; setView(v => ({ ...v, status: 'running' })); }
    else void run();
  }
  function restart() { ctl.current.token++; ctl.current.running = false; ctl.current.paused = false; void run(); }
  const save = () => { if (view.exportText) download(view.exportText, view.exportName ?? 'plot-twist-result.txt'); };
  return { view, toggle, restart, save, total: TOTAL };
}

export function DemoPanel({ view, total }: { view: DemoView; total: number }) {
  return <aside className="demo-panel" aria-live="polite">
    <div className="demo-step">{view.step ? `Step ${view.step} of ${total}` : 'Guided demo'} · <b>{view.title}</b></div>
    <p className="demo-sentence">{view.sentence}</p>
    {view.error && <div className="demo-error" role="alert"><b>The demo stopped.</b> {view.error}<br />Click “Run demo” to try again.</div>}
    {!!view.found.length && <section><h3>What the agent found</h3><ul className="demo-items">{view.found.map((item, i) => <li key={i} className={`tone-${item.tone}`}><div><span>{item.label}</span>{item.status && <b>{item.status}</b>}</div>{item.note && <small>{item.note}</small>}</li>)}</ul></section>}
    <section><h3>Why it matters</h3><p>{view.why}</p></section>
    <section><h3>What happens next</h3><p>{view.next}</p></section>
    {view.exportText && <details className="demo-export"><summary>Preview the exported document</summary><pre>{view.exportText.slice(0, 2500)}</pre></details>}
  </aside>;
}
