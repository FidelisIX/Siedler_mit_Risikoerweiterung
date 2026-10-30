'use strict';

// Hex-Karte mit axialen Koordinaten (q, r), "pointy-top"-Ausrichtung.
// Die Karte ist in 6 Regionen (Tortenstücke um die Mitte) aufgeteilt,
// die vom Regionswürfel angesprochen werden.

const DIRECTIONS = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
const TERRAINS = ['wald', 'steinbruch', 'acker', 'mine'];

function tileId(q, r) {
  return `${q},${r}`;
}

function regionOf(q, r) {
  const x = Math.sqrt(3) * (q + r / 2);
  const y = 1.5 * r;
  // Kleiner Versatz, damit Felder genau auf einer Sektorgrenze eindeutig zugeordnet werden.
  let angle = Math.atan2(y, x) + 0.001;
  if (angle < 0) angle += 2 * Math.PI;
  return (Math.floor(angle / (Math.PI / 3)) % 6) + 1;
}

function neighborIds(tile) {
  return DIRECTIONS.map(([dq, dr]) => tileId(tile.q + dq, tile.r + dr));
}

function shuffle(list, rng) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

// Jede Region enthält jedes Gelände mindestens einmal, damit kein Würfelergebnis
// eine Region komplett wertlos macht. Große Karten bekommen pro Region ein Ödland.
function generateMap(radius, rng) {
  const byRegion = new Map();
  for (let q = -radius; q <= radius; q++) {
    for (let r = Math.max(-radius, -q - radius); r <= Math.min(radius, -q + radius); r++) {
      if (q === 0 && r === 0) continue;
      const region = regionOf(q, r);
      if (!byRegion.has(region)) byRegion.set(region, []);
      byRegion.get(region).push({ q, r });
    }
  }

  const tiles = [{ id: tileId(0, 0), q: 0, r: 0, region: 0, terrain: 'oedland', building: null }];
  for (const [region, coords] of byRegion) {
    const terrains = [...TERRAINS];
    if (radius >= 4) terrains.push('oedland');
    while (terrains.length < coords.length) {
      terrains.push(TERRAINS[Math.floor(rng() * TERRAINS.length)]);
    }
    shuffle(terrains, rng);
    coords.forEach(({ q, r }, i) => {
      tiles.push({ id: tileId(q, r), q, r, region, terrain: terrains[i], building: null });
    });
  }
  return tiles;
}

module.exports = { generateMap, neighborIds, regionOf, tileId, TERRAINS };
