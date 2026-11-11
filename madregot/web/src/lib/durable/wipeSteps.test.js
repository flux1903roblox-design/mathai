// The durable lane's parts of "delete all" (wipeSteps.js): the vault step deletes the backup only while the backup code
// is on, and a failure stops the wipe with the vault's own words; both steps are registered with lib/wipe.js.
import { describe, it, expect, vi, beforeEach } from 'vitest';

const stopBackup = vi.fn();
vi.mock('./vault.js', () => ({ stopBackup: (...a) => stopBackup(...a), vaultErrorText: () => 'השרת נתקל בתקלה. נסו שוב בעוד רגע.' }));
const durableWipe = vi.fn(async () => {});
vi.mock('./storage.js', async (orig) => ({ ...(await orig()), durableWipe: () => durableWipe() }));
const registered = { wipe: [], clear: [] };
vi.mock('../wipe.js', () => ({ onWipe: (n) => registered.wipe.push(n), onClearDevice: (n) => registered.clear.push(n) }));

const store = (on) => ({ getState: () => ({ backup: { on } }) });

beforeEach(() => { stopBackup.mockReset(); });

describe('durable/wipeSteps.js', () => {
  it('registers the vault step and the device clear with lib/wipe.js', async () => {
    await import('./wipeSteps.js');
    expect(registered.wipe).toEqual(['vault']);
    expect(registered.clear).toEqual(['durable']);
  });

  it('the vault step does nothing without the backup code, and deletes the backup with it', async () => {
    const { wipeVault } = await import('./wipeSteps.js');
    await wipeVault({ store: store(false) });
    expect(stopBackup).not.toHaveBeenCalled();
    stopBackup.mockResolvedValue();
    await wipeVault({ store: store(true) });
    expect(stopBackup).toHaveBeenCalledTimes(1);
  });

  it('a backup that cannot be deleted stops the wipe, in the sheet\'s words', async () => {
    const { wipeVault, WIPE_VAULT_FAILED } = await import('./wipeSteps.js');
    stopBackup.mockRejectedValue(Object.assign(new Error('server_error'), { code: 'server_error', status: 500 }));
    await expect(wipeVault({ store: store(true) })).rejects.toMatchObject({ wipeText: `${WIPE_VAULT_FAILED} השרת נתקל בתקלה. נסו שוב בעוד רגע.` });
    expect(WIPE_VAULT_FAILED).toBe('לא הצלחנו למחוק את הגיבוי בשרת, ולכן עוד לא מחקנו כלום מהמכשיר.');
  });
});
