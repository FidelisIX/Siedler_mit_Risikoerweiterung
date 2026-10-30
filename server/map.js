'use strict';

// Hex-Karten mit axialen Koordinaten (q, r), "pointy-top"-Ausrichtung.
// Eine Karte ist eine beliebige Liste von Feldern; Wasser ist ein eigenes Gelände.
// Die Landfelder werden in 6 gleich große Regionen aufgeteilt, die der Regionswürfel anspricht.

const DIRECTIONS = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
const TERRAINS = ['wald', 'steinbruch', 'acker', 'mine'];
// 'land' ist ein Platzhalter, der beim Spielstart zufällig zu einem der TERRAINS wird.
const LAYOUT_TERRAINS = [...TERRAINS, 'oedland', 'wasser', 'land'];
const LAYOUT_CHARS = { '~': 'wasser', L: 'land', W: 'wald', S: 'steinbruch', A: 'acker', M: 'mine', O: 'oedland' };
const MAX_COORD = 20;
const MAX_TILES = 400;
const MIN_PLAYABLE = 10;
const REGIONS = 6;

class MapError extends Error {}

function tileId(q, r) {
  return `${q},${r}`;
}

function neighborIds(tile) {
  return DIRECTIONS.map(([dq, dr]) => tileId(tile.q + dq, tile.r + dr));
}

function distance(a, b) {
  const dq = a.q - b.q;
  const dr = a.r - b.r;
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
}

function pixel(tile) {
  return { x: Math.sqrt(3) * (tile.q + tile.r / 2), y: 1.5 * tile.r };
}

function isPlayableLand(terrain) {
  return terrain !== 'wasser' && terrain !== 'oedland';
}

function shuffle(list, rng) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

function hexagon(radius) {
  const coords = [];
  for (let q = -radius; q <= radius; q++) {
    for (let r = Math.max(-radius, -q - radius); r <= Math.min(radius, -q + radius); r++) {
      coords.push({ q, r });
    }
  }
  return coords;
}

// Textlayout: eine Zeile pro Hex-Reihe, ungerade Reihen sind um ein halbes Feld nach rechts versetzt.
function parseLayout(rows) {
  const tiles = [];
  rows.forEach((row, r) => {
    [...row].forEach((ch, c) => {
      const terrain = LAYOUT_CHARS[ch];
      if (terrain) tiles.push({ q: c - (r - (r & 1)) / 2, r, terrain });
    });
  });
  return tiles;
}

const PRESETS = [
  {
    id: 'zwillingsinseln',
    name: 'Zwillingsinseln',
    rows: [
      '~~~~~~~~~~~~~~',
      '~LLLL~~~~LLLL~',
      '~LLLLL~~~LLLL~',
      '~LLOLL~~LLLLL~',
      '~LLLLL~~~LOLL~',
      '~LLLL~~~~LLLL~',
      '~~LL~~~~~~LL~~',
      '~~~~~~~~~~~~~~',
    ],
  },
  {
    id: 'lagune',
    name: 'Lagune',
    rows: [
      '...~~~~~~~...',
      '..~~LLLLL~~..',
      '..~LLLLLLL~..',
      '.~LLL~~~LLL~.',
      '.~LL~~~~~LL~.',
      '.~LLL~~~LLL~.',
      '..~LLLLLLL~..',
      '..~~LLOLL~~..',
      '...~~~~~~~...',
    ],
  },
  {
    id: 'inselkette',
    name: 'Inselkette',
    rows: [
      '~~~~~~~~~~~~~~~~~~',
      '~LLL~~~~~~~~~LLL~~',
      '~LLLL~~LLL~~LLLL~~',
      '~~LLL~LLLLL~LLL~~~',
      '~~~~~~LLOLL~~~~~~~',
      '~~LLL~LLLLL~~LLL~~',
      '~LLLL~~LLL~~LLLL~~',
      '~~LLL~~~~~~~~LLL~~',
      '~~~~~~~~~~~~~~~~~~',
    ],
  },
].map((preset) => ({ id: preset.id, name: preset.name, tiles: parseLayout(preset.rows) }));

// Zufällige Inselgruppe: 2–4 Inseln wachsen von Startpunkten aus, getrennt durch mindestens ein Wasserfeld.
function generateIslands(playerCount, rng) {
  const radius = playerCount <= 4 ? 5 : 6;
  const target = playerCount <= 4 ? 34 : 50;
  const area = hexagon(radius - 1);
  const owner = new Map(); // tileId -> Inselnummer
  const islands = [];
  const islandCount = 2 + Math.floor(rng() * 3);

  for (let attempt = 0; islands.length < islandCount && attempt < 500; attempt++) {
    const c = area[Math.floor(rng() * area.length)];
    if (islands.every((island) => distance(island[0], c) >= 4)) {
      owner.set(tileId(c.q, c.r), islands.length);
      islands.push([c]);
    }
  }

  const inArea = new Set(area.map((c) => tileId(c.q, c.r)));
  for (let step = 0; owner.size < target && step < 20000; step++) {
    const index = Math.floor(rng() * islands.length);
    const island = islands[index];
    const from = island[Math.floor(rng() * island.length)];
    const [dq, dr] = DIRECTIONS[Math.floor(rng() * 6)];
    const next = { q: from.q + dq, r: from.r + dr };
    const id = tileId(next.q, next.r);
    if (!inArea.has(id) || owner.has(id)) continue;
    const touchesOther = neighborIds(next).some((n) => owner.has(n) && owner.get(n) !== index);
    if (touchesOther) continue;
    owner.set(id, index);
    island.push(next);
  }

  const land = islands.flat();
  const tiles = land.map(({ q, r }) => ({ q, r, terrain: 'land' }));
  for (const c of hexagon(radius)) {
    if (owner.has(tileId(c.q, c.r))) continue;
    if (land.some((l) => distance(l, c) <= 2)) tiles.push({ q: c.q, r: c.r, terrain: 'wasser' });
  }
  return tiles;
}

function generateKontinent(playerCount) {
  return hexagon(playerCount <= 4 ? 3 : 4).map(({ q, r }) => ({
    q, r, terrain: q === 0 && r === 0 ? 'oedland' : 'land',
  }));
}

// Landfelder nach Winkel um ihren Schwerpunkt sortieren und in 6 gleich große Stücke teilen.
// Wasserfelder übernehmen die Region des nächstgelegenen Landfelds.
function assignRegions(tiles) {
  const land = tiles.filter((t) => t.terrain !== 'wasser');
  const points = land.map(pixel);
  const cx = points.reduce((s, p) => s + p.x, 0) / land.length;
  const cy = points.reduce((s, p) => s + p.y, 0) / land.length;
  const sorted = land
    .map((tile, i) => ({ tile, angle: Math.atan2(points[i].y - cy, points[i].x - cx), dist: Math.hypot(points[i].x - cx, points[i].y - cy) }))
    .sort((a, b) => a.angle - b.angle || a.dist - b.dist);
  sorted.forEach(({ tile }, i) => {
    tile.region = Math.floor((i * REGIONS) / sorted.length) + 1;
  });
  for (const tile of tiles) {
    if (tile.terrain !== 'wasser') continue;
    let best = null;
    for (const l of land) {
      if (!best || distance(tile, l) < distance(tile, best)) best = l;
    }
    tile.region = best.region;
  }
}

// Platzhalter 'land' auflösen: pro Region jedes Gelände möglichst einmal, große Regionen bekommen ein Ödland.
function assignTerrains(tiles, rng) {
  for (let region = 1; region <= REGIONS; region++) {
    const open = tiles.filter((t) => t.region === region && t.terrain === 'land');
    const terrains = shuffle([...TERRAINS], rng).slice(0, open.length);
    if (open.length >= 9) terrains.push('oedland');
    while (terrains.length < open.length) terrains.push(TERRAINS[Math.floor(rng() * TERRAINS.length)]);
    shuffle(terrains, rng);
    open.forEach((tile, i) => { tile.terrain = terrains[i]; });
  }
}

function validateCustomMap(input) {
  if (!input || typeof input !== 'object' || !Array.isArray(input.tiles)) throw new MapError('Ungültige Karte.');
  const name = String(input.name || 'Eigene Karte').trim().slice(0, 40) || 'Eigene Karte';
  if (input.tiles.length > MAX_TILES) throw new MapError(`Maximal ${MAX_TILES} Felder.`);
  const seen = new Set();
  const tiles = [];
  for (const raw of input.tiles) {
    const q = Number(raw && raw.q);
    const r = Number(raw && raw.r);
    const terrain = raw && raw.terrain;
    if (!Number.isInteger(q) || !Number.isInteger(r) || Math.abs(q) > MAX_COORD || Math.abs(r) > MAX_COORD) {
      throw new MapError('Ungültige Koordinaten in der Karte.');
    }
    if (!LAYOUT_TERRAINS.includes(terrain)) throw new MapError('Unbekanntes Gelände in der Karte.');
    const id = tileId(q, r);
    if (seen.has(id)) continue;
    seen.add(id);
    tiles.push({ q, r, terrain });
  }
  if (playableCount(tiles) < MIN_PLAYABLE) throw new MapError(`Die Karte braucht mindestens ${MIN_PLAYABLE} bebaubare Landfelder.`);
  return { name, tiles };
}

function playableCount(tiles) {
  return tiles.filter((t) => isPlayableLand(t.terrain)).length;
}

// Liefert das Layout (noch mit 'land'-Platzhaltern) für eine Kartenwahl.
function layoutFor(choice, playerCount, rng) {
  switch (choice.kind) {
    case 'random': return generateIslands(playerCount, rng);
    case 'kontinent': return generateKontinent(playerCount);
    case 'preset': {
      const preset = PRESETS.find((p) => p.id === choice.id);
      if (!preset) throw new MapError('Unbekannte Vorlage.');
      return preset.tiles;
    }
    case 'custom': return choice.tiles;
    default: throw new MapError('Unbekannte Kartenart.');
  }
}

function buildBoard(choice, playerCount, rng) {
  const tiles = layoutFor(choice, playerCount, rng).map(({ q, r, terrain }) => ({
    id: tileId(q, r), q, r, region: 0, terrain, building: null,
  }));
  assignRegions(tiles);
  assignTerrains(tiles, rng);
  return tiles;
}

module.exports = {
  MapError, PRESETS, TERRAINS, MIN_PLAYABLE,
  buildBoard, validateCustomMap, playableCount, neighborIds, tileId, parseLayout, generateIslands, distance,
};
