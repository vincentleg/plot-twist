import type { IncomingMessage, ServerResponse } from 'node:http';
import { Readable } from 'node:stream';
import { mkdtemp, cp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import { createHandler } from './app.js';
import { ProviderError } from './provider.js';
import { withSeededIds } from './ids.js';

// Public read-only demo (Vercel). Missions come from sanitized fixtures in demo/fixtures. Analysis,
// research, imports and edits are refused, and no provider key is configured. Each browser keeps
// its own short log of demo actions in a cookie; every request replays that log through the same
// server handler on a fresh copy of the fixtures, so permits are still computed by server policy.
const fixtures = fileURLToPath(new URL('../../demo/fixtures/', import.meta.url));
const COOKIE = 'pt_demo'; const MAX_COOKIE = 3500; const RESTART_AFTER = 12;
const notice = 'Disabled in the public demo: it replays recorded analyses only. Live analysis, web research, imports and edits run only in a local install.';
const allowedPost = [
  /^\/api\/missions\/[^/]+\/(experiments|mask|reset|finalize|revisions)$/,
  /^\/api\/missions\/[^/]+\/revisions\/[0-9a-f-]{36}\/(review|finalize)$/,
];
const allowedGet = /^\/api\/missions\/[^/]+(\/(events|export)|\/revisions\/[0-9a-f-]{36}\/pdf)?$/;
type Session = { s: string; o: [string, string][] };
type Captured = { status: number; headers: Record<string, string>; body: Buffer };
const fresh = (): Session => ({ s: randomBytes(12).toString('hex'), o: [] });
const clip = (value: unknown, n: number) => typeof value === 'string' ? value.slice(0, n) : value;

function readSession(req: IncomingMessage): Session {
  const raw = req.headers.cookie?.split(/;\s*/).find(c => c.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
  try { const v = JSON.parse(Buffer.from(raw ?? '', 'base64url').toString('utf8')); if (typeof v.s === 'string' && Array.isArray(v.o) && v.o.every((x: unknown) => Array.isArray(x) && x.length === 2 && x.every(y => typeof y === 'string'))) return v; } catch { /* new session */ }
  return fresh();
}
function call(handler: ReturnType<typeof createHandler>, method: string, url: string, body: string): Promise<Captured> {
  const req = Object.assign(Readable.from(body ? [Buffer.from(body)] : []), { method, url, headers: body ? { 'content-type': 'application/json' } : {} }) as unknown as IncomingMessage;
  return new Promise((resolve, reject) => {
    const out: Captured = { status: 200, headers: {}, body: Buffer.alloc(0) };
    const res = { writeHead(status: number, headers: Record<string, string>) { out.status = status; out.headers = headers; return res; }, end(data?: string | Buffer) { out.body = Buffer.from(data ?? ''); resolve(out); } } as unknown as ServerResponse;
    handler(req, res).catch(reject);
  });
}
async function run(session: Session, method: string, url: string, body: string): Promise<Captured> {
  const dir = await mkdtemp(join(tmpdir(), 'plot-twist-'));
  try {
    await cp(fixtures, dir, { recursive: true });
    const handler = createHandler(dir, async () => { throw new ProviderError(notice); });
    return await withSeededIds(session.s, async () => { for (const [path, payload] of session.o) await call(handler, 'POST', path, payload); return call(handler, method, url, body); });
  } finally { await rm(dir, { recursive: true, force: true }); }
}
async function readBody(req: IncomingMessage) { let size = 0; const chunks: Buffer[] = []; for await (const c of req) { size += c.length; if (size > 4000) return null; chunks.push(c); } return Buffer.concat(chunks).toString('utf8'); }

export default async function demo(req: IncomingMessage, res: ServerResponse) {
  const reply = (status: number, value: unknown, extra: Record<string, string> = {}) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...extra }); res.end(JSON.stringify(value)); };
  try {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const routed = url.searchParams.get('__p'); // set by the vercel.json rewrite
    const path = routed !== null ? `/api/${routed}` : url.pathname;
    if (req.method === 'GET' && path === '/api/health') return reply(200, { status: 'ok', demo: true, analysis: 'Public demo · recorded analyses only · live analysis disabled' });
    if (req.method === 'GET' && path === '/api/samples') return reply(200, []);
    let session = readSession(req);
    if (req.method === 'GET' && allowedGet.test(path)) { const r = await run(session, 'GET', path, ''); res.writeHead(r.status, r.headers); return res.end(r.body); }
    if (req.method !== 'POST' || !allowedPost.some(p => p.test(path))) return reply(req.method === 'POST' ? 403 : 404, { error: req.method === 'POST' ? notice : 'Endpoint not found.' });
    const raw = await readBody(req); if (raw === null) return reply(413, { error: 'Request is too large.' });
    let body = raw;
    if (path.endsWith('/review')) { try { const v = JSON.parse(raw); body = JSON.stringify({ reviewer: clip(v.reviewer, 120), decision: v.decision, comment: clip(v.comment, 300) }); } catch { /* the handler reports invalid JSON */ } }
    // A new guided run starts with a fresh experiment; drop old history there so the cookie stays small.
    if (path.endsWith('/experiments') && session.o.length >= RESTART_AFTER) session = fresh();
    let next: Session = { ...session, o: [...session.o, [path, body]] };
    if (Buffer.byteLength(JSON.stringify(next)) * 4 / 3 > MAX_COOKIE) { session = fresh(); next = { ...session, o: [[path, body]] }; }
    const r = await run(session, 'POST', path, body);
    const cookie = `${COOKIE}=${Buffer.from(JSON.stringify(r.status < 500 ? next : session)).toString('base64url')}; Path=/api; HttpOnly; Secure; SameSite=Strict; Max-Age=7200`;
    res.writeHead(r.status, { ...r.headers, 'Set-Cookie': cookie }); res.end(r.body);
  } catch { reply(500, { error: 'Demo server error. The Gateway remains closed.' }); }
}
