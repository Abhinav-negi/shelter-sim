import type { ShelterDesign } from '@shelter/studio-server';
import { beforeEach, describe, expect, it } from 'vitest';
import { useShelterDesign } from './store';

const sample: ShelterDesign = {
  location: { kind: 'preset', id: 'leh' },
  date: '2023-01-15',
  presetId: 'traditionalLadakhiByre',
  lengthM: 8,
  widthM: 5,
  heightM: 3,
  azimuthDeg: 0,
  wallConstruction: null,
  roofConstruction: null,
  floorConstruction: null,
  windowWwr: { S: 0.2, E: 0.1, W: 0.1, N: 0.05 },
  glazingId: 'doubleClear',
  nightShutters: true,
  occupancyPresetId: 'familyLivestock',
};

beforeEach(() => {
  useShelterDesign.setState({ design: null, dirty: false });
});

describe('ShelterDesign store', () => {
  it('starts with no design loaded and not dirty', () => {
    const state = useShelterDesign.getState();
    expect(state.design).toBeNull();
    expect(state.dirty).toBe(false);
  });

  it('loadDesign replaces the design and clears dirty', () => {
    useShelterDesign.getState().loadDesign(sample);
    const state = useShelterDesign.getState();
    expect(state.design).toEqual(sample);
    expect(state.dirty).toBe(false);
  });

  it('setters are no-ops before a design is loaded', () => {
    useShelterDesign.getState().setLengthM(12);
    expect(useShelterDesign.getState().design).toBeNull();
    expect(useShelterDesign.getState().dirty).toBe(false);
  });

  it('a setter changes only its own field and marks dirty', () => {
    useShelterDesign.getState().loadDesign(sample);
    useShelterDesign.getState().setLengthM(12);
    const { design, dirty } = useShelterDesign.getState();
    expect(design?.lengthM).toBe(12);
    expect(design?.widthM).toBe(sample.widthM); // unrelated field untouched
    expect(dirty).toBe(true);
  });

  it('setWindowWwr merges into the per-orientation map without touching siblings', () => {
    useShelterDesign.getState().loadDesign(sample);
    useShelterDesign.getState().setWindowWwr('S', 0.4);
    const { design } = useShelterDesign.getState();
    expect(design?.windowWwr).toEqual({ S: 0.4, E: 0.1, W: 0.1, N: 0.05 });
  });

  it('setLocation, setAzimuthDeg, setNightShutters, setOccupancyPresetId each set their field', () => {
    useShelterDesign.getState().loadDesign(sample);
    const custom = { kind: 'custom' as const, name: 'Base camp', lat: 34.1, lon: 77.5, elevation: 3500 };
    useShelterDesign.getState().setLocation(custom);
    useShelterDesign.getState().setAzimuthDeg(45);
    useShelterDesign.getState().setNightShutters(false);
    useShelterDesign.getState().setOccupancyPresetId('heatedOffice');
    const { design } = useShelterDesign.getState();
    expect(design?.location).toEqual(custom);
    expect(design?.azimuthDeg).toBe(45);
    expect(design?.nightShutters).toBe(false);
    expect(design?.occupancyPresetId).toBe('heatedOffice');
  });

  it('setWallConstruction accepts null (keep preset stack) and an explicit construction', () => {
    useShelterDesign.getState().loadDesign(sample);
    useShelterDesign.getState().setWallConstruction({ materialId: 'rammedEarth', thicknessM: 0.5 });
    expect(useShelterDesign.getState().design?.wallConstruction).toEqual({
      materialId: 'rammedEarth',
      thicknessM: 0.5,
    });
    useShelterDesign.getState().setWallConstruction(null);
    expect(useShelterDesign.getState().design?.wallConstruction).toBeNull();
  });

  it('reset replaces the design and clears dirty even after edits', () => {
    useShelterDesign.getState().loadDesign(sample);
    useShelterDesign.getState().setHeightM(4);
    expect(useShelterDesign.getState().dirty).toBe(true);
    const defaults = { ...sample, heightM: 3.2 };
    useShelterDesign.getState().reset(defaults);
    const { design, dirty } = useShelterDesign.getState();
    expect(design).toEqual(defaults);
    expect(dirty).toBe(false);
  });
});
