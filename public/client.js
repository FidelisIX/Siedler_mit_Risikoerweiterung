'use strict';

const socket = io();

const RESOURCES = ['holz', 'stein', 'nahrung', 'erz'];
const RESOURCE_LABEL = { holz: '🪵 Holz', stein: '🧱 Stein', nahrung: '🌾 Nahrung', erz: '⛓️ Erz' };
const TERRAIN = {
  wald: { color: '#2b8a3e', icon: '🌲', label: 'Wald' },
  steinbruch: { color: '#a8a29e', icon: '🪨', label: 'Steinbruch' },
  acker: { color: '#e9c46a', icon: '🌾', label: 'Acker' },
  mine: { color: '#7c5c45', icon: '⛏️', label: 'Mine' },
  oedland: { color: '#d8cba8', icon: '', label: 'Ödland' },
};
const FACE_LABEL = { wald: '🌲 Wald', steinbruch: '🪨 Steinbruch', acker: '🌾 Acker', mine: '⛏️ Mine', stern: '⭐ Stern' };
const BUILDING_ICON = { siedlung: '🏠', gut: '🏡', markt: '⚖️', monument: '🗼' };
const HEX_SIZE = 40;

const $ = (id) => document.getElementById(id);

let state = null;
let buildMode = null;

// Ein zufälliges Token pro Browser identifiziert den Spieler beim Wiederverbinden.
function getToken() {
  let token = null;
  try { token = localStorage.getItem('archipel-token'); } catch (e) { /* privates Fenster */ }
  if (!token) {
    token = (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2) + Date.now());
    try { localStorage.setItem('archipel-token', token); } catch (e) { /* ignorieren */ }
  }
  return token;
}
const token = getToken();

function remember(key, value) {
  try {
    if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value);
  } catch (e) { /* ignorieren */ }
}
function recall(key) {
  try { return localStorage.getItem(key); } catch (e) { return null; }
}

function showScreen(id) {
  for (const s of document.querySelectorAll('.screen')) s.classList.toggle('hidden', s.id !== id);
}

let toastTimer = null;
function toast(message) {
  const el = $('toast');
  el.textContent = message;
  el.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('hidden'), 3000);
}

function act(type, payload) {
  socket.emit('action', { type, payload }, (res) => {
    if (res && res.error) toast(res.error);
  });
}

function playerById(id) {
  return state.players.find((p) => p.id === id);
}

function el(tag, attrs = {}, text) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (text !== undefined) node.textContent = text;
  return node;
}

function formatCost(cost) {
  return RESOURCES.filter((r) => cost[r]).map((r) => `${cost[r]} ${RESOURCE_LABEL[r].split(' ')[1]}`).join(', ');
}

// ---------- Startbildschirm ----------

$('name').value = recall('archipel-name') || '';
const urlCode = new URLSearchParams(location.search).get('raum');
if (urlCode) $('code').value = urlCode.toUpperCase();

function enter(event, extra) {
  const name = $('name').value.trim();
  remember('archipel-name', name);
  socket.emit(event, { name, token, ...extra }, (res) => {
    if (res.error) {
      $('home-error').textContent = res.error;
      return;
    }
    $('home-error').textContent = '';
    remember('archipel-room', res.code);
    history.replaceState(null, '', `?raum=${res.code}`);
  });
}

$('create').onclick = () => enter('createRoom');
$('join').onclick = () => enter('joinRoom', { code: $('code').value });

// Nach Verbindungsabbruch automatisch wieder in den letzten Raum.
socket.on('connect', () => {
  const code = recall('archipel-room') || urlCode;
  if (!code || !recall('archipel-room')) return;
  socket.emit('joinRoom', { code, token, name: recall('archipel-name') || '' }, (res) => {
    if (res.error) {
      remember('archipel-room', null);
      showScreen('home');
    }
  });
});

// ---------- Lobby ----------

$('rounds').onchange = () => act('setRounds', { rounds: Number($('rounds').value) });
$('start').onclick = () => act('start');
$('copy-link').onclick = () => {
  const link = `${location.origin}/?raum=${state.code}`;
  navigator.clipboard.writeText(link).then(() => toast('Link kopiert'), () => toast(link));
};
function leave() {
  socket.emit('leaveRoom');
  remember('archipel-room', null);
  history.replaceState(null, '', '/');
  state = null;
  showScreen('home');
}
$('leave').onclick = leave;
$('back-home').onclick = leave;

function renderLobby() {
  $('lobby-code').textContent = state.code;
  const list = $('lobby-players');
  list.replaceChildren(...state.players.map((p) => {
    const li = el('li');
    const dot = el('span', { class: 'dot' });
    dot.style.background = p.color;
    li.append(dot, el('span', {}, p.name + (p.id === state.you ? ' (du)' : '')));
    if (p.id === state.hostId) li.append(el('span', { class: 'meta' }, 'Gastgeber'));
    return li;
  }));
  const isHost = state.hostId === state.you;
  const rounds = $('rounds');
  rounds.replaceChildren(...state.roundOptions.map((n) => el('option', { value: n }, `${n} Runden`)));
  rounds.value = state.maxRounds;
  rounds.disabled = !isHost;
  $('start').disabled = !isHost || state.players.length < 2;
  $('lobby-hint').textContent = isHost
    ? (state.players.length < 2 ? 'Warte auf mindestens einen weiteren Spieler …' : '')
    : 'Warte, bis der Gastgeber das Spiel startet …';
}

// ---------- Spielbrett ----------

function hexCorners(cx, cy) {
  const pts = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i - 30);
    pts.push(`${(cx + HEX_SIZE * Math.cos(angle)).toFixed(1)},${(cy + HEX_SIZE * Math.sin(angle)).toFixed(1)}`);
  }
  return pts.join(' ');
}

function hexCenter(tile) {
  return { x: HEX_SIZE * Math.sqrt(3) * (tile.q + tile.r / 2), y: HEX_SIZE * 1.5 * tile.r };
}

function svg(tag, attrs = {}, text) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (text !== undefined) node.textContent = text;
  return node;
}

function currentTargets() {
  if (!state.validTiles) return new Set();
  if (state.phase === 'setup') return new Set(state.validTiles.start);
  if (buildMode) return new Set(state.validTiles[buildMode] || []);
  return new Set();
}

function rollHit(tile) {
  const roll = state.lastRoll;
  if (!roll || state.phase !== 'main') return false;
  return tile.region === roll.region || tile.terrain === roll.face;
}

function onTileClick(tile) {
  if (state.phase === 'setup') {
    act('placeStart', { tileId: tile.id });
  } else if (buildMode) {
    act('build', { type: buildMode, tileId: tile.id });
    buildMode = null;
  }
}

function renderBoard() {
  const board = $('board');
  const targets = currentTargets();
  const centers = state.tiles.map(hexCenter);
  const xs = centers.map((c) => c.x);
  const ys = centers.map((c) => c.y);
  const pad = HEX_SIZE * 1.2;
  const minX = Math.min(...xs) - pad;
  const minY = Math.min(...ys) - pad;
  board.setAttribute('viewBox', `${minX} ${minY} ${Math.max(...xs) - minX + pad} ${Math.max(...ys) - minY + pad}`);

  const nodes = state.tiles.map((tile, i) => {
    const { x, y } = centers[i];
    const terrain = TERRAIN[tile.terrain];
    const classes = ['tile'];
    if (targets.has(tile.id)) classes.push('valid');
    if (rollHit(tile)) classes.push('hit');
    const g = svg('g', { class: classes.join(' ') });
    const title = svg('title', {}, `${terrain.label}${tile.region ? ` · Region ${tile.region}` : ''}`);
    g.append(title, svg('polygon', { points: hexCorners(x, y), fill: terrain.color }));
    if (tile.region) g.append(svg('text', { x, y: y - HEX_SIZE * 0.55, 'text-anchor': 'middle', class: 'region-label' }, tile.region));
    if (tile.building) {
      const owner = playerById(tile.building.owner);
      g.append(svg('circle', { cx: x, cy: y + 4, r: HEX_SIZE * 0.45, fill: owner.color, stroke: '#fff', 'stroke-width': 2 }));
      g.append(svg('text', { x, y: y + 12, 'text-anchor': 'middle', 'font-size': 22 }, BUILDING_ICON[tile.building.type]));
    } else if (terrain.icon) {
      g.append(svg('text', { x, y: y + 12, 'text-anchor': 'middle', 'font-size': 24, opacity: 0.85 }, terrain.icon));
    }
    if (targets.has(tile.id)) g.addEventListener('click', () => onTileClick(tile));
    return g;
  });
  board.replaceChildren(...nodes);

  const dice = $('dice');
  if (state.lastRoll && state.phase === 'main') {
    dice.replaceChildren(
      el('div', { class: 'die' }, `Region ${state.lastRoll.region}`),
      el('div', { class: 'die' }, FACE_LABEL[state.lastRoll.face]),
    );
  } else {
    dice.replaceChildren();
  }
}

// ---------- Seitenleiste ----------

function renderPlayers() {
  $('players').replaceChildren(...state.players.map((p) => {
    const li = el('li', { class: [p.id === state.currentPlayerId ? 'current' : '', p.connected ? '' : 'offline'].join(' ') });
    const dot = el('span', { class: 'dot' });
    dot.style.background = p.color;
    li.append(dot, el('span', {}, `${p.name}${p.id === state.you ? ' (du)' : ''}${p.connected ? '' : ' – getrennt'}`));
    li.append(el('span', { class: 'meta' }, `${p.points} Pkt · ${p.resourceCount} Rohst.${p.hasMarkt ? ' · ⚖️' : ''}`));
    return li;
  }));
}

function me() {
  return playerById(state.you);
}

function renderResources() {
  const res = me().resources;
  $('resources').replaceChildren(...RESOURCES.map((r) => {
    const box = el('div', { class: 'resource' });
    box.append(el('b', {}, res[r]), el('span', {}, RESOURCE_LABEL[r]));
    return box;
  }));
}

function renderActions() {
  const myTurn = state.currentPlayerId === state.you;
  const current = playerById(state.currentPlayerId);
  const res = me().resources;
  const hint = $('action-hint');

  if (state.phase === 'setup') {
    hint.textContent = myTurn ? 'Setze eine Start-Siedlung auf ein markiertes Feld.' : `${current.name} setzt eine Start-Siedlung …`;
  } else if (!myTurn) {
    hint.textContent = `${current.name} ist am Zug.`;
  } else if (!state.hasRolled) {
    hint.textContent = 'Du bist am Zug – würfle!';
  } else if (buildMode) {
    hint.textContent = `Wähle ein markiertes Feld für: ${state.buildings[buildMode].name}. (Nochmal klicken zum Abbrechen)`;
  } else {
    hint.textContent = 'Baue, handle oder beende deinen Zug.';
  }

  const mainTurn = state.phase === 'main' && myTurn;
  $('roll').disabled = !mainTurn || state.hasRolled;
  $('end-turn').disabled = !mainTurn || !state.hasRolled;

  $('build-buttons').replaceChildren(...Object.entries(state.buildings).map(([type, def]) => {
    const btn = el('button', { class: buildMode === type ? 'active' : 'secondary' });
    btn.append(document.createTextNode(`${BUILDING_ICON[type]} ${def.name} (${def.points} P)`), el('small', {}, formatCost(def.cost)));
    const affordable = RESOURCES.every((r) => res[r] >= (def.cost[r] || 0));
    const hasTarget = state.validTiles && state.validTiles[type] && state.validTiles[type].length > 0;
    btn.disabled = !mainTurn || !state.hasRolled || !affordable || !hasTarget;
    btn.onclick = () => {
      buildMode = buildMode === type ? null : type;
      render();
    };
    return btn;
  }));

  const skip = $('force-skip');
  skip.classList.toggle('hidden', !current || current.connected || myTurn);
}

function fillSelect(select, options) {
  const previous = select.value;
  select.replaceChildren(...options.map(([value, label]) => el('option', { value }, label)));
  if (options.some(([v]) => v === previous)) select.value = previous;
}

function renderTrade() {
  const myTurn = state.currentPlayerId === state.you && state.phase === 'main' && state.hasRolled;
  const rate = me().hasMarkt ? state.rates.markt : state.rates.bank;
  fillSelect($('bank-give'), RESOURCES.map((r) => [r, `${rate}× ${RESOURCE_LABEL[r]}`]));
  fillSelect($('bank-get'), RESOURCES.map((r) => [r, `1× ${RESOURCE_LABEL[r]}`]));
  $('bank-trade').disabled = !myTurn;

  fillSelect($('trade-to'), state.players.filter((p) => p.id !== state.you).map((p) => [p.id, `an ${p.name}`]));
  const grid = $('trade-grid');
  if (!grid.childElementCount) {
    grid.append(el('span'), el('b', {}, 'Ich gebe'), el('b', {}, 'Ich will'));
    for (const r of RESOURCES) {
      grid.append(
        el('span', {}, RESOURCE_LABEL[r]),
        el('input', { type: 'number', min: 0, max: 99, value: 0, 'data-give': r }),
        el('input', { type: 'number', min: 0, max: 99, value: 0, 'data-want': r }),
      );
    }
  }
  $('propose-trade').disabled = !myTurn || !!state.trade;

  const box = $('trade-incoming');
  box.replaceChildren();
  const trade = state.trade;
  if (!trade) return;
  const from = playerById(trade.from);
  const to = playerById(trade.to);
  const describe = (amounts) => RESOURCES.filter((r) => amounts[r]).map((r) => `${amounts[r]} ${RESOURCE_LABEL[r]}`).join(', ');
  const offer = el('div', { class: 'offer' });
  offer.append(el('span', {}, `${from.name} → ${to.name}: gibt ${describe(trade.give)}, will ${describe(trade.want)}`));
  if (trade.to === state.you) {
    const row = el('div', { class: 'row' });
    const accept = el('button', { class: 'small' }, 'Annehmen');
    accept.onclick = () => act('respondTrade', { accept: true });
    const decline = el('button', { class: 'small secondary' }, 'Ablehnen');
    decline.onclick = () => act('respondTrade', { accept: false });
    row.append(accept, decline);
    offer.append(row);
  } else if (trade.from === state.you) {
    const cancel = el('button', { class: 'small secondary' }, 'Zurückziehen');
    cancel.onclick = () => act('cancelTrade');
    offer.append(cancel);
  }
  box.append(offer);
}

$('roll').onclick = () => act('roll');
$('end-turn').onclick = () => { buildMode = null; act('endTurn'); };
$('force-skip').onclick = () => act('forceSkip');
$('bank-trade').onclick = () => act('bankTrade', { give: $('bank-give').value, get: $('bank-get').value });
$('propose-trade').onclick = () => {
  const read = (attr) => Object.fromEntries(
    [...document.querySelectorAll(`[data-${attr}]`)].map((input) => [input.dataset[attr], Number(input.value) || 0]),
  );
  act('proposeTrade', { to: $('trade-to').value, give: read('give'), want: read('want') });
};

function renderGame() {
  const current = playerById(state.currentPlayerId);
  $('round-info').textContent = state.phase === 'setup' ? 'Aufbauphase' : `Runde ${Math.min(state.round, state.maxRounds)} / ${state.maxRounds}`;
  $('turn-info').textContent = current ? `Am Zug: ${current.name}` : '';
  $('game-code').textContent = state.code;
  if (!state.validTiles || !state.validTiles[buildMode]) buildMode = null;

  renderBoard();
  renderPlayers();
  renderResources();
  renderActions();
  renderTrade();
  $('log').replaceChildren(...state.log.map((line) => el('li', {}, line)));

  const results = $('results');
  results.classList.toggle('hidden', state.phase !== 'ended');
  if (state.phase === 'ended') {
    $('results-list').replaceChildren(...state.results.map((r) => el('li', {}, `${r.name}: ${r.points} Punkte (${r.resources} Rohstoffe)`)));
  }
}

function render() {
  if (!state) return;
  if (state.phase === 'lobby') {
    showScreen('lobby');
    renderLobby();
  } else {
    showScreen('game');
    renderGame();
  }
}

socket.on('state', (next) => {
  state = next;
  render();
});
