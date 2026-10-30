'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { Game, GameError, START_RESOURCES } = require('../server/game');
const { generateMap } = require('../server/map');

// Deterministischer Zufallsgenerator für reproduzierbare Tests.
function seeded(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Liefert eine Zahlenfolge, deren Würfelwerte (floor(x*6)+1) vorgegeben sind.
function scripted(values) {
  let i = 0;
  return () => (values[i++ % values.length] - 1) / 6 + 0.01;
}

function newGame(n, rng = seeded(1)) {
  const game = new Game('TEST', rng);
  for (let i = 0; i < n; i++) game.addPlayer(`p${i}`, `Spieler ${i}`);
  return game;
}

function finishSetup(game) {
  while (game.phase === 'setup') {
    const current = game.currentPlayer();
    game.placeStart(current.id, { tileId: game.validTiles(current.id).start[0] });
  }
}

test('Karte: jede Region enthält jedes Gelände', () => {
  for (const radius of [3, 4]) {
    const tiles = generateMap(radius, seeded(radius));
    assert.equal(tiles.length, 3 * radius * (radius + 1) + 1);
    for (let region = 1; region <= 6; region++) {
      const terrains = new Set(tiles.filter((t) => t.region === region).map((t) => t.terrain));
      for (const t of ['wald', 'steinbruch', 'acker', 'mine']) assert.ok(terrains.has(t), `Region ${region} fehlt ${t}`);
    }
  }
});

test('Lobby: 2–6 Spieler, nur Gastgeber startet', () => {
  const game = newGame(1);
  assert.throws(() => game.start('p0'), GameError);
  for (let i = 1; i < 6; i++) game.addPlayer(`p${i}`, `Spieler ${i}`);
  assert.throws(() => game.addPlayer('p6', 'Zu viel'), GameError);
  assert.throws(() => game.start('p1'), GameError);
  game.start('p0');
  assert.equal(game.phase, 'setup');
  assert.equal(game.tiles.length, 61);
});

test('Aufbau: Schlangenreihenfolge und Abstand zwischen Start-Siedlungen', () => {
  const game = newGame(3);
  game.start('p0');
  assert.deepEqual(game.setupQueue.map((i) => game.players[i].id), ['p0', 'p1', 'p2', 'p2', 'p1', 'p0']);
  const first = game.validTiles('p0').start[0];
  game.placeStart('p0', { tileId: first });
  const neighbor = game.neighbors(game.getTile(first)).find((t) => t.terrain !== 'oedland');
  assert.throws(() => game.placeStart('p1', { tileId: neighbor.id }), GameError);
  assert.throws(() => game.placeStart('p0', { tileId: game.validTiles('p1').start[0] }), /nicht am Zug/);
  finishSetup(game);
  assert.equal(game.phase, 'main');
  assert.equal(game.round, 1);
  for (const p of game.players) assert.equal(game.points(p.id), 2);
});

test('Würfeln: Region und Gelände produzieren, beides zählt doppelt', () => {
  const game = newGame(2);
  game.start('p0');
  finishSetup(game);
  // Alle Gebäude entfernen und gezielt eines setzen.
  for (const t of game.tiles) t.building = null;
  const tile = game.tiles.find((t) => t.terrain === 'mine' && t.region === 2);
  tile.building = { type: 'siedlung', owner: 'p0' };
  game.players[0].resources = { holz: 0, stein: 0, nahrung: 0, erz: 0 };

  game.rng = scripted([2, 4]); // Region 2, Gelände Mine (Seite 4)
  game.roll('p0');
  assert.equal(game.players[0].resources.erz, 2);
  game.endTurn('p0');

  tile.building.type = 'gut';
  game.rng = scripted([5, 5]); // Region 5, Stern -> Feld liegt nicht in Region 5
  game.roll('p1');
  assert.equal(game.players[0].resources.erz, 2);
  game.endTurn('p1');

  game.rng = scripted([2, 6]); // Region 2, Stern -> Gutshof produziert 2 × 2
  game.roll('p0');
  assert.equal(game.players[0].resources.erz, 6);
  assert.throws(() => game.roll('p0'), GameError);
});

test('Bauen: Kosten, Nachbarschaft und Ausbau', () => {
  const game = newGame(2);
  game.start('p0');
  finishSetup(game);
  game.roll('p0');
  const p0 = game.players[0];
  p0.resources = { holz: 0, stein: 0, nahrung: 0, erz: 0 };
  const target = game.validTiles('p0').siedlung[0];
  assert.throws(() => game.build('p0', { type: 'siedlung', tileId: target }), /Nicht genug/);

  p0.resources = { holz: 5, stein: 5, nahrung: 5, erz: 5 };
  game.build('p0', { type: 'siedlung', tileId: target });
  assert.deepEqual(p0.resources, { holz: 4, stein: 4, nahrung: 4, erz: 5 });
  assert.equal(game.points('p0'), 3);

  game.build('p0', { type: 'gut', tileId: target });
  assert.equal(game.getTile(target).building.type, 'gut');
  assert.equal(game.points('p0'), 4);

  const far = game.tiles.find((t) => !t.building && !game.isAdjacentToOwn(t, 'p0') && t.terrain !== 'oedland');
  assert.throws(() => game.build('p0', { type: 'siedlung', tileId: far.id }), GameError);
});

test('Handel: Bank 3:1, mit Markt 2:1, Angebote zwischen Spielern', () => {
  const game = newGame(2);
  game.start('p0');
  finishSetup(game);
  game.roll('p0');
  const [p0, p1] = game.players;
  p0.resources = { holz: 6, stein: 1, nahrung: 0, erz: 0 };
  game.bankTrade('p0', { give: 'holz', get: 'erz' });
  assert.deepEqual(p0.resources, { holz: 3, stein: 1, nahrung: 0, erz: 1 });

  game.build('p0', { type: 'markt', tileId: game.validTiles('p0').markt[0] });
  p0.resources.holz = 2;
  game.bankTrade('p0', { give: 'holz', get: 'nahrung' });
  assert.equal(p0.resources.holz, 0);
  assert.equal(p0.resources.nahrung, 1);

  p1.resources = { ...START_RESOURCES };
  game.proposeTrade('p0', { to: 'p1', give: { erz: 1 }, want: { stein: 2 } });
  assert.throws(() => game.respondTrade('p0', { accept: true }), GameError);
  game.respondTrade('p1', { accept: true });
  assert.equal(p0.resources.stein, 2);
  assert.equal(p1.resources.erz, START_RESOURCES.erz + 1);
  assert.equal(game.trade, null);
});

test('Spielende nach fester Rundenzahl mit Rangliste', () => {
  const game = newGame(3);
  game.setRounds('p0', { rounds: 8 });
  game.start('p0');
  finishSetup(game);
  for (let i = 0; i < 8 * 3; i++) {
    const current = game.currentPlayer();
    game.roll(current.id);
    game.endTurn(current.id);
  }
  assert.equal(game.phase, 'ended');
  assert.equal(game.results.length, 3);
  assert.ok(game.results[0].points >= game.results[1].points);
});

test('Getrennte Spieler können übersprungen werden', () => {
  const game = newGame(2);
  game.start('p0');
  game.setConnected('p0', false);
  game.forceSkip('p1');
  assert.equal(game.currentPlayer().id, 'p1');
  finishSetup(game);
  assert.equal(game.currentPlayer().id, 'p0');
  game.forceSkip('p1');
  assert.equal(game.currentPlayer().id, 'p1');
  assert.throws(() => game.forceSkip('p0'), /verbunden/);
});
