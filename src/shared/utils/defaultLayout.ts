import type { TableLayoutElement, LayoutElementType } from '../../types';

export const SVG_CANVAS_WIDTH = 800;
export const SVG_CANVAS_HEIGHT = 1100;
export const MESA_SIZE = 64;
export const BISTRO_SIZE = 54;

// translateX/Y from the SVG reference file (ai_studio_code.html)
// Offset applied so the element center aligns with the SVG group origin
const MESA_TX_OFFSET = -15; // translateX + 17.5 (rect center) - 32 (half MESA_SIZE) ≈ -15
const BISTRO_TX_OFFSET = -27; // translateX - BISTRO_SIZE/2

// Positions extracted from ai_studio_code.html (transform="translate(x, y)")
const MESA_POSITIONS: [number, number][] = [
  [100, 350],                                                    // 01
  [100, 440], [230, 440], [360, 440], [490, 440],                // 02-05
  [100, 530], [230, 530], [360, 530], [490, 530], [620, 530],   // 06-10
  [100, 620], [230, 620], [360, 620], [490, 620], [620, 620],   // 11-15
  [100, 710], [230, 710], [360, 710], [490, 710], [620, 710],   // 16-20
  [100, 800], [230, 800], [360, 800], [490, 800], [620, 800],   // 21-25
  [100, 890], [230, 890], [360, 890], [490, 890], [620, 890],   // 26-30
];

const BISTRO_POSITIONS: [number, number][] = [
  [730, 520], [730, 600], [730, 680], [730, 760], [730, 840],   // B1-B5
  [620, 985], [510, 985], [400, 985], [290, 985], [170, 985],   // B6-B10
];

export function generateDefaultLayout(
  totalTables: number,
  totalBistros: number,
  seatsPerTable = 4,
): TableLayoutElement[] {
  const els: TableLayoutElement[] = [];

  const tableCount = Math.min(totalTables, MESA_POSITIONS.length);
  for (let i = 0; i < tableCount; i++) {
    const [tx, ty] = MESA_POSITIONS[i];
    els.push({
      id: `mesa-default-${i + 1}`,
      type: 'rect-table' as LayoutElementType,
      x: tx + MESA_TX_OFFSET,
      y: ty + MESA_TX_OFFSET,
      width: MESA_SIZE,
      height: MESA_SIZE,
      label: String(i + 1).padStart(2, '0'),
      color: '#C9A84C',
      capacity: seatsPerTable,
    });
  }

  const bistroCount = Math.min(totalBistros, BISTRO_POSITIONS.length);
  for (let i = 0; i < bistroCount; i++) {
    const [tx, ty] = BISTRO_POSITIONS[i];
    els.push({
      id: `bistro-default-${i + 1}`,
      type: 'bistro-table' as LayoutElementType,
      x: tx + BISTRO_TX_OFFSET,
      y: ty + BISTRO_TX_OFFSET,
      width: BISTRO_SIZE,
      height: BISTRO_SIZE,
      label: `B${i + 1}`,
      color: '#8B4513',
      capacity: 2,
    });
  }

  return els;
}

// Stage occupies y=70 to y=220 in SVG coordinates, so viewBox must start at 0
// and be at least 280px tall to show stage + gap to first mesa
export function getLayoutViewBox(elements: TableLayoutElement[]): string {
  if (elements.length === 0) return `0 0 ${SVG_CANVAS_WIDTH} 500`;
  const maxY = Math.max(...elements.map(el => el.y + el.height));
  const height = Math.max(500, maxY + 80);
  return `0 0 ${SVG_CANVAS_WIDTH} ${height}`;
}
