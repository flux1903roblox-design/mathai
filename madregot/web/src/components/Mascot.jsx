import clsx from 'clsx';

/**
 * מדי, the Madregot mascot: a two-step stair block with a face.
 * mood: happy | cheer | think | oops. Drawn in SVG; motion comes from CSS (.mascot-*).
 */
export default function Mascot({ mood = 'happy', size = 120, className, title }) {
  const cheer = mood === 'cheer';
  const think = mood === 'think';
  const oops = mood === 'oops';
  const px = think ? -2 : 0; const py = think ? -3 : 0; // pupils look up and away while thinking
  return (
    <svg
      viewBox="0 0 120 124" width={size} height={size * (124 / 120)}
      className={clsx('mascot', `mascot-${mood}`, className)}
      role={title ? 'img' : undefined} aria-hidden={title ? undefined : true} aria-label={title}
    >
      {cheer && (
        <g className="mascot-sparkles" fill="var(--gold)">
          <path d="M10 18l2.4 5.6L18 26l-5.6 2.4L10 34l-2.4-5.6L2 26l5.6-2.4z" />
          <path d="M104 10l1.8 4.2L110 16l-4.2 1.8L104 22l-1.8-4.2L98 16l4.2-1.8z" />
          <path d="M112 40l1.2 2.8L116 44l-2.8 1.2L112 48l-1.2-2.8L108 44l2.8-1.2z" />
        </g>
      )}
      <g className="mascot-body">
        {/* arms */}
        <g stroke="var(--brand-d)" strokeWidth="7" strokeLinecap="round" fill="none">
          {cheer ? (<><path d="M17 64 L6 46" /><path d="M103 72 L114 54" /></>) : oops ? (<><path d="M17 70 L8 62" /><path d="M103 80 L112 72" /></>) : (<><path d="M17 72 L8 84" /><path d="M103 80 L112 90" /></>)}
        </g>
        {/* the 3D edge, then the two steps */}
        <g fill="var(--brand-d)">
          <rect x="14" y="30" width="60" height="80" rx="13" />
          <rect x="14" y="62" width="92" height="48" rx="13" />
        </g>
        <g fill="var(--brand)">
          <rect x="14" y="24" width="60" height="80" rx="13" />
          <rect x="14" y="56" width="92" height="48" rx="13" />
        </g>
        {/* treads: the top of each step catches the light */}
        <g fill="#8b82ff">
          <rect x="22" y="28" width="44" height="6" rx="3" />
          <rect x="80" y="60" width="20" height="6" rx="3" />
        </g>
        {/* feet */}
        <g fill="var(--brand-d)">
          <rect x="26" y="106" width="18" height="10" rx="5" />
          <rect x="78" y="106" width="18" height="10" rx="5" />
        </g>
        {/* face */}
        <g className="mascot-eyes">
          <ellipse cx="34" cy="50" rx="9" ry="10" fill="#fff" />
          <ellipse cx="56" cy="50" rx="9" ry="10" fill="#fff" />
          <circle cx={35 + px} cy={52 + py} r="4.6" fill="var(--ink)" />
          <circle cx={57 + px} cy={52 + py} r="4.6" fill="var(--ink)" />
          <circle cx={36.6 + px} cy={50 + py} r="1.5" fill="#fff" />
          <circle cx={58.6 + px} cy={50 + py} r="1.5" fill="#fff" />
        </g>
        {oops && (
          <g stroke="var(--ink)" strokeWidth="3" strokeLinecap="round">
            <path d="M27 40 L38 36" /><path d="M63 40 L52 36" />
          </g>
        )}
        <circle cx="25" cy="65" r="4.5" fill="#ff8fb8" opacity="0.7" />
        <circle cx="65" cy="65" r="4.5" fill="#ff8fb8" opacity="0.7" />
        {cheer ? (
          <path d="M36 64 H54 Q54 77 45 77 Q36 77 36 64 Z" fill="var(--ink)" />
        ) : oops ? (
          <circle cx="45" cy="70" r="4" fill="var(--ink)" />
        ) : think ? (
          <path d="M39 70 Q45 67 51 70" stroke="var(--ink)" strokeWidth="3.2" strokeLinecap="round" fill="none" />
        ) : (
          <path d="M37 66 Q45 74 53 66" stroke="var(--ink)" strokeWidth="3.4" strokeLinecap="round" fill="none" />
        )}
        {cheer && <path d="M40 72 Q45 75 50 72" stroke="#ff6f9f" strokeWidth="3" strokeLinecap="round" fill="none" />}
      </g>
    </svg>
  );
}
