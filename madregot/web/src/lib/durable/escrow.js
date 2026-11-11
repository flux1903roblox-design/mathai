// The class and the family keep this device's backup code (DURABLE-6), so the progress comes back with an identity the
// student already has: a class code, a name and the personal PIN, or a parent's family plan. The vault itself is the
// backup code's (vault.js); here the code is also given to the server, sealed there with its own secret, so the server
// could open that copy while the class or the family keeps it. That is why the copy never says "מוצפן" for it.
//   class   after a join: with r.vault (a returning student whose class kept a code), the copy is opened, merged here
//           (applyRestored(…, 'class', { merge: true })) and its code adopted; with none, while the student keeps
//           "שמירת עותק בשרת הכיתה" on (durable.escrowClass, on by default), a backup is made when there is none and its
//           code is kept by the class (POST /api/vault/escrow with the class Bearer). The switch turns it off
//           (POST /api/vault/escrow/delete) and on again.
//   family  after a link (pollLink 'linked', linkThisDevice): with r.vault (the parent chose to continue from kept
//           progress) the same restore, 'family'; else a backup when there is none, kept by the family (X-Family-Device).
// backup.escrow says who keeps the code: 'class' | 'family' | 'both' | null. Without VAULT_SECRET the server answers
// 503 server_config: the student hears escrow_off, and joining or linking goes on as before.
import { useApp } from '../store.js';
import { api, hasServer, errorText } from '../api.js';
import { report } from '../monitor.js';
import { BACKUP_DEFAULTS, DURABLE_DEFAULTS } from './migrations.js';
import { applyRestored } from './apply.js';
import { derive } from './crypto.js';
import { isCode } from './code.js';
import { createBackup, findVault, adoptCode } from './vault.js';

export const ESCROW_TEXT = {
  /** a class rejoin on a device with no progress */
  back: (cls) => `ברוכים השבים לכיתה ${cls}. ההתקדמות שלכם חזרה.`,
  /** a class rejoin on a device that had progress of its own */
  merged: (cls) => `ברוכים השבים לכיתה ${cls}. איחדנו את ההתקדמות מהכיתה עם מה שיש במכשיר הזה.`,
  /** a family link that continued from kept progress */
  moved: 'ההתקדמות עברה למכשיר הזה.',
  /** the server cannot keep codes yet (no VAULT_SECRET) */
  off: errorText('escrow_off'),
};

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const backupOf = (store) => ({ ...BACKUP_DEFAULTS, ...(isObj(store.getState().backup) ? store.getState().backup : {}) });
const durableOf = (store) => ({ ...DURABLE_DEFAULTS, ...(isObj(store.getState().durable) ? store.getState().durable : {}) });

/** Does `kind` ('class' | 'family') keep this device's code? */
export const escrowHas = (backup, kind) => !!backup?.on && (backup.escrow === kind || backup.escrow === 'both');
/** backup.escrow with `kind` added or taken away. */
export function escrowWith(cur, kind, on) {
  const set = new Set(cur === 'both' ? ['class', 'family'] : cur ? [cur] : []);
  if (on) set.add(kind); else set.delete(kind);
  return set.size === 2 ? 'both' : set.size ? [...set][0] : null;
}
const markEscrow = (store, kind, on) => { const b = backupOf(store); store.setState({ backup: { ...b, escrow: escrowWith(b.escrow, kind, on) } }); };

/** The identity an escrow call carries: the class Bearer (a token the store may not hold yet), or the family device. */
function headersFor(store, kind, token) {
  const t = kind === 'class' ? token || store.getState().profile?.token : store.getState().ai?.familyDevice?.token;
  if (!t) return {};
  return kind === 'class' ? { Authorization: `Bearer ${t}` } : { 'X-Family-Device': t };
}

/**
 * The copy a kept code opens, brought here: merged ('empty' or 'same'); another student's copy is merged only when
 * `replaceOther` (a parent chose to move that progress to this device: it then replaces, with the undo of 30 days).
 * The code is adopted when it was. Resolves { kind, applied }; rejects when the copy could not be read.
 */
async function bringBack(code, kind, { store, token, replaceOther = false, before }) {
  const found = await findVault(code, { store, headers: headersFor(store, kind, token) });
  before?.();
  let r = await applyRestored(found.state, kind, { merge: true, at: found.at, store });
  if (r.kind === 'other' && replaceOther) r = await applyRestored(found.state, kind, { replace: true, at: found.at, store });
  if (r.applied) adoptCode(found, { store, escrow: kind });
  return r;
}

/**
 * Keep this device's code with the class or the family: a backup is made first when there is none (it pushes the first
 * copy), then POST /api/vault/escrow. Resolves 'kept' | 'off' (nothing to do here) | 'escrow_off' (no VAULT_SECRET) |
 * 'error'. Never throws: joining and linking go on whatever happens.
 */
export async function keepCode(kind, { store = useApp, token } = {}) {
  if (!hasServer()) return 'off';
  if (kind === 'class' && !durableOf(store).escrowClass) return 'off';
  if (kind === 'family' && !store.getState().ai?.familyDevice?.token) return 'off';
  let b = backupOf(store);
  // another student's copy is never handed to this student's class or family
  if (b.on && b.state === 'other_student') return 'off';
  try {
    if (!b.on || !isCode(b.code)) { await createBackup({ store }); b = backupOf(store); }
    const lookup = b.lookup || (await derive(b.code)).lookup;
    await api('/api/vault/escrow', { method: 'POST', body: { code: b.code, lookup }, auth: false, headers: headersFor(store, kind, token) });
    markEscrow(store, kind, true);
    return 'kept';
  } catch (e) {
    if (e?.code === 'server_config') return 'escrow_off';
    // a vault that is off or full, a network that is down: the backup code (or the file) is still there
    if (!['network', 'vault_off', 'vault_full', 'too_many_vaults', 'slow_down', 'vault_too_big'].includes(e?.code)) {
      report('vault', { name: `escrow_${e?.code || 'error'}`, message: `the ${kind} could not keep the code (${e?.status || 'no status'})` });
    }
    return 'error';
  }
}

/**
 * After a class join (Welcome's class step, Settings' class section). `c`: what joinClass resolved ({ token,
 * className, vault? }). With c.vault the class's copy comes back here; with none (or one that could not be read) this
 * device's code is kept by the class, unless `keep` is false (Welcome keeps it once the profile is made). `before`
 * runs once the copy has been read, in the same moment as the merge (Welcome makes the profile there). Resolves
 * { toast, restored }: the words to say (null: the caller's own).
 */
export async function afterClassJoin(c, { store = useApp, keep = true, before } = {}) {
  if (c?.vault?.code) {
    try {
      const r = await bringBack(c.vault.code, 'class', { store, token: c.token, before });
      if (r.applied) return { restored: true, toast: r.kind === 'same' ? ESCROW_TEXT.merged(c.className) : ESCROW_TEXT.back(c.className) };
      // another student's progress here: nothing merged, and the class keeps the code it has
      return { restored: false, toast: null };
    } catch (e) {
      // the copy could not be read (gone, or a code that does not open it): a new one is kept below
      report('vault', { name: 'escrow_open', message: `the class's copy could not be opened (${e?.code || e?.name || 'error'})` });
    }
  }
  if (!keep) return { restored: false, toast: null };
  const kept = await keepCode('class', { store, token: c?.token });
  return { restored: false, toast: kept === 'escrow_off' ? ESCROW_TEXT.off : null };
}

/**
 * After this device is linked to a family plan (pollLink 'linked', linkThisDevice). `r`: the link's answer
 * ({ deviceToken, vault? }). With r.vault the kept progress the parent chose comes here; else this device's code is
 * kept by the family. Resolves { toast, restored }.
 */
export async function afterFamilyLink(r, { store = useApp } = {}) {
  if (r?.vault?.code) {
    try {
      const out = await bringBack(r.vault.code, 'family', { store, replaceOther: true });
      if (out.applied) return { restored: true, toast: ESCROW_TEXT.moved };
      return { restored: false, toast: null };
    } catch (e) {
      report('vault', { name: 'escrow_open', message: `the family's kept copy could not be opened (${e?.code || e?.name || 'error'})` });
      return { restored: false, toast: null };
    }
  }
  const kept = await keepCode('family', { store });
  return { restored: false, toast: kept === 'escrow_off' ? ESCROW_TEXT.off : null };
}

/**
 * The switch "שמירת עותק בשרת הכיתה". Off: the class's copy of the code is deleted (POST /api/vault/escrow/delete) and
 * this device stops giving it; rejects when the server could not be reached (nothing changes then). On: the code is
 * kept again; resolves what keepCode resolved.
 */
export async function setClassCopy(on, { store = useApp } = {}) {
  const d = durableOf(store);
  if (!on) {
    await api('/api/vault/escrow/delete', { method: 'POST', body: {}, auth: false, headers: headersFor(store, 'class') });
    store.setState({ durable: { ...d, escrowClass: false } });
    markEscrow(store, 'class', false);
    return 'off';
  }
  store.setState({ durable: { ...d, escrowClass: true } });
  return keepCode('class', { store });
}
