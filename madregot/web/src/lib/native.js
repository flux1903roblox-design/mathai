// The iPhone app's native calls (STUDENT-12 §3, the VITE_STORE=ios build): local notifications and haptics, through the
// bridge that Capacitor's iOS shell puts into the page before it loads (window.Capacitor). The web app bundles no
// Capacitor package: the plugins are installed in the shell (madregot/store/ios/package.json), and the shell's bridge
// answers Capacitor.nativePromise(plugin, method, options) for them. On the web, in a browser or in a test with no
// stub, there is no window.Capacitor and every plugin is null.

/** The methods this app calls, per plugin (the plugin object returned has these and nothing else). */
export const NATIVE_METHODS = {
  LocalNotifications: ['checkPermissions', 'requestPermissions', 'schedule', 'cancel', 'getPending'],
  Haptics: ['impact', 'notification'],
};

/** The page runs inside the native iPhone shell. */
export function isNativeApp(w = globalThis) {
  const cap = w?.Capacitor;
  if (!cap) return false;
  try { return typeof cap.isNativePlatform === 'function' ? !!cap.isNativePlatform() : typeof cap.nativePromise === 'function'; } catch { return false; }
}

/**
 * A plugin of the native shell, as an object with the methods of NATIVE_METHODS[name], each returning a promise; null
 * when the page is not in the shell. A plugin object the shell registered itself (Capacitor.Plugins) is used as it is.
 */
export function nativePlugin(name, w = globalThis) {
  if (!isNativeApp(w)) return null;
  const cap = w.Capacitor;
  const methods = NATIVE_METHODS[name] || [];
  const own = cap.Plugins?.[name];
  if (own && methods.every((m) => typeof own[m] === 'function')) return own;
  if (typeof cap.nativePromise !== 'function') return null;
  return Object.fromEntries(methods.map((m) => [m, (options = {}) => cap.nativePromise(name, m, options)]));
}
