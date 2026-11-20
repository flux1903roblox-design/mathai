// מדי's walk on the path (Walker.jsx): the stops zig-zag, so he travels on a diagonal. The way there and the hops are
// separate animations, and each hop rises with ease-out and falls with ease-in: an arc, not a straight line (ux-motion 6).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { hops, EASE } from './Walker.jsx';

describe('the hops of מדי\'s walk', () => {
  it('each hop rises easing out and falls easing in, and he ends on the ground', () => {
    const f = hops([[0.2, 12], [0.4, 0], [0.6, 12], [0.8, 0], [0.9, 8]]);
    expect(f.map((k) => k.offset)).toEqual([0, 0.2, 0.4, 0.6, 0.8, 0.9, 1]);
    expect(f.map((k) => k.transform)).toEqual(['none', 'translateY(-12px)', 'none', 'translateY(-12px)', 'none', 'translateY(-8px)', 'none']);
    // the easing on a keyframe runs to the next one: up, down, up, down, up, down
    expect(f.slice(0, -1).map((k) => k.easing)).toEqual([EASE.up, EASE.down, EASE.up, EASE.down, EASE.up, EASE.down]);
    expect(EASE.up).toBe('cubic-bezier(0.16, 1, 0.3, 1)');
    expect(EASE.down).toBe('cubic-bezier(0.7, 0, 0.84, 0)');
  });

  it('the way across is its own animation (translate), so the hops bend it into arcs', () => {
    const src = readFileSync(new URL('./Walker.jsx', import.meta.url), 'utf8');
    expect(src).toMatch(/el\.animate\(\[\{ translate: `\$\{dx\}px \$\{dy\}px` \}/);
    expect(src).toMatch(/easing: EASE\.inOut/);
    // under reduced motion he simply stands at the stop
    expect(src).toMatch(/if \(!el \|\| still\(\)/);
  });
});
