// Explicit opt-in real request. Uses sponsor credits; never run automatically.
import '../server/config.js';
import { requestProviderJson, ProviderError } from '../server/provider.js';
try {
  const value = await requestProviderJson([
    { role: 'system', content: 'Reply with JSON only. Do not include explanations.' },
    { role: 'user', content: 'Return exactly {"ok":true}.' },
  ], 256);
  if (!value || typeof value !== 'object' || (value as { ok?: unknown }).ok !== true) throw new Error();
  console.log('TokenRouter real request succeeded: JSON validated (ok=true).');
} catch (error) {
  console.error(error instanceof ProviderError ? error.message : 'TokenRouter check failed: unexpected JSON shape.');
  process.exitCode = 1;
}
