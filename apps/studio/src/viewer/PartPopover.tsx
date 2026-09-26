// A small floating panel next to the selected 3D part (G4.md condition 5):
// part name + 1-2 G1 NumberInputs for its key value(s), writing through the
// same ShelterDesign store setters the controls panel uses — no separate
// edit path, no gizmos/drag handles (user decision, G4.md Rules). Rendered
// only when `interactive` (ShelterViewer.tsx) and a part is selected.
import { Html } from '@react-three/drei';
import { useMemo } from 'react';
import type { ReactNode } from 'react';
import type { Options, ShelterDesign, SurfaceConstruction } from '@shelter/studio-server';
import { NumberInput } from '../components/ui';
import { useSelection } from '../design/selection';
import type { PartId } from '../design/selection';
import { useShelterDesign } from '../design/store';
import { azimuthDirection, type Orientation, type SceneGeometry } from './geometry';

const ORIENTATION_NAME: Record<Orientation, string> = { S: 'South', E: 'East', W: 'West', N: 'North' };

function orientationOf(part: PartId): Orientation {
  return part.split(':')[1] as Orientation;
}

function partLabel(part: PartId): string {
  if (part === 'roof') return 'Roof';
  if (part === 'floor') return 'Floor';
  const o = orientationOf(part);
  return `${ORIENTATION_NAME[o]} ${part.startsWith('window:') ? 'window' : 'wall'}`;
}

/** Where in the (pre-azimuth-rotation) building-local frame this part's solid
 *  actually sits — same placement rules as `Building.tsx`'s `WALL_SIDE` /
 *  `azimuthDirection`, just resolved to a single anchor point instead of a
 *  whole mesh. Mirrors, doesn't import, Building.tsx's internals (those are
 *  module-private) — this only needs a rough anchor, not exact geometry. */
function anchorPosition(geometry: SceneGeometry, part: PartId): [number, number, number] {
  if (part === 'roof') return [0, geometry.buildingHeightM + geometry.roofThicknessM, 0];
  if (part === 'floor') return [0, -geometry.floorThicknessM, 0];

  const orientation = orientationOf(part);
  const midHeight = geometry.heightM / 2;

  if (geometry.shape === 'dome') {
    const facet = geometry.domeFacets.find((f) => f.kind === 'wall' && f.orientation === orientation);
    if (!facet) return [0, geometry.buildingHeightM / 2, 0];
    const dir = azimuthDirection(facet.azimuthDeg);
    const radius = (facet.radiusLow + facet.radiusHigh) / 2;
    const height = (facet.heightLow + facet.heightHigh) / 2;
    return [dir.x * radius, height, dir.z * radius];
  }

  const wall = geometry.walls.find((w) => w.orientation === orientation);
  if (!wall) return [0, midHeight, 0];

  if (geometry.shape === 'cylinder') {
    const r = geometry.lengthM / 2;
    const dir = azimuthDirection(wall.azimuthDeg ?? 0);
    return [dir.x * r, midHeight, dir.z * r];
  }

  // box
  const runAxis: 'x' | 'z' = orientation === 'S' || orientation === 'N' ? 'x' : 'z';
  const sign = orientation === 'S' || orientation === 'E' ? 1 : -1;
  const depthHalfExtent = runAxis === 'x' ? geometry.widthM / 2 : geometry.lengthM / 2;
  const outerFace = sign * depthHalfExtent;
  return runAxis === 'x' ? [0, midHeight, outerFace] : [outerFace, midHeight, 0];
}

export function PartPopover({
  geometry,
  design,
  options,
}: {
  geometry: SceneGeometry;
  design: ShelterDesign;
  options: Options;
}) {
  const selectedPart = useSelection((s) => s.selectedPart);
  const clearSelection = useSelection((s) => s.clearSelection);
  const setWindowWwr = useShelterDesign((s) => s.setWindowWwr);
  const setWallConstruction = useShelterDesign((s) => s.setWallConstruction);
  const setRoofConstruction = useShelterDesign((s) => s.setRoofConstruction);
  const setFloorConstruction = useShelterDesign((s) => s.setFloorConstruction);

  const position = useMemo(
    () => (selectedPart ? anchorPosition(geometry, selectedPart) : null),
    [geometry, selectedPart],
  );

  if (!selectedPart || !position) return null;

  const thicknessRange = options.ranges.thicknessM;
  const wwrRange = options.ranges.windowWwr;

  // A thickness field always needs a materialId (SurfaceConstruction), even
  // when the design is still on "preset default" (construction === null) —
  // same fallback DevViewer.tsx uses for its own thickness query param.
  function thicknessField(
    label: string,
    construction: SurfaceConstruction | null,
    onChange: (construction: SurfaceConstruction) => void,
  ) {
    const materialId = construction?.materialId ?? options.materials[0]?.id ?? 'unknown';
    const value = construction?.thicknessM ?? options.materials[0]?.defaultThicknessM ?? thicknessRange.min;
    return (
      <NumberInput
        label={label}
        value={value}
        onChange={(thicknessM) => onChange({ materialId, thicknessM })}
        min={thicknessRange.min}
        max={thicknessRange.max}
        step={thicknessRange.step ?? 0.01}
        decimals={2}
        unit="m"
      />
    );
  }

  const title = partLabel(selectedPart);
  let field: ReactNode;
  if (selectedPart === 'roof') {
    field = thicknessField('Roof thickness', design.roofConstruction, setRoofConstruction);
  } else if (selectedPart === 'floor') {
    field = thicknessField('Floor thickness', design.floorConstruction, setFloorConstruction);
  } else if (selectedPart.startsWith('window:')) {
    const o = orientationOf(selectedPart);
    field = (
      <NumberInput
        label={`${title} area`}
        value={design.windowWwr[o] * 100}
        onChange={(pct) => setWindowWwr(o, Math.round(pct) / 100)}
        min={wwrRange.min * 100}
        max={wwrRange.max * 100}
        step={(wwrRange.step ?? 0.05) * 100}
        decimals={0}
        unit="%"
      />
    );
  } else {
    field = thicknessField('Wall thickness', design.wallConstruction, setWallConstruction);
  }

  return (
    <Html position={position} zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
      {/* Own translate (not drei's `center`) so it sits just above/beside the
       *  anchor rather than directly on top of it (condition 5: "doesn't
       *  cover the part at 390"). `pointerEvents: 'auto'` re-enables clicks
       *  inside this specific panel (the wrapper above turns them off so the
       *  invisible Html layer never blocks orbit-drag over the rest of the
       *  canvas). */}
      <div
        className="flex w-44 -translate-x-1/2 -translate-y-[calc(100%+12px)] flex-col gap-2 rounded-sm border border-hairline bg-surface p-3 text-xs shadow-lg"
        style={{ pointerEvents: 'auto' }}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="font-medium text-ink">{title}</span>
          <button
            type="button"
            aria-label="Close"
            onClick={() => clearSelection()}
            className="text-ink-muted hover:text-ink"
          >
            ✕
          </button>
        </div>
        {field}
      </div>
    </Html>
  );
}
