'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { computeStats } = require('../server/stats');

const stats = (o = {}) => ({ built: {}, conquered: 0, lost: 0, attacks: 0, attacksWon: 0, trades: 0, ...o });
const games = [
  {
    endedAt: '2026-10-01T10:00:00Z', variant: 'klassisch', rounds: 12, map: { kind: 'random', name: 'Zufällige Inselgruppe' },
    players: [
      { name: 'Anna', points: 14, stats: stats({ built: { dorf: 6 }, trades: 3 }) },
      { name: 'Ben', points: 11, stats: stats({ built: { dorf: 4 } }) },
    ],
  },
  {
    endedAt: '2026-10-02T10:00:00Z', variant: 'eroberung', rounds: 8, map: { kind: 'preset', name: 'Lagune' },
    players: [
      { name: 'anna', points: 9, stats: stats({ conquered: 1, attacks: 2, attacksWon: 1 }) },
      { name: 'Ben', points: 10, stats: stats({ conquered: 3, attacks: 3, attacksWon: 3 }) },
      { name: 'Cleo', points: 12, removed: true, stats: stats() },
    ],
  },
];

test('Statistik: Rekorde, Spielertabelle und Filter', () => {
  const all = computeStats(games);
  assert.equal(all.games, 2);
  assert.equal(all.records.bestGame.points, 14);
  assert.equal(all.records.mostConquests.player, 'Ben');
  assert.equal(all.records.closestWin.margin, 1);
  const anna = all.players.find((p) => p.name === 'anna'); // Groß-/Kleinschreibung egal, letzte Schreibweise
  assert.equal(anna.games, 2);
  assert.equal(anna.wins, 1);
  const ben = all.players.find((p) => p.name === 'Ben');
  assert.equal(ben.wins, 1, 'entfernte Spieler gewinnen nicht');
  assert.equal(ben.attackRate, 100);

  const conquest = computeStats(games, { variant: 'eroberung' });
  assert.equal(conquest.games, 1);
  assert.deepEqual(conquest.maps.map((m) => m.name), ['Lagune']);

  const onlyBen = computeStats(games, { player: 'BEN' });
  assert.deepEqual(onlyBen.players.map((p) => p.name), ['Ben']);
});
