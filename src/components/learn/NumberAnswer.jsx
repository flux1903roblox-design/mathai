import { useEffect, useRef } from 'react';

// Big centred numeric answer box.
export default function NumberAnswer({ value, onChange, locked, config = {}, result }) {
  const ref = useRef(null);
  useEffect(() => { if (!locked) ref.current?.focus({ preventScroll: true }); }, [locked]);
  const tone = result === 'correct' || result === 'revealed'
    ? 'border-emerald-400/70 bg-emerald-400/10 text-emerald-300'
    : result === 'wrong'
      ? 'border-rose-400/70 bg-rose-400/10 animate-shake'
      : 'border-white/15 bg-white/[0.04] focus-within:border-violet-400/80';
  return (
    <div className="flex justify-center">
      <div dir="ltr" className={`flex items-center gap-2 rounded-2xl border-2 px-5 py-3 transition ${tone}`}>
        {config.prefix && <span className="text-xl font-bold text-muted-foreground">{config.prefix}</span>}
        <input
          ref={ref}
          value={value.text}
          disabled={locked}
          inputMode="decimal"
          autoComplete="off"
          aria-label="התשובה שלך"
          placeholder="?"
          onChange={(e) => onChange({ ...value, text: e.target.value, touched: true })}
          className="w-32 bg-transparent text-center text-3xl font-extrabold tabular-nums outline-none placeholder:text-white/20"
        />
        {config.suffix && <span className="text-xl font-bold text-muted-foreground">{config.suffix}</span>}
      </div>
    </div>
  );
}
