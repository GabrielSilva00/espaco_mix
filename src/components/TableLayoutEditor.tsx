import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type LayoutElementType = 'round-table' | 'rect-table' | 'bistro-table' | 'stage' | 'dance-floor' | 'bar' | 'entry-exit' | 'restroom';

export interface TableLayoutElement {
  id: string;
  type: LayoutElementType;
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  color: string;
  capacity?: number;
  price?: number;
}

interface TableLayoutEditorProps {
  initialLayout: TableLayoutElement[];
  onSave: (layout: TableLayoutElement[], iconSize: number) => void;
  requiredTables?: number;
  initialIconSize?: number;
}

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const GRID_STEP = 24;
const ICON_SIZE_MIN = 30;
const ICON_SIZE_MAX = 120;
const ICON_SIZE_DEFAULT = 80;

const isTableType = (type: LayoutElementType) =>
  type === 'round-table' || type === 'rect-table' || type === 'bistro-table';

interface PaletteItem {
  type: LayoutElementType;
  label: string;
  baseWidth: number;
  baseHeight: number;
  color: string;
  capacity?: number;
  emoji: string;
}

const PALETTE: PaletteItem[] = [
  { type: 'round-table',  label: 'Mesa Redonda',     baseWidth: 80,  baseHeight: 80,  color: '#1e293b', capacity: 4,  emoji: '⭕' },
  { type: 'rect-table',   label: 'Mesa Retangular',   baseWidth: 120, baseHeight: 70,  color: '#1e293b', capacity: 6,  emoji: '▬' },
  { type: 'bistro-table', label: 'Bistrô',            baseWidth: 60,  baseHeight: 60,  color: '#451a03', capacity: 2,  emoji: '🍷' },
  { type: 'stage',        label: 'Palco',             baseWidth: 180, baseHeight: 80,  color: '#1f2937', emoji: '🎤' },
  { type: 'dance-floor',  label: 'Pista de Dança',    baseWidth: 200, baseHeight: 160, color: '#111827', emoji: '💃' },
  { type: 'bar',          label: 'Bar',               baseWidth: 140, baseHeight: 70,  color: '#3f3f46', emoji: '🍺' },
  { type: 'entry-exit',   label: 'Entrada/Saída',     baseWidth: 120, baseHeight: 60,  color: '#374151', emoji: '🚪' },
  { type: 'restroom',     label: 'Banheiro',          baseWidth: 100, baseHeight: 70,  color: '#334155', emoji: '🚻' },
];

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const snapToGrid = (value: number) => Math.round(value / GRID_STEP) * GRID_STEP;

export const TableLayoutEditor: React.FC<TableLayoutEditorProps> = ({
  initialLayout,
  onSave,
  requiredTables,
  initialIconSize,
}) => {
  const [elements, setElements] = useState<TableLayoutElement[]>(initialLayout);
  const [selectedId, setSelectedId] = useState<string | null>(initialLayout[0]?.id ?? null);
  const [zoom, setZoom] = useState(1);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [iconSize, setIconSize] = useState(initialIconSize ?? ICON_SIZE_DEFAULT);
  const [snap, setSnap] = useState(true);
  const [confirmClear, setConfirmClear] = useState(false);
  const canvasRef = useRef<HTMLDivElement | null>(null);

  const selectedElement = useMemo(
    () => elements.find((el) => el.id === selectedId) ?? null,
    [elements, selectedId]
  );

  const tableCount = elements.filter(el => isTableType(el.type)).length;
  const bistroCount = elements.filter(el => el.type === 'bistro-table').length;
  const tableCountMismatch = requiredTables !== undefined && tableCount !== requiredTables;

  const applySnap = useCallback((v: number) => snap ? snapToGrid(v) : v, [snap]);

  const createElement = (type: LayoutElementType, rawX: number, rawY: number) => {
    const base = PALETTE.find((item) => item.type === type);
    if (!base) return;

    const isTable = isTableType(type);
    const scaledSize = isTable ? iconSize : undefined;
    const w = scaledSize ?? base.baseWidth;
    const h = type === 'bistro-table' ? w : (scaledSize ?? base.baseHeight);

    const next: TableLayoutElement = {
      id: `layout-${Math.random().toString(36).slice(2, 10)}`,
      type: base.type,
      x: clamp(applySnap(rawX - w / 2), 0, CANVAS_WIDTH - w),
      y: clamp(applySnap(rawY - h / 2), 0, CANVAS_HEIGHT - h),
      width: w,
      height: h,
      label: base.label,
      color: base.color,
      capacity: base.capacity,
    };

    setElements((prev) => [...prev, next]);
    setSelectedId(next.id);
  };

  const onCanvasDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const droppedType = event.dataTransfer.getData('application/layout-item') as LayoutElementType;
    if (!droppedType || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = (event.clientX - rect.left) / zoom;
    const y = (event.clientY - rect.top) / zoom;
    createElement(droppedType, x, y);
  };

  const startDragElement = (event: React.MouseEvent, id: string) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const el = elements.find((item) => item.id === id);
    if (!el) return;
    setDraggingId(id);
    setSelectedId(id);
    setDragOffset({
      x: (event.clientX - rect.left) / zoom - el.x,
      y: (event.clientY - rect.top) / zoom - el.y,
    });
  };

  const onMouseMoveCanvas = (event: React.MouseEvent) => {
    if (!draggingId || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const rawX = (event.clientX - rect.left) / zoom - dragOffset.x;
    const rawY = (event.clientY - rect.top) / zoom - dragOffset.y;
    setElements((prev) =>
      prev.map((el) =>
        el.id === draggingId
          ? {
              ...el,
              x: clamp(applySnap(rawX), 0, CANVAS_WIDTH - el.width),
              y: clamp(applySnap(rawY), 0, CANVAS_HEIGHT - el.height),
            }
          : el
      )
    );
  };

  const updateSelected = (updates: Partial<TableLayoutElement>) => {
    if (!selectedId) return;
    setElements((prev) => prev.map((el) => (el.id === selectedId ? { ...el, ...updates } : el)));
  };

  // Keyboard shortcuts for moving selected element
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (!selectedId) return;
      const step = e.shiftKey ? 1 : GRID_STEP;
      const moves: Record<string, { dx: number; dy: number }> = {
        ArrowLeft:  { dx: -step, dy: 0 },
        ArrowRight: { dx: step,  dy: 0 },
        ArrowUp:    { dx: 0,     dy: -step },
        ArrowDown:  { dx: 0,     dy: step },
      };
      if (!moves[e.key]) return;
      if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)) e.preventDefault();
      const { dx, dy } = moves[e.key];
      setElements((prev) =>
        prev.map((el) =>
          el.id === selectedId
            ? {
                ...el,
                x: clamp(el.x + dx, 0, CANVAS_WIDTH - el.width),
                y: clamp(el.y + dy, 0, CANVAS_HEIGHT - el.height),
              }
            : el
        )
      );
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [selectedId]);

  // Apply iconSize change to all existing table elements
  const applyIconSizeToAll = () => {
    setElements((prev) =>
      prev.map((el) => {
        if (!isTableType(el.type)) return el;
        const isBistro = el.type === 'bistro-table';
        const size = isBistro ? Math.round(iconSize * 0.75) : iconSize;
        return { ...el, width: size, height: size };
      })
    );
  };

  const elementColorStyle = (el: TableLayoutElement, isSelected: boolean) => {
    if (el.type === 'bistro-table') {
      return {
        background: isSelected ? '#92400e' : '#451a03',
        border: isSelected ? '2px solid #f59e0b' : '1px solid #78350f',
      };
    }
    if (isTableType(el.type)) {
      return {
        background: el.color,
        border: isSelected ? '2px solid #d4af37' : '1px solid #ffffff20',
      };
    }
    return {
      background: el.color,
      border: isSelected ? '2px solid #d4af37' : '1px solid #ffffff20',
    };
  };

  return (
    <div className="h-full grid grid-cols-1 xl:grid-cols-[260px_1fr_300px] gap-4">

      {/* Left: Palette */}
      <aside className="bg-[#0d0d0d] border border-white/10 rounded-2xl p-4 flex flex-col gap-4">
        <div>
          <h4 className="text-[11px] uppercase tracking-widest font-bold text-[#d4af37] mb-3">Elementos</h4>
          <div className="space-y-1.5">
            {PALETTE.map((item) => (
              <div
                key={item.type}
                draggable
                onDragStart={(e) => e.dataTransfer.setData('application/layout-item', item.type)}
                className={`p-2.5 rounded-xl border cursor-grab active:cursor-grabbing transition text-sm flex items-center gap-2.5
                  ${item.type === 'bistro-table'
                    ? 'border-amber-700/40 bg-amber-950/30 hover:border-amber-500/60 text-amber-300'
                    : isTableType(item.type)
                      ? 'border-white/10 bg-white/[0.02] hover:border-[#d4af37]/40 text-white'
                      : 'border-white/5 bg-transparent hover:border-white/20 text-white/60'
                  }`}
              >
                <span className="text-base">{item.emoji}</span>
                <span className="text-xs font-medium">{item.label}</span>
                {item.capacity && (
                  <span className="ml-auto text-[9px] opacity-50 uppercase tracking-wide">{item.capacity}p</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Icon Size Slider */}
        <div className="pt-4 border-t border-white/10">
          <div className="flex items-center justify-between mb-2">
            <label className="text-[10px] uppercase tracking-widest font-bold text-white/50">Tamanho dos Ícones</label>
            <span className="text-[11px] font-mono text-[#d4af37]">{iconSize}px</span>
          </div>
          <input
            type="range"
            min={ICON_SIZE_MIN}
            max={ICON_SIZE_MAX}
            step={5}
            value={iconSize}
            onChange={(e) => setIconSize(Number(e.target.value))}
            className="w-full accent-[#d4af37] cursor-pointer"
          />
          <div className="flex justify-between text-[9px] text-white/30 mt-1">
            <span>{ICON_SIZE_MIN}px</span>
            <span>{ICON_SIZE_MAX}px</span>
          </div>
          <button
            onClick={applyIconSizeToAll}
            className="mt-2 w-full py-1.5 text-[9px] uppercase tracking-widest font-bold border border-white/10 rounded-lg hover:bg-white/5 transition text-white/60"
          >
            Aplicar a Todos
          </button>
        </div>

        {/* Snap to Grid */}
        <div className="flex items-center justify-between pt-3 border-t border-white/10">
          <span className="text-[10px] uppercase tracking-widest text-white/50">Snap ao Grid</span>
          <button
            onClick={() => setSnap(p => !p)}
            className={`w-10 h-5 rounded-full relative transition-colors ${snap ? 'bg-[#d4af37]' : 'bg-white/10'}`}
          >
            <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-transform ${snap ? 'translate-x-5' : 'translate-x-0.5'}`} />
          </button>
        </div>

        <p className="text-[9px] text-white/25 leading-relaxed">
          Teclas de seta movem o elemento selecionado. Shift+seta move 1px por vez.
        </p>
      </aside>

      {/* Center: Canvas */}
      <section className="bg-[#0d0d0d] border border-white/10 rounded-2xl p-4 overflow-auto flex flex-col">
        <div className="flex items-center justify-between mb-3 shrink-0">
          <div className="flex items-center gap-3">
            <h4 className="text-[11px] uppercase tracking-widest font-bold text-white/70">Canvas</h4>
            {requiredTables !== undefined && (
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-widest ${tableCountMismatch ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}>
                Mesas: {tableCount}/{requiredTables}
                {bistroCount > 0 && ` (${bistroCount} bistrô)`}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setZoom((prev) => clamp(Number((prev - 0.25).toFixed(2)), 0.5, 2))}
              className="w-8 h-8 border border-white/10 rounded-lg hover:border-white/30 text-white text-lg flex items-center justify-center"
            >−</button>
            <span className="text-xs opacity-60 min-w-[52px] text-center">{Math.round(zoom * 100)}%</span>
            <button
              onClick={() => setZoom((prev) => clamp(Number((prev + 0.25).toFixed(2)), 0.5, 2))}
              className="w-8 h-8 border border-white/10 rounded-lg hover:border-white/30 text-white text-lg flex items-center justify-center"
            >+</button>
          </div>
        </div>

        <div className="overflow-auto rounded-xl border border-white/10 bg-[#0a0a0a] flex-1">
          <div
            ref={canvasRef}
            onDrop={onCanvasDrop}
            onDragOver={(e) => e.preventDefault()}
            onMouseMove={onMouseMoveCanvas}
            onMouseUp={() => setDraggingId(null)}
            onMouseLeave={() => setDraggingId(null)}
            onClick={(e) => { if (e.target === canvasRef.current) setSelectedId(null); }}
            className="origin-top-left relative select-none"
            style={{
              width: `${CANVAS_WIDTH}px`,
              height: `${CANVAS_HEIGHT}px`,
              transform: `scale(${zoom})`,
              transformOrigin: 'top left',
              backgroundColor: '#0d0d0d',
              backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.10) 1px, transparent 1px)',
              backgroundSize: `${GRID_STEP}px ${GRID_STEP}px`,
              cursor: draggingId ? 'grabbing' : 'default',
            }}
          >
            {elements.map((el) => {
              const isSelected = selectedId === el.id;
              const styles = elementColorStyle(el, isSelected);
              const isBistro = el.type === 'bistro-table';
              return (
                <div
                  key={el.id}
                  onMouseDown={(e) => startDragElement(e, el.id)}
                  onClick={(e) => { e.stopPropagation(); setSelectedId(el.id); }}
                  className="absolute text-xs font-bold uppercase tracking-wide flex flex-col items-center justify-center cursor-grab active:cursor-grabbing transition-shadow"
                  style={{
                    left: `${el.x}px`,
                    top: `${el.y}px`,
                    width: `${el.width}px`,
                    height: `${el.height}px`,
                    ...styles,
                    borderRadius: el.type === 'round-table' || el.type === 'bistro-table' ? '9999px' : '10px',
                    boxShadow: isSelected
                      ? isBistro
                        ? '0 0 16px rgba(245,158,11,0.3)'
                        : '0 0 16px rgba(212,175,55,0.2)'
                      : 'none',
                  }}
                >
                  {isBistro ? (
                    <>
                      <span className="text-base leading-none">🍷</span>
                      <span className="text-[8px] text-amber-400 mt-0.5 px-1 text-center leading-none truncate w-full text-center">{el.label}</span>
                    </>
                  ) : (
                    <span className="px-2 text-center text-white/90 text-[9px] leading-tight">{el.label}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Right: Properties */}
      <aside className="bg-[#0d0d0d] border border-white/10 rounded-2xl p-4 flex flex-col">
        <h4 className="text-[11px] uppercase tracking-widest font-bold text-[#d4af37] mb-4">Propriedades</h4>

        {selectedElement ? (
          <div className="space-y-4 flex-1">
            {/* Type badge */}
            <div className={`text-[9px] uppercase tracking-widest font-bold px-2 py-1 rounded-full inline-flex items-center gap-1 w-fit
              ${selectedElement.type === 'bistro-table'
                ? 'bg-amber-900/40 text-amber-400 border border-amber-700/40'
                : isTableType(selectedElement.type)
                  ? 'bg-[#d4af37]/10 text-[#d4af37] border border-[#d4af37]/20'
                  : 'bg-white/5 text-white/50 border border-white/10'
              }`}
            >
              {PALETTE.find(p => p.type === selectedElement.type)?.emoji}
              {' '}{PALETTE.find(p => p.type === selectedElement.type)?.label ?? selectedElement.type}
            </div>

            <div>
              <label className="block text-[10px] uppercase opacity-50 mb-1">Rótulo</label>
              <input
                value={selectedElement.label}
                onChange={(e) => updateSelected({ label: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:border-[#d4af37] outline-none transition"
              />
            </div>

            {typeof selectedElement.capacity === 'number' && (
              <div>
                <label className="block text-[10px] uppercase opacity-50 mb-1">Capacidade (pessoas)</label>
                <input
                  type="number"
                  min={1}
                  value={selectedElement.capacity}
                  onChange={(e) => updateSelected({ capacity: Number(e.target.value) || 1 })}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:border-[#d4af37] outline-none transition"
                />
              </div>
            )}

            {isTableType(selectedElement.type) && (
              <div>
                <label className="block text-[10px] uppercase opacity-50 mb-1">Preço (R$) — opcional</label>
                <input
                  type="number"
                  min={0}
                  step={10}
                  placeholder="Usa preço padrão do evento"
                  value={selectedElement.price ?? ''}
                  onChange={(e) => updateSelected({ price: e.target.value !== '' ? Number(e.target.value) : undefined })}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:border-[#d4af37] outline-none transition placeholder:opacity-30"
                />
              </div>
            )}

            <div>
              <label className="block text-[10px] uppercase opacity-50 mb-1">Cor</label>
              <input
                type="color"
                value={selectedElement.color}
                onChange={(e) => updateSelected({ color: e.target.value })}
                className="w-full h-10 bg-white/5 border border-white/10 rounded-lg px-2 cursor-pointer"
              />
            </div>

            <div className="grid grid-cols-2 gap-2 text-[9px] text-white/30">
              <div>X: {Math.round(selectedElement.x)}px</div>
              <div>Y: {Math.round(selectedElement.y)}px</div>
              <div>L: {selectedElement.width}px</div>
              <div>A: {selectedElement.height}px</div>
            </div>

            <button
              onClick={() => {
                setElements((prev) => prev.filter((el) => el.id !== selectedElement.id));
                setSelectedId(null);
              }}
              className="w-full py-2 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 text-xs uppercase tracking-widest font-bold transition"
            >
              Remover Elemento
            </button>
          </div>
        ) : (
          <p className="text-sm opacity-30 flex-1">Selecione um elemento para editar.</p>
        )}

        <div className="pt-6 mt-auto border-t border-white/10 space-y-2">
          {tableCountMismatch && (
            <p className="text-[10px] text-red-400 text-center leading-relaxed">
              {tableCount < requiredTables!
                ? `Adicione mais ${requiredTables! - tableCount} mesa(s) ao layout`
                : `Remova ${tableCount - requiredTables!} mesa(s) — o evento tem ${requiredTables}`}
            </p>
          )}
          <button
            onClick={() => onSave(elements, iconSize)}
            disabled={tableCountMismatch}
            className="w-full py-2.5 bg-[#d4af37] text-black rounded-lg text-xs uppercase tracking-widest font-black hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            Salvar Layout
          </button>
          <button
            onClick={() => setConfirmClear(true)}
            className="w-full py-2.5 border border-white/15 rounded-lg text-xs uppercase tracking-widest font-bold hover:bg-white/5 transition"
          >
            Limpar Tudo
          </button>
        </div>
      </aside>

      {/* Confirmation dialog */}
      {confirmClear && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#111] border border-white/10 rounded-2xl p-6 max-w-sm w-full mx-4 space-y-4 shadow-2xl">
            <h3 className="text-base font-serif text-white">Limpar layout?</h3>
            <p className="text-sm text-white/50">Todos os elementos serão removidos. Esta ação não pode ser desfeita.</p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirmClear(false)}
                className="px-4 py-2 rounded-lg border border-white/10 text-sm hover:bg-white/5 transition"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  setElements([]);
                  setSelectedId(null);
                  setConfirmClear(false);
                }}
                className="px-4 py-2 rounded-lg bg-red-500/20 border border-red-500/30 text-red-400 text-sm font-bold hover:bg-red-500/30 transition"
              >
                Limpar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
