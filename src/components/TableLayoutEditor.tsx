import React, { useMemo, useRef, useState } from 'react';

type LayoutElementType = 'round-table' | 'rect-table' | 'stage' | 'dance-floor' | 'bar' | 'entry-exit' | 'restroom';

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
}

interface TableLayoutEditorProps {
  initialLayout: TableLayoutElement[];
  onSave: (layout: TableLayoutElement[]) => void;
  requiredTables?: number;
}

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;

const PALETTE: Array<{
  type: LayoutElementType;
  label: string;
  width: number;
  height: number;
  color: string;
  capacity?: number;
}> = [
  { type: 'round-table', label: 'Mesa Redonda', width: 80, height: 80, color: '#2a2a2a', capacity: 4 },
  { type: 'rect-table', label: 'Mesa Retangular', width: 120, height: 70, color: '#2a2a2a', capacity: 6 },
  { type: 'stage', label: 'Palco', width: 180, height: 80, color: '#1f2937' },
  { type: 'dance-floor', label: 'Pista de Dança', width: 200, height: 160, color: '#111827' },
  { type: 'bar', label: 'Bar', width: 140, height: 70, color: '#3f3f46' },
  { type: 'entry-exit', label: 'Entrada/Saída', width: 120, height: 60, color: '#374151' },
  { type: 'restroom', label: 'Banheiro', width: 100, height: 70, color: '#334155' }
];

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const TableLayoutEditor: React.FC<TableLayoutEditorProps> = ({ initialLayout, onSave, requiredTables }) => {
  const [elements, setElements] = useState<TableLayoutElement[]>(initialLayout);
  const [selectedId, setSelectedId] = useState<string | null>(initialLayout[0]?.id || null);
  const [zoom, setZoom] = useState(1);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLDivElement | null>(null);

  const selectedElement = useMemo(
    () => elements.find((el) => el.id === selectedId) || null,
    [elements, selectedId]
  );

  const tableCount = elements.filter(el => el.type === 'round-table' || el.type === 'rect-table').length;
  const tableCountMismatch = requiredTables !== undefined && tableCount !== requiredTables;

  const createElement = (type: LayoutElementType, x: number, y: number) => {
    const base = PALETTE.find((item) => item.type === type);
    if (!base) return;

    const next: TableLayoutElement = {
      id: `layout-${Math.random().toString(36).slice(2, 10)}`,
      type: base.type,
      x: clamp(x, 0, CANVAS_WIDTH - base.width),
      y: clamp(y, 0, CANVAS_HEIGHT - base.height),
      width: base.width,
      height: base.height,
      label: base.label,
      color: base.color,
      capacity: base.capacity
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
      y: (event.clientY - rect.top) / zoom - el.y
    });
  };

  const onMouseMoveCanvas = (event: React.MouseEvent) => {
    if (!draggingId || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const nextX = (event.clientX - rect.left) / zoom - dragOffset.x;
    const nextY = (event.clientY - rect.top) / zoom - dragOffset.y;
    setElements((prev) =>
      prev.map((el) =>
        el.id === draggingId
          ? {
              ...el,
              x: clamp(nextX, 0, CANVAS_WIDTH - el.width),
              y: clamp(nextY, 0, CANVAS_HEIGHT - el.height)
            }
          : el
      )
    );
  };

  const updateSelected = (updates: Partial<TableLayoutElement>) => {
    if (!selectedId) return;
    setElements((prev) => prev.map((el) => (el.id === selectedId ? { ...el, ...updates } : el)));
  };

  return (
    <div className="h-full grid grid-cols-1 xl:grid-cols-[260px_1fr_300px] gap-4">
      <aside className="bg-[#0d0d0d] border border-white/10 rounded-2xl p-4">
        <h4 className="text-[11px] uppercase tracking-widest font-bold text-[#d4af37] mb-4">Elementos</h4>
        <div className="space-y-2">
          {PALETTE.map((item) => (
            <div
              key={item.type}
              draggable
              onDragStart={(event) => event.dataTransfer.setData('application/layout-item', item.type)}
              className="p-3 rounded-xl border border-white/10 bg-white/[0.02] hover:border-[#d4af37]/40 cursor-grab active:cursor-grabbing transition text-sm"
            >
              {item.label}
            </div>
          ))}
        </div>
      </aside>

      <section className="bg-[#0d0d0d] border border-white/10 rounded-2xl p-4 overflow-auto">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <h4 className="text-[11px] uppercase tracking-widest font-bold text-white/70">Canvas</h4>
            {requiredTables !== undefined && (
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-widest ${tableCountMismatch ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}>
                Mesas: {tableCount}/{requiredTables}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setZoom((prev) => clamp(Number((prev - 0.25).toFixed(2)), 0.5, 2))}
              className="w-8 h-8 border border-white/10 rounded-lg hover:border-white/30"
            >
              -
            </button>
            <span className="text-xs opacity-60 min-w-[52px] text-center">{Math.round(zoom * 100)}%</span>
            <button
              onClick={() => setZoom((prev) => clamp(Number((prev + 0.25).toFixed(2)), 0.5, 2))}
              className="w-8 h-8 border border-white/10 rounded-lg hover:border-white/30"
            >
              +
            </button>
          </div>
        </div>

        <div className="overflow-auto rounded-xl border border-white/10 bg-[#0a0a0a]">
          <div
            ref={canvasRef}
            onDrop={onCanvasDrop}
            onDragOver={(event) => event.preventDefault()}
            onMouseMove={onMouseMoveCanvas}
            onMouseUp={() => setDraggingId(null)}
            onMouseLeave={() => setDraggingId(null)}
            onClick={(event) => {
              if (event.target === canvasRef.current) setSelectedId(null);
            }}
            className="origin-top-left relative"
            style={{
              width: `${CANVAS_WIDTH}px`,
              height: `${CANVAS_HEIGHT}px`,
              transform: `scale(${zoom})`,
              transformOrigin: 'top left',
              backgroundColor: '#0d0d0d',
              backgroundImage:
                'radial-gradient(circle, rgba(255,255,255,0.10) 1px, transparent 1px)',
              backgroundSize: '24px 24px'
            }}
          >
            {elements.map((el) => (
              <div
                key={el.id}
                onMouseDown={(event) => startDragElement(event, el.id)}
                onClick={(event) => {
                  event.stopPropagation();
                  setSelectedId(el.id);
                }}
                className="absolute select-none text-xs font-bold uppercase tracking-wide flex items-center justify-center"
                style={{
                  left: `${el.x}px`,
                  top: `${el.y}px`,
                  width: `${el.width}px`,
                  height: `${el.height}px`,
                  background: el.color,
                  border: selectedId === el.id ? '2px solid #d4af37' : '1px solid #ffffff20',
                  borderRadius: el.type.includes('round') ? '9999px' : '10px'
                }}
              >
                <span className="px-2 text-center text-white/90">{el.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <aside className="bg-[#0d0d0d] border border-white/10 rounded-2xl p-4">
        <h4 className="text-[11px] uppercase tracking-widest font-bold text-[#d4af37] mb-4">Propriedades</h4>
        {selectedElement ? (
          <div className="space-y-4">
            <div>
              <label className="block text-[10px] uppercase opacity-50 mb-1">Rótulo</label>
              <input
                value={selectedElement.label}
                onChange={(event) => updateSelected({ label: event.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            {typeof selectedElement.capacity === 'number' && (
              <div>
                <label className="block text-[10px] uppercase opacity-50 mb-1">Capacidade</label>
                <input
                  type="number"
                  min={1}
                  value={selectedElement.capacity}
                  onChange={(event) => updateSelected({ capacity: Number(event.target.value) || 1 })}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm"
                />
              </div>
            )}
            <div>
              <label className="block text-[10px] uppercase opacity-50 mb-1">Cor</label>
              <input
                type="color"
                value={selectedElement.color}
                onChange={(event) => updateSelected({ color: event.target.value })}
                className="w-full h-10 bg-white/5 border border-white/10 rounded-lg px-2"
              />
            </div>
            <button
              onClick={() => {
                setElements((prev) => prev.filter((el) => el.id !== selectedElement.id));
                setSelectedId(null);
              }}
              className="w-full py-2 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 text-xs uppercase tracking-widest font-bold"
            >
              Remover Elemento
            </button>
          </div>
        ) : (
          <p className="text-sm opacity-50">Selecione um elemento para editar.</p>
        )}

        <div className="pt-6 mt-6 border-t border-white/10 space-y-2">
          {tableCountMismatch && (
            <p className="text-[10px] text-red-400 text-center leading-relaxed">
              {tableCount < requiredTables!
                ? `Adicione mais ${requiredTables! - tableCount} mesa(s) ao layout`
                : `Remova ${tableCount - requiredTables!} mesa(s) — o evento tem ${requiredTables} mesas`}
            </p>
          )}
          <button
            onClick={() => onSave(elements)}
            disabled={tableCountMismatch}
            className="w-full py-2.5 bg-[#d4af37] text-black rounded-lg text-xs uppercase tracking-widest font-black hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Salvar Layout
          </button>
          <button
            onClick={() => {
              if (window.confirm('Deseja limpar todo o layout?')) {
                setElements([]);
                setSelectedId(null);
              }
            }}
            className="w-full py-2.5 border border-white/15 rounded-lg text-xs uppercase tracking-widest font-bold hover:bg-white/5"
          >
            Limpar Tudo
          </button>
        </div>
      </aside>
    </div>
  );
};
