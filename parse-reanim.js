const fs = require('fs');
const path = require('path');

const reanimDir = process.argv[2];
const mapFile = process.argv[3];
const outFile = process.argv[4];

const map = JSON.parse(fs.readFileSync(mapFile, 'utf8'));
const constToFile = map.constToFile;

function parseReanim(content) {
  const fps = parseFloat((content.match(/<fps>([^<]+)<\/fps>/) || [])[1] || '12');
  const tracks = [];
  const trackRe = /<track>([\s\S]*?)<\/track>/g;
  let m;
  while ((m = trackRe.exec(content))) {
    const trackXml = m[1];
    const name = (trackXml.match(/<name>([^<]*)<\/name>/) || [])[1] || '';
    const raw = [];
    const tRe = /<t>([\s\S]*?)<\/t>/g;
    let tm;
    while ((tm = tRe.exec(trackXml))) {
      const k = tm[1];
      const get = (tag) => {
        const r = k.match(new RegExp('<' + tag + '>([^<]*)</' + tag + '>'));
        return r ? parseFloat(r[1]) : null;
      };
      const img = (k.match(/<i>([^<]*)<\/i>/) || [])[1] || null;
      raw.push({
        f: get('f'), x: get('x'), y: get('y'),
        sx: get('sx'), sy: get('sy'), kx: get('kx'), ky: get('ky'),
        a: get('a'), img
      });
    }
    // Reanim keyframes are sparse deltas: any property not present inherits the
    // previous keyframe's value. Bake that inheritance in so the renderer can
    // interpolate plain numbers.
    //
    // Defaults matter: a track is VISIBLE until an explicit <f>-1 hides it.
    // Zombie_body, for example, declares no <f> before frame 451, yet it is on
    // screen for the whole walk cycle. Starting from f=-1 hid every sprite.
    const keyframes = [];
    let cur = { f: 0, x: 0, y: 0, sx: 1, sy: 1, kx: 0, ky: 0, a: 1, img: null, file: null };
    for (const r of raw) {
      cur = {
        f: r.f !== null ? r.f : cur.f,
        x: r.x !== null ? r.x : cur.x,
        y: r.y !== null ? r.y : cur.y,
        sx: r.sx !== null ? r.sx : cur.sx,
        sy: r.sy !== null ? r.sy : cur.sy,
        kx: r.kx !== null ? r.kx : cur.kx,
        ky: r.ky !== null ? r.ky : cur.ky,
        a: r.a !== null ? r.a : cur.a,
        img: r.img !== null ? r.img : cur.img,
        file: null
      };
      if (cur.img && constToFile[cur.img]) cur.file = constToFile[cur.img];
      keyframes.push(cur);
    }
    tracks.push({ name, loopLen: raw.length, keyframes });
  }
  return { fps, tracks };
}

const result = {};
for (const f of fs.readdirSync(reanimDir).filter(f => f.endsWith('.reanim'))) {
  const content = fs.readFileSync(path.join(reanimDir, f), 'utf8');
  result[f.replace('.reanim', '')] = parseReanim(content);
}

fs.writeFileSync(outFile, JSON.stringify(result));
console.log('parsed', Object.keys(result).length, 'reanim files');
const sample = result['PeaShooter'];
if (sample) {
  console.log('PeaShooter tracks:', sample.tracks.map(t => t.name).join(', '));
  console.log('fps:', sample.fps);
}
