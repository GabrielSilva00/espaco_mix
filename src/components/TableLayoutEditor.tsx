import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { TableLayoutElement, LayoutElementType } from '../types';

export type { TableLayoutElement };

interface TableLayoutEditorProps {
  initialLayout: TableLayoutElement[];
  defaultLayout?: TableLayoutElement[];
  onSave: (layout: TableLayoutElement[], iconSize: number) => void;
  requiredTables?: number;
  requiredBistros?: number;
  initialIconSize?: number;
}

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 1100;
const GRID_STEP = 20;
// y=220 matches stage bottom in SVG reference (rect y=70, height=150 → bottom at y=220)
const STAGE_HEIGHT = 220;
const MESA_SIZE = 64;
const BISTRO_SIZE = 54;
const ENTRY_W = 120;
const ENTRY_H = 48;
const ZOOM_MIN = 0.3;
const ZOOM_MAX = 2.0;

type PaletteType = 'rect-table' | 'bistro-table' | 'entry-exit';

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const snapTo = (v: number) => Math.round(v / GRID_STEP) * GRID_STEP;

function nextMesaLabel(elements: TableLayoutElement[]): string {
  const nums = elements
    .filter(el => el.type === 'rect-table' || el.type === 'round-table')
    .map(el => parseInt(el.label) || 0)
    .filter(n => n > 0);
  return String(nums.length > 0 ? Math.max(...nums) + 1 : 1).padStart(2, '0');
}

function nextBistroLabel(elements: TableLayoutElement[]): string {
  const nums = elements
    .filter(el => el.type === 'bistro-table')
    .map(el => { const m = el.label.match(/\d+/); return m ? parseInt(m[0]) : 0; })
    .filter(n => n > 0);
  return `B${nums.length > 0 ? Math.max(...nums) + 1 : 1}`;
}

// After removing a mesa, renumber remaining mesas sequentially (01, 02, …)
function reorderMesaLabels(elements: TableLayoutElement[]): TableLayoutElement[] {
  let mesaIndex = 0;
  return elements.map(el => {
    if (el.type !== 'rect-table' && el.type !== 'round-table') return el;
    mesaIndex++;
    return { ...el, label: String(mesaIndex).padStart(2, '0') };
  });
}

// After removing a bistrô, renumber remaining bistrôs sequentially (B1, B2, …)
function reorderBistroLabels(elements: TableLayoutElement[]): TableLayoutElement[] {
  let bistroIndex = 0;
  return elements.map(el => {
    if (el.type !== 'bistro-table') return el;
    bistroIndex++;
    return { ...el, label: `B${bistroIndex}` };
  });
}

function MesaIconSVG({ label, selected }: { label: string; selected?: boolean }) {
  const tampo = selected ? '#f5c842' : '#C9A84C';
  const chair = selected ? '#8B7000' : '#555';
  return (
    <svg viewBox="-15 -15 65 65" width="100%" height="100%" style={{ display: 'block', overflow: 'visible' }}>
      <rect x="-12" y="10" width="12" height="12" rx="2" fill={chair} />
      <rect x="35" y="10" width="12" height="12" rx="2" fill={chair} />
      <rect x="12" y="-12" width="12" height="12" rx="2" fill={chair} />
      <rect x="12" y="35" width="12" height="12" rx="2" fill={chair} />
      <rect width="35" height="35" rx="3" fill={tampo} stroke="#111" strokeWidth="1.5" />
      <text x="17.5" y="23" textAnchor="middle" fontSize="12" fontWeight="bold" fill="#1a1a1a">{label}</text>
    </svg>
  );
}

function BistroIconSVG({ label, selected }: { label: string; selected?: boolean }) {
  const stroke = selected ? '#f5c842' : '#C9A84C';
  return (
    <svg viewBox="-5 -5 50 50" width="100%" height="100%" style={{ display: 'block', overflow: 'visible' }}>
      <circle cx="20" cy="20" r="20" fill="#8B4513" stroke={stroke} strokeWidth={selected ? 3 : 2} />
      <text x="20" y="25" textAnchor="middle" fontSize="11" fontWeight="bold" fill="#C9A84C">{label}</text>
    </svg>
  );
}

export const TableLayoutEditor: React.FC<TableLayoutEditorProps> = ({
  initialLayout,
  defaultLayout,
  onSave,
  requiredTables,
  requiredBistros,
}) => {
  const [savedInitialLayout] = useState<TableLayoutElement[]>(() => [...initialLayout]);
  const [confirmRestore, setConfirmRestore] = useState(false);
  const [elements, setElements] = useState<TableLayoutElement[]>(initialLayout);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [confirmClear, setConfirmClear] = useState(false);
  const [limitMsg, setLimitMsg] = useState('');
  const [convertMode, setConvertMode] = useState<'toMesa' | 'toBistro'>('toBistro');
  const canvasRef = useRef<HTMLDivElement>(null);
  const canvasSectionRef = useRef<HTMLDivElement>(null);

  // Auto-fit zoom ao carregar: encaixa o canvas na largura disponível
  useEffect(() => {
    if (!canvasSectionRef.current) return;
    const available = canvasSectionRef.current.clientWidth - 48; // desconta padding e borda
    if (available < CANVAS_WIDTH) {
      const fit = Math.max(ZOOM_MIN, Number((available / CANVAS_WIDTH).toFixed(1)));
      setZoom(fit);
    }
  }, []);

  const selectedElement = elements.find(el => el.id === selectedId) ?? null;
  const mesaCount = elements.filter(el => el.type === 'rect-table' || el.type === 'round-table').length;
  const bistroCount = elements.filter(el => el.type === 'bistro-table').length;
  const mesaExceeded = requiredTables !== undefined && mesaCount > requiredTables;
  const bistroExceeded = requiredBistros !== undefined && bistroCount > requiredBistros;
  const canSave = !mesaExceeded && !bistroExceeded;
  const hasMesas = mesaCount > 0;
  const hasBistros = bistroCount > 0;

  const applySnap = useCallback((v: number) => snapEnabled ? snapTo(v) : v, [snapEnabled]);

  const showLimit = (msg: string) => {
    setLimitMsg(msg);
    setTimeout(() => setLimitMsg(''), 2500);
  };

  const createElement = (type: PaletteType, rawX: number, rawY: number) => {
    if (type === 'rect-table' && requiredTables !== undefined && mesaCount >= requiredTables) {
      showLimit(`Limite de ${requiredTables} mesa(s) atingido`);
      return;
    }
    if (type === 'bistro-table' && requiredBistros !== undefined && bistroCount >= requiredBistros) {
      showLimit(`Limite de ${requiredBistros} bistrô(s) atingido`);
      return;
    }

    const isMesa = type === 'rect-table';
    const isBistro = type === 'bistro-table';
    const w = isMesa ? MESA_SIZE : isBistro ? BISTRO_SIZE : ENTRY_W;
    const h = isMesa ? MESA_SIZE : isBistro ? BISTRO_SIZE : ENTRY_H;
    const label = isMesa ? nextMesaLabel(elements) : isBistro ? nextBistroLabel(elements) : 'Entrada';
    const minY = STAGE_HEIGHT + 10;

    const el: TableLayoutElement = {
      id: `el-${Math.random().toString(36).slice(2, 10)}`,
      type,
      x: clamp(applySnap(rawX - w / 2), 0, CANVAS_WIDTH - w),
      y: clamp(applySnap(rawY - h / 2), minY, CANVAS_HEIGHT - h),
      width: w,
      height: h,
      label,
      color: isMesa ? '#C9A84C' : isBistro ? '#8B4513' : '#374151',
      capacity: isMesa ? 4 : isBistro ? 2 : undefined,
    };

    setElements(prev => [...prev, el]);
    setSelectedId(el.id);
  };

  const onCanvasDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const type = event.dataTransfer.getData('application/layout-item') as PaletteType;
    if (!type || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    createElement(type, (event.clientX - rect.left) / zoom, (event.clientY - rect.top) / zoom);
  };

  const startDrag = (event: React.MouseEvent, id: string) => {
    if (!canvasRef.current) return;
    event.stopPropagation();
    const rect = canvasRef.current.getBoundingClientRect();
    const el = elements.find(e => e.id === id);
    if (!el) return;
    setDraggingId(id);
    setSelectedId(id);
    setDragOffset({
      x: (event.clientX - rect.left) / zoom - el.x,
      y: (event.clientY - rect.top) / zoom - el.y,
    });
  };

  const onMouseMove = (event: React.MouseEvent) => {
    if (!draggingId || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const rawX = (event.clientX - rect.left) / zoom - dragOffset.x;
    const rawY = (event.clientY - rect.top) / zoom - dragOffset.y;
    setElements(prev =>
      prev.map(el => el.id !== draggingId ? el : {
        ...el,
        x: clamp(applySnap(rawX), 0, CANVAS_WIDTH - el.width),
        y: clamp(applySnap(rawY), STAGE_HEIGHT + 5, CANVAS_HEIGHT - el.height),
      })
    );
  };

  const updateSelected = (updates: Partial<TableLayoutElement>) => {
    if (!selectedId) return;
    setElements(prev => prev.map(el => el.id === selectedId ? { ...el, ...updates } : el));
  };

  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      if (!selectedId) return;
      const moves: Record<string, { dx: number; dy: number }> = {
        ArrowLeft: { dx: -GRID_STEP, dy: 0 },
        ArrowRight: { dx: GRID_STEP, dy: 0 },
        ArrowUp: { dx: 0, dy: -GRID_STEP },
        ArrowDown: { dx: 0, dy: GRID_STEP },
      };
      if (!moves[e.key]) return;
      e.preventDefault();
      const { dx, dy } = moves[e.key];
      setElements(prev =>
        prev.map(el => el.id !== selectedId ? el : {
          ...el,
          x: clamp(el.x + dx, 0, CANVAS_WIDTH - el.width),
          y: clamp(el.y + dy, STAGE_HEIGHT + 5, CANVAS_HEIGHT - el.height),
        })
      );
    };
    window.addEventListener('keydown', handle);
    return () => window.removeEventListener('keydown', handle);
  }, [selectedId]);

  const palette: { type: PaletteType; label: string; capacity?: number }[] = [
    { type: 'rect-table', label: 'MESA', capacity: 4 },
    { type: 'bistro-table', label: 'BISTRÔ', capacity: 2 },
    { type: 'entry-exit', label: 'Entrada/Saída' },
  ];

  return (
    <div className="h-full grid grid-cols-1 xl:grid-cols-[240px_1fr_280px] gap-4">

      {/* Left: Palette */}
      <aside className="bg-[#0d0d0d] border border-white/10 rounded-2xl p-4 flex flex-col gap-4">
        <div>
          <h4 className="text-[11px] uppercase tracking-widest font-bold text-[#C9A84C] mb-3">Elementos</h4>
          <div className="space-y-2">
            {palette.map(item => {
              const isMesa = item.type === 'rect-table';
              const isBistro = item.type === 'bistro-table';
              const atLimit = isMesa
                ? (requiredTables !== undefined && mesaCount >= requiredTables)
                : isBistro
                ? (requiredBistros !== undefined && bistroCount >= requiredBistros)
                : false;
              return (
                <div
                  key={item.type}
                  draggable={!atLimit}
                  onDragStart={e => {
                    if (atLimit) { e.preventDefault(); return; }
                    e.dataTransfer.setData('application/layout-item', item.type);
                  }}
                  className={`p-3 rounded-xl border transition flex items-center gap-3 ${
                    atLimit ? 'border-white/5 opacity-30 cursor-not-allowed' :
                    isMesa ? 'border-[#C9A84C]/30 bg-[#C9A84C]/5 hover:border-[#C9A84C]/60 cursor-grab active:cursor-grabbing' :
                    isBistro ? 'border-amber-800/40 bg-amber-950/20 hover:border-[#C9A84C]/40 cursor-grab active:cursor-grabbing' :
                    'border-white/10 bg-white/[0.02] hover:border-white/20 cursor-grab active:cursor-grabbing'
                  }`}
                >
                  <div className="w-9 h-9 shrink-0">
                    {isMesa ? (
                      <svg viewBox="-15 -15 65 65" width="100%" height="100%">
                        <rect x="-12" y="10" width="12" height="12" rx="1" fill="#666" />
                        <rect x="35" y="10" width="12" height="12" rx="1" fill="#666" />
                        <rect x="12" y="-12" width="12" height="12" rx="1" fill="#666" />
                        <rect x="12" y="35" width="12" height="12" rx="1" fill="#666" />
                        <rect width="35" height="35" rx="3" fill="#C9A84C" stroke="#111" strokeWidth="1.5" />
                        <text x="17.5" y="23" textAnchor="middle" fontSize="10" fontWeight="bold" fill="#1a1a1a">M</text>
                      </svg>
                    ) : isBistro ? (
                      <svg viewBox="-5 -5 50 50" width="100%" height="100%">
                        <circle cx="20" cy="20" r="20" fill="#8B4513" stroke="#C9A84C" strokeWidth="2" />
                        <text x="20" y="25" textAnchor="middle" fontSize="11" fontWeight="bold" fill="#C9A84C">B</text>
                      </svg>
                    ) : (
                      <div className="w-full h-7 rounded bg-[#374151] border border-white/10 flex items-center justify-center text-white/40 text-[9px] font-bold">
                        ENT
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className={`text-xs font-bold ${isMesa ? 'text-[#C9A84C]' : isBistro ? 'text-amber-300' : 'text-white/50'}`}>
                      {item.label}
                    </span>
                    {item.capacity && (
                      <span className="text-[9px] text-white/30 block mt-0.5">{item.capacity} pessoas</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Counters */}
        <div className="pt-3 border-t border-white/10 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-widest text-white/40">Mesas</span>
            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${mesaExceeded ? 'bg-red-500/20 text-red-400' : mesaCount > 0 ? 'bg-[#C9A84C]/10 text-[#C9A84C]' : 'bg-white/5 text-white/40'}`}>
              {mesaCount}{requiredTables !== undefined ? `/${requiredTables}` : ''}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-widest text-white/40">Bistrôs</span>
            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${bistroExceeded ? 'bg-red-500/20 text-red-400' : bistroCount > 0 ? 'bg-amber-900/30 text-amber-400' : 'bg-white/5 text-white/40'}`}>
              {bistroCount}{requiredBistros !== undefined ? `/${requiredBistros}` : ''}
            </span>
          </div>
        </div>

        {/* Snap */}
        <div className="flex items-center justify-between pt-3 border-t border-white/10">
          <span className="text-[10px] uppercase tracking-widest text-white/40">Snap ao Grid</span>
          <button
            onClick={() => setSnapEnabled(p => !p)}
            className={`w-10 h-5 rounded-full relative transition-colors ${snapEnabled ? 'bg-[#C9A84C]' : 'bg-white/10'}`}
          >
            <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-transform ${snapEnabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
          </button>
        </div>
        <p className="text-[9px] text-white/20 leading-relaxed">Teclas de seta movem o elemento selecionado.</p>
      </aside>

      {/* Center: Canvas */}
      <section ref={canvasSectionRef} className="bg-[#0d0d0d] border border-white/10 rounded-2xl p-4 overflow-auto flex flex-col">
        <div className="flex items-center justify-between mb-3 shrink-0">
          <div className="flex items-center gap-3">
            <h4 className="text-[11px] uppercase tracking-widest font-bold text-white/50">Canvas</h4>
            {limitMsg && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 font-bold animate-pulse">
                {limitMsg}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setZoom(p => clamp(Number((p - 0.1).toFixed(2)), ZOOM_MIN, ZOOM_MAX))}
              className="w-8 h-8 border border-white/10 rounded-lg hover:border-white/30 text-white text-lg flex items-center justify-center">−</button>
            <span className="text-xs opacity-50 min-w-[48px] text-center">{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom(p => clamp(Number((p + 0.1).toFixed(2)), ZOOM_MIN, ZOOM_MAX))}
              className="w-8 h-8 border border-white/10 rounded-lg hover:border-white/30 text-white text-lg flex items-center justify-center">+</button>
          </div>
        </div>

        <div className="overflow-auto rounded-xl border border-white/10 flex-1" style={{ background: '#0a0a0a' }}>
          {/* Wrapper com dimensões visuais reais (zoom aplicado) para scroll correto */}
          <div style={{ width: `${CANVAS_WIDTH * zoom}px`, height: `${CANVAS_HEIGHT * zoom}px`, position: 'relative', flexShrink: 0 }}>
          <div
            ref={canvasRef}
            onDrop={onCanvasDrop}
            onDragOver={e => e.preventDefault()}
            onMouseMove={onMouseMove}
            onMouseUp={() => setDraggingId(null)}
            onMouseLeave={() => setDraggingId(null)}
            onClick={e => { if (e.target === canvasRef.current) setSelectedId(null); }}
            className="origin-top-left relative select-none"
            style={{
              width: `${CANVAS_WIDTH}px`,
              height: `${CANVAS_HEIGHT}px`,
              transform: `scale(${zoom})`,
              transformOrigin: 'top left',
              position: 'absolute',
              top: 0,
              left: 0,
              background: '#111',
              backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.07) 1px, transparent 1px)',
              backgroundSize: `${GRID_STEP}px ${GRID_STEP}px`,
              cursor: draggingId ? 'grabbing' : 'default',
            }}
          >
            {/* Fixed Stage — fiel ao SVG original, não arrastável */}
            <div
              style={{
                position: 'absolute', left: 0, top: 0,
                width: CANVAS_WIDTH, height: STAGE_HEIGHT,
                pointerEvents: 'none', zIndex: 10,
              }}
            >
              <svg width={CANVAS_WIDTH} height={STAGE_HEIGHT} viewBox={`0 0 ${CANVAS_WIDTH} ${STAGE_HEIGHT}`}>
                {/* Área acima do palco */}
                <text x={CANVAS_WIDTH / 2} y="50" textAnchor="middle" fill="rgba(255,255,255,0.18)" fontSize="11" letterSpacing="3">ÁREA DE CARGA E DESCARGA</text>
                {/* Rect principal do palco */}
                <rect x="50" y="70" width="650" height="150" fill="#1a1a1a" stroke="#C9A84C" strokeWidth="2" />
                {/* Label PALCO */}
                <text x="375" y="160" textAnchor="middle" fill="#C9A84C" fontSize="30" fontWeight="bold" letterSpacing="8" opacity="0.85">PALCO</text>
                {/* Módulo de degraus — canto inferior esquerdo do palco */}
                <rect x="50" y="160" width="75" height="60" fill="#151515" stroke="#C9A84C" strokeWidth="1.5" opacity="0.8" />
                <line x1="50" y1="175" x2="125" y2="175" stroke="#C9A84C" strokeWidth="1.2" opacity="0.5" />
                <line x1="50" y1="190" x2="125" y2="190" stroke="#C9A84C" strokeWidth="1.2" opacity="0.5" />
                <line x1="50" y1="205" x2="125" y2="205" stroke="#C9A84C" strokeWidth="1.2" opacity="0.5" />
              </svg>
            </div>

            {/* Draggable Elements */}
            {elements.map(el => {
              const isSelected = selectedId === el.id;
              const isMesa = el.type === 'rect-table' || el.type === 'round-table';
              const isBistro = el.type === 'bistro-table';

              return (
                <div
                  key={el.id}
                  onMouseDown={e => startDrag(e, el.id)}
                  onClick={e => { e.stopPropagation(); setSelectedId(el.id); }}
                  className="absolute cursor-grab active:cursor-grabbing"
                  style={{
                    left: el.x, top: el.y,
                    width: el.width, height: el.height,
                    zIndex: isSelected ? 20 : 5,
                    overflow: 'visible',
                    filter: isSelected ? 'drop-shadow(0 0 8px rgba(245,200,66,0.5))' : 'none',
                  }}
                >
                  {isMesa ? (
                    <MesaIconSVG label={el.label} selected={isSelected} />
                  ) : isBistro ? (
                    <BistroIconSVG label={el.label} selected={isSelected} />
                  ) : (
                    <div className={`w-full h-full rounded-lg flex items-center justify-center text-[10px] font-bold uppercase tracking-wide border ${isSelected ? 'border-[#f5c842] text-white/80' : 'border-white/20 text-white/50'} bg-[#374151]`}>
                      {el.label}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          </div>{/* fim wrapper de dimensão visual */}
        </div>
      </section>

      {/* Right: Properties */}
      <aside className="bg-[#0d0d0d] border border-white/10 rounded-2xl p-4 flex flex-col">
        <h4 className="text-[11px] uppercase tracking-widest font-bold text-[#C9A84C] mb-4">Propriedades</h4>

        {selectedElement ? (
          <div className="space-y-4 flex-1">
            <div className={`text-[9px] uppercase tracking-widest font-bold px-2 py-1 rounded-full inline-flex items-center gap-1 w-fit ${
              selectedElement.type === 'bistro-table' ? 'bg-amber-900/40 text-amber-400 border border-amber-700/40' :
              (selectedElement.type === 'rect-table' || selectedElement.type === 'round-table') ? 'bg-[#C9A84C]/10 text-[#C9A84C] border border-[#C9A84C]/20' :
              'bg-white/5 text-white/50 border border-white/10'
            }`}>
              {selectedElement.type === 'rect-table' || selectedElement.type === 'round-table' ? 'MESA' :
               selectedElement.type === 'bistro-table' ? 'BISTRÔ' : 'Entrada/Saída'}
            </div>

            {selectedElement.type === 'entry-exit' && (
              <div>
                <label className="block text-[10px] uppercase opacity-50 mb-1">Rótulo</label>
                <input
                  value={selectedElement.label}
                  onChange={e => updateSelected({ label: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:border-[#C9A84C] outline-none transition"
                />
              </div>
            )}

            {typeof selectedElement.capacity === 'number' && (
              <div>
                <label className="block text-[10px] uppercase opacity-50 mb-1">Capacidade (pessoas)</label>
                <input
                  type="number" min={1}
                  value={selectedElement.capacity}
                  onChange={e => updateSelected({ capacity: Number(e.target.value) || 1 })}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:border-[#C9A84C] outline-none transition"
                />
              </div>
            )}

            {(selectedElement.type === 'rect-table' || selectedElement.type === 'round-table' || selectedElement.type === 'bistro-table') && (
              <div>
                <label className="block text-[10px] uppercase opacity-50 mb-1">Preço (R$) — opcional</label>
                <input
                  type="number" min={0} step={10}
                  placeholder="Usa preço padrão do evento"
                  value={selectedElement.price ?? ''}
                  onChange={e => updateSelected({ price: e.target.value !== '' ? Number(e.target.value) : undefined })}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:border-[#C9A84C] outline-none transition placeholder:opacity-30"
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 text-[9px] text-white/25">
              <div>X: {Math.round(selectedElement.x)}px</div>
              <div>Y: {Math.round(selectedElement.y)}px</div>
              <div>L: {selectedElement.width}px</div>
              <div>A: {selectedElement.height}px</div>
            </div>

            {(selectedElement.type === 'rect-table' || selectedElement.type === 'bistro-table') && (
              <button
                onClick={() => {
                  const isMesa = selectedElement.type === 'rect-table';
                  const newType: LayoutElementType = isMesa ? 'bistro-table' : 'rect-table';
                  const newSize = isMesa ? BISTRO_SIZE : MESA_SIZE;
                  setElements(prev => {
                    let next = prev.map(el => el.id === selectedElement.id
                      ? { ...el, type: newType, width: newSize, height: newSize }
                      : el
                    );
                    next = reorderMesaLabels(next);
                    next = reorderBistroLabels(next);
                    return next;
                  });
                }}
                className="w-full py-2 rounded-lg border border-[#d4af37]/30 text-[#d4af37]/70 hover:bg-[#d4af37]/10 text-xs uppercase tracking-widest font-bold transition"
              >
                Converter para {selectedElement.type === 'rect-table' ? 'Bistrô' : 'Mesa'}
              </button>
            )}
            <button
              onClick={() => {
                const removedType = selectedElement.type;
                setElements(prev => {
                  let next = prev.filter(el => el.id !== selectedElement.id);
                  if (removedType === 'rect-table' || removedType === 'round-table') {
                    next = reorderMesaLabels(next);
                  } else if (removedType === 'bistro-table') {
                    next = reorderBistroLabels(next);
                  }
                  return next;
                });
                setSelectedId(null);
              }}
              className="w-full py-2 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 text-xs uppercase tracking-widest font-bold transition"
            >
              Remover Elemento
            </button>
          </div>
        ) : (
          <p className="text-sm opacity-25 flex-1">Selecione um elemento para editar.</p>
        )}

        <div className="pt-4 mt-auto border-t border-white/10 space-y-2">
          {mesaExceeded && (
            <p className="text-[10px] text-red-400 text-center leading-relaxed">
              Remova {mesaCount - requiredTables!} mesa(s) — limite: {requiredTables}
            </p>
          )}
          {bistroExceeded && (
            <p className="text-[10px] text-red-400 text-center leading-relaxed">
              Remova {bistroCount - requiredBistros!} bistrô(s) — limite: {requiredBistros}
            </p>
          )}
          <button
            onClick={() => {
              if (convertMode === 'toBistro') {
                setElements(prev => {
                  let next = prev.map(el =>
                    (el.type === 'rect-table' || el.type === 'round-table')
                      ? { ...el, type: 'bistro-table' as LayoutElementType, width: BISTRO_SIZE, height: BISTRO_SIZE }
                      : el
                  );
                  next = reorderBistroLabels(next);
                  return next;
                });
                setConvertMode('toMesa');
              } else {
                setElements(prev => {
                  let next = prev.map(el =>
                    el.type === 'bistro-table'
                      ? { ...el, type: 'rect-table' as LayoutElementType, width: MESA_SIZE, height: MESA_SIZE }
                      : el
                  );
                  next = reorderMesaLabels(next);
                  return next;
                });
                setConvertMode('toBistro');
              }
            }}
            className="w-full py-2 border border-[#C9A84C]/30 text-[#C9A84C]/70 hover:bg-[#C9A84C]/10 rounded-lg text-[10px] uppercase tracking-widest font-bold transition"
          >
            {convertMode === 'toBistro' ? 'Converter Tudo → Bistrô' : 'Converter Tudo → Mesa'}
          </button>
          <button
            onClick={() => onSave(elements, 80)}
            disabled={!canSave}
            className="w-full py-2.5 bg-[#C9A84C] text-black rounded-lg text-xs uppercase tracking-widest font-black hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            Salvar Layout
          </button>
          <button
            onClick={() => setConfirmRestore(true)}
            disabled={!(defaultLayout?.length || savedInitialLayout.length)}
            className="w-full py-2.5 border border-[#d4af37]/20 rounded-lg text-xs uppercase tracking-widest font-bold hover:bg-[#d4af37]/5 transition text-[#d4af37]/60 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Restaurar
          </button>
          <button
            onClick={() => setConfirmClear(true)}
            className="w-full py-2.5 border border-white/15 rounded-lg text-xs uppercase tracking-widest font-bold hover:bg-white/5 transition text-white/40"
          >
            Limpar Tudo
          </button>
        </div>
      </aside>

      {confirmClear && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#111] border border-white/10 rounded-2xl p-6 max-w-sm w-full mx-4 space-y-4 shadow-2xl">
            <h3 className="text-base font-serif text-white">Limpar layout?</h3>
            <p className="text-sm text-white/50">Todos os elementos serão removidos. Esta ação não pode ser desfeita.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfirmClear(false)} className="px-4 py-2 rounded-lg border border-white/10 text-sm hover:bg-white/5 transition text-white/70">Cancelar</button>
              <button onClick={() => { setElements([]); setSelectedId(null); setConfirmClear(false); }} className="px-4 py-2 rounded-lg bg-red-500/20 border border-red-500/30 text-red-400 text-sm font-bold hover:bg-red-500/30 transition">Limpar</button>
            </div>
          </div>
        </div>
      )}
      {confirmRestore && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#111] border border-white/10 rounded-2xl p-6 max-w-sm w-full mx-4 space-y-4 shadow-2xl">
            <h3 className="text-base font-serif text-[#d4af37]">Restaurar layout?</h3>
            <p className="text-sm text-white/50">O layout voltará ao estado inicial salvo. As alterações atuais serão perdidas.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfirmRestore(false)} className="px-4 py-2 rounded-lg border border-white/10 text-sm hover:bg-white/5 transition text-white/70">Cancelar</button>
              <button onClick={() => { setElements([...(defaultLayout ?? savedInitialLayout)]); setSelectedId(null); setConvertMode('toBistro'); setConfirmRestore(false); }} className="px-4 py-2 rounded-lg bg-[#d4af37]/20 border border-[#d4af37]/30 text-[#d4af37] text-sm font-bold hover:bg-[#d4af37]/30 transition">Restaurar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
