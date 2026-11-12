'use strict';

/**
 * Automatisierte Testpartien mit Computergegnern über alle Varianten, Karten, Siegbedingungen und Teams.
 *
 *   npm run simulate              # Standard: 3 Partien je Kombination
 *   npm run simulate -- 10        # 10 Partien je Kombination
 *
 * Beendet sich mit Fehlercode 1, wenn eine Partie nicht zu Ende kommt, eine Regel verletzt wird
 * oder ein Computergegner eine ungültige Aktion versucht.
 */

const { simulateGame } = require('../server/simulate');

const runs = Number(process.argv[2]) || 3;
const MAPS = [
  { kind: 'random' }, { kind: 'kontinent' },
  { kind: 'preset', id: 'zwillingsinseln' }, { kind: 'preset', id: 'lagune' }, { kind: 'preset', id: 'inselkette' },
];
const SETUPS = [
  { name: 'klassisch, 2 Spieler', players: 2 },
  { name: 'klassisch, 4 Spieler, Ziel 20', players: 4, target: 20 },
  { name: 'klassisch, 6 Spieler', players: 6 },
  { name: 'klassisch, Teams 2:2', players: 4, teams: ['A', 'A', 'B', 'B'] },
  { name: 'Eroberung, Punkte+Vernichtung', players: 3, variant: 'eroberung', target: 20 },
  { name: 'Eroberung, nur Vernichtung', players: 3, variant: 'eroberung', mode: 'vernichtung' },
  { name: 'Eroberung, Teams 2:1', players: 3, variant: 'eroberung', target: 20, teams: ['A', 'B', 'A'] },
  { name: 'Eroberung, 6 Spieler, Teams 3:3', players: 6, variant: 'eroberung', mode: 'vernichtung', teams: ['A', 'B', 'A', 'B', 'A', 'B'] },
];

let failures = 0;
const actions = {};
const reasons = {};
let games = 0;
const started = Date.now();

for (const setup of SETUPS) {
  for (const map of MAPS) {
    for (let run = 0; run < runs; run++) {
      const seed = 1000 * games + run + 1;
      const label = `${setup.name} | ${map.id || map.kind} | Seed ${seed}`;
      let result;
      try {
        result = simulateGame({ ...setup, map, seed });
      } catch (err) {
        failures++;
        console.log(`✗ ${label}: Absturz – ${err.stack}`);
        games++;
        continue;
      }
      games++;
      reasons[result.reason] = (reasons[result.reason] || 0) + 1;
      for (const [a, n] of Object.entries(result.stats.actions)) actions[a] = (actions[a] || 0) + n;
      const problems = [
        ...(result.finished ? [] : [`nicht beendet nach ${result.steps} Schritten (Runde ${result.rounds})`]),
        ...result.violations,
        ...result.stats.errors.map((e) => `ungültige Bot-Aktion ${e.action} (Runde ${e.round}): ${e.message}`),
      ];
      if (problems.length) {
        failures++;
        console.log(`✗ ${label}`);
        for (const p of problems.slice(0, 5)) console.log(`    ${p}`);
      }
    }
  }
}

console.log(`\n${games} Partien in ${((Date.now() - started) / 1000).toFixed(1)} s, ${failures} mit Problemen.`);
console.log('Spielende:', reasons);
console.log('Ausgeführte Aktionen:', Object.fromEntries(Object.entries(actions).sort(([a], [b]) => a.localeCompare(b))));
process.exit(failures ? 1 : 0);
