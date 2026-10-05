// Run from the libra-backend folder:  node apply-patches.mjs libra-patches-2.json
import fs from 'fs';
const patchFile = process.argv[2] || 'libra-patches.json';
const patches = JSON.parse(fs.readFileSync(new URL('./' + patchFile, import.meta.url), 'utf8'));
const merge = (a, b) => { for (const [k, v] of Object.entries(b)) a[k] = v && typeof v === 'object' && !Array.isArray(v) ? merge(a[k] || {}, v) : v; return a; };
let failed = false;
for (const [file, edits] of Object.entries(patches)) {
  if (!fs.existsSync(file)) { console.log(`x ${file} not found (run this from the libra-backend folder)`); failed = true; continue; }
  const src = fs.readFileSync(file, 'utf8');
  let out;
  if (!Array.isArray(edits)) {                       // JSON merge (package.json)
    out = JSON.stringify(merge(JSON.parse(src), edits.merge), null, 2) + '\n';
  } else {
    out = src; let ok = true;
    for (const e of edits) {
      const n = out.split(e.find).length - 1;
      if (n !== 1) { console.log(`x ${file}: "${e.name}" matched ${n} times${n === 0 ? ' (already applied, or the file differs)' : ''}`); ok = false; continue; }
      out = out.replace(e.find, () => e.replace);
    }
    if (!ok) { console.log(`  -> ${file} left untouched\n`); failed = true; continue; }
  }
  fs.copyFileSync(file, file + '.bak');
  fs.writeFileSync(file, out);
  console.log(`ok ${file} updated (backup: ${file}.bak)`);
}
process.exit(failed ? 1 : 0);
