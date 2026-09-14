/**
 * The fast solver. TASK.md T-02 option (b): per-wall Thomas plus a Schur
 * complement over the coupling nodes.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS EXISTS.
 *
 * A dense LU on the ~170-node system costs n^3/3 per factorisation and n^2 per
 * back substitution, ~29k timesteps per run. That is the ~1.3 s/run that makes
 * a 2000-variant design search impossible (AUDIT.md F-1).
 *
 * But the matrix is not dense. With the node ordering
 *     [air, star, chain_1, chain_2, ... chain_S]
 * every wall chain is TRIDIAGONAL, and only the LAST node of each chain touches
 * the air node and the radiant star node. The matrix is therefore bordered
 * block-tridiagonal -- an "arrow" -- whose Schur complement is a 2x2.
 *
 *     [ K   B ] [ y ]   [ b_y ]        K = block-diagonal, each block tridiagonal
 *     [ B^T D ] [ z ] = [ b_z ]        z = [T_air, T_star], only 2 unknowns
 *
 *     S = D - B^T K^-1 B                (2x2)
 *     S z = b_z - B^T K^-1 b_y
 *     y   = K^-1 b_y - (K^-1 B) z
 *
 * Per hour: factor each chain, O(n). Per step: one Thomas solve per chain plus a
 * 2x2 solve, O(n). The whole run becomes linear in node count.
 * ---------------------------------------------------------------------------
 */

import { EngineError } from '../types.js';

/** A reusable tridiagonal factorisation. */
export interface TriFactors {
  n: number;
  /** Sub-diagonal, as supplied. */
  a: Float64Array;
  /** Forward-eliminated super-diagonal. */
  cp: Float64Array;
  /** Modified diagonal, b[i] - a[i]*cp[i-1]. */
  m: Float64Array;
}

export function triFactor(a: Float64Array, b: Float64Array, c: Float64Array): TriFactors {
  const n = b.length;
  const cp = new Float64Array(n);
  const m = new Float64Array(n);
  if (Math.abs(b[0]!) < 1e-14) throw new EngineError('SINGULAR_MATRIX', 'Zero leading diagonal in a wall chain.');
  m[0] = b[0]!;
  cp[0] = c[0]! / m[0]!;
  for (let i = 1; i < n; i++) {
    const mi = b[i]! - a[i]! * cp[i - 1]!;
    if (Math.abs(mi) < 1e-14) throw new EngineError('SINGULAR_MATRIX', `Zero pivot at node ${i} of a wall chain.`);
    m[i] = mi;
    cp[i] = (c[i] ?? 0) / mi;
  }
  return { n, a, cp, m };
}

/** Solve using a stored factorisation. Writes into `out` if provided. */
export function triSolve(f: TriFactors, d: Float64Array, out?: Float64Array): Float64Array {
  const x = out ?? new Float64Array(f.n);
  triSolveAt(f, d, 0, x, 0);
  return x;
}

/**
 * Offset-aware solve: reads d[dOff..] and writes out[oOff..].
 *
 * The offsets exist to keep the hot loop allocation-free. Using `subarray()`
 * would be tidier but allocates two view objects per chain per timestep --
 * hundreds of thousands of short-lived objects per run, whose GC cost dwarfs the
 * arithmetic this solver was written to make cheap.
 */
export function triSolveAt(
  f: TriFactors,
  d: Float64Array,
  dOff: number,
  out: Float64Array,
  oOff: number,
): void {
  const { n, a, cp, m } = f;
  out[oOff] = d[dOff]! / m[0]!;
  for (let i = 1; i < n; i++) {
    out[oOff + i] = (d[dOff + i]! - a[i]! * out[oOff + i - 1]!) / m[i]!;
  }
  for (let i = n - 2; i >= 0; i--) {
    out[oOff + i] = out[oOff + i]! - cp[i]! * out[oOff + i + 1]!;
  }
}

export interface ChainFactors {
  /** Global index of this chain's first node. */
  offset: number;
  n: number;
  tri: TriFactors;
  /** K^-1 applied to the air-coupling column, length n. */
  invKtoAir: Float64Array;
  /** K^-1 applied to the star-coupling column, length n. */
  invKtoStar: Float64Array;
  /** Coupling magnitudes at this chain's last node. */
  hiA: number;
  hrIA: number;
}

export interface ArrowFactors {
  chains: ChainFactors[];
  totalNodes: number;
  /** Inverse of the 2x2 Schur complement, row-major [s00,s01,s10,s11]. */
  sInv: Float64Array;
  /** Scratch, reused across steps to avoid per-step allocation. */
  scratch: { w: Float64Array };
}

/**
 * Build the arrow factorisation.
 *
 * `diag`/`sub`/`sup` describe each chain; `dAir`/`dStar` are the two coupling
 * diagonal entries; the off-diagonal coupling is -hiA (air) and -hrIA (star) at
 * each chain's last node, which is symmetric, so B^T needs no separate storage.
 *
 * `tieStarToAir` handles the degenerate case where nothing radiates: the star
 * row becomes T_star - T_air = 0 rather than a singular all-zero row.
 */
export function factorArrow(
  chains: Array<{ offset: number; sub: Float64Array; diag: Float64Array; sup: Float64Array; hiA: number; hrIA: number }>,
  dAir: number,
  dStar: number,
  totalNodes: number,
  tieStarToAir: boolean,
): ArrowFactors {
  const out: ChainFactors[] = [];
  // S = D - B^T K^-1 B, accumulated over chains.
  let s00 = dAir;
  let s01 = 0;
  let s10 = 0;
  let s11 = tieStarToAir ? 1 : dStar;

  for (const ch of chains) {
    const tri = triFactor(ch.sub, ch.diag, ch.sup);
    const n = ch.diag.length;
    const last = n - 1;

    // Column of B for the air coupling: -hiA at the last node, zero elsewhere.
    const eAir = new Float64Array(n);
    eAir[last] = -ch.hiA;
    const invKtoAir = triSolve(tri, eAir);

    const eStar = new Float64Array(n);
    eStar[last] = -ch.hrIA;
    const invKtoStar = triSolve(tri, eStar);

    // B^T rows pick out the last node with the same coefficients (symmetry).
    if (!tieStarToAir) {
      s00 -= -ch.hiA * invKtoAir[last]!;
      s01 -= -ch.hiA * invKtoStar[last]!;
      s10 -= -ch.hrIA * invKtoAir[last]!;
      s11 -= -ch.hrIA * invKtoStar[last]!;
    } else {
      s00 -= -ch.hiA * invKtoAir[last]!;
      s01 -= -ch.hiA * invKtoStar[last]!;
    }

    out.push({ offset: ch.offset, n, tri, invKtoAir, invKtoStar, hiA: ch.hiA, hrIA: ch.hrIA });
  }

  if (tieStarToAir) {
    // Row: T_star - T_air = 0.
    s10 = -1;
    s11 = 1;
  }

  const det = s00 * s11 - s01 * s10;
  if (Math.abs(det) < 1e-14) {
    throw new EngineError('SINGULAR_MATRIX', 'The air/radiant coupling system is singular.');
  }
  const sInv = new Float64Array([s11 / det, -s01 / det, -s10 / det, s00 / det]);

  return { chains: out, totalNodes, sInv, scratch: { w: new Float64Array(totalNodes) } };
}

/**
 * Solve the full system for a right-hand side. `b` is indexed globally with
 * air at `airIndex` and star at `starIndex`. Writes the solution into `out`.
 */
export function solveArrow(
  f: ArrowFactors,
  b: Float64Array,
  airIndex: number,
  starIndex: number,
  out: Float64Array,
): Float64Array {
  const w = f.scratch.w;

  // w = K^-1 b_y, chain by chain, in place and without allocating.
  let rhsAir = b[airIndex]!;
  let rhsStar = b[starIndex]!;
  for (const ch of f.chains) {
    triSolveAt(ch.tri, b, ch.offset, w, ch.offset);
    // Reduced right-hand side: b_z - B^T K^-1 b_y.
    const wLast = w[ch.offset + ch.n - 1]!;
    rhsAir += ch.hiA * wLast;
    rhsStar += ch.hrIA * wLast;
  }

  // 2x2 solve for [T_air, T_star].
  const tAir = f.sInv[0]! * rhsAir + f.sInv[1]! * rhsStar;
  const tStar = f.sInv[2]! * rhsAir + f.sInv[3]! * rhsStar;
  out[airIndex] = tAir;
  out[starIndex] = tStar;

  // y = K^-1 b_y - (K^-1 B) z.
  for (const ch of f.chains) {
    for (let i = 0; i < ch.n; i++) {
      out[ch.offset + i] = w[ch.offset + i]! - (ch.invKtoAir[i]! * tAir + ch.invKtoStar[i]! * tStar);
    }
  }
  return out;
}
