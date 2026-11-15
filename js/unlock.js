// Opens the recipe collection that ships with the app in locked form (js/data/recipes.pack.js).
// The owner types their code once per device; the recipes are then kept with their other entries.

import { PACK } from './data/recipes.pack.js';

export const packCount = PACK && PACK.data ? PACK.count : 0;

const bytes = b64 => Uint8Array.from(atob(b64), c => c.charCodeAt(0));

/** Resolves with a backup-shaped object holding the recipe sections. Rejects if the code is wrong. */
export async function unlock(code) {
  const clean = String(code).toUpperCase().replace(/[^A-Z0-9]/g, '');
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(clean), 'PBKDF2', false, ['deriveKey']);
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: bytes(PACK.salt), iterations: PACK.iterations, hash: 'SHA-256' },
    material, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
  const zipped = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes(PACK.iv) }, key, bytes(PACK.data));
  const stream = new Blob([zipped]).stream().pipeThrough(new DecompressionStream('gzip'));
  return JSON.parse(await new Response(stream).text());
}
