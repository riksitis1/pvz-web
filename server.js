const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 3000;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json' };

const server = http.createServer((req, res) => {
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';
  const file = path.join(__dirname, path.normalize(urlPath));
  if (!file.startsWith(__dirname)) { res.writeHead(403); res.end(); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
});

const wss = new WebSocketServer({ server });
const rooms = new Map();

function makeCode() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let c;
  do { c = ''; for (let i = 0; i < 4; i++) c += chars[Math.floor(Math.random() * chars.length)]; } while (rooms.has(c));
  return c;
}

function send(ws, obj) {
  if (ws.readyState === 1) ws.send(JSON.stringify(obj));
}

function broadcast(room, obj, except) {
  for (const p of room.players) if (p.ws !== except) send(p.ws, obj);
}

wss.on('connection', (ws) => {
  ws.meta = { room: null, role: null, name: 'Player' };

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    const m = ws.meta;

    if (msg.t === 'host') {
      const code = makeCode();
      const room = { code, host: ws, players: [], state: 'lobby', level: '1-1', plantRole: 'host', chat: [] };
      room.players.push({ ws, role: 'host' });
      rooms.set(code, room);
      m.room = code; m.role = 'host';
      send(ws, { t: 'hosted', code });
    }

    if (msg.t === 'join') {
      const room = rooms.get((msg.code || '').toUpperCase());
      if (!room) { send(ws, { t: 'error', msg: 'Room not found' }); return; }
      if (room.players.length >= 2) { send(ws, { t: 'error', msg: 'Room is full' }); return; }
      if (room.state !== 'lobby') { send(ws, { t: 'error', msg: 'Match already started' }); return; }
      room.players.push({ ws, role: 'guest' });
      m.room = room.code; m.role = 'guest';
      send(ws, { t: 'joined', code: room.code, level: room.level, plantRole: room.plantRole });
      send(room.host, { t: 'peerJoined', name: msg.name || 'Guest' });
    }

    if (msg.t === 'setName') {
      ws.meta.name = String(msg.name || 'Player').slice(0, 16);
      const room = rooms.get(m.room);
      if (room) broadcast(room, { t: 'chat', from: 'SYSTEM', text: `${ws.meta.name} is ready` });
    }

    if (msg.t === 'setLevel') {
      const room = rooms.get(m.room);
      if (room && m.role === 'host' && room.state === 'lobby') {
        room.level = String(msg.level);
        broadcast(room, { t: 'level', level: room.level });
      }
    }

    if (msg.t === 'setPlantRole') {
      const room = rooms.get(m.room);
      if (room && m.role === 'host' && room.state === 'lobby') {
        room.plantRole = msg.role === 'guest' ? 'guest' : 'host';
        broadcast(room, { t: 'plantRole', role: room.plantRole });
      }
    }

    if (msg.t === 'start') {
      const room = rooms.get(m.room);
      if (room && m.role === 'host' && room.state === 'lobby') {
        room.state = 'playing';
        broadcast(room, { t: 'start', level: room.level, plantRole: room.plantRole, seed: msg.seed || 1 });
      }
    }

    if (msg.t === 'state') {
      const room = rooms.get(m.room);
      if (room && room.state === 'playing') {
        for (const p of room.players) if (p.ws !== ws) send(p.ws, { t: 'state', s: msg.s });
      }
    }

    if (msg.t === 'spawnReq') {
      const room = rooms.get(m.room);
      if (room && room.state === 'playing') {
        for (const p of room.players) if (p.ws !== ws) send(p.ws, { t: 'spawnReq', z: msg.z, row: msg.row, col: msg.col });
      }
    }

    if (msg.t === 'chat') {
      const room = rooms.get(m.room);
      if (room) {
        const entry = { from: ws.meta.name, text: String(msg.text).slice(0, 120) };
        room.chat.push(entry);
        if (room.chat.length > 50) room.chat.shift();
        broadcast(room, { t: 'chat', from: entry.from, text: entry.text });
      }
    }

    if (msg.t === 'end') {
      const room = rooms.get(m.room);
      if (room && room.state === 'playing') {
        room.state = 'over';
        broadcast(room, { t: 'end', winner: msg.winner, stats: msg.stats });
      }
    }

    if (msg.t === 'rematch') {
      const room = rooms.get(m.room);
      if (room && m.role === 'host') {
        room.state = 'lobby';
        broadcast(room, { t: 'rematch' });
      }
    }
  });

  ws.on('close', () => {
    const room = rooms.get(ws.meta.room);
    if (room) {
      room.players = room.players.filter(p => p.ws !== ws);
      if (room.players.length === 0) { rooms.delete(room.code); return; }
      if (room.host === ws) {
        broadcast(room, { t: 'error', msg: 'Host disconnected' });
        rooms.delete(room.code);
      } else {
        room.state = 'lobby';
        send(room.host, { t: 'peerLeft' });
      }
    }
  });
});

server.listen(PORT, () => console.log(`PvZ server running at http://localhost:${PORT}`));
