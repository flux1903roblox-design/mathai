// Brand mark: a staircase of six steps, one per chapter colour. Authored SVG.
const COLORS = ['var(--ch-cyan)', 'var(--ch-magenta)', 'var(--ch-orange)', 'var(--ch-green)', 'var(--ch-violet)', 'var(--ch-ochre)'];

export default function StepsMark({ size = 120 }) {
  const step = 16;
  return (
    <svg width={size} height={size} viewBox="0 0 112 112" className="steps-mark" aria-hidden="true">
      {COLORS.map((c, i) => (
        <rect key={c} x={8 + i * step} y={104 - (i + 1) * step} width={step - 2} height={(i + 1) * step} rx="3" fill={c} />
      ))}
    </svg>
  );
}
