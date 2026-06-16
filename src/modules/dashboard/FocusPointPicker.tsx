import { useRef, useState } from 'react';

interface FocusPointPickerProps {
  imageSrc: string;
  /** Valor CSS object-position, ex: "50% 50%". */
  value?: string;
  /** Classe de proporção do preview (aproxima o contexto real). */
  aspectClass: string;
  label: string;
  hint?: string;
  onChange: (value: string) => void;
}

function parse(value?: string): [number, number] {
  const m = (value || '50% 50%').match(/(-?\d+(?:\.\d+)?)%\s+(-?\d+(?:\.\d+)?)%/);
  if (!m) return [50, 50];
  return [Number(m[1]), Number(m[2])];
}

/** Seletor de ponto focal: clique/arraste sobre o preview define o object-position. */
export function FocusPointPicker({ imageSrc, value, aspectClass, label, hint, onChange }: FocusPointPickerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const [x, y] = parse(value);

  const setFromEvent = (clientX: number, clientY: number) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100));
    const py = Math.min(100, Math.max(0, ((clientY - rect.top) / rect.height) * 100));
    onChange(`${Math.round(px)}% ${Math.round(py)}%`);
  };

  return (
    <div>
      <label className="block text-[9px] uppercase opacity-40 mb-2 font-bold tracking-widest">{label}</label>
      <div
        ref={ref}
        className={`relative w-full ${aspectClass} rounded-xl overflow-hidden border border-white/10 cursor-crosshair select-none touch-none`}
        onPointerDown={(e) => { e.preventDefault(); setDragging(true); setFromEvent(e.clientX, e.clientY); }}
        onPointerMove={(e) => { if (dragging) setFromEvent(e.clientX, e.clientY); }}
        onPointerUp={() => setDragging(false)}
        onPointerLeave={() => setDragging(false)}
      >
        <img
          src={imageSrc}
          alt={label}
          className="absolute inset-0 w-full h-full object-cover pointer-events-none"
          style={{ objectPosition: `${x}% ${y}%` }}
          draggable={false}
        />
        <div
          className="absolute w-6 h-6 -ml-3 -mt-3 rounded-full border-2 border-white shadow-[0_0_0_2px_rgba(0,0,0,0.5)] bg-[#d4af37]/50 pointer-events-none"
          style={{ left: `${x}%`, top: `${y}%` }}
        />
      </div>
      {hint && <p className="text-[8px] text-white/30 mt-1 uppercase tracking-widest">{hint}</p>}
    </div>
  );
}
