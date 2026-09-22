import React from 'react';
import { useTheme } from '../context/ThemeContext';

// Paleta corporativa Finis Terrae para los patrones geométricos hexagonales
const HEX_NAVY = '#0d2f52';
const HEX_TEAL = '#0f7ea8';
const HEX_BLUE = '#2f7fd1';
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
// Telón de hexágonos para los paneles (Alumno/Docente/Tutor): dispersión
// orgánica (no grilla) de hexágonos sólidos en navy/azul/cyan combinados con
// hexágonos de solo contorno (negro, blanco en modo oscuro), de tamaños
// variados, distribuidos a lo largo de toda la franja vertical derecha sin
// dejar huecos grandes y con algunos que se recortan en el borde derecho.
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

type PanelHexVariant = 'outline' | 'navy-solid' | 'blue-solid' | 'cyan-solid' | 'black-solid';

interface PanelHex { cx: number; cy: number; r: number; variant: PanelHexVariant }

const PANEL_VB_W = 480;
const PANEL_VB_H = 1300;
const PANEL_HEX_COUNT = 30;
// Cuántas ondulaciones suaves da la franja de arriba a abajo del lienzo.
const PANEL_WAVE_FREQ = 1.4;

// Distribución de estilos: el contorno predomina (sirve de textura liviana de
// fondo), luego cyan y azul como los sólidos más comunes, navy un poco menos
// y negro como acento visible pero no dominante (paleta: cyan, azul, negro,
// blanco -- el blanco aparece al invertir el contorno en modo oscuro).
function pickPanelVariant(seed: number): PanelHexVariant {
  const v = seededRandom(seed);
  if (v < 0.24) return 'outline';
  if (v < 0.48) return 'cyan-solid';
  if (v < 0.70) return 'blue-solid';
  if (v < 0.83) return 'navy-solid';
  return 'black-solid';
}

// Orden usado para "correr" el color al siguiente cuando el sorteo repite el
// del hexágono anterior en la secuencia, así nunca quedan dos iguales juntos.
const PANEL_VARIANT_CYCLE: PanelHexVariant[] = ['outline', 'cyan-solid', 'blue-solid', 'navy-solid', 'black-solid'];

// Los primeros hexágonos de la franja (justo debajo del header, siempre
// visibles sin hacer scroll) se fuerzan a color sólido para que esa zona
// nunca se vea "pelada" de color, sin depender del azar del sorteo.
const PANEL_FORCED_TOP_VARIANTS: PanelHexVariant[] = ['navy-solid', 'cyan-solid', 'blue-solid'];

// Franja pegada al borde derecho: una línea central se ondula suavemente
// (sin cruzar hacia el centro/izquierda del panel) a medida que baja, y cada
// hexágono se ubica cerca de esa línea con algo de desvío aleatorio, para
// que las figuras se sientan como un flujo continuo sobre el lado derecho
// en vez de una grilla pareja o una diagonal que atraviesa el panel.
// Los tamaños son mayormente chicos/medianos, con algunos grandes como acento.
function buildPanelHexes(): PanelHex[] {
  const hexes: PanelHex[] = [];
  const step = PANEL_VB_H / PANEL_HEX_COUNT;
  let lastVariant: PanelHexVariant | null = null;
  for (let i = 0; i < PANEL_HEX_COUNT; i++) {
    const seed = i * 29 + 3;
    const t = i / (PANEL_HEX_COUNT - 1);
    const cy = i * step + step * 0.5 + (seededRandom(seed) - 0.5) * step * 0.7;
    const waveCenter = PANEL_VB_W * (0.74 + 0.14 * Math.sin(t * Math.PI * 2 * PANEL_WAVE_FREQ));
    const drift = (seededRandom(seed + 0.41) - 0.5) * PANEL_VB_W * 0.22;
    const cx = Math.max(waveCenter + drift, PANEL_VB_W * 0.38);
    const r = 16 + Math.pow(seededRandom(seed + 0.77), 1.8) * 70;
    let variant: PanelHexVariant;
    if (i < PANEL_FORCED_TOP_VARIANTS.length) {
      variant = PANEL_FORCED_TOP_VARIANTS[i];
    } else {
      variant = pickPanelVariant(seed + 0.19);
      if (variant === lastVariant) {
        const nextIndex = (PANEL_VARIANT_CYCLE.indexOf(variant) + 1) % PANEL_VARIANT_CYCLE.length;
        variant = PANEL_VARIANT_CYCLE[nextIndex];
      }
    }
    lastVariant = variant;
    hexes.push({ cx, cy, r, variant });
  }
  return hexes;
}

const PANEL_HEXES = buildPanelHexes();

interface HexPanelBackdropProps {
  className?: string;
  topOffset?: number;
}

export function HexPanelBackdrop({ className = '', topOffset = 64 }: HexPanelBackdropProps) {
  const { isDark } = useTheme();
  const lineColor = isDark ? '#ffffff' : HEX_BLACK;
  // El panel vive dentro de un <main overflow-y-auto>, que tiene su propia
  // barra de scroll (no es la del navegador/ventana). `position: fixed;
  // right: 0` ignora esa barra y se dibuja por detrás de ella. Medimos el
  // ancho real reservado por ESE contenedor (offsetWidth - clientWidth) y
  // corremos el panel esa distancia exacta hacia la izquierda.
  const rootRef = React.useRef<HTMLDivElement>(null);
  const [scrollbarWidth, setScrollbarWidth] = React.useState(0);

  React.useEffect(() => {
    const scrollContainer = rootRef.current?.closest('[data-hex-scroll-container]');
    if (!scrollContainer) return;
    const update = () => setScrollbarWidth(scrollContainer.offsetWidth - scrollContainer.clientWidth);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(scrollContainer);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={rootRef}
      className={`fixed pointer-events-none select-none opacity-95 -z-10 ${className}`}
      style={{ top: topOffset, bottom: 0, right: scrollbarWidth, width: 'clamp(260px, 32vw, 600px)' }}
      aria-hidden="true"
    >
      <svg
        viewBox={`0 0 ${PANEL_VB_W} ${PANEL_VB_H}`}
        className="w-full h-full"
        preserveAspectRatio="xMaxYMin slice"
      >
        {/* Hexágonos de solo contorno primero, sirven de "relleno" detrás de los sólidos */}
        {PANEL_HEXES.filter(h => h.variant === 'outline').map((h, i) => (
          <polygon
            key={`outline-${i}`}
            points={hexPointsFlat(h.cx, h.cy, h.r)}
            fill="none"
            stroke={lineColor}
            strokeWidth={1.8}
            opacity="0.4"
          />
        ))}

        {/* Hexágonos sólidos (navy, azul, cyan, negro) por encima */}
        {PANEL_HEXES.filter(h => h.variant !== 'outline').map((h, i) => (
          <polygon
            key={`solid-${i}`}
            points={hexPointsFlat(h.cx, h.cy, h.r)}
            fill={
              h.variant === 'navy-solid' ? HEX_NAVY :
              h.variant === 'blue-solid' ? HEX_BLUE :
              h.variant === 'black-solid' ? HEX_BLACK :
              HEX_CYAN
            }
            stroke={h.variant === 'black-solid' && isDark ? '#ffffff' : 'none'}
            strokeWidth={h.variant === 'black-solid' && isDark ? 3 : 0}
            opacity="0.9"
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
