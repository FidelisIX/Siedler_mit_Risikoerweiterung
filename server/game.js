'use strict';

const { buildBoard, validateCustomMap, playableCount, neighborIds, MapError, PRESETS } = require('./map');

const RESOURCES = ['holz', 'stein', 'nahrung', 'erz'];
const TERRAIN_RESOURCE = { wald: 'holz', steinbruch: 'stein', acker: 'nahrung', mine: 'erz', wasser: 'nahrung' };
// Geländewürfel: vier Geländeseiten und zwei Sterne (Stern = gewürfelte Region produziert doppelt).
const TERRAIN_DIE = ['wald', 'steinbruch', 'acker', 'mine', 'stern', 'stern'];
const BUILDINGS = {
  siedlung: { name: 'Siedlung', article: 'eine', cost: { holz: 1, stein: 1, nahrung: 1 }, points: 1, production: 1 },
  gut: { name: 'Gutshof', article: 'einen', cost: { nahrung: 2, erz: 2 }, points: 2, production: 2 },
  hafen: { name: 'Hafen', article: 'einen', cost: { holz: 2, stein: 1, nahrung: 1 }, points: 1, production: 1 },
  markt: { name: 'Markt', article: 'einen', cost: { holz: 2, stein: 1 }, points: 1, production: 0 },
  monument: { name: 'Monument', article: 'ein', cost: { holz: 1, stein: 2, nahrung: 1, erz: 2 }, points: 3, production: 0 },
  schiff: { name: 'Schiff', article: 'ein', cost: { holz: 1, erz: 1 }, points: 0, production: 0 },
  fischerei: { name: 'Fischerei', article: 'eine', cost: { holz: 1, nahrung: 1 }, points: 0, production: 1 },
  // Nur in der Eroberungs-Variante:
  wachturm: { name: 'Wachturm', article: 'einen', cost: { holz: 1, stein: 2 }, points: 0, production: 0, conquestOnly: true },
  limes: { name: 'Limes', article: 'einen', cost: { holz: 1, stein: 3 }, points: 0, production: 0, conquestOnly: true },
};
const START_RESOURCES = { holz: 2, stein: 2, nahrung: 2, erz: 1 };
const COLORS = ['#e8590c', '#1c7ed6', '#2f9e44', '#f59f00', '#ae3ec9', '#0ca678'];
const MIN_PLAYERS = 2;
const MAX_PLAYERS = 6;
const ROUND_OPTIONS = [8, 12, 16];
const BANK_RATE = 3;
const MARKT_RATE = 2;
const LOG_LIMIT = 60;
const LAND_PER_PLAYER = 5;
const HOST_HANDOVER_MS = 15_000; // so lange darf ein getrennter Gastgeber zurückkommen
const SNAPSHOT_VERSION = 1;
const REAL_CLOCK = {
  now: () => Date.now(),
  setTimeout: (fn, ms) => {
    const timer = setTimeout(fn, ms);
    if (timer.unref) timer.unref();
    return timer;
  },
  clearTimeout: (timer) => clearTimeout(timer),
};
const MAP_OPTIONS = [
  { kind: 'random', name: 'Zufällige Inselgruppe' },
  { kind: 'kontinent', name: 'Kontinent (ohne Wasser)' },
  ...PRESETS.map((p) => ({ kind: 'preset', id: p.id, name: p.name })),
];

const VARIANTS = [
  { id: 'klassisch', name: 'Klassisch' },
  { id: 'eroberung', name: 'Eroberung (Truppen & Kämpfe)' },
];
// Regeln der Eroberungs-Variante.
const CONQUEST = {
  recruitCost: { nahrung: 1, erz: 1 },
  attackCost: { nahrung: 1 },
  maxGarrison: 6,
  attacksPerTurn: 2,
  movesPerTurn: 1,
  graceRounds: 2, // in diesen ersten Runden sind keine Angriffe erlaubt
  // Stationäre Truppen: feste Besatzung jedes Landgebäudes. Sie verteidigen nur, ziehen nie
  // mit und gehen im Kampf nicht verloren.
  stationary: { siedlung: 1, gut: 2, hafen: 1, markt: 1, monument: 1, wachturm: 2, limes: 3 },
  towerBonus: 1, // Wachturm: +1 Verteidigung für eigene Nachbargebäude (nicht stapelbar)
};

class GameError extends Error {}

function emptyResources() {
  return { holz: 0, stein: 0, nahrung: 0, erz: 0 };
}

function sanitizeAmounts(input) {
  const result = emptyResources();
  if (!input || typeof input !== 'object') return result;
  for (const res of RESOURCES) {
    const n = Number(input[res]);
    if (Number.isInteger(n) && n > 0 && n <= 99) result[res] = n;
  }
  return result;
}

function total(amounts) {
  return RESOURCES.reduce((sum, res) => sum + amounts[res], 0);
}

function canAfford(resources, cost) {
  return RESOURCES.every((res) => resources[res] >= (cost[res] || 0));
}

function emptyStats() {
  return { built: {}, recruited: 0, attacks: 0, attacksWon: 0, defenses: 0, defensesWon: 0, conquered: 0, lost: 0, trades: 0 };
}

function formatAmounts(amounts) {
  return RESOURCES.filter((res) => amounts[res] > 0).map((res) => `${amounts[res]} ${res}`).join(', ');
}

class Game {
  constructor(code, rng = Math.random, { clock = REAL_CLOCK } = {}) {
    this.code = code;
    this.rng = rng;
    this.clock = clock;
    this.onChange = () => {}; // Zustand hat sich ohne Spieleraktion geändert (z. B. Host-Übergabe)
    this.onFinished = () => {}; // Partie bis zum Ende gespielt → Datensatz für die Statistik
    this.hostTimer = null;
    this.rematchVotes = new Set();
    this.startedAt = null;
    this.recorded = false;
    this.phase = 'lobby';
    this.players = [];
    this.hostId = null;
    this.tiles = [];
    this.tileIndex = new Map();
    this.round = 0;
    this.maxRounds = 12;
    this.mapChoice = { kind: 'random', name: MAP_OPTIONS[0].name };
    this.variant = 'klassisch';
    this.attacksLeft = 0;
    this.movesLeft = 0;
    this.lastBattle = null;
    this.currentIndex = 0;
    this.setupQueue = [];
    this.hasRolled = false;
    this.lastRoll = null;
    this.trade = null;
    this.nextTradeId = 1;
    this.log = [];
    this.results = null;
  }

  // ---------- Hilfsfunktionen ----------

  addLog(text) {
    this.log.push(text);
    if (this.log.length > LOG_LIMIT) this.log.shift();
  }

  getPlayer(playerId) {
    const player = this.players.find((p) => p.id === playerId);
    if (!player) throw new GameError('Unbekannter Spieler.');
    return player;
  }

  activePlayers() {
    return this.players.filter((p) => !p.removed);
  }

  requireHost(playerId) {
    if (playerId !== this.hostId) throw new GameError('Nur der Gastgeber kann das.');
  }

  currentPlayer() {
    if (this.phase === 'setup') return this.players[this.setupQueue[0]];
    if (this.phase === 'main') return this.players[this.currentIndex];
    return null;
  }

  requireTurn(playerId, phase) {
    if (this.phase !== phase) throw new GameError('Diese Aktion ist gerade nicht möglich.');
    const current = this.currentPlayer();
    if (!current || current.id !== playerId) throw new GameError('Du bist nicht am Zug.');
    return current;
  }

  requireRolled(playerId) {
    const player = this.requireTurn(playerId, 'main');
    if (!this.hasRolled) throw new GameError('Zuerst würfeln.');
    return player;
  }

  getTile(tileId) {
    const tile = this.tileIndex.get(tileId);
    if (!tile) throw new GameError('Unbekanntes Feld.');
    return tile;
  }

  neighbors(tile) {
    return neighborIds(tile).map((id) => this.tileIndex.get(id)).filter(Boolean);
  }

  ownNeighbors(tile, playerId, predicate) {
    return this.neighbors(tile).some((n) => n.building && n.building.owner === playerId && predicate(n));
  }

  // Landgebäude dürfen neben eigene Landgebäude oder eigene Schiffe – so erreicht man andere Inseln.
  reachableByLand(tile, playerId) {
    return this.ownNeighbors(tile, playerId, (n) => n.terrain !== 'wasser' || n.building.type === 'schiff');
  }

  isPlayable(tile) {
    return tile.terrain !== 'wasser' && tile.terrain !== 'oedland';
  }

  isCoastal(tile) {
    return tile.terrain !== 'wasser' && this.neighbors(tile).some((n) => n.terrain === 'wasser');
  }

  // Start-Siedlungen halten Abstand zueinander; ist kein solches Feld mehr frei, entfällt der Abstand.
  startCandidates() {
    const free = this.tiles.filter((t) => !t.building && this.isPlayable(t));
    const spaced = free.filter((t) => this.neighbors(t).every((n) => !n.building));
    return spaced.length ? spaced : free;
  }

  isValidBuild(tile, playerId, type) {
    if (!BUILDINGS[type] || (BUILDINGS[type].conquestOnly && !this.isConquest())) return false;
    if (type === 'gut') {
      return !!tile.building && tile.building.owner === playerId && tile.building.type === 'siedlung';
    }
    if (tile.building) return false;
    switch (type) {
      case 'siedlung':
        return this.isPlayable(tile) && this.reachableByLand(tile, playerId);
      case 'hafen':
        return this.isPlayable(tile) && this.isCoastal(tile) && this.reachableByLand(tile, playerId);
      case 'markt':
      case 'monument':
      case 'wachturm':
      case 'limes':
        return tile.terrain !== 'wasser' && this.reachableByLand(tile, playerId);
      case 'schiff':
        return tile.terrain === 'wasser'
          && this.ownNeighbors(tile, playerId, (n) => n.building.type === 'hafen' || n.building.type === 'schiff');
      case 'fischerei':
        return tile.terrain === 'wasser' && this.ownNeighbors(tile, playerId, (n) => n.terrain !== 'wasser');
      default:
        return false;
    }
  }

  validTiles(playerId) {
    const current = this.currentPlayer();
    if (!current || current.id !== playerId) return null;
    if (this.phase === 'setup') {
      return { start: this.startCandidates().map((t) => t.id) };
    }
    if (this.phase === 'main' && this.hasRolled) {
      const result = {};
      for (const type of Object.keys(this.availableBuildings())) {
        result[type] = this.tiles.filter((t) => this.isValidBuild(t, playerId, type)).map((t) => t.id);
      }
      return result;
    }
    return null;
  }

  hasMarkt(playerId) {
    return this.tiles.some((t) => t.building && t.building.owner === playerId && t.building.type === 'markt');
  }

  points(playerId) {
    return this.tiles.reduce((sum, t) => {
      if (t.building && t.building.owner === playerId) sum += BUILDINGS[t.building.type].points;
      return sum;
    }, 0);
  }

  // ---------- Lobby ----------

  addPlayer(playerId, rawName) {
    if (this.phase !== 'lobby') throw new GameError('Das Spiel läuft bereits.');
    if (this.players.length >= MAX_PLAYERS) throw new GameError(`Maximal ${MAX_PLAYERS} Spieler.`);
    const name = String(rawName || '').trim().slice(0, 20);
    if (!name) throw new GameError('Bitte einen Namen eingeben.');
    if (this.players.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
      throw new GameError('Dieser Name ist schon vergeben.');
    }
    const usedColors = new Set(this.players.map((p) => p.color));
    const color = COLORS.find((c) => !usedColors.has(c));
    this.players.push({ id: playerId, name, color, resources: emptyResources(), connected: true, removed: false, stats: emptyStats() });
    if (!this.hostId) this.hostId = playerId;
    this.addLog(`${name} ist beigetreten.`);
  }

  removePlayer(playerId) {
    if (this.phase !== 'lobby') return;
    const index = this.players.findIndex((p) => p.id === playerId);
    if (index === -1) return;
    const [removed] = this.players.splice(index, 1);
    this.addLog(`${removed.name} hat den Raum verlassen.`);
    if (this.hostId === playerId) this.hostId = this.players[0] ? this.players[0].id : null;
  }

  setConnected(playerId, connected) {
    const player = this.players.find((p) => p.id === playerId);
    if (!player || player.removed) return;
    player.connected = connected;
    if (connected) {
      const host = this.players.find((p) => p.id === this.hostId);
      if (!host || host.removed) this.hostId = player.id;
    } else {
      if (this.hostId === playerId) this.scheduleHostHandover();
      if (this.phase === 'ended') this.maybeRematch();
    }
  }

  // Nicht sofort übergeben: nach einem Neuladen ist der Gastgeber gleich wieder da.
  scheduleHostHandover() {
    if (this.hostTimer) this.clock.clearTimeout(this.hostTimer);
    this.hostTimer = this.clock.setTimeout(() => {
      this.hostTimer = null;
      const host = this.players.find((p) => p.id === this.hostId);
      if (host && host.connected && !host.removed) return;
      const next = this.activePlayers().find((p) => p.connected);
      if (!next) return;
      this.hostId = next.id;
      this.addLog(`${next.name} ist jetzt Gastgeber.`);
      this.onChange();
    }, HOST_HANDOVER_MS);
  }

  destroy() {
    if (this.hostTimer) this.clock.clearTimeout(this.hostTimer);
    this.hostTimer = null;
  }

  // Gastgeber entfernt einen Spieler. In der Lobby verschwindet er ganz, im Spiel bleiben seine
  // Gebäude stehen und seine Züge werden übersprungen.
  kick(playerId, payload) {
    this.requireHost(playerId);
    const targetId = payload && payload.playerId;
    if (targetId === playerId) throw new GameError('Du kannst dich nicht selbst entfernen.');
    const target = this.players.find((p) => p.id === targetId && !p.removed);
    if (!target) throw new GameError('Spieler nicht gefunden.');
    if (this.phase === 'lobby') {
      this.players.splice(this.players.indexOf(target), 1);
      this.addLog(`${target.name} wurde vom Gastgeber entfernt.`);
      return;
    }
    const wasCurrent = this.currentPlayer() === target;
    target.removed = true;
    target.connected = false;
    this.rematchVotes.delete(target.id);
    if (this.trade && (this.trade.from === target.id || this.trade.to === target.id)) this.trade = null;
    this.addLog(`${target.name} wurde vom Gastgeber entfernt.`);
    if (wasCurrent && this.phase === 'setup') {
      this.advanceSetup();
    } else if (wasCurrent && this.phase === 'main') {
      this.hasRolled = false;
      this.resetTurnLimits();
      this.advanceTurn();
    }
    if (this.phase === 'ended') this.maybeRematch();
  }

  setRounds(playerId, payload) {
    if (this.phase !== 'lobby') throw new GameError('Das Spiel läuft bereits.');
    this.requireHost(playerId);
    const rounds = Number(payload && payload.rounds);
    if (!ROUND_OPTIONS.includes(rounds)) throw new GameError('Ungültige Rundenzahl.');
    this.maxRounds = rounds;
  }

  setMap(playerId, payload) {
    if (this.phase !== 'lobby') throw new GameError('Das Spiel läuft bereits.');
    this.requireHost(playerId);
    const kind = payload && payload.kind;
    if (kind === 'custom') {
      try {
        const map = validateCustomMap(payload.map);
        this.mapChoice = { kind, name: map.name, tiles: map.tiles };
      } catch (err) {
        if (err instanceof MapError) throw new GameError(err.message);
        throw err;
      }
    } else {
      const option = MAP_OPTIONS.find((o) => o.kind === kind && (kind !== 'preset' || o.id === payload.id));
      if (!option) throw new GameError('Unbekannte Karte.');
      this.mapChoice = { ...option };
    }
    this.addLog(`Karte: ${this.mapChoice.name}.`);
  }

  setVariant(playerId, payload) {
    if (this.phase !== 'lobby') throw new GameError('Das Spiel läuft bereits.');
    this.requireHost(playerId);
    const variant = VARIANTS.find((v) => v.id === (payload && payload.variant));
    if (!variant) throw new GameError('Unbekannte Spielvariante.');
    this.variant = variant.id;
    this.addLog(`Spielvariante: ${variant.name}.`);
  }

  // Vorschau-Layout für die Lobby (bei Zufallskarten erst beim Start bekannt).
  mapPreview() {
    if (this.mapChoice.kind === 'custom') return this.mapChoice.tiles;
    if (this.mapChoice.kind === 'preset') return PRESETS.find((p) => p.id === this.mapChoice.id).tiles;
    return null;
  }

  // Start aus der Lobby oder – nach Spielende – direkt die nächste Partie (auch ohne alle Stimmen).
  start(playerId) {
    if (this.phase !== 'lobby' && this.phase !== 'ended') throw new GameError('Das Spiel läuft bereits.');
    this.requireHost(playerId);
    this.beginGame();
  }

  dropRemovedPlayers() {
    this.players = this.activePlayers();
  }

  beginGame() {
    const players = this.activePlayers();
    if (players.length < MIN_PLAYERS) throw new GameError(`Mindestens ${MIN_PLAYERS} Spieler nötig.`);

    const tiles = buildBoard(this.mapChoice, this.players.length, this.rng);
    const needed = this.players.length * LAND_PER_PLAYER;
    if (playableCount(tiles) < needed) {
      throw new GameError(`Die Karte ist zu klein: ${this.players.length} Spieler brauchen mindestens ${needed} bebaubare Landfelder.`);
    }
    for (const t of tiles) t.troops = 0;
    this.tiles = tiles;
    this.tileIndex = new Map(this.tiles.map((t) => [t.id, t]));
    this.dropRemovedPlayers();
    for (const p of this.players) {
      p.resources = { ...START_RESOURCES };
      p.stats = emptyStats();
    }
    Object.assign(this, {
      round: 0, currentIndex: 0, hasRolled: false, lastRoll: null, trade: null, lastBattle: null,
      results: null, recorded: false, startedAt: new Date(this.clock.now()).toISOString(),
    });
    this.rematchVotes.clear();
    this.resetTurnLimits();
    // Schlangenreihenfolge: 1..n, dann n..1 — jeder setzt zwei Start-Siedlungen.
    const order = this.players.map((_, i) => i);
    this.setupQueue = [...order, ...order.slice().reverse()];
    this.phase = 'setup';
    this.addLog(`Das Spiel beginnt (${this.maxRounds} Runden). Jeder setzt zwei Start-Siedlungen.`);
  }

  // ---------- Aufbauphase ----------

  placeStart(playerId, payload) {
    const player = this.requireTurn(playerId, 'setup');
    const tile = this.getTile(payload && payload.tileId);
    if (!this.startCandidates().includes(tile)) {
      throw new GameError('Start-Siedlungen brauchen ein freies Landfeld ohne Nachbargebäude (kein Ödland).');
    }
    tile.building = { type: 'siedlung', owner: player.id };
    if (this.isConquest()) tile.troops = 1;
    this.addLog(`${player.name} gründet eine Start-Siedlung.`);
    this.setupQueue.shift();
    this.advanceSetup();
  }

  // Entfernte Spieler in der Aufbauphase überspringen; danach beginnt Runde 1.
  advanceSetup() {
    while (this.setupQueue.length && this.players[this.setupQueue[0]].removed) this.setupQueue.shift();
    if (this.setupQueue.length) return;
    this.phase = 'main';
    this.round = 1;
    this.currentIndex = this.players.findIndex((p) => !p.removed);
    this.hasRolled = false;
    this.resetTurnLimits();
    this.addLog(`Runde 1 beginnt. ${this.currentPlayer().name} ist am Zug.`);
  }

  // ---------- Hauptphase ----------

  roll(playerId) {
    const player = this.requireTurn(playerId, 'main');
    if (this.hasRolled) throw new GameError('Du hast schon gewürfelt.');

    const region = Math.floor(this.rng() * 6) + 1;
    const face = TERRAIN_DIE[Math.floor(this.rng() * 6)];
    const gains = {};
    for (const tile of this.tiles) {
      if (!tile.building) continue;
      const production = BUILDINGS[tile.building.type].production;
      if (!production) continue;
      let hits;
      if (face === 'stern') {
        hits = tile.region === region ? 2 : 0;
      } else {
        hits = (tile.region === region ? 1 : 0) + (tile.terrain === face ? 1 : 0);
      }
      if (!hits) continue;
      const res = TERRAIN_RESOURCE[tile.terrain];
      const owner = this.getPlayer(tile.building.owner);
      owner.resources[res] += hits * production;
      gains[owner.id] = gains[owner.id] || emptyResources();
      gains[owner.id][res] += hits * production;
    }
    this.hasRolled = true;
    this.lastRoll = { region, face, gains, by: player.id };

    const faceText = face === 'stern' ? 'Stern' : face;
    const gainText = Object.entries(gains)
      .map(([id, amounts]) => `${this.getPlayer(id).name}: ${formatAmounts(amounts)}`)
      .join('; ');
    this.addLog(`${player.name} würfelt Region ${region} / ${faceText}. ${gainText || 'Niemand erhält Rohstoffe.'}`);
  }

  build(playerId, payload) {
    const player = this.requireRolled(playerId);
    const type = payload && payload.type;
    const def = BUILDINGS[type];
    if (!def) throw new GameError('Unbekanntes Gebäude.');
    const tile = this.getTile(payload.tileId);
    if (!this.isValidBuild(tile, playerId, type)) throw new GameError(`Hier kann kein ${def.name} gebaut werden.`);
    if (!canAfford(player.resources, def.cost)) throw new GameError('Nicht genug Rohstoffe.');
    for (const [res, n] of Object.entries(def.cost)) player.resources[res] -= n;
    tile.building = { type, owner: player.id };
    player.stats.built[type] = (player.stats.built[type] || 0) + 1;
    this.addLog(`${player.name} baut ${def.article} ${def.name}.`);
  }

  bankTrade(playerId, payload) {
    const player = this.requireRolled(playerId);
    const give = payload && payload.give;
    const get = payload && payload.get;
    if (!RESOURCES.includes(give) || !RESOURCES.includes(get) || give === get) {
      throw new GameError('Ungültiger Tausch.');
    }
    const rate = this.hasMarkt(playerId) ? MARKT_RATE : BANK_RATE;
    if (player.resources[give] < rate) throw new GameError(`Du brauchst ${rate} ${give}.`);
    player.resources[give] -= rate;
    player.resources[get] += 1;
    player.stats.trades++;
    this.addLog(`${player.name} tauscht mit der Bank ${rate} ${give} gegen 1 ${get}.`);
  }

  proposeTrade(playerId, payload) {
    const player = this.requireRolled(playerId);
    if (this.trade) throw new GameError('Es läuft bereits ein Angebot.');
    const target = this.getPlayer(payload && payload.to);
    if (target.id === player.id) throw new GameError('Du kannst nicht mit dir selbst handeln.');
    const give = sanitizeAmounts(payload.give);
    const want = sanitizeAmounts(payload.want);
    if (total(give) === 0 || total(want) === 0) throw new GameError('Beide Seiten müssen etwas anbieten.');
    if (!canAfford(player.resources, give)) throw new GameError('Du hast nicht genug Rohstoffe.');
    this.trade = { id: this.nextTradeId++, from: player.id, to: target.id, give, want };
    this.addLog(`${player.name} bietet ${target.name} ${formatAmounts(give)} für ${formatAmounts(want)}.`);
  }

  respondTrade(playerId, payload) {
    const trade = this.trade;
    if (!trade || trade.to !== playerId) throw new GameError('Kein Angebot für dich.');
    const from = this.getPlayer(trade.from);
    const to = this.getPlayer(trade.to);
    this.trade = null;
    if (!(payload && payload.accept)) {
      this.addLog(`${to.name} lehnt das Angebot ab.`);
      return;
    }
    if (!canAfford(from.resources, trade.give) || !canAfford(to.resources, trade.want)) {
      this.addLog('Der Handel scheitert: zu wenig Rohstoffe.');
      return;
    }
    for (const res of RESOURCES) {
      from.resources[res] += trade.want[res] - trade.give[res];
      to.resources[res] += trade.give[res] - trade.want[res];
    }
    from.stats.trades++;
    to.stats.trades++;
    this.addLog(`${to.name} nimmt das Angebot von ${from.name} an.`);
  }

  cancelTrade(playerId) {
    if (!this.trade || this.trade.from !== playerId) throw new GameError('Kein eigenes Angebot offen.');
    this.trade = null;
    this.addLog(`${this.getPlayer(playerId).name} zieht das Angebot zurück.`);
  }

  endTurn(playerId) {
    const player = this.requireRolled(playerId);
    this.trade = null;
    this.hasRolled = false;
    this.resetTurnLimits();
    this.addLog(`${player.name} beendet den Zug.`);
    this.advanceTurn();
  }

  // Zum nächsten nicht entfernten Spieler; nach dem letzten beginnt eine neue Runde.
  advanceTurn() {
    this.trade = null;
    for (let step = 0; step < this.players.length; step++) {
      this.currentIndex++;
      if (this.currentIndex >= this.players.length) {
        this.currentIndex = 0;
        this.round++;
        if (this.round > this.maxRounds) {
          this.finish();
          return;
        }
        this.addLog(`Runde ${this.round} von ${this.maxRounds} beginnt.`);
      }
      if (!this.players[this.currentIndex].removed) break;
    }
    this.addLog(`${this.currentPlayer().name} ist am Zug.`);
  }

  // ---------- Eroberungs-Variante ----------

  availableBuildings() {
    return Object.fromEntries(Object.entries(BUILDINGS).filter(([, def]) => !def.conquestOnly || this.isConquest()));
  }

  // Verteidigungswert ohne Würfel: bewegliche + stationäre Truppen + Wachturm in der Nähe.
  defenseOf(tile) {
    const owner = tile.building.owner;
    const stationary = CONQUEST.stationary[tile.building.type] || 0;
    const tower = this.neighbors(tile).some((n) => n.building && n.building.owner === owner && n.building.type === 'wachturm')
      ? CONQUEST.towerBonus : 0;
    return { troops: tile.troops, stationary, tower };
  }

  // Ein Limes schützt die eigenen Nachbargebäude: Sie können erst angegriffen werden, wenn der Limes fällt.
  isShielded(tile) {
    if (tile.building.type === 'limes') return false;
    return this.neighbors(tile).some((n) => n.building && n.building.owner === tile.building.owner && n.building.type === 'limes');
  }

  isConquest() {
    return this.variant === 'eroberung';
  }

  resetTurnLimits() {
    this.attacksLeft = this.isConquest() ? CONQUEST.attacksPerTurn : 0;
    this.movesLeft = this.isConquest() ? CONQUEST.movesPerTurn : 0;
  }

  // Truppen stehen nur auf eigenen Landgebäuden.
  isGarrison(tile, playerId) {
    return !!tile.building && tile.building.owner === playerId && tile.terrain !== 'wasser';
  }

  // Landfelder, die von einem Feld aus erreichbar sind: direkte Nachbarn oder über eine Kette eigener Schiffe.
  reachableFrom(source, playerId) {
    const result = [];
    const visited = new Set([source.id]);
    const queue = [source];
    while (queue.length) {
      const current = queue.shift();
      for (const n of this.neighbors(current)) {
        if (visited.has(n.id)) continue;
        visited.add(n.id);
        if (n.terrain !== 'wasser') result.push(n);
        else if (n.building && n.building.owner === playerId && n.building.type === 'schiff') queue.push(n);
      }
    }
    return result;
  }

  landBuildingCount(playerId) {
    return this.tiles.filter((t) => this.isGarrison(t, playerId)).length;
  }

  canAttack(source, target, playerId) {
    return !!target.building && target.terrain !== 'wasser' && target.building.owner !== playerId
      && this.landBuildingCount(target.building.owner) > 1
      && !this.isShielded(target)
      && this.reachableFrom(source, playerId).includes(target);
  }

  canMove(source, target, playerId) {
    return this.isGarrison(target, playerId) && target.troops < CONQUEST.maxGarrison
      && this.reachableFrom(source, playerId).includes(target);
  }

  requireConquest(playerId) {
    if (!this.isConquest()) throw new GameError('Truppen gibt es nur in der Eroberungs-Variante.');
    return this.requireRolled(playerId);
  }

  requireSource(payload, playerId) {
    const source = this.getTile(payload && payload.from);
    if (!this.isGarrison(source, playerId)) throw new GameError('Wähle ein eigenes Gebäude als Ausgangspunkt.');
    const count = Number(payload.count);
    if (!Number.isInteger(count) || count < 1 || count > source.troops) throw new GameError('Ungültige Truppenzahl.');
    return { source, count };
  }

  recruit(playerId, payload) {
    const player = this.requireConquest(playerId);
    const tile = this.getTile(payload && payload.tileId);
    if (!this.isGarrison(tile, playerId)) throw new GameError('Truppen können nur auf eigenen Landgebäuden stehen.');
    if (tile.troops >= CONQUEST.maxGarrison) throw new GameError(`Maximal ${CONQUEST.maxGarrison} Truppen pro Feld.`);
    if (!canAfford(player.resources, CONQUEST.recruitCost)) throw new GameError('Nicht genug Rohstoffe.');
    for (const [res, n] of Object.entries(CONQUEST.recruitCost)) player.resources[res] -= n;
    tile.troops++;
    player.stats.recruited++;
    this.addLog(`${player.name} rekrutiert eine Truppe.`);
  }

  moveTroops(playerId, payload) {
    const player = this.requireConquest(playerId);
    if (this.movesLeft <= 0) throw new GameError('Keine Verlegung mehr in diesem Zug.');
    const { source, count } = this.requireSource(payload, playerId);
    const target = this.getTile(payload.to);
    if (!this.canMove(source, target, playerId)) throw new GameError('Dorthin können keine Truppen verlegt werden.');
    if (target.troops + count > CONQUEST.maxGarrison) throw new GameError(`Maximal ${CONQUEST.maxGarrison} Truppen pro Feld.`);
    source.troops -= count;
    target.troops += count;
    this.movesLeft--;
    this.addLog(`${player.name} verlegt ${count} Truppe(n).`);
  }

  // Kampf: Angreifer = eingesetzte Truppen + W6, Verteidiger = Truppen + stationäre Truppen + Wachturm + W6.
  // Höhere Summe gewinnt, Gleichstand gewinnt der Verteidiger. Der Verlierer verliert alle beweglichen
  // beteiligten Truppen, der Sieger die Hälfte (aufgerundet) der gegnerischen beweglichen Truppen.
  // Siegt der Angreifer, übernimmt er das Gebäude mit seinen überlebenden Truppen (mindestens eine überlebt).
  attack(playerId, payload) {
    const player = this.requireConquest(playerId);
    if (this.round <= CONQUEST.graceRounds) throw new GameError(`Angriffe sind erst ab Runde ${CONQUEST.graceRounds + 1} erlaubt.`);
    if (this.attacksLeft <= 0) throw new GameError('Keine Angriffe mehr in diesem Zug.');
    const { source, count } = this.requireSource(payload, playerId);
    const target = this.getTile(payload.to);
    if (!this.canAttack(source, target, playerId)) {
      throw new GameError('Dieses Ziel kann nicht angegriffen werden (Reichweite, eigenes oder letztes Gebäude).');
    }
    if (!canAfford(player.resources, CONQUEST.attackCost)) throw new GameError('Nicht genug Rohstoffe für den Angriff.');
    for (const [res, n] of Object.entries(CONQUEST.attackCost)) player.resources[res] -= n;
    this.attacksLeft--;

    const defender = this.getPlayer(target.building.owner);
    const defending = target.troops;
    const { stationary, tower } = this.defenseOf(target);
    const attackRoll = Math.floor(this.rng() * 6) + 1;
    const defenseRoll = Math.floor(this.rng() * 6) + 1;
    const attackTotal = count + attackRoll;
    const defenseTotal = defending + stationary + tower + defenseRoll;
    const attackerWins = attackTotal > defenseTotal;

    source.troops -= count;
    let attackerLosses;
    let defenderLosses;
    if (attackerWins) {
      attackerLosses = Math.min(count - 1, Math.ceil(defending / 2));
      defenderLosses = defending;
      target.building.owner = player.id;
      target.troops = count - attackerLosses;
    } else {
      attackerLosses = count;
      defenderLosses = Math.min(defending, Math.ceil(count / 2));
      target.troops -= defenderLosses;
    }

    player.stats.attacks++;
    defender.stats.defenses++;
    if (attackerWins) {
      player.stats.attacksWon++;
      player.stats.conquered++;
      defender.stats.lost++;
    } else {
      defender.stats.defensesWon++;
    }

    const buildingName = BUILDINGS[target.building.type].name;
    this.lastBattle = {
      attacker: player.id, defender: defender.id, tileId: target.id, building: target.building.type,
      attackTroops: count, attackRoll, attackTotal,
      defenseTroops: defending, defenseStationary: stationary, defenseTower: tower, defenseRoll, defenseTotal,
      attackerWins, attackerLosses, defenderLosses,
    };
    this.addLog(attackerWins
      ? `⚔️ ${player.name} erobert ${defender.name}s ${buildingName} (${attackTotal} gegen ${defenseTotal}).`
      : `🛡️ ${defender.name} wehrt den Angriff von ${player.name} ab (${defenseTotal} gegen ${attackTotal}).`);
  }

  militaryOptions(playerId) {
    if (!this.isConquest() || this.phase !== 'main' || !this.hasRolled) return null;
    const current = this.currentPlayer();
    if (!current || current.id !== playerId) return null;
    const garrisons = this.tiles.filter((t) => this.isGarrison(t, playerId));
    const canRecruit = canAfford(current.resources, CONQUEST.recruitCost);
    const attackAllowed = this.round > CONQUEST.graceRounds && this.attacksLeft > 0
      && canAfford(current.resources, CONQUEST.attackCost);
    const sources = {};
    for (const source of garrisons) {
      if (source.troops < 1) continue;
      const reachable = this.reachableFrom(source, playerId);
      sources[source.id] = {
        attack: attackAllowed ? reachable.filter((t) => this.canAttack(source, t, playerId)).map((t) => t.id) : [],
        move: this.movesLeft > 0 ? reachable.filter((t) => this.canMove(source, t, playerId)).map((t) => t.id) : [],
      };
    }
    return {
      recruit: canRecruit ? garrisons.filter((t) => t.troops < CONQUEST.maxGarrison).map((t) => t.id) : [],
      sources,
    };
  }

  // Ein Mitspieler kann den Zug eines getrennten Spielers überspringen, damit das Spiel weiterläuft.
  forceSkip(playerId) {
    this.getPlayer(playerId);
    const current = this.currentPlayer();
    if (!current || current.connected) throw new GameError('Der aktuelle Spieler ist verbunden.');
    if (this.phase === 'setup') {
      const options = this.startCandidates();
      const tile = options[Math.floor(this.rng() * options.length)];
      this.addLog(`Start-Siedlung für ${current.name} wird automatisch gesetzt.`);
      this.placeStart(current.id, { tileId: tile.id });
    } else if (this.phase === 'main') {
      if (!this.hasRolled) this.roll(current.id);
      this.addLog(`Zug von ${current.name} wird übersprungen (nicht verbunden).`);
      this.endTurn(current.id);
    }
  }

  finish() {
    this.phase = 'ended';
    this.trade = null;
    this.rematchVotes.clear();
    this.results = this.players
      .map((p) => ({
        id: p.id, name: p.name, color: p.color, removed: p.removed,
        points: this.points(p.id), resources: total(p.resources), stats: p.stats,
      }))
      .sort((a, b) => a.removed - b.removed || b.points - a.points || b.resources - a.resources);
    this.addLog(`Spielende! ${this.results[0].name} gewinnt mit ${this.results[0].points} Punkten.`);
    if (!this.recorded) {
      this.recorded = true;
      this.onFinished(this.gameRecord());
    }
  }

  // Datensatz einer beendeten Partie für die Statistik.
  gameRecord() {
    return {
      room: this.code,
      startedAt: this.startedAt,
      endedAt: new Date(this.clock.now()).toISOString(),
      variant: this.variant,
      map: { kind: this.mapChoice.kind, name: this.mapChoice.name },
      rounds: this.maxRounds,
      players: this.results.map((r) => ({
        name: r.name, points: r.points, resources: r.resources, removed: r.removed, stats: r.stats,
      })),
    };
  }

  // ---------- Nach dem Spiel ----------

  // „Nochmal spielen“: Jeder stimmt ab (erneut klicken nimmt die Stimme zurück). Haben alle
  // verbundenen Spieler zugestimmt, startet die nächste Partie mit denselben Einstellungen.
  voteRematch(playerId, payload) {
    if (this.phase !== 'ended') throw new GameError('Gerade nicht möglich.');
    const player = this.getPlayer(playerId);
    if (player.removed) throw new GameError('Du wurdest aus dem Spiel entfernt.');
    if (payload && payload.vote === false) this.rematchVotes.delete(playerId);
    else this.rematchVotes.add(playerId);
    this.maybeRematch();
  }

  maybeRematch() {
    if (this.phase !== 'ended' || this.rematchVotes.size === 0) return;
    const online = this.activePlayers().filter((p) => p.connected);
    if (online.length > 0 && online.every((p) => this.rematchVotes.has(p.id)) && this.activePlayers().length >= MIN_PLAYERS) {
      this.addLog('Alle sind dabei – neue Partie!');
      this.beginGame();
    }
  }

  backToLobby(playerId) {
    if (this.phase !== 'ended') throw new GameError('Erst nach Spielende möglich.');
    this.requireHost(playerId);
    this.dropRemovedPlayers();
    Object.assign(this, {
      phase: 'lobby', tiles: [], tileIndex: new Map(), round: 0, results: null, lastRoll: null, lastBattle: null,
    });
    this.rematchVotes.clear();
    this.addLog('Zurück in der Lobby.');
  }

  // ---------- Sicherung über Neustarts ----------

  snapshot() {
    const fields = [
      'code', 'phase', 'players', 'hostId', 'tiles', 'round', 'maxRounds', 'mapChoice', 'variant',
      'attacksLeft', 'movesLeft', 'lastBattle', 'currentIndex', 'setupQueue', 'hasRolled', 'lastRoll',
      'trade', 'nextTradeId', 'log', 'results', 'startedAt', 'recorded',
    ];
    const snap = Object.fromEntries(fields.map((f) => [f, this[f]]));
    return JSON.parse(JSON.stringify({
      ...snap, version: SNAPSHOT_VERSION, savedAt: new Date(this.clock.now()).toISOString(), rematchVotes: [...this.rematchVotes],
    }));
  }

  static restore(snap, rng = Math.random, options = {}) {
    if (!snap || snap.version !== SNAPSHOT_VERSION) return null;
    const game = new Game(snap.code, rng, options);
    const { version, savedAt, rematchVotes, ...fields } = snap;
    Object.assign(game, fields);
    game.rematchVotes = new Set(rematchVotes || []);
    game.tileIndex = new Map(game.tiles.map((t) => [t.id, t]));
    // Nach dem Neustart ist zunächst niemand verbunden; kommt der Gastgeber nicht zurück, wird übergeben.
    for (const p of game.players) p.connected = false;
    game.scheduleHostHandover();
    return game;
  }

  // ---------- Zustand für Clients ----------

  publicState(viewerId) {
    const current = this.currentPlayer();
    return {
      code: this.code,
      phase: this.phase,
      hostId: this.hostId,
      you: viewerId,
      round: this.round,
      maxRounds: this.maxRounds,
      roundOptions: ROUND_OPTIONS,
      mapOptions: MAP_OPTIONS,
      map: { kind: this.mapChoice.kind, id: this.mapChoice.id || null, name: this.mapChoice.name },
      mapPreview: this.phase === 'lobby' ? this.mapPreview() : null,
      variant: this.variant,
      variants: VARIANTS,
      conquest: this.isConquest() ? CONQUEST : null,
      attacksLeft: this.attacksLeft,
      movesLeft: this.movesLeft,
      lastBattle: this.lastBattle,
      military: this.militaryOptions(viewerId),
      currentPlayerId: current ? current.id : null,
      hasRolled: this.hasRolled,
      lastRoll: this.lastRoll,
      trade: this.trade,
      log: this.log,
      results: this.results,
      buildings: this.availableBuildings(),
      rates: { bank: BANK_RATE, markt: MARKT_RATE },
      rematchVotes: [...this.rematchVotes],
      players: this.players.map((p) => ({
        id: p.id,
        name: p.name,
        color: p.color,
        connected: p.connected,
        removed: p.removed,
        points: this.points(p.id),
        resourceCount: total(p.resources),
        resources: p.id === viewerId ? p.resources : null,
        hasMarkt: this.hasMarkt(p.id),
      })),
      tiles: this.tiles,
      validTiles: this.validTiles(viewerId),
    };
  }
}

module.exports = { Game, GameError, BUILDINGS, RESOURCES, START_RESOURCES, TERRAIN_DIE, CONQUEST, HOST_HANDOVER_MS };
