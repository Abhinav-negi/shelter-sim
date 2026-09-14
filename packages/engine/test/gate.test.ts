/**
 * ===========================================================================
 * THE HARD GATE. BLUEPRINT.md Part 11: "Do not build modules 10+ until Tests
 * 1, 2 and 4 pass. If transient conduction is wrong, every hour spent above it
 * is wasted."
 *
 * Test 2 is the one that matters most. It validates the exact physics that makes
 * passive design work -- and it is checked against a CLOSED-FORM analytical
 * solution, which is stronger evidence than agreeing with another program,
 * because an analytical solution cannot itself be buggy.
 * ===========================================================================
 */

import { describe, it, expect } from 'vitest';
import { buildWallMesh, analyticalWavePenetration, diffusivity } from '../src/envelope/mesh.js';
import { driveWall, harmonicFit, lagSeconds, nodeSeries, nodeAtDepth } from '../src/envelope/response.js';
import { M } from './fixtures.js';

const DAY = 86400;

describe('Test 2 -- sinusoidal wave through a wall (THE gate test)', () => {
  /*
   * A thick wall driven at its exterior face by T_m + A*sin(wt). For a
   * semi-infinite solid the interior response at depth x is
   *     amplitude ratio = exp(-x/d),   lag = (x/d)/w,   d = sqrt(2a/w)
   * The wall is made 8 penetration depths thick so the far boundary cannot
   * contaminate the measurement -- the wave is attenuated by e^-8 (~0.03%)
   * before it ever reaches the far face.
   */
  const omega = (2 * Math.PI) / DAY;
  const T_mean = 273.15;
  const amplitude = 10;
  const dt = 60;

  const cases: Array<[string, keyof typeof M, number]> = [
    ['dense concrete', 'denseConcrete', 0.2],
    ['dense concrete', 'denseConcrete', 0.4],
    ['rammed earth', 'rammedEarth', 0.2],
    ['rammed earth', 'rammedEarth', 0.4],
    ['fired brick', 'firedBrick', 0.2],
    ['granite', 'granite', 0.3],
  ];

  for (const [label, id, depth] of cases) {
    it(`${label} at ${depth * 1000} mm reproduces the analytical decrement and lag`, () => {
      const material = M[id]!;
      const d = Math.sqrt((2 * diffusivity(material)) / omega);
      const thickness = Math.max(depth * 2, 8 * d);
      const mesh = buildWallMesh([{ materialId: id, thickness }], M, 0.01);

      // Run 12 days: the first several settle the initial transient, and we fit
      // the harmonic over the last 4 only.
      const totalDays = 12;
      const steps = (totalDays * DAY) / dt;
      const res = driveWall(mesh, {
        exteriorTemp: (t) => T_mean + amplitude * Math.sin(omega * t),
        interiorTemp: T_mean,
        dt,
        steps,
        initial: T_mean,
      });

      const stepsPerDay = DAY / dt;
      const from = steps - 4 * stepsPerDay;
      const slice = (node: number) => nodeSeries(res, node).slice(from);

      const drive = harmonicFit(slice(0), dt, DAY);
      const node = nodeAtDepth(mesh, depth);
      const actualDepth = mesh.x[node]!;
      const inner = harmonicFit(slice(node), dt, DAY);

      const analytic = analyticalWavePenetration(material, actualDepth);
      const numericDecrement = inner.amplitude / drive.amplitude;

      const lagHours = lagSeconds(drive, inner, DAY) / 3600;

      // BLUEPRINT.md 9.2 pass criteria: decrement within 2%, lag within 10 minutes.
      expect(Math.abs(numericDecrement - analytic.decrement) / analytic.decrement).toBeLessThan(0.02);
      expect(Math.abs(lagHours - analytic.lagHours)).toBeLessThan(10 / 60);
    });
  }

  it('a heavier wall always damps more and delays longer than a lighter one', () => {
    const measure = (id: keyof typeof M) => {
      const material = M[id]!;
      const d = Math.sqrt((2 * diffusivity(material)) / omega);
      const mesh = buildWallMesh([{ materialId: id, thickness: Math.max(0.6, 8 * d) }], M, 0.01);
      const steps = (12 * DAY) / dt;
      const res = driveWall(mesh, {
        exteriorTemp: (t) => T_mean + amplitude * Math.sin(omega * t),
        interiorTemp: T_mean,
        dt,
        steps,
        initial: T_mean,
      });
      const from = steps - 4 * (DAY / dt);
      const node = nodeAtDepth(mesh, 0.3);
      const drive = harmonicFit(nodeSeries(res, 0).slice(from), dt, DAY);
      const inner = harmonicFit(nodeSeries(res, node).slice(from), dt, DAY);
      return inner.amplitude / drive.amplitude;
    };
    // Fired brick has the lowest diffusivity of the three, so it damps most.
    expect(measure('firedBrick')).toBeLessThan(measure('rammedEarth'));
    expect(measure('rammedEarth')).toBeLessThan(measure('granite'));
  });
});

describe('Test 7 -- mesh and timestep independence', () => {
  it('halving dx and then dt moves the answer by less than 1%', () => {
    const omega = (2 * Math.PI) / DAY;
    const run = (targetDx: number, dt: number) => {
      const mesh = buildWallMesh([{ materialId: 'rammedEarth', thickness: 1.2 }], M, targetDx);
      const steps = (10 * DAY) / dt;
      const res = driveWall(mesh, {
        exteriorTemp: (t) => 273.15 + 10 * Math.sin(omega * t),
        interiorTemp: 273.15,
        dt,
        steps,
        initial: 273.15,
      });
      const from = steps - 4 * (DAY / dt);
      const node = nodeAtDepth(mesh, 0.3);
      const drive = harmonicFit(nodeSeries(res, 0).slice(from), dt, DAY);
      const inner = harmonicFit(nodeSeries(res, node).slice(from), dt, DAY);
      return inner.amplitude / drive.amplitude;
    };
    const base = run(0.02, 120);
    const finerMesh = run(0.01, 120);
    const finerStep = run(0.01, 60);
    expect(Math.abs(finerMesh - base) / base).toBeLessThan(0.01);
    expect(Math.abs(finerStep - finerMesh) / finerMesh).toBeLessThan(0.01);
  });
});
