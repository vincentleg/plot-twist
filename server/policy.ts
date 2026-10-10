import { createHash } from 'node:crypto';
import type { Action, Mission, Permit, PermitStatus } from '../shared/types.js';
import { normalize, validateAnalysis } from './analysis.js';
export const hash = (text: string) => createHash('sha256').update(text).digest('hex');
const outcome = (status: PermitStatus, reason: string): Permit => ({ status, reason, evaluatedAt: new Date().toISOString() });
export function renderNote(mission: Mission): string {
  const a = mission.analysis!;
  const lines = (items: string[]) => items.length ? items.map(x => `- ${x}`).join('\n') : '- None identified by the model.';
  return `PLOT TWIST — Decision note\n\nIntended use\n${mission.intendedUse}\n\nModel recommendation: ${a.recommendation}\n${a.justification}\n\nUse assessment: ${a.useAssessment.risk}\n${a.useAssessment.rationale}\n\nReport-supported elements (not independently verified)\n${lines(a.claims.filter(c => c.status === 'SUPPORTED').map(c => `[${c.id}] ${c.text} [${c.evidenceIds.join(', ')}]`))}\n\nRemoved from unconditional conclusions / qualified elements\n${lines(a.claims.filter(c => c.status !== 'SUPPORTED').map(c => `[${c.id}] ${c.text} — ${c.status}; not asserted as a verified fact. [${c.evidenceIds.join(', ')}]`))}\n\nAvailable report signals\n${lines(a.signals.map(s => `${s.kind}: ${s.assessment} — ${s.explanation} [${s.evidenceIds.join(', ')}]`))}\n\nUnresolved issues\n${lines(a.issues.map(i => `${i.severity}: ${i.description}`))}\n\nReservations and uncertainty\n${lines(a.caveats)}\nExtraction and interpretation depend on the model. Matching excerpts confirms provenance only. No external research has been performed. Preparing this note does not verify unknown facts.\n\nNext question\n${a.nextQuestion}\n\nSources and exact report excerpts\n${lines(a.evidence.map(e => `[${e.id}] ${e.source ?? 'Imported report; no source label supplied'}\n  ${e.text}`))}\n`;
}
export function evaluate(mission: Mission): Action[] {
  const final: Action = { id: 'finalize', kind: 'FINALIZE', title: 'Finalize this exact decision note', claimIds: mission.claims.map(c => c.id), evidenceIds: mission.evidence.map(e => e.id), dependsOn: [], permit: null };
  let valid = mission.analysisStatus === 'READY' && !!mission.analysis;
  if (valid) { try { validateAnalysis(mission.analysis, mission.originalReport); } catch { valid = false; } }
  if (!valid) { final.permit = outcome(mission.mode === 'EXPERIMENT' ? 'BLOCKED' : 'SUSPENDED', mission.mode === 'EXPERIMENT' ? 'Experiments can never finalize.' : 'A valid analysis is required before finalization.'); return [final]; }
  const a = mission.analysis!;
  final.dependsOn = a.actions.map(action => action.id);
  const actions = a.actions.map(action => ({ ...action, permit: null as Permit | null }));
  const available = (id: string) => { const original = a.evidence.find(e => e.id === id); const current = mission.evidence.find(e => e.id === id); return !!original && !!current && current.state === 'VERIFIED' && current.text === original.text && normalize(mission.originalReport).includes(normalize(current.text)); };
  function assess(action: Action): Permit {
    if (action.permit) return action.permit;
    const dependentClaims = a.claims.filter(c => action.claimIds.includes(c.id));
    const required = [...action.evidenceIds, ...dependentClaims.flatMap(c => c.evidenceIds)];
    if (!action.claimIds.length || !action.evidenceIds.length || dependentClaims.length !== action.claimIds.length || dependentClaims.some(c => !c.evidenceIds.length)) return outcome('SUSPENDED', 'Explicit claim and report-excerpt dependencies are required.');
    if (required.some(id => !available(id))) return outcome('SUSPENDED', 'A required report excerpt is missing or masked.');
    for (const id of action.dependsOn) { const prerequisite = actions.find(x => x.id === id); if (!prerequisite) return outcome('SUSPENDED', 'A prerequisite action is missing.'); prerequisite.permit = assess(prerequisite); if (prerequisite.permit.status !== 'ACTIVE') return outcome(prerequisite.permit.status, `Prerequisite ${id}: ${prerequisite.permit.reason}`); }
    // These authorize preparation/inquiry, never execution, factual verification or finalization.
    if (action.kind === 'CORRECT' || action.kind === 'RESEARCH' || action.kind === 'REQUEST_HUMAN' || action.kind === 'BLOCK') return outcome('ACTIVE', 'Report-grounded preparation is permitted; this does not execute the action or verify its claims.');
    const upstreamKinds = (item: Action): Action['kind'][] => item.dependsOn.flatMap(id => { const parent = actions.find(a => a.id === id)!; return [parent.kind, ...upstreamKinds(parent)]; });
    const pending = upstreamKinds(action);
    if (pending.includes('BLOCK')) return outcome('BLOCKED', 'A prerequisite requests refusal.');
    if (pending.includes('REQUEST_HUMAN')) return outcome('NEEDS_HUMAN', 'The required human review is only planned, not completed.');
    if (pending.includes('RESEARCH')) return outcome('SUSPENDED', 'Required research is only planned, not completed.');
    const scopedIssues = a.issues.filter(i => !i.claimIds.length || i.claimIds.some(id => action.claimIds.includes(id)));
    if (scopedIssues.some(i => i.severity === 'BLOCK')) return outcome('BLOCKED', 'An explicit refusal issue affects these claims.');
    if (scopedIssues.some(i => i.severity === 'HUMAN') || dependentClaims.some(c => c.status === 'DISPUTED')) return outcome('NEEDS_HUMAN', 'An unresolved contradiction or judgment affects these claims.');
    if (scopedIssues.some(i => i.severity === 'MISSING') || dependentClaims.some(c => c.status !== 'SUPPORTED')) return outcome('SUSPENDED', 'Information needed to approve these claims is unresolved; unknown does not mean false.');
    return publicationChecks();
  }
  function publicationChecks(): Permit {
    // Conservative lexical floor supplements (does not replace) the model's use assessment.
    const highStakes = /\b(medical|clinical|diagnos\w*|treatment|legal|court|invest\w*|financial|safety|hiring|credit|médical\w*|diagnostic|traitement|juridique|financi\w*|sécurité|recrutement|crédit)\b/iu.test(mission.intendedUse);
    if (a.useAssessment.risk !== 'LOW' || highStakes) return outcome('NEEDS_HUMAN', 'The declared use requires human judgment or its stakes are unclear.');
    if (a.recommendation === 'BLOCK') return outcome('BLOCKED', 'The model identified a refusal recommendation; approval cannot override it.');
    if (a.recommendation === 'ESCALATE') return outcome('NEEDS_HUMAN', 'The analysis requests human judgment.');
    if (a.recommendation === 'RESEARCH' || a.recommendation === 'REWRITE') return outcome('SUSPENDED', 'The analysis requires further work; a prepared note does not complete it.');
    if (a.signals.some(s => s.assessment === 'CONCERN')) return outcome('NEEDS_HUMAN', 'A report signal raises an unresolved concern.');
    for (const kind of ['FACT_CHECK', 'CITATIONS']) { const signal = a.signals.find(s => s.kind === kind); if (!signal || signal.assessment !== 'POSITIVE' || !signal.evidenceIds.length || signal.evidenceIds.some(id => !available(id))) return outcome('SUSPENDED', 'Explicit report findings for fact checking and citation integrity are required; provenance alone is insufficient.'); }
    return outcome('ACTIVE', 'Report-grounded conditions for this use are satisfied under the model-dependent policy; no independent factual verification is claimed.');
  }
  actions.forEach(action => { action.permit = assess(action); });
  let permit: Permit;
  if (mission.mode === 'EXPERIMENT') permit = outcome('BLOCKED', 'Experiments can never finalize.');
  else if (!mission.note) permit = outcome('SUSPENDED', 'A decision note is required.');
  else if (hash(mission.note.content) !== mission.note.analyzedHash || mission.note.content !== renderNote(mission)) permit = outcome('NEEDS_HUMAN', 'The exact content changed after analysis. Re-analyze to regenerate a grounded note; edits cannot inherit approval.');
  else if (a.evidence.some(e => !available(e.id))) permit = outcome('SUSPENDED', 'A source excerpt required by this exact note is missing or masked.');
  else if (a.issues.some(i => i.severity === 'BLOCK')) permit = outcome('BLOCKED', 'An explicit unresolved refusal issue prevents finalization.');
  else if (a.issues.some(i => i.severity === 'HUMAN') || a.claims.some(c => c.status === 'DISPUTED')) permit = outcome('NEEDS_HUMAN', 'An unresolved contradiction or human judgment prevents finalization.');
  else if (a.issues.some(i => i.severity === 'MISSING') || a.claims.some(c => c.status !== 'SUPPORTED' || !c.evidenceIds.length)) permit = outcome('SUSPENDED', 'Required claim information is unresolved. A rewrite cannot verify it.');
  else if (actions.some(action => action.kind === 'BLOCK')) permit = outcome('BLOCKED', 'The plan contains an explicit refusal action.');
  else if (actions.some(action => action.kind === 'REQUEST_HUMAN')) permit = outcome('NEEDS_HUMAN', 'Required human review has not been completed.');
  else if (actions.some(action => action.kind === 'RESEARCH')) permit = outcome('SUSPENDED', 'Required research has not been performed. Authorization to prepare research is not completion.');
  else if (actions.some(action => action.permit?.status !== 'ACTIVE')) permit = outcome('SUSPENDED', 'All plan authorization conditions must be satisfied; a plan action is unresolved.');
  else permit = publicationChecks();
  final.permit = { ...permit, contentHash: mission.note ? hash(mission.note.content) : undefined };
  return [...actions, final];
}
export function reevaluate(mission: Mission) { mission.actions = evaluate(mission); const final = mission.actions.find(a => a.kind === 'FINALIZE')!; mission.gateway = { state: 'CLOSED', reason: final.permit!.reason, contentHash: final.permit?.contentHash }; }
export function exportDocument(mission: Mission, finalized = false): string {
  const permit = mission.actions.find(a => a.kind === 'FINALIZE')?.permit;
  const label = finalized ? 'FINAL DECISION NOTE' : mission.mode === 'EXPERIMENT' ? 'EXPERIMENT REPORT — NOT FINAL' : permit?.status === 'BLOCKED' ? 'REFUSAL REPORT — NOT FINAL' : permit?.status === 'NEEDS_HUMAN' ? 'QUESTION FOR HUMAN REVIEW — NOT FINAL' : 'DRAFT WITH RESERVATIONS — NOT FINAL';
  return `${label}\nMission: ${mission.id}\nMode: ${mission.mode}\nContent SHA-256: ${mission.note ? hash(mission.note.content) : 'no note'}\nGateway: ${permit?.status ?? 'SUSPENDED'} — ${permit?.reason ?? 'Analysis required.'}\n\n${mission.note?.content ?? `Intended use: ${mission.intendedUse}\nNo valid decision note. ${mission.analysisError ?? 'Analysis is required.'}`}\n\nAction authorizations (not completion)\n${mission.actions.map(a => `${a.id}: ${a.permit?.status} — ${a.permit?.reason}`).join('\n')}\n`;
}
