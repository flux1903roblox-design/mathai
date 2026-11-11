// Digital Asset Links for the Play Store app (STUDENT-12 §2). A Trusted Web Activity opens the site with no browser
// bar only when the site says which Android app may do so, at /.well-known/assetlinks.json. The Worker answers it from
// two vars in wrangler.toml, so nothing depends on how a static host treats a folder that starts with a dot:
//   ANDROID_PACKAGE       the app's package id (e.g. il.example.madregot)
//   ANDROID_CERT_SHA256   the SHA-256 of the key Google Play signs the app with (Play Console › App integrity), and of
//                         any other key the app is signed with (the upload key while testing), comma-separated
// While either is empty (the default), or the package id is not one, the answer is [] (no app may open the site).
// A fingerprint that is not 32 colon-separated hex pairs is left out and logged, so one mistyped line cannot hide the
// others; the owner's step in store/android/README.md checks the answer after the deploy.

const PACKAGE = /^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z][A-Za-z0-9_]*)+$/;
const FINGERPRINT = /^[0-9A-F]{2}(:[0-9A-F]{2}){31}$/;

/** The statements for env: [] or one statement for the app with every valid fingerprint (upper case). */
export function assetLinks(env = {}) {
  const pkg = String(env.ANDROID_PACKAGE || '').trim();
  const prints = String(env.ANDROID_CERT_SHA256 || '').split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);
  if (!pkg || !prints.length) return [];
  if (!PACKAGE.test(pkg)) {
    console.warn('assetlinks: ANDROID_PACKAGE is not a package id');
    return [];
  }
  const good = prints.filter((p) => FINGERPRINT.test(p));
  if (good.length < prints.length) console.warn(`assetlinks: ${prints.length - good.length} fingerprint(s) in ANDROID_CERT_SHA256 left out`);
  if (!good.length) return [];
  return [{
    relation: ['delegate_permission/common.handle_all_urls'],
    target: { namespace: 'android_app', package_name: pkg, sha256_cert_fingerprints: good },
  }];
}

/** GET /.well-known/assetlinks.json: JSON with exactly the type Android's verifier asks for, cacheable for an hour. */
export function assetLinksResponse(env) {
  return new Response(JSON.stringify(assetLinks(env)), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=3600', 'X-Content-Type-Options': 'nosniff' },
  });
}
