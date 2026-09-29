(() => {
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const { poly, circ, ell, rr } = Sprites;
const W = 800, H = 600;
const ROWS = 5, COLS = 9, TILE_W = 80, TILE_H = 92;
const LAWN_X = 40, LAWN_Y = 100;
const HOUSE_X = 30;

function fitCanvas() {
  const s = Math.min(window.innerWidth / W, window.innerHeight / H);
  canvas.style.width = (W * s) + 'px';
  canvas.style.height = (H * s) + 'px';
}
window.addEventListener('resize', fitCanvas);
fitCanvas();

const SAVE_KEY = 'pvzweb_save_v1';
let save = { completed: {}, coins: 0, zen: [null, null, null], options: { music: 60, sfx: 80, mute: false } };
try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); if (s) save = Object.assign(save, s); } catch (e) {}
function persist() { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); }

const MUSHROOMS = ['puffshroom', 'sunshroom', 'scaredyshroom', 'seashroom', 'fumeshroom'];
const UPGRADE_BASE = { gatlingpea: 'repeater', twinsunflower: 'sunflower', wintermelon: 'melonpult', goldmagnet: 'magnetshroom' };

const G = {
  scene: 'menu', level: null, levelId: null, levelTime: 0,
  sun: 50, plants: [], zombies: [], projectiles: [], suns: [], mowers: [], particles: [], items: [],
  packets: [], cooldowns: {}, selectedPacket: null, shovelMode: false, imitaterPicker: false,
  spawnQueue: [], totalToSpawn: 0, spawnedCount: 0, killedCount: 0,
  skySunT: 8, shake: 0, banner: null, bannerT: 0, levelCardT: 0,
  paused: false, gameOver: false, levelComplete: false, reward: null,
  mouse: { x: 0, y: 0 }, stats: { sunCollected: 0, plantsEaten: 0, zombiesKilled: 0, brainsSpent: 0 },
  mp: null, time: 0, fogRevealed: [], iceTiles: new Set(), graves: [],
};

// ---------- input ----------
function canvasPos(e) {
  const r = canvas.getBoundingClientRect();
  return { x: (e.clientX - r.left) * (W / r.width), y: (e.clientY - r.top) * (H / r.height) };
}
canvas.addEventListener('mousemove', e => { const p = canvasPos(e); G.mouse.x = p.x; G.mouse.y = p.y; });
canvas.addEventListener('contextmenu', e => { e.preventDefault(); G.selectedPacket = null; G.shovelMode = false; G.imitaterPicker = false; });
canvas.addEventListener('mousedown', e => {
  Audio2.ensure();
  const p = canvasPos(e);
  if (e.button === 2) return;
  handleClick(p.x, p.y);
});
window.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if (G.scene === 'play') togglePause();
    else if (G.imitaterPicker) G.imitaterPicker = false;
  }
  if (e.key === ' ' && G.scene === 'play' && !G.paused) { e.preventDefault(); togglePause(); }
});

function handleClick(x, y) {
  if (G.scene !== 'play' || G.paused || G.gameOver || G.levelComplete) return;
  if (G.mp && G.mp.role === 'zombie') { mpZombieClick(x, y); return; }
  for (const s of G.suns) {
    if (!s.collected && Math.hypot(s.x - x, s.y - y) < 26) { collectSun(s); return; }
  }
  for (const it of G.items) {
    if (!it.collected && Math.hypot(it.x - x, it.y - y) < 24) { it.collected = true; it.flyT = 0; Audio2.sfx('pop'); return; }
  }
  if (G.imitaterPicker) { imitaterClick(x, y); return; }
  if (y < 92) { topBarClick(x, y); return; }
  const col = Math.floor((x - LAWN_X) / TILE_W), row = Math.floor((y - LAWN_Y) / TILE_H);
  if (col < 0 || col >= COLS || row < 0 || row >= ROWS) { G.selectedPacket = null; G.shovelMode = false; return; }
  if (G.shovelMode) { useShovel(row, col); return; }
  const clickedPlant = plantAt(row, col);
  if (!G.selectedPacket && clickedPlant) {
    const food = G.items.find(i => i.collected && !i.used);
    if (food) { feedPlant(clickedPlant); return; }
  }
  if (G.selectedPacket) { tryPlant(G.selectedPacket, row, col); }
}

function topBarClick(x, y) {
  if (x > 700 && y < 40) { togglePause(); return; }
  if (x >= 176 && x <= 210 && y >= 8 && y <= 42) { G.shovelMode = !G.shovelMode; G.selectedPacket = null; Audio2.sfx('click'); return; }
  let px = 12;
  for (const pk of G.packets) {
    if (x >= px && x <= px + 56 && y >= 6 && y <= 44) {
      if (G.cooldowns[pk] > 0) { Audio2.sfx('error'); return; }
      G.selectedPacket = G.selectedPacket === pk ? null : pk;
      G.shovelMode = false;
      Audio2.sfx('click');
      return;
    }
    px += 62;
  }
}

function packetRect(pk) {
  let px = 12;
  for (const p of G.packets) { if (p === pk) return { x: px, y: 6, w: 56, h: 38 }; px += 62; }
  return null;
}

// ---------- sun ----------
function addSun(x, y, value, fromSky) {
  const s = { x, y, vy: fromSky ? 30 : 0, value, t: 0, life: 10, collected: false, flyT: 0, fromSky };
  if (fromSky && s.targetY === undefined) s.targetY = LAWN_Y + 80 + Math.random() * 380;
  G.suns.push(s);
}
function collectSun(s) {
  s.collected = true; s.flyT = 0;
  Audio2.sfx('sun');
  spawnParticles(s.x, s.y, '#ffeb3b', 6);
}
function updateSuns(dt) {
  G.skySunT -= dt;
  if (G.skySunT <= 0) {
    G.skySunT = 10;
    const x = LAWN_X + 60 + Math.random() * (COLS * TILE_W - 120);
    addSun(x, -20, 25, true);
  }
  for (const s of G.suns) {
    s.t += dt;
    if (s.collected) {
      s.flyT += dt * 2.2;
      const tx = 40, ty = 20;
      s.x += (tx - s.x) * Math.min(1, s.flyT * 2);
      s.y += (ty - s.y) * Math.min(1, s.flyT * 2);
      if (s.flyT > 0.6) { G.sun += s.value; G.stats.sunCollected += s.value; s.dead = true; }
    } else if (s.fromSky) {
      if (s.y < s.targetY) s.y += s.vy * dt;
      s.life -= dt;
      if (s.life < 2) s.blink = Math.sin(s.t * 12) > 0;
      if (s.life <= 0) s.dead = true;
    } else {
      s.life -= dt;
      if (s.life <= 0) s.dead = true;
    }
  }
  G.suns = G.suns.filter(s => !s.dead);
}

// ---------- particles ----------
function spawnParticles(x, y, color, n = 8, spd = 60) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, v = spd * (0.4 + Math.random());
    G.particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 30, t: 0, life: 0.5 + Math.random() * 0.4, color, r: 2 + Math.random() * 3 });
  }
}
function updateParticles(dt) {
  for (const p of G.particles) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 120 * dt; }
  G.particles = G.particles.filter(p => p.t < p.life);
}

// ---------- planting ----------
function tileFree(row, col) { return !G.plants.some(p => p.row === row && p.col === col); }
function plantAt(row, col) { return G.plants.find(p => p.row === row && p.col === col); }
function isWater(row) { return G.level && G.level.theme === 'pool' && (row === 2 || row === 3); }
function isRoof() { return G.level && G.level.theme === 'roof'; }

function tryPlant(type, row, col) {
  let def = PLANT_DEFS[type];
  const base = UPGRADE_BASE[type];
  if (base) {
    const b = plantAt(row, col);
    if (!b || b.type !== base) { Audio2.sfx('error'); return; }
    if (G.sun < def.cost) { Audio2.sfx('error'); return; }
    G.sun -= def.cost;
    b.type = type; b.maxHp = def.hp; b.hp = def.hp; b.t = 0; b.attackT = 0;
    Audio2.sfx('plant');
    spawnParticles(b.x, b.y - 10, '#8d6e63', 8);
    G.selectedPacket = null;
    return;
  }
  if (type === 'pumpkin') {
    const occ = plantAt(row, col);
    if (G.sun < def.cost) { Audio2.sfx('error'); return; }
    if (occ && occ.type === 'pumpkin') { Audio2.sfx('error'); return; }
    G.sun -= def.cost;
    if (occ) {
      const shell = { type: 'pumpkin', row, col, x: occ.x, y: occ.y, hp: def.hp, maxHp: def.hp, t: 0, attackT: 0, sunT: 999, armed: 1, chewing: 0, jumpT: -1, lifeT: -1, big: 1, asleep: false, eating: false, hide: false, magnetT: 0, coinT: 20, fuse: -1, dead: false, spawnT: 0.2, shells: occ };
      occ.underPumpkin = true;
      G.plants.push(shell);
    } else {
      G.plants.push({ type: 'pumpkin', row, col, x: LAWN_X + col * TILE_W + TILE_W / 2, y: LAWN_Y + row * TILE_H + TILE_H - 8, hp: def.hp, maxHp: def.hp, t: 0, attackT: 0, sunT: 999, armed: 1, chewing: 0, jumpT: -1, lifeT: -1, big: 1, asleep: false, eating: false, hide: false, magnetT: 0, coinT: 20, fuse: -1, dead: false, spawnT: 0.2 });
    }
    Audio2.sfx('plant');
    G.selectedPacket = null;
    return;
  }
  if (type === 'coffeebean') {
    const occ = plantAt(row, col);
    if (occ && occ.asleep) {
      occ.asleep = false;
      G.sun -= def.cost;
      Audio2.sfx('pop');
      spawnParticles(occ.x, occ.y - 20, '#6d4c41', 8);
      G.selectedPacket = null;
      return;
    }
    Audio2.sfx('error');
    return;
  }
  if (type === 'imitater') {
    def = { ...def, cost: G.imitaterCopy ? PLANT_DEFS[G.imitaterCopy].cost : def.cost };
  }
  if (G.sun < def.cost) { Audio2.sfx('error'); return; }
  if (!tileFree(row, col)) { Audio2.sfx('error'); return; }
  if (isWater(row) && type !== 'lilypad' && type !== 'tanglekelp' && type !== 'seashroom') { Audio2.sfx('error'); return; }
  if (!isWater(row) && (type === 'tanglekelp' || type === 'seashroom')) { Audio2.sfx('error'); return; }
  if (G.iceTiles.has(row + ',' + col)) { Audio2.sfx('error'); return; }
  if (type === 'gravebuster') {
    const g = G.graves.find(g => g.row === row && g.col === col);
    if (!g) { Audio2.sfx('error'); return; }
  }
  G.sun -= def.cost;
  const p = {
    type, row, col, x: LAWN_X + col * TILE_W + TILE_W / 2, y: LAWN_Y + row * TILE_H + TILE_H - 8,
    hp: def.hp, maxHp: def.hp, t: 0, attackT: 0, sunT: type === 'sunflower' ? 3 + Math.random() * 9.5 : 12,
    armed: type === 'potatomine' ? 0 : 1, chewing: 0, jumpT: -1, lifeT: (type === 'puffshroom' || type === 'seashroom') ? 20 : -1,
    big: type === 'sunshroom' ? 0 : 1, asleep: MUSHROOMS.includes(type) && G.level.theme === 'day',
    eating: false, hide: false, magnetT: 0, coinT: 20, fuse: -1, dead: false, spawnT: 0.3,
  };
  if (type === 'gravebuster') { const g = G.graves.find(g => g.row === row && g.col === col); if (g) g.consuming = true; }
  G.plants.push(p);
  Audio2.sfx('plant');
  spawnParticles(p.x, p.y, '#6d4c41', 10);
  G.selectedPacket = null;
}

function useShovel(row, col) {
  const p = plantAt(row, col);
  if (p) {
    p.dead = true;
    Audio2.sfx('shovel');
    spawnParticles(p.x, p.y - 10, '#8d6e63', 8);
  }
  G.shovelMode = false;
}

function imitaterClick(x, y) {
  let px = 12;
  for (const pk of G.packets) {
    if (x >= px && x <= px + 56 && y >= 6 && y <= 44 && pk !== 'imitater') {
      G.selectedPacket = 'imitater';
      G.imitaterCopy = pk;
      G.imitaterPicker = false;
      Audio2.sfx('click');
      return;
    }
    px += 62;
  }
  G.imitaterPicker = false;
}

// ---------- plant food ----------
function feedPlant(p) {
  const it = G.items.find(i => i.collected && !i.used);
  if (!it) return;
  it.used = true; it.dead = true;
  Audio2.sfx('pop');
  const food = {
    sunflower: () => { addSun(p.x, p.y - 20, 150, false); },
    peashooter: () => { for (let i = 0; i < 10; i++) G.projectiles.push(makeProjectile('pea', p.row, p.x + 20, p.y - 34, 20)); },
    wallnut: () => { p.hp = p.maxHp; },
    tallnut: () => { p.hp = p.maxHp; },
    pumpkin: () => { p.hp = p.maxHp; },
    cherrybomb: () => { p.fuse = 0.01; },
    chomper: () => { p.chewing = 0; },
    repeater: () => { for (let i = 0; i < 8; i++) G.projectiles.push(makeProjectile('pea', p.row, p.x + 20, p.y - 34, 20)); },
    default: () => {
      for (const z of G.zombies) if (z.row === p.row && z.x > p.x - 40 && z.x < p.x + 200) damageZombie(z, 1800, null);
    },
  };
  (food[p.type] || food.default)();
  spawnParticles(p.x, p.y - 20, '#76ff03', 12);
}

// ---------- projectiles ----------
function pultTarget(p) {
  const z = G.zombies.filter(z => !z.dead && z.row === p.row && z.x > p.x).sort((a, b) => a.x - b.x)[0];
  return z ? z.x : p.x + 400;
}

function makeProjectile(kind, row, x, y, dmg, opts = {}) {
  const speeds = { pea: 333, firepea: 333, snowpea: 333, fume: 300, puff: 250, spike: 360, star: 300, cabbage: 0, kernel: 0, butter: 0, melon: 0, wintermelon: 0, basketball: 0 };
  let vx = opts.vx ?? speeds[kind] ?? 220;
  let vy = opts.vy ?? 0;
  if (opts.arc && opts.targetX !== undefined) {
    const g = 500;
    const dist = Math.abs(opts.targetX - x);
    const flightT = Math.min(2.2, Math.max(0.8, dist / 180));
    vx = (opts.targetX - x) / flightT;
    const landY = LAWN_Y + row * TILE_H + TILE_H - 12;
    vy = (landY - y - 0.5 * g * flightT * flightT) / flightT;
  }
  return { kind, row, x, y, vx, vy, dmg, t: 0, splash: opts.splash || 0, slow: opts.slow || 0, arc: opts.arc || 0, z0: y, dead: false, targetZ: opts.targetZ };
}

function updateProjectiles(dt) {
  for (const pr of G.projectiles) {
    pr.t += dt;
    if (pr.arc) {
      pr.vy += 500 * dt;
      pr.x += pr.vx * dt; pr.y += pr.vy * dt;
      const gz = G.zombies.find(z => z.row === pr.row && !z.dead && Math.abs(z.x - pr.x) < 30 && pr.y > z.y - 70 && pr.y < z.y + 10);
      if (gz || pr.y > LAWN_Y + pr.row * TILE_H + TILE_H || (pr.targetX !== undefined && pr.vx > 0 && pr.x >= pr.targetX)) {
        pr.dead = true;
        if (pr.kind === 'basketball') {
          for (const p of G.plants) if (p.row === pr.row && !p.dead && Math.abs(p.x - pr.x) < 40) { p.hp -= pr.dmg; if (p.hp <= 0) { p.dead = true; G.stats.plantsEaten++; } }
          spawnParticles(pr.x, pr.y, '#e65100', 8);
        } else if (pr.splash) {
          for (const z of G.zombies) if (!z.dead && Math.hypot(z.x - pr.x, (z.y - 20) - pr.y) < 60) damageZombie(z, pr.dmg, pr);
          spawnParticles(pr.x, pr.y, pr.kind === 'wintermelon' ? '#4fc3f7' : '#aed581', 10);
        } else if (gz) damageZombie(gz, pr.dmg, pr);
        else spawnParticles(pr.x, pr.y, '#aed581', 5);
      }
      continue;
    }
    pr.x += pr.vx * dt;
    if (pr.x > W + 20) { pr.dead = true; continue; }
    for (const z of G.zombies) {
      if (z.dead || z.row !== pr.row) continue;
      if (z.type === 'balloon' && z.armor > 0 && pr.kind !== 'spike') continue;
      if (z.type === 'snorkel' && z.swim) continue;
      if (z.type === 'digger' && z.underground) continue;
      if (Math.abs(z.x - pr.x) < 22 && pr.y > z.y - 75 && pr.y < z.y + 5) {
        pr.dead = true;
        damageZombie(z, pr.dmg, pr);
        if (pr.kind === 'butter') { z.freezeT = Math.max(z.freezeT, 4); Audio2.sfx('butter'); }
        if (pr.slow) { z.slowT = Math.max(z.slowT, pr.slow); }
        if (pr.kind === 'firepea') spawnParticles(pr.x, pr.y, '#ff7043', 4);
        if (pr.kind === 'snowpea') spawnParticles(pr.x, pr.y, '#b3e5fc', 4);
        if (pr.kind === 'fume') spawnParticles(pr.x, pr.y, '#b0bec5', 3);
        break;
      }
    }
  }
  G.projectiles = G.projectiles.filter(p => !p.dead);
}

function damageZombie(z, dmg, pr) {
  if (z.dead) return;
  if (z.type === 'yeti' && !z.fled) { z.fled = true; z.speed = 60; z.dir = 1; Audio2.sfx('pop'); }
  if (z.armor > 0) {
    z.armor -= dmg;
    Audio2.sfx('crack');
    spawnParticles(z.x, z.y - 40, '#b0bec5', 4);
    if (z.armor <= 0) {
      z.armor = 0;
      if (z.type === 'balloon') { z.fallT = 0; Audio2.sfx('pop'); }
    }
    return;
  }
  z.hp -= dmg;
  z.hitT = 0.15;
  if (z.type === 'gargantuar' && z.hp < z.maxHp / 2 && !z.threwImp) {
    z.threwImp = true;
    spawnZombie('imp', z.row, z.x - 30);
    Audio2.sfx('throw');
  }
  if (z.hp <= 0) killZombie(z);
}

function killZombie(z, silent) {
  if (z.dead) return;
  z.dead = true;
  G.killedCount++;
  if (!silent) {
    Audio2.sfx('pop');
    spawnParticles(z.x, z.y - 20, '#9e9d6e', 8);
    if (z.type === 'yeti') { addSun(z.x, z.y - 30, 1000, false); Audio2.sfx('diamond'); }
    else if (Math.random() < 0.04) G.items.push({ x: z.x, y: z.y - 30, t: 0, life: 15, collected: false, flyT: 0, used: false, dead: false });
    if (z.type === 'bobsled') {
      for (let i = 0; i < 4; i++) spawnZombie('basic', z.row, z.x - 10 - i * 14);
    }
    if (z.type === 'zomboni') { /* ice trail remains */ }
  }
}

// ---------- zombies ----------
function spawnZombie(type, row, x) {
  const def = ZOMBIE_DEFS[type];
  // Armour is tracked separately from body HP: the body always has the
  // 270 HP of a basic zombie and the accessory soaks damage first.
  const armorMap = { conehead: 370, buckethead: 1100, screendoor: 1100, football: 1400, balloon: 20, polevault: 500, dolphinrider: 230 };
  const spd = def.spdMin !== undefined ? def.spdMin + Math.random() * (def.spdMax - def.spdMin) : def.speed;
  const z = {
    type, row, x: x !== undefined ? x : W + 30 + Math.random() * 40,
    y: LAWN_Y + row * TILE_H + TILE_H - 8,
    hp: def.hp, maxHp: def.hp, armor: armorMap[type] || 0, armorMax: armorMap[type] || 0,
    speed: spd, t: Math.random() * 10, state: 'walk', slowT: 0, freezeT: 0, hitT: 0,
    eatT: 0, target: null, vaultT: -1, jumpT: -1, fallT: -1, swim: false, underground: false,
    digT: 0, dir: -1, fuse: type === 'jackinthebox' ? 12 : -1, threwImp: false, fled: false,
    summonT: type === 'dancing' ? 6 : -1, dead: false, eatAnim: 0,
  };
  if (type === 'snorkel' && isWater(row)) z.swim = true;
  if (type === 'balloon') z.y -= 34;
  if (type === 'bungee') {
    const targets = G.plants.filter(p => !p.dead);
    const target = targets.length ? targets[Math.floor(Math.random() * targets.length)] : null;
    z.col = target ? target.col : 8;
    z.row = target ? target.row : row;
    z.y = -60;
    z.targetY = target ? target.y - 60 : LAWN_Y + row * TILE_H + 20;
    z.dropT = 0;
    z.landed = false;
    z.stole = false;
  }
  G.zombies.push(z);
  if (type !== 'imp' && type !== 'backupdancer') G.spawnedCount++;
  return z;
}

function zombieEatTarget(z) {
  const onTile = G.plants.filter(p => p.row === z.row && !p.dead && Math.abs(p.x - z.x) < 34 && p.x < z.x + 20);
  if (!onTile.length) return null;
  return onTile.find(p => p.type === 'pumpkin') || onTile[0];
}

function updateZombies(dt) {
  for (const z of G.zombies) {
    if (z.dead) continue;
    z.t += dt;
    if (z.hitT > 0) z.hitT -= dt;
    if (z.slowT > 0) z.slowT -= dt;
    if (z.freezeT > 0) { z.freezeT -= dt; continue; }
    if (z.fallT >= 0) {
      z.fallT += dt * 1.5;
      if (z.fallT >= 1) {
        z.fallT = -1;
        z.y = LAWN_Y + z.row * TILE_H + TILE_H - 8;
        z.speed = 22;
        spawnParticles(z.x, z.y, '#e53935', 8);
      }
      continue;
    }
    const spd = z.speed * (z.slowT > 0 ? 0.5 : 1);

    if (z.type === 'bungee') { updateBungee(z, dt); continue; }

    if (z.type === 'digger') {
      if (!z.underground) {
        z.x -= spd * dt;
        z.digT += dt;
        if (z.digT > 4 || z.x < LAWN_X + COLS * TILE_W * 0.6) { z.underground = true; z.digT = 0; Audio2.sfx('shovel'); }
      } else {
        z.x -= spd * 1.6 * dt;
        z.digT += dt;
        const behind = G.plants.some(p => p.row === z.row && !p.dead && p.x < z.x - 20);
        if (behind || z.x < LAWN_X + 60) {
          z.underground = false; z.dir = 1;
          spawnParticles(z.x, z.y, '#6d4c41', 8);
        }
      }
      if (!z.underground && z.dir === 1) {
        const p = zombieEatTarget(z);
        if (p) { eatPlant(z, p, dt); continue; }
        z.x += spd * dt;
      } else if (!z.underground) {
        const p = zombieEatTarget(z);
        if (p) { eatPlant(z, p, dt); continue; }
      }
      checkBreach(z);
      continue;
    }

    if (z.type === 'catapult') {
      const target = G.plants.filter(p => p.row === z.row && !p.dead && p.x < z.x).sort((a, b) => b.x - a.x)[0];
      if (z.x > LAWN_X + COLS * TILE_W + 40) { z.x -= spd * dt; continue; }
      z.attackT = (z.attackT || 0) + dt;
      if (z.attackT > 3 && target) {
        z.attackT = 0;
        G.projectiles.push(makeProjectile('basketball', z.row, z.x, z.y - 40, 100, { vx: -160, vy: -260, arc: 1, targetZ: target.x }));
        Audio2.sfx('throw');
      }
      continue;
    }

    if (z.type === 'snorkel' && z.swim) {
      z.x -= spd * dt;
      const p = G.plants.find(p => p.row === z.row && !p.dead && Math.abs(p.x - z.x) < 40);
      if (p) { z.swim = false; }
      checkBreach(z);
      continue;
    }

    if (z.type === 'zomboni') {
      z.x -= spd * dt;
      const col = Math.floor((z.x - LAWN_X) / TILE_W);
      if (col >= 0 && col < COLS) G.iceTiles.add(z.row + ',' + col);
      const p = zombieEatTarget(z);
      if (p) { eatPlant(z, p, dt); continue; }
      checkBreach(z);
      continue;
    }

    if (z.type === 'dancing') {
      z.summonT -= dt;
      if (z.summonT <= 0) {
        z.summonT = 12;
        for (let i = 0; i < 4; i++) spawnZombie('backupdancer', z.row, z.x + 30 + i * 22);
        Audio2.sfx('wave');
      }
    }

    if (z.type === 'jackinthebox') {
      z.fuse -= dt;
      if (z.fuse <= 0) {
        z.dead = true;
        Audio2.sfx('explosion');
        G.shake = Math.max(G.shake, 0.4);
        for (const p of G.plants) {
          if (Math.abs(p.row - z.row) <= 1 && Math.abs(p.x - z.x) < 90) { p.dead = true; G.stats.plantsEaten++; }
        }
        spawnParticles(z.x, z.y - 20, '#ff7043', 20, 120);
        continue;
      }
    }

    if (z.type === 'polevault' && z.vaultT < 0 && z.armor > 0) {
      const p = zombieEatTarget(z);
      if (p) { z.vaultT = 0; Audio2.sfx('vault'); }
    }
    if (z.vaultT >= 0) {
      z.vaultT += dt * 1.8;
      z.x -= spd * 2.2 * dt;
      if (z.vaultT >= 1) { z.vaultT = -1; z.armor = 0; }
      checkBreach(z);
      continue;
    }
    if ((z.type === 'pogo' || z.type === 'dolphinrider') && z.jumpT < 0 && z.armor > 0) {
      const p = zombieEatTarget(z);
      if (p) { z.jumpT = 0; Audio2.sfx('vault'); }
    }
    if (z.jumpT >= 0) {
      z.jumpT += dt * 1.6;
      z.x -= spd * 1.8 * dt;
      if (z.jumpT >= 1) { z.jumpT = -1; z.armor = 0; }
      checkBreach(z);
      continue;
    }

    if (z.hypno) {
      const foe = G.zombies.find(o => !o.dead && o !== z && !o.hypno && o.row === z.row && Math.abs(o.x - z.x) < 30);
      if (foe) {
        foe.hp -= 100 * dt;
        foe.hitT = 0.1;
        if (foe.hp <= 0) killZombie(foe);
        z.eatAnim += dt;
        continue;
      }
      z.x += spd * dt;
      if (z.x > W + 40) z.dead = true;
      continue;
    }

    const p = zombieEatTarget(z);
    if (p) { eatPlant(z, p, dt); continue; }

    z.x += z.dir * spd * dt;
    if (z.type === 'yeti' && z.fled && z.x > W + 40) z.dead = true;
    checkBreach(z);
  }
  G.zombies = G.zombies.filter(z => !z.dead);
}

function eatPlant(z, p, dt) {
  z.state = 'eat';
  z.eatAnim += dt;
  if (z.eatAnim > 0.5 || z.type === 'gargantuar') {
    z.eatAnim = 0;
    p.hp -= z.type === 'gargantuar' ? 99999 : 50;
    Audio2.sfx('eat');
    spawnParticles(p.x, p.y - 20, '#7cb342', 3);
    if (p.hp <= 0) {
      p.dead = true;
      G.stats.plantsEaten++;
      if (p.shells) p.shells.underPumpkin = false;
    }
  }
}

function checkBreach(z) {
  if (z.x > HOUSE_X + 10) return;
  const mower = G.mowers.find(m => m.row === z.row);
  if (mower && mower.state === 'idle') {
    mower.state = 'run';
    mower.x = 10;
    Audio2.sfx('mower');
    return;
  }
  if (!mower || mower.state === 'done') {
    if (!G.gameOver && !G.levelComplete) {
      G.gameOver = true;
      Audio2.sfx('lose');
      Audio2.stopMusic();
      if (G.mp) netSendEnd('zombie');
    }
  }
}

function updateBungee(z, dt) {
  z.dropT = (z.dropT || 0) + dt;
  if (!z.landed) {
    z.y += 60 * dt;
    if (z.y >= z.targetY) { z.landed = true; }
    return;
  }
  if (!z.stole) {
    const p = plantAt(z.row, z.col);
    if (p) {
      const umb = G.plants.some(u => u.type === 'umbrellaleaf' && Math.abs(u.row - z.row) <= 1 && Math.abs(u.col - z.col) <= 1);
      if (umb) { z.dead = true; Audio2.sfx('pop'); return; }
      p.dead = true;
      G.stats.plantsEaten++;
      z.stole = true;
      Audio2.sfx('pop');
    }
  }
  z.y -= 80 * dt;
  if (z.y < -60) z.dead = true;
}

function updateMowers(dt) {
  for (const m of G.mowers) {
    if (m.state !== 'run') continue;
    m.x += 500 * dt;
    for (const z of G.zombies) {
      if (!z.dead && z.row === m.row && z.x < m.x + 30 && z.x > m.x - 40) killZombie(z);
    }
    if (m.x > W + 40) m.state = 'done';
  }
}

// ---------- plants ----------
function updatePlants(dt) {
  for (const p of G.plants) {
    if (p.dead) continue;
    p.t += dt;
    if (p.spawnT > 0) { p.spawnT -= dt; continue; }
    if (p.asleep) {
      const it = G.items.find(i => i.collected && !i.used);
      continue;
    }
    if (p.lifeT > 0) {
      p.lifeT -= dt;
      if (p.lifeT <= 0) { p.dead = true; spawnParticles(p.x, p.y - 10, '#ce93d8', 8); continue; }
    }
    if (p.type === 'sunflower' || p.type === 'twinsunflower') {
      p.sunT -= dt;
      if (p.sunT <= 0) {
        p.sunT = 25;
        addSun(p.x + (Math.random() * 20 - 10), p.y - 30, p.type === 'twinsunflower' ? 50 : 25, false);
        Audio2.sfx('pop');
      }
    }
    if (p.type === 'sunshroom') {
      p.big += dt / 120;
      if (p.big >= 1) p.big = 1;
      p.sunT -= dt;
      if (p.sunT <= 0) {
        p.sunT = 25;
        addSun(p.x, p.y - 20, p.big >= 1 ? 25 : 15, false);
      }
    }
    if (p.type === 'marigold') {
      p.coinT -= dt;
      if (p.coinT <= 0) {
        p.coinT = 30;
        const gold = Math.random() < 0.25;
        G.suns.push({ x: p.x, y: p.y - 20, vy: 0, value: gold ? 50 : 25, t: 0, life: 12, collected: false, flyT: 0, fromSky: false, coin: true });
        Audio2.sfx('coin');
      }
    }
    if (p.type === 'potatomine') {
      if (p.armed < 1) {
        p.armed += dt / 15;
        if (p.armed >= 1) {
          p.armed = 1;
          const z = G.zombies.find(z => !z.dead && z.row === p.row && Math.abs(z.x - p.x) < 30 && !(z.type === 'balloon' && z.armor > 0));
          if (z) {
            p.dead = true;
            Audio2.sfx('explosion');
            G.shake = Math.max(G.shake, 0.3);
            for (const zz of G.zombies) if (!zz.dead && zz.row === p.row && Math.abs(zz.x - p.x) < 40) damageZombie(zz, 1800, null);
            spawnParticles(p.x, p.y - 10, '#ff7043', 14, 100);
          }
        }
      }
    }
    if (p.type === 'cherrybomb') {
      if (p.fuse < 0) p.fuse = 1.2;
      p.fuse -= dt;
      if (p.fuse <= 0) {
        p.dead = true;
        Audio2.sfx('explosion');
        G.shake = Math.max(G.shake, 0.6);
        for (const z of G.zombies) {
          if (!z.dead && Math.abs(z.row - p.row) <= 1 && Math.abs(z.x - p.x) < 110) damageZombie(z, 1800, null);
        }
        spawnParticles(p.x, p.y - 20, '#ff5722', 24, 140);
        spawnParticles(p.x, p.y - 20, '#ffeb3b', 12, 100);
      }
      continue;
    }
    if (p.type === 'jalapeno') {
      p.fuse = 0.8;
      p.dead = true;
      Audio2.sfx('fire');
      G.shake = Math.max(G.shake, 0.5);
      for (const z of G.zombies) if (!z.dead && z.row === p.row) killZombie(z);
      for (let i = 0; i < 10; i++) G.particles.push({ x: p.x + i * 70, y: p.y - 20, vx: 100, vy: -40, t: -i * 0.05, life: 0.6, color: '#ff5722', r: 8 });
      continue;
    }
    if (p.type === 'iceshroom') {
      p.dead = true;
      Audio2.sfx('freeze');
      for (const z of G.zombies) if (!z.dead) z.freezeT = 4;
      spawnParticles(p.x, p.y - 20, '#b3e5fc', 20, 120);
      continue;
    }
    if (p.type === 'doomshroom') {
      p.fuse = 1.5;
      p.dead = true;
      Audio2.sfx('explosion');
      G.shake = Math.max(G.shake, 0.8);
      for (const z of G.zombies) if (!z.dead && Math.abs(z.row - p.row) <= 1 && Math.abs(z.x - p.x) < 130) damageZombie(z, 1800, null);
      G.iceTiles.add(p.row + ',' + p.col);
      spawnParticles(p.x, p.y - 20, '#4e342e', 30, 160);
      continue;
    }
    if (p.type === 'blover') {
      p.dead = true;
      Audio2.sfx('sputter');
      for (const z of G.zombies) {
        if (z.dead) continue;
        if (z.type === 'balloon' && z.armor > 0) { z.armor = 0; z.fallT = 0; }
      }
      G.fogCleared = true;
      spawnParticles(p.x, p.y - 20, '#c8e6c9', 16, 140);
      continue;
    }
    if (p.type === 'squash') {
      const z = G.zombies.find(z => !z.dead && z.row === p.row && z.x > p.x - 20 && z.x < p.x + 120 && !(z.type === 'balloon' && z.armor > 0));
      if (z && p.jumpT < 0) { p.jumpT = 0; p.targetZ = z; Audio2.sfx('vault'); }
      if (p.jumpT >= 0) {
        p.jumpT += dt * 2;
        if (p.jumpT >= 1) {
          p.dead = true;
          if (p.targetZ && !p.targetZ.dead) damageZombie(p.targetZ, 1800, null);
          Audio2.sfx('chomp');
          spawnParticles(p.x + 30, p.y - 10, '#9ccc65', 10);
        }
      }
      continue;
    }
    if (p.type === 'tanglekelp') {
      const z = G.zombies.find(z => !z.dead && z.row === p.row && Math.abs(z.x - p.x) < 30 && z.type !== 'balloon');
      if (z) {
        p.dead = true; z.dead = true;
        Audio2.sfx('splash');
        spawnParticles(p.x, p.y, '#4fc3f7', 14, 90);
        G.killedCount++;
      }
      continue;
    }
    if (p.type === 'gravebuster') {
      const g = G.graves.find(g => g.row === p.row && g.col === p.col && g.consuming);
      if (g) {
        g.progress = (g.progress || 0) + dt / 6;
        if (g.progress >= 1) { g.dead = true; p.dead = true; Audio2.sfx('pop'); }
      } else p.dead = true;
      continue;
    }
    if (p.type === 'hypnoshroom') {
      const z = G.zombies.find(z => !z.dead && !z.hypno && z.row === p.row && Math.abs(z.x - p.x) < 30);
      if (z) {
        p.dead = true;
        z.hypno = true;
        z.dir = 1;
        z.speed = 26;
        Audio2.sfx('pop');
        spawnParticles(z.x, z.y - 40, '#f48fb1', 10);
      }
      continue;
    }
    if (p.type === 'magnetshroom' || p.type === 'goldmagnet') {
      if (p.type === 'goldmagnet') {
        p.coinT -= dt;
        if (p.coinT <= 0) {
          p.coinT = 25;
          G.suns.push({ x: p.x, y: p.y - 20, vy: 0, value: 50, t: 0, life: 12, collected: false, flyT: 0, fromSky: false, coin: true });
          Audio2.sfx('coin');
        }
        continue;
      }
      p.magnetT -= dt;
      if (p.magnetT <= 0) {
        const z = G.zombies.find(z => !z.dead && z.armor > 0 && Math.abs(z.x - p.x) < 150);
        if (z) {
          p.magnetT = 8;
          z.armor = 0;
          Audio2.sfx('magnet');
          spawnParticles(z.x, z.y - 40, '#e53935', 8);
        } else p.magnetT = 0.5;
      }
      continue;
    }
    if (p.type === 'coffeebean') continue;

    // shooters
    const shooter = ['peashooter', 'repeater', 'snowpea', 'fumeshroom', 'puffshroom', 'scaredyshroom', 'gatlingpea', 'splitpea', 'starfruit', 'cactus', 'threepeater', 'cabbagepult', 'kernelpult', 'melonpult', 'wintermelon'].includes(p.type);
    if (shooter) {
      if (p.type === 'scaredyShroom') {
        const near = G.zombies.some(z => !z.dead && z.row === p.row && z.x > p.x - 90 && z.x < p.x + 60);
        p.hide = near;
        if (near) continue;
      }
      const range = { puffshroom: 3, seashroom: 3, fumeshroom: 9, cactus: 9, starfruit: 9 }[p.type] || 9;
      const inRange = G.zombies.some(z => !z.dead && z.row === p.row && z.x > p.x && z.x < p.x + range * TILE_W && !(z.type === 'balloon' && z.armor > 0 && p.type !== 'cactus') && !(z.type === 'snorkel' && z.swim) && !(z.type === 'digger' && z.underground));
      if (!inRange) { p.attackT = 0; continue; }
      p.attackT -= dt;
      if (p.attackT <= 0) {
        const rates = { peashooter: 1.5, repeater: 1.5, snowpea: 1.5, fumeshroom: 1.5, puffshroom: 1.5, scaredyshroom: 1.5, gatlingpea: 1.5, splitpea: 1.5, starfruit: 1.5, cactus: 1.5, threepeater: 1.5, cabbagepult: 3.0, kernelpult: 3.0, melonpult: 3.0, wintermelon: 3.0 };
        p.attackT = rates[p.type] || 1.4;
        p.attack = 0.25;
        const py = p.y - 34;
        const fire = (kind, dmg, opts) => G.projectiles.push(makeProjectile(kind, p.row, p.x + 18, py, dmg, opts));
        switch (p.type) {
          case 'peashooter': fire('pea', 20); Audio2.sfx('pea'); break;
          case 'repeater': fire('pea', 20); setTimeout(() => { if (!p.dead) { fire('pea', 20); } }, 150); Audio2.sfx('pea'); break;
          case 'snowpea': fire('snowpea', 20, { slow: 4 }); Audio2.sfx('pea'); break;
          case 'fumeshroom': fire('fume', 20); Audio2.sfx('sputter'); break;
          case 'puffshroom': case 'scaredyshroom': fire('puff', 20); Audio2.sfx('pea'); break;
          case 'gatlingpea':
            for (let i = 0; i < 4; i++) setTimeout(() => { if (!p.dead) fire('pea', 20); }, i * 120);
            Audio2.sfx('pea'); break;
          case 'splitpea': fire('pea', 20); G.projectiles.push(makeProjectile('pea', p.row, p.x - 18, py, 20, { vx: -220 })); Audio2.sfx('pea'); break;
          case 'starfruit':
            for (const [vx, vy] of [[220, 0], [-220, 0], [160, -120], [160, 120], [-160, -120]])
              G.projectiles.push(makeProjectile('star', p.row, p.x, py, 20, { vx, vy }));
            Audio2.sfx('pea'); break;
          case 'cactus': fire('spike', 20); Audio2.sfx('pea'); break;
          case 'threepeater':
            for (const r of [p.row - 1, p.row, p.row + 1]) if (r >= 0 && r < ROWS) fire('pea', 20);
            Audio2.sfx('pea'); break;
          case 'cabbagepult': G.projectiles.push(makeProjectile('cabbage', p.row, p.x, py, 40, { vx: 140, vy: -240, arc: 1, splash: 40, targetX: pultTarget(p) })); Audio2.sfx('throw'); break;
          case 'kernelpult': {
            const tx = pultTarget(p);
            if (Math.random() < 0.3) G.projectiles.push(makeProjectile('butter', p.row, p.x, py, 0, { vx: 140, vy: -240, arc: 1, targetX: tx }));
            else G.projectiles.push(makeProjectile('kernel', p.row, p.x, py, 20, { vx: 140, vy: -240, arc: 1, targetX: tx }));
            Audio2.sfx('throw'); break;
          }
          case 'melonpult': G.projectiles.push(makeProjectile('melon', p.row, p.x, py, 80, { vx: 130, vy: -250, arc: 1, splash: 60, targetX: pultTarget(p) })); Audio2.sfx('throw'); break;
          case 'wintermelon': G.projectiles.push(makeProjectile('wintermelon', p.row, p.x, py, 80, { vx: 130, vy: -250, arc: 1, splash: 60, slow: 4, targetX: pultTarget(p) })); Audio2.sfx('throw'); break;
        }
      }
    }
    if (p.attackT > 0 && p.attack !== undefined) p.attack -= dt;
    if (p.type === 'chomper') {
      if (p.chewing > 0) { p.chewing -= dt; continue; }
      const z = G.zombies.find(z => !z.dead && z.row === p.row && z.x > p.x - 10 && z.x < p.x + 70 && z.type !== 'gargantuar' && !(z.type === 'balloon' && z.armor > 0));
      if (z) {
        z.dead = true;
        G.killedCount++;
        p.chewing = 14;
        p.attack = 0.5;
        Audio2.sfx('chomp');
        spawnParticles(z.x, z.y - 20, '#ab47bc', 10);
      }
    }
    if (p.type === 'spikewalk') {
      for (const z of G.zombies) {
        if (!z.dead && z.row === p.row && Math.abs(z.x - p.x) < 26 && !(z.type === 'balloon' && z.armor > 0) && z.type !== 'digger') {
          damageZombie(z, 40 * dt, null);
        }
      }
    }
  }
  G.plants = G.plants.filter(p => !p.dead);
  G.graves = G.graves.filter(g => !g.dead);
}

// ---------- waves ----------
function buildWaves() {
  G.spawnQueue = [];
  G.totalToSpawn = 0;
  G.spawnedCount = 0;
  G.killedCount = 0;
  let idx = 0;
  for (const w of G.level.waves) {
    let t = w.t;
    if (w.huge) {
      G.spawnQueue.push({ t, type: 'flag', row: Math.floor(Math.random() * ROWS), delay: 0 });
      G.totalToSpawn++;
      t += 2;
    }
    for (const [type, count, gap] of w.spawns) {
      for (let i = 0; i < count; i++) {
        G.spawnQueue.push({ t, type, row: Math.floor(Math.random() * ROWS), delay: 0 });
        G.totalToSpawn++;
        t += (gap || 8) / count + Math.random() * 2;
      }
    }
    idx++;
  }
  G.spawnQueue.sort((a, b) => a.t - b.t);
}

function updateWaves(dt) {
  G.levelTime += dt;
  while (G.spawnQueue.length && G.spawnQueue[0].t <= G.levelTime) {
    const s = G.spawnQueue.shift();
    spawnZombie(s.type, s.row);
    if (s.type === 'flag') {
      G.banner = 'A HUGE WAVE OF ZOMBIES IS APPROACHING';
      G.bannerT = 3;
      Audio2.sfx('huge');
    }
  }
  if (G.bannerT > 0) G.bannerT -= dt;
  const allSpawned = G.spawnQueue.length === 0;
  const allDead = G.zombies.length === 0;
  if (allSpawned && allDead && !G.levelComplete && !G.gameOver && G.levelTime > 5) {
    G.levelComplete = true;
    Audio2.sfx('win');
    Audio2.stopMusic();
    if (G.mp) netSendEnd('plant');
  }
}

// ---------- level setup ----------
function startLevel(levelId) {
  const level = LEVELS[levelId];
  G.level = level;
  G.levelId = levelId;
  G.levelTime = 0;
  G.sun = level.startSun;
  G.plants = []; G.zombies = []; G.projectiles = []; G.suns = []; G.particles = []; G.items = [];
  G.mowers = [];
  for (let r = 0; r < ROWS; r++) G.mowers.push({ row: r, x: 10, state: 'idle' });
  G.packets = level.packets.slice();
  G.cooldowns = {};
  G.selectedPacket = null; G.shovelMode = false; G.imitaterPicker = false;
  G.gameOver = false; G.levelComplete = false; G.paused = false;
  G.skySunT = 8; G.shake = 0; G.banner = null; G.bannerT = 0;
  G.levelCardT = 2.5;
  G.stats = { sunCollected: 0, plantsEaten: 0, zombiesKilled: 0, brainsSpent: 0 };
  G.iceTiles = new Set();
  G.graves = [];
  G.fogCleared = false;
  if (level.theme === 'night') {
    for (let i = 0; i < 4; i++) G.graves.push({ row: Math.floor(Math.random() * ROWS), col: 2 + Math.floor(Math.random() * 5), progress: 0, consuming: false, dead: false });
  }
  buildWaves();
  G.scene = 'play';
  showOverlay(null);
  Audio2.playMusic(level.theme === 'night' ? 'night' : level.theme === 'pool' ? 'pool' : level.theme === 'roof' ? 'roof' : 'day');
}

// ---------- rendering ----------
function drawBackground() {
  const theme = G.level ? G.level.theme : 'day';
  if (theme === 'night') {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#0d1030'); g.addColorStop(1, '#1a1a40');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#fff';
    for (let i = 0; i < 40; i++) { const sx = (i * 197) % W, sy = (i * 89) % 300; ctx.globalAlpha = 0.4 + (i % 5) * 0.12; ctx.fillRect(sx, sy, 2, 2); }
    ctx.globalAlpha = 1;
    circ(ctx, 680, 70, 30, '#f5f3ce', null);
    circ(ctx, 670, 62, 26, '#0d1030', null);
  } else {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#6ec6ff'); g.addColorStop(0.6, '#aee2ff'); g.addColorStop(1, '#d4f1d4');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(255,255,255,.85)';
    for (const [cx, cy, s] of [[150, 60, 1], [450, 40, 0.7], [650, 90, 0.9]]) {
      ell(ctx, cx, cy, 34 * s, 14 * s, 'rgba(255,255,255,.85)', null);
      ell(ctx, cx + 24 * s, cy + 4 * s, 26 * s, 11 * s, 'rgba(255,255,255,.85)', null);
      ell(ctx, cx - 26 * s, cy + 5 * s, 24 * s, 10 * s, 'rgba(255,255,255,.85)', null);
    }
  }
  // house
  ctx.fillStyle = '#8d6e63'; ctx.fillRect(0, 120, LAWN_X - 6, 300);
  ctx.fillStyle = '#6d4c41'; ctx.fillRect(0, 120, LAWN_X - 6, 12);
  poly(ctx, [[-10, 122], [LAWN_X - 6, 122], [(LAWN_X - 6) / 2, 88]], theme === 'night' ? '#4e342e' : '#a1887f', '#3e2723', 2);
  ctx.fillStyle = theme === 'night' ? '#3e2723' : '#5d4037'; ctx.fillRect(8, 200, 22, 60);
  ctx.fillStyle = theme === 'night' ? '#1a237e' : '#90caf9'; ctx.fillRect(6, 150, 14, 14);
  ctx.strokeStyle = '#3e2723'; ctx.lineWidth = 2; ctx.strokeRect(6, 150, 14, 14);
  // sidewalk
  ctx.fillStyle = '#bdbdbd'; ctx.fillRect(0, 420, LAWN_X - 6, 140);
  ctx.fillStyle = '#9e9e9e';
  for (let i = 0; i < 5; i++) ctx.fillRect(0, 430 + i * 26, LAWN_X - 6, 2);
  // driveway
  ctx.fillStyle = '#9e9e9e'; ctx.fillRect(LAWN_X + COLS * TILE_W, 100, W - LAWN_X - COLS * TILE_W, 460);
  ctx.strokeStyle = '#757575'; ctx.lineWidth = 2;
  for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(LAWN_X + COLS * TILE_W, 120 + i * 80); ctx.lineTo(W, 120 + i * 80); ctx.stroke(); }

  // lawn
  for (let r = 0; r < ROWS; r++) {
    for (let col = 0; col < COLS; col++) {
      const x = LAWN_X + col * TILE_W, y = LAWN_Y + r * TILE_H;
      const water = theme === 'pool' && (r === 2 || r === 3);
      if (water) {
        ctx.fillStyle = (r + col) % 2 ? '#1e88e5' : '#1976d2';
        ctx.fillRect(x, y, TILE_W, TILE_H);
        ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = 1;
        const wob = Math.sin(G.time * 2 + col) * 3;
        ctx.beginPath(); ctx.moveTo(x + 10, y + 20 + wob); ctx.quadraticCurveTo(x + 40, y + 16 - wob, x + 70, y + 20 + wob); ctx.stroke();
      } else {
        ctx.fillStyle = (r + col) % 2 ? '#7ec850' : '#8fd95f';
        ctx.fillRect(x, y, TILE_W, TILE_H);
        ctx.strokeStyle = 'rgba(0,0,0,.06)'; ctx.lineWidth = 1;
        ctx.strokeRect(x, y, TILE_W, TILE_H);
        ctx.strokeStyle = 'rgba(255,255,255,.18)';
        const bx = x + 10 + ((r * 31 + col * 17) % 50);
        ctx.beginPath(); ctx.moveTo(bx, y + 70); ctx.lineTo(bx + 2, y + 62); ctx.stroke();
      }
      if (G.iceTiles.has(r + ',' + col)) {
        ctx.fillStyle = 'rgba(200,230,255,.55)';
        ctx.fillRect(x, y, TILE_W, TILE_H);
        ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x + 8, y + 10); ctx.lineTo(x + 30, y + 40); ctx.moveTo(x + 50, y + 5); ctx.lineTo(x + 60, y + 50); ctx.stroke();
      }
    }
  }
  if (theme === 'roof') {
    ctx.fillStyle = '#a1887f';
    ctx.fillRect(LAWN_X, LAWN_Y - 6, COLS * TILE_W, 8);
    for (let r = 0; r < ROWS; r++) {
      ctx.fillStyle = r % 2 ? '#8d6e63' : '#795548';
      ctx.fillRect(LAWN_X, LAWN_Y + r * TILE_H - 4, COLS * TILE_W, 6);
    }
  }
  // fog
  if (G.level && G.level.theme === 'night' && G.levelId && G.levelId.includes('-') && ['1-6', '1-7', '1-8', '2-6', '2-7', '2-8'].includes(G.levelId)) {
    drawFog();
  }
}

function drawFog() {
  if (G.fogCleared) return;
  const revealed = (row, col) => G.plants.some(p => p.type === 'plantern' && Math.abs(p.row - row) <= 1 && Math.abs(p.col - col) <= 1);
  for (let r = 0; r < ROWS; r++) {
    for (let col = 5; col < COLS; col++) {
      if (revealed(r, col)) continue;
      const x = LAWN_X + col * TILE_W, y = LAWN_Y + r * TILE_H;
      const g = ctx.createLinearGradient(x - 40, 0, x + TILE_W, 0);
      g.addColorStop(0, 'rgba(160,160,170,0)');
      g.addColorStop(0.5, 'rgba(160,160,170,.55)');
      g.addColorStop(1, 'rgba(160,160,170,.55)');
      ctx.fillStyle = g;
      ctx.fillRect(x - 40, y, TILE_W + 40, TILE_H);
    }
  }
}

function drawMowers() {
  for (const m of G.mowers) {
    if (m.state === 'done') continue;
    const y = LAWN_Y + m.row * TILE_H + TILE_H - 14;
    ctx.save(); ctx.translate(m.x, y);
    ctx.fillStyle = '#d32f2f'; rr(ctx, -12, -16, 26, 14, 3, '#d32f2f', '#7f0000', 2);
    ctx.fillStyle = '#b71c1c'; rr(ctx, -10, -22, 12, 8, 2, '#b71c1c', '#7f0000', 1.5);
    circ(ctx, -6, 0, 5, '#37474f', '#1b1b1b', 2);
    circ(ctx, 8, 0, 5, '#37474f', '#1b1b1b', 2);
    if (m.state === 'run') {
      ctx.strokeStyle = '#ffeb3b'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-14, -8); ctx.lineTo(-22, -10); ctx.moveTo(-14, -4); ctx.lineTo(-21, -2); ctx.stroke();
    }
    ctx.restore();
  }
}

function drawGraves() {
  for (const g of G.graves) {
    const x = LAWN_X + g.col * TILE_W + TILE_W / 2, y = LAWN_Y + g.row * TILE_H + TILE_H - 10;
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = '#78909c';
    ctx.beginPath(); ctx.moveTo(-14, 0); ctx.lineTo(-14, -18); ctx.quadraticCurveTo(0, -30, 14, -18); ctx.lineTo(14, 0); ctx.closePath();
    ctx.fill(); ctx.strokeStyle = '#455a64'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#455a64'; ctx.font = 'bold 10px Trebuchet MS'; ctx.textAlign = 'center';
    ctx.fillText('RIP', 0, -10);
    if (g.consuming) {
      ctx.fillStyle = 'rgba(0,0,0,.3)';
      ctx.fillRect(-16, 4, 32 * (g.progress || 0), 3);
    }
    ctx.restore();
  }
}

function drawEntities() {
  const drawList = [];
  for (const p of G.plants) {
    if (p.underPumpkin) continue;
    drawList.push({ y: p.y, fn: () => {
    if (p.spawnT > 0) {
      ctx.fillStyle = '#6d4c41';
      ctx.beginPath(); ctx.ellipse(p.x, p.y, 18, 7, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#4e342e'; ctx.lineWidth = 2; ctx.stroke();
      return;
    }
    if (p.type === 'pumpkin') {
      const inner = G.plants.find(q => q !== p && q.row === p.row && q.col === p.col && q.underPumpkin);
      Reanim.drawPlant('pumpkin', ctx, p.x, p.y, G.time, { hpFrac: p.hp / p.maxHp });
      if (inner) Reanim.drawPlant(inner.type, ctx, p.x, p.y, G.time, {});
      return;
    }
    const opts = { hpFrac: p.hp / p.maxHp, armed: p.armed, chewing: p.chewing > 0, attack: p.attack, hide: p.hide, big: p.big, lifeFrac: p.lifeT > 0 ? p.lifeT / 20 : 1, jumpT: p.jumpT, eating: p.eatAnim > 0, shooting: p.attack > 0 };
    if (p.asleep) {
      ctx.save(); ctx.translate(p.x, p.y);
      Reanim.drawPlant(p.type, ctx, 0, 0, G.time * 0.3, opts);
      ctx.fillStyle = '#1a237e'; ctx.font = 'bold 14px Trebuchet MS'; ctx.textAlign = 'center';
      const zf = 1 + Math.sin(G.time * 2) * 0.2;
      ctx.fillText('Z', 14, -30); ctx.font = 'bold 11px Trebuchet MS'; ctx.fillText('z', 22, -38);
      ctx.restore();
    } else {
      Reanim.drawPlant(p.type, ctx, p.x, p.y, G.time, opts);
    }
    if (p.type === 'spikewalk' && p.attackT > 0) {}
    }});
  }
  for (const z of G.zombies) drawList.push({ y: z.y, fn: () => drawZombie(z) });
  drawList.sort((a, b) => a.y - b.y);
  for (const d of drawList) d.fn();
}

// The bungee reanim is its own drop/grab/raise cycle rather than a walk loop.
function bungeeState(z) {
  if (!z.landed) return 'anim_drop';
  if (z.stole) return 'anim_hold';
  return 'anim_grab';
}

function drawZombie(z) {
  ctx.save();
  if (z.type === 'bungee') {
    Reanim.drawZombie('bungee', ctx, z.x, z.y + 70, G.time, { state: bungeeState(z) });
    ctx.restore();
    return;
  }
  const opts = {
    slow: z.slowT > 0, armor: z.armorMax > 0 ? z.armor / z.armorMax : 0,
    eat: z.state === 'eat', fall: z.fallT >= 0 ? z.fallT : 0,
    vault: z.vaultT >= 0, jumpT: z.jumpT, swim: z.swim, underground: z.underground,
    // drive the original reanim state machine
    state: z.state === 'eat' ? 'anim_eat'
      : z.swim ? 'anim_swim'
      : (z.type === 'dancing' || z.type === 'backupdancer') ? 'anim_armraise'
      : z.fallT >= 0 ? 'anim_fall'
      : 'anim_walk',
  };
  if (z.hypno) {
    ctx.save();
    Reanim.drawZombie(z.type, ctx, z.x, z.y, G.time, opts);
    ctx.restore();
    ctx.save(); ctx.translate(z.x, z.y);
    ctx.globalAlpha = 0.3; circ(ctx, 0, -24, 24, '#f48fb1', null);
    ctx.globalAlpha = 1;
    ctx.font = '16px Trebuchet MS'; ctx.textAlign = 'center';
    ctx.fillText('♥', 0, -52);
    ctx.restore();
    return;
  }
  if (z.freezeT > 0) {
    Reanim.drawZombie(z.type, ctx, z.x, z.y, 0, opts);
    ctx.globalAlpha = 0.4; circ(ctx, z.x, z.y - 24, 26, '#b3e5fc', '#4fc3f7', 2);
    ctx.globalAlpha = 1;
    return;
  }
  if (z.hitT > 0) {
    Reanim.drawZombie(z.type, ctx, z.x, z.y, G.time, opts);
    ctx.globalAlpha = 0.5; circ(ctx, z.x, z.y - 24, 24, '#ffffff', null);
    ctx.globalAlpha = 1;
  } else {
    Reanim.drawZombie(z.type, ctx, z.x, z.y, G.time, opts);
  }
  if (z.hp < z.maxHp && z.armor <= 0) {
    ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.fillRect(z.x - 14, z.y - 78, 28, 4);
    ctx.fillStyle = '#76ff03'; ctx.fillRect(z.x - 14, z.y - 78, 28 * Math.max(0, z.hp / z.maxHp), 4);
  }
  ctx.restore();
}

function drawProjectiles() {
  for (const pr of G.projectiles) {
    ctx.save(); ctx.translate(pr.x, pr.y);
    switch (pr.kind) {
      case 'pea': circ(ctx, 0, 0, 6, '#7cb342', '#33691e', 1.5); break;
      case 'firepea':
        circ(ctx, 0, 0, 7, '#ff7043', '#bf360c', 1.5);
        ctx.globalAlpha = 0.5; circ(ctx, -8, 2, 4, '#ffca28', null); ctx.globalAlpha = 1; break;
      case 'snowpea': circ(ctx, 0, 0, 6, '#4fc3f7', '#01579b', 1.5); break;
      case 'fume':
        ctx.globalAlpha = 0.7; circ(ctx, 0, 0, 8 + Math.sin(pr.t * 10) * 2, '#b0bec5', '#78909c', 1.5); ctx.globalAlpha = 1; break;
      case 'puff': ctx.globalAlpha = 0.8; circ(ctx, 0, 0, 4, '#e1bee7', '#9c27b0', 1); ctx.globalAlpha = 1; break;
      case 'spike': poly(ctx, [[-6, 0], [6, 0], [0, -8]], '#c5e1a5', '#558b2f', 1); break;
      case 'star': {
        ctx.rotate(pr.t * 8);
        poly(ctx, [[0, -7], [2, -2], [7, -2], [3, 2], [5, 7], [0, 4], [-5, 7], [-3, 2], [-7, -2], [-2, -2]], '#ffca28', '#f57f17', 1);
        break;
      }
      case 'cabbage': circ(ctx, 0, 0, 8, '#aed581', '#558b2f', 1.5); break;
      case 'kernel': ell(ctx, 0, 0, 5, 7, '#ffcc80', '#e65100', 1.5); break;
      case 'butter': rr(ctx, -6, -5, 12, 10, 3, '#fff9c4', '#f9a825', 1.5); break;
      case 'melon': circ(ctx, 0, 0, 10, '#388e3c', '#1b5e20', 2); circ(ctx, -3, -3, 2, '#66bb6a', null); break;
      case 'wintermelon': circ(ctx, 0, 0, 10, '#0277bd', '#01579b', 2); circ(ctx, -3, -3, 2, '#4fc3f7', null); break;
      case 'basketball': circ(ctx, 0, 0, 8, '#e65100', '#4e342e', 2); ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(8, 0); ctx.moveTo(0, -8); ctx.lineTo(0, 8); ctx.strokeStyle = '#4e342e'; ctx.lineWidth = 1.5; ctx.stroke(); break;
    }
    ctx.restore();
  }
}

function drawSuns() {
  for (const s of G.suns) {
    if (s.collected) continue;
    if (s.blink) continue;
    ctx.save(); ctx.translate(s.x, s.y + Math.sin(s.t * 3) * 3);
    const pulse = 1 + Math.sin(s.t * 4) * 0.08;
    ctx.scale(pulse, pulse);
    ctx.globalAlpha = 0.35; circ(ctx, 0, 0, 24, s.coin ? '#ffd54f' : '#fff176', null); ctx.globalAlpha = 1;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + s.t;
      poly(ctx, [[Math.cos(a) * 16, Math.sin(a) * 16], [Math.cos(a + 0.2) * 22, Math.sin(a + 0.2) * 22], [Math.cos(a - 0.2) * 22, Math.sin(a - 0.2) * 22]], s.coin ? '#ffca28' : '#ffd54f', null);
    }
    circ(ctx, 0, 0, 14, s.coin ? '#ffd54f' : '#ffeb3b', '#f9a825', 2);
    circ(ctx, -4, -4, 4, '#fff9c4', null);
    if (s.coin) { ctx.fillStyle = '#f9a825'; ctx.font = 'bold 11px Trebuchet MS'; ctx.textAlign = 'center'; ctx.fillText('$', 0, 4); }
    ctx.restore();
  }
}

function drawItems() {
  for (const it of G.items) {
    if (it.dead) continue;
    if (it.collected) {
      it.flyT += 0.05;
      it.x += (40 - it.x) * 0.2; it.y += (20 - it.y) * 0.2;
      if (it.flyT > 1) it.dead = true;
    }
    const blink = it.life < 3 ? Math.sin(G.time * 12) > 0 : true;
    if (!blink) continue;
    ctx.save(); ctx.translate(it.x, it.y + Math.sin(G.time * 3) * 3);
    ctx.globalAlpha = 0.4; circ(ctx, 0, 0, 18, '#76ff03', null); ctx.globalAlpha = 1;
    circ(ctx, 0, 0, 10, '#64dd17', '#33691e', 2);
    circ(ctx, -3, -3, 3, '#ccff90', null);
    ctx.restore();
  }
  G.items = G.items.filter(i => !i.dead);
}

function drawTopBar() {
  ctx.fillStyle = 'rgba(20, 30, 15, .9)';
  rr(ctx, 4, 4, 168, 46, 8, 'rgba(20,30,15,.9)', '#558b2f', 2);
  ctx.fillStyle = '#5d4037'; rr(ctx, 10, 10, 56, 34, 6, '#8d6e63', '#4e342e', 2);
  ctx.save(); ctx.translate(38, 27 + Math.sin(G.time * 2) * 1.5);
  ctx.scale(0.8, 0.8);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    poly(ctx, [[Math.cos(a) * 10, Math.sin(a) * 10], [Math.cos(a + 0.2) * 15, Math.sin(a + 0.2) * 15], [Math.cos(a - 0.2) * 15, Math.sin(a - 0.2) * 15]], '#ffd54f', null);
  }
  circ(ctx, 0, 0, 9, '#ffeb3b', '#f9a825', 1.5);
  ctx.restore();
  ctx.fillStyle = '#fff'; ctx.font = 'bold 16px Trebuchet MS'; ctx.textAlign = 'center';
  ctx.strokeStyle = '#000'; ctx.lineWidth = 3;
  ctx.strokeText(Math.floor(G.sun), 100, 32); ctx.fillText(Math.floor(G.sun), 100, 32);

  let px = 12;
  for (const pk of G.packets) {
    const def = PLANT_DEFS[pk];
    const sel = G.selectedPacket === pk;
    const cd = G.cooldowns[pk] || 0;
    const afford = G.sun >= def.cost;
    ctx.save();
    if (sel) { ctx.shadowColor = '#ffeb3b'; ctx.shadowBlur = 12; }
    rr(ctx, px, 6, 56, 38, 6, sel ? '#a1887f' : '#6d4c41', sel ? '#ffeb3b' : '#3e2723', 2);
    ctx.shadowBlur = 0;
    ctx.save(); ctx.translate(px + 28, 25); ctx.scale(0.55, 0.55);
    Reanim.drawPlant(pk, ctx, 0, 0, G.time, {});
    ctx.restore();
    ctx.fillStyle = afford ? '#fff' : '#ef9a9a';
    ctx.font = 'bold 11px Trebuchet MS'; ctx.textAlign = 'center';
    ctx.fillText(def.cost, px + 28, 42);
    if (cd > 0) {
      const frac = cd / def.cd;
      ctx.fillStyle = 'rgba(0,0,0,.65)';
      ctx.fillRect(px, 6, 56, 38 * frac);
      ctx.fillStyle = '#fff'; ctx.font = 'bold 13px Trebuchet MS';
      ctx.fillText(Math.ceil(cd), px + 28, 28);
    }
    ctx.restore();
    px += 62;
  }
  // shovel
  ctx.save();
  if (G.shovelMode) { ctx.shadowColor = '#ffeb3b'; ctx.shadowBlur = 12; }
  rr(ctx, 176, 8, 34, 34, 6, '#8d6e63', G.shovelMode ? '#ffeb3b' : '#3e2723', 2);
  ctx.shadowBlur = 0;
  ctx.strokeStyle = '#6d4c41'; ctx.lineWidth = 4; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(193, 36); ctx.lineTo(193, 18); ctx.stroke();
  ctx.fillStyle = '#90a4ae';
  ctx.beginPath(); ctx.moveTo(185, 18); ctx.lineTo(201, 18); ctx.lineTo(198, 8); ctx.lineTo(188, 8); ctx.closePath();
  ctx.fill(); ctx.strokeStyle = '#546e7a'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.restore();

  // progress bar
  const bx = 560, bw = 200;
  ctx.fillStyle = 'rgba(20,30,15,.9)';
  rr(ctx, bx - 8, 6, bw + 20, 30, 8, 'rgba(20,30,15,.9)', '#558b2f', 2);
  ctx.fillStyle = '#4e342e'; rr(ctx, bx, 16, bw, 10, 5, '#4e342e', '#1b1b1b', 1.5);
  const prog = G.totalToSpawn > 0 ? G.spawnedCount / G.totalToSpawn : 0;
  ctx.fillStyle = '#8bc34a';
  if (prog > 0) { rr(ctx, bx, 16, bw * Math.min(1, prog), 10, 5, '#8bc34a', null); }
  ctx.save(); ctx.translate(bx + bw * Math.min(1, prog), 21); ctx.scale(0.5, 0.5);
  Reanim.drawZombie('basic', ctx, 0, 0, G.time, {});
  ctx.restore();
  ctx.fillStyle = '#fff'; ctx.font = 'bold 12px Trebuchet MS'; ctx.textAlign = 'right';
  ctx.fillText(G.levelId ? 'LEVEL ' + G.levelId : '', bx - 14, 27);
  // pause button
  ctx.fillStyle = 'rgba(20,30,15,.9)'; rr(ctx, 772, 8, 22, 22, 5, 'rgba(20,30,15,.9)', '#558b2f', 1.5);
  ctx.fillStyle = '#fff'; ctx.fillRect(779, 13, 4, 12); ctx.fillRect(786, 13, 4, 12);
}

function drawBanners() {
  if (G.levelCardT > 0) {
    ctx.save(); ctx.globalAlpha = Math.min(1, G.levelCardT);
    ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(0, 260, W, 80);
    ctx.fillStyle = '#ffeb3b'; ctx.font = 'bold 34px Trebuchet MS'; ctx.textAlign = 'center';
    ctx.strokeStyle = '#000'; ctx.lineWidth = 5;
    const txt = 'LEVEL ' + G.levelId;
    ctx.strokeText(txt, W / 2, 312); ctx.fillText(txt, W / 2, 312);
    ctx.restore();
  }
  if (G.bannerT > 0 && G.banner) {
    ctx.save(); ctx.globalAlpha = Math.min(1, G.bannerT);
    ctx.fillStyle = 'rgba(120,0,0,.75)'; ctx.fillRect(0, 250, W, 60);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 26px Trebuchet MS'; ctx.textAlign = 'center';
    ctx.strokeStyle = '#000'; ctx.lineWidth = 4;
    ctx.strokeText(G.banner, W / 2, 288); ctx.fillText(G.banner, W / 2, 288);
    ctx.restore();
  }
}

function drawCursor() {
  const x = G.mouse.x, y = G.mouse.y;
  ctx.save();
  if (G.scene === 'play') {
    if (G.selectedPacket && G.shovelMode === false) {
      const pk = G.selectedPacket;
      ctx.globalAlpha = 0.7;
      const col = Math.floor((x - LAWN_X) / TILE_W), row = Math.floor((y - LAWN_Y) / TILE_H);
      if (col >= 0 && col < COLS && row >= 0 && row < ROWS) {
        ctx.fillStyle = 'rgba(255,255,255,.25)';
        ctx.fillRect(LAWN_X + col * TILE_W, LAWN_Y + row * TILE_H, TILE_W, TILE_H);
      }
      ctx.save(); ctx.translate(x, y); ctx.scale(0.8, 0.8);
      Reanim.drawPlant(pk, ctx, 0, 0, G.time, {});
      ctx.restore();
      ctx.globalAlpha = 1;
    } else if (G.shovelMode) {
      ctx.save(); ctx.translate(x, y); ctx.scale(0.9, 0.9);
      ctx.strokeStyle = '#6d4c41'; ctx.lineWidth = 5; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(0, 10); ctx.lineTo(0, -8); ctx.stroke();
      ctx.fillStyle = '#90a4ae';
      ctx.beginPath(); ctx.moveTo(-8, -8); ctx.lineTo(8, -8); ctx.lineTo(5, -20); ctx.lineTo(-5, -20); ctx.closePath();
      ctx.fill(); ctx.strokeStyle = '#546e7a'; ctx.lineWidth = 2; ctx.stroke();
      ctx.restore();
    } else {
      ctx.fillStyle = '#fff59d';
      ctx.beginPath(); ctx.ellipse(x, y, 5, 8, 0.3, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#5d4037'; ctx.lineWidth = 2; ctx.stroke();
    }
  } else {
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 16); ctx.lineTo(x + 5, y + 12); ctx.lineTo(x + 9, y + 19); ctx.lineTo(x + 12, y + 17); ctx.lineTo(x + 8, y + 10); ctx.lineTo(x + 13, y + 10); ctx.closePath();
    ctx.fill(); ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5; ctx.stroke();
  }
  ctx.restore();
}

function render() {
  ctx.save();
  if (G.shake > 0) {
    ctx.translate((Math.random() - 0.5) * G.shake * 20, (Math.random() - 0.5) * G.shake * 20);
  }
  if (G.scene === 'play' || G.scene === 'pause') {
    drawBackground();
    drawGraves();
    drawMowers();
    drawEntities();
    drawProjectiles();
    drawSuns();
    drawItems();
    drawTopBar();
    drawBanners();
  } else {
    drawMenuBackground();
  }
  ctx.restore();
  drawCursor();
}

function drawMenuBackground() {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#6ec6ff'); g.addColorStop(1, '#a5d6a7');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  for (let r = 0; r < ROWS; r++) {
    for (let col = 0; col < COLS; col++) {
      ctx.fillStyle = (r + col) % 2 ? '#7ec850' : '#8fd95f';
      ctx.fillRect(LAWN_X + col * TILE_W, LAWN_Y + r * TILE_H, TILE_W, TILE_H);
    }
  }
  ctx.fillStyle = '#8d6e63'; ctx.fillRect(0, 120, LAWN_X - 6, 300);
  poly(ctx, [[-10, 122], [LAWN_X - 6, 122], [(LAWN_X - 6) / 2, 88]], '#a1887f', '#3e2723', 2);
  // decorative plants
  Reanim.drawPlant('sunflower', ctx, 300, 480, G.time, { scale: 1.2 });
  Reanim.drawPlant('peashooter', ctx, 420, 500, G.time + 1, { scale: 1.2 });
  Reanim.drawPlant('wallnut', ctx, 540, 470, G.time + 2, { scale: 1.2 });
  Reanim.drawZombie('basic', ctx, 680, 520, G.time, { scale: 1.2 });
  Reanim.drawZombie('conehead', ctx, 730, 540, G.time + 3, { scale: 1.2 });
}

// ---------- overlays ----------
const overlays = ['menu', 'levelselect', 'lobby', 'almanac', 'zengarden', 'options', 'pause', 'gameover', 'levelcomplete', 'mpend'];
function showOverlay(id) {
  for (const o of overlays) document.getElementById(o).classList.toggle('hidden', o !== id);
  document.getElementById('chatbox').classList.toggle('hidden', !(G.mp && G.mp.connected));
  document.getElementById('zombiebar').classList.toggle('hidden', !(G.mp && G.mp.connected && G.mp.role === 'zombie'));
}

// ---------- UI wiring ----------
const $ = id => document.getElementById(id);
let currentAdventure = 1;

$('btnAdventure').onclick = () => { Audio2.ensure(); Audio2.sfx('click'); currentAdventure = 1; openLevelSelect(1); };
$('btnMultiplayer').onclick = () => { Audio2.ensure(); Audio2.sfx('click'); Net.openLobby(); };
$('btnAlmanac').onclick = () => { Audio2.sfx('click'); openAlmanac('plants'); };
$('btnZen').onclick = () => { Audio2.sfx('click'); openZen(); };
$('btnOptions').onclick = () => { Audio2.sfx('click'); showOverlay('options'); G.scene = 'options'; };
$('btnQuit').onclick = () => { Audio2.sfx('click'); showOverlay(null); G.scene = 'quit'; };
$('lsBack').onclick = () => { Audio2.sfx('click'); G.scene = 'menu'; showOverlay('menu'); Audio2.playMusic('menu'); };
$('albBack').onclick = () => { Audio2.sfx('click'); G.scene = 'menu'; showOverlay('menu'); };
$('zenBack').onclick = () => { Audio2.sfx('click'); persist(); G.scene = 'menu'; showOverlay('menu'); };
$('optBack').onclick = () => { Audio2.sfx('click'); persist(); G.scene = 'menu'; showOverlay('menu'); };
$('btnResume').onclick = () => togglePause();
$('btnRestart').onclick = () => { Audio2.sfx('click'); startLevel(G.levelId); };
$('btnQuitMenu').onclick = () => { Audio2.sfx('click'); quitToMenu(); };
$('btnGoRestart').onclick = () => { Audio2.sfx('click'); startLevel(G.levelId); };
$('btnGoMenu').onclick = () => { Audio2.sfx('click'); quitToMenu(); };
$('btnLcNext').onclick = () => {
  Audio2.sfx('click');
  const next = nextLevelId(G.levelId);
  if (next) startLevel(next); else { quitToMenu(); }
};
$('btnRematch').onclick = () => { Audio2.sfx('click'); Net.rematch(); };
$('btnMpMenu').onclick = () => { Audio2.sfx('click'); quitToMenu(); };
$('optMusic').value = save.options.music;
$('optSfx').value = save.options.sfx;
$('optMute').checked = save.options.mute;
$('optMusic').oninput = e => { save.options.music = +e.target.value; Audio2.setMusicVol(save.options.music / 100); persist(); };
$('optSfx').oninput = e => { save.options.sfx = +e.target.value; Audio2.setSfxVol(save.options.sfx / 100); persist(); };
$('optMute').onchange = e => { save.options.mute = e.target.checked; Audio2.setMuted(save.options.mute); persist(); };

function nextLevelId(id) {
  const [a, n] = id.split('-').map(Number);
  if (n < 10) return a + '-' + (n + 1);
  if (a === 1) return '2-1';
  return null;
}

function openLevelSelect(adv) {
  currentAdventure = adv;
  G.scene = 'levelselect';
  $('lsTitle').textContent = 'Adventure ' + adv;
  const grid = $('lsGrid');
  grid.innerHTML = '';
  for (let n = 1; n <= 10; n++) {
    const id = adv + '-' + n;
    const done = save.completed[id];
    const unlocked = n === 1 || save.completed[adv + '-' + (n - 1)] || (adv === 2 && n === 1);
    const div = document.createElement('div');
    div.className = 'lvlnode' + (unlocked ? '' : ' locked');
    div.innerHTML = id + (done ? '<br><span class="star">★</span>' : '');
    if (unlocked) div.onclick = () => { Audio2.sfx('click'); startLevel(id); };
    grid.appendChild(div);
  }
  showOverlay('levelselect');
}

let albTab = 'plants';
function openAlmanac(tab) {
  albTab = tab;
  G.scene = 'almanac';
  renderAlmanac();
  showOverlay('almanac');
}
function renderAlmanac() {
  const list = $('albList');
  list.innerHTML = '';
  const defs = albTab === 'plants' ? PLANT_DEFS : ZOMBIE_DEFS;
  for (const [id, d] of Object.entries(defs)) {
    const div = document.createElement('div');
    div.style.cssText = 'display:flex; gap:14px; align-items:center; background:rgba(255,255,255,.06); border-radius:8px; padding:8px; margin:6px 0;';
    const cv = document.createElement('canvas');
    cv.width = 60; cv.height = 60;
    const c = cv.getContext('2d');
    c.translate(30, 55);
    if (albTab === 'plants') Reanim.drawPlant(id, c, 0, 0, G.time, {});
    else Reanim.drawZombie(id, c, 0, 0, G.time, {});
    div.appendChild(cv);
    const txt = document.createElement('div');
    txt.innerHTML = `<b style="color:#aed581">${d.name}</b><br><span style="font-size:13px;">${d.desc}</span>` +
      (albTab === 'plants' && d.cost !== undefined ? `<br><span style="font-size:12px;color:#ffcc80;">Cost: ${d.cost} sun · Recharge: ${d.cd}s · HP: ${d.hp}</span>` : '') +
      (albTab === 'zombies' && d.hp ? `<br><span style="font-size:12px;color:#ef9a9a;">HP: ${d.hp}</span>` : '');
    div.appendChild(txt);
    list.appendChild(div);
  }
}
$('albPlants').onclick = () => { Audio2.sfx('click'); openAlmanac('plants'); };
$('albZombies').onclick = () => { Audio2.sfx('click'); openAlmanac('zombies'); };

const ZEN_PRICES = { sunflower: 50, peashooter: 75, wallnut: 40, puffshroom: 30, marigold: 60, lilypad: 35 };
function openZen() {
  G.scene = 'zengarden';
  renderZen();
  showOverlay('zengarden');
}
function renderZen() {
  $('zenCoins').textContent = 'Coins: ' + save.coins;
  const shop = $('zenShop');
  shop.innerHTML = '';
  for (const [id, price] of Object.entries(ZEN_PRICES)) {
    const b = document.createElement('button');
    b.className = 'btn small';
    b.textContent = `${PLANT_DEFS[id].name} (${price})`;
    b.disabled = save.coins < price;
    b.onclick = () => {
      if (save.coins < price) return;
      const slot = save.zen.findIndex(z => !z);
      if (slot === -1) { alert('All pots are full!'); return; }
      save.coins -= price;
      save.zen[slot] = { type: id, stage: 0, water: 0, coinT: 20 };
      Audio2.sfx('plant');
      persist(); renderZen();
    };
    shop.appendChild(b);
  }
  const pots = $('zenPots');
  pots.innerHTML = '';
  save.zen.forEach((z, i) => {
    const d = document.createElement('div');
    d.style.cssText = 'width:110px; height:130px; background:#6d4c41; border-radius:10px 10px 30px 30px; border:3px solid #4e342e; position:relative; cursor:pointer;';
    if (z) {
      const cv = document.createElement('canvas');
      cv.width = 100; cv.height = 100;
      cv.style.position = 'absolute'; cv.style.bottom = '20px'; cv.style.left = '5px';
      const c = cv.getContext('2d');
      const s = [0.4, 0.7, 1][z.stage];
      c.translate(50, 95); c.scale(s, s);
      Reanim.drawPlant(z.type, c, 0, 0, G.time, {});
      d.appendChild(cv);
      const lbl = document.createElement('div');
      lbl.style.cssText = 'position:absolute; bottom:2px; width:100%; text-align:center; color:#fff; font-size:11px;';
      lbl.textContent = z.stage >= 2 ? '✨ ' + PLANT_DEFS[z.type].name : 'Water me!';
      d.appendChild(lbl);
    } else {
      d.innerHTML = '<div style="position:absolute; bottom:10px; width:100%; text-align:center; color:#a1887f; font-size:12px;">Empty pot</div>';
    }
    d.onclick = () => {
      if (!z) return;
      if (z.stage < 2) {
        z.water++;
        Audio2.sfx('splash');
        if (z.water >= 3) { z.stage++; z.water = 0; Audio2.sfx('pop'); }
        persist(); renderZen();
      }
    };
    pots.appendChild(d);
  });
}
setInterval(() => {
  if (G.scene !== 'zengarden' && G.scene !== 'menu') return;
  let changed = false;
  save.zen.forEach(z => {
    if (z && z.stage >= 2) {
      z.coinT -= 1;
      if (z.coinT <= 0) {
        z.coinT = 30;
        save.coins += 25;
        changed = true;
      }
    }
  });
  if (changed) { persist(); if (G.scene === 'zengarden') renderZen(); }
}, 1000);

function togglePause() {
  if (G.scene !== 'play') return;
  G.paused = !G.paused;
  Audio2.sfx('click');
  if (G.paused) showOverlay('pause');
  else showOverlay(null);
}

function quitToMenu() {
  G.scene = 'menu';
  G.paused = false;
  G.mp = null;
  Net.disconnect();
  showOverlay('menu');
  Audio2.playMusic('menu');
}

// ---------- game over / complete ----------
function onGameOver() {
  setTimeout(() => {
    if (G.gameOver) { G.scene = 'gameover'; showOverlay('gameover'); }
  }, 1500);
}
function onLevelComplete() {
  setTimeout(() => {
    if (!G.levelComplete) return;
    save.completed[G.levelId] = true;
    const reward = G.level.reward;
    let rewardText = 'You earned 100 coins!';
    if (reward) rewardText = `New plant unlocked: ${PLANT_DEFS[reward].name}! You also earned 100 coins.`;
    save.coins += 100;
    persist();
    $('lcReward').textContent = rewardText;
    $('lcCoins').textContent = `Coins: ${save.coins}`;
    G.scene = 'levelcomplete';
    showOverlay('levelcomplete');
  }, 1200);
}

// ---------- main loop ----------
let lastT = 0;
function loop(ts) {
  const dt = Math.min(0.05, (ts - lastT) / 1000 || 0.016);
  lastT = ts;
  G.time += dt;
  if (G.scene === 'play' && !G.paused && !G.gameOver && !G.levelComplete) {
    if (G.levelCardT > 0) G.levelCardT -= dt;
    for (const k in G.cooldowns) {
      if (G.cooldowns[k] > 0) G.cooldowns[k] -= dt;
    }
    updateWaves(dt);
    updatePlants(dt);
    updateZombies(dt);
    updateProjectiles(dt);
    updateSuns(dt);
    updateMowers(dt);
    updateParticles(dt);
    if (G.shake > 0) G.shake -= dt * 1.5;
    if (G.gameOver) onGameOver();
    if (G.levelComplete) onLevelComplete();
    if (G.mp && G.mp.role === 'plant') netSendState();
  }
  if (G.scene === 'play' && G.paused) {
    // frozen
  }
  render();
  requestAnimationFrame(loop);
}

// ---------- multiplayer (client side) ----------
function mpZombieClick(x, y) {
  const col = Math.floor((x - LAWN_X) / TILE_W), row = Math.floor((y - LAWN_Y) / TILE_H);
  if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return;
  if (!G.mp.selectedZombie) { Audio2.sfx('error'); return; }
  Net.requestSpawn(G.mp.selectedZombie, row, col);
}

function netSendEnd(winner) {
  if (!G.mp || G.mp.over) return;
  G.mp.over = true;
  Net.sendEnd(winner, G.stats);
}

let lastStateSent = 0;
function netSendState() {
  if (!G.mp || !G.mp.ws || G.mp.ws.readyState !== 1) return;
  if (G.time - lastStateSent < 0.1) return;
  lastStateSent = G.time;
  const s = {
    t: 'state',
    s: {
      sun: Math.floor(G.sun),
      brains: G.mp.brains,
      zombies: G.zombies.map(z => ({ id: z._id, type: z.type, row: z.row, x: Math.round(z.x), hp: Math.round(z.hp), armor: z.armorMax ? z.armor / z.armorMax : 0, slow: z.slowT > 0, freeze: z.freezeT > 0, hypno: !!z.hypno, eat: z.state === 'eat' })),
      plants: G.plants.map(p => ({ type: p.type, row: p.row, col: p.col, hp: Math.round(p.hp), max: p.maxHp })),
      peas: G.projectiles.filter(p => !p.arc).map(p => ({ kind: p.kind, row: p.row, x: Math.round(p.x), y: Math.round(p.y) })),
      mowers: G.mowers.map(m => ({ row: m.row, x: Math.round(m.x), state: m.state })),
      over: G.gameOver || G.levelComplete,
    },
  };
  G.mp.ws.send(JSON.stringify(s));
}

window.Game = { G, startLevel, spawnZombie, damageZombie, killZombie, addSun, collectSun, tryPlant, save, persist, PLANT_DEFS, ZOMBIE_DEFS, MP_ZOMBIES, netSendEnd, netSendState, mpZombieClick, quitToMenu, showOverlay, Audio2 };

// boot
Audio2.setMusicVol(save.options.music / 100);
Audio2.setSfxVol(save.options.sfx / 100);
Audio2.setMuted(save.options.mute);
showOverlay('menu');
G.scene = 'menu';
G.reanimReady = false;
if (typeof Reanim !== 'undefined' && typeof document !== 'undefined' && typeof fetch === 'function') {
  Reanim.load(() => { G.reanimReady = true; });
}
requestAnimationFrame(loop);
})();
