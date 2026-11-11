'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { Game, GameError, START_RESOURCES } = require('../server/game');
const { buildBoard, generateIslands, validateCustomMap, PRESETS, neighborIds, tileId } = require('../server/map');

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

function newGame(n, rng = seeded(1), map = { kind: 'kontinent' }) {
  const game = new Game('TEST', rng);
  for (let i = 0; i < n; i++) game.addPlayer(`p${i}`, `Spieler ${i}`);
  game.setMap('p0', map);
  game.setVictory('p0', { roundLimit: 20 }); // Tests sollen sicher enden
  return game;
}

function regionSizes(tiles) {
  const sizes = [0, 0, 0, 0, 0, 0];
  for (const t of tiles) if (t.terrain !== 'wasser') sizes[t.region - 1]++;
  return sizes;
}

function finishSetup(game) {
  while (game.phase === 'setup') {
    const current = game.currentPlayer();
    game.placeStart(current.id, { tileId: game.validTiles(current.id).start[0] });
  }
}

test('Kontinent: jede Region enthält jedes Gelände', () => {
  for (const players of [2, 6]) {
    const tiles = buildBoard({ kind: 'kontinent' }, players, seeded(players));
    for (let region = 1; region <= 6; region++) {
      const terrains = new Set(tiles.filter((t) => t.region === region).map((t) => t.terrain));
      for (const t of ['wald', 'steinbruch', 'acker', 'mine']) assert.ok(terrains.has(t), `Region ${region} fehlt ${t}`);
    }
  }
});

test('Alle Karten: Regionen sind gleich groß, Wasser hat eine Region, kein Platzhalter bleibt übrig', () => {
  const choices = [
    { kind: 'random' }, { kind: 'kontinent' },
    ...PRESETS.map((p) => ({ kind: 'preset', id: p.id })),
  ];
  for (const choice of choices) {
    for (let seed = 1; seed <= 20; seed++) {
      const tiles = buildBoard(choice, 2 + (seed % 5), seeded(seed));
      const sizes = regionSizes(tiles);
      assert.ok(Math.max(...sizes) - Math.min(...sizes) <= 1, `${choice.kind}/${choice.id}: ${sizes}`);
      assert.ok(tiles.every((t) => t.region >= 1 && t.region <= 6 && t.terrain !== 'land'));
    }
  }
});

test('Zufällige Inselgruppe: mehrere getrennte Inseln mit Wasser, unterschiedliche Formen', () => {
  const shapes = new Set();
  for (let seed = 1; seed <= 30; seed++) {
    const layout = generateIslands(4, seeded(seed));
    const land = layout.filter((t) => t.terrain !== 'wasser');
    assert.ok(layout.some((t) => t.terrain === 'wasser'));
    assert.ok(land.length >= 20, `nur ${land.length} Landfelder`);
    // Zusammenhangskomponenten des Landes zählen.
    const ids = new Set(land.map((t) => tileId(t.q, t.r)));
    const seen = new Set();
    let islands = 0;
    for (const t of land) {
      const start = tileId(t.q, t.r);
      if (seen.has(start)) continue;
      islands++;
      const stack = [t];
      seen.add(start);
      while (stack.length) {
        const cur = stack.pop();
        for (const n of neighborIds(cur)) {
          if (ids.has(n) && !seen.has(n)) {
            seen.add(n);
            const [q, r] = n.split(',').map(Number);
            stack.push({ q, r });
          }
        }
      }
    }
    assert.ok(islands >= 2, `Seed ${seed}: nur ${islands} Insel(n)`);
    shapes.add([...ids].sort().join('|'));
  }
  assert.ok(shapes.size > 25);
});

test('Eigene Karten werden geprüft', () => {
  assert.throws(() => validateCustomMap({ tiles: [{ q: 0, r: 0, terrain: 'land' }] }), /mindestens/);
  assert.throws(() => validateCustomMap({ tiles: [{ q: 99, r: 0, terrain: 'land' }] }), /Koordinaten/);
  assert.throws(() => validateCustomMap({ tiles: [{ q: 0, r: 0, terrain: 'lava' }] }), /Gelände/);
  const tiles = Array.from({ length: 12 }, (_, i) => ({ q: i, r: 0, terrain: 'land' }));
  const map = validateCustomMap({ name: '  Streifen ', tiles: [...tiles, tiles[0]] });
  assert.equal(map.name, 'Streifen');
  assert.equal(map.tiles.length, 12);
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

test('Lobby: Kartenwahl und zu kleine Karten', () => {
  const game = newGame(3);
  assert.throws(() => game.setMap('p1', { kind: 'random' }), /Gastgeber/);
  assert.throws(() => game.setMap('p0', { kind: 'preset', id: 'gibtsnicht' }), GameError);
  const tiles = Array.from({ length: 12 }, (_, i) => ({ q: i, r: 0, terrain: 'land' }));
  game.setMap('p0', { kind: 'custom', map: { name: 'Mini', tiles } });
  assert.equal(game.publicState('p0').map.name, 'Mini');
  assert.equal(game.publicState('p0').mapPreview.length, 12);
  assert.throws(() => game.start('p0'), /zu klein/);
  game.setMap('p0', { kind: 'preset', id: 'lagune' });
  game.start('p0');
  assert.ok(game.tiles.some((t) => t.terrain === 'wasser'));
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
  tile.building = { type: 'dorf', owner: 'p0' };
  game.players[0].resources = { holz: 0, stein: 0, nahrung: 0, erz: 0 };

  game.rng = scripted([2, 4]); // Region 2, Gelände Mine (Seite 4)
  game.roll('p0');
  assert.equal(game.players[0].resources.erz, 2);
  game.endTurn('p0');

  tile.building.type = 'stadt';
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
  const target = game.validTiles('p0').dorf[0];
  assert.throws(() => game.build('p0', { type: 'dorf', tileId: target }), /Nicht genug/);

  p0.resources = { holz: 5, stein: 5, nahrung: 5, erz: 5 };
  game.build('p0', { type: 'dorf', tileId: target });
  assert.deepEqual(p0.resources, { holz: 4, stein: 4, nahrung: 4, erz: 5 });
  assert.equal(game.points('p0'), 3);

  game.build('p0', { type: 'stadt', tileId: target });
  assert.equal(game.getTile(target).building.type, 'stadt');
  assert.equal(game.points('p0'), 4);

  const far = game.tiles.find((t) => !t.building && !game.reachableByLand(t, 'p0') && game.isPlayable(t));
  assert.throws(() => game.build('p0', { type: 'dorf', tileId: far.id }), GameError);
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

test('Rundenlimit (optional): danach gewinnt die höchste Punktzahl', () => {
  const game = newGame(3);
  game.start('p0');
  finishSetup(game);
  for (let i = 0; i < 20 * 3; i++) {
    const current = game.currentPlayer();
    game.roll(current.id);
    game.endTurn(current.id);
  }
  assert.equal(game.phase, 'ended');
  assert.equal(game.finishReason, 'runden');
  assert.equal(game.results.length, 3);
  assert.ok(game.results[0].points >= game.results[1].points);
});

test('Siegbedingung: Punkteziel am Ende des eigenen Zuges', () => {
  const game = newGame(2);
  game.setVictory('p0', { target: 10, roundLimit: 0 });
  game.start('p0');
  finishSetup(game);
  const free = game.tiles.filter((t) => !t.building && game.isPlayable(t));
  // p1 hat schon genug Punkte, gewinnt aber erst am Ende seines eigenen Zuges
  for (const t of free.slice(0, 4)) t.building = { type: 'monument', owner: 'p1' };
  game.roll('p0');
  game.endTurn('p0');
  assert.equal(game.phase, 'main');
  game.roll('p1');
  game.endTurn('p1');
  assert.equal(game.phase, 'ended');
  assert.equal(game.finishReason, 'punkte');
  assert.equal(game.results[0].id, 'p1');
  assert.equal(game.gameRecord().winner, 'Spieler 1');
});

test('Siegbedingung: wählbar je Variante', () => {
  const game = newGame(2);
  assert.throws(() => game.setVictory('p0', { mode: 'vernichtung' }), /passt nicht/);
  assert.throws(() => game.setVictory('p0', { target: 7 }), /Punkteziel/);
  assert.throws(() => game.setVictory('p0', { roundLimit: 8 }), /Rundenlimit/);
  assert.throws(() => game.setVictory('p1', { target: 15 }), /Gastgeber/);
  game.setVariant('p0', { variant: 'eroberung' });
  assert.equal(game.victory.mode, 'punkte_vernichtung');
  game.setVictory('p0', { mode: 'vernichtung' });
  assert.match(game.victoryText(), /^alle Gegner besiegen/);
  game.setVariant('p0', { variant: 'klassisch' });
  assert.equal(game.victory.mode, 'punkte');
});

test('Ohne Rundenlimit: Abstimmung nach 150 Runden, danach alle 25', () => {
  const game = newGame(3);
  game.setVictory('p0', { roundLimit: 0 });
  game.start('p0');
  finishSetup(game);
  assert.equal(game.isVoteRound(151), true);
  assert.equal(game.isVoteRound(152), false);
  assert.equal(game.isVoteRound(176), true);
  game.round = 150;
  game.currentIndex = 2;
  game.roll('p2');
  game.endTurn('p2');
  assert.equal(game.round, 151);
  assert.ok(game.vote);
  assert.throws(() => game.roll('p0'), /abstimmen/);
  // Gleichstand bei getrenntem dritten Spieler → es geht weiter
  game.setConnected('p2', false);
  game.castVote('p0', { choice: 'ende' });
  assert.ok(game.vote, 'wartet, bis alle verbundenen Spieler abgestimmt haben');
  game.castVote('p1', { choice: 'weiter' });
  assert.equal(game.vote, null);
  assert.equal(game.phase, 'main');
  game.roll('p0');
  // Nächste Abstimmung: Mehrheit für Beenden
  game.setConnected('p2', true);
  game.round = 175;
  game.currentIndex = 2;
  game.hasRolled = false;
  game.roll('p2');
  game.endTurn('p2');
  game.castVote('p0', { choice: 'ende' });
  game.castVote('p1', { choice: 'weiter' });
  game.castVote('p2', { choice: 'ende' });
  assert.equal(game.phase, 'ended');
  assert.equal(game.finishReason, 'abstimmung');
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

// Kleine Testkarte: Insel A (links), Wasserstraße, Insel B (rechts).
//   A A ~ ~ B B
function waterGame() {
  const tiles = [
    { q: 0, r: 0, terrain: 'wald' }, { q: 1, r: 0, terrain: 'acker' },
    { q: 2, r: 0, terrain: 'wasser' }, { q: 3, r: 0, terrain: 'wasser' },
    { q: 4, r: 0, terrain: 'mine' }, { q: 5, r: 0, terrain: 'steinbruch' },
    ...Array.from({ length: 10 }, (_, i) => ({ q: i - 2, r: 3, terrain: 'acker' })),
  ];
  const game = newGame(2, seeded(3), { kind: 'custom', map: { name: 'Test', tiles } });
  game.start('p0');
  for (const t of game.tiles) t.building = null;
  game.phase = 'main';
  game.round = 1;
  game.setupQueue = [];
  game.hasRolled = true;
  game.getTile('0,0').building = { type: 'dorf', owner: 'p0' };
  game.players[0].resources = { holz: 20, stein: 20, nahrung: 20, erz: 20 };
  return game;
}

test('Wasser: Hafen nur an der Küste, Schiffe verbinden Inseln', () => {
  const game = waterGame();
  const valid = (type) => game.validTiles('p0')[type];
  assert.deepEqual(valid('dorf'), ['1,0']);
  assert.deepEqual(valid('schiff'), []);
  assert.deepEqual(valid('hafen'), ['1,0']);
  assert.ok(!valid('dorf').includes('2,0'), 'Auf Wasser darf kein Dorf stehen');

  game.build('p0', { type: 'hafen', tileId: '1,0' });
  assert.deepEqual(valid('schiff'), ['2,0']);
  game.build('p0', { type: 'schiff', tileId: '2,0' });
  assert.deepEqual(valid('schiff'), ['3,0']);
  assert.ok(!valid('dorf').includes('4,0'), 'Insel B ist noch nicht erreicht');
  game.build('p0', { type: 'schiff', tileId: '3,0' });
  assert.ok(valid('dorf').includes('4,0'));
  game.build('p0', { type: 'dorf', tileId: '4,0' });
  assert.equal(game.points('p0'), 3);
});

test('Wasser: Fischerei produziert Nahrung, wenn ihre Region gewürfelt wird', () => {
  const game = waterGame();
  assert.deepEqual(game.validTiles('p0').fischerei, []);
  game.build('p0', { type: 'dorf', tileId: '1,0' });
  game.build('p0', { type: 'fischerei', tileId: '2,0' });
  assert.ok(!game.validTiles('p0').dorf.includes('4,0'), 'Fischerei verlängert die Reichweite nicht');

  for (const t of game.tiles) if (t.id !== '2,0') t.building = null;
  const region = game.getTile('2,0').region;
  game.endTurn('p0');
  game.players[0].resources.nahrung = 0;
  game.rng = scripted([region, 1]); // Region der Fischerei, Gelände Wald
  game.roll('p1');
  assert.equal(game.players[0].resources.nahrung, 1);
});

// ---------- Eroberungs-Variante ----------

// Streifen aus Landfeldern: 0,0 … 7,0 (alle Acker), dazu eine zweite Reihe als Reserve.
function conquestGame() {
  const tiles = Array.from({ length: 16 }, (_, i) => ({ q: i % 8, r: Math.floor(i / 8) * 3, terrain: 'acker' }));
  const game = newGame(2, seeded(5), { kind: 'custom', map: { name: 'Front', tiles } });
  game.setVariant('p0', { variant: 'eroberung' });
  game.start('p0');
  for (const t of game.tiles) { t.building = null; t.troops = 0; }
  game.phase = 'main';
  game.round = 3;
  game.setupQueue = [];
  game.hasRolled = true;
  game.resetTurnLimits();
  for (const p of game.players) p.resources = { holz: 20, stein: 20, nahrung: 20, erz: 20 };
  const put = (id, type, owner, troops = 0) => {
    const tile = game.getTile(id);
    tile.building = { type, owner };
    tile.troops = troops;
    return tile;
  };
  return { game, put };
}

test('Eroberung: nur als Variante, Wachturm und Limes nur dort baubar', () => {
  const game = newGame(2);
  assert.throws(() => game.setVariant('p1', { variant: 'eroberung' }), /Gastgeber/);
  assert.throws(() => game.setVariant('p0', { variant: 'krieg' }), GameError);
  game.start('p0');
  finishSetup(game);
  game.roll('p0');
  assert.equal(game.validTiles('p0').wachturm, undefined);
  assert.equal(game.publicState('p0').buildings.limes, undefined);
  assert.throws(() => game.recruit('p0', { tileId: game.tiles.find((t) => t.building).id }), /Eroberungs-Variante/);

  const conquest = newGame(2);
  conquest.setVariant('p0', { variant: 'eroberung' });
  conquest.start('p0');
  finishSetup(conquest);
  assert.ok(conquest.tiles.filter((t) => t.building).every((t) => t.troops === 1), 'Start-Siedlungen haben 1 Truppe');
  conquest.roll('p0');
  assert.ok(Array.isArray(conquest.validTiles('p0').wachturm));
});

test('Eroberung: rekrutieren, verlegen, Limits', () => {
  const { game, put } = conquestGame();
  put('0,0', 'dorf', 'p0', 0);
  put('1,0', 'stadt', 'p0', 5);
  put('5,0', 'dorf', 'p1');
  put('7,0', 'dorf', 'p1');
  game.recruit('p0', { tileId: '0,0' });
  assert.equal(game.getTile('0,0').troops, 1);
  assert.equal(game.players[0].resources.erz, 19);
  game.recruit('p0', { tileId: '1,0' });
  assert.throws(() => game.recruit('p0', { tileId: '1,0' }), /Maximal 6/);
  assert.throws(() => game.recruit('p0', { tileId: '5,0' }), GameError);

  game.moveTroops('p0', { from: '1,0', to: '0,0', count: 3 });
  assert.equal(game.getTile('0,0').troops, 4);
  assert.throws(() => game.moveTroops('p0', { from: '0,0', to: '1,0', count: 1 }), /Keine Verlegung/);
});

test('Eroberung: Schonfrist und stationäre Truppen im Kampf', () => {
  const { game, put } = conquestGame();
  put('2,0', 'dorf', 'p0', 4);
  const village = put('3,0', 'dorf', 'p1', 0);
  put('7,0', 'dorf', 'p1');

  game.round = 2;
  assert.throws(() => game.attack('p0', { from: '2,0', to: '3,0', count: 4 }), /ab Runde 3/);
  game.round = 3;

  // 4 + 2 = 6 gegen 0 Truppen + 1 stationär (Dorf) + 5 = 6 -> Gleichstand, Verteidiger gewinnt
  game.rng = scripted([2, 5]);
  game.attack('p0', { from: '2,0', to: '3,0', count: 4 });
  assert.equal(game.lastBattle.defenseStationary, 1);
  assert.equal(game.lastBattle.attackerWins, false);
  assert.equal(game.getTile('2,0').troops, 0);
  assert.equal(village.building.owner, 'p1');
  assert.equal(game.players[0].resources.nahrung, 19, 'Angriff kostet 1 Nahrung');
});

test('Eroberung: Sieg übernimmt das Gebäude, Verluste nach Regel', () => {
  const { game, put } = conquestGame();
  put('2,0', 'dorf', 'p0', 5);
  const city = put('3,0', 'stadt', 'p1', 2);
  put('7,0', 'dorf', 'p1');
  // 5 + 6 = 11 gegen 2 + 2 (Stadt stationär) + 1 = 5 -> Angreifer gewinnt, verliert ceil(2/2) = 1
  game.rng = scripted([6, 1]);
  game.attack('p0', { from: '2,0', to: '3,0', count: 5 });
  assert.equal(game.lastBattle.attackerWins, true);
  assert.equal(city.building.owner, 'p0');
  assert.equal(city.troops, 4);
  assert.equal(game.points('p0'), 3);
  assert.equal(game.points('p1'), 1);
  // Mit Vernichtung als Siegbedingung darf auch das letzte Gebäude fallen.
  put('6,0', 'dorf', 'p0', 3);
  assert.equal(game.canAttack(game.getTile('6,0'), game.getTile('7,0'), 'p0'), true);
});

test('Eroberung: Wer kein Landgebäude mehr hat, ist besiegt; der Letzte gewinnt', () => {
  const { game, put } = conquestGame();
  game.players.push({ id: 'p2', name: 'Dritter', color: '#000', resources: { holz: 0, stein: 0, nahrung: 0, erz: 0 },
    connected: true, removed: false, stats: game.players[0].stats && { ...game.players[0].stats, built: {} } });
  put('2,0', 'dorf', 'p0', 6);
  put('3,0', 'dorf', 'p1', 0);
  put('7,0', 'dorf', 'p2', 0);
  game.rng = scripted([6, 1]);
  game.attack('p0', { from: '2,0', to: '3,0', count: 6 });
  assert.equal(game.players[1].eliminated, true);
  assert.equal(game.phase, 'main', 'p2 ist noch im Spiel');
  game.endTurn('p0');
  assert.equal(game.currentPlayer().id, 'p2', 'Besiegte werden übersprungen');

  // Nur Vernichtung: Punkte beenden das Spiel nicht
  const other = conquestGame();
  other.game.victory = { mode: 'vernichtung', target: 10, roundLimit: 0 };
  for (const id of ['0,0', '1,0', '2,0', '3,0']) other.put(id, 'monument', 'p0', 0);
  other.put('2,3', 'dorf', 'p0', 6);
  other.put('3,3', 'dorf', 'p1', 0);
  other.game.endTurn('p0');
  assert.equal(other.game.phase, 'main');
  other.game.hasRolled = true;
  other.game.endTurn('p1');
  other.game.hasRolled = true;
  other.game.rng = scripted([6, 1]);
  other.game.attack('p0', { from: '2,3', to: '3,3', count: 6 });
  assert.equal(other.game.phase, 'ended');
  assert.equal(other.game.finishReason, 'vernichtung');
  assert.equal(other.game.results[0].id, 'p0');
});

test('Eroberung: Wachturm stärkt Nachbarn, Limes schirmt Nachbarn ab', () => {
  const { game, put } = conquestGame();
  put('2,0', 'dorf', 'p0', 3);
  put('3,0', 'dorf', 'p1', 0);
  put('4,0', 'wachturm', 'p1', 0);
  put('7,0', 'dorf', 'p1');
  assert.deepEqual(game.defenseOf(game.getTile('3,0')), { troops: 0, stationary: 1, tower: 1 });
  assert.deepEqual(game.defenseOf(game.getTile('4,0')), { troops: 0, stationary: 2, tower: 0 });

  // Limes neben dem Dorf: Dorf ist geschützt, der Limes selbst angreifbar.
  put('4,0', 'limes', 'p1', 0);
  assert.equal(game.canAttack(game.getTile('2,0'), game.getTile('3,0'), 'p0'), false);
  const options = game.militaryOptions('p0');
  assert.deepEqual(options.sources['2,0'].attack, []);
  put('3,0', 'dorf', 'p0', 3);
  assert.deepEqual(game.militaryOptions('p0').sources['3,0'].attack, ['4,0']);
});

test('Eroberung: Angriffe über eigene Schiffe', () => {
  const tiles = [
    { q: 0, r: 0, terrain: 'acker' }, { q: 1, r: 0, terrain: 'wasser' }, { q: 2, r: 0, terrain: 'acker' },
    ...Array.from({ length: 12 }, (_, i) => ({ q: i - 3, r: 4, terrain: 'acker' })),
  ];
  const game = newGame(2, seeded(9), { kind: 'custom', map: { name: 'Meerenge', tiles } });
  game.setVariant('p0', { variant: 'eroberung' });
  game.start('p0');
  for (const t of game.tiles) { t.building = null; t.troops = 0; }
  Object.assign(game, { phase: 'main', round: 3, setupQueue: [], hasRolled: true });
  game.resetTurnLimits();
  game.players[0].resources = { holz: 5, stein: 5, nahrung: 5, erz: 5 };
  game.getTile('0,0').building = { type: 'hafen', owner: 'p0' };
  game.getTile('0,0').troops = 3;
  game.getTile('2,0').building = { type: 'dorf', owner: 'p1' };
  game.getTile('-3,4').building = { type: 'dorf', owner: 'p1' };
  assert.equal(game.canAttack(game.getTile('0,0'), game.getTile('2,0'), 'p0'), false);
  game.getTile('1,0').building = { type: 'schiff', owner: 'p0' };
  assert.equal(game.canAttack(game.getTile('0,0'), game.getTile('2,0'), 'p0'), true);
});

// ---------- Räume: Entfernen, Host-Übergabe, Nochmal spielen, Sicherung ----------

function fakeClock() {
  let now = Date.parse('2026-10-30T12:00:00Z');
  const timers = [];
  return {
    now: () => now,
    setTimeout: (fn, ms) => { const t = { fn, at: now + ms }; timers.push(t); return t; },
    clearTimeout: (t) => { const i = timers.indexOf(t); if (i >= 0) timers.splice(i, 1); },
    advance(ms) {
      now += ms;
      for (const t of timers.filter((x) => x.at <= now)) { timers.splice(timers.indexOf(t), 1); t.fn(); }
    },
  };
}

function playToEnd(game) {
  while (game.phase === 'main') {
    const current = game.currentPlayer();
    game.roll(current.id);
    game.endTurn(current.id);
  }
}

test('Räume: Gastgeber entfernt Spieler in Lobby und Spiel', () => {
  const game = newGame(3);
  assert.throws(() => game.kick('p1', { playerId: 'p2' }), /Gastgeber/);
  assert.throws(() => game.kick('p0', { playerId: 'p0' }), /selbst/);
  game.kick('p0', { playerId: 'p2' });
  assert.equal(game.players.length, 2);

  game.addPlayer('p3', 'Dritter');
  game.start('p0');
  finishSetup(game);
  // p1 ist als Nächstes dran – wird entfernt, während p0 am Zug ist
  game.kick('p0', { playerId: 'p1' });
  game.roll('p0');
  game.endTurn('p0');
  assert.equal(game.currentPlayer().id, 'p3', 'entfernte Spieler werden übersprungen');
  // Aktueller Spieler wird entfernt → Zug geht sofort weiter
  game.kick('p0', { playerId: 'p3' });
  assert.equal(game.currentPlayer().id, 'p0');
  assert.equal(game.round, 2);
  playToEnd(game);
  assert.equal(game.results.at(-1).removed, true);
});

test('Räume: Host-Übergabe erst nach Wartezeit', () => {
  const clock = fakeClock();
  const game = new Game('TEST', seeded(1), { clock });
  let changes = 0;
  game.onChange = () => changes++;
  game.addPlayer('p0', 'A');
  game.addPlayer('p1', 'B');
  game.setConnected('p0', false);
  clock.advance(5_000);
  game.setConnected('p0', true); // nur neu geladen
  clock.advance(20_000);
  assert.equal(game.hostId, 'p0');
  game.setConnected('p0', false);
  clock.advance(16_000);
  assert.equal(game.hostId, 'p1');
  assert.equal(changes, 1);
});

test('Räume: Nochmal spielen per Abstimmung, Host kann direkt starten oder zurück in die Lobby', () => {
  const game = newGame(3);
  const records = [];
  game.onFinished = (r) => records.push(r);
  game.start('p0');
  finishSetup(game);
  playToEnd(game);
  assert.equal(records.length, 1);
  assert.equal(records[0].players.length, 3);
  assert.equal(records[0].variant, 'klassisch');

  game.voteRematch('p0', { vote: true });
  game.voteRematch('p1', { vote: true });
  game.voteRematch('p1', { vote: false });
  game.setConnected('p2', false); // Getrennte Spieler müssen nicht zustimmen
  assert.equal(game.phase, 'ended');
  game.voteRematch('p1', { vote: true });
  assert.equal(game.phase, 'setup');
  assert.equal(game.victory.roundLimit, 20);
  assert.equal(game.recorded, false);

  finishSetup(game);
  playToEnd(game);
  assert.equal(records.length, 2);
  game.backToLobby('p0');
  assert.equal(game.phase, 'lobby');
  game.start('p0');
  assert.equal(game.phase, 'setup');
});

test('Räume: Sicherung und Wiederherstellung mitten im Spiel', () => {
  const game = newGame(2, seeded(4), { kind: 'random' });
  game.setVariant('p0', { variant: 'eroberung' });
  game.start('p0');
  finishSetup(game);
  game.roll('p0');
  const snap = JSON.parse(JSON.stringify(game.snapshot()));
  const restored = Game.restore(snap, seeded(4), { clock: fakeClock() });
  assert.equal(restored.phase, 'main');
  assert.equal(restored.hasRolled, true);
  assert.ok(restored.players.every((p) => !p.connected));
  assert.deepEqual(restored.publicState('p0').tiles, game.publicState('p0').tiles);
  restored.setConnected('p0', true);
  restored.endTurn('p0');
  assert.equal(restored.currentPlayer().id, 'p1');
  assert.equal(Game.restore({ ...snap, version: 99 }), null);
});

// ---------- Teams ----------

function teamGame(teams, variant = 'klassisch') {
  const game = newGame(teams.length);
  if (variant !== 'klassisch') game.setVariant('p0', { variant });
  game.setTeamsEnabled('p0', { enabled: true });
  teams.forEach((team, i) => game.setTeam(`p${i}`, { team }));
  return game;
}

test('Teams: jeder wählt selbst, Gastgeber hat Veto, Start nur mit gültigen Teams', () => {
  const game = newGame(4);
  assert.throws(() => game.setTeam('p1', { team: 'A' }), /nicht aktiviert/);
  assert.throws(() => game.setTeamsEnabled('p1', { enabled: true }), /Gastgeber/);
  game.setTeamsEnabled('p0', { enabled: true });
  game.setTeam('p1', { team: 'A' });
  assert.throws(() => game.setTeam('p1', { playerId: 'p2', team: 'A' }), /Gastgeber/);
  assert.throws(() => game.setTeam('p1', { team: 'Z' }), /Unbekanntes Team/);
  game.setTeam('p0', { playerId: 'p1', team: 'B' }); // Veto des Gastgebers
  assert.equal(game.getPlayer('p1').team, 'B');
  assert.throws(() => game.start('p0'), /Team wählen/);
  for (const id of ['p0', 'p2', 'p3']) game.setTeam(id, { team: 'B' });
  assert.throws(() => game.start('p0'), /zwei Teams/);
  game.setTeamsEnabled('p0', { enabled: false });
  assert.ok(game.players.every((p) => p.team === null));
});

test('Teams: Zugreihenfolge abwechselnd, auch bei ungleichen Teams', () => {
  const game = teamGame(['A', 'A', 'B', 'B']);
  game.start('p0');
  assert.deepEqual(game.players.map((p) => p.id), ['p0', 'p2', 'p1', 'p3']);
  const uneven = teamGame(['A', 'A', 'A', 'B']);
  uneven.start('p0');
  assert.deepEqual(uneven.players.map((p) => p.team), ['A', 'B', 'A', 'A']);
});

test('Teams: Punkte werden addiert, Ziel wächst mit der Teamgröße', () => {
  const game = teamGame(['A', 'B', 'A']); // A hat 2 Mitglieder, B eines
  game.setVictory('p0', { target: 10, roundLimit: 0 });
  game.start('p0');
  finishSetup(game);
  assert.equal(game.teamTarget('team:A'), 20);
  assert.equal(game.teamTarget('team:B'), 10);
  const free = game.tiles.filter((t) => !t.building && game.isPlayable(t));
  // Team A: 2 Start-Siedlungen je Spieler (4) + 5 Monumente (15) = 19 → noch nicht am Ziel
  for (const t of free.slice(0, 5)) t.building = { type: 'monument', owner: 'p2' };
  const current = game.currentPlayer();
  game.roll(current.id);
  game.endTurn(current.id);
  assert.equal(game.phase, 'main');
  free[5].building = { type: 'dorf', owner: 'p0' }; // 20 Punkte
  while (game.teamOf(game.currentPlayer().id) !== 'team:A') {
    game.roll(game.currentPlayer().id);
    game.endTurn(game.currentPlayer().id);
  }
  const a = game.currentPlayer();
  game.roll(a.id);
  game.endTurn(a.id);
  assert.equal(game.phase, 'ended');
  assert.equal(game.winnerTeam, 'team:A');
  const record = game.gameRecord();
  assert.deepEqual(record.winners.sort(), ['Spieler 0', 'Spieler 2']);
  assert.ok(record.players.every((p) => p.team));
});

test('Teams: keine Angriffe auf Partner, Verlegen zum Partner, Angriff über Partner-Schiffe', () => {
  const tiles = [
    { q: 0, r: 0, terrain: 'acker' }, { q: 1, r: 0, terrain: 'acker' }, { q: 2, r: 0, terrain: 'wasser' },
    { q: 3, r: 0, terrain: 'acker' },
    ...Array.from({ length: 16 }, (_, i) => ({ q: i - 4, r: 4, terrain: 'acker' })),
  ];
  const game = newGame(3, seeded(2), { kind: 'custom', map: { name: 'Bucht', tiles } });
  game.setVariant('p0', { variant: 'eroberung' });
  game.setTeamsEnabled('p0', { enabled: true });
  game.setTeam('p0', { team: 'A' });
  game.setTeam('p1', { team: 'A' });
  game.setTeam('p2', { team: 'B' });
  game.start('p0');
  for (const t of game.tiles) { t.building = null; t.troops = 0; }
  Object.assign(game, { phase: 'main', round: 3, setupQueue: [], hasRolled: true });
  game.currentIndex = game.players.findIndex((p) => p.id === 'p0');
  game.resetTurnLimits();
  game.getPlayer('p0').resources = { holz: 9, stein: 9, nahrung: 9, erz: 9 };
  const put = (id, type, owner, troops = 0) => {
    Object.assign(game.getTile(id), { building: { type, owner }, troops });
  };
  put('0,0', 'dorf', 'p0', 4);
  put('1,0', 'hafen', 'p1', 0);
  put('2,0', 'schiff', 'p1');
  put('3,0', 'dorf', 'p2', 0);
  put('-4,4', 'dorf', 'p2', 0);
  const from = game.getTile('0,0');
  assert.equal(game.canAttack(from, game.getTile('1,0'), 'p0'), false, 'Partner nicht angreifbar');
  assert.equal(game.canMove(from, game.getTile('1,0'), 'p0'), true, 'Verlegen zum Partner');
  game.moveTroops('p0', { from: '0,0', to: '1,0', count: 2 });
  assert.equal(game.getTile('1,0').troops, 2);
  assert.equal(game.canAttack(game.getTile('1,0'), game.getTile('3,0'), 'p0'), true, 'über das Schiff des Partners');
});

test('Teams: Rohstoffe von Teammitgliedern sind sichtbar, von Gegnern nicht', () => {
  const game = teamGame(['A', 'A', 'B']);
  game.start('p0');
  const seen = (viewer, id) => game.publicState(viewer).players.find((p) => p.id === id).resources;
  assert.deepEqual(seen('p0', 'p1'), game.getPlayer('p1').resources);
  assert.equal(seen('p0', 'p2'), null);
  assert.equal(seen('p2', 'p0'), null);
  const solo = newGame(2);
  solo.start('p0');
  assert.equal(solo.publicState('p0').players.find((p) => p.id === 'p1').resources, null);
});

test('Teams: Bank 2:1, wenn man selbst und ein Teammitglied je einen Hafen haben', () => {
  const game = teamGame(['A', 'A', 'B']);
  game.start('p0');
  finishSetup(game);
  const coast = game.tiles.filter((t) => !t.building && game.isPlayable(t));
  assert.equal(game.bankRate('p0'), 3);
  coast[0].building = { type: 'hafen', owner: 'p0' };
  assert.equal(game.bankRate('p0'), 3, 'nur ein Hafen im Team');
  coast[1].building = { type: 'hafen', owner: 'p2' }; // Gegner zählt nicht
  assert.equal(game.bankRate('p0'), 3);
  coast[2].building = { type: 'hafen', owner: 'p1' };
  assert.equal(game.bankRate('p0'), 2);
  assert.equal(game.bankRate('p1'), 2);
  assert.equal(game.bankRate('p2'), 3);
});

test('Teams: ein Team ist erst besiegt, wenn alle Mitglieder besiegt sind', () => {
  const { game, put } = conquestGame();
  game.players.push({ id: 'p2', name: 'Dritter', color: '#000', resources: { holz: 0, stein: 0, nahrung: 0, erz: 0 },
    connected: true, removed: false, team: 'B', stats: { built: {}, recruited: 0, attacks: 0, attacksWon: 0, defenses: 0, defensesWon: 0, conquered: 0, lost: 0, trades: 0 } });
  game.teamsEnabled = true;
  game.getPlayer('p0').team = 'A';
  game.getPlayer('p1').team = 'B';
  put('2,0', 'dorf', 'p0', 6);
  put('3,0', 'dorf', 'p1', 0);
  put('7,0', 'dorf', 'p2', 0);
  game.rng = scripted([6, 1]);
  game.attack('p0', { from: '2,0', to: '3,0', count: 6 });
  assert.equal(game.getPlayer('p1').eliminated, true);
  assert.equal(game.phase, 'main', 'Teampartner p2 ist noch im Spiel');
});

test('Sicherung mit alten Gebäudenamen (siedlung/gut) wird beim Laden umgerechnet', () => {
  const game = newGame(2);
  game.start('p0');
  finishSetup(game);
  const snap = JSON.parse(JSON.stringify(game.snapshot()));
  // So sah eine Sicherung vor F-011 aus
  snap.version = 3;
  for (const t of snap.tiles) if (t.building) t.building.type = 'siedlung';
  snap.tiles.find((t) => t.building).building.type = 'gut';
  snap.players[0].stats.built = { siedlung: 2, gut: 1 };
  const restored = Game.restore(snap, seeded(1), { clock: fakeClock() });
  const types = restored.tiles.filter((t) => t.building).map((t) => t.building.type);
  assert.ok(types.includes('stadt') && types.includes('dorf') && !types.includes('siedlung') && !types.includes('gut'));
  assert.deepEqual(restored.players[0].stats.built, { dorf: 2, stadt: 1 });
});
