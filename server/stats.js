'use strict';

/**
 * Auswertung der gespeicherten Partien: Rekorde, Spielertabelle und Kartenübersicht.
 * Reine Funktion ohne I/O.
 */

const playerKey = (name) => String(name).trim().toLowerCase();
const builtCount = (stats) => Object.values((stats && stats.built) || {}).reduce((sum, n) => sum + n, 0);

function winnersOf(game) {
  // Seit den wählbaren Siegbedingungen steht der Sieger im Datensatz (z. B. bei Vernichtung nicht nach Punkten).
  if (game.winner) return [playerKey(game.winner)];
  const scored = game.players.filter((p) => !p.removed);
  if (scored.length < 2) return [];
  const best = Math.max(...scored.map((p) => p.points));
  return scored.filter((p) => p.points === best).map((p) => playerKey(p.name));
}

/**
 * @param {object[]} allGames
 * @param {{variant?: string, player?: string}} filter  variant: 'klassisch' | 'eroberung' | '' (alle)
 */
function computeStats(allGames, filter = {}) {
  const names = new Map(); // key → Anzeigename (zuletzt verwendete Schreibweise)
  for (const g of allGames) for (const p of g.players) names.set(playerKey(p.name), p.name);

  const wanted = filter.player ? playerKey(filter.player) : null;
  const games = allGames.filter(
    (g) => (!filter.variant || g.variant === filter.variant)
      && (!wanted || g.players.some((p) => playerKey(p.name) === wanted)),
  );

  const players = new Map();
  const stat = (key) => {
    if (!players.has(key)) {
      players.set(key, {
        name: names.get(key) || key, games: 0, wins: 0, sumPoints: 0, bestPoints: 0,
        built: 0, conquered: 0, lost: 0, attacks: 0, attacksWon: 0, trades: 0,
      });
    }
    return players.get(key);
  };

  let bestGame = null;
  let mostConquests = null;
  let mostBuilt = null;
  let closestWin = null;
  const maps = new Map();

  for (const g of games) {
    const winners = new Set(winnersOf(g));
    const ranked = g.players.filter((p) => !p.removed).sort((a, b) => b.points - a.points);
    if (ranked.length >= 2 && ranked[0].points > ranked[1].points) {
      const margin = ranked[0].points - ranked[1].points;
      if (!closestWin || margin < closestWin.margin) {
        closestWin = { player: ranked[0].name, runnerUp: ranked[1].name, margin, date: g.endedAt, map: g.map.name };
      }
    }

    const map = maps.get(g.map.name) || { name: g.map.name, games: 0, sumWinPoints: 0 };
    map.games += 1;
    map.sumWinPoints += ranked.length ? ranked[0].points : 0;
    maps.set(g.map.name, map);

    for (const p of g.players) {
      const key = playerKey(p.name);
      if (wanted && key !== wanted) continue;
      const s = stat(key);
      const built = builtCount(p.stats);
      s.games += 1;
      if (winners.has(key)) s.wins += 1;
      s.sumPoints += p.points;
      s.bestPoints = Math.max(s.bestPoints, p.points);
      s.built += built;
      s.conquered += (p.stats && p.stats.conquered) || 0;
      s.lost += (p.stats && p.stats.lost) || 0;
      s.attacks += (p.stats && p.stats.attacks) || 0;
      s.attacksWon += (p.stats && p.stats.attacksWon) || 0;
      s.trades += (p.stats && p.stats.trades) || 0;

      const entry = { player: s.name, date: g.endedAt, map: g.map.name, variant: g.variant };
      if (!bestGame || p.points > bestGame.points) bestGame = { ...entry, points: p.points, rounds: g.roundsPlayed ?? g.rounds };
      if (!mostBuilt || built > mostBuilt.built) mostBuilt = { ...entry, built };
      const conquered = (p.stats && p.stats.conquered) || 0;
      if (conquered > 0 && (!mostConquests || conquered > mostConquests.conquered)) mostConquests = { ...entry, conquered };
    }
  }

  const table = [...players.values()]
    .map((s) => ({
      name: s.name,
      games: s.games,
      wins: s.wins,
      winRate: s.games ? Math.round((s.wins / s.games) * 100) : 0,
      avgPoints: s.games ? Math.round((s.sumPoints / s.games) * 10) / 10 : 0,
      bestPoints: s.bestPoints,
      built: s.built,
      conquered: s.conquered,
      lost: s.lost,
      attackRate: s.attacks ? Math.round((s.attacksWon / s.attacks) * 100) : null,
      trades: s.trades,
    }))
    .sort((a, b) => b.wins - a.wins || b.winRate - a.winRate || b.games - a.games);

  const byWins = table.filter((p) => p.wins > 0).sort((a, b) => b.wins - a.wins)[0] || null;
  const byGames = table.slice().sort((a, b) => b.games - a.games)[0] || null;

  return {
    games: games.length,
    records: {
      bestGame,
      mostWins: byWins && { player: byWins.name, wins: byWins.wins },
      mostGames: byGames && { player: byGames.name, games: byGames.games },
      mostBuilt,
      mostConquests,
      closestWin,
    },
    players: table,
    maps: [...maps.values()]
      .map((m) => ({ name: m.name, games: m.games, avgWinPoints: Math.round((m.sumWinPoints / m.games) * 10) / 10 }))
      .sort((a, b) => b.games - a.games),
    playerNames: [...names.values()].sort((a, b) => a.localeCompare(b, 'de')),
  };
}

module.exports = { computeStats, winnersOf, playerKey };
