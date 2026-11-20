// A QR code drawn as SVG squares on this device (qrcode-generator): nothing is fetched, nothing is injected as HTML.
// Used by the hand-over screen for a parent (the link) and by the backup code's sheet (the bare code).
import { useMemo } from 'react';
import qrcode from 'qrcode-generator';

export default function QrCode({ text, size = 208, label, className = 'qr' }) {
  const path = useMemo(() => {
    const qr = qrcode(0, 'M');
    qr.addData(text);
    qr.make();
    const n = qr.getModuleCount();
    let d = '';
    for (let r = 0; r < n; r += 1) for (let c = 0; c < n; c += 1) if (qr.isDark(r, c)) d += `M${c + 4} ${r + 4}h1v1h-1z`;
    return { d, n: n + 8 };
  }, [text]);
  return (
    <svg className={className} width={size} height={size} viewBox={`0 0 ${path.n} ${path.n}`} role="img" aria-label={label} shapeRendering="crispEdges">
      {/* a QR code must stay dark on light in both themes */}
      <rect width={path.n} height={path.n} fill="#fff" />{/* colour-ok: QR must stay dark on light */}
      <path d={path.d} fill="#14161a" />{/* colour-ok: QR must stay dark on light */}
    </svg>
  );
}
