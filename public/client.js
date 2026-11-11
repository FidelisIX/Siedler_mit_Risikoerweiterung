'use strict';

const socket = io();

const RESOURCES = ['holz', 'stein', 'nahrung', 'erz'];
const RESOURCE_LABEL = { holz: '🪵 Holz', stein: '🧱 Stein', nahrung: '🌾 Nahrung', erz: '⛓️ Erz' };
const FACE_LABEL = { wald: '🌲 Wald', steinbruch: '🪨 Steinbruch', acker: '🌾 Acker', mine: '⛏️ Mine', stern: '⭐ Stern' };
const BUILDING_ICON = {
  siedlung: '🏠', gut: '🏡', hafen: '⚓', markt: '⚖️', monument: '🏛️', schiff: '⛵', fischerei: '🐟', wachturm: '🗼', limes: '🧱',
};
const MIL_ACTION = { attack: 'attack', move: 'moveTroops' };
const { TERRAIN, SIZE: HEX_SIZE, svg } = Hex;
const MAPS_KEY = 'archipel-maps';

const $ = (id) => document.getElementById(id);

let state = null;
let buildMode = null;
let milMode = null; // 'recruit' | 'attack' | 'move'
let milSource = null;

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
function toast(message, kind = 'error') {
  const el = $('toast');
  el.textContent = message;
  el.classList.toggle('info', kind === 'info');
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
// Nach einem Server-Neustart kann das bis zu 15 s dauern (Raum wird aus der Sicherung geholt).
socket.on('connect', () => {
  const code = recall('archipel-room');
  if (!code) return;
  socket.emit('joinRoom', { code, token, name: recall('archipel-name') || '' }, (res) => {
    if (res.error) {
      remember('archipel-room', null);
      state = null;
      showScreen('home');
      $('home-error').textContent = res.error === 'Raum nicht gefunden.'
        ? 'Der Raum existiert nicht mehr (z. B. nach einem Server-Neustart). Erstellt einfach einen neuen.'
        : res.error;
    }
  });
});

socket.on('serverInfo', ({ message }) => toast(message, 'info'));

// Vom Gastgeber entfernt oder in einem anderen Tab geöffnet.
socket.on('kicked', ({ reason, message }) => {
  // Beim zweiten Tab gehört die Sitzung jetzt dem anderen Tab – dort nichts zurücksetzen.
  if (reason !== 'tab') {
    remember('archipel-room', null);
    history.replaceState(null, '', '/');
  }
  state = null;
  showScreen('home');
  $('home-error').textContent = message;
});

function kickButton(player) {
  if (state.hostId !== state.you || player.id === state.you || player.removed) return null;
  const btn = el('button', { class: 'kick', title: `${player.name} entfernen`, 'aria-label': `${player.name} entfernen` }, '✕');
  btn.onclick = () => {
    if (!confirm(`${player.name} aus dem Raum entfernen?`)) return;
    socket.emit('kick', { playerId: player.id }, (res) => {
      if (res && res.error) toast(res.error);
    });
  };
  return btn;
}

// ---------- Lobby ----------

$('victory-mode').onchange = () => act('setVictory', { mode: $('victory-mode').value });
$('victory-target').onchange = () => act('setVictory', { target: Number($('victory-target').value) });
$('round-limit').onchange = () => act('setVictory', { roundLimit: Number($('round-limit').value) });
$('vote-continue').onclick = () => act('castVote', { choice: 'weiter' });
$('vote-end').onclick = () => act('castVote', { choice: 'ende' });

function savedMaps() {
  try {
    const maps = JSON.parse(localStorage.getItem(MAPS_KEY) || '[]');
    return Array.isArray(maps) ? maps : [];
  } catch (e) {
    return [];
  }
}

$('variant').onchange = () => act('setVariant', { variant: $('variant').value });

$('map').onchange = () => {
  const [kind, id] = $('map').value.split(':');
  if (kind === 'local') {
    const map = savedMaps()[Number(id)];
    if (map) act('setMap', { kind: 'custom', map });
  } else if (kind !== 'custom') {
    act('setMap', { kind, id });
  }
};
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
$('results-leave').onclick = leave;
$('rematch').onclick = () => act('voteRematch', { vote: !state.rematchVotes.includes(state.you) });
$('restart-now').onclick = () => act('start');
$('to-lobby').onclick = () => act('backToLobby');

// Eigenes Team wählt jeder selbst; der Gastgeber kann alle umsetzen (Veto).
function teamSelect(player) {
  const select = el('select', { class: 'team-select', 'aria-label': `Team von ${player.name}` });
  select.append(el('option', { value: '' }, '– Team –'), ...state.teamOptions.map((t) => el('option', { value: t }, `Team ${t}`)));
  select.value = player.team || '';
  select.disabled = player.id !== state.you && state.hostId !== state.you;
  select.onchange = () => act('setTeam', { playerId: player.id, team: select.value || null });
  return select;
}

$('teams-enabled').onchange = () => act('setTeamsEnabled', { enabled: $('teams-enabled').value === 'an' });

function renderLobby() {
  $('lobby-code').textContent = state.code;
  const list = $('lobby-players');
  list.replaceChildren(...state.players.map((p) => {
    const li = el('li');
    const dot = el('span', { class: 'dot' });
    dot.style.background = p.color;
    li.append(dot, el('span', {}, p.name + (p.id === state.you ? ' (du)' : '') + (p.connected ? '' : ' – getrennt')));
    if (p.id === state.hostId) li.append(el('span', { class: 'meta' }, '👑 Gastgeber'));
    if (state.teamsEnabled) li.append(teamSelect(p));
    const kick = kickButton(p);
    if (kick) li.append(kick);
    return li;
  }));
  const teamsSelect = $('teams-enabled');
  teamsSelect.value = state.teamsEnabled ? 'an' : 'aus';
  teamsSelect.disabled = state.hostId !== state.you;
  $('teams-info').textContent = state.teamsEnabled
    ? 'Jeder wählt sein Team selbst, der Gastgeber kann umsetzen. Zugreihenfolge abwechselnd zwischen den Teams, '
      + 'Punkte werden im Team addiert (Ziel × Teamgröße), Bank 2:1 wenn du und ein Teammitglied je einen Hafen habt.'
    : '';
  const isHost = state.hostId === state.you;
  const v = state.victory;
  fillSelect($('victory-mode'), state.victoryModes.map((m) => [m.id, m.name]));
  $('victory-mode').value = v.mode;
  fillSelect($('victory-target'), state.targetOptions.map((n) => [String(n), `${n} Punkte`]));
  $('victory-target').value = String(v.target);
  fillSelect($('round-limit'), state.roundLimitOptions.map((n) => [String(n), n ? `${n} Runden` : 'Kein Limit']));
  $('round-limit').value = String(v.roundLimit);
  $('target-label').classList.toggle('hidden', v.mode === 'vernichtung');
  for (const id of ['victory-mode', 'victory-target', 'round-limit']) $(id).disabled = !isHost;
  $('victory-info').textContent = `Ziel: ${state.victoryText}.`
    + (v.roundLimit ? ' Nach dem Rundenlimit gewinnt, wer die meisten Punkte hat.' : ' Ohne Limit wird nach 150 Runden abgestimmt, ob es weitergeht, danach alle 25 Runden.');
  $('start').disabled = !isHost || state.players.length < 2;

  const mapSelect = $('map');
  const options = state.mapOptions.map((o) => [`${o.kind}:${o.id || ''}`, o.name]);
  if (state.map.kind === 'custom') options.push(['custom:', `Eigene: ${state.map.name}`]);
  if (isHost) savedMaps().forEach((m, i) => options.push([`local:${i}`, `Aus Editor: ${m.name}`]));
  mapSelect.replaceChildren(...options.map(([value, label]) => el('option', { value }, label)));
  mapSelect.value = state.map.kind === 'custom' ? 'custom:' : `${state.map.kind}:${state.map.id || ''}`;
  mapSelect.disabled = !isHost;
  const preview = $('map-preview');
  preview.classList.toggle('hidden', !state.mapPreview);
  if (state.mapPreview) Hex.drawPreview(preview, state.mapPreview);
  $('map-info').textContent = {
    random: 'Bei jedem Spiel neu erzeugte Inseln.',
    kontinent: 'Eine zusammenhängende Landmasse ohne Wasser.',
  }[state.map.kind] || 'Grüne Felder mit ❔ werden beim Start zufällig belegt.';
  const variantSelect = $('variant');
  variantSelect.replaceChildren(...state.variants.map((v) => el('option', { value: v.id }, v.name)));
  variantSelect.value = state.variant;
  variantSelect.disabled = !isHost;
  $('lobby-hint').textContent = isHost
    ? (state.players.length < 2 ? 'Warte auf mindestens einen weiteren Spieler …' : '')
    : 'Warte, bis der Gastgeber das Spiel startet …';
}

// ---------- Spielbrett ----------

function currentTargets() {
  if (!state.validTiles) return new Set();
  if (state.phase === 'setup') return new Set(state.validTiles.start);
  if (buildMode) return new Set(state.validTiles[buildMode] || []);
  if (milMode && state.military) {
    if (milMode === 'recruit') return new Set(state.military.recruit);
    if (!milSource) {
      return new Set(Object.entries(state.military.sources).filter(([, o]) => o[milMode].length).map(([id]) => id));
    }
    const options = state.military.sources[milSource];
    return new Set(options ? options[milMode] : []);
  }
  return new Set();
}

function tileById(id) {
  return state.tiles.find((t) => t.id === id);
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
  } else if (milMode === 'recruit') {
    act('recruit', { tileId: tile.id });
  } else if (milMode && !milSource) {
    milSource = tile.id;
    render();
  } else if (milMode) {
    const max = tileById(milSource).troops;
    const count = Math.max(1, Math.min(max, Number($('troop-count').value) || max));
    act(MIL_ACTION[milMode], { from: milSource, to: tile.id, count });
    milMode = null;
    milSource = null;
  }
}

function tileTitle(tile, terrain) {
  let title = `${terrain.label}${tile.region ? ` · Region ${tile.region}` : ''}`;
  if (tile.building) {
    title += ` · ${state.buildings[tile.building.type]?.name || tile.building.type} von ${playerById(tile.building.owner).name}`;
    if (state.conquest && tile.terrain !== 'wasser') {
      title += ` · Truppen: ${tile.troops} · stationär: ${state.conquest.stationary[tile.building.type] || 0}`;
    }
  }
  return title;
}

function renderBoard() {
  const board = $('board');
  const targets = currentTargets();
  const centers = state.tiles.map((t) => Hex.center(t));
  Hex.fitViewBox(board, state.tiles);

  const nodes = state.tiles.map((tile, i) => {
    const { x, y } = centers[i];
    const terrain = TERRAIN[tile.terrain];
    const classes = ['tile', tile.terrain === 'wasser' ? 'water' : 'land'];
    if (targets.has(tile.id)) classes.push('valid');
    if (rollHit(tile)) classes.push('hit');
    if (tile.id === milSource) classes.push('selected');
    if (state.lastBattle && state.lastBattle.tileId === tile.id) classes.push('battle');
    const g = svg('g', { class: classes.join(' ') });
    const title = svg('title', {}, tileTitle(tile, terrain));
    g.append(title, svg('polygon', { points: Hex.corners(x, y), fill: terrain.color }));
    if (tile.region) g.append(svg('text', { x, y: y - HEX_SIZE * 0.55, 'text-anchor': 'middle', class: 'region-label' }, tile.region));
    if (tile.building) {
      const owner = playerById(tile.building.owner);
      g.append(svg('circle', { cx: x, cy: y + 4, r: HEX_SIZE * 0.45, fill: owner.color, stroke: '#fff', 'stroke-width': 2 }));
      g.append(svg('text', { x, y: y + 12, 'text-anchor': 'middle', 'font-size': 22 }, BUILDING_ICON[tile.building.type]));
      if (state.conquest && tile.troops > 0) {
        const bx = x + HEX_SIZE * 0.5;
        const by = y - HEX_SIZE * 0.3;
        g.append(svg('circle', { cx: bx, cy: by, r: 12, fill: '#212529', stroke: owner.color, 'stroke-width': 3 }));
        g.append(svg('text', { x: bx, y: by + 5, 'text-anchor': 'middle', class: 'troop-label' }, tile.troops));
      }
    } else if (terrain.icon) {
      g.append(svg('text', { x, y: y + 12, 'text-anchor': 'middle', 'font-size': 24, opacity: 0.85 }, terrain.icon));
    }
    if (targets.has(tile.id)) g.addEventListener('click', () => onTileClick(tile));
    return g;
  });
  board.replaceChildren(...nodes);

  const dice = $('dice');
  const dieNodes = [];
  if (state.lastRoll && state.phase === 'main') {
    dieNodes.push(
      el('div', { class: 'die' }, `Region ${state.lastRoll.region}`),
      el('div', { class: 'die' }, FACE_LABEL[state.lastRoll.face]),
    );
  }
  const b = state.lastBattle;
  if (b) {
    const defense = [b.defenseTroops, b.defenseStationary, b.defenseTower].join(' + ');
    dieNodes.push(el('div', { class: 'die battle-info' },
      `⚔️ ${playerById(b.attacker).name}: ${b.attackTroops} + 🎲${b.attackRoll} = ${b.attackTotal}  vs  `
      + `🛡️ ${playerById(b.defender).name}: ${defense} + 🎲${b.defenseRoll} = ${b.defenseTotal}  → `
      + (b.attackerWins ? 'erobert' : 'abgewehrt')));
  }
  dice.replaceChildren(...dieNodes);
}

// ---------- Seitenleiste ----------

function renderPlayers() {
  $('players').replaceChildren(...state.players.map((p) => {
    const li = el('li', { class: [p.id === state.currentPlayerId ? 'current' : '', p.connected ? '' : 'offline'].join(' ') });
    const dot = el('span', { class: 'dot' });
    dot.style.background = p.color;
    const status = p.removed ? ' – entfernt' : p.eliminated ? ' – 💀 besiegt' : p.connected ? '' : ' – getrennt';
    const team = p.team ? `[${p.team}] ` : '';
    li.append(dot, el('span', {}, `${team}${p.id === state.hostId ? '👑 ' : ''}${p.name}${p.id === state.you ? ' (du)' : ''}${status}`));
    li.append(el('span', { class: 'meta' }, `${p.points} Pkt · ${p.resourceCount} Rohst.${p.hasMarkt ? ' · ⚖️' : ''}`));
    // Rohstoffe von Teammitgliedern sind sichtbar
    if (p.resources && p.id !== state.you) {
      li.append(el('span', { class: 'ally-resources' },
        RESOURCES.map((r) => `${RESOURCE_LABEL[r].split(' ')[0]} ${p.resources[r]}`).join('  ')));
    }
    const kick = kickButton(p);
    if (kick) li.append(kick);
    return li;
  }));
  const scores = $('team-scores');
  scores.classList.toggle('hidden', !state.teamsEnabled);
  scores.replaceChildren(...state.teams.map((t) => el('div', { class: 'team-score' },
    `Team ${t.id}: ${t.points}${state.victory.mode !== 'vernichtung' ? ` / ${t.target}` : ''} Punkte`)));
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

  if (state.phase === 'ended' || !current) {
    hint.textContent = 'Das Spiel ist beendet.';
  } else if (state.phase === 'setup') {
    hint.textContent = myTurn ? 'Setze eine Start-Siedlung auf ein markiertes Feld.' : `${current.name} setzt eine Start-Siedlung …`;
  } else if (!myTurn) {
    hint.textContent = `${current.name} ist am Zug.`;
  } else if (!state.hasRolled) {
    hint.textContent = 'Du bist am Zug – würfle!';
  } else if (buildMode) {
    hint.textContent = `Wähle ein markiertes Feld für: ${state.buildings[buildMode].name}. (Nochmal klicken zum Abbrechen)`;
  } else if (milMode === 'recruit') {
    hint.textContent = 'Wähle ein eigenes Gebäude, auf dem eine Truppe ausgehoben wird.';
  } else if (milMode && !milSource) {
    hint.textContent = milMode === 'attack' ? 'Wähle das Feld, von dem aus du angreifst.' : 'Wähle das Feld, von dem Truppen abziehen.';
  } else if (milMode) {
    hint.textContent = `Wähle das Ziel. Es ziehen ${$('troop-count').value} Truppe(n) (höchstens ${tileById(milSource).troops}).`;
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
      milMode = null;
      milSource = null;
      render();
    };
    return btn;
  }));

  renderMilitary(mainTurn);

  const skip = $('force-skip');
  skip.classList.toggle('hidden', !current || current.connected || myTurn);
}

function renderMilitary(mainTurn) {
  const panel = $('military-panel');
  panel.classList.toggle('hidden', !state.conquest);
  if (!state.conquest) return;
  const c = state.conquest;
  const mil = state.military;
  const info = [
    `Rekrutieren: ${formatCost(c.recruitCost)} · Angriff: ${formatCost(c.attackCost)}`,
    state.phase === 'main' && state.round <= c.graceRounds ? `Angriffe erst ab Runde ${c.graceRounds + 1}.` : '',
    mainTurn && state.hasRolled ? `Diesen Zug noch: ${state.attacksLeft} Angriff(e), ${state.movesLeft} Verlegung(en).` : '',
  ].filter(Boolean);
  $('military-info').replaceChildren(...info.map((line) => el('div', {}, line)));
  const has = (kind) => mil && Object.values(mil.sources).some((o) => o[kind].length > 0);
  const enabled = { recruit: !!mil && mil.recruit.length > 0, attack: has('attack'), move: has('move') };
  for (const [mode, id] of [['recruit', 'mil-recruit'], ['attack', 'mil-attack'], ['move', 'mil-move']]) {
    const btn = $(id);
    btn.disabled = !enabled[mode];
    btn.className = `small ${milMode === mode ? 'active' : 'secondary'}`;
  }
}

for (const [mode, id] of [['recruit', 'mil-recruit'], ['attack', 'mil-attack'], ['move', 'mil-move']]) {
  $(id).onclick = () => {
    milMode = milMode === mode ? null : mode;
    milSource = null;
    buildMode = null;
    render();
  };
}
$('troop-count').oninput = () => render();

function fillSelect(select, options) {
  const previous = select.value;
  select.replaceChildren(...options.map(([value, label]) => el('option', { value }, label)));
  if (options.some(([v]) => v === previous)) select.value = previous;
}

function renderTrade() {
  const myTurn = state.currentPlayerId === state.you && state.phase === 'main' && state.hasRolled;
  const rate = me().bankRate;
  const give = $('bank-give');
  const get = $('bank-get');
  fillSelect(give, RESOURCES.map((r) => [r, `${rate}× ${RESOURCE_LABEL[r]}`]));
  fillSelect(get, RESOURCES.map((r) => [r, `1× ${RESOURCE_LABEL[r]}`]));
  const res = me().resources;
  // Vorbelegung (B-003): abgeben, wovon man am meisten hat; bekommen, wovon man am wenigsten hat.
  if (!give.dataset.chosen) {
    const options = RESOURCES.filter((r) => !get.dataset.chosen || r !== get.value);
    give.value = options.reduce((best, r) => (res[r] > res[best] ? r : best));
  }
  if (!get.dataset.chosen || get.value === give.value) {
    get.value = RESOURCES.filter((r) => r !== give.value).reduce((best, r) => (res[r] < res[best] ? r : best));
  }
  const enough = res[give.value] >= rate;
  $('bank-trade').disabled = !myTurn || give.value === get.value || !enough;
  $('bank-trade').title = enough ? '' : `Du brauchst ${rate}× ${RESOURCE_LABEL[give.value]}.`;

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
$('end-turn').onclick = () => { buildMode = null; milMode = null; milSource = null; act('endTurn'); };
$('force-skip').onclick = () => act('forceSkip');
$('bank-trade').onclick = () => act('bankTrade', { give: $('bank-give').value, get: $('bank-get').value });
// Eigene Auswahl merken; wählt man beide gleich, weicht das andere Feld aus.
$('bank-give').onchange = () => {
  $('bank-give').dataset.chosen = '1';
  if ($('bank-give').value === $('bank-get').value) delete $('bank-get').dataset.chosen;
  render();
};
$('bank-get').onchange = () => {
  $('bank-get').dataset.chosen = '1';
  if ($('bank-get').value === $('bank-give').value) delete $('bank-give').dataset.chosen;
  render();
};
$('propose-trade').onclick = () => {
  const read = (attr) => Object.fromEntries(
    [...document.querySelectorAll(`[data-${attr}]`)].map((input) => [input.dataset[attr], Number(input.value) || 0]),
  );
  act('proposeTrade', { to: $('trade-to').value, give: read('give'), want: read('want') });
};

function renderGame() {
  const current = playerById(state.currentPlayerId);
  const limit = state.victory.roundLimit;
  $('round-info').textContent = state.phase === 'setup'
    ? 'Aufbauphase'
    : `Runde ${limit ? `${Math.min(state.round, limit)} / ${limit}` : state.round} · Ziel: ${state.victoryText}`;
  renderVote();
  $('turn-info').textContent = current ? `Am Zug: ${current.name}` : '';
  $('game-code').textContent = state.code;
  if (!state.validTiles || !state.validTiles[buildMode]) buildMode = null;
  if (!state.military) { milMode = null; milSource = null; }
  if (milSource && !(state.military.sources[milSource])) milSource = null;

  renderBoard();
  renderPlayers();
  renderResources();
  renderActions();
  renderTrade();
  $('log').replaceChildren(...state.log.map((line) => el('li', {}, line)));

  const results = $('results');
  results.classList.toggle('hidden', state.phase !== 'ended');
  if (state.phase === 'ended') renderResults();
}

function renderVote() {
  const vote = state.vote;
  $('vote').classList.toggle('hidden', !vote || state.phase !== 'main');
  if (!vote) return;
  const canVote = vote.voters.includes(state.you);
  $('vote-info').textContent = `${vote.afterRound} Runden sind gespielt. Wollt ihr weiterspielen? `
    + 'Stimmt die Mehrheit für Beenden, endet das Spiel und die Punkte zählen. Bei Gleichstand geht es weiter.';
  $('vote-continue').disabled = !canVote;
  $('vote-end').disabled = !canVote;
  $('vote-continue').className = vote.yours === 'weiter' ? 'active' : '';
  $('vote-end').className = vote.yours === 'ende' ? 'active' : 'secondary';
  $('vote-status').textContent = `${vote.voted.length} von ${vote.voters.length} verbundenen Spielern haben abgestimmt.`
    + (vote.yours ? ' Du kannst deine Stimme noch ändern, bis alle abgestimmt haben.' : '');
}

const FINISH_REASON = {
  punkte: (w) => `${w} hat das Punkteziel erreicht.`,
  vernichtung: (w) => `${w} hat alle Gegner besiegt.`,
  runden: (w) => `Rundenlimit erreicht – ${w} hat die meisten Punkte.`,
  abstimmung: (w) => `Per Abstimmung beendet – ${w} hat die meisten Punkte.`,
};

function renderResults() {
  const winner = state.results[0];
  const winnerLabel = winner.team ? `Team ${winner.team}` : winner.name;
  $('finish-reason').textContent = FINISH_REASON[state.finishReason] ? FINISH_REASON[state.finishReason](winnerLabel) : '';
  $('results-list').replaceChildren(...state.results.map((r) => {
    const built = Object.values(r.stats.built).reduce((sum, n) => sum + n, 0);
    const details = [`${r.resources} Rohstoffe`, `${built} gebaut`, `${r.stats.trades} Tausch`];
    if (state.conquest) details.push(`${r.stats.conquered} erobert`, `${r.stats.lost} verloren`);
    const li = el('li', { class: r.removed ? 'offline' : '' });
    const status = r.removed ? ' – entfernt' : r.eliminated ? ' – besiegt' : '';
    li.append(el('b', {}, `${r.winner ? '🏆 ' : ''}${r.team ? `[${r.team}] ` : ''}${r.name}: ${r.points} Punkte`), el('span', { class: 'muted' }, ` (${details.join(' · ')})${status}`));
    return li;
  }));

  const active = state.players.filter((p) => !p.removed);
  const online = active.filter((p) => p.connected);
  const voted = state.rematchVotes.includes(state.you);
  const amRemoved = me().removed;
  $('rematch').textContent = voted ? '✓ Dabei – Stimme zurückziehen' : '🔁 Nochmal spielen';
  $('rematch').disabled = amRemoved;
  $('rematch-info').textContent = `${state.rematchVotes.length} von ${online.length} verbundenen Spielern wollen nochmal spielen.`
    + ' Sobald alle zustimmen, startet die nächste Partie mit denselben Einstellungen.';
  const isHost = state.hostId === state.you;
  $('host-actions').classList.toggle('hidden', !isHost);
  $('restart-now').disabled = active.length < 2;
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
