// Builds the public demo fixtures from the two local recorded missions (data/, ignored by Git).
// Removes the private Ezio permalink, account notice, export timestamps, internal scoring note and footer,
// third-party page bodies and long snippets, and earlier local revision history. Usage: npx tsx scripts/build-demo-fixtures.ts
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import type { Mission } from '../shared/types.js';
import { validateAnalysis } from '../server/analysis.js';
import { reevaluate, analysisHash } from '../server/policy.js';

const ids = ['0a1afcf5-f6d5-484d-b880-1e3eeaa7ba4e', 'e984e024-2d3c-4509-ac49-b17afffd6132'];
const header = '# ezio Trust Analysis — sanitized demo fixture\n\nRecorded analysis replayed by the PLOT TWIST public demo. The private result link, account details, export timestamps, internal scoring note and footer were removed. No live analysis runs on this site.\n\n';
const clip = (text: string, n: number) => text.length > n ? text.slice(0, n - 1) + '…' : text;
const historic = new Set(['REVISION_CREATED', 'REVISION_REVIEWED', 'GATEWAY_DECISION']);

mkdirSync('demo/fixtures', { recursive: true });
for (const id of ids) {
  const m: Mission = JSON.parse(readFileSync(`data/${id}.json`, 'utf8'));
  const start = m.originalReport.indexOf('## Analyzed text'); const end = m.originalReport.indexOf('Scoring rules automatically');
  if (start < 0 || end < 0) throw new Error(`${id}: unexpected report layout`);
  m.originalReport = header + m.originalReport.slice(start, end).trimEnd() + '\n';
  if (/ezioai\.io|Permalink|owner's account|Exported at/i.test(m.originalReport)) throw new Error(`${id}: private header remains`);
  validateAnalysis(m.analysis, m.originalReport);
  const before = analysisHash(m);
  for (const run of m.research ?? []) {
    run.results = run.results.map(r => ({ ...r, snippet: clip(r.snippet, 240) }));
    run.pages = (run.pages ?? []).map(p => ({ ...p, content: '[Page text not republished in the public demo. Open the link to read the source.]', truncated: false }));
    delete run.page;
    run.assessments = run.assessments?.map(a => ({ ...a, quote: clip(a.quote, 300) }));
  }
  delete m.revisions;
  m.events = m.events.filter(e => !historic.has(e.type));
  reevaluate(m);
  if (analysisHash(m) !== before) throw new Error(`${id}: analysis changed`);
  writeFileSync(`demo/fixtures/${id}.json`, JSON.stringify(m, null, 1) + '\n');
  console.log(id, 'ok', JSON.stringify(m).length, 'bytes; finalize permit:', m.actions.find(a => a.kind === 'FINALIZE')?.permit?.status);
}
