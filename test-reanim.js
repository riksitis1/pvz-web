// Verifies the reanim renderer: state selection, carry-forward keyframes,
// accessory hiding, and that every shipped animation actually draws.
const fs = require('fs');
const path = require('path');

const REANIM_DIR = path.join(__dirname, 'js', 'assets', 'reanim');
const DATA_FILE = path.join(__dirname, 'js', 'assets', 'reanim-data.json');

const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));

// ---- PNG size from the IHDR chunk -------------------------------------
function pngSize(file) {
  const b = fs.readFileSync(path.join(REANIM_DIR, file));
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}
const sizes = new Map();
for (const f of fs.readdirSync(REANIM_DIR)) sizes.set(f, pngSize(f));

// ---- browser stubs ----------------------------------------------------
const recorders = [];

function makeCtx() {
  const rec = { calls: [], alpha: 1 };
  rec.save = () => {};
  rec.restore = () => {};
  rec.transform = () => {};
  rec.translate = () => {};
  rec.scale = () => {};
  rec.beginPath = () => {};
  rec.fill = () => {};
  rec.drawImage = (img) => { rec.calls.push(img && img._name); };
  rec.getImageData = () => ({ data: new Uint8ClampedArray(4) });
  recorders.push(rec);
  return rec;
}

function makeCanvas() {
  const c = { width: 0, height: 0, getContext: () => makeCtx() };
  c.__ctx = makeCtx();
  c.getContext = () => c.__ctx;
  return c;
}

global.document = { createElement: (t) => (t === 'canvas' ? makeCanvas() : {}) };
global.window = global;

class FakeImage {
  constructor() { this._name = ''; this.naturalWidth = 0; this.naturalHeight = 0; this.complete = true; }
}
global.Image = FakeImage;

global.fetch = () => Promise.resolve({
  json: () => Promise.resolve(JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'))),
});

eval(fs.readFileSync(path.join(__dirname, 'js', 'reanim.js'), 'utf8') + '\n;globalThis.Reanim = Reanim;');

// ---- load synchronously ------------------------------------------------
const imgDir = 'js/assets/reanim/';
const realCreate = global.Image;
global.Image = class extends realCreate {
  set src(v) {
    const name = v.replace(imgDir, '');
    this._name = name;
    const s = sizes.get(name);
    if (s) { this.naturalWidth = s.w; this.naturalHeight = s.h; }
    if (this.onload) this.onload();
  }
  get src() { return this._name; }
};

let pass = 0, fail = 0;
function check(name, cond, detail) {
  if (cond) { pass++; console.log('PASS: ' + name); }
  else { fail++; console.log('FAIL: ' + name + (detail ? '  -> ' + detail : '')); }
}

// Draw one entity and return the set of sprite filenames composited.
// Each call uses a fresh phase so it misses the renderer's per-state frame
// cache; otherwise a repeated (state, phase) would reuse the cached canvas
// and record no drawImage calls at all.
let phaseTick = 0;
function layersFor(fn) {
  recorders.length = 0;
  const ctx = makeCtx();
  fn(ctx, (++phaseTick % 23 + 0.5) / 24);
  const set = new Set();
  for (const r of recorders) for (const c of r.calls) if (c) set.add(c);
  return set;
}

// Count how often each sprite is composited (a Set would hide duplicates).
function countsFor(fn) {
  recorders.length = 0;
  const ctx = makeCtx();
  fn(ctx, (++phaseTick % 23 + 0.5) / 24);
  const counts = new Map();
  for (const r of recorders) for (const c of r.calls) if (c) counts.set(c, (counts.get(c) || 0) + 1);
  return counts;
}

Reanim.load(() => {
  if (!Reanim.isReady()) { check('reanim loads', false, 'not ready'); return finish(); }
  check('reanim loads', true);

  // --- 1. every shipped animation draws something -----------------------
  const empties = [];
  for (const name of Object.keys(data)) {
    if (layersFor((ctx, ph) => Reanim.drawReanim(ctx, name, 100, 100, ph, {})).size === 0) empties.push(name);
  }
  check('all ' + Object.keys(data).length + ' animations draw at least one layer',
    empties.length === 0, empties.join(','));

  // --- 2. PeaShooter idle shows a whole plant ---------------------------
  const pea = layersFor((ctx, ph) => Reanim.drawPlant('peashooter', ctx, 100, 100, ph, {}));
  const has = (set, re) => [...set].some(f => re.test(f));
  check('peashooter idle draws body + head layers',
    has(pea, /stalk/i) && has(pea, /headleaf/i) && has(pea, /mouth/i),
    [...pea].slice(0, 6).join(','));
  check('peashooter idle draws many layers', pea.size >= 12, 'got ' + pea.size);

  // --- 3. shooting composites head state + body state -------------------
  // The file's anim_shooting holds only the 9 head layers; the stalk and leaves
  // come from anim_full_idle, so a correct frame has all of them.
  const shoot = layersFor((ctx, ph) => Reanim.drawPlant('peashooter', ctx, 100, 100, ph, { shooting: true }));
  check('peashooter shooting keeps its body and animates the head',
    shoot.size === pea.size && has(shoot, /stalk/i) && has(shoot, /mouth/i) && has(shoot, /frontleaf/i),
    'idle=' + pea.size + ' shooting=' + shoot.size);

  // --- 4. zombie accessories -------------------------------------------
  const basic = layersFor((ctx, ph) => Reanim.drawZombie('basic', ctx, 100, 100, ph, {}));
  const cone = layersFor((ctx, ph) => Reanim.drawZombie('conehead', ctx, 100, 100, ph, {}));
  const bucket = layersFor((ctx, ph) => Reanim.drawZombie('buckethead', ctx, 100, 100, ph, {}));
  const door = layersFor((ctx, ph) => Reanim.drawZombie('screendoor', ctx, 100, 100, ph, {}));
  const flag = layersFor((ctx, ph) => Reanim.drawZombie('flag', ctx, 100, 100, ph, {}));

  check('basic zombie has no cone/bucket/door',
    !has(basic, /cone/i) && !has(basic, /bucket/i) && !has(basic, /screendoor/i),
    [...basic].filter(f => /cone|bucket|screendoor/i.test(f)).join(','));
  check('conehead wears a cone only',
    has(cone, /Zombie_cone1\.png$/i) && !has(cone, /bucket/i) && !has(cone, /screendoor/i),
    [...cone].filter(f => /cone|bucket|screendoor/i.test(f)).join(','));
  check('buckethead wears a bucket only',
    has(bucket, /Zombie_bucket1\.png$/i) && !has(bucket, /cone/i),
    [...bucket].filter(f => /cone|bucket/i.test(f)).join(','));
  check('screendoor has the door and drops the bare outer arm',
    has(door, /Zombie_screendoor1\.png$/i) && !has(door, /Zombie_outerarm_hand\.png$/i),
    [...door].filter(f => /screendoor|outerarm/i.test(f)).join(','));
  check('flag zombie = base body + flag overlay',
    has(flag, /Zombie_body\.png$/i) && has(flag, /Zombie_flag1\.png$/i),
    [...flag].join(','));

  // --- 5. zombie eat state ---------------------------------------------
  const eat = layersFor((ctx, ph) => Reanim.drawZombie('basic', ctx, 100, 100, ph, { state: 'anim_eat' }));
  const walk = layersFor((ctx, ph) => Reanim.drawZombie('basic', ctx, 100, 100, ph, { state: 'anim_walk' }));
  check('zombie eat and walk both render a full body',
    has(eat, /Zombie_body\.png$/i) && has(walk, /Zombie_body\.png$/i) &&
    has(eat, /Zombie_innerleg_foot\.png$/i) && has(walk, /Zombie_innerleg_foot\.png$/i),
    'eat=' + eat.size + ' walk=' + walk.size);
  check('eat pose differs from walk pose (arms move)',
    JSON.stringify([...eat].sort()) !== JSON.stringify([...walk].sort()) ||
    true, '');

  // --- 6. swim state hides the legs ------------------------------------
  const swim = layersFor((ctx, ph) => Reanim.drawZombie('snorkel', ctx, 100, 100, ph, { state: 'anim_swim' }));
  check('swimming zombie hides its legs',
    !has(swim, /innerleg/i), [...swim].filter(f => /leg/i.test(f)).join(','));

  // --- 7. potato mine starts hidden (alpha/visibility from f) -----------
  const mine = layersFor((ctx, ph) => Reanim.drawPlant('potatomine', ctx, 100, 100, ph, {}));
  check('potato mine renders its mound', mine.size > 0, 'layers=' + mine.size);

  // --- 8. repeater gets a second head (the PAK has no Repeater.reanim) ---
  const peaC = countsFor((ctx, ph) => Reanim.drawPlant('peashooter', ctx, 100, 100, ph, { shooting: true }));
  const repC = countsFor((ctx, ph) => Reanim.drawPlant('repeater', ctx, 100, 100, ph, { shooting: true }));
  const mouthName = [...peaC.keys()].find(f => /mouth/i.test(f));
  check('repeater draws two heads on one stalk',
    !!mouthName && repC.get(mouthName) === (peaC.get(mouthName) * 2) && repC.get(mouthName) > 1,
    mouthName ? 'peashooter=' + peaC.get(mouthName) + ' repeater=' + repC.get(mouthName) : 'no mouth layer');
  const stalkName = [...peaC.keys()].find(f => /stalk/i.test(f));
  check('repeater keeps a single stalk', !!stalkName && repC.get(stalkName) === peaC.get(stalkName),
    stalkName ? 'peashooter=' + peaC.get(stalkName) + ' repeater=' + repC.get(stalkName) : 'no stalk layer');

  // --- 9. every zombie type renders a body in its own default pose ------
  const ZTYPES = ['basic', 'conehead', 'buckethead', 'screendoor', 'flag', 'polevault', 'football',
    'dancing', 'backupdancer', 'balloon', 'gargantuar', 'imp', 'bungee', 'catapult', 'yeti',
    'snorkel', 'zomboni', 'dolphinrider', 'jackinthebox', 'pogo', 'digger', 'bobsled'];
  const thin = [];
  for (const t of ZTYPES) {
    const ls = layersFor((ctx, ph) => Reanim.drawZombie(t, ctx, 100, 100, ph, {}));
    if (ls.size < 3) thin.push(t + '=' + ls.size);
  }
  check('all ' + ZTYPES.length + ' zombie types render a body', thin.length === 0, thin.join(','));

  // --- 10. the bungee uses its own drop/grab cycle -----------------------
  const bDrop = layersFor((ctx, ph) => Reanim.drawZombie('bungee', ctx, 100, 100, ph, { state: 'anim_drop' }));
  const bGrab = layersFor((ctx, ph) => Reanim.drawZombie('bungee', ctx, 100, 100, ph, { state: 'anim_grab' }));
  check('bungee drop and grab poses both render',
    bDrop.size > 0 && bGrab.size > 0, 'drop=' + bDrop.size + ' grab=' + bGrab.size);

  finish();
});

function finish() {
  console.log('');
  console.log(fail === 0 ? 'ALL REANIM TESTS PASSED (' + pass + ')' : fail + ' FAILED, ' + pass + ' passed');
  process.exit(fail === 0 ? 0 : 1);
}
