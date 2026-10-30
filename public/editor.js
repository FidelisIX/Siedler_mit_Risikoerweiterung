'use strict';

const MAPS_KEY = 'archipel-maps';
const GRID_RADIUS = 10;
const MIN_PLAYABLE = 10;
const LAND_PER_PLAYER = 5;
const BRUSHES = ['wasser', 'land', 'wald', 'steinbruch', 'acker', 'mine', 'oedland', 'leer'];
const DIRECTIONS = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];

const $ = (id) => document.getElementById(id);
const key = (q, r) => `${q},${r}`;

let tiles = new Map(); // "q,r" -> terrain
let brush = 'land';
let painting = false;

function toast(message, isError = false) {
  const el = $('toast');
  el.textContent = message;
  el.style.background = isError ? '' : '#2f9e44';
  el.classList.remove('hidden');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.add('hidden'), 2500);
}

function savedMaps() {
  try {
    const maps = JSON.parse(localStorage.getItem(MAPS_KEY) || '[]');
    return Array.isArray(maps) ? maps : [];
  } catch (e) {
    return [];
  }
}

function storeMaps(maps) {
  try {
    localStorage.setItem(MAPS_KEY, JSON.stringify(maps));
    return true;
  } catch (e) {
    toast('Speichern im Browser nicht möglich – nutze „Exportieren“.', true);
    return false;
  }
}

function tileList() {
  return [...tiles].map(([id, terrain]) => {
    const [q, r] = id.split(',').map(Number);
    return { q, r, terrain };
  });
}

// Karte so verschieben, dass sie mittig im Raster liegt.
function loadTiles(list) {
  const valid = list.filter((t) => Number.isInteger(t.q) && Number.isInteger(t.r) && Hex.TERRAIN[t.terrain]);
  tiles = new Map();
  if (!valid.length) return render();
  const avgQ = Math.round(valid.reduce((s, t) => s + t.q, 0) / valid.length);
  const avgR = Math.round(valid.reduce((s, t) => s + t.r, 0) / valid.length);
  for (const t of valid) tiles.set(key(t.q - avgQ, t.r - avgR), t.terrain);
  render();
}

// ---------- Darstellung ----------

function gridSlots() {
  const slots = new Map();
  for (let q = -GRID_RADIUS; q <= GRID_RADIUS; q++) {
    for (let r = Math.max(-GRID_RADIUS, -q - GRID_RADIUS); r <= Math.min(GRID_RADIUS, -q + GRID_RADIUS); r++) {
      slots.set(key(q, r), { q, r });
    }
  }
  for (const t of tileList()) slots.set(key(t.q, t.r), { q: t.q, r: t.r });
  return [...slots.values()];
}

function render() {
  const board = $('editor-board');
  const slots = gridSlots();
  Hex.fitViewBox(board, slots);
  board.replaceChildren(...slots.map((slot) => {
    const { x, y } = Hex.center(slot);
    const terrain = tiles.get(key(slot.q, slot.r));
    const g = Hex.svg('g', { 'data-id': key(slot.q, slot.r), class: 'editor-tile' });
    g.append(Hex.svg('polygon', {
      points: Hex.corners(x, y),
      fill: terrain ? Hex.TERRAIN[terrain].color : 'transparent',
      stroke: terrain ? '#0b2236' : 'rgba(255,255,255,.15)',
      'stroke-width': 2,
    }));
    if (terrain && Hex.TERRAIN[terrain].icon) {
      g.append(Hex.svg('text', { x, y: y + 10, 'text-anchor': 'middle', 'font-size': 22 }, Hex.TERRAIN[terrain].icon));
    }
    return g;
  }));
  renderStats();
}

function renderStats() {
  const list = tileList();
  const playable = list.filter((t) => t.terrain !== 'wasser' && t.terrain !== 'oedland').length;
  const water = list.filter((t) => t.terrain === 'wasser').length;
  const maxPlayers = Math.min(6, Math.floor(playable / LAND_PER_PLAYER));
  const lines = [`${list.length} Felder · ${playable} bebaubares Land · ${water} Wasser`];
  if (playable < MIN_PLAYABLE) lines.push(`⚠️ Mindestens ${MIN_PLAYABLE} bebaubare Landfelder nötig.`);
  else lines.push(maxPlayers >= 2 ? `Geeignet für 2–${maxPlayers} Spieler.` : '⚠️ Zu klein für 2 Spieler.');
  $('stats').replaceChildren(...lines.map((l) => Object.assign(document.createElement('div'), { textContent: l })));
}

function paintAt(clientX, clientY) {
  const target = document.elementFromPoint(clientX, clientY);
  const g = target && target.closest('[data-id]');
  if (!g) return;
  const id = g.dataset.id;
  const before = tiles.get(id);
  if (brush === 'leer') tiles.delete(id); else tiles.set(id, brush);
  if (before !== tiles.get(id)) render();
}

const board = $('editor-board');
board.addEventListener('pointerdown', (e) => {
  painting = true;
  paintAt(e.clientX, e.clientY);
});
board.addEventListener('pointermove', (e) => {
  if (painting) paintAt(e.clientX, e.clientY);
});
window.addEventListener('pointerup', () => { painting = false; });
window.addEventListener('pointercancel', () => { painting = false; });

// ---------- Werkzeuge ----------

function renderPalette() {
  $('palette').replaceChildren(...BRUSHES.map((name) => {
    const btn = document.createElement('button');
    btn.className = `small ${brush === name ? 'active' : 'secondary'}`;
    const swatch = document.createElement('span');
    swatch.className = 'swatch';
    swatch.style.background = name === 'leer' ? 'transparent' : Hex.TERRAIN[name].color;
    btn.append(swatch, document.createTextNode(name === 'leer' ? 'Radierer' : Hex.TERRAIN[name].label));
    btn.onclick = () => {
      brush = name;
      renderPalette();
    };
    return btn;
  }));
}

$('coast').onclick = () => {
  for (const t of tileList()) {
    if (t.terrain === 'wasser') continue;
    for (const [dq, dr] of DIRECTIONS) {
      const id = key(t.q + dq, t.r + dr);
      if (!tiles.has(id)) tiles.set(id, 'wasser');
    }
  }
  render();
};

$('clear').onclick = () => {
  if (tiles.size && !confirm('Alle Felder löschen?')) return;
  tiles = new Map();
  render();
};

function currentMap() {
  return { name: $('map-name').value.trim() || 'Meine Karte', tiles: tileList() };
}

function renderSaved() {
  const maps = savedMaps();
  $('saved').replaceChildren(...maps.map((m, i) => Object.assign(document.createElement('option'), { value: i, textContent: m.name })));
  $('load').disabled = $('delete').disabled = maps.length === 0;
}

$('save').onclick = () => {
  const map = currentMap();
  const playable = map.tiles.filter((t) => t.terrain !== 'wasser' && t.terrain !== 'oedland').length;
  if (playable < MIN_PLAYABLE) return toast(`Mindestens ${MIN_PLAYABLE} bebaubare Landfelder nötig.`, true);
  const maps = savedMaps();
  const existing = maps.findIndex((m) => m.name === map.name);
  if (existing >= 0) {
    if (!confirm(`„${map.name}“ überschreiben?`)) return;
    maps[existing] = map;
  } else {
    maps.push(map);
  }
  if (storeMaps(maps)) {
    renderSaved();
    toast('Gespeichert');
  }
};

$('load').onclick = () => {
  const map = savedMaps()[Number($('saved').value)];
  if (!map) return;
  $('map-name').value = map.name;
  loadTiles(map.tiles);
};

$('delete').onclick = () => {
  const maps = savedMaps();
  const index = Number($('saved').value);
  if (!maps[index] || !confirm(`„${maps[index].name}“ löschen?`)) return;
  maps.splice(index, 1);
  storeMaps(maps);
  renderSaved();
};

let templates = [];
fetch('/api/maps').then((res) => res.json()).then((list) => {
  templates = list;
  $('templates').replaceChildren(...list.map((m, i) => Object.assign(document.createElement('option'), { value: i, textContent: m.name })));
}).catch(() => toast('Vorlagen konnten nicht geladen werden.', true));

$('load-template').onclick = () => {
  const template = templates[Number($('templates').value)];
  if (!template) return;
  $('map-name').value = `${template.name} (Kopie)`;
  loadTiles(template.tiles);
};

$('export').onclick = () => {
  const map = currentMap();
  const blob = new Blob([JSON.stringify(map, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${map.name.replace(/[^\wäöüÄÖÜß -]/g, '_')}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
};

$('import').onchange = async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    const map = JSON.parse(await file.text());
    if (!map || !Array.isArray(map.tiles)) throw new Error();
    $('map-name').value = String(map.name || file.name.replace(/\.json$/, '')).slice(0, 40);
    loadTiles(map.tiles);
    toast('Importiert');
  } catch (err) {
    toast('Die Datei ist keine gültige Karte.', true);
  }
};

renderPalette();
renderSaved();
render();
