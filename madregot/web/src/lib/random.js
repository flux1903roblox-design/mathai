/** `bytes` random bytes as lowercase hex (crypto.getRandomValues): ids for this device, an answer, a request. */
export function randomHex(bytes) {
  return [...crypto.getRandomValues(new Uint8Array(bytes))].map((b) => b.toString(16).padStart(2, '0')).join('');
}
