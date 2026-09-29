const fs = require('fs');
const path = require('path');

const pakPath = process.argv[2];
const outDir = process.argv[3];
if (!pakPath || !outDir) { console.error('Usage: node unpack-pak.js <pak> <outdir>'); process.exit(1); }

const buf = fs.readFileSync(pakPath);
const dec = Buffer.alloc(buf.length);
for (let i = 0; i < buf.length; i++) dec[i] = buf[i] ^ 0xF7;

const magic = dec.readBigUInt64LE(0);
if (magic !== 0xBAC04AC0n) { console.error('Bad magic: ' + magic.toString(16)); process.exit(1); }
console.log('magic OK');

let pos = 8;
const files = [];
let dataStart = 0;
while (pos < dec.length) {
  const flags = dec[pos++];
  if (flags & 0x80) break;
  const nameWidth = dec[pos++];
  const name = dec.toString('latin1', pos, pos + nameWidth);
  pos += nameWidth;
  const srcSize = dec.readInt32LE(pos); pos += 4;
  pos += 8; // filetime
  files.push({ name, size: srcSize, offset: dataStart });
  dataStart += srcSize;
}
console.log('files:', files.length, 'metadata ends at', pos, 'data section:', dataStart, 'bytes');

fs.mkdirSync(outDir, { recursive: true });
const extCount = {};
for (const f of files) {
  const ext = path.extname(f.name).toLowerCase() || '(none)';
  extCount[ext] = (extCount[ext] || 0) + 1;
  const outPath = path.join(outDir, f.name);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, dec.slice(pos + f.offset, pos + f.offset + f.size));
}
console.log('extensions:', JSON.stringify(extCount, null, 2));
const bySize = files.slice().sort((a, b) => b.size - a.size).slice(0, 25);
console.log('largest files:');
for (const f of bySize) console.log('  ' + f.size.toString().padStart(9) + '  ' + f.name);
