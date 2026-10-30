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
const MAP_OPTIONS = [
  { kind: 'random', name: 'Zufällige Inselgruppe' },
  { kind: 'kontinent', name: 'Kontinent (ohne Wasser)' },
  ...PRESETS.map((p) => ({ kind: 'preset', id: p.id, name: p.name })),
];

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

function formatAmounts(amounts) {
  return RESOURCES.filter((res) => amounts[res] > 0).map((res) => `${amounts[res]} ${res}`).join(', ');
}

class Game {
  constructor(code, rng = Math.random) {
    this.code = code;
    this.rng = rng;
    this.phase = 'lobby';
    this.players = [];
    this.hostId = null;
    this.tiles = [];
    this.tileIndex = new Map();
    this.round = 0;
    this.maxRounds = 12;
    this.mapChoice = { kind: 'random', name: MAP_OPTIONS[0].name };
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
      for (const type of Object.keys(BUILDINGS)) {
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
    this.players.push({ id: playerId, name, color, resources: emptyResources(), connected: true });
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
    if (player) player.connected = connected;
  }

  setRounds(playerId, payload) {
    if (this.phase !== 'lobby') throw new GameError('Das Spiel läuft bereits.');
    if (playerId !== this.hostId) throw new GameError('Nur der Gastgeber kann das ändern.');
    const rounds = Number(payload && payload.rounds);
    if (!ROUND_OPTIONS.includes(rounds)) throw new GameError('Ungültige Rundenzahl.');
    this.maxRounds = rounds;
  }

  setMap(playerId, payload) {
    if (this.phase !== 'lobby') throw new GameError('Das Spiel läuft bereits.');
    if (playerId !== this.hostId) throw new GameError('Nur der Gastgeber kann das ändern.');
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

  // Vorschau-Layout für die Lobby (bei Zufallskarten erst beim Start bekannt).
  mapPreview() {
    if (this.mapChoice.kind === 'custom') return this.mapChoice.tiles;
    if (this.mapChoice.kind === 'preset') return PRESETS.find((p) => p.id === this.mapChoice.id).tiles;
    return null;
  }

  start(playerId) {
    if (this.phase !== 'lobby') throw new GameError('Das Spiel läuft bereits.');
    if (playerId !== this.hostId) throw new GameError('Nur der Gastgeber kann starten.');
    if (this.players.length < MIN_PLAYERS) throw new GameError(`Mindestens ${MIN_PLAYERS} Spieler nötig.`);

    const tiles = buildBoard(this.mapChoice, this.players.length, this.rng);
    const needed = this.players.length * LAND_PER_PLAYER;
    if (playableCount(tiles) < needed) {
      throw new GameError(`Die Karte ist zu klein: ${this.players.length} Spieler brauchen mindestens ${needed} bebaubare Landfelder.`);
    }
    this.tiles = tiles;
    this.tileIndex = new Map(this.tiles.map((t) => [t.id, t]));
    for (const p of this.players) p.resources = { ...START_RESOURCES };
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
    this.addLog(`${player.name} gründet eine Start-Siedlung.`);
    this.setupQueue.shift();
    if (this.setupQueue.length === 0) {
      this.phase = 'main';
      this.round = 1;
      this.currentIndex = 0;
      this.hasRolled = false;
      this.addLog(`Runde 1 beginnt. ${this.players[0].name} ist am Zug.`);
    }
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
    this.addLog(`${player.name} beendet den Zug. ${this.currentPlayer().name} ist am Zug.`);
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
    this.results = this.players
      .map((p) => ({ id: p.id, name: p.name, color: p.color, points: this.points(p.id), resources: total(p.resources) }))
      .sort((a, b) => b.points - a.points || b.resources - a.resources);
    this.addLog(`Spielende! ${this.results[0].name} gewinnt mit ${this.results[0].points} Punkten.`);
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
      currentPlayerId: current ? current.id : null,
      hasRolled: this.hasRolled,
      lastRoll: this.lastRoll,
      trade: this.trade,
      log: this.log,
      results: this.results,
      buildings: BUILDINGS,
      rates: { bank: BANK_RATE, markt: MARKT_RATE },
      players: this.players.map((p) => ({
        id: p.id,
        name: p.name,
        color: p.color,
        connected: p.connected,
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

module.exports = { Game, GameError, BUILDINGS, RESOURCES, START_RESOURCES, TERRAIN_DIE };
