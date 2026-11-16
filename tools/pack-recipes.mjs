// Packs a recipe collection into js/data/recipes.pack.js in locked form, so it can ship inside
// the app (and this public repository) without being readable by anyone but its owner.
//
//   node tools/pack-recipes.mjs <backup.json> <code>
//
// <backup.json> is a primal backup that contains the library-N recipe sections
// (Settings → Copy backup produces one). <code> is the unlock code the owner types once per
// device. The plain recipes and the code are never committed.
//
// Format: gzip, then AES-256-GCM with a key derived from the code (PBKDF2-SHA-256).
import fs from 'node:fs';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const [file, rawCode] = process.argv.slice(2);
if (!file || !rawCode) {
  console.error('usage: node tools/pack-recipes.mjs <backup.json> <code>');
  process.exit(1);
}
const code = rawCode.toUpperCase().replace(/[^A-Z0-9]/g, '');
if (code.length < 10) {
  console.error('Use a code of at least 10 letters and digits.');
  process.exit(1);
}

const dump = JSON.parse(fs.readFileSync(file, 'utf8'));
const data = {};
let count = 0;
for (const [key, value] of Object.entries(dump.data || {})) {
  if (!/^library-[1-4]$/.test(key)) continue;
  data[key] = value;
  count += value.items.length;
}
if (!count) {
  console.error('That backup has no recipe sections.');
  process.exit(1);
}

const ITERATIONS = 600000;
const plain = zlib.gzipSync(JSON.stringify({ app: 'primal-cookbook', version: 1, data }), { level: 9 });
const salt = crypto.randomBytes(16);
const iv = crypto.randomBytes(12);
const key = crypto.pbkdf2Sync(code, salt, ITERATIONS, 32, 'sha256');
const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
const body = Buffer.concat([cipher.update(plain), cipher.final(), cipher.getAuthTag()]);

const out = fileURLToPath(new URL('../js/data/recipes.pack.js', import.meta.url));
fs.writeFileSync(out, `// The recipe collection, locked. Made by tools/pack-recipes.mjs; opened by js/unlock.js with
// the owner's code. Do not edit by hand.
export const PACK = {
  count: ${count},
  iterations: ${ITERATIONS},
  salt: '${salt.toString('base64')}',
  iv: '${iv.toString('base64')}',
  data: '${body.toString('base64')}',
};
`);
console.log(`packed ${count} recipes into ${out} (${fs.statSync(out).size} bytes)`);
