// UI-only 3D-part <-> control selection state (G4, ledger/tasks/G4.md).
// Deliberately separate from design/store.ts's ShelterDesign store:
// hovering/selecting a part is never a design change — it must never mark
// `dirty`, trigger the debounced preview (Studio.tsx's `useDebouncedRequest`
// only watches the `design` object), or get saved/sent to the server.
import { create } from 'zustand';

export type Orientation = 'S' | 'E' | 'W' | 'N';

/** Every 3D part that can be hovered/selected/edited (G4.md condition 1).
 *  Cylinder wall/window facets and dome wall facets have no stable id of
 *  their own (G3 review note) — they map onto their quadrant's `wall:<o>`/
 *  `window:<o>` by `orientation`. Dome band-2 (cap) facets all map to
 *  `roof`, same as the box/cylinder's single roof slab. */
export type PartId = `wall:${Orientation}` | `window:${Orientation}` | 'roof' | 'floor';

export interface SelectionState {
  hoveredPart: PartId | null;
  selectedPart: PartId | null;
  setHoveredPart: (part: PartId | null) => void;
  selectPart: (part: PartId | null) => void;
  clearSelection: () => void;
}

export const useSelection = create<SelectionState>()((set) => ({
  hoveredPart: null,
  selectedPart: null,
  setHoveredPart: (part) => set({ hoveredPart: part }),
  selectPart: (part) => set({ selectedPart: part }),
  clearSelection: () => set({ selectedPart: null, hoveredPart: null }),
}));
