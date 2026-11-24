// The vault's cryptography (DURABLE-5, crypto.js), on Node's WebCrypto and CompressionStream (the browser's API): a
// round trip, every way a sealed copy can fail to open, the derivation, and that a heavy year fits the server's limit.
import { describe, it, expect } from 'vitest';
import { derive, seal, open, VaultOpenError, toBase64url, fromBase64url, blobBytes, sha256Hex, ITERATIONS } from './crypto.js';
import { makeCode } from './code.js';
import { heavyYear } from './testing.js';
import { migrate } from './migrations.js';
import { snapshotForBackup } from './payload.js';
import { CURRENT_VERSION } from './migrations.js';

const CODE = 'ABCDEFGHJKMNPQR' + 'S'; // the shape of a code (the check symbol does not matter to the cryptography)
const payload = { v: 1, at: '2026-11-05T10:00:00.000Z', schema: 5, rev: 3, state: { profile: { name: 'נועה' }, xp: 260 } };

describe('derive', () => {
  it('is deterministic: the same code gives the same 64-hex lookup token and a key that opens what the other sealed', async () => {
    const a = await derive(CODE);
    expect(a.lookup).toMatch(/^[0-9a-f]{64}$/);
    expect(a.key.type).toBe('secret');
    expect(a.key.extractable).toBe(false);
    expect(a.key.algorithm).toMatchObject({ name: 'AES-GCM', length: 256 });
    // a fresh derivation (not the cached one) of the same code
    const { webcrypto } = await import('node:crypto');
    const base = await webcrypto.subtle.importKey('raw', new TextEncoder().encode(CODE), 'PBKDF2', false, ['deriveBits']);
    const bits = new Uint8Array(await webcrypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: new TextEncoder().encode('madregot-vault-v1'), iterations: ITERATIONS }, base, 512));
    expect(a.lookup).toBe(Buffer.from(bits.slice(32)).toString('hex'));
    expect(ITERATIONS).toBe(100_000);
    expect(await derive(CODE)).toBe(a); // once per code in a session
    const other = await derive(makeCode());
    expect(other.lookup).not.toBe(a.lookup);
  });
});

describe('seal and open', () => {
  it('a round trip: version byte 1, a 12-byte IV, a different blob every time', async () => {
    const { key } = await derive(CODE);
    const blob = await seal(payload, key);
    expect(blob).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(fromBase64url(blob)[0]).toBe(1);
    expect(await open(blob, key)).toEqual(payload);
    expect(await seal(payload, key)).not.toBe(blob);
  });

  it('a wrong code cannot open it', async () => {
    const blob = await seal(payload, (await derive(CODE)).key);
    await expect(open(blob, (await derive(makeCode())).key)).rejects.toBeInstanceOf(VaultOpenError);
  });

  it('one flipped byte anywhere fails it (AES-GCM authenticates every byte)', async () => {
    const { key } = await derive(CODE);
    const bytes = fromBase64url(await seal(payload, key));
    for (const at of [1, 12, 13, bytes.length - 1]) {
      const bad = bytes.slice(); bad[at] ^= 0x01;
      await expect(open(toBase64url(bad), key)).rejects.toBeInstanceOf(VaultOpenError);
    }
    const unknown = bytes.slice(); unknown[0] = 2;
    await expect(open(toBase64url(unknown), key)).rejects.toThrow('unknown format');
  });

  it('a different additional data (another format version) fails it', async () => {
    const { key } = await derive(CODE);
    const blob = await seal(payload, key, { aad: 'madregot-vault-v2' });
    await expect(open(blob, key)).rejects.toBeInstanceOf(VaultOpenError);
    expect(await open(blob, key, { aad: 'madregot-vault-v2' })).toEqual(payload);
  });

  it('anything that is not a sealed copy fails the same way', async () => {
    const { key } = await derive(CODE);
    for (const bad of ['', 'AAAA', 'not base64!', null, 42]) await expect(open(bad, key)).rejects.toBeInstanceOf(VaultOpenError);
  });

  it('the council\'s heavy year seals to less than 256 KiB (gzip before encryption)', async () => {
    const { key } = await derive(CODE);
    const state = snapshotForBackup(migrate(heavyYear().state, 4));
    const json = JSON.stringify(state);
    expect(json.length).toBeGreaterThan(300_000);
    const blob = await seal({ v: 1, at: payload.at, schema: CURRENT_VERSION, rev: 1, state }, key);
    expect(blobBytes(blob)).toBeLessThan(256 * 1024);
    expect(blob.length).toBeLessThanOrEqual(349_526);
    expect((await open(blob, key)).state).toEqual(state);
  });
});

describe('helpers', () => {
  it('base64url round trip, and the bytes a blob holds', () => {
    const bytes = Uint8Array.from({ length: 70_000 }, (_, i) => (i * 37) % 256);
    const text = toBase64url(bytes);
    expect(text).not.toMatch(/[+/=]/);
    expect(fromBase64url(text)).toEqual(bytes);
    expect(blobBytes(text)).toBe(70_000);
    expect(Math.ceil((256 * 1024 * 4) / 3)).toBe(349_526); // the server's limit is 256 KiB of binary
  });
  it('sha256Hex', async () => {
    expect(await sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
});
