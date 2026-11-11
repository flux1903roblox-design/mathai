// Exam and notebook photos (trust spec TRUST-5 §1, §2): the pure step that cuts the top band and blacks out boxes, and
// the warning's words and once-a-session flag. The picture is a synthetic 100×100 ImageData-like object whose red
// channel holds the row number, so a test can tell which rows survived.
import { describe, it, expect, beforeEach } from 'vitest';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { prepImage, fitSize, keepBox, EXAM_HEADER, CUT_MAX, PREP_COPY } from './PhotoPrep.jsx';
import { PHOTO_WARN, PHOTO_WARNED, photoWarned, PhotoWarn } from './PhotoWarn.jsx';

function picture(W = 100, H = 100) {
  const data = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      const i = (y * W + x) * 4;
      data[i] = y; data[i + 1] = 200; data[i + 2] = 100 + (x % 50); data[i + 3] = 255;
    }
  }
  return { width: W, height: H, data };
}
const px = (img, x, y) => [...img.data.subarray((y * img.width + x) * 4, (y * img.width + x) * 4 + 4)];

describe('prepImage', () => {
  it('a 15% cut: the output is 85 rows high and rows 0-14 are gone', () => {
    const src = picture();
    const out = prepImage(src, { cropTop: 0.15 });
    expect(out.width).toBe(100);
    expect(out.height).toBe(85);
    expect(out.data.length).toBe(100 * 85 * 4);
    // the first row kept is row 15, and every row is shifted up by 15
    for (let y = 0; y < out.height; y += 1) expect(out.data[(y * 100) * 4]).toBe(y + 15);
    const rowsLeft = new Set(); for (let i = 0; i < out.data.length; i += 4) rowsLeft.add(out.data[i]);
    for (let r = 0; r <= 14; r += 1) expect(rowsLeft.has(r), `row ${r}`).toBe(false);
  });

  it('every pixel of a box is solid black, and only the box', () => {
    const src = picture();
    const box = { x: 0.2, y: 0.5, w: 0.3, h: 0.1 };
    const out = prepImage(src, { cropTop: 0, boxes: [box] });
    expect(out.height).toBe(100);
    for (let y = 50; y < 60; y += 1) for (let x = 20; x < 50; x += 1) expect(px(out, x, y)).toEqual([0, 0, 0, 255]);
    // just outside the box: the picture as it was
    for (const [x, y] of [[19, 55], [50, 55], [30, 49], [30, 60]]) expect(px(out, x, y)).toEqual(px(src, x, y));
  });

  it('a box below the cut moves up with the page, a box inside the cut is gone with it, and the input is not changed', () => {
    const src = picture();
    const before = new Uint8ClampedArray(src.data);
    const out = prepImage(src, { cropTop: 0.15, boxes: [{ x: 0, y: 0.5, w: 0.1, h: 0.1 }, { x: 0.5, y: 0, w: 0.5, h: 0.1 }] });
    for (let y = 35; y < 45; y += 1) for (let x = 0; x < 10; x += 1) expect(px(out, x, y)).toEqual([0, 0, 0, 255]);
    expect(px(out, 60, 0)).toEqual(px(src, 60, 15));
    expect(src.data).toEqual(before);
  });

  it('a box is widened to whole pixels, never narrowed, and one past the edge is clipped', () => {
    const out = prepImage(picture(), { boxes: [{ x: 0.205, y: 0.205, w: 0.01, h: 0.01 }, { x: 0.95, y: 0.95, w: 0.2, h: 0.2 }] });
    expect(px(out, 20, 20)).toEqual([0, 0, 0, 255]);
    expect(px(out, 21, 21)).toEqual([0, 0, 0, 255]);
    expect(px(out, 99, 99)).toEqual([0, 0, 0, 255]);
    expect(px(out, 94, 94)).not.toEqual([0, 0, 0, 255]);
  });

  it('no cut and no boxes: the same pixels; a cut of everything still leaves one row; nonsense boxes are skipped', () => {
    const src = picture();
    expect(prepImage(src).data).toEqual(src.data);
    expect(prepImage(src, { cropTop: 1 }).height).toBe(1);
    expect(prepImage(src, { boxes: [null, { x: 'a' }, { x: NaN, y: 0, w: 1, h: 1 }] }).data).toEqual(src.data);
  });
});

describe('the page on screen and the boxes', () => {
  it('the whole page fits the space, at its own shape', () => {
    expect(fitSize(1200, 1600, 358, 400)).toEqual({ width: 300, height: 400 });
    expect(fitSize(1600, 1200, 288, 400)).toEqual({ width: 288, height: 216 });
  });
  it('a box stays inside the page and keeps a usable size', () => {
    expect(keepBox({ x: 0.9, y: -0.2, w: 0.4, h: 0.1 })).toEqual({ x: 0.6, y: 0, w: 0.4, h: 0.1 });
    expect(keepBox({ x: 0.5, y: 0.5, w: 0, h: 2 })).toEqual({ x: 0.5, y: 0, w: 0.03, h: 1 });
  });
  it('the exam\'s default cut is 15%, and no more than 60% can be cut', () => {
    expect(EXAM_HEADER).toBe(0.15);
    expect(CUT_MAX).toBe(0.6);
  });
  it('the words of the step, as Appendix E.9 gives them', () => {
    expect(PREP_COPY).toMatchObject({
      title: 'מסתירים פרטים אישיים', band: 'השורה הזו לא תישלח', draw: 'השחרה', add: 'הוספת מלבן', undo: 'ביטול האחרון',
      done: 'סיימתי, אין בדף פרטים אישיים', retake: 'צילום מחדש',
      cutHint: 'גררו את הקו כדי לבחור כמה מהחלק העליון לחתוך. במקלדת: חצים למעלה ולמטה.',
    });
  });
});

describe('the warning before the camera', () => {
  let store;
  beforeEach(() => {
    store = new Map();
    globalThis.sessionStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
  });

  it('says what is not sent and where the photo goes, with one button', () => {
    expect(PHOTO_WARN.title).toBe('לפני שמצלמים');
    expect(PHOTO_WARN.lines[0]).toContain('שם, תעודת זהות, ציון, כיתה ובית ספר');
    expect(PHOTO_WARN.lines[1]).toBe('התמונה נשלחת לעוזר החכם (Anthropic, בארה״ב) כדי לבדוק אותה, ולא נשמרת אצלנו.');
    expect(PHOTO_WARN.ok).toBe('הבנתי, לצלם');
    // closed, it renders nothing into the page
    expect(renderToStaticMarkup(h(PhotoWarn, { open: false, onGo() {}, onClose() {} }))).toBe('');
  });

  it('is read once a session: the flag lives in sessionStorage under the store\'s key', () => {
    expect(PHOTO_WARNED).toBe('madregot-photo-warned');
    expect(photoWarned()).toBe(false);
    store.set(PHOTO_WARNED, '1');
    expect(photoWarned()).toBe(true);
    globalThis.sessionStorage = { getItem() { throw new Error('blocked'); } };
    expect(photoWarned()).toBe(false); // blocked storage: the warning simply comes again
  });
});
