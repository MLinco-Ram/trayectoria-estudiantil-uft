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
// Mosaico disperso de hexágonos "flat-top" para las esquinas de los paneles
// (hexágonos de tamaños variados, algunos sólidos, otros solo con contorno,
// uno con textura de rejilla diagonal, superpuestos entre sí)
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

function hexVerticesFlat(cx: number, cy: number, r: number): [number, number][] {
  const pts: [number, number][] = [];
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 180) * (60 * i);
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return pts;
}

interface HexShape {
  cx: number;
  cy: number;
  r: number;
  fill?: string;
  opacity?: number;
  pattern?: boolean;
  isBlack?: boolean;
}

// Hexágonos "de red": solo contorno grueso azul marino/negro + una capa cyan
// entrelazada y puntos de nodo, igual que el fondo del Login. En modo oscuro
// el contorno oscuro pasa a blanco para seguir siendo visible.
interface NetworkHex { cx: number; cy: number; r: number }

// Composición base en un lienzo vertical de 190 x 490: unos pocos hexágonos
// sólidos de acento (negro y el cyan con rejilla) sobre una red de líneas
// hexagonales entrelazadas que fluye del bloque superior al inferior, sin
// vacíos ni puntos sueltos.
const HEX_ACCENTS: HexShape[] = [
  // Gran hexágono cyan con rejilla diagonal, recortado en el borde superior
  { cx: 128, cy: 4, r: 72, pattern: true },
  // Gran hexágono negro sólido de acento
  { cx: 112, cy: 152, r: 60, fill: HEX_BLACK, opacity: 0.92, isBlack: true },
  // Hexágono negro pequeño de acento
  { cx: 66, cy: 292, r: 30, fill: HEX_BLACK, opacity: 0.85, isBlack: true },
];

const HEX_NETWORK: NetworkHex[] = [
  { cx: 34, cy: 96, r: 46 },
  { cx: 174, cy: 128, r: 27 },
  { cx: 163, cy: 232, r: 42 },
  { cx: 26, cy: 226, r: 16 },
  { cx: 140, cy: 300, r: 20 },
  { cx: 112, cy: 328, r: 28 },
  { cx: 146, cy: 352, r: 24 },
  { cx: 106, cy: 376, r: 21 },
  { cx: 136, cy: 398, r: 19 },
  { cx: 98, cy: 418, r: 17 },
  { cx: 128, cy: 438, r: 15 },
  { cx: 100, cy: 456, r: 13 },
  { cx: 126, cy: 472, r: 11 },
];

const CLUSTER_VB_W = 190;
const CLUSTER_VB_H = 490;

interface HexCornerMosaicProps {
  corner?: 'top-right' | 'bottom-right';
  size?: number;
  className?: string;
  offset?: number;
}

// Ancho aproximado de la barra de scroll del navegador: se resta como margen
// derecho para que el mosaico nunca se superponga con ella.
const SCROLLBAR_CLEARANCE = 18;

// "size" se trata como el alto de referencia a 900px de alto de viewport.
// Se escala con vmin (el menor entre ancho y alto) para que el mosaico
// crezca de forma pareja tanto en pantallas anchas como en pantallas altas,
// sin quedar desproporcionadamente chico ni dejar huecos raros entre los
// dos racimos (superior e inferior) en resoluciones grandes.
//
// Importante: el ancho se calcula con la MISMA fórmula clamp() (en vez de
// usar CSS "aspect-ratio" sobre un elemento con ancho automático). Un
// "position: fixed" sin left/width explícito, cuyo hijo SVG usa width:100%,
// crea una dependencia circular de tamaño que algunos navegadores resuelven
// mal, estirando el mosaico de forma gigante y distorsionada. Calculando
// ancho y alto por separado evitamos depender de ese comportamiento.
function responsiveClamp(pxAt900: number): string {
  const min = Math.round(pxAt900 * 0.75);
  const max = Math.round(pxAt900 * 2.2);
  const preferredVmin = (pxAt900 / 900) * 100;
  return `clamp(${min}px, ${preferredVmin.toFixed(2)}vmin, ${max}px)`;
}

export function HexCornerMosaic({ corner = 'top-right', size = 260, className = '', offset = 0 }: HexCornerMosaicProps) {
  const { isDark } = useTheme();
  const height = responsiveClamp(size);
  const width = responsiveClamp(size * (CLUSTER_VB_W / CLUSTER_VB_H));
  const rotationStyle = corner === 'bottom-right' ? { transform: 'rotate(180deg)' } : undefined;
  const positionStyle = corner === 'top-right'
    ? { top: offset, right: SCROLLBAR_CLEARANCE, width, height }
    : { bottom: offset, right: SCROLLBAR_CLEARANCE, width, height };
  const patternId = `uft-hex-hatch-${corner}`;

  return (
    <div
      className={`fixed pointer-events-none select-none opacity-95 -z-10 ${className}`}
      style={positionStyle}
      aria-hidden="true"
    >
      <svg
        viewBox={`0 0 ${CLUSTER_VB_W} ${CLUSTER_VB_H}`}
        className="w-full h-full"
        style={rotationStyle}
        preserveAspectRatio="xMaxYMin slice"
      >
        <defs>
          <pattern id={patternId} width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="14" height="14" fill={HEX_CYAN} />
            <line x1="0" y1="0" x2="0" y2="14" stroke={HEX_NAVY} strokeWidth="1" opacity="0.35" />
            <line x1="0" y1="0" x2="14" y2="0" stroke={HEX_NAVY} strokeWidth="1" opacity="0.35" />
          </pattern>
        </defs>

        {/* Red de hexágonos de solo contorno (azul marino/blanco en oscuro + cyan entrelazado + nodos) */}
        {HEX_NETWORK.map((h, i) => (
          <polygon
            key={`net-navy-${i}`}
            points={hexPointsFlat(h.cx, h.cy, h.r)}
            fill="none"
            stroke={isDark ? '#ffffff' : HEX_NAVY}
            strokeWidth={Math.max(2, h.r * 0.09)}
            opacity={isDark ? 0.9 : 0.8}
          />
        ))}
        {HEX_NETWORK.map((h, i) => {
          const cx = h.cx + h.r * 0.3;
          const cy = h.cy - h.r * 0.22;
          const r = h.r * 0.72;
          return (
            <polygon
              key={`net-cyan-${i}`}
              points={hexPointsFlat(cx, cy, r)}
              fill="none"
              stroke={HEX_CYAN}
              strokeWidth={Math.max(1.5, r * 0.08)}
              opacity="0.85"
            />
          );
        })}
        {HEX_NETWORK.map((h, i) => {
          const cx = h.cx + h.r * 0.3;
          const cy = h.cy - h.r * 0.22;
          const r = h.r * 0.72;
          const dotR = Math.min(3.4, Math.max(1.6, r * 0.13));
          return hexVerticesFlat(cx, cy, r).map(([vx, vy], j) => (
            <circle key={`net-dot-${i}-${j}`} cx={vx} cy={vy} r={dotR} fill={HEX_CYAN} opacity="0.85" />
          ));
        })}

        {/* Hexágonos sólidos de acento (negro y cyan con rejilla) */}
        {HEX_ACCENTS.map((h, i) => (
          <polygon
            key={`accent-${i}`}
            points={hexPointsFlat(h.cx, h.cy, h.r)}
            fill={h.pattern ? `url(#${patternId})` : (h.fill ?? HEX_CYAN)}
            stroke={h.isBlack && isDark ? '#ffffff' : undefined}
            strokeWidth={h.isBlack && isDark ? Math.max(1.5, h.r * 0.045) : undefined}
            opacity={h.opacity ?? 1}
          />
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
