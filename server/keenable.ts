import type { ResearchResult, ResearchPage } from '../shared/types.js';
export class ResearchError extends Error {}
export const researchMode = () => process.env.KEENABLE_API_KEY?.trim() ? 'AUTHENTICATED' as const : 'KEYLESS_PUBLIC' as const;
// Wire contract verified against the official keenableai/keenable-sdk TypeScript client.
// Direct requests go only to Keenable; never fetch returned pages from this server.
export function publicPageUrl(value: unknown): string {
  if (typeof value !== 'string' || value.length > 4000) throw new ResearchError('Keenable returned an invalid page URL.');
  try {
    const url = new URL(value); const host = url.hostname.toLowerCase();
    // Only ordinary public DNS names; disallow literal IPs and internal suffixes.
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.port || !host.includes('.') || /[\[\]:]/.test(host) || /^[\d.]+$/.test(host) || /(?:^|\.)(localhost|local|internal|test|invalid)$/.test(host)) throw new Error();
    return url.href;
  } catch { throw new ResearchError('Keenable returned an invalid or internal page URL.'); }
}
async function call(operation: 'search' | 'fetch', queryOrUrl: string): Promise<Record<string, unknown>> {
  const endpoint = new URL(`https://api.keenable.ai/v1/${operation}${researchMode() === 'KEYLESS_PUBLIC' ? '/public' : ''}`);
  const headers: Record<string, string> = { Accept: 'application/json', 'X-Keenable-Title': 'PLOT TWIST' };
  if (researchMode() === 'AUTHENTICATED') headers['X-API-Key'] = process.env.KEENABLE_API_KEY!;
  if (operation === 'fetch') endpoint.searchParams.set('url', publicPageUrl(queryOrUrl));
  else headers['Content-Type'] = 'application/json';
  try {
    const response = await fetch(endpoint, { method: operation === 'search' ? 'POST' : 'GET', headers, redirect: 'error', signal: AbortSignal.timeout(30_000), ...(operation === 'search' ? { body: JSON.stringify({ query: queryOrUrl, mode: 'pro' }) } : {}) });
    if (!response.ok) { await response.body?.cancel(); throw new ResearchError(`Keenable ${operation} failed (HTTP ${response.status}). No automatic retry or top-up.`); }
    if (!response.body) throw new ResearchError('Keenable returned an empty response.');
    const reader = response.body.getReader(); const chunks: Uint8Array[] = []; let size = 0;
    while (true) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > 2_000_000) { await reader.cancel(); throw new ResearchError('Keenable response exceeded the size limit.'); } chunks.push(value); }
    const data = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new ResearchError('Keenable returned an invalid response.');
    return data;
  } catch (error) { if (error instanceof ResearchError) throw error; throw new ResearchError('Keenable request failed, timed out or returned invalid JSON.'); }
}
export async function searchPages(query: string): Promise<ResearchResult[]> {
  if (!query.trim() || query.length > 1000) throw new ResearchError('Research query must contain 1–1000 characters.');
  const data = await call('search', query);
  if (!Array.isArray(data.results)) throw new ResearchError('Keenable returned invalid search results.');
  const results: ResearchResult[] = [];
  for (const value of data.results.slice(0, 5)) {
    if (!value || typeof value !== 'object' || typeof value.title !== 'string') throw new ResearchError('Keenable returned an invalid result.');
    try { results.push({ url: publicPageUrl(value.url), title: value.title.slice(0, 1000), snippet: typeof value.snippet === 'string' ? value.snippet.slice(0, 4000) : '', ...(typeof value.published_at === 'string' ? { publishedAt: value.published_at.slice(0, 100) } : {}) }); }
    catch (error) { if (!(error instanceof ResearchError)) throw error; /* Invalid URL is not offered for fetch. */ }
  }
  return results;
}
export async function fetchPage(url: string): Promise<ResearchPage> {
  const data = await call('fetch', publicPageUrl(url));
  if (typeof data.content !== 'string' || !data.content.trim()) throw new ResearchError('Keenable fetch returned no usable page content.');
  return { url: publicPageUrl(data.url ?? url), title: typeof data.title === 'string' ? data.title.slice(0, 1000) : '', content: data.content.slice(0, 50_000), truncated: data.content.length > 50_000, fetchedAt: new Date().toISOString(), state: 'UNVERIFIED' };
}
