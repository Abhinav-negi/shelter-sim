/**
 * Dense LU with partial pivoting, and the Thomas algorithm for tridiagonal systems.
 * WORKERS.md W-05. No numerics library -- this is ~130 lines and the team can
 * answer for its own solver when a judge asks.
 *
 * Matrices are row-major Float64Array of length n*n.
 */

import { EngineError } from '../types.js';

export interface LuFactors {
  n: number;
  /** Combined L\U, row-major. */
  lu: Float64Array;
  /** Row permutation. */
  piv: Int32Array;
}

/** Factorise a copy of `a`. Throws SINGULAR_MATRIX on a zero pivot. */
export function luFactor(a: Float64Array, n: number): LuFactors {
  const lu = Float64Array.from(a);
  const piv = new Int32Array(n);
  for (let i = 0; i < n; i++) piv[i] = i;

  for (let k = 0; k < n; k++) {
    // Partial pivot: largest magnitude in column k at or below row k.
    let maxRow = k;
    let maxVal = Math.abs(lu[k * n + k]!);
    for (let i = k + 1; i < n; i++) {
      const v = Math.abs(lu[i * n + k]!);
      if (v > maxVal) {
        maxVal = v;
        maxRow = i;
      }
    }
    if (maxVal < 1e-14) {
      throw new EngineError(
        'SINGULAR_MATRIX',
        `Zero pivot at column ${k}: the thermal network is disconnected or a node has zero capacitance.`,
      );
    }
    if (maxRow !== k) {
      for (let j = 0; j < n; j++) {
        const t = lu[k * n + j]!;
        lu[k * n + j] = lu[maxRow * n + j]!;
        lu[maxRow * n + j] = t;
      }
      const tp = piv[k]!;
      piv[k] = piv[maxRow]!;
      piv[maxRow] = tp;
    }
    const pivot = lu[k * n + k]!;
    for (let i = k + 1; i < n; i++) {
      const f = lu[i * n + k]! / pivot;
      lu[i * n + k] = f;
      if (f === 0) continue;
      for (let j = k + 1; j < n; j++) {
        lu[i * n + j] = lu[i * n + j]! - f * lu[k * n + j]!;
      }
    }
  }
  return { n, lu, piv };
}

/** Solve A*x = b from a previous factorisation. Writes into `out` if given. */
export function luSolve(f: LuFactors, b: Float64Array, out?: Float64Array): Float64Array {
  const { n, lu, piv } = f;
  const x = out ?? new Float64Array(n);
  for (let i = 0; i < n; i++) x[i] = b[piv[i]!]!;
  // Forward substitution through L (unit diagonal).
  for (let i = 1; i < n; i++) {
    let s = x[i]!;
    for (let j = 0; j < i; j++) s -= lu[i * n + j]! * x[j]!;
    x[i] = s;
  }
  // Back substitution through U.
  for (let i = n - 1; i >= 0; i--) {
    let s = x[i]!;
    for (let j = i + 1; j < n; j++) s -= lu[i * n + j]! * x[j]!;
    x[i] = s / lu[i * n + i]!;
  }
  return x;
}

/**
 * Thomas algorithm for a tridiagonal system: O(n) instead of O(n^3).
 * A wall's through-thickness chain is tridiagonal, so this is the fast path.
 * a = sub-diagonal, b = diagonal, c = super-diagonal, d = right-hand side.
 */
export function thomas(a: Float64Array, b: Float64Array, c: Float64Array, d: Float64Array): Float64Array {
  const n = b.length;
  const cp = new Float64Array(n);
  const dp = new Float64Array(n);
  if (Math.abs(b[0]!) < 1e-14) {
    throw new EngineError('SINGULAR_MATRIX', 'Zero leading diagonal in tridiagonal solve.');
  }
  cp[0] = c[0]! / b[0]!;
  dp[0] = d[0]! / b[0]!;
  for (let i = 1; i < n; i++) {
    const m = b[i]! - a[i]! * cp[i - 1]!;
    if (Math.abs(m) < 1e-14) {
      throw new EngineError('SINGULAR_MATRIX', `Zero pivot at row ${i} in tridiagonal solve.`);
    }
    cp[i] = (c[i] ?? 0) / m;
    dp[i] = (d[i]! - a[i]! * dp[i - 1]!) / m;
  }
  const x = new Float64Array(n);
  x[n - 1] = dp[n - 1]!;
  for (let i = n - 2; i >= 0; i--) x[i] = dp[i]! - cp[i]! * x[i + 1]!;
  return x;
}

/** Infinity-norm of A*x - b. Used by the solver tests. */
export function residualInf(a: Float64Array, n: number, x: Float64Array, b: Float64Array): number {
  let worst = 0;
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let j = 0; j < n; j++) s += a[i * n + j]! * x[j]!;
    worst = Math.max(worst, Math.abs(s - b[i]!));
  }
  return worst;
}
