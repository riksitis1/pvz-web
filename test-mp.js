const WebSocket = require('ws');
const http = require('http');

function get(path) {
  return new Promise((res, rej) => {
    http.get({ host: 'localhost', port: 3100, path }, r => {
      let d = ''; r.on('data', c => d += c); r.on('end', () => res(d));
    }).on('error', rej);
  });
}

async function main() {
  const html = await get('/');
  console.log('index.html:', html.length > 1000 ? 'OK (' + html.length + ' bytes)' : 'FAIL');
  for (const f of ['js/sprites.js', 'js/audio.js', 'js/levels.js', 'js/game.js', 'js/net.js']) {
    const c = await get('/' + f);
    console.log(f + ':', c.length > 100 ? 'OK' : 'FAIL');
  }

  const log = [];
  function mkClient(name) {
    const ws = new WebSocket('ws://localhost:3100');
    ws.meta = { name };
    ws.on('message', raw => {
      const m = JSON.parse(raw);
      log.push(name + ' <- ' + m.t + (m.code ? '(' + m.code + ')' : ''));
      ws.meta['on_' + m.t] && ws.meta['on_' + m.t](m);
    });
    return ws;
  }
  const send = (ws, obj) => ws.send(JSON.stringify(obj));

  const host = mkClient('host');
  await new Promise(r => host.on('open', r));
  send(host, { t: 'host' });
  await new Promise(r => { host.meta.on_hosted = r; });
  const code = host.meta.code || log.join(',').match(/\(([A-Z0-9]{4})\)/)[1];
  console.log('hosted room:', code);

  const guest = mkClient('guest');
  await new Promise(r => guest.on('open', r));
  send(guest, { t: 'join', code });
  await new Promise(r => { guest.meta.on_joined = r; host.meta.on_peerJoined = r; });
  console.log('guest joined OK');

  send(host, { t: 'setLevel', level: '1-1' });
  send(host, { t: 'setPlantRole', role: 'host' });
  send(host, { t: 'start', level: '1-1' });
  await new Promise(r => { guest.meta.on_start = r; });
  console.log('match started OK');

  send(guest, { t: 'spawnReq', z: 'basic', row: 2, col: 8 });
  await new Promise(r => { host.meta.on_spawnReq = r; });
  console.log('spawn request relayed OK');

  send(host, { t: 'state', s: { sun: 75, brains: 125, zombies: [], plants: [], peas: [], mowers: [], over: false } });
  await new Promise(r => { guest.meta.on_state = r; });
  console.log('state relay OK');

  send(guest, { t: 'chat', text: 'gl hf' });
  await new Promise(r => { host.meta.on_chat = r; });
  console.log('chat relay OK');

  send(host, { t: 'end', winner: 'plant', stats: { zombiesKilled: 5 } });
  await new Promise(r => { guest.meta.on_end = r; });
  console.log('end relay OK');

  host.close(); guest.close();
  console.log('ALL MP TESTS PASSED');
  process.exit(0);
}
main().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
