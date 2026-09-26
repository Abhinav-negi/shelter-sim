// Drag-to-orient compass dial for azimuthDeg (F3.md condition 1: "Orientation
// (dial)"). 0° = long side faces south (pointer down); positive rotates
// clockwise (toward west). A plain SVG + pointer events — no dependency for
// something this small — with a role="slider" + arrow-key fallback so it
// stays usable without a mouse.
import { useCallback, useId, useRef } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';

export interface OrientationDialProps {
  value: number; // degrees, -180..180
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
}

const SIZE = 96;
const CENTER = SIZE / 2;
const RADIUS = SIZE / 2 - 10;

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

/** Pointer position -> degrees, 0 = down (south), clockwise positive, wrapped to [-180, 180]. */
function angleFromPoint(dx: number, dy: number): number {
  const deg = Math.atan2(dx, dy) * (180 / Math.PI);
  return ((deg + 540) % 360) - 180;
}

export function OrientationDial({ value, onChange, min, max, step = 1 }: OrientationDialProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const labelId = useId();

  const setFromClientPoint = useCallback(
    (clientX: number, clientY: number) => {
      const el = svgRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const dx = clientX - (rect.left + rect.width / 2);
      const dy = clientY - (rect.top + rect.height / 2);
      onChange(clamp(Math.round(angleFromPoint(dx, dy) / step) * step, min, max));
    },
    [onChange, min, max, step],
  );

  function onPointerDown(e: PointerEvent<SVGSVGElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    setFromClientPoint(e.clientX, e.clientY);
  }
  function onPointerMove(e: PointerEvent<SVGSVGElement>) {
    if (e.buttons !== 1) return;
    setFromClientPoint(e.clientX, e.clientY);
  }
  function onKeyDown(e: KeyboardEvent) {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault();
      onChange(clamp(value - step, min, max));
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault();
      onChange(clamp(value + step, min, max));
    }
  }

  const rad = (value * Math.PI) / 180;
  // Pointer tip: 0deg -> straight down, clockwise positive (matches angleFromPoint).
  const tipX = CENTER + Math.sin(rad) * RADIUS;
  const tipY = CENTER + Math.cos(rad) * RADIUS;

  return (
    <div className="flex items-center gap-4">
      <svg
        ref={svgRef}
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        role="slider"
        aria-labelledby={labelId}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={Math.round(value)}
        aria-valuetext={`${Math.round(value)} degrees`}
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onKeyDown={onKeyDown}
        className="cursor-pointer touch-none outline-none focus-visible:[&>circle.ring]:stroke-accent"
      >
        <circle className="ring" cx={CENTER} cy={CENTER} r={RADIUS} fill="none" stroke="var(--hairline)" strokeWidth={1} />
        <text x={CENTER} y={10} textAnchor="middle" fontSize={9} fill="var(--ink-muted)">
          N
        </text>
        <text x={SIZE - 6} y={CENTER + 3} textAnchor="middle" fontSize={9} fill="var(--ink-muted)">
          E
        </text>
        <text x={CENTER} y={SIZE - 4} textAnchor="middle" fontSize={9} fill="var(--ink-muted)">
          S
        </text>
        <text x={6} y={CENTER + 3} textAnchor="middle" fontSize={9} fill="var(--ink-muted)">
          W
        </text>
        <line x1={CENTER} y1={CENTER} x2={tipX} y2={tipY} stroke="var(--accent)" strokeWidth={2} />
        <circle cx={tipX} cy={tipY} r={3.5} fill="var(--accent)" />
      </svg>
      <div>
        <p id={labelId} className="text-xs font-medium tracking-wide text-ink-muted uppercase">
          Orientation
        </p>
        <p className="mt-1 font-mono text-sm text-ink">{Math.round(value)}°</p>
        <p className="text-xs text-ink-muted">0° = long side faces south</p>
      </div>
    </div>
  );
}
