/**
 * Validation Test 3 (composite U-value) and the mesh's structural invariants.
 * BLUEPRINT.md 9.3. "This test specifically catches arithmetic-vs-harmonic
 * conductance averaging at layer interfaces -- the most common silent bug in
 * this kind of code."
 */

import { describe, it, expect } from 'vitest';
import { afterAll } from 'vitest';
import { mkdirSync, writeFileSync, appendFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  buildWallMesh,
  constructionUValue,
  penetrationDepth,
  diffusivity,
  analyticalWavePenetration,
} from '../src/envelope/mesh.js';
import { M } from './fixtures.js';

// T-23 Piece 2: quotable-numbers reporting. Pure side effect -- prints and CSV
// rows only, added beside existing comparisons. No assertion or tolerance here
// is changed; every value below is the same one the real `expect(...)` a few
// lines down already computes and checks.
const CSV_PATH = fileURLToPath(new URL('./output/validation-numbers.csv', import.meta.url));
const CSV_HEADER = 'test,case,measured,analytical,deviation_pct,tolerance,pass\n';
const csvRows: string[] = [];

function reportComparison(
  test: string,
  caseLabel: string,
  measured: number,
  analytical: number,
  deviationPct: number,
  tolerancePct: number,
  pass: boolean,
): void {
  console.log(`${test} ${caseLabel}: measured ${measured}, analytical ${analytical}, deviation ${deviationPct}%`);
  csvRows.push(`${test},"${caseLabel}",${measured},${analytical},${deviationPct},${tolerancePct},${pass}`);
}

afterAll(() => {
  if (csvRows.length === 0) return;
  mkdirSync(fileURLToPath(new URL('./output', import.meta.url)), { recursive: true });
  try {
    writeFileSync(CSV_PATH, CSV_HEADER, { flag: 'wx' }); // create-only: don't clobber a sibling file's rows
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== 'EEXIST') throw e;
  }
  appendFileSync(CSV_PATH, csvRows.join('\n') + '\n');
});

describe('capacitance assembly', () => {
  it('total capacitance equals sum(rho*c*L) exactly, for every construction', () => {
    const cases = [
      [{ materialId: 'denseConcrete', thickness: 0.3 }],
      [{ materialId: 'rammedEarth', thickness: 0.4 }, { materialId: 'eps', thickness: 0.1 }],
      [
        { materialId: 'rammedEarth', thickness: 0.35 },
        { materialId: 'eps', thickness: 0.1 },
        { materialId: 'cementPlaster', thickness: 0.02 },
      ],
    ];
    for (const construction of cases) {
      const mesh = buildWallMesh(construction, M);
      const expected = construction.reduce((acc, l) => {
        const m = M[l.materialId]!;
        return acc + m.rho * m.c * l.thickness;
      }, 0);
      const actual = mesh.C.reduce((a, b) => a + b, 0);
      expect(actual).toBeCloseTo(expected, 6);
    }
  });

  it('total thickness is preserved', () => {
    const mesh = buildWallMesh(
      [{ materialId: 'rammedEarth', thickness: 0.35 }, { materialId: 'eps', thickness: 0.1 }],
      M,
    );
    expect(mesh.thickness).toBeCloseTo(0.45, 12);
  });
});

describe('Test 3 -- composite wall steady-state U-value', () => {
  it('fabric resistance is exactly sum(L/k) for a 25x conductivity contrast', () => {
    // Rammed earth k=1.0 next to EPS k=0.036. An arithmetic mean of k at this
    // interface would be wrong by a large, silent margin.
    const construction = [
      { materialId: 'rammedEarth', thickness: 0.4 },
      { materialId: 'eps', thickness: 0.1 },
      { materialId: 'cementPlaster', thickness: 0.02 },
    ];
    const mesh = buildWallMesh(construction, M);
    const expectedR = construction.reduce((acc, l) => acc + l.thickness / M[l.materialId]!.k, 0);
    const fabricRTol = 0.5e-10;
    const fabricRMeasured = 1 / mesh.fabricU;
    const fabricRDev = Math.abs(fabricRMeasured - expectedR);
    reportComparison('TEST3', 'fabric resistance sum(L/k), 25x conductivity contrast', fabricRMeasured, expectedR, (fabricRDev / expectedR) * 100, (fabricRTol / expectedR) * 100, fabricRDev < fabricRTol);
    expect(1 / mesh.fabricU).toBeCloseTo(expectedR, 10);
  });

  it('U including surface films matches 1/(1/h_o + sum(L/k) + 1/h_i) within 0.5%', () => {
    const h_o = 25;
    const h_i = 7.7;
    const construction = [
      { materialId: 'firedBrick', thickness: 0.23 },
      { materialId: 'eps', thickness: 0.05 },
    ];
    const mesh = buildWallMesh(construction, M);
    const expected = 1 / (1 / h_o + 0.23 / 0.72 + 0.05 / 0.036 + 1 / h_i);
    const actual = constructionUValue(mesh, h_o, h_i);
    const uDevFrac = Math.abs(actual - expected) / expected;
    reportComparison('TEST3', 'U-value incl. surface films, fired brick + EPS', actual, expected, uDevFrac * 100, 0.5, uDevFrac < 0.005);
    expect(Math.abs(actual - expected) / expected).toBeLessThan(0.005);
  });

  it('adding insulation always lowers U (BLUEPRINT 9.8 monotonicity)', () => {
    let previous = Infinity;
    for (const t of [0.0001, 0.025, 0.05, 0.1, 0.2]) {
      const mesh = buildWallMesh(
        [{ materialId: 'rammedEarth', thickness: 0.4 }, { materialId: 'eps', thickness: t }],
        M,
      );
      const u = constructionUValue(mesh, 25, 7.7);
      expect(u).toBeLessThan(previous);
      previous = u;
    }
  });
});

describe('mesh resolution', () => {
  it('penetration depth for dense concrete is ~0.151 m (BLUEPRINT 5.6.3 worked example)', () => {
    expect(diffusivity(M.denseConcrete!)).toBeCloseTo(8.29e-7, 9);
    expect(penetrationDepth(M.denseConcrete!)).toBeCloseTo(0.151, 3);
  });

  it('resolves the daily wave with at least 5 nodes per penetration depth', () => {
    for (const id of ['denseConcrete', 'rammedEarth', 'granite', 'mudBrick']) {
      const m = M[id]!;
      const mesh = buildWallMesh([{ materialId: id, thickness: 0.4 }], M);
      const dx = mesh.thickness / (mesh.n - 1);
      expect(dx).toBeLessThanOrEqual(penetrationDepth(m) / 5 + 1e-12);
    }
  });

  it('keeps the node count sane for a thick heavy wall', () => {
    const mesh = buildWallMesh([{ materialId: 'granite', thickness: 0.6 }], M);
    expect(mesh.n).toBeGreaterThan(10);
    expect(mesh.n).toBeLessThan(80);
  });

  it('honours the penetration-depth rule on THICK walls too (regression: slice cap)', () => {
    /*
     * The per-layer slice cap used to be 24, which silently overrode the
     * 5-nodes-per-penetration-depth rule on any wall thicker than ~0.6 m and
     * produced a ~3% decrement error with no warning. Earth-bermed and thick
     * rammed-earth walls are exactly the Ladakh case, so this guard matters.
     */
    for (const thickness of [0.8, 1.0, 1.5, 2.0]) {
      for (const id of ['rammedEarth', 'denseConcrete', 'granite']) {
        const mesh = buildWallMesh([{ materialId: id, thickness }], M, 0.02);
        const dx = mesh.thickness / (mesh.n - 1);
        expect(dx).toBeLessThanOrEqual(penetrationDepth(M[id]!) / 5 + 1e-12);
      }
    }
  });
});

describe('analytical thermal lag -- the number that justifies the whole project', () => {
  it('300 mm dense concrete: decrement ~0.137, lag ~7.6 h (BLUEPRINT 5.6.5)', () => {
    const r = analyticalWavePenetration(M.denseConcrete!, 0.3);
    expect(r.penetrationDepth).toBeCloseTo(0.151, 3);
    expect(r.decrement).toBeCloseTo(0.137, 2);
    expect(r.lagHours).toBeCloseTo(7.6, 1);
  });

  it('a thin steel sheet has essentially no lag and no damping', () => {
    const r = analyticalWavePenetration(M.steelSheet!, 0.001);
    expect(r.decrement).toBeGreaterThan(0.99);
    expect(r.lagHours).toBeLessThan(0.05);
  });

  it('more thermal mass always means more damping', () => {
    let previous = 1;
    for (const x of [0.1, 0.2, 0.3, 0.4]) {
      const f = analyticalWavePenetration(M.rammedEarth!, x).decrement;
      expect(f).toBeLessThan(previous);
      previous = f;
    }
  });
});
