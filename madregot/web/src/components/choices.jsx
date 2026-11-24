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
 * Choice cards (STUDENT-15 B4): Base UI's RadioGroup for a set of tap cards (מדי's wardrobe). One Tab stop, arrows in
 * reading order. The wardrobe shows only what is owned (PRODUCT2-36), so every card can be chosen; how a piece still to
 * come opens is a button of its own there.
 */
export function Choices({ value, onValueChange, labelledBy, className, children }) {
  return (
    <DirectionProvider direction="rtl">
    <RadioGroup value={value} aria-labelledby={labelledBy} className={className} onValueChange={(v) => onValueChange?.(v)}>
      {children}
    </RadioGroup>
    </DirectionProvider>
  );
}

/** One card in Choices. */
export function Choice({ value, className, children }) {
  return <Radio.Root value={value} data-value={value} className={className}>{children}</Radio.Root>;
}

/** The check inside a chosen Choice (Base UI shows it only on the chosen one). */
export const ChoiceMark = Radio.Indicator;
