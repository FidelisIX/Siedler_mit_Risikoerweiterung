'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const rules = require('../docs/risiko/regeln.json');

const { continents, territories } = rules.map;
const byId = new Map(territories.map((t) => [t.id, t]));

test('Spielplan hat 6 Kontinente und 42 Gebiete mit eindeutigen IDs', () => {
  assert.equal(continents.length, 6);
  assert.equal(territories.length, 42);
  assert.equal(byId.size, 42);
});

test('Nachbarschaften sind symmetrisch und ergeben 83 Verbindungen', () => {
  const edges = new Set();
  for (const t of territories) {
    for (const n of t.neighbors) {
      assert.ok(byId.has(n), `${t.id} → unbekanntes Gebiet ${n}`);
      assert.ok(byId.get(n).neighbors.includes(t.id), `${t.id} ↔ ${n} nicht symmetrisch`);
      edges.add([t.id, n].sort().join('|'));
    }
  }
  assert.equal(edges.size, 83);
  assert.equal(rules.map.edge_count, 83);
});

test('Kontinente passen zu Gebieten und Außengrenzen', () => {
  const expected = {
    north_america: [9, 3, 5], south_america: [4, 2, 2], europe: [7, 4, 5],
    africa: [6, 3, 3], asia: [12, 5, 7], australia: [4, 1, 2],
  };
  for (const c of continents) {
    const [count, borders, bonus] = expected[c.id];
    assert.equal(c.territories.length, count, c.id);
    assert.equal(c.border_territories.length, borders, c.id);
    assert.equal(c.bonus, bonus, c.id);
    for (const id of c.territories) assert.equal(byId.get(id).continent, c.id);
  }
});

test('Kartentausch-Formel entspricht der Wertetabelle', () => {
  const value = (n) => (n <= 5 ? 2 * n + 2 : 5 * n - 15);
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7, 8].map(value), [4, 6, 8, 10, 12, 15, 20, 25]);
  assert.deepEqual(rules.cards.set_values.sequence, [4, 6, 8, 10, 12, 15]);
});

test('Kampfwahrscheinlichkeiten stimmen mit vollständiger Aufzählung überein', () => {
  const tables = [
    ...rules.battle_probabilities.table,
    ...rules.variants.defender_three_dice.battle_probabilities.table,
  ];
  for (const row of tables) {
    const counts = {};
    let total = 0;
    const rolls = (k) => (k === 0 ? [[]] : rolls(k - 1).flatMap((r) => [1, 2, 3, 4, 5, 6].map((v) => [...r, v])));
    for (const a of rolls(row.attacker_dice)) {
      for (const d of rolls(row.defender_dice)) {
        const as = [...a].sort((x, y) => y - x);
        const ds = [...d].sort((x, y) => y - x);
        let lossA = 0;
        let lossD = 0;
        for (let i = 0; i < Math.min(as.length, ds.length); i++) {
          if (as[i] > ds[i]) lossD++;
          else lossA++;
        }
        const key = `A${lossA}/D${lossD}`;
        counts[key] = (counts[key] || 0) + 1;
        total++;
      }
    }
    for (const [key, frac] of Object.entries(row.outcomes)) {
      assert.equal(`${counts[key]}/${total}`, frac, `${row.attacker_dice}v${row.defender_dice} ${key}`);
    }
  }
});
