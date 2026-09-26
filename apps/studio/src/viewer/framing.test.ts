import { describe, expect, it } from 'vitest';
import { BASE_DISTANCE_FACTOR, REFERENCE_ASPECT, cameraDistance } from './framing';

describe('cameraDistance', () => {
  const footprint = 5;

  it('reduces to the original footprint*factor formula at the reference (landscape) aspect', () => {
    expect(cameraDistance(footprint, REFERENCE_ASPECT)).toBeCloseTo(footprint * BASE_DISTANCE_FACTOR, 9);
  });

  it('stays at the base distance for any aspect at least as wide as the reference (no extra zoom-in)', () => {
    const wider = cameraDistance(footprint, REFERENCE_ASPECT * 2);
    expect(wider).toBeCloseTo(footprint * BASE_DISTANCE_FACTOR, 9);
  });

  it('zooms out (larger distance) for a square canvas than the landscape reference', () => {
    const square = cameraDistance(footprint, 1);
    expect(square).toBeGreaterThan(footprint * BASE_DISTANCE_FACTOR);
  });

  it('zooms out further still for a portrait canvas than a square one', () => {
    const square = cameraDistance(footprint, 1);
    const portrait = cameraDistance(footprint, 0.5);
    expect(portrait).toBeGreaterThan(square);
  });

  it('scales linearly with footprint at a fixed aspect', () => {
    const small = cameraDistance(5, 0.7);
    const big = cameraDistance(10, 0.7);
    expect(big).toBeCloseTo(small * 2, 9);
  });

  it('a larger vertical FOV needs less distance to fit the same footprint', () => {
    const narrowFov = cameraDistance(footprint, 1, 20);
    const wideFov = cameraDistance(footprint, 1, 40);
    expect(wideFov).toBeLessThan(narrowFov);
  });
});
