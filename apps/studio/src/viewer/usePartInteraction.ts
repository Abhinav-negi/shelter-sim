// Shared pointer wiring for a selectable 3D part (G4.md conditions 1-2):
// hover/select state read from the UI-only selection store, plus the R3F
// pointer handlers a mesh needs to participate — `stopPropagation` so a
// click on one part doesn't also reach the ground/another part behind it,
// and so it reaches `Canvas`'s `onPointerMissed` (which clears the
// selection) only when nothing was actually hit. Returns `{}` handlers when
// `interactive` is false (Landing/Compare's non-interactive viewer, G4.md
// condition 2), so those callers stay exactly as inert as before G4.
import { useMemo } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import { Color } from 'three';
import { useSelection } from '../design/selection';
import type { PartId } from '../design/selection';

export interface PartInteraction {
  isHovered: boolean;
  isSelected: boolean;
  handlers: {
    onPointerOver?: (e: ThreeEvent<PointerEvent>) => void;
    onPointerOut?: (e: ThreeEvent<PointerEvent>) => void;
    onClick?: (e: ThreeEvent<MouseEvent>) => void;
  };
}

export function usePartInteraction(partId: PartId, interactive: boolean): PartInteraction {
  const hoveredPart = useSelection((s) => s.hoveredPart);
  const selectedPart = useSelection((s) => s.selectedPart);
  const setHoveredPart = useSelection((s) => s.setHoveredPart);
  const selectPart = useSelection((s) => s.selectPart);

  if (!interactive) return { isHovered: false, isSelected: false, handlers: {} };

  return {
    isHovered: hoveredPart === partId,
    isSelected: selectedPart === partId,
    handlers: {
      onPointerOver: (e) => {
        e.stopPropagation();
        setHoveredPart(partId);
      },
      onPointerOut: (e) => {
        e.stopPropagation();
        setHoveredPart(null);
      },
      onClick: (e) => {
        e.stopPropagation();
        selectPart(partId);
      },
    },
  };
}

const HOVER_TINT = 0.25;
const SELECT_TINT = 0.55;

/** Blends `base` toward `accent` for hover/selected — stronger for selected
 *  (G4.md condition 2: "hover = subtle accent tint, selected = stronger").
 *  Memoised by the caller (cheap, but a new `Color` per render otherwise). */
export function useTintedColor(base: string, accent: string, isSelected: boolean, isHovered: boolean): string {
  return useMemo(() => {
    if (isSelected) return new Color(base).lerp(new Color(accent), SELECT_TINT).getStyle();
    if (isHovered) return new Color(base).lerp(new Color(accent), HOVER_TINT).getStyle();
    return base;
  }, [base, accent, isSelected, isHovered]);
}
