/**
 * Performance budget. AUDIT.md F-1: the naive implementation refactorises the LU
 * every timestep and takes ~20 s per run, which would make the design search
 * impossible. The contract is ~50 ms.
 */

import { describe, it, expect } from 'vitest';
import { simulate } from '../src/index.js';
import { buildBox } from './box.js';
import { toK } from '../src/units.js';

describe('performance', () => {
  const realistic = () =>
    buildBox({
      construction: [
        { materialId: 'rammedEarth', thickness: 0.4 },
        { materialId: 'eps', thickness: 0.1 },
        { materialId: 'cementPlaster', thickness: 0.02 },
      ],
      windows: [{ id: 'w1', hostSurfaceId: 'south', area: 4, glazingId: 'double' }],
      ambientAt: (h) => toK(-18 + 10 * Math.sin(((h - 9) / 24) * 2 * Math.PI)),
      ghiAt: (h) => (h > 7 && h < 17 ? 800 * Math.sin(((h - 7) / 10) * Math.PI) : 0),
      internalGainsW: 300,
    });

  it('a full simulation with spin-up completes well inside the interactive budget', () => {
    simulate(realistic()); // warm the JIT
    const runs = 5;
    const t0 = performance.now();
    for (let i = 0; i < runs; i++) simulate(realistic());
    const each = (performance.now() - t0) / runs;
    console.log(`\n  full simulate() incl. spin-up: ${each.toFixed(1)} ms/run`);
    /*
     * The measured figure is ~50 ms, which is the contract budget. The assertion
     * is set looser than that so it fails on a real regression rather than on
     * machine-to-machine variance -- AUDIT.md F-1's naive implementation was
     * ~20 s, so anything in the low hundreds of milliseconds still means the
     * fast path is intact.
     */
    expect(each).toBeLessThan(150);
  });

  it('a design sweep of 100 variants finishes in single-digit seconds', () => {
    const t0 = performance.now();
    for (let i = 0; i < 100; i++) {
      const req = realistic();
      req.building.surfaces[0]!.construction = [
        { materialId: 'rammedEarth', thickness: 0.3 + (i % 10) * 0.02 },
        { materialId: 'eps', thickness: 0.02 + Math.floor(i / 10) * 0.02 },
      ];
      simulate(req);
    }
    const total = (performance.now() - t0) / 1000;
    console.log(`  100-variant sweep: ${total.toFixed(2)} s`);
    expect(total).toBeLessThan(10);
  });
});
