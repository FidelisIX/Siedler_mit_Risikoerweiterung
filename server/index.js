'use strict';

const crypto = require('crypto');
const http = require('http');
const path = require('path');
const express = require('express');
const { Server } = require('socket.io');
const { Game, GameError } = require('./game');
const { PRESETS } = require('./map');
const { createStatsStore } = require('./store');
const { computeStats } = require('./stats');
const bots = require('./bot');

const ROOM_IDLE_MS = 30 * 60 * 1000;
// Ältere Raumsicherungen werden verworfen. Etwas länger als ROOM_IDLE_MS, damit auch ein Raum, in dem vor dem
// Absturz eine Weile nichts passiert ist, noch wiederhergestellt wird.
const SNAPSHOT_MAX_AGE_MS = 35 * 60 * 1000;
// Regelmäßige Sicherung geänderter Räume (B-002: übersteht auch Abstürze). GitHub erlaubt im Allgemeinen höchstens
// 80 schreibende Anfragen pro Minute und 500 pro Stunde (einzelne Endpunkte weniger, Stand 2026-11, siehe
// https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api) – bei 60 s reicht das für
// etwa 8 gleichzeitig aktive Räume.
const BACKUP_INTERVAL_MS = Number(process.env.ROOM_BACKUP_INTERVAL_MS) || 60 * 1000;
const RESTORE_WAIT_MS = 15_000; // so lange wartet ein Beitritt auf die Sicherung des alten Servers
const SHUTDOWN_SAVE_TIMEOUT_MS = 8_000;
// Pause vor jedem Bot-Zug, damit man im Browser mitverfolgen kann, was passiert.
const BOT_DELAY_MS = Number(process.env.BOT_DELAY_MS) || 700;
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const ACTIONS = new Set([
  'setVictory', 'setMap', 'start', 'placeStart', 'roll', 'build',
  'bankTrade', 'proposeTrade', 'respondTrade', 'cancelTrade', 'endTurn', 'forceSkip',
  'setVariant', 'recruit', 'moveTroops', 'attack',
  'voteRematch', 'backToLobby', 'castVote', 'setTeamsEnabled', 'setTeam', 'addBot',
]);

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
// Tokens werden nur gehasht gespeichert – die Raumsicherungen liegen im (öffentlichen) Datenbranch.
const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

function validToken(token) {
  return typeof token === 'string' && token.length >= 10 && token.length <= 100;
}

function createServer({
  store = createStatsStore(), restoreWaitMs = RESTORE_WAIT_MS, restorePollMs = 1000, backupIntervalMs = BACKUP_INTERVAL_MS,
  botDelayMs = BOT_DELAY_MS,
} = {}) {
  const app = express();
  const server = http.createServer(app);
  const io = new Server(server);

  // code -> { game, tokens: Map<tokenHash, playerId>, lastActive }
  const rooms = new Map();

  // ---------- Statistik ----------

  const stats = { games: [], loaded: false, error: null };
  const statsReady = store
    .load()
    .then((games) => {
      stats.games.push(...games);
      stats.loaded = true;
      console.log(`Statistik: ${games.length} Partien geladen (${store.description})`);
    })
    .catch((err) => {
      stats.error = err.message;
      console.error('Statistik konnte nicht geladen werden:', err.message);
    });

  function recordGame(record) {
    stats.games.push(record);
    store.append(record).catch((err) => console.error('Statistik konnte nicht gespeichert werden:', err.message));
  }

  app.use(express.static(path.join(__dirname, '..', 'public')));
  app.get('/healthz', (req, res) => res.send('ok'));
  app.get('/api/maps', (req, res) => res.json(PRESETS));
  app.get('/api/stats', async (req, res) => {
    await statsReady;
    const filter = {
      variant: ['klassisch', 'eroberung'].includes(req.query.variant) ? req.query.variant : '',
      player: typeof req.query.player === 'string' ? req.query.player.slice(0, 20) : '',
    };
    res.json({
      ...computeStats(stats.games, filter),
      storage: { description: store.description, persistent: store.persistent, loaded: stats.loaded, error: stats.error },
    });
  });

  // ---------- Räume ----------

  function registerRoom(game, tokens = new Map()) {
    const room = { game, tokens, lastActive: Date.now() };
    game.onChange = () => broadcast(room);
    game.onFinished = recordGame;
    rooms.set(game.code, room);
    return room;
  }

  function newCode() {
    let code;
    do {
      code = Array.from({ length: 5 }, () => CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)]).join('');
    } while (rooms.has(code));
    return code;
  }

  function socketsOf(code) {
    const ids = io.sockets.adapter.rooms.get(code) || new Set();
    return [...ids].map((id) => io.sockets.sockets.get(id)).filter(Boolean);
  }

  function broadcast(room) {
    room.lastActive = Date.now();
    room.dirty = true; // für die nächste regelmäßige Sicherung vormerken
    for (const s of socketsOf(room.game.code)) {
      s.emit('state', room.game.publicState(s.data.playerId));
    }
    scheduleBots(room);
  }

  // Ist ein Computergegner dran (oder muss ein Angebot beantworten), nach kurzer Pause einen Schritt spielen.
  // Jeder Schritt sendet den neuen Zustand, und broadcast plant von dort den nächsten.
  function scheduleBots(room) {
    if (room.botTimer || !bots.botPending(room.game)) return;
    room.botStats = room.botStats || new bots.BotStats();
    room.botTimer = setTimeout(() => {
      room.botTimer = null;
      if (!rooms.has(room.game.code) || !bots.botPending(room.game)) return;
      try {
        bots.step(room.game, room.botStats);
      } catch (err) {
        console.error(`Computergegner in Raum ${room.game.code}:`, err);
        return;
      }
      broadcast(room);
    }, botDelayMs);
  }

  // Socket aus dem Raum lösen, ohne den Spieler als getrennt zu markieren.
  function release(socket, reason, message) {
    socket.emit('kicked', { reason, message });
    if (socket.data.code) socket.leave(socket.data.code);
    socket.data.code = null;
    socket.data.playerId = null;
  }

  function enterRoom(socket, room, playerId) {
    // Pro Spieler nur eine aktive Verbindung (z. B. zweiter Tab)
    for (const other of socketsOf(room.game.code)) {
      if (other !== socket && other.data.playerId === playerId) {
        release(other, 'tab', 'In einem anderen Tab geöffnet.');
        other.disconnect(true);
      }
    }
    socket.data.code = room.game.code;
    socket.data.playerId = playerId;
    socket.join(room.game.code);
    room.game.setConnected(playerId, true);
    broadcast(room);
  }

  // Ein Spieler gilt erst als getrennt, wenn keiner seiner Tabs mehr verbunden ist.
  function handleDisconnect(room, playerId) {
    if (!playerId) return;
    const stillConnected = socketsOf(room.game.code).some((s) => s.data.playerId === playerId);
    if (!stillConnected) room.game.setConnected(playerId, false);
    broadcast(room);
  }

  // ---------- Wiederherstellung nach Neustart ----------

  const restoring = new Map(); // Raumcode → laufender Wiederherstellungsversuch

  /**
   * Raum aus der Sicherung holen. Bei einem Deploy kann der neue Server vor dem alten
   * laufen; die Sicherung entsteht dann erst, wenn der alte beendet wird. Deshalb wird
   * bis zu waitMs nachgesehen.
   */
  function restoreRoom(code, waitMs) {
    if (!/^[A-Z0-9]{5}$/.test(code)) return Promise.resolve(null);
    if (rooms.has(code)) return Promise.resolve(rooms.get(code));
    if (restoring.has(code)) return restoring.get(code);
    const attempt = (async () => {
      const until = Date.now() + waitMs;
      for (;;) {
        let snap = null;
        try {
          snap = await store.loadRoom(code);
        } catch (err) {
          console.error('Raumsicherung nicht lesbar:', err.message);
        }
        if (snap && Date.now() - Date.parse(snap.savedAt) <= SNAPSHOT_MAX_AGE_MS) {
          if (rooms.has(code)) return rooms.get(code);
          const game = Game.restore(snap.game);
          if (!game) return null;
          const room = registerRoom(game, new Map(snap.tokens));
          console.log(`Raum ${code} nach Neustart wiederhergestellt (${game.phase})`);
          store.deleteRoom(code).catch((err) => console.error('Raumsicherung nicht gelöscht:', err.message));
          return room;
        }
        if (Date.now() + restorePollMs > until) return null;
        await delay(restorePollMs);
      }
    })().finally(() => restoring.delete(code));
    restoring.set(code, attempt);
    return attempt;
  }

  /** Sicherungen, die niemand mehr abgeholt hat, beim Start entfernen. */
  const cleanupReady = (async () => {
    if (!store.persistent) return;
    try {
      for (const code of await store.listRooms()) {
        const snap = await store.loadRoom(code);
        if (snap && Date.now() - Date.parse(snap.savedAt) > SNAPSHOT_MAX_AGE_MS) {
          await store.deleteRoom(code);
          console.log(`Veraltete Raumsicherung ${code} entfernt`);
        }
      }
    } catch (err) {
      console.error('Aufräumen der Raumsicherungen fehlgeschlagen:', err.message);
    }
  })();

  function roomSnapshot(room) {
    const game = room.game.snapshot();
    return { version: 1, code: room.game.code, savedAt: game.savedAt, game, tokens: [...room.tokens] };
  }

  /** Beim Herunterfahren: aktive Räume sichern und alle Spieler informieren. */
  async function shutdown() {
    const active = [...rooms.values()].filter((r) => r.game.players.length > 0);
    let saved = 0;
    if (store.persistent && active.length) {
      const saves = active.map((r) => store
        .saveRoom(r.game.code, roomSnapshot(r))
        .then(() => saved++)
        .catch((err) => console.error(`Raum ${r.game.code} nicht gesichert:`, err.message)));
      await Promise.race([Promise.all(saves), delay(SHUTDOWN_SAVE_TIMEOUT_MS)]);
      console.log(`${saved} von ${active.length} Räumen vor dem Neustart gesichert`);
    }
    io.emit('serverInfo', {
      message: saved > 0
        ? 'Der Server wird aktualisiert – ihr werdet gleich automatisch wieder verbunden.'
        : 'Der Server wird neu gestartet – laufende Spiele gehen verloren.',
    });
    return saved;
  }

  // ---------- Socket-Ereignisse ----------

  io.on('connection', (socket) => {
    socket.on('createRoom', ({ name, token } = {}, ack = () => {}) => {
      if (!validToken(token)) return ack({ error: 'Ungültige Sitzung.' });
      const room = registerRoom(new Game(newCode()));
      const playerId = crypto.randomBytes(6).toString('hex');
      try {
        room.game.addPlayer(playerId, name);
      } catch (err) {
        rooms.delete(room.game.code);
        return ack({ error: err.message });
      }
      room.tokens.set(hashToken(token), playerId);
      ack({ code: room.game.code });
      enterRoom(socket, room, playerId);
    });

    socket.on('joinRoom', async ({ code, name, token } = {}, ack = () => {}) => {
      if (!validToken(token)) return ack({ error: 'Ungültige Sitzung.' });
      const normalized = String(code || '').trim().toUpperCase();
      const room = rooms.get(normalized) || await restoreRoom(normalized, store.persistent ? restoreWaitMs : 0);
      if (!room) return ack({ error: 'Raum nicht gefunden.' });
      const hash = hashToken(token);
      let playerId = room.tokens.get(hash);
      if (!playerId) {
        playerId = crypto.randomBytes(6).toString('hex');
        try {
          room.game.addPlayer(playerId, name);
        } catch (err) {
          return ack({ error: err.message });
        }
        room.tokens.set(hash, playerId);
      }
      ack({ code: room.game.code });
      enterRoom(socket, room, playerId);
    });

    socket.on('leaveRoom', () => {
      const room = rooms.get(socket.data.code);
      if (!room) return;
      const playerId = socket.data.playerId;
      socket.leave(room.game.code);
      socket.data.code = null;
      socket.data.playerId = null;
      if (room.game.phase === 'lobby') {
        room.game.removePlayer(playerId);
        for (const [hash, id] of room.tokens) if (id === playerId) room.tokens.delete(hash);
      }
      handleDisconnect(room, playerId);
    });

    socket.on('kick', ({ playerId } = {}, ack = () => {}) => {
      const room = rooms.get(socket.data.code);
      if (!room) return ack({ error: 'Nicht in einem Raum.' });
      try {
        room.game.kick(socket.data.playerId, { playerId });
      } catch (err) {
        if (err instanceof GameError) return ack({ error: err.message });
        console.error(err);
        return ack({ error: 'Interner Fehler.' });
      }
      for (const [hash, id] of room.tokens) if (id === playerId) room.tokens.delete(hash);
      for (const other of socketsOf(room.game.code)) {
        if (other.data.playerId === playerId) release(other, 'kick', 'Du wurdest vom Gastgeber aus dem Raum entfernt.');
      }
      ack({ ok: true });
      broadcast(room);
    });

    socket.on('action', ({ type, payload } = {}, ack = () => {}) => {
      const room = rooms.get(socket.data.code);
      if (!room) return ack({ error: 'Nicht in einem Raum.' });
      if (!ACTIONS.has(type)) return ack({ error: 'Unbekannte Aktion.' });
      try {
        room.game[type](socket.data.playerId, payload || {});
      } catch (err) {
        if (err instanceof GameError) return ack({ error: err.message });
        console.error(err);
        return ack({ error: 'Interner Fehler.' });
      }
      ack({ ok: true });
      broadcast(room);
    });

    socket.on('disconnect', () => {
      const room = rooms.get(socket.data.code);
      if (room) handleDisconnect(room, socket.data.playerId);
    });
  });

  const sweep = setInterval(() => {
    const now = Date.now();
    for (const [code, room] of rooms) {
      if (socketsOf(code).length === 0 && now - room.lastActive > ROOM_IDLE_MS) {
        room.game.destroy();
        clearTimeout(room.botTimer);
        rooms.delete(code);
        // Verlassene Räume nicht nach einem späteren Neustart wieder auferstehen lassen
        if (room.backedUp) store.deleteRoom(code).catch((err) => console.error('Raumsicherung nicht gelöscht:', err.message));
      }
    }
  }, 5 * 60 * 1000);
  sweep.unref();

  // Regelmäßige Sicherung: nur Räume mit Spielern, die sich seit der letzten Sicherung geändert haben.
  async function backupRooms() {
    if (!store.persistent) return 0;
    let saved = 0;
    for (const room of rooms.values()) {
      if (!room.dirty || room.saving || room.game.players.length === 0) continue;
      room.saving = true;
      room.dirty = false;
      try {
        await store.saveRoom(room.game.code, roomSnapshot(room));
        room.backedUp = true;
        saved++;
      } catch (err) {
        room.dirty = true; // beim nächsten Mal erneut versuchen
        console.error(`Raum ${room.game.code} nicht gesichert:`, err.message);
      } finally {
        room.saving = false;
      }
    }
    return saved;
  }
  const backup = setInterval(() => { backupRooms(); }, backupIntervalMs);
  backup.unref();

  function close() {
    clearInterval(sweep);
    clearInterval(backup);
    for (const room of rooms.values()) {
      room.game.destroy();
      clearTimeout(room.botTimer);
    }
    io.close();
    return new Promise((resolve) => server.close(() => resolve()));
  }

  return { server, io, rooms, stats, statsReady, cleanupReady, shutdown, backupRooms, close };
}

if (require.main === module) {
  const port = Number(process.env.PORT) || 3000;
  const { server, shutdown } = createServer();
  server.listen(port, () => {
    console.log(`Archipel läuft auf Port ${port}`);
  });
  // Hoster wie Render senden bei Deploys/Neustarts SIGTERM: Räume sichern, Spieler informieren.
  // Die Browser verbinden sich danach automatisch neu, der nächste Server stellt die Räume wieder her.
  let stopping = false;
  process.on('SIGTERM', async () => {
    if (stopping) return;
    stopping = true;
    setTimeout(() => process.exit(0), SHUTDOWN_SAVE_TIMEOUT_MS + 3000).unref();
    await shutdown();
    // Kurz warten, damit die Hinweise noch ankommen; die Verbindungen brechen dann ab und
    // die Clients verbinden sich selbstständig neu (bei io.close() würden sie das nicht tun).
    setTimeout(() => process.exit(0), 500);
  });
}

module.exports = { createServer, hashToken };
