/**
 * Validation Tests 1, 4, 6 and 8 -- the full simulate() path.
 * BLUEPRINT.md 9.1, 9.4, 9.6, 9.8.
 */

import { describe, it, expect } from 'vitest';
import { simulate } from '../src/index.js';
import { buildBox } from './box.js';
import { buildWallMesh, constructionUValue } from '../src/envelope/mesh.js';
import { hConvExterior, skyTemperature } from '../src/surfaces/exterior.js';
import { hConvInterior } from '../src/surfaces/interior.js';
import { infiltration } from '../src/loads/infiltration.js';
import { toK, toC } from '../src/units.js';
import { M } from './fixtures.js';
import { ACH_MIN, EngineError } from '../src/index.js';

describe('Test 1 -- steady state', () => {
  it('with no sun, no gains and no sky loss, the indoor air settles to ambient', () => {
    const ambient = toK(-10);
    const r = simulate(
      buildBox({
        ambient,
        groundTemp: ambient,
        emissivity: 0, // disable sky radiation so ambient is the only sink
        absorptivity: 0,
        windSpeed: 2,
      }),
    );
    expect(Math.abs(r.kpis.meanIndoorTemp - ambient)).toBeLessThan(0.01);
    expect(r.kpis.peakToPeakSwing).toBeLessThan(0.01);
  });

  it('with a constant internal gain, dT matches Q / (sum UA + m_dot*cp) by hand', () => {
    const ambient = toK(-10);
    const Q = 1000;
    const side = 4;
    const ach = 0.5;
    const wind = 2;
    const altitude = 3500;
    const req = buildBox({
      ambient,
      groundTemp: ambient,
      emissivity: 0,
      absorptivity: 0,
      windSpeed: wind,
      internalGainsW: Q,
      ach,
      boundary: 'exterior',
      side,
      altitude,
    });
    const r = simulate(req);
    const dT = r.kpis.meanIndoorTemp - ambient;

    // Hand-computed expectation.
    const area = side * side;
    const mesh = buildWallMesh([{ materialId: 'rammedEarth', thickness: 0.3 }], M, 0.02);
    const h_o = hConvExterior(wind, altitude);
    let UA = 0;
    for (const [type, tilt] of [['wall', 90], ['wall', 90], ['wall', 90], ['wall', 90], ['roof', 0], ['floor', 180]] as const) {
      const h_i = hConvInterior(type, ambient, ambient + dT, altitude);
      UA += constructionUValue(mesh, h_o, h_i) * area;
      void tilt;
    }
    const inf = infiltration(ach, area * side, altitude, ambient + dT);
    const expected = Q / (UA + inf.conductance);

    // 3%: the hand calculation uses a single h_i, while the solver picks h_i per
    // surface per hour from the actual flow direction.
    expect(Math.abs(dT - expected) / expected).toBeLessThan(0.03);
  });
});

describe('Test 4 -- adiabatic box (capacitance assembly)', () => {
  /*
   * A sealed, perfectly insulated box with a constant gain must heat at exactly
   * dT/dt = Q / sum(C). That asymptote only holds once the fabric has internally
   * equilibrated, so we run several days and measure the slope over the LAST one.
   * Measuring day one instead would capture the air node racing ahead of the
   * still-cold wall and would be testing the transient, not the capacitance.
   */
  const gain = 500;
  const construction = [{ materialId: 'denseConcrete', thickness: 0.1 }];

  function adiabaticRun(days: number) {
    const req = buildBox({
      boundary: 'adiabatic',
      construction,
      ambient: toK(-10),
      internalGainsW: gain,
      ach: 0,
      allowUnsafeVentilation: true,
      simulationDays: days,
    });
    // An adiabatic box never reaches a periodic steady state -- it simply keeps
    // warming -- so spin-up must be skipped or it would run to its day cap.
    req.options.maxSpinUpDays = 0;
    return { req, result: simulate(req) };
  }

  it('heats at exactly Q / sum(C) once the fabric has equilibrated', () => {
    const { req, result } = adiabaticRun(6);
    const T = result.temperatures.indoorAir;
    const dt = req.options.timestepSeconds;
    const stepsPerDay = 86400 / dt;
    const lastDayRise = T[T.length - 1]! - T[T.length - 1 - stepsPerDay]!;
    const slope = lastDayRise / 86400;
    const expected = gain / totalCapacitance(req);
    expect(Math.abs(slope - expected) / expected).toBeLessThan(0.01);
  });

  it('the late-time ramp is linear (equal rise in each of the last three days)', () => {
    const { req, result } = adiabaticRun(6);
    const T = result.temperatures.indoorAir;
    const stepsPerDay = 86400 / req.options.timestepSeconds;
    const at = (i: number) => T[Math.min(i, T.length - 1)]!;
    const riseOfDay = (d: number) => at((d + 1) * stepsPerDay) - at(d * stepsPerDay);
    const [a, b, c] = [riseOfDay(3), riseOfDay(4), riseOfDay(5)];
    expect(Math.abs(a! - c!) / c!).toBeLessThan(0.01);
    expect(Math.abs(b! - c!) / c!).toBeLessThan(0.01);
  });

  it('no energy is created: rise x capacitance equals the heat put in', () => {
    /*
     * Measured over days 2-5 only. On day 0 the small-capacitance air node races
     * ahead of the cold fabric, so the AIR temperature rise is briefly not
     * representative of the whole system. Once the box has equilibrated every
     * node rises in lockstep and the air temperature is a valid proxy for all of
     * them, which is what makes this a clean capacitance check.
     */
    const { req, result } = adiabaticRun(6);
    const T = result.temperatures.indoorAir;
    const dt = req.options.timestepSeconds;
    const stepsPerDay = 86400 / dt;
    const from = 2 * stepsPerDay;
    const to = T.length - 1;
    const energyIn = gain * (to - from) * dt;
    const energyStored = totalCapacitance(req) * (T[to]! - T[from]!);
    expect(Math.abs(energyStored - energyIn) / energyIn).toBeLessThan(0.01);
  });
});

function totalCapacitance(req: ReturnType<typeof buildBox>): number {
  // Rebuilt independently of the solver so this is a genuine cross-check.
  let C = 0;
  for (const s of req.building.surfaces) {
    for (const layer of s.construction) {
      const m = req.materials[layer.materialId]!;
      C += m.rho * m.c * layer.thickness * s.area;
    }
  }
  const rho = 101325 * Math.pow(1 - 2.25577e-5 * req.site.elevation, 5.25588) / (287.05 * 263.15);
  C += rho * req.building.volume * 1005 * 4;
  return C;
}

describe('Test 7 -- timestep independence on the full model', () => {
  /*
   * Justifies DEFAULT_SIM_OPTIONS.timestepSeconds = 300. Backward Euler is
   * unconditionally stable, so the timestep is purely an accuracy choice -- and
   * the right way to choose it is to measure, across the whole range of building
   * weights, not to inherit a habit. The tin shed is the worst case because it
   * has the least thermal mass and therefore the fastest dynamics.
   */
  const weights: Array<[string, Array<{ materialId: string; thickness: number }>]> = [
    ['tin shed', [{ materialId: 'steelSheet', thickness: 0.001 }]],
    ['fired brick', [{ materialId: 'firedBrick', thickness: 0.23 }]],
    ['heavy insulated', [{ materialId: 'rammedEarth', thickness: 0.4 }, { materialId: 'eps', thickness: 0.1 }]],
  ];

  for (const [label, construction] of weights) {
    it(`300 s matches a 30 s reference for ${label}`, () => {
      const mk = (dt: number) => {
        const req = buildBox({
          construction,
          windows: [{ id: 'w1', hostSurfaceId: 'south', area: 4, glazingId: 'double' }],
          ambientAt: (h) => toK(-18 + 10 * Math.sin(((h - 9) / 24) * 2 * Math.PI)),
          ghiAt: (h) => (h > 7 && h < 17 ? 800 * Math.sin(((h - 7) / 10) * Math.PI) : 0),
          internalGainsW: 300,
        });
        req.options.timestepSeconds = dt;
        return req;
      };
      const reference = simulate(mk(30));
      const coarse = simulate(mk(300));
      expect(Math.abs(coarse.kpis.tempAt0600 - reference.kpis.tempAt0600)).toBeLessThan(0.1);
      const swingError = Math.abs(coarse.kpis.peakToPeakSwing - reference.kpis.peakToPeakSwing) / reference.kpis.peakToPeakSwing;
      expect(swingError).toBeLessThan(0.01);
    });
  }
});

describe('Test 6 -- energy conservation', () => {
  const scenarios: Array<[string, Parameters<typeof buildBox>[0]]> = [
    ['still, dark, cold', { ambient: toK(-20), windSpeed: 0 }],
    ['windy', { ambient: toK(-15), windSpeed: 8 }],
    ['sunny winter day', { ambient: toK(-12), ghiAt: (h) => (h > 7 && h < 17 ? 700 * Math.sin(((h - 7) / 10) * Math.PI) : 0) }],
    ['heavy stone, leaky', { construction: [{ materialId: 'granite', thickness: 0.5 }], ach: 2.5 }],
    ['insulated composite', { construction: [{ materialId: 'rammedEarth', thickness: 0.4 }, { materialId: 'eps', thickness: 0.1 }] }],
    ['with glazing', {
      windows: [{ id: 'w1', hostSurfaceId: 'south', area: 3, glazingId: 'double' }],
      ghiAt: (h) => (h > 7 && h < 17 ? 700 : 0),
    }],
    ['with auxiliary heating', { ambient: toK(-25), aux: { enabled: true, setpoint: toK(18), maxPower: 3000 } }],
  ];

  for (const [label, opts] of scenarios) {
    it(`residual stays under 0.1% -- ${label}`, () => {
      const r = simulate(buildBox(opts));
      expect(r.meta.energyBalanceResidual).toBeLessThan(1e-3);
      expect(r.meta.warnings.some((w) => w.includes('Energy balance residual'))).toBe(false);
    });
  }
});

describe('Test 8 -- symmetry and physical-sense checks', () => {
  it('rotating the whole building 360 degrees reproduces the result exactly', () => {
    const sunny = { ghiAt: (h: number) => (h > 7 && h < 17 ? 700 : 0) };
    const a = simulate(buildBox(sunny));
    const rotated = buildBox(sunny);
    rotated.building.azimuth = 360;
    const b = simulate(rotated);
    expect(b.kpis.tempAt0600).toBeCloseTo(a.kpis.tempAt0600, 9);
  });

  it('with no sun and no gains, indoor never exceeds the ambient maximum', () => {
    const r = simulate(buildBox({ ambientAt: (h) => toK(-20 + 10 * Math.sin((h / 24) * 2 * Math.PI)) }));
    const maxAmbient = Math.max(...r.temperatures.ambient);
    expect(r.kpis.maxIndoorTemp).toBeLessThanOrEqual(maxAmbient + 1e-6);
  });

  it('more insulation monotonically raises the winter minimum temperature', () => {
    let previous = -Infinity;
    for (const t of [0.001, 0.025, 0.05, 0.1, 0.2]) {
      const r = simulate(
        buildBox({
          construction: [{ materialId: 'rammedEarth', thickness: 0.3 }, { materialId: 'eps', thickness: t }],
          ambient: toK(-20),
          internalGainsW: 600,
        }),
      );
      expect(r.kpis.minIndoorTemp).toBeGreaterThan(previous);
      previous = r.kpis.minIndoorTemp;
    }
  });

  /*
   * BLUEPRINT.md 9.8 asserts "increasing thermal mass monotonically reduces the
   * peak-to-peak swing". That is TRUE OF THE CONDUCTION PATH but NOT of the
   * indoor air once a direct air-coupling path exists.
   *
   * Heat reaches the air two ways: conducted through the wall (delayed by the
   * thermal lag) and carried in by leaking air (in phase with ambient). For
   * rammed earth the penetration depth is 0.128 m, so a 12 h lag -- exact
   * antiphase -- occurs at x = pi*d = 0.40 m. Around there the two paths partly
   * CANCEL, so the air swing dips and then rises again to an infiltration-set
   * floor as the wall contribution dies away.
   *
   * The tests below encode what the assertion was actually reaching for.
   */
  const swingOf = (a: Float64Array) => Math.max(...a) - Math.min(...a);
  const dailySwingBox = (thickness: number, extra: Parameters<typeof buildBox>[0] = {}) => {
    const req = buildBox({
      ...extra,
      construction: [{ materialId: 'rammedEarth', thickness }],
      ambientAt: (h) => toK(-15 + 12 * Math.sin((h / 24) * 2 * Math.PI)),
    });
    req.options.spinUpToleranceK = 0.0005;
    req.options.maxSpinUpDays = 120;
    return simulate(req);
  };

  const THICKNESSES = [0.05, 0.15, 0.3, 0.4, 0.5, 0.7];

  it('with a sealed envelope, more mass monotonically damps BOTH air and surface', () => {
    // The pure conduction case: no competing path, so the damping is a clean
    // exponential in thickness, exactly as the analytical solution says.
    let previousAir = Infinity;
    let previousSurface = Infinity;
    for (const t of THICKNESSES) {
      const r = dailySwingBox(t, { ach: 0, allowUnsafeVentilation: true });
      const surfaceSwing = swingOf(r.temperatures.surfaces.south!.interior);
      expect(r.kpis.peakToPeakSwing).toBeLessThan(previousAir);
      expect(surfaceSwing).toBeLessThan(previousSurface);
      previousAir = r.kpis.peakToPeakSwing;
      previousSurface = surfaceSwing;
    }
  });

  it('with leakage, the air swing bottoms out at the ANTIPHASE thickness, pi*d', () => {
    /*
     * Rammed earth: d = sqrt(2a/w) = 0.128 m, so a 12 h lag -- exact antiphase
     * with the outdoor cycle -- occurs at x = pi*d = 0.403 m. There the
     * wall-conducted swing and the infiltration-driven swing partially CANCEL,
     * so the total air swing is at a minimum. This is real interference between
     * two forcing paths of different phase, and it is why BLUEPRINT.md 9.8's
     * blanket "more mass always means less swing" does not hold for the air node
     * once a direct air path exists.
     */
    const swings = THICKNESSES.map((t) => dailySwingBox(t, { ach: 0.5 }).kpis.peakToPeakSwing);
    const minIndex = swings.indexOf(Math.min(...swings));
    expect(THICKNESSES[minIndex]).toBeCloseTo(0.4, 5);
    // And a thick wall still beats a thin one by a wide margin -- the design message survives.
    expect(swings[swings.length - 1]!).toBeLessThan(swings[0]! / 10);
  });

  it('transmitted solar never exceeds what is incident on the glazing', () => {
    const r = simulate(
      buildBox({
        windows: [{ id: 'w1', hostSurfaceId: 'south', area: 4, glazingId: 'single' }],
        ghiAt: (h) => (h > 7 && h < 17 ? 800 : 0),
      }),
    );
    const incident = r.solar.incidentBySurface.south!;
    for (let i = 0; i < incident.length; i++) {
      expect(r.solar.transmittedGlazed[i]!).toBeLessThanOrEqual(incident[i]! * 4 + 1e-9);
    }
  });
});

describe('the cold sky is real and is not optional', () => {
  it('a clear Ladakh night sky sits far below air temperature', () => {
    const skyK = skyTemperature(toK(-15));
    expect(toC(skyK)).toBeLessThan(-40);
    expect(toC(skyK)).toBeGreaterThan(-50);
  });

  it('removing sky radiation makes the shelter measurably warmer at dawn', () => {
    const withSky = simulate(buildBox({ ambient: toK(-20), internalGainsW: 400, emissivity: 0.9 }));
    const withoutSky = simulate(buildBox({ ambient: toK(-20), internalGainsW: 400, emissivity: 0 }));
    expect(withoutSky.kpis.tempAt0600).toBeGreaterThan(withSky.kpis.tempAt0600 + 1);
  });
});

describe('ventilation safety floor', () => {
  it('a request below ACH_MIN is silently raised, not honoured', () => {
    const sealed = simulate(buildBox({ ach: 0.05, ambient: toK(-20), internalGainsW: 800 }));
    const atFloor = simulate(buildBox({ ach: ACH_MIN, ambient: toK(-20), internalGainsW: 800 }));
    expect(sealed.kpis.tempAt0600).toBeCloseTo(atFloor.kpis.tempAt0600, 6);
  });

  it('overriding the floor requires an explicit flag AND emits a warning', () => {
    const r = simulate(buildBox({ ach: 0.05, allowUnsafeVentilation: true, ambient: toK(-20), internalGainsW: 800 }));
    expect(r.meta.warnings.some((w) => w.includes('carbon-monoxide'))).toBe(true);
  });
});

describe('input validation', () => {
  it('reports every problem at once, not just the first', () => {
    const bad = buildBox();
    bad.building.volume = -1;
    bad.site.latitude = 200;
    bad.operation.achSchedule = [1, 2];
    try {
      simulate(bad);
      expect.unreachable('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(EngineError);
      const detail = (e as EngineError).detail as Array<{ path: string }>;
      expect(detail.length).toBeGreaterThanOrEqual(3);
      expect(detail.map((d) => d.path)).toContain('site.latitude');
    }
  });

  it('catches Celsius passed where Kelvin was required', () => {
    const bad = buildBox();
    bad.weather.T_amb = new Float64Array(24).fill(-10); // degC by mistake
    try {
      simulate(bad);
      expect.unreachable('should have thrown');
    } catch (e) {
      const detail = (e as EngineError).detail as Array<{ path: string; message: string }>;
      expect(detail.some((d) => d.message.includes('Celsius'))).toBe(true);
    }
  });
});
