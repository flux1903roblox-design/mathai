// The marks on the two angle drawings (components/Figure.jsx draws them; figPlain in content/index.js says them in
// words). One place decides which angles carry an arc and what each arc says, so the drawing and its words agree.
//
// A mark: { text } a label (an angle in degrees, or '?'), { target } the colour of what is asked (an angle that is
// part of the answer), { pair } a double arc without a label (two equal angles whose sum the question gives);
// a mark with none of these is a plain arc (an angle the question talks about, given by a relation).

/**
 * Two crossing lines (fig.type 'cross'). The four angles around the crossing, counter-clockwise from the drawn one
 * (fig.a): 0 the drawn angle, 1 next to it, 2 opposite it, 3 next to it on the other side.
 * fig.target: 'vertical' (the opposite angle), 'adjacent' (a neighbour), 'rest' (the other three, whose sum is asked),
 * 'pair' (the drawn angle and its opposite are a pair given by their sum; a neighbour is asked).
 */
export function crossMarks(fig) {
  const given = { text: `${fig.a}°` };
  const ask = { text: '?', target: true };
  switch (fig.target) {
    case 'vertical': return [{ at: 0, ...given }, { at: 2, ...ask }];
    case 'rest': return [{ at: 0, ...given }, { at: 1, ...ask }, { at: 2, ...ask }, { at: 3, ...ask }];
    case 'pair': return [{ at: 0, pair: true }, { at: 2, pair: true }, { at: 1, ...ask }];
    default: return [{ at: 0, ...given }, { at: 1, ...ask }];
  }
}

/**
 * Two parallel lines and a transversal (fig.type 'parallel'). An angle is a crossing (U upper, L lower) and a corner
 * there: ur above the line and right of the transversal, ul above and left, ll below and left, lr below and right.
 * The ur and ll corners are fig.a; ul and lr are 180° − fig.a.
 * fig.kind: 'corresponding' | 'alternate' | 'cointerior' (one angle given, its partner asked);
 * 'pair' (fig.pair 'corresponding' or 'alternate': two equal angles given by their sum, a co-interior angle of one asked);
 * 'sum' (an angle and its fig.pair partner, whose sum is asked); 'diff' (two co-interior angles, the smaller asked);
 * 'three' (an angle between the lines, its alternate and its co-interior angle, whose sum is asked).
 */
export function parallelMarks(fig) {
  const given = { text: `${fig.a}°` };
  const ask = { text: '?', target: true };
  const at = (line, corner, m) => ({ line, corner, ...m });
  switch (fig.kind) {
    case 'corresponding': return [at('U', 'ur', given), at('L', 'ur', ask)];
    case 'alternate': return [at('U', 'll', given), at('L', 'ur', ask)];
    case 'pair': return fig.pair === 'alternate'
      ? [at('U', 'll', { pair: true }), at('L', 'ur', { pair: true }), at('L', 'ul', ask)]
      : [at('U', 'ur', { pair: true }), at('L', 'ur', { pair: true }), at('U', 'lr', ask)];
    case 'sum': return fig.pair === 'corresponding'
      ? [at('U', 'ur', given), at('L', 'ur', { target: true })]
      : [at('U', 'll', given), at('L', 'ur', { target: true })];
    case 'diff': return [at('L', 'ur', ask), at('U', 'lr', {})];
    case 'three': return [at('U', 'll', given), at('L', 'ur', ask), at('L', 'ul', ask)];
    default: return [at('L', 'ur', given), at('U', 'lr', ask)]; // co-interior
  }
}
