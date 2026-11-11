import { describe, it, expect } from 'vitest';
import { hashFor } from './pathToHash.js';

describe('plain paths of the parents area become hash routes', () => {
  it('turns /parents, /parents/link?c=… and /cancel into the hash route', () => {
    expect(hashFor({ pathname: '/parents', search: '?order=0123456789abcdef' })).toBe('/#/parents?order=0123456789abcdef');
    expect(hashFor({ pathname: '/parents/link', search: '?c=K7M4QX' })).toBe('/#/parents/link?c=K7M4QX');
    expect(hashFor({ pathname: '/parents/info' })).toBe('/#/parents/info');
    expect(hashFor({ pathname: '/cancel' })).toBe('/#/cancel');
    expect(hashFor({ pathname: '/terms' })).toBe('/#/terms');
    expect(hashFor({ pathname: '/privacy/' })).toBe('/#/privacy');
    expect(hashFor({ pathname: '/accessibility' })).toBe('/#/accessibility');
  });
  it('keeps any base path in front', () => {
    expect(hashFor({ pathname: '/madregot/parents/link', search: '?c=ABC234' })).toBe('/madregot/#/parents/link?c=ABC234');
    expect(hashFor({ pathname: '/madregot/cancel' })).toBe('/madregot/#/cancel');
  });
  it('leaves every other path, and any address that already has a route, alone', () => {
    expect(hashFor({ pathname: '/' })).toBeNull();
    expect(hashFor({ pathname: '/madregot/' })).toBeNull();
    expect(hashFor({ pathname: '/lesson/signed/1' })).toBeNull();
    expect(hashFor({ pathname: '/xcancel' })).toBeNull();
    expect(hashFor({ pathname: '/parents', hash: '#/assistant' })).toBeNull();
    expect(hashFor({ pathname: '/madregot/terms', hash: '#/x' })).toBeNull();
  });
  it('opens the public safety statement, and keeps an anchor in a legal page after the route (TRUST-2 §3)', () => {
    expect(hashFor({ pathname: '/safety' })).toBe('/#/safety');
    expect(hashFor({ pathname: '/terms', hash: '#cancel' })).toBe('/#/terms#cancel');
    expect(hashFor({ pathname: '/madregot/terms', hash: '#cancel' })).toBe('/madregot/#/terms#cancel');
    expect(hashFor({ pathname: '/privacy', search: '?from=mail', hash: '#rights' })).toBe('/#/privacy?from=mail#rights');
    expect(hashFor({ pathname: '/terms', hash: '#' })).toBe('/#/terms');
    expect(hashFor({ pathname: '/terms', hash: '#/' })).toBe('/#/terms');
    expect(hashFor({ pathname: '/', hash: '#cancel' })).toBeNull();
  });
});
