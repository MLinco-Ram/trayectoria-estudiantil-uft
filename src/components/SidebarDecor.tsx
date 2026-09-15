import React from 'react';

// Mosaico de pétalos en cuarto de círculo (estilo "Truchet tile") homogéneo y expandido
const PETAL_NAVY = '#0d2f52';
const PETAL_TEAL = '#0f7ea8';
const PETAL_CYAN = '#5ce1e6';
const PETAL_BLACK = '#0a0a0a';

type Petal = { col: number; row: number; corner: 'tl' | 'tr' | 'bl' | 'br'; color: string; r?: number };
type Dot = { col: number; row: number; color: string; r: number };

const CELL = 80;
const petalPath = (col: number, row: number, corner: Petal['corner'], r: number = CELL) => {
  const x0 = col * CELL;
  const y0 = row * CELL;
  const anchors: Record<Petal['corner'], [number, number, number, number, number, number]> = {
    tl: [x0, y0, x0 + r, y0, x0, y0 + r],
    tr: [x0 + CELL, y0, x0 + CELL - r, y0, x0 + CELL, y0 + r],
    bl: [x0, y0 + CELL, x0, y0 + CELL - r, x0 + r, y0 + CELL],
    br: [x0 + CELL, y0 + CELL, x0 + CELL, y0 + CELL - r, x0 + CELL - r, y0 + CELL],
  };
  const [cx, cy, sx, sy, ex, ey] = anchors[corner];
  return `M ${cx} ${cy} L ${sx} ${sy} A ${r} ${r} 0 0 1 ${ex} ${ey} Z`;
};

// Grilla homogénea de 6 columnas por 5 filas para un flujo continuo y orgánico
const PETALS: Petal[] = [
  // Fila 0
  { col: 1, row: 0, corner: 'br', color: PETAL_TEAL },
  { col: 2, row: 0, corner: 'bl', color: PETAL_NAVY },
  { col: 3, row: 0, corner: 'br', color: PETAL_CYAN },
  { col: 4, row: 0, corner: 'bl', color: PETAL_TEAL },
  { col: 5, row: 0, corner: 'tl', color: PETAL_NAVY },

  // Fila 1
  { col: 0, row: 1, corner: 'tr', color: PETAL_CYAN },
  { col: 1, row: 1, corner: 'tl', color: PETAL_NAVY },
  { col: 2, row: 1, corner: 'tl', color: PETAL_CYAN, r: CELL * 1.15 },
  { col: 3, row: 1, corner: 'bl', color: PETAL_BLACK, r: CELL * 0.7 },
  { col: 4, row: 1, corner: 'tr', color: PETAL_CYAN },
  { col: 5, row: 1, corner: 'bl', color: PETAL_TEAL },

  // Fila 2
  { col: 0, row: 2, corner: 'tr', color: PETAL_NAVY },
  { col: 1, row: 2, corner: 'tr', color: PETAL_TEAL },
  { col: 1, row: 2, corner: 'bl', color: PETAL_BLACK, r: CELL * 0.55 },
  { col: 2, row: 2, corner: 'tl', color: PETAL_TEAL },
  { col: 3, row: 2, corner: 'bl', color: PETAL_NAVY },
  { col: 4, row: 2, corner: 'tl', color: PETAL_NAVY },
  { col: 5, row: 2, corner: 'tr', color: PETAL_CYAN },

  // Fila 3
  { col: 0, row: 3, corner: 'br', color: PETAL_TEAL },
  { col: 1, row: 3, corner: 'bl', color: PETAL_NAVY },
  { col: 2, row: 3, corner: 'tr', color: PETAL_CYAN },
  { col: 3, row: 3, corner: 'tl', color: PETAL_TEAL, r: CELL * 1.1 },
  { col: 4, row: 3, corner: 'br', color: PETAL_CYAN },
  { col: 5, row: 3, corner: 'tl', color: PETAL_BLACK, r: CELL * 0.65 },

  // Fila 4
  { col: 1, row: 4, corner: 'tr', color: PETAL_NAVY },
  { col: 2, row: 4, corner: 'br', color: PETAL_TEAL },
  { col: 3, row: 4, corner: 'bl', color: PETAL_NAVY },
  { col: 4, row: 4, corner: 'tl', color: PETAL_TEAL },
  { col: 5, row: 4, corner: 'tr', color: PETAL_NAVY },
];

const DOTS: Dot[] = [
  { col: 1, row: 1, color: PETAL_NAVY, r: 12 },
  { col: 3, row: 1, color: PETAL_CYAN, r: 10 },
  { col: 2, row: 3, color: PETAL_NAVY, r: 10 },
  { col: 4, row: 2, color: PETAL_TEAL, r: 12 },
];

const GRID_COLS = 4;
const GRID_ROWS = 7;
const CELL_SIZE = 120;
const FULL_W = GRID_COLS * CELL_SIZE;
const FULL_H = GRID_ROWS * CELL_SIZE;

// 1 Mosaico completo, homogéneo y continuo en gran formato
const LARGE_PETALS: Petal[] = [
  // Fila 0
  { col: 1, row: 0, corner: 'br', color: PETAL_TEAL },
  { col: 2, row: 0, corner: 'bl', color: PETAL_NAVY },
  { col: 3, row: 0, corner: 'br', color: PETAL_CYAN },
  // Fila 1
  { col: 0, row: 1, corner: 'tr', color: PETAL_CYAN },
  { col: 1, row: 1, corner: 'tl', color: PETAL_NAVY },
  { col: 2, row: 1, corner: 'tl', color: PETAL_CYAN, r: CELL_SIZE * 1.15 },
  { col: 3, row: 1, corner: 'bl', color: PETAL_BLACK, r: CELL_SIZE * 0.75 },
  // Fila 2
  { col: 0, row: 2, corner: 'tr', color: PETAL_NAVY },
  { col: 1, row: 2, corner: 'tr', color: PETAL_TEAL },
  { col: 1, row: 2, corner: 'bl', color: PETAL_BLACK, r: CELL_SIZE * 0.6 },
  { col: 2, row: 2, corner: 'tl', color: PETAL_TEAL },
  { col: 3, row: 2, corner: 'bl', color: PETAL_NAVY },
  // Fila 3
  { col: 0, row: 3, corner: 'br', color: PETAL_TEAL },
  { col: 1, row: 3, corner: 'bl', color: PETAL_NAVY },
  { col: 2, row: 3, corner: 'tr', color: PETAL_CYAN },
  { col: 3, row: 3, corner: 'tl', color: PETAL_TEAL, r: CELL_SIZE * 1.1 },
  // Fila 4
  { col: 1, row: 4, corner: 'tr', color: PETAL_NAVY },
  { col: 2, row: 4, corner: 'br', color: PETAL_TEAL },
  { col: 3, row: 4, corner: 'bl', color: PETAL_BLACK, r: CELL_SIZE * 0.8 },
  // Fila 5
  { col: 0, row: 5, corner: 'tl', color: PETAL_CYAN },
  { col: 1, row: 5, corner: 'br', color: PETAL_TEAL },
  { col: 2, row: 5, corner: 'tl', color: PETAL_NAVY },
  { col: 3, row: 5, corner: 'tr', color: PETAL_CYAN },
  // Fila 6
  { col: 0, row: 6, corner: 'tr', color: PETAL_TEAL },
  { col: 1, row: 6, corner: 'bl', color: PETAL_NAVY },
  { col: 2, row: 6, corner: 'br', color: PETAL_CYAN },
  { col: 3, row: 6, corner: 'tl', color: PETAL_TEAL },
];

const LARGE_DOTS: Dot[] = [
  { col: 1, row: 1, color: PETAL_NAVY, r: 18 },
  { col: 3, row: 1, color: PETAL_CYAN, r: 14 },
  { col: 2, row: 3, color: PETAL_NAVY, r: 16 },
  { col: 3, row: 4, color: PETAL_TEAL, r: 15 },
  { col: 1, row: 5, color: PETAL_NAVY, r: 18 },
];

/**
 * 1 Mosaico completo en gran formato ubicado por detrás del sidebar en el lado izquierdo
 */
export function SidebarPetalStrip({ sidebarWidthPx = 288 }: { sidebarWidthPx?: number }) {
  return (
    <div
      className="hidden md:block fixed top-0 bottom-0 left-0 z-0 pointer-events-none select-none overflow-hidden h-full opacity-90 flex items-center"
      style={{
        width: '580px',
        maxWidth: '45vw',
      }}
      aria-hidden="true"
    >
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${FULL_W} ${FULL_H}`}
        preserveAspectRatio="xMinYMid slice"
      >
        {LARGE_PETALS.map((p, i) => (
          <path key={i} d={petalPath(p.col, p.row, p.corner, p.r)} fill={p.color} />
        ))}
        {LARGE_DOTS.map((d, i) => (
          <circle key={i} cx={d.col * CELL_SIZE + CELL_SIZE / 2} cy={d.row * CELL_SIZE + CELL_SIZE / 2} r={d.r} fill={d.color} />
        ))}
      </svg>
    </div>
  );
}

/**
 * Adorno decorativo homogéneo en formato extra grande para la esquina
 */
export function DashboardCornerOrnament({ size = 1050 }: { size?: number }) {
  return <SidebarPetalStrip />;
}

export function SidebarFinisLogo() {
  return (
    <img
      src="/logo-uft-oficial.png"
      alt="Universidad Finis Terrae"
      className="hidden md:block fixed bottom-4 left-5 h-10 w-auto object-contain pointer-events-none select-none z-30 bg-white p-1 rounded-lg shadow-md"
    />
  );
}
