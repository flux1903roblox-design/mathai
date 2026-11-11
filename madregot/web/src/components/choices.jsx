// The radio-group choices (STUDENT-15 B3, B4), on Base UI's RadioGroup: the segmented control and the choice cards. In
// a file of their own (COUNCIL2-14), so the first screen's download (components/ui.jsx) does not carry Base UI's radio
// group: only the screens that show them (settings, the reminder, the wardrobe, a lesson's choices, the teacher's
// sheets) load it. Each group sets its own direction (STUDENT-15 B1: the arrow keys follow Hebrew reading order), which
// App.jsx's DirectionProvider did for the whole app before; these are the app's only Base UI composites.
import clsx from 'clsx';
import { RadioGroup } from '@base-ui/react/radio-group';
import { Radio } from '@base-ui/react/radio';
import { DirectionProvider } from '@base-ui/react/direction-provider';

/**
 * A segmented choice (STUDENT-15 B3): Base UI's RadioGroup drawing the .segmented / .seg buttons, so the look does not
 * change. The group is one Tab stop; the arrow keys move and choose (right to left: App.jsx sets the direction), Space
 * chooses. `options` is [[value, label], …] or [{ value, label, disabled }, …]. While `busy` nothing is chosen (the
 * focus still moves, and every option says it is unavailable).
 */
export function Segmented({ value, onValueChange, options, labelledBy, describedBy, label, className, busy = false }) {
  return (
    <DirectionProvider direction="rtl">
    <RadioGroup
      value={value} className={clsx('segmented', className)} aria-labelledby={labelledBy} aria-describedby={describedBy} aria-label={label}
      onValueChange={(v, details) => { if (busy) { details.cancel(); return; } onValueChange?.(v); }}
    >
      {options.map((o) => {
        const { value: v, label: text, disabled } = Array.isArray(o) ? { value: o[0], label: o[1] } : o;
        return (
          <Radio.Root key={String(v)} value={v} disabled={disabled} nativeButton render={<button type="button" />}
            className={(st) => clsx('seg', st.checked && 'on')} aria-disabled={busy || undefined}>
            {text}
          </Radio.Root>
        );
      })}
    </RadioGroup>
    </DirectionProvider>
  );
}

/**
 * Base UI's composite skips items marked aria-disabled when the arrow keys move, so a locked choice could never be
 * reached from the keyboard. While an arrow key is handled, the locked choices of the group lose the attribute (and get
 * it back right after), so they are focusable and still announced as unavailable.
 */
function reachLocked(e) {
  if (!e.key.startsWith('Arrow')) return;
  const locked = [...e.currentTarget.querySelectorAll('[data-locked][aria-disabled="true"]')];
  locked.forEach((el) => el.removeAttribute('aria-disabled'));
  setTimeout(() => locked.forEach((el) => el.setAttribute('aria-disabled', 'true')), 0);
}

/**
 * Choice cards (STUDENT-15 B4): Base UI's RadioGroup for a set of tap cards (מדי's wardrobe). One Tab stop, arrows in
 * reading order. A value in `locked` is never chosen: moving onto it with the arrows only focuses it, and the card's own
 * `onLocked` says how it opens.
 */
export function Choices({ value, onValueChange, locked = [], labelledBy, className, children }) {
  return (
    <DirectionProvider direction="rtl">
    <RadioGroup
      value={value} aria-labelledby={labelledBy} className={className} onKeyDownCapture={reachLocked}
      onValueChange={(v, details) => { if (locked.includes(v)) { details.cancel(); return; } onValueChange?.(v); }}
    >
      {children}
    </RadioGroup>
    </DirectionProvider>
  );
}

/** One card in Choices. A locked card stays focusable, is announced as unavailable, and opens `onLocked` (tap, Enter, Space). */
export function Choice({ value, locked = false, onLocked, describedBy, className, children }) {
  return (
    <Radio.Root
      value={value} data-value={value} className={className} data-locked={locked || undefined} aria-disabled={locked || undefined}
      aria-describedby={describedBy}
      // a locked card opens its reason (Base UI's own handler is skipped, so it is never chosen)
      onClick={locked ? (e) => { e.preventBaseUIHandler?.(); onLocked?.(value); } : undefined}
      onKeyDown={locked ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onLocked?.(value); } } : undefined}
    >
      {children}
    </Radio.Root>
  );
}

/** The check inside a chosen Choice (Base UI shows it only on the chosen one). */
export const ChoiceMark = Radio.Indicator;
