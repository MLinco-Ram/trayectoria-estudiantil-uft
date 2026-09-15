import React from 'react';
import { useTheme } from '../context/ThemeContext';

// Paleta corporativa Finis Terrae para los patrones geométricos hexagonales
const HEX_NAVY = '#0d2f52';
const HEX_TEAL = '#0f7ea8';
const HEX_CYAN = '#5ce1e6';
const HEX_BLACK = '#0a0a0a';

// Hexágono "pointy-top" (vértice hacia arriba)
function hexPoints(cx: number, cy: number, r: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 180) * (60 * i - 90);
    pts.push(`${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`);
  }
  return pts.join(' ');
}

// ---------------------------------------------------------------------------
// Fondo de red hexagonal (usado en Login y Registro de Alumno)
// Dos racimos de hexágonos de distintos portes, concentrados en la esquina
// inferior izquierda y en la esquina superior derecha (no una grilla pareja),
// con una capa azul marino y otra cyan clara entrelazadas y puntos de nodo.
// ---------------------------------------------------------------------------
const NET_CYAN_LIGHT = '#7fd3e8';

function netHexVertices(cx: number, cy: number, r: number): [number, number][] {
  const pts: [number, number][] = [];
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 180) * (60 * i - 90);
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return pts;
}

const NET_VB_W = 1080;
const NET_VB_H = 620;

interface NetHex { cx: number; cy: number; r: number }

// Masa sólida de hexágonos entrelazados (tocándose/superpuestos) cerca de la
// esquina, con tamaños variados, más una "cola" de hexágonos sueltos cada vez
// más pequeños y espaciados que se van perdiendo hacia el centro del lienzo.
const CORE_R = 30;
const BASE_HORIZ = Math.sqrt(3) * CORE_R;
const BASE_VERT = CORE_R * 1.5;
const CORE_SPACING = 1.55; // separa los centros para que los hexágonos no se vean tan pegados
const CORE_HORIZ = BASE_HORIZ * CORE_SPACING;
const CORE_VERT = BASE_VERT * CORE_SPACING;
const CORE_COLS = 5;
const CORE_ROWS = 4;
const SIZE_MULTIPLIERS = [0.72, 0.86, 1, 1.14, 1.3];

function buildClusterTemplate(): [number, number, number][] {
  const points: [number, number, number][] = [];
  for (let row = 0; row <= CORE_ROWS; row++) {
    for (let col = 0; col <= CORE_COLS; col++) {
      const x = col * CORE_HORIZ + (row % 2 !== 0 ? CORE_HORIZ / 2 : 0);
      const y = row * CORE_VERT;
      const mult = SIZE_MULTIPLIERS[(col * 7 + row * 13) % SIZE_MULTIPLIERS.length];
      points.push([x, y, CORE_R * mult]);
    }
  }
  // Cola de hexágonos sueltos, cada vez más chicos y espaciados (usa unidades sin el
  // factor extra de separación para no salirse demasiado del lienzo)
  const tail: [number, number, number][] = [
    [BASE_HORIZ * 6.4, BASE_VERT * 5.2, 20],
    [BASE_HORIZ * 7.4, BASE_VERT * 6.2, 16],
    [BASE_HORIZ * 5.8, BASE_VERT * 6.6, 15],
    [BASE_HORIZ * 8.2, BASE_VERT * 7.1, 13],
    [BASE_HORIZ * 7.0, BASE_VERT * 7.9, 12],
    [BASE_HORIZ * 9.0, BASE_VERT * 8.1, 11],
  ];
  return [...points, ...tail];
}

const NET_CLUSTER_TEMPLATE = buildClusterTemplate();

function buildCorner(cornerX: number, cornerY: number, flipX: 1 | -1, flipY: 1 | -1): NetHex[] {
  return NET_CLUSTER_TEMPLATE.map(([dx, dy, r]) => ({
    cx: cornerX + flipX * dx,
    cy: cornerY + flipY * dy,
    r,
  }));
}

// Racimo esquina inferior izquierda + racimo esquina superior derecha
const NET_ALL_HEXES: NetHex[] = [
  ...buildCorner(0, NET_VB_H, 1, -1),
  ...buildCorner(NET_VB_W, 0, -1, 1),
];

export function HexNetworkBackdrop() {
  return (
    <svg
      className="fixed inset-0 w-full h-full pointer-events-none select-none z-0"
      viewBox={`0 0 ${NET_VB_W} ${NET_VB_H}`}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      {/* Capa azul marino */}
      {NET_ALL_HEXES.map((h, i) => (
        <polygon
          key={`navy-${i}`}
          points={hexPoints(h.cx, h.cy, h.r)}
          fill="none"
          stroke={HEX_NAVY}
          strokeWidth={Math.max(1.4, h.r * 0.055)}
          opacity="0.55"
        />
      ))}

      {/* Capa cyan clara, ligeramente desplazada y más pequeña, para entrelazar */}
      {NET_ALL_HEXES.map((h, i) => {
        const cx = h.cx + h.r * 0.34;
        const cy = h.cy + h.r * 0.34;
        const r = h.r * 0.88;
        return (
          <polygon
            key={`cyan-${i}`}
            points={hexPoints(cx, cy, r)}
            fill="none"
            stroke={NET_CYAN_LIGHT}
            strokeWidth={Math.max(1.2, r * 0.05)}
            opacity="0.85"
          />
        );
      })}

      {/* Puntos de nodo en los vértices de la capa cyan (aspecto de red/circuito) */}
      {NET_ALL_HEXES.map((h, i) => {
        const cx = h.cx + h.r * 0.34;
        const cy = h.cy + h.r * 0.34;
        const r = h.r * 0.88;
        const dotR = Math.min(2.6, Math.max(1.3, r * 0.08));
        return netHexVertices(cx, cy, r).map(([vx, vy], j) => (
          <circle key={`dot-${i}-${j}`} cx={vx} cy={vy} r={dotR} fill={HEX_CYAN} opacity="0.85" />
        ));
      })}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Telón de hexágonos grandes para los paneles (Alumno/Docente/Tutor):
// hexágonos monocromáticos (cada uno completo en negro O en cyan, nunca dos
// capas superpuestas del mismo hexágono), de tamaño grande, dispersos con
// leve desorden para que se superpongan entre sí de forma orgánica, más
// algunos puntos de nodo conectados por una línea corta ("circuito").
// Cubre una franja vertical completa del lado derecho del panel, no solo
// una esquina.
// ---------------------------------------------------------------------------

// Hexágono "flat-top" (lados planos arriba/abajo, vértices a los costados)
function hexPointsFlat(cx: number, cy: number, r: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 180) * (60 * i);
    pts.push(`${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`);
  }
  return pts.join(' ');
}

function hexVertexFlat(cx: number, cy: number, r: number, i: number): [number, number] {
  const a = (Math.PI / 180) * (60 * i);
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}

// PRNG determinístico (evita Math.random para que el patrón no cambie entre renders)
function seededRandom(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

interface PanelHex { cx: number; cy: number; r: number; cyan: boolean }

const PANEL_VB_W = 460;
const PANEL_VB_H = 1300;
const PANEL_HEX_R = 88;
const PANEL_COL_STEP = PANEL_HEX_R * 1.5;
const PANEL_ROW_STEP = PANEL_HEX_R * Math.sqrt(3);

function buildPanelHexes(): PanelHex[] {
  const hexes: PanelHex[] = [];
  const cols = Math.ceil(PANEL_VB_W / PANEL_COL_STEP) + 1;
  const rows = Math.ceil(PANEL_VB_H / PANEL_ROW_STEP) + 2;
  for (let col = -1; col <= cols; col++) {
    for (let row = -1; row <= rows; row++) {
      const seed = col * 97 + row * 13 + 1;
      const baseX = col * PANEL_COL_STEP;
      const baseY = row * PANEL_ROW_STEP + (col % 2 !== 0 ? PANEL_ROW_STEP / 2 : 0);
      const jitterX = (seededRandom(seed) - 0.5) * PANEL_HEX_R * 0.55;
      const jitterY = (seededRandom(seed + 0.37) - 0.5) * PANEL_HEX_R * 0.55;
      const r = PANEL_HEX_R * (0.82 + seededRandom(seed + 0.71) * 0.36);
      const cyan = seededRandom(seed + 0.13) < 0.32;
      hexes.push({ cx: baseX + jitterX, cy: baseY + jitterY, r, cyan });
    }
  }
  return hexes;
}

const PANEL_HEXES = buildPanelHexes();

// Un par de puntos de nodo unidos por una línea corta ("circuito"), en
// posiciones fijas dentro del lienzo para que se vean intencionales.
const PANEL_NODE_LINKS: [number, number, number, number][] = [
  [120, 60, 120, 230],
  [300, 520, 260, 650],
];

interface HexPanelBackdropProps {
  className?: string;
  topOffset?: number;
}

export function HexPanelBackdrop({ className = '', topOffset = 64 }: HexPanelBackdropProps) {
  const { isDark } = useTheme();
  const darkLineColor = isDark ? '#ffffff' : HEX_BLACK;

  return (
    <div
      className={`fixed right-0 pointer-events-none select-none opacity-90 -z-10 ${className}`}
      style={{ top: topOffset, bottom: 0, width: 'clamp(240px, 30vw, 560px)' }}
      aria-hidden="true"
    >
      <svg
        viewBox={`0 0 ${PANEL_VB_W} ${PANEL_VB_H}`}
        className="w-full h-full"
        preserveAspectRatio="xMaxYMin slice"
      >
        {PANEL_HEXES.map((h, i) => (
          <polygon
            key={i}
            points={hexPointsFlat(h.cx, h.cy, h.r)}
            fill="none"
            stroke={h.cyan ? HEX_CYAN : darkLineColor}
            strokeWidth={h.cyan ? 3.2 : 2.2}
            opacity={h.cyan ? 0.85 : 0.7}
          />
        ))}

        {/* Nodos de circuito: puntos conectados por una línea corta */}
        {PANEL_NODE_LINKS.map(([x1, y1, x2, y2], i) => (
          <g key={`link-${i}`}>
            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={darkLineColor} strokeWidth="2" opacity="0.6" />
            <circle cx={x1} cy={y1} r="5" fill={darkLineColor} opacity="0.85" />
            <circle cx={x2} cy={y2} r="5" fill={darkLineColor} opacity="0.85" />
          </g>
        ))}
      </svg>
    </div>
  );
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
