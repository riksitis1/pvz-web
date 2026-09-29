const fs = require('fs');
const code = fs.readFileSync(__dirname + '/js/levels.js', 'utf8');
const test = `
console.log('2-1:', packetsForLevel('2-1'));
console.log('2-10:', packetsForLevel('2-10'));
console.log('1-1:', packetsForLevel('1-1'));
let errs = [];
for (const [id, L] of Object.entries(LEVELS)) {
  for (const p of L.packets) if (!PLANT_DEFS[p]) errs.push(id + ': bad packet ' + p);
  if (L.reward && !PLANT_DEFS[L.reward]) errs.push(id + ': bad reward ' + L.reward);
  for (const w of L.waves) for (const [z] of w.spawns) if (!ZOMBIE_DEFS[z]) errs.push(id + ': bad zombie ' + z);
  if (!L.theme) errs.push(id + ': no theme');
}
for (const z of MP_ZOMBIES) if (!ZOMBIE_DEFS[z]) errs.push('MP bad zombie ' + z);
const all = new Set();
for (let i = 1; i <= 10; i++) { LEVELS['1-'+i].packets.forEach(p => all.add(p)); LEVELS['2-'+i].packets.forEach(p => all.add(p)); }
for (const p of Object.keys(PLANT_DEFS)) if (!all.has(p)) errs.push('plant never unlocked: ' + p);
console.log(errs.length ? errs.join('\\n') : 'LEVEL DATA OK - ' + Object.keys(LEVELS).length + ' levels, ' + all.size + ' plants unlockable');
`;
eval(code + test);
