'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { Game } = require('../server/game');
const { simulateGame } = require('../server/simulate');

// Ein kleiner Ausschnitt aus scripts/simulate.js (dort laufen alle Kombinationen).
const CASES = [
  { name: 'klassisch, Inselgruppe', players: 3 },
  { name: 'klassisch, Teams 2:2', players: 4, teams: ['A', 'A', 'B', 'B'], map: { kind: 'kontinent' } },
  { name: 'Eroberung, Punkte+Vernichtung', players: 3, variant: 'eroberung', target: 20, map: { kind: 'kontinent' } },
  { name: 'Eroberung, nur Vernichtung, Teams', players: 4, variant: 'eroberung', mode: 'vernichtung', teams: ['A', 'B', 'A', 'B'] },
];

for (const c of CASES) {
  test(`Computergegner spielen eine ganze Partie: ${c.name}`, () => {
    for (const seed of [1, 2]) {
      const result = simulateGame({ ...c, seed });
      assert.equal(result.finished, true, `Seed ${seed}: nicht beendet`);
      assert.deepEqual(result.violations, [], `Seed ${seed}`);
      assert.deepEqual(result.stats.errors, [], `Seed ${seed}: ungültige Bot-Aktionen`);
      assert.ok(result.stats.actions['würfeln'] > 0);
    }
  });
}

test('Computergegner: nur der Gastgeber fügt sie hinzu, sie werden nie Gastgeber und stimmen nicht ab', () => {
  const game = new Game('BOTS');
  game.addPlayer('h', 'Mensch');
  game.addPlayer('g', 'Gast');
  assert.throws(() => game.addBot('g'), /Gastgeber/);
  const id = game.addBot('h');
  assert.equal(game.getPlayer(id).name, 'Computer 1');
  assert.equal(game.getPlayer(game.addBot('h')).name, 'Computer 2');
  game.kick('h', { playerId: id });
  assert.equal(game.players.some((p) => p.id === id), false, 'Bots lassen sich entfernen');
  game.removePlayer('h');
  assert.equal(game.hostId, 'g', 'Gastgeber geht an einen Menschen, nicht an einen Bot');
  game.setConnected(game.players.find((p) => p.bot).id, false);
  assert.ok(game.players.find((p) => p.bot).connected, 'Bots bleiben verbunden');
  assert.deepEqual(game.voters().map((p) => p.id), ['g'], 'nur Menschen stimmen ab');
});
