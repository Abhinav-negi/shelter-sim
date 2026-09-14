/**
 * Driving a single wall with a prescribed surface temperature. WORKERS.md W-07.
 *
 * Two uses, both real:
 *   1. Validation Test 2 (BLUEPRINT.md 9.2) -- "the most important test in the
 *      suite", because a homogeneous wall driven by a sinusoid has a closed-form
 *      answer that the numerical scheme must reproduce.
 *   2. The UI's thermal-lag explorer: show a user what a 400 mm earth wall does to
 *      the daily swing before they commit to building one.
 *
 * Uses the Thomas algorithm rather than the dense LU: a single wall chain is
 * tridiagonal, so this is O(n) per step. TASK.md T-02 names this as the
 * per-wall fast path.
 */

import { thomas } from '../solve/linalg.js';
import type { WallMesh } from './mesh.js';

export interface WallDriveOptions {
  /** Prescribed exterior-face temperature at time t (seconds), K. */
  exteriorTemp: (t: number) => number;
  /** Interior-face temperature, held constant, K. */
  interiorTemp: number;
  /** Seconds. */
  dt: number;
  steps: number;
  /** Initial uniform temperature, K. */
  initial: number;
}

export interface WallDriveResult {
  /** Seconds from the start. */
  time: Float64Array;
  /** Flat [step * n + node] temperature history, K. */
  profiles: Float64Array;
  n: number;
  steps: number;
}

/** Backward-Euler march of one wall chain with Dirichlet ends. */
export function driveWall(mesh: WallMesh, opts: WallDriveOptions): WallDriveResult {
  const { dt, steps, initial, interiorTemp } = opts;
  const n = mesh.n;
  const T = new Float64Array(n).fill(initial);
  const profiles = new Float64Array(steps * n);
  const time = new Float64Array(steps);

  // Interior unknowns are nodes 1 .. n-2; both faces are prescribed.
  const m = n - 2;
  const a = new Float64Array(m);
  const bDiag = new Float64Array(m);
  const c = new Float64Array(m);
  const d = new Float64Array(m);

  for (let s = 0; s < steps; s++) {
    const t = (s + 1) * dt;
    T[0] = opts.exteriorTemp(t);
    T[n - 1] = interiorTemp;

    for (let i = 0; i < m; i++) {
      const node = i + 1;
      const uLeft = mesh.U[node - 1]!;
      const uRight = mesh.U[node]!;
      const cap = mesh.C[node]! / dt;
      a[i] = i === 0 ? 0 : -uLeft;
      c[i] = i === m - 1 ? 0 : -uRight;
      bDiag[i] = cap + uLeft + uRight;
      let rhs = cap * T[node]!;
      if (i === 0) rhs += uLeft * T[0]!;
      if (i === m - 1) rhs += uRight * T[n - 1]!;
      d[i] = rhs;
    }

    const x = thomas(a, bDiag, c, d);
    for (let i = 0; i < m; i++) T[i + 1] = x[i]!;

    time[s] = t;
    profiles.set(T, s * n);
  }

  return { time, profiles, n, steps };
}

/**
 * Amplitude and phase of one Fourier component of a series, via a single-bin DFT.
 *
 * More robust than hunting for peaks: peak-finding on a discretely sampled curve
 * quantises the lag to the timestep and is thrown off by any residual transient,
 * whereas projecting onto sin/cos at the known drive frequency uses every sample.
 *
 * CONVENTION: the fit is  v(t) ~ mean + amplitude * sin(omega*t + phaseRad).
 * A wave arriving LATER has a MORE NEGATIVE phase, so the lag of an inner node
 * behind the driven face is (phase_drive - phase_inner) / omega. Use lagSeconds()
 * rather than open-coding it -- getting this subtraction backwards inverts the
 * sign of the single most important result in the engine.
 */
export function harmonicFit(
  series: Float64Array,
  dt: number,
  periodSeconds: number,
): { mean: number; amplitude: number; phaseRad: number } {
  const n = series.length;
  const omega = (2 * Math.PI) / periodSeconds;
  let sumRe = 0;
  let sumIm = 0;
  let mean = 0;
  for (let i = 0; i < n; i++) {
    const t = (i + 1) * dt;
    const v = series[i]!;
    mean += v;
    sumRe += v * Math.cos(omega * t);
    sumIm += v * Math.sin(omega * t);
  }
  mean /= n;
  const re = (2 * sumRe) / n;
  const im = (2 * sumIm) / n;
  return { mean, amplitude: Math.hypot(re, im), phaseRad: Math.atan2(re, im) };
}

/**
 * Time by which `inner` lags `drive`, in seconds. Always non-negative for a wave
 * travelling inward. See the convention note on harmonicFit.
 */
export function lagSeconds(
  drive: { phaseRad: number },
  inner: { phaseRad: number },
  periodSeconds: number,
): number {
  const omega = (2 * Math.PI) / periodSeconds;
  let lag = (drive.phaseRad - inner.phaseRad) / omega;
  // Fold into [0, period): a phase difference is only defined modulo 2*pi.
  lag = ((lag % periodSeconds) + periodSeconds) % periodSeconds;
  return lag;
}

/** Extract the temperature history of one node from a drive result. */
export function nodeSeries(r: WallDriveResult, node: number): Float64Array {
  const out = new Float64Array(r.steps);
  for (let s = 0; s < r.steps; s++) out[s] = r.profiles[s * r.n + node]!;
  return out;
}

/** Index of the mesh node nearest a given depth from the exterior face. */
export function nodeAtDepth(mesh: WallMesh, depthM: number): number {
  let best = 0;
  let bestErr = Infinity;
  for (let i = 0; i < mesh.n; i++) {
    const e = Math.abs(mesh.x[i]! - depthM);
    if (e < bestErr) {
      bestErr = e;
      best = i;
    }
  }
  return best;
}
