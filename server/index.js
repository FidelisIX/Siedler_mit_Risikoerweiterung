'use strict';

const crypto = require('crypto');
const http = require('http');
const path = require('path');
const express = require('express');
const { Server } = require('socket.io');
const { Game, GameError } = require('./game');

const PORT = process.env.PORT || 3000;
const ROOM_IDLE_MS = 30 * 60 * 1000;
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const ACTIONS = new Set([
  'setRounds', 'start', 'placeStart', 'roll', 'build',
  'bankTrade', 'proposeTrade', 'respondTrade', 'cancelTrade', 'endTurn', 'forceSkip',
]);

const app = express();
app.use(express.static(path.join(__dirname, '..', 'public')));
app.get('/healthz', (req, res) => res.send('ok'));

const server = http.createServer(app);
const io = new Server(server);

// code -> { game, tokens: Map<token, playerId>, lastActive }
const rooms = new Map();

function newCode() {
  let code;
  do {
    code = Array.from({ length: 5 }, () => CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)]).join('');
  } while (rooms.has(code));
  return code;
}

function validToken(token) {
  return typeof token === 'string' && token.length >= 10 && token.length <= 100;
}

function socketsOf(code) {
  const ids = io.sockets.adapter.rooms.get(code) || new Set();
  return [...ids].map((id) => io.sockets.sockets.get(id)).filter(Boolean);
}

function broadcast(room) {
  room.lastActive = Date.now();
  for (const s of socketsOf(room.game.code)) {
    s.emit('state', room.game.publicState(s.data.playerId));
  }
}

function enterRoom(socket, room, playerId) {
  socket.data.code = room.game.code;
  socket.data.playerId = playerId;
  socket.join(room.game.code);
  room.game.setConnected(playerId, true);
  broadcast(room);
}

io.on('connection', (socket) => {
  socket.on('createRoom', ({ name, token } = {}, ack = () => {}) => {
    if (!validToken(token)) return ack({ error: 'Ungültige Sitzung.' });
    const code = newCode();
    const room = { game: new Game(code), tokens: new Map(), lastActive: Date.now() };
    const playerId = crypto.randomBytes(6).toString('hex');
    try {
      room.game.addPlayer(playerId, name);
    } catch (err) {
      return ack({ error: err.message });
    }
    room.tokens.set(token, playerId);
    rooms.set(code, room);
    ack({ code });
    enterRoom(socket, room, playerId);
  });

  socket.on('joinRoom', ({ code, name, token } = {}, ack = () => {}) => {
    if (!validToken(token)) return ack({ error: 'Ungültige Sitzung.' });
    const room = rooms.get(String(code || '').trim().toUpperCase());
    if (!room) return ack({ error: 'Raum nicht gefunden.' });
    let playerId = room.tokens.get(token);
    if (!playerId) {
      playerId = crypto.randomBytes(6).toString('hex');
      try {
        room.game.addPlayer(playerId, name);
      } catch (err) {
        return ack({ error: err.message });
      }
      room.tokens.set(token, playerId);
    }
    ack({ code: room.game.code });
    enterRoom(socket, room, playerId);
  });

  socket.on('leaveRoom', () => {
    const room = rooms.get(socket.data.code);
    if (!room) return;
    socket.leave(room.game.code);
    if (room.game.phase === 'lobby') {
      room.game.removePlayer(socket.data.playerId);
      for (const [token, id] of room.tokens) if (id === socket.data.playerId) room.tokens.delete(token);
    }
    handleDisconnect(room, socket.data.playerId);
    socket.data.code = null;
    socket.data.playerId = null;
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

// Ein Spieler gilt erst als getrennt, wenn keiner seiner Tabs mehr verbunden ist.
function handleDisconnect(room, playerId) {
  const stillConnected = socketsOf(room.game.code).some((s) => s.data.playerId === playerId);
  if (!stillConnected) room.game.setConnected(playerId, false);
  broadcast(room);
}

setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms) {
    if (socketsOf(code).length === 0 && now - room.lastActive > ROOM_IDLE_MS) rooms.delete(code);
  }
}, 5 * 60 * 1000).unref();

server.listen(PORT, () => {
  console.log(`Archipel läuft auf Port ${PORT}`);
});
