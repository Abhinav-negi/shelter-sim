// The ShelterDesign store: the single source of truth the controls write to and
// the viewer only reads from (PLAN.md §Client: "UI -> zustand design store ->
// api/ -> server. The viewer only *reads* the store."). Consumers should always
// pass a selector, e.g. `useShelterDesign((s) => s.design?.lengthM)`, so a change
// to one field doesn't rerender components that only care about another.
import type { DesignLocation, ShelterDesign, SurfaceConstruction } from '@shelter/studio-server';
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

export interface ShelterDesignState {
  /** Null until `loadDesign` is called (e.g. after GET /api/options resolves defaults). */
  design: ShelterDesign | null;
  /** True once any setter has run since the last loadDesign/reset. */
  dirty: boolean;

  loadDesign: (design: ShelterDesign) => void;
  reset: (defaults: ShelterDesign) => void;

  // Environment
  setLocation: (location: DesignLocation) => void;
  setDate: (date: string) => void;

  // Geometry
  setPresetId: (presetId: string) => void;
  setLengthM: (lengthM: number) => void;
  setWidthM: (widthM: number) => void;
  setHeightM: (heightM: number) => void;

  // Orientation
  setAzimuthDeg: (azimuthDeg: number) => void;

  // Materials
  setWallConstruction: (construction: SurfaceConstruction | null) => void;
  setRoofConstruction: (construction: SurfaceConstruction | null) => void;
  setFloorConstruction: (construction: SurfaceConstruction | null) => void;

  // Openings
  setWindowWwr: (orientation: 'S' | 'E' | 'W' | 'N', value: number) => void;
  setGlazingId: (glazingId: string) => void;
  setNightShutters: (nightShutters: boolean) => void;

  // Advanced
  setOccupancyPresetId: (occupancyPresetId: string) => void;
}

/** Applies `patch` to the current design and marks the store dirty. No-op before loadDesign. */
function edit(
  set: (fn: (state: ShelterDesignState) => Partial<ShelterDesignState>) => void,
  patch: (design: ShelterDesign) => Partial<ShelterDesign>,
) {
  set((state) => {
    if (!state.design) return {};
    return { design: { ...state.design, ...patch(state.design) }, dirty: true };
  });
}

export const useShelterDesign = create<ShelterDesignState>()(
  subscribeWithSelector((set) => ({
    design: null,
    dirty: false,

    loadDesign: (design) => set({ design, dirty: false }),
    reset: (defaults) => set({ design: defaults, dirty: false }),

    setLocation: (location) => edit(set, () => ({ location })),
    setDate: (date) => edit(set, () => ({ date })),

    setPresetId: (presetId) => edit(set, () => ({ presetId })),
    setLengthM: (lengthM) => edit(set, () => ({ lengthM })),
    setWidthM: (widthM) => edit(set, () => ({ widthM })),
    setHeightM: (heightM) => edit(set, () => ({ heightM })),

    setAzimuthDeg: (azimuthDeg) => edit(set, () => ({ azimuthDeg })),

    setWallConstruction: (wallConstruction) => edit(set, () => ({ wallConstruction })),
    setRoofConstruction: (roofConstruction) => edit(set, () => ({ roofConstruction })),
    setFloorConstruction: (floorConstruction) => edit(set, () => ({ floorConstruction })),

    setWindowWwr: (orientation, value) =>
      edit(set, (design) => ({ windowWwr: { ...design.windowWwr, [orientation]: value } })),
    setGlazingId: (glazingId) => edit(set, () => ({ glazingId })),
    setNightShutters: (nightShutters) => edit(set, () => ({ nightShutters })),

    setOccupancyPresetId: (occupancyPresetId) => edit(set, () => ({ occupancyPresetId })),
  })),
);
