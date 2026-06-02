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
  [100, 315],                                                    // 01
  [100, 400], [230, 400], [360, 400], [490, 400],                // 02-05
  [100, 485], [230, 485], [360, 485], [490, 485], [620, 485],   // 06-10
  [100, 570], [230, 570], [360, 570], [490, 570], [620, 570],   // 11-15
  [100, 655], [230, 655], [360, 655], [490, 655], [620, 655],   // 16-20
  [100, 740], [230, 740], [360, 740], [490, 740], [620, 740],   // 21-25
  [100, 825], [230, 825], [360, 825], [490, 825], [620, 825],   // 26-30
];

const BISTRO_POSITIONS: [number, number][] = [
  [730, 475], [730, 555], [730, 635], [730, 715], [730, 795],   // B1-B5
  [620, 920], [510, 920], [400, 920], [290, 920], [170, 920],   // B6-B10
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
