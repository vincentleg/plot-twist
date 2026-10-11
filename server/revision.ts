import { newId } from './ids.js';
import type { Mission, Permit, PermitStatus, Revision, Claim } from '../shared/types.js';
import { hash, analysisHash } from './policy.js';
import { normalize, validateAnalysis } from './analysis.js';

// A revision is a separate document derived from a REAL mission's analysis. It keeps only claims the
// report itself supports and that no unresolved issue or checked contradiction touches. It adds no evidence.
const outcome = (status: PermitStatus, reason: string): Permit => ({ status, reason, evaluatedAt: new Date().toISOString() });
const contradicted = (m: Mission) => new Set((m.research ?? []).filter(r => r.status === 'COMPLETE' && r.analysisHash === analysisHash(m)).flatMap(r => r.assessments ?? []).filter(x => x.stance === 'CONTRADICTS').map(x => x.claimId));
const statusReason: Record<string, string> = { DISPUTED: 'disputed — the report contests it; it stays out until a person resolves the contradiction', UNVERIFIABLE: 'not enough evidence in the report', UNASSESSED: 'not checked by the report' };

export function selectClaims(m: Mission) {
  const a = m.analysis!; const bad = contradicted(m);
  const kept: Claim[] = []; const removed: Revision['removed'] = [];
  for (const c of a.claims) {
    const issue = a.issues.find(i => i.claimIds.includes(c.id) && (i.severity === 'MISSING' || i.severity === 'BLOCK'));
    if (c.status !== 'SUPPORTED') removed.push({ claimId: c.id, text: c.text, status: c.status, reason: statusReason[c.status] ?? c.status });
    else if (bad.has(c.id)) removed.push({ claimId: c.id, text: c.text, status: c.status, reason: 'a checked web source contradicts it' });
    else if (issue) removed.push({ claimId: c.id, text: c.text, status: c.status, reason: `supported, but an unresolved issue applies: ${issue.description}` });
    else kept.push(c);
  }
  return { kept, removed };
}

// Ezio exports list sources under each "### Claim" section; collect the links of the section holding an excerpt.
export function sourcesFor(report: string, excerpt: string): { label: string; url: string }[] {
  const at = report.indexOf(excerpt.split('\n')[0]); if (at < 0) return [];
  const start = report.lastIndexOf('\n### ', at); const end = report.indexOf('\n### ', at + 1);
  const section = report.slice(start < 0 ? 0 : start, end < 0 ? undefined : end);
  return [...section.matchAll(/\[([^\]]+)\]\(<?([^)>\s]+)>?\)/g)].slice(0, 6).map(x => ({ label: x[1].replace(/\\_/g, '_'), url: x[2] }));
}

export const proposedLimitedUse = (_m: Mission) => `Share only the retained statements below, presented as supported by the Ezio report's own checks and with the limits stated — not as an independently verified or complete version of the original text.`;

export function renderRevision(m: Mission, r: Pick<Revision, 'id' | 'keptClaimIds' | 'removed' | 'proposedUse' | 'createdAt'>): string {
  const a = m.analysis!; const kept = a.claims.filter(c => r.keptClaimIds.includes(c.id));
  const items = kept.map((c, i) => { const ev = a.evidence.filter(e => c.evidenceIds.includes(e.id)); const src = ev.flatMap(e => sourcesFor(m.originalReport, e.text)); const uniq = [...new Map(src.map(s => [s.url, s])).values()];
    return `${i + 1}. ${c.text}\n   Report evidence: ${ev.map(e => `[${e.id}] "${normalize(e.text).slice(0, 220)}"`).join(' ; ')}\n   Sources listed by Ezio for this check:\n${uniq.length ? uniq.map(s => `   - ${s.label}: ${s.url}`).join('\n') : '   - none listed in the report section'}`; });
  return `PLOT TWIST — Revised document\nSynthesis limited to claims supported by the Ezio report\nVersion: ${r.id}\nCreated: ${r.createdAt}\nSource mission: ${m.id}\n\nOriginal intended use\n${m.intendedUse}\n\nProposed limited use\n${r.proposedUse}\n\nRetained statements\n${items.join('\n\n') || '(none)'}\n\nLimits\n- Support comes from the Ezio report's own checks. PLOT TWIST did not independently verify these statements.\n- Only the statements above are included. The original summary as a whole is not validated, and a supported heading does not validate the body.\n- Removed statements are listed in the annex. Removal does not mean they are false.\n\nAnnex — removed statements and reasons\n${r.removed.map(x => `- [${x.claimId}] ${x.text}\n  Removed: ${x.reason}`).join('\n') || '- none'}\n`;
}

export function createRevision(m: Mission): Revision {
  const { kept, removed } = selectClaims(m);
  const base = { id: newId(), createdAt: new Date().toISOString(), keptClaimIds: kept.map(c => c.id), removed, proposedUse: proposedLimitedUse(m) };
  const content = renderRevision(m, base);
  return { ...base, content, contentHash: hash(content), analysisHash: analysisHash(m), reviews: [], permit: null };
}

export function evaluateRevision(m: Mission, r: Revision): { permit: Permit; humanReasons: string[] } {
  const humanReasons: string[] = []; const done = (p: Permit) => ({ permit: { ...p, contentHash: r.contentHash }, humanReasons });
  if (m.mode !== 'REAL') return done(outcome('BLOCKED', 'Experiments can never finalize.'));
  try { if (m.analysisStatus !== 'READY' || !m.analysis) throw new Error(); validateAnalysis(m.analysis, m.originalReport); } catch { return done(outcome('SUSPENDED', 'A valid analysis is required.')); }
  if (analysisHash(m) !== r.analysisHash) return done(outcome('SUSPENDED', 'The analysis changed after this revision was created. Create a new revision.'));
  if (r.content !== renderRevision(m, r) || hash(r.content) !== r.contentHash) return done(outcome('NEEDS_HUMAN', 'The revision text no longer matches its server-rendered content.'));
  const a = m.analysis; const kept = a.claims.filter(c => r.keptClaimIds.includes(c.id));
  if (!kept.length) return done(outcome('SUSPENDED', 'No statement remains that the report supports without unresolved issues. An empty document cannot be authorized.'));
  const available = (id: string) => { const e = m.evidence.find(x => x.id === id); const o = a.evidence.find(x => x.id === id); return !!e && !!o && e.state === 'VERIFIED' && e.text === o.text && normalize(m.originalReport).includes(normalize(e.text)); };
  for (const c of kept) if (c.status !== 'SUPPORTED' || !c.evidenceIds.length || c.evidenceIds.some(id => !available(id))) return done(outcome('SUSPENDED', `Retained statement ${c.id} no longer has its report support available.`));
  const keptIds = new Set(kept.map(c => c.id)); const keptEvidence = new Set(kept.flatMap(c => c.evidenceIds));
  // Removed claims are no longer dependencies; everything touching retained claims (or global) still applies.
  const issues = a.issues.filter(i => !i.claimIds.length || i.claimIds.some(id => keptIds.has(id)));
  if (issues.some(i => i.severity === 'BLOCK')) return done(outcome('BLOCKED', 'An explicit refusal issue applies to a retained statement.'));
  if (issues.some(i => i.severity === 'MISSING')) return done(outcome('SUSPENDED', 'Information is still missing for a retained statement. A human cannot supply evidence.'));
  if (kept.some(c => contradicted(m).has(c.id))) return done(outcome('NEEDS_HUMAN', 'A checked source contradicts a retained statement.'));
  const actions = a.actions.filter(x => x.claimIds.some(id => keptIds.has(id)));
  if (actions.some(x => x.kind === 'BLOCK')) return done(outcome('BLOCKED', 'The plan requests refusal for a retained statement.'));
  if (actions.some(x => x.kind === 'RESEARCH' && x.claimIds.every(id => keptIds.has(id)))) return done(outcome('SUSPENDED', 'Research planned specifically for the retained statements has not been done.'));
  issues.filter(i => i.severity === 'HUMAN').forEach(i => humanReasons.push(`Open judgment: ${i.description}`));
  actions.filter(x => x.kind === 'REQUEST_HUMAN').forEach(x => humanReasons.push(`Planned human review: ${x.title}`));
  a.signals.filter(s => s.assessment === 'CONCERN' && (!s.evidenceIds.length || s.evidenceIds.some(id => keptEvidence.has(id)))).forEach(s => humanReasons.push(`Report signal ${s.kind} raises a concern touching retained evidence: ${s.explanation}`));
  const highStakes = /\b(medical|clinical|diagnos\w*|treatment|legal|court|invest\w*|financial|safety|hiring|credit)\b/iu.test(m.intendedUse);
  if (a.useAssessment.risk !== 'LOW' || highStakes) humanReasons.push(`The declared use is ${a.useAssessment.risk === 'LOW' ? 'high-stakes by its wording' : a.useAssessment.risk + ' risk'}: ${a.useAssessment.rationale}`);
  const review = r.reviews.filter(x => x.contentHash === r.contentHash).at(-1);
  if (review?.decision === 'DECLINE') return done(outcome('BLOCKED', `${review.reviewer} declined the proposed limited use.`));
  if (humanReasons.length && review?.decision !== 'ACCEPT_LIMITED_USE') return done(outcome('NEEDS_HUMAN', 'A responsible person must accept the proposed limited use before this revision can be finalized.'));
  return done(outcome('ACTIVE', humanReasons.length ? `Retained statements are report-supported with no unresolved issue, and ${review!.reviewer} accepted the limited use. No independent verification is claimed.` : 'Retained statements are report-supported with no unresolved issue. No independent verification is claimed.'));
}

// Minimal dependency-free PDF (Helvetica, WinAnsi). Text outside Latin-1 is transliterated.
export function pdf(title: string, lines: string[]): Buffer {
  const clean = (s: string) => s.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[—–]/g, '-').replace(/…/g, '...').replace(/·/g, '-').replace(/[^\x09\x0a\x20-\x7e\xa0-\xff]/g, '?');
  const esc = (s: string) => clean(s).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  const wrap = (s: string, n: number) => { const out: string[] = []; for (const raw of s.split('\n')) { let line = raw; const indent = (/^\s*/.exec(raw)?.[0] ?? '') + (/^\s*(-|\d+\.)\s/.test(raw) ? '  ' : ''); while (line.length > n) { let k = line.lastIndexOf(' ', n); if (k <= indent.length) k = n; out.push(line.slice(0, k)); line = indent + line.slice(k).trimStart(); } out.push(line); } return out; };
  const body = [...wrap(title, 60).map(l => ({ l, bold: true, size: 15 })), { l: '', bold: false, size: 10 }, ...lines.flatMap(s => wrap(s, 98)).map(l => ({ l, bold: /^[A-Z][A-Za-z —-]+$/.test(l) && l.length < 60, size: 10 }))];
  const pages: string[] = []; let y = 800, ops = '';
  for (const { l, bold, size } of body) { if (y < 50) { pages.push(ops); ops = ''; y = 800; } ops += `BT /${bold ? 'F2' : 'F1'} ${size} Tf 48 ${y} Td (${esc(l)}) Tj ET\n`; y -= size + 4; }
  pages.push(ops);
  const objs: string[] = []; const n = pages.length;
  objs[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objs[2] = `<< /Type /Pages /Kids [${pages.map((_, i) => `${5 + i * 2} 0 R`).join(' ')}] /Count ${n} >>`;
  objs[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
  objs[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';
  pages.forEach((p, i) => { const stream = Buffer.from(p, 'latin1'); objs[5 + i * 2] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${6 + i * 2} 0 R >>`; objs[6 + i * 2] = `<< /Length ${stream.length} >>\nstream\n${p}endstream`; });
  let out = '%PDF-1.4\n'; const offsets: number[] = [];
  for (let i = 1; i < objs.length; i++) { offsets[i] = Buffer.byteLength(out, 'latin1'); out += `${i} 0 obj\n${objs[i]}\nendobj\n`; }
  const xref = Buffer.byteLength(out, 'latin1');
  out += `xref\n0 ${objs.length}\n0000000000 65535 f \n${offsets.slice(1).map(o => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${objs.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}

export function revisionPdf(m: Mission, r: Revision): { file: Buffer; approved: boolean } {
  const approved = !!r.finalized && r.finalized.contentHash === r.contentHash && evaluateRevision(m, r).permit.status === 'ACTIVE';
  const head = approved
    ? [`APPROVED — authorized by the PLOT TWIST server on ${r.finalized!.at}`, `Version ${r.id} · content SHA-256 ${r.contentHash}`, `Accepted limited use by ${r.reviews.filter(x => x.contentHash === r.contentHash).at(-1)?.reviewer ?? 'no human review required'}`, '']
    : ['DRAFT — NOT AUTHORIZED. This file is not an approved document.', `Version ${r.id} · content SHA-256 ${r.contentHash}`, `Current server decision: ${evaluateRevision(m, r).permit.status} — ${evaluateRevision(m, r).permit.reason}`, ''];
  return { approved, file: pdf(approved ? 'PLOT TWIST — Approved revised document' : 'PLOT TWIST — DRAFT revised document (not authorized)', [...head, r.content]) };
}
