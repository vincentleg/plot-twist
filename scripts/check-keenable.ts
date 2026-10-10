// Explicit real smoke check of the public, keyless API; never an Ezio analysis.
import { searchPages, fetchPage } from '../server/keenable.js';
// Force the public tier even if the invoking shell has an authenticated key.
delete process.env.KEENABLE_API_KEY;
try {
  const results = await searchPages('Keenable official documentation search fetch API');
  if (!results.length) throw new Error();
  const page = await fetchPage(results[0].url);
  console.log(JSON.stringify({ mode: 'KEYLESS_PUBLIC', searchResults: results.length, fetchedUrl: page.url, contentCharacters: page.content.length, state: page.state }));
} catch { console.error('Keenable live search → fetch check failed. No simulated fallback.'); process.exitCode = 1; }
