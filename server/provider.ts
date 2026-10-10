import { analysisInstructions } from './analysis.js';
export class ProviderError extends Error {}
export function providerConfigured() { return ['TOKENROUTER_API_KEY','TOKENROUTER_BASE_URL','TOKENROUTER_MODEL'].every(key => !!process.env[key]?.trim()); }
// Compatibility adapter: BASE_URL is an API base, or an exact /chat/completions endpoint.
// No default host, API version or model. Confirm the sponsor's protocol before first use.
export async function analyzeReport(report: string, intendedUse: string): Promise<unknown> {
  if (!providerConfigured()) throw new ProviderError('Analysis unavailable: provider not configured');
  let endpoint: URL;
  try { endpoint = new URL(process.env.TOKENROUTER_BASE_URL!); if (endpoint.protocol !== 'https:' || endpoint.username || endpoint.password || endpoint.search || endpoint.hash) throw new Error(); if (!endpoint.pathname.replace(/\/$/, '').endsWith('/chat/completions')) endpoint.pathname = endpoint.pathname.replace(/\/$/, '') + '/chat/completions'; }
  catch { throw new ProviderError('Analysis unavailable: invalid provider endpoint configuration'); }
  try {
    const response = await fetch(endpoint, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(60_000), headers: { Authorization: `Bearer ${process.env.TOKENROUTER_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: process.env.TOKENROUTER_MODEL, messages: [{ role: 'system', content: analysisInstructions }, { role: 'user', content: JSON.stringify({ intendedUse, originalReport: report }) }], response_format: { type: 'json_object' }, max_tokens: 6000, stream: false }) });
    if (!response.ok) { await response.body?.cancel(); throw new ProviderError(`Analysis unavailable: provider returned HTTP ${response.status}`); }
    if (!response.body) throw new ProviderError('Analysis rejected: empty provider response');
    const reader = response.body.getReader(); const chunks: Uint8Array[] = []; let size = 0;
    while (true) { const { done, value } = await reader.read(); if (done) break; size += value.byteLength; if (size > 256_000) { await reader.cancel(); throw new ProviderError('Analysis rejected: provider response too large'); } chunks.push(value); }
    const envelope = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (envelope.choices?.[0]?.finish_reason !== 'stop' || typeof envelope.choices?.[0]?.message?.content !== 'string') throw new ProviderError('Analysis rejected: incomplete provider response');
    return JSON.parse(envelope.choices[0].message.content);
  } catch (error) {
    if (error instanceof ProviderError) throw error;
    if ((error as Error).name === 'TimeoutError' || (error as Error).name === 'AbortError') throw new ProviderError('Analysis unavailable: provider timed out');
    // Never persist or return provider bodies, credentials, endpoint URLs or raw network errors.
    throw new ProviderError('Analysis unavailable: provider request failed or returned invalid JSON');
  }
}
