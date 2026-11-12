'use strict';

/**
 * Computergegner ohne besondere Strategie: Sie spielen zufällige, aber gültige Züge und nutzen dabei
 * möglichst viele Spielfunktionen (Bauen, Banktausch, Truppen, Angriffe, Handel beantworten). Gedacht
 * zum Ausprobieren und für automatisierte Tests (scripts/simulate.js, test/bots.test.js).
 *
 * Alle Aktionen laufen über die normalen Methoden von Game – Bots können also nichts, was ein Mensch
 * nicht auch könnte. Ein GameError bei einer Bot-Aktion bedeutet, dass Bot und Spielregeln nicht
 * zusammenpassen; er wird gezählt (stats.errors) und der Zug geht weiter.
 */

const { GameError, BUILDINGS, RESOURCES, CONQUEST } = require('./game');

// Reihenfolge, in der gebaut wird, wenn mehreres möglich ist (vorne = lieber).
const BUILD_PRIORITY = ['stadt', 'dorf', 'hafen', 'monument', 'markt', 'wachturm', 'limes', 'schiff', 'fischerei'];
const MAX_ACTIONS_PER_TURN = 12;

function pick(list, rng) {
  return list[Math.floor(rng() * list.length)];
}

function canAfford(resources, cost) {
  return RESOURCES.every((r) => resources[r] >= (cost[r] || 0));
}

class BotStats {
  constructor() {
    this.turns = 0;
    this.actions = {};
    this.errors = [];
  }

  count(action) {
    this.actions[action] = (this.actions[action] || 0) + 1;
  }
}

// Eine Aktion ausführen; Regelverstöße des Bots werden protokolliert statt das Spiel abzubrechen.
function attempt(game, stats, action, fn) {
  try {
    fn();
    stats.count(action);
    return true;
  } catch (err) {
    if (!(err instanceof GameError)) throw err;
    stats.errors.push({ action, message: err.message, round: game.round });
    return false;
  }
}

function tryBuild(game, bot, stats, rng) {
  const valid = game.validTiles(bot.id) || {};
  const options = BUILD_PRIORITY.filter((type) => valid[type] && valid[type].length
    && game.availableBuildings()[type] && canAfford(bot.resources, BUILDINGS[type].cost));
  if (!options.length) return false;
  // Meist das Wichtigste bauen, manchmal etwas Zufälliges – so kommen alle Gebäude vor.
  const type = rng() < 0.7 ? options[0] : pick(options, rng);
  return attempt(game, stats, `bauen:${type}`, () => game.build(bot.id, { type, tileId: pick(valid[type], rng) }));
}

function tryMilitary(game, bot, stats, rng) {
  const mil = game.militaryOptions(bot.id);
  if (!mil) return false;
  const sources = Object.entries(mil.sources);
  const attacks = sources.filter(([, o]) => o.attack.length);
  if (attacks.length && rng() < 0.7) {
    // Vom Feld mit den meisten Truppen angreifen, mit allen Truppen dort.
    const [from, options] = attacks.sort(([a], [b]) => game.getTile(b).troops - game.getTile(a).troops)[0];
    const count = game.getTile(from).troops;
    return attempt(game, stats, 'angreifen', () => game.attack(bot.id, { from, to: pick(options.attack, rng), count }));
  }
  if (mil.recruit.length && rng() < 0.6) {
    return attempt(game, stats, 'rekrutieren', () => game.recruit(bot.id, { tileId: pick(mil.recruit, rng) }));
  }
  const moves = sources.filter(([, o]) => o.move.length);
  if (moves.length && rng() < 0.3) {
    const [from, options] = pick(moves, rng);
    const to = pick(options.move, rng);
    // Die Hälfte verlegen, aber nicht mehr, als am Ziel noch Platz ist
    const room = CONQUEST.maxGarrison - game.getTile(to).troops;
    const count = Math.max(1, Math.min(Math.floor(game.getTile(from).troops / 2), room));
    return attempt(game, stats, 'verlegen', () => game.moveTroops(bot.id, { from, to, count }));
  }
  return false;
}

// Überschuss gegen den knappsten Rohstoff tauschen.
function tryBankTrade(game, bot, stats) {
  const rate = game.bankRate(bot.id);
  const give = RESOURCES.reduce((best, r) => (bot.resources[r] > bot.resources[best] ? r : best));
  const get = RESOURCES.filter((r) => r !== give).reduce((best, r) => (bot.resources[r] < bot.resources[best] ? r : best));
  if (bot.resources[give] < rate + 1) return false;
  return attempt(game, stats, 'banktausch', () => game.bankTrade(bot.id, { give, get }));
}

// Gelegentlich einem Mitspieler ein Angebot machen (testet den Handel zwischen Spielern).
function tryProposeTrade(game, bot, stats, rng) {
  if (game.trade || rng() > 0.15) return false;
  const others = game.players.filter((p) => p.id !== bot.id && game.inGame(p));
  if (!others.length) return false;
  const give = RESOURCES.reduce((best, r) => (bot.resources[r] > bot.resources[best] ? r : best));
  const want = pick(RESOURCES.filter((r) => r !== give), rng);
  if (bot.resources[give] < 1) return false;
  return attempt(game, stats, 'angebot', () => game.proposeTrade(bot.id, {
    to: pick(others, rng).id, give: { [give]: 1 }, want: { [want]: 1 },
  }));
}

/** Einen vollständigen Zug (bzw. eine Start-Platzierung) für den Bot am Zug spielen. */
function playTurn(game, stats = new BotStats(), rng = Math.random) {
  const bot = game.currentPlayer();
  if (!bot || !bot.bot || game.vote) return false;
  if (game.phase === 'setup') {
    const options = game.validTiles(bot.id).start;
    return attempt(game, stats, 'startdorf', () => game.placeStart(bot.id, { tileId: pick(options, rng) }));
  }
  stats.turns++;
  attempt(game, stats, 'würfeln', () => game.roll(bot.id));
  let trades = 0;
  for (let i = 0; i < MAX_ACTIONS_PER_TURN && game.phase === 'main'; i++) {
    if (tryMilitary(game, bot, stats, rng)) continue;
    if (tryBuild(game, bot, stats, rng)) continue;
    if (trades < 2 && tryBankTrade(game, bot, stats)) { trades++; continue; }
    // Angebote an andere Bots werden sofort beantwortet, an Menschen bleiben sie bis Zugende offen
    if (tryProposeTrade(game, bot, stats, rng)) answerTrade(game, stats, rng);
    break;
  }
  // Ein eigenes, unbeantwortetes Angebot vor Zugende zurückziehen
  if (game.phase === 'main' && game.trade && game.trade.from === bot.id) {
    attempt(game, stats, 'angebot-zurück', () => game.cancelTrade(bot.id));
  }
  if (game.phase === 'main') attempt(game, stats, 'zugende', () => game.endTurn(bot.id));
  return true;
}

/** Ein offenes Angebot an einen Bot beantworten: annehmen, wenn er es sich leisten kann. */
function answerTrade(game, stats = new BotStats(), rng = Math.random) {
  const trade = game.trade;
  if (!trade) return false;
  const bot = game.players.find((p) => p.id === trade.to);
  if (!bot || !bot.bot) return false;
  const accept = canAfford(bot.resources, trade.want) && rng() < 0.7;
  return attempt(game, stats, accept ? 'angebot-an' : 'angebot-ab', () => game.respondTrade(bot.id, { accept }));
}

/** Gibt es gerade etwas für einen Bot zu tun? */
function botPending(game) {
  if (game.vote) return false;
  if (game.trade && game.players.find((p) => p.id === game.trade.to)?.bot) return true;
  const current = game.currentPlayer();
  return !!current && !!current.bot && (game.phase === 'setup' || game.phase === 'main');
}

/** Einen Bot-Schritt ausführen (Angebot beantworten oder einen Zug spielen). */
function step(game, stats, rng) {
  return answerTrade(game, stats, rng) || playTurn(game, stats, rng);
}

module.exports = { BotStats, playTurn, answerTrade, botPending, step };
