const Net = (() => {
  let ws = null;
  const $ = id => document.getElementById(id);
  let stateCb = null;

  function getServerUrl() {
    const saved = localStorage.getItem('pvz_server_url');
    if (saved) return saved;
    if (location.protocol === 'file:' || !location.host) return '';
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    return `${proto}://${location.host}`;
  }

  function connect() {
    return new Promise((resolve, reject) => {
      const url = getServerUrl();
      if (!url) { reject(new Error('No server URL configured')); return; }
      ws = new WebSocket(url);
      ws.onopen = () => resolve(ws);
      ws.onerror = () => reject(new Error('Connection failed'));
      ws.onmessage = e => {
        let msg;
        try { msg = JSON.parse(e.data); } catch { return; }
        handle(msg);
      };
      ws.onclose = () => {
        if (window.Game && Game.G.mp) {
          Game.G.mp.connected = false;
          if (Game.G.scene === 'play' || Game.G.scene === 'lobby') {
            alert('Disconnected from server');
            Game.quitToMenu();
          }
        }
      };
    });
  }

  function handle(msg) {
    const G = window.Game.G;
    switch (msg.t) {
      case 'hosted':
        G.mp = { ws, role: 'host', code: msg.code, connected: true, brains: 150, spawnCd: 0, selectedZombie: null, over: false };
        $('lobbyHost').classList.add('hidden');
        $('lobbyRoom').classList.remove('hidden');
        $('roomCode').textContent = msg.code;
        $('lobbyStatus').textContent = 'Waiting for opponent...';
        $('lobbyControls').classList.add('hidden');
        break;
      case 'joined':
        G.mp = { ws, role: 'guest', code: msg.code, connected: true, brains: 150, spawnCd: 0, selectedZombie: null, over: false };
        $('lobbyHost').classList.add('hidden');
        $('lobbyRoom').classList.remove('hidden');
        $('roomCode').textContent = msg.code;
        $('lobbyStatus').textContent = 'Connected! Waiting for host to start...';
        $('lobbyControls').classList.add('hidden');
        break;
      case 'peerJoined':
        if (G.mp && G.mp.role === 'host') {
          $('lobbyStatus').textContent = 'Opponent connected!';
          $('lobbyControls').classList.remove('hidden');
          const sel = $('mpLevel');
          sel.innerHTML = '';
          for (const id of Object.keys(LEVELS)) {
            const o = document.createElement('option');
            o.value = id; o.textContent = 'Level ' + id;
            sel.appendChild(o);
          }
          addChat('SYSTEM', 'Opponent joined! Choose level and roles, then start.');
        }
        break;
      case 'level':
        if (G.mp) $('mpLevel').value = msg.level;
        break;
      case 'plantRole':
        if (G.mp) $('mpRole').value = msg.role;
        break;
      case 'start': {
        const isPlant = (msg.plantRole === 'host') === (G.mp.role === 'host');
        G.mp.role = isPlant ? 'plant' : 'zombie';
        G.mp.brains = 150;
        G.mp.spawnCd = 0;
        G.mp.over = false;
        Game.startLevel(msg.level);
        if (G.mp.role === 'zombie') {
          buildZombieBar();
          addChat('SYSTEM', 'You are the ZOMBIES. Spend brains to spawn zombies!');
        } else {
          addChat('SYSTEM', 'You are the PLANTS. Defend your lawn!');
        }
        break;
      }
      case 'state':
        if (G.mp && G.mp.role === 'zombie') applyState(msg.s);
        break;
      case 'spawnReq':
        if (G.mp && G.mp.role === 'plant') {
          const def = ZOMBIE_DEFS[msg.z];
          if (!def) break;
          if (G.mp.brains < def.brain) { send({ t: 'chat', text: '⚠ Not enough brains for ' + def.name }); break; }
          if (G.mp.spawnCd > 0) { send({ t: 'chat', text: '⚠ Spawn cooldown...' }); break; }
          G.mp.brains -= def.brain;
          G.mp.spawnCd = 1.5;
          G.stats.brainsSpent += def.brain;
          const z = Game.spawnZombie(msg.z, msg.row, 40 + msg.col * 80 + 40);
          z._id = 'z' + Math.random().toString(36).slice(2);
          Game.G.zombies.forEach(zz => { if (!zz._id) zz._id = 'z' + Math.random().toString(36).slice(2); });
          Game.Audio2.sfx('groan');
        }
        break;
      case 'chat':
        addChat(msg.from, msg.text);
        break;
      case 'end':
        if (G.mp && !G.mp.over) {
          G.mp.over = true;
          showMpEnd(msg.winner, msg.stats);
        }
        break;
      case 'rematch':
        if (G.mp) {
          G.mp.over = false;
          Game.showOverlay('lobby');
          G.scene = 'lobby';
          $('lobbyStatus').textContent = 'Waiting for host to start...';
          $('lobbyControls').classList.remove('hidden');
        }
        break;
      case 'peerLeft':
        if (G.mp) {
          alert('Opponent left the game');
          Game.quitToMenu();
        }
        break;
      case 'error':
        if (msg.msg) alert(msg.msg);
        break;
    }
  }

  function send(obj) {
    if (ws && ws.readyState === 1) ws.send(JSON.stringify(obj));
  }

  function applyState(s) {
    const G = window.Game.G;
    G.sun = s.sun;
    if (G.mp) G.mp.brains = s.brains;
    const byId = {};
    for (const z of G.zombies) byId[z._id] = z;
    const newZ = [];
    for (const zs of s.zombies) {
      let z = byId[zs.id];
      if (!z) {
        z = { type: zs.type, row: zs.row, x: zs.x, y: 100 + zs.row * 92 + 84, t: Math.random() * 10, state: 'walk', slowT: 0, freezeT: 0, hitT: 0, eatT: 0, dir: -1, speed: ZOMBIE_DEFS[zs.type].speed, hp: zs.hp, maxHp: ZOMBIE_DEFS[zs.type].hp, armor: zs.armor * (ZOMBIE_DEFS[zs.type].hp >= 1000 ? 1100 : 360), armorMax: 1, dead: false, _id: zs.id, fallT: -1, vaultT: -1, jumpT: -1, swim: false, underground: false, eatAnim: 0, hypno: false, fuse: -1, threwImp: false, fled: false, summonT: -1, digT: 0 };
        z.armor = zs.armor;
      }
      z.x = zs.x;
      z.hp = zs.hp;
      z.armor = zs.armor;
      z.slowT = zs.slow ? 1 : 0;
      z.freezeT = zs.freeze ? 1 : 0;
      z.state = zs.eat ? 'eat' : 'walk';
      z.eatAnim = zs.eat ? 1 : 0;
      z.hypno = zs.hypno;
      z.dead = false;
      newZ.push(z);
    }
    G.zombies = newZ;
    G.plants = s.plants.map(p => ({ type: p.type, row: p.row, col: p.col, x: 40 + p.col * 80 + 40, y: 100 + p.row * 92 + 84, hp: p.hp, maxHp: p.max, t: 0, attackT: 0, dead: false, spawnT: 0, asleep: false, big: 1, armed: 1, chewing: 0, jumpT: -1, lifeT: -1, sunT: 5, magnetT: 0, coinT: 20, fuse: -1, hide: false, attack: 0, eatAnim: 0 }));
    G.mowers = s.mowers.map(m => ({ row: m.row, x: m.x, state: m.state }));
    G.projectiles = s.peas.map(p => ({ kind: p.kind, row: p.row, x: p.x, y: p.y, vx: 220, vy: 0, dmg: 20, t: 0, splash: 0, slow: 0, arc: 0, dead: false }));
    if (s.over && G.mp && !G.mp.over) {
      G.mp.over = true;
      showMpEnd(G.gameOver ? 'zombie' : 'plant', G.stats);
    }
  }

  function showMpEnd(winner, stats) {
    const G = window.Game.G;
    const iWon = (winner === 'plant') === (G.mp.role === 'plant');
    $('mpendTitle').textContent = iWon ? 'VICTORY!' : 'DEFEAT';
    $('mpendTitle').style.color = iWon ? '#ffeb3b' : '#ef5350';
    const st = stats || G.stats;
    $('mpendStats').innerHTML = `
      <div class="stat"><span>Zombies killed:</span><span>${st.zombiesKilled || 0}</span></div>
      <div class="stat"><span>Plants eaten:</span><span>${st.plantsEaten || 0}</span></div>
      <div class="stat"><span>Sun collected:</span><span>${st.sunCollected || 0}</span></div>
      <div class="stat"><span>Brains spent:</span><span>${st.brainsSpent || 0}</span></div>`;
    G.scene = 'mpend';
    Game.showOverlay('mpend');
    Game.Audio2.stopMusic();
    Game.Audio2.sfx(iWon ? 'win' : 'lose');
  }

  function buildZombieBar() {
    const G = window.Game.G;
    const cards = $('zcards');
    cards.innerHTML = '';
    for (const zid of MP_ZOMBIES) {
      const def = ZOMBIE_DEFS[zid];
      const d = document.createElement('div');
      d.className = 'zcard';
      d.dataset.zid = zid;
      const cv = document.createElement('canvas');
      cv.width = 40; cv.height = 40;
      const c = cv.getContext('2d');
      c.translate(20, 38); c.scale(0.45, 0.45);
      Sprites.drawZombie(zid, c, 0, 0, 1, {});
      d.appendChild(cv);
      const nm = document.createElement('div');
      nm.textContent = def.name.replace(' Zombie', '');
      d.appendChild(nm);
      const cost = document.createElement('div');
      cost.className = 'cost';
      cost.textContent = '🧠' + def.brain;
      d.appendChild(cost);
      d.onclick = () => {
        if (G.mp.selectedZombie === zid) { G.mp.selectedZombie = null; d.classList.remove('sel'); }
        else {
          G.mp.selectedZombie = zid;
          cards.querySelectorAll('.zcard').forEach(x => x.classList.remove('sel'));
          d.classList.add('sel');
        }
        Game.Audio2.sfx('click');
      };
      cards.appendChild(d);
    }
  }

  function addChat(from, text) {
    const log = $('chatlog');
    const d = document.createElement('div');
    d.innerHTML = `<b style="color:#aed581">${from}:</b> ${text.replace(/</g, '&lt;')}`;
    log.appendChild(d);
    log.scrollTop = log.scrollHeight;
  }

  async function openLobby() {
    const G = window.Game.G;
    G.scene = 'lobby';
    Game.showOverlay('lobby');
    $('lobbyHost').classList.remove('hidden');
    $('lobbyRoom').classList.add('hidden');
    if (!getServerUrl()) {
      alert('Set a multiplayer server URL first (e.g. wss://your-app.onrender.com)');
    }
    if (!ws || ws.readyState !== 1) {
      try { await connect(); } catch (e) { alert('Could not connect to the multiplayer server. Check the URL.'); Game.quitToMenu(); return; }
    }
    if (G.mp) G.mp.ws = ws;
  }

  $('btnSaveUrl').onclick = () => {
    const v = $('serverUrl').value.trim();
    if (v) localStorage.setItem('pvz_server_url', v);
    else localStorage.removeItem('pvz_server_url');
    Game.Audio2.sfx('click');
    alert(v ? 'Server URL saved: ' + v : 'Server URL cleared (using same-origin)');
  };
  $('btnHost').onclick = async () => {
    Game.Audio2.sfx('click');
    if (!ws || ws.readyState !== 1) { try { await connect(); } catch { alert('Connection failed'); return; } }
    send({ t: 'host' });
  };
  $('btnJoin').onclick = async () => {
    Game.Audio2.sfx('click');
    const code = $('joinCode').value.trim().toUpperCase();
    if (code.length !== 4) { alert('Enter the 4-letter room code'); return; }
    if (!ws || ws.readyState !== 1) { try { await connect(); } catch { alert('Connection failed'); return; } }
    send({ t: 'join', code, name: 'Player' });
  };
  $('btnStartMp').onclick = () => {
    Game.Audio2.sfx('click');
    send({ t: 'setLevel', level: $('mpLevel').value });
    send({ t: 'setPlantRole', role: $('mpRole').value });
    send({ t: 'start', level: $('mpLevel').value });
  };
  $('btnLeaveLobby').onclick = () => {
    Game.Audio2.sfx('click');
    disconnect();
    Game.quitToMenu();
  };
  $('chatinput').addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      const v = e.target.value.trim();
      if (v) send({ t: 'chat', text: v });
      e.target.value = '';
    }
  });

  // brains regen + cooldown tick
  setInterval(() => {
    const G = window.Game.G;
    if (!G.mp || !G.mp.connected || G.scene !== 'play') return;
    if (G.mp.role === 'zombie') {
      const eating = G.zombies.some(z => z.state === 'eat');
      G.mp.brains = Math.min(500, G.mp.brains + (eating ? 2 : 1));
      if (G.mp.spawnCd > 0) G.mp.spawnCd -= 0.5;
      $('braincount').textContent = '🧠 ' + Math.floor(G.mp.brains);
      document.querySelectorAll('.zcard').forEach(d => {
        d.classList.toggle('cant', G.mp.brains < ZOMBIE_DEFS[d.dataset.zid].brain || G.mp.spawnCd > 0);
      });
    } else {
      if (G.mp.spawnCd > 0) G.mp.spawnCd -= 0.5;
    }
  }, 500);

  return {
    openLobby, send, disconnect() { if (ws) { ws.close(); ws = null; } },
    requestSpawn(z, row, col) { send({ t: 'spawnReq', z, row, col }); },
    rematch() { send({ t: 'rematch' }); },
    get ws() { return ws; },
  };
})();
