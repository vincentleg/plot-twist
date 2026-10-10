import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../server/app.js';
test('import, persistence, validation and fail-closed Gateway', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'plot-twist-test-'));
  const app = createApp(directory);
  await new Promise<void>(resolve => app.listen(0, '127.0.0.1', resolve));
  const address = app.address() as { port: number };
  const base = `http://127.0.0.1:${address.port}/api`;
  const post = (path: string, value: unknown) => fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) });
  try {
    assert.equal((await fetch(base + '/health')).status, 200);
    assert.equal((await post('/missions', { originalReport: '  ', intendedUse: 'test' })).status, 400);
    assert.equal((await post('/missions', { originalReport: 'x', intendedUse: '' })).status, 400);
    assert.equal((await post('/missions', { originalReport: 'x'.repeat(250001), intendedUse: 'test' })).status, 400);
    const originalReport = '  Synthetic transport test ONLY.\nNot an Ezio report.\r\nÉvidence\n';
    const response = await post('/missions', { originalReport, intendedUse: 'API test only' });
    assert.equal(response.status, 201); const mission = await response.json();
    assert.equal(mission.originalReport, originalReport); assert.deepEqual(mission.actions, []);
    assert.equal(JSON.parse(await readFile(join(directory, `${mission.id}.json`), 'utf8')).originalReport, originalReport);
    assert.equal((await (await fetch(base + `/missions/${mission.id}`)).json()).importedAt, mission.importedAt);
    const copy = await (await post(`/missions/${mission.id}/experiments`, {})).json();
    assert.equal(copy.mode, 'EXPERIMENT'); assert.notEqual(copy.id, mission.id); assert.equal(copy.originalReport, originalReport);
    const denied = await post(`/missions/${copy.id}/finalize`, { mode: 'REAL', permit: 'ACTIVE' });
    assert.equal(denied.status, 403); const result = await denied.json(); assert.match(result.error, /never finalize/); assert.equal(result.mission.gateway.state, 'CLOSED');
    assert.equal((await (await fetch(base + `/missions/${mission.id}/events`)).json()).length, 1);
    assert.equal((await (await fetch(base + `/missions/${copy.id}/events`)).json()).at(-1).type, 'FINALIZATION_DENIED');
    const realDenied = await post(`/missions/${mission.id}/finalize`, {}); assert.equal(realDenied.status, 403); assert.match((await realDenied.json()).error, /permit engine/);
    await Promise.all(Array.from({ length: 5 }, () => post(`/missions/${mission.id}/finalize`, {})));
    assert.equal((await (await fetch(base + `/missions/${mission.id}/events`)).json()).length, 7);
    assert.equal((await post('/missions/00000000-0000-0000-0000-000000000000/finalize', {})).status, 404);
  } finally { await new Promise<void>(resolve => app.close(() => resolve())); await rm(directory, { recursive: true, force: true }); }
});
