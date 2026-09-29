const fs = require('fs');
const path = require('path');

// node copy-assets.js <pakOutDir> <reanimDataJson> [outDir]
// <pakOutDir>    root of the unpacked PAK (the folder holding `reanim`)
// <reanimDataJson>  output of parse-reanim.js
// [outDir]       destination for the sprite layers (default js/assets/reanim)
const pakOutDir = process.argv[2];
const dataFile = process.argv[3];
const outDir = process.argv[4] || path.join(__dirname, 'js', 'assets', 'reanim');

if (!pakOutDir || !dataFile) {
  console.error('usage: node copy-assets.js <pakOutDir> <reanimDataJson> [outDir]');
  process.exit(1);
}
const reanimDir = path.join(pakOutDir, 'reanim');
if (!fs.existsSync(reanimDir)) {
  console.error('no reanim folder in ' + pakOutDir + ' (run unpack-pak.js first)');
  process.exit(1);
}
const data = JSON.parse(fs.readFileSync(dataFile, 'utf8'));

const needed = {
  sunflower: 'SunFlower', peashooter: 'PeaShooter', cherrybomb: 'CherryBomb', wallnut: 'Wallnut',
  potatomine: 'PotatoMine', snowpea: 'SnowPea', chomper: 'Chomper', repeater: 'PeaShooter',
  puffshroom: 'PuffShroom', sunshroom: 'SunShroom', fumeshroom: 'FumeShroom', gravebuster: 'Gravebuster',
  hypnoshroom: 'HypnoShroom', scaredyshroom: 'ScaredyShroom', iceshroom: 'IceShroom', doomshroom: 'DoomShroom',
  lilypad: 'LilyPad', squash: 'Squash', threepeater: 'ThreePeater', tanglekelp: 'Tanglekelp',
  jalapeno: 'Jalapeno', spikewalk: 'SpikeRock', torchwood: 'Torchwood', tallnut: 'Tallnut',
  seashroom: 'SeaShroom', plantern: 'Plantern', cactus: 'Cactus', blover: 'Blover',
  splitpea: 'SplitPea', starfruit: 'Starfruit', pumpkin: 'Pumpkin', magnetshroom: 'Magnetshroom',
  cabbagepult: 'Cabbagepult', kernelpult: 'Cornpult', coffeebean: 'Coffeebean', umbrellaleaf: 'Umbrellaleaf',
  marigold: 'Marigold', melonpult: 'Melonpult', gatlingpea: 'GatlingPea', twinsunflower: 'TwinSunflower',
  wintermelon: 'WinterMelon', goldmagnet: 'GoldMagnet', imitater: 'Imitater',
  basic: 'Zombie', conehead: 'Zombie', buckethead: 'Zombie', flag: 'Zombie_flagpole',
  polevault: 'Zombie_polevaulter', football: 'Zombie_football', dancing: 'Zombie_dancer',
  backupdancer: 'Zombie_backup', balloon: 'Zombie_balloon', screendoor: 'Zombie',
  gargantuar: 'Zombie_gargantuar', imp: 'Zombie_imp', bungee: 'Zombie_bungi',
  catapult: 'Zombie_catapult', yeti: 'Zombie_yeti', snorkel: 'Zombie_snorkle',
  zomboni: 'Zombie_zamboni', dolphinrider: 'Zombie_dolphinrider', jackinthebox: 'Zombie_jackbox',
  pogo: 'Zombie_pogo', digger: 'Zombie_digger', bobsled: 'Zombie_bobsled',
};

const files = new Set();
for (const [id, reanimName] of Object.entries(needed)) {
  const r = data[reanimName];
  if (!r) { console.log('MISSING reanim:', reanimName); continue; }
  for (const track of r.tracks) {
    for (const kf of track.keyframes) {
      if (kf.file) files.add(kf.file);
    }
  }
}
console.log('unique sprite files:', files.size);

fs.mkdirSync(outDir, { recursive: true });
for (const f of fs.readdirSync(outDir)) fs.unlinkSync(path.join(outDir, f));
let copied = 0;
const missingFiles = [];
for (const f of files) {
  const src = path.join(reanimDir, f);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, path.join(outDir, f));
    copied++;
  } else {
    missingFiles.push(f);
  }
}
console.log('copied:', copied);
if (missingFiles.length) console.log('MISSING files:', missingFiles);

// Derive the animation state map at build time.
//
// Reanim files hold one long timeline. "anim_*" tracks are controllers: each is
// switched on for a contiguous frame range that corresponds to one game state
// (PeaShooter: anim_full_idle 79-103, anim_shooting 54-78, ...). The drawing
// tracks are only on-screen for the states they belong to, so we record which
// states each track participates in plus a fallback state. At runtime a track
// that is not part of the requested state holds its fallback pose, which is how
// e.g. the PeaShooter keeps a static body while its head recoils on a shot.
function visibleRanges(track) {
  const out = [];
  let start = null;
  for (let i = 0; i < track.keyframes.length; i++) {
    const on = track.keyframes[i].f >= 0;
    if (on && start === null) start = i;
    if (!on && start !== null) { out.push([start, i - 1]); start = null; }
  }
  if (start !== null) out.push([start, track.keyframes.length - 1]);
  return out;
}

// A track participates in a state when it stays on screen for that state's
// whole frame range.
const covers = (ranges, s, e) => ranges.some(r => r[0] <= s && r[1] >= e);

const FALLBACK_PREFERENCE = ['anim_full_idle', 'anim_idle', 'anim_walk', 'anim_idle2', 'anim_head_idle'];

// Most state drivers carry no image (PeaShooter's anim_shooting, Zombie's
// anim_walk), but some plants do draw through them (SunFlower's anim_idle
// includes the flower head), so match on the name as well.
const STATE_NAME = /^(?:_ground|anim_(?:full_)?(?:idle|walk|eat|death|swim|shoot\w*|dance|drive|waterdeath|superlongdeath|appear|disappear|head_idle|stem|run|fly|spin|duck|rise|fall))$/;

const r2 = n => Math.round(n * 1000) / 1000;
const outData = {};
let kfTotal = 0, trackTotal = 0, stateTotal = 0;

for (const name of new Set(Object.values(needed))) {
  const r = data[name];
  if (!r) continue;

  const maxLen = Math.max(...r.tracks.map(t => t.keyframes.length));
  const controllers = [];
  for (const t of r.tracks) {
    if (t.keyframes.some(k => k.file) && !STATE_NAME.test(t.name)) continue;
    const ranges = visibleRanges(t);
    if (ranges.length) controllers.push({ name: t.name, ranges });
  }
  const states = {};
  for (const c of controllers) {
    // A controller with several disjoint runs is driven directly by the game.
    states[c.name] = c.ranges.length === 1
      ? c.ranges[0]
      : c.ranges.map(([s, e]) => [s, e, e - s + 1]);
  }
  // Pure-overlay reanim (Zombie_flagpole) has no state tracks at all: play the
  // whole timeline instead.
  const fallbackAll = !Object.keys(states).length;
  if (fallbackAll) states._all = [0, maxLen - 1];
  stateTotal += Object.keys(states).length;

  const fileIndex = new Map();
  const tracks = [];
  for (const t of r.tracks) {
    if (!t.keyframes.some(k => k.file)) continue;
    const tRanges = visibleRanges(t);
    // A track belongs to a state when it stays on for that whole state range.
    const st = [];
    let def = null;
    for (const c of controllers) {
      for (const [s, e] of c.ranges) {
        if (!covers(tRanges, s, e)) continue;
        if (!st.includes(c.name)) st.push(c.name);
        // Fallback = the state's pose this track holds when the game asks for a
        // state it does not belong to. Prefer the "complete body" idle.
        const rank = FALLBACK_PREFERENCE.indexOf(c.name);
        const defRank = def === null ? 99 : FALLBACK_PREFERENCE.indexOf(def);
        if (rank !== -1 && rank < defRank) def = c.name;
      }
    }
    if (def === null && st.length) def = st[0];
    if (fallbackAll) { st.length = 0; st.push('_all'); def = '_all'; }
    const k = t.keyframes.map(kf => {
      if (!kf.file) return [kf.f, r2(kf.x), r2(kf.y), r2(kf.sx), r2(kf.sy), r2(kf.kx), r2(kf.ky), r2(kf.a), -1];
      if (!fileIndex.has(kf.file)) fileIndex.set(kf.file, fileIndex.size);
      return [kf.f, r2(kf.x), r2(kf.y), r2(kf.sx), r2(kf.sy), r2(kf.kx), r2(kf.ky), r2(kf.a), fileIndex.get(kf.file)];
    });
    tracks.push({ n: t.name, len: k.length, d: def || '', s: st, k });
    kfTotal += k.length;
  }
  trackTotal += tracks.length;
  outData[name] = { fps: r.fps, files: [...fileIndex.keys()], states, tracks };
}

const outPath = path.join(__dirname, 'js', 'assets', 'reanim-data.json');
fs.writeFileSync(outPath, JSON.stringify(outData));
console.log('reanim data:', Object.keys(outData).length, 'entries,', trackTotal, 'tracks,',
  stateTotal, 'states,', kfTotal, 'keyframes,', fs.statSync(outPath).size, 'bytes');
