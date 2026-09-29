const fs = require('fs');
const path = require('path');

const reanimDir = process.argv[2];
const outFile = process.argv[3];

const pngFiles = fs.readdirSync(reanimDir).filter(f => f.endsWith('.png'));
// map lowercased basename -> real filename on disk, so we never invent names
const realByLower = new Map(pngFiles.map(f => [f.toLowerCase(), f]));

const ORDINAL = [['1st', '1rd'], ['2nd', '2rd'], ['3rd', '3nd'], ['4th', '4dh'], ['5th', '5dh']];

// All single-token typos/synonyms seen in the shipped PvZ asset names.
function variants(s) {
  const out = new Set([s]);
  for (const [a, b] of ORDINAL) {
    if (s.includes(a)) out.add(s.replace(a, b));
    if (s.includes(b)) out.add(s.replace(b, a));
  }
  return [...out];
}

// Cheap edit distance so near-miss names (e.g. 2NDFARTHEST vs 2rdfarthest) resolve.
function editDistance(a, b) {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  if (Math.abs(m - n) > 3) return 99;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
    prev = cur;
  }
  return prev[n];
}

function resolve(suffix) {
  const stripped = suffix.replace(/_/g, '');
  const words = suffix.split('_');
  const title = words.map(w => w[0] + w.slice(1).toLowerCase()).join('');
  const direct = [suffix + '.png', stripped + '.png', title + '.png'];
  for (const cand of direct) {
    const hit = realByLower.get(cand.toLowerCase());
    if (hit) return hit;
  }
  // ordinal typo variants, still exact apart from the ordinal token
  for (const v of variants(suffix)) {
    const hit = realByLower.get((v + '.png').toLowerCase());
    if (hit) return hit;
  }
  // last resort: closest filename by edit distance
  const target = (suffix + '.png').toLowerCase();
  let best = null, bestD = 99;
  for (const [lower, real] of realByLower) {
    const d = editDistance(target, lower);
    if (d < bestD) { bestD = d; best = real; }
  }
  return bestD <= 2 ? best : null;
}

const constToFile = {};
const unmapped = new Set();
const fuzzy = [];
const fromManifest = [];

// Authoritative source: properties/resources.xml maps each image id to its path.
// It only covers the preload manifest, so it is used first and the name-based
// resolver fills in the rest.
let manifest = {};
const resXml = path.join(path.dirname(reanimDir), 'properties', 'resources.xml');
if (fs.existsSync(resXml)) {
  const xml = fs.readFileSync(resXml, 'utf8');
  let dir = '', prefix = '';
  for (const t of xml.match(/<SetDefaults[^>]*>|<Image\b[^>]*\/?>/g) || []) {
    if (t.startsWith('<SetDefaults')) {
      const dm = t.match(/path="([^"]*)"/);
      const pm = t.match(/idprefix="([^"]*)"/);
      if (dm) dir = dm[1];
      if (pm) prefix = pm[1];
      continue;
    }
    const id = t.match(/id="([^"]*)"/);
    const p = t.match(/path="([^"]*)"/);
    if (id && p) manifest[prefix + id[1]] = { dir, path: p[1] };
  }
  console.log('resources.xml entries:', Object.keys(manifest).length);
}

for (const f of fs.readdirSync(reanimDir).filter(f => f.endsWith('.reanim'))) {
  const content = fs.readFileSync(path.join(reanimDir, f), 'utf8');
  const consts = content.match(/IMAGE_REANIM_[A-Z0-9_]+/g) || [];
  for (const c of new Set(consts)) {
    if (constToFile[c]) continue;
    const suffix = c.replace('IMAGE_REANIM_', '');
    const m = manifest[c];
    if (m && m.dir === 'reanim') {
      const real = realByLower.get((m.path + '.png').toLowerCase());
      if (real) { constToFile[c] = real; fromManifest.push(c); continue; }
    }
    const found = resolve(suffix);
    if (found) {
      constToFile[c] = found;
      if (found.toLowerCase() !== (suffix + '.png').toLowerCase()) {
        fuzzy.push(c.replace('IMAGE_REANIM_', '') + ' -> ' + found);
      }
    } else {
      unmapped.add(c);
    }
  }
}

const map = { constToFile, unmapped: [...unmapped], pngFiles };
fs.writeFileSync(outFile, JSON.stringify(map, null, 2));
console.log('mapped:', Object.keys(constToFile).length, '| from resources.xml:', fromManifest.length, '| by name:', fuzzy.length, '| unmapped:', unmapped.size);
for (const x of fuzzy) console.log('  byname: ' + x);
if (unmapped.size) console.log('unmapped:', [...unmapped]);
