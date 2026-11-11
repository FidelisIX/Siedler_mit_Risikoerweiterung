'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { io: connect } = require('socket.io-client');
const { createServer } = require('../server/index');
const { MemoryStore } = require('../server/store');

async function start(store) {
  const app = createServer({ store, restoreWaitMs: 500, restorePollMs: 100 });
  await new Promise((resolve) => app.server.listen(0, resolve));
  app.url = `http://localhost:${app.server.address().port}`;
  return app;
}

function client(url) {
  const socket = connect(url, { transports: ['websocket'], reconnection: false, forceNew: true });
  socket.states = [];
  socket.on('state', (s) => socket.states.push(s));
  return new Promise((resolve) => socket.on('connect', () => resolve(socket)));
}

const call = (socket, event, data) => new Promise((resolve) => socket.emit(event, data, resolve));
const once = (socket, event) => new Promise((resolve) => socket.once(event, resolve));
const tick = () => new Promise((resolve) => setTimeout(resolve, 50));

test('Server: zweiter Tab, Entfernen, Sicherung und Wiederherstellung nach Neustart', async () => {
  const store = new MemoryStore();
  store.persistent = true; // wie GitHub-Speicher, aber im Arbeitsspeicher
  const first = await start(store);
  const anna = await client(first.url);
  const ben = await client(first.url);
  const cleo = await client(first.url);

  const { code } = await call(anna, 'createRoom', { name: 'Anna', token: 'token-anna-123' });
  assert.match(code, /^[A-Z0-9]{5}$/);
  await call(ben, 'joinRoom', { code, name: 'Ben', token: 'token-ben-1234' });
  await call(cleo, 'joinRoom', { code, name: 'Cleo', token: 'token-cleo-123' });

  // Ben öffnet einen zweiten Tab → der erste wird abgemeldet
  const benTab = await client(first.url);
  const kickedTab = once(ben, 'kicked');
  await call(benTab, 'joinRoom', { code, name: 'Ben', token: 'token-ben-1234' });
  assert.equal((await kickedTab).reason, 'tab');

  // Anna (Gastgeberin) entfernt Cleo
  const cleoId = anna.states.at(-1).players.find((p) => p.name === 'Cleo').id;
  const kicked = once(cleo, 'kicked');
  assert.deepEqual(await call(anna, 'kick', { playerId: cleoId }), { ok: true });
  assert.equal((await kicked).reason, 'kick');
  assert.equal((await call(benTab, 'kick', { playerId: cleoId })).error, 'Nur der Gastgeber kann das.');

  await call(anna, 'action', { type: 'start' });
  await tick();
  assert.equal(anna.states.at(-1).phase, 'setup');
  const statsBefore = await (await fetch(`${first.url}/api/stats`)).json();
  assert.equal(statsBefore.games, 0);

  // Neustart: alter Server sichert, neuer Server stellt beim Wiederverbinden her
  const info = once(anna, 'serverInfo');
  assert.equal(await first.shutdown(), 1);
  assert.match((await info).message, /automatisch wieder verbunden/);
  for (const s of [anna, ben, cleo, benTab]) s.close();
  await first.close();

  const snap = await store.loadRoom(code);
  assert.ok(snap.tokens.every(([hash]) => /^[0-9a-f]{64}$/.test(hash)), 'nur Token-Hashes gesichert');

  const second = await start(store);
  const anna2 = await client(second.url);
  const res = await call(anna2, 'joinRoom', { code, name: 'Anna', token: 'token-anna-123' });
  assert.deepEqual(res, { code });
  await tick();
  const state = anna2.states.at(-1);
  assert.equal(state.phase, 'setup');
  assert.equal(state.players.length, 2);
  assert.equal(state.players.find((p) => p.name === 'Anna').id, state.you);
  assert.equal(await store.loadRoom(code), null, 'Sicherung nach dem Wiederherstellen gelöscht');

  // Unbekannter Raum
  assert.equal((await call(anna2, 'joinRoom', { code: 'ZZZZZ', name: 'X', token: 'token-x-123456' })).error, 'Raum nicht gefunden.');
  anna2.close();
  await second.close();
});

test('Server: regelmäßige Sicherung übersteht einen Absturz (ohne geordnetes Herunterfahren)', async () => {
  const store = new MemoryStore();
  store.persistent = true;
  const first = await start(store);
  const anna = await client(first.url);
  const ben = await client(first.url);
  const { code } = await call(anna, 'createRoom', { name: 'Anna', token: 'token-anna-123' });
  await call(ben, 'joinRoom', { code, name: 'Ben', token: 'token-ben-1234' });
  await call(anna, 'action', { type: 'start' });
  await tick();

  assert.equal(await first.backupRooms(), 1, 'geänderter Raum wird gesichert');
  assert.equal(await first.backupRooms(), 0, 'unveränderter Raum wird nicht erneut gesichert');

  // „Absturz“: kein shutdown(), Server einfach weg
  anna.close();
  ben.close();
  await first.close();

  const second = await start(store);
  const anna2 = await client(second.url);
  assert.deepEqual(await call(anna2, 'joinRoom', { code, name: 'Anna', token: 'token-anna-123' }), { code });
  await tick();
  assert.equal(anna2.states.at(-1).phase, 'setup');
  assert.equal(anna2.states.at(-1).players.length, 2);
  anna2.close();
  await second.close();
});

test('GitHub-Speicher: wiederholte Raumsicherungen fragen die sha nur einmal ab', async () => {
  const { GitHubStore } = require('../server/store');
  const calls = [];
  let sha = 0;
  const fakeFetch = async (url, { method }) => {
    calls.push(method);
    if (method === 'GET') return { status: 404, ok: false };
    return { status: 200, ok: true, json: async () => ({ content: { sha: `sha-${++sha}` } }) };
  };
  const gh = new GitHubStore({ token: 't', repo: 'o/r', branch: 'statistik', fetchImpl: fakeFetch });
  await gh.saveRoom('ABCDE', { savedAt: 'x' });
  await gh.saveRoom('ABCDE', { savedAt: 'y' });
  await gh.saveRoom('ABCDE', { savedAt: 'z' });
  assert.deepEqual(calls, ['GET', 'PUT', 'PUT', 'PUT']);
});
