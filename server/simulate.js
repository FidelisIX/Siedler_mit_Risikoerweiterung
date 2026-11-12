'use strict';

/**
 * Automatisierte Testpartien nur mit Computergegnern. Nach jedem Schritt wird geprüft, ob der Spielzustand
 * gültig ist (keine negativen Rohstoffe, Gebäude nur auf passendem Gelände, Truppen im erlaubten Bereich, …),
 * und regelmäßig, ob Sicherung und Wiederherstellung den Zustand unverändert lassen.
 * Verwendet von scripts/simulate.js (Kommandozeile) und test/bots.test.js.
 */

const { Game, BUILDINGS, RESOURCES, CONQUEST } = require('./game');
const bots = require('./bot');

const WATER_BUILDINGS = new Set(['schiff', 'fischerei']);

function seeded(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Liefert eine Liste von Regelverletzungen (leer = alles in Ordnung). */
function checkInvariants(game) {
  const problems = [];
  const ids = new Set(game.players.map((p) => p.id));
  for (const p of game.players) {
    for (const r of RESOURCES) {
      if (!Number.isInteger(p.resources[r]) || p.resources[r] < 0) problems.push(`${p.name}: ${r} = ${p.resources[r]}`);
    }
    if (p.eliminated && game.landBuildingCount(p.id) > 0) problems.push(`${p.name} ist besiegt, hat aber Landgebäude`);
  }
  for (const t of game.tiles) {
    if (!Number.isInteger(t.troops) || t.troops < 0 || t.troops > CONQUEST.maxGarrison) problems.push(`Feld ${t.id}: ${t.troops} Truppen`);
    if (!t.building) {
      if (t.troops) problems.push(`Feld ${t.id}: Truppen ohne Gebäude`);
      continue;
    }
    const { type, owner } = t.building;
    if (!BUILDINGS[type]) problems.push(`Feld ${t.id}: unbekanntes Gebäude ${type}`);
    if (!ids.has(owner)) problems.push(`Feld ${t.id}: unbekannter Besitzer ${owner}`);
    if ((t.terrain === 'wasser') !== WATER_BUILDINGS.has(type)) problems.push(`Feld ${t.id}: ${type} auf ${t.terrain}`);
    if ((type === 'dorf' || type === 'stadt' || type === 'hafen') && t.terrain === 'oedland') problems.push(`Feld ${t.id}: ${type} auf Ödland`);
    if (t.terrain === 'wasser' && t.troops) problems.push(`Feld ${t.id}: Truppen auf Wasser`);
    if (!game.isConquest() && (t.troops || BUILDINGS[type].conquestOnly)) problems.push(`Feld ${t.id}: Eroberungs-Inhalt im klassischen Spiel`);
  }
  if (game.phase === 'main' && !game.inGame(game.currentPlayer())) problems.push('Am Zug ist ein Spieler, der nicht mehr im Spiel ist');
  return problems;
}

// Sicherung → Wiederherstellung darf am sichtbaren Zustand nichts ändern.
function checkSnapshot(game) {
  const restored = Game.restore(JSON.parse(JSON.stringify(game.snapshot())), game.rng);
  restored.destroy();
  const viewer = game.players[0].id;
  const strip = (state) => JSON.stringify({ ...state, players: state.players.map(({ connected, ...p }) => p) });
  return strip(restored.publicState(viewer)) === strip(game.publicState(viewer)) ? [] : ['Sicherung/Wiederherstellung verändert den Zustand'];
}

/**
 * Eine Partie nur mit Computergegnern spielen.
 * @param {object} cfg  players (2–6), variant, mode, target, roundLimit, map ({kind, id}), teams (z. B. ['A','B','A','B']), seed
 */
function simulateGame(cfg = {}) {
  const rng = seeded(cfg.seed || 1);
  const game = new Game('SIM', rng);
  const n = cfg.players || 3;
  for (let i = 0; i < n; i++) {
    game.addPlayer(`bot-${i}`, `Computer ${i + 1}`);
    game.players[i].bot = true;
  }
  const host = game.hostId;
  if (cfg.variant) game.setVariant(host, { variant: cfg.variant });
  if (cfg.map) game.setMap(host, cfg.map);
  game.setVictory(host, {
    ...(cfg.mode ? { mode: cfg.mode } : {}),
    target: cfg.target || 12,
    roundLimit: cfg.roundLimit === undefined ? 40 : cfg.roundLimit,
  });
  if (cfg.teams) {
    game.setTeamsEnabled(host, { enabled: true });
    cfg.teams.forEach((team, i) => game.setTeam(host, { playerId: `bot-${i}`, team }));
  }
  game.start(host);

  const stats = new bots.BotStats();
  const violations = [];
  const maxSteps = cfg.maxSteps || 5000;
  let steps = 0;
  while (bots.botPending(game) && steps < maxSteps) {
    bots.step(game, stats, rng);
    steps++;
    for (const v of checkInvariants(game)) violations.push(`Runde ${game.round}: ${v}`);
    if (steps % 25 === 0 && game.phase !== 'ended') violations.push(...checkSnapshot(game));
    if (violations.length > 20) break;
  }
  game.destroy();
  return {
    finished: game.phase === 'ended',
    reason: game.finishReason,
    winner: game.phase === 'ended' ? game.teamLabel(game.winnerTeam) : null,
    rounds: game.round,
    steps,
    stats,
    violations,
    record: game.phase === 'ended' ? game.gameRecord() : null,
  };
}

module.exports = { simulateGame, checkInvariants, seeded };
