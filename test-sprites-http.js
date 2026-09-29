// Verifies every sprite referenced by reanim-data.json is served over HTTP.
const fs = require('fs');
const path = require('path');
const http = require('http');

const BASE = process.argv[2] || 'http://localhost:3000';
const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'js', 'assets', 'reanim-data.json'), 'utf8'));

const files = new Set();
for (const r of Object.values(data)) for (const f of r.files) files.add(f);
const list = [...files];

function get(p) {
  return new Promise((resolve) => {
    const req = http.get(BASE + p, (res) => {
      let n = 0;
      res.on('data', (c) => { n += c.length; });
      res.on('end', () => resolve({ status: res.statusCode, bytes: n, type: res.headers['content-type'] }));
    });
    req.on('error', (e) => resolve({ status: 0, bytes: 0, type: e.message }));
    req.setTimeout(20000, () => { req.destroy(); resolve({ status: 0, bytes: 0, type: 'timeout' }); });
  });
}

(async () => {
  console.log('checking ' + list.length + ' sprites against ' + BASE);
  let bad = [], total = 0, notPng = [];
  const CONC = 12;
  for (let i = 0; i < list.length; i += CONC) {
    const batch = list.slice(i, i + CONC);
    const res = await Promise.all(batch.map((f) => get('/js/assets/reanim/' + f)));
    batch.forEach((f, j) => {
      const r = res[j];
      total += r.bytes;
      if (r.status !== 200) bad.push(f + ' -> ' + r.status + ' ' + r.type);
      else if (!/image\/png/.test(r.type)) notPng.push(f + ' -> ' + r.type);
    });
  }
  console.log('total sprite bytes: ' + (total / 1048576).toFixed(2) + ' MB');
  console.log('failed: ' + bad.length + (bad.length ? '\n  ' + bad.slice(0, 10).join('\n  ') : ''));
  console.log('wrong content-type: ' + notPng.length + (notPng.length ? '\n  ' + notPng.slice(0, 5).join('\n  ') : ''));
  console.log(bad.length === 0 && notPng.length === 0 ? 'ALL SPRITES SERVED OK' : 'SPRITE CHECK FAILED');
  process.exit(bad.length || notPng.length ? 1 : 0);
})();
