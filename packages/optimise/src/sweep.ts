/**
 * The sweep engine: expand a `SweepRequest` into concrete `SimulationRequest`
 * variants, dispatch them through an injected runner, and collect a
 * `SweepResult`. LOG.md T-54 / CONTRACTS.md §7.15.
 *
 * No ranking, no Pareto sort, no tie-grouping, no perturbation-stability check
 * -- all of that is T-56's `search.ts`. `variants` here is ordered ascending
 * by `PRIMARY_METRIC` only because CONTRACTS.md §7.15 documents that ordering
 * as part of the disk shape; `ties` stays empty and every `paretoRank` stays
 * `0` until T-56 fills them in.
 *
 * No worker pool of its own -- `runner` is injected so the identical dispatch
 * loop below runs against a synchronous `simulate` in a test, a server
 * worker-thread pool (T-40), or a browser Web Worker pool (T-55).
 */

import {
  ACH_MIN,
  ACH_MIN_COMBUSTION_ALLOWANCE,
  PRIMARY_METRIC,
  toK,
  type Building,
  type Glazing,
  type Layer,
  type Material,
  type SimulationRequest,
  type SimulationResult,
  type StorageElement,
  type Surface,
  type SweepRequest,
  type SweepResult,
  type SweepVariant,
  type VariableSpec,
} from '@shelter/engine';

// ============================== EXPANSION ==============================

export interface ExpandedVariant {
  id: string;
  request: SimulationRequest;
  /** Human-readable, for the UI -- CONTRACTS.md §7.15. */
  overrides: Record<string, string | number | boolean>;
}

/** South=0, East=-90, West=+90, North=180 -- Surface.azimuth's own convention (CONTRACTS.md §7.5). */
const ORIENTATION_AZIMUTH: Record<'S' | 'E' | 'W' | 'N', number> = { S: 0, E: -90, W: 90, N: 180 };

function normaliseAzimuth(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

function requireMaterial(materials: Record<string, Material>, id: string, specKind: string): Material {
  const m = materials[id];
  if (!m) {
    throw new Error(`expandVariants: ${specKind} value "${id}" is not a key in base.materials`);
  }
  return m;
}

function requireGlazing(glazings: Record<string, Glazing>, id: string): Glazing {
  const g = glazings[id];
  if (!g) {
    throw new Error(`expandVariants: glazing value "${id}" is not a key in base.glazings`);
  }
  return g;
}

/**
 * Swaps the STRUCTURAL layer's material id within every surface of `type`,
 * keeping every layer's thickness and every non-structural (insulation,
 * finish) layer untouched. This is "swap layer lists" read the only way that
 * is possible without a construction catalogue import (packages/optimise may
 * depend on nothing but @shelter/engine, CONTRACTS.md §7.13) -- the caller
 * supplies every candidate material's real k/rho/c/cost/carbon via
 * `base.materials`, the same way any `SimulationRequest` already must.
 */
function swapStructuralMaterial(building: Building, materials: Record<string, Material>, type: Surface['type'], materialId: string): void {
  for (const s of building.surfaces) {
    if (s.type !== type) continue;
    s.construction = s.construction.map((layer) => {
      const layerMaterial = materials[layer.materialId];
      return layerMaterial?.category === 'structural' ? { ...layer, materialId } : layer;
    });
  }
}

function applyWallConstruction(req: SimulationRequest, materialId: string): string {
  const material = requireMaterial(req.materials, materialId, 'wallConstruction');
  swapStructuralMaterial(req.building, req.materials, 'wall', materialId);
  return material.name;
}

function applyRoofConstruction(req: SimulationRequest, materialId: string): string {
  const material = requireMaterial(req.materials, materialId, 'roofConstruction');
  swapStructuralMaterial(req.building, req.materials, 'roof', materialId);
  return material.name;
}

function applyInsulationThickness(req: SimulationRequest, thicknessM: number): number {
  for (const s of req.building.surfaces) {
    s.construction = s.construction.map((layer) => {
      const m = req.materials[layer.materialId];
      return m?.category === 'insulation' ? { ...layer, thickness: thicknessM } : layer;
    });
  }
  return thicknessM;
}

/**
 * Reorders a surface's layers so the insulation sits inside / outside /
 * within a split-mass cavity, WITHOUT changing any layer's thickness -- total
 * construction thickness (and therefore the steady-state U-value, a sum of
 * series resistances, order-independent) is identical across positions.
 * Acceptance test 3 is exactly this invariant.
 */
function reorderInsulation(construction: Layer[], materials: Record<string, Material>, position: 'inside' | 'outside' | 'cavity'): Layer[] {
  const insulation = construction.filter((l) => materials[l.materialId]?.category === 'insulation');
  const rest = construction.filter((l) => materials[l.materialId]?.category !== 'insulation');
  if (insulation.length === 0) return construction; // nothing to reorder on this surface

  if (position === 'outside') return [...insulation, ...rest];
  if (position === 'inside') return [...rest, ...insulation];

  // 'cavity': sandwich the insulation between two mass leaves, splitting a
  // single remaining layer in half so total thickness is exactly preserved.
  if (rest.length === 0) return insulation;
  if (rest.length === 1) {
    const layer = rest[0]!;
    const half: Layer = { materialId: layer.materialId, thickness: layer.thickness / 2 };
    return [{ ...half }, ...insulation, { ...half }];
  }
  const mid = Math.ceil(rest.length / 2);
  return [...rest.slice(0, mid), ...insulation, ...rest.slice(mid)];
}

function applyInsulationPosition(req: SimulationRequest, position: 'inside' | 'outside' | 'cavity'): string {
  for (const s of req.building.surfaces) {
    if (s.type === 'floor') continue; // ground-coupled; position is a wall/roof concept here
    s.construction = reorderInsulation(s.construction, req.materials, position);
  }
  return position;
}

function applyGlazing(req: SimulationRequest, glazingId: string): string {
  const glazing = requireGlazing(req.glazings, glazingId);
  for (const w of req.building.windows) w.glazingId = glazingId;
  return glazing.name;
}

function applyWwr(req: SimulationRequest, orientation: 'S' | 'E' | 'W' | 'N', value: number): number {
  const az = ORIENTATION_AZIMUTH[orientation];
  const hosts = new Map(req.building.surfaces.filter((s) => s.type !== 'floor' && normaliseAzimuth(s.azimuth) === normaliseAzimuth(az)).map((s) => [s.id, s]));
  if (hosts.size === 0) {
    throw new Error(`expandVariants: wwr orientation "${orientation}" matches no wall/roof surface in base.building`);
  }
  let touched = false;
  for (const w of req.building.windows) {
    const host = hosts.get(w.hostSurfaceId);
    if (!host) continue;
    touched = true;
    const grossFacadeAreaM2 = host.area + w.area; // net wall area + its own (base) window area
    w.area = value * grossFacadeAreaM2;
  }
  if (!touched) {
    throw new Error(`expandVariants: wwr orientation "${orientation}" has no window hosted on it in base.building.windows`);
  }
  return value;
}

function applyAspectRatio(req: SimulationRequest, ratio: number): number {
  const { floorArea, volume } = req.building;
  const heightM = volume / floorArea; // held fixed -- only the footprint's W:L changes
  const widthM = Math.sqrt(floorArea / ratio);
  const lengthM = floorArea / widthM;
  for (const s of req.building.surfaces) {
    if (s.type !== 'wall') continue;
    const az = normaliseAzimuth(s.azimuth);
    // ponytail: only the four cardinal wall azimuths are resized; an oblique
    // wall (neither N/S/E/W) keeps its base area -- upgrade path is a real
    // polygon footprint model, out of scope for a Cartesian variable sweep.
    if (az === 0 || az === 180) s.area = widthM * heightM;
    else if (az === 90 || az === 270) s.area = lengthM * heightM;
  }
  return ratio;
}

/** 18:00-06:00 local -- the usual night-shutter window. A named, tunable constant per LOG.md rule 14. */
const NIGHT_SHUTTER_HOURS = new Set([18, 19, 20, 21, 22, 23, 0, 1, 2, 3, 4, 5]);

function applyNightShutters(req: SimulationRequest, enabled: boolean): boolean {
  for (const w of req.building.windows) {
    if (enabled) {
      w.shadingSchedule = Array.from({ length: 24 }, (_, h) => NIGHT_SHUTTER_HOURS.has(h));
    } else {
      delete w.shadingSchedule;
      delete w.shutterResistance;
    }
  }
  return enabled;
}

// Mass-strategy calibration knobs -- LOG.md rule 14: named, tunable, and the
// evidence that would justify moving them lives here, not buried in a call site.
/** "Heavy floor"/"trombe" thicken their existing mass layer by this factor rather than invent a new material. */
const MASS_STRATEGY_THICKNESS_MULTIPLIER = 2;
/** Black paint, BLUEPRINT.md Appendix B surface-optical-properties table -- the Trombe absorber face. */
const TROMBE_ABSORBER_ABSORPTIVITY = 0.95;
const TROMBE_ABSORBER_EMISSIVITY = 0.9;
/** A standard ~200 L drum. */
const DEFAULT_WATER_STORAGE_MASS_KG = 200;
/** A modest PCM module; real sizing is a T-24/T-57 concern. */
const DEFAULT_PCM_STORAGE_MASS_KG = 100;
const DEFAULT_STORAGE_SURFACE_AREA_M2 = 2;
const DEFAULT_STORAGE_CONDUCTANCE_W_PER_K = 20;
const PCM_MELT_POINT_C = 25; // RT25-class paraffin, CONTRACTS.md §7.11
const PCM_MELT_RANGE_K = 3;
const PCM_LATENT_HEAT_J_PER_KG = 200_000;

function findStorageMaterialId(materials: Record<string, Material>, kind: 'water' | 'pcm'): string {
  const pattern = kind === 'water' ? /water/i : /pcm/i;
  const found = Object.values(materials).find((m) => m.category === 'storage' && (pattern.test(m.id) || pattern.test(m.name)));
  if (!found) {
    throw new Error(`expandVariants: massStrategy "${kind}" requires a category:'storage' material matching /${pattern.source}/i in base.materials`);
  }
  return found.id;
}

function applyMassStrategy(req: SimulationRequest, kind: 'none' | 'floor' | 'trombe' | 'water' | 'pcm'): string {
  if (kind === 'none') {
    req.building.storageElements = [];
    return kind;
  }
  if (kind === 'floor' || kind === 'trombe') {
    const target =
      kind === 'floor'
        ? req.building.surfaces.find((s) => s.type === 'floor')
        : // The most south-facing wall stands in for the Trombe absorber wall --
          // same approximation packages/data's own GERES Trombe preset uses
          // (data/src/presets.ts): a single massive, high-absorptivity face,
          // no separate glazed air cavity node. Upgrade path: a real two-node
          // Trombe model is a physics addition, out of scope here (rule 12).
          req.building.surfaces.filter((s) => s.type === 'wall').sort((a, b) => Math.abs(normaliseAzimuth(a.azimuth) - 180) - Math.abs(normaliseAzimuth(b.azimuth) - 180))[0];
    if (target) {
      target.construction = target.construction.map((l) => ({ ...l, thickness: l.thickness * MASS_STRATEGY_THICKNESS_MULTIPLIER }));
      if (kind === 'trombe') {
        target.exteriorAbsorptivity = TROMBE_ABSORBER_ABSORPTIVITY;
        target.exteriorEmissivity = TROMBE_ABSORBER_EMISSIVITY;
      }
    }
    return kind;
  }
  // 'water' | 'pcm'
  const materialId = findStorageMaterialId(req.materials, kind);
  const element: StorageElement = {
    id: `sweep-massStrategy-${kind}`,
    kind: kind === 'water' ? 'water' : 'pcm',
    materialId,
    massKg: kind === 'water' ? DEFAULT_WATER_STORAGE_MASS_KG : DEFAULT_PCM_STORAGE_MASS_KG,
    surfaceAreaToRoom: DEFAULT_STORAGE_SURFACE_AREA_M2,
    conductanceToRoom: DEFAULT_STORAGE_CONDUCTANCE_W_PER_K,
    ...(kind === 'pcm' ? { meltPoint: toK(PCM_MELT_POINT_C), meltRangeK: PCM_MELT_RANGE_K, latentHeat: PCM_LATENT_HEAT_J_PER_KG } : {}),
  };
  req.building.storageElements = [element];
  return kind;
}

interface Choice {
  apply: (req: SimulationRequest) => string | number | boolean;
}

function choicesForSpec(spec: VariableSpec): Choice[] {
  switch (spec.kind) {
    case 'wallConstruction':
      return spec.values.map((v) => ({ apply: (req) => applyWallConstruction(req, v) }));
    case 'roofConstruction':
      return spec.values.map((v) => ({ apply: (req) => applyRoofConstruction(req, v) }));
    case 'insulationThickness':
      return spec.values.map((v) => ({ apply: (req) => applyInsulationThickness(req, v) }));
    case 'insulationPosition':
      return spec.values.map((v) => ({ apply: (req) => applyInsulationPosition(req, v) }));
    case 'glazing':
      return spec.values.map((v) => ({ apply: (req) => applyGlazing(req, v) }));
    case 'wwr':
      return spec.values.map((v) => ({ apply: (req) => applyWwr(req, spec.orientation, v) }));
    case 'buildingAzimuth':
      return spec.values.map((v) => ({
        apply: (req) => {
          req.building.azimuth = v;
          return v;
        },
      }));
    case 'aspectRatio':
      return spec.values.map((v) => ({ apply: (req) => applyAspectRatio(req, v) }));
    case 'nightShutters':
      return spec.values.map((v) => ({ apply: (req) => applyNightShutters(req, v) }));
    case 'massStrategy':
      return spec.values.map((v) => ({ apply: (req) => applyMassStrategy(req, v) }));
    case 'ach':
      return spec.values.map((v) => ({
        apply: (req) => {
          req.operation.achSchedule = new Array(24).fill(v);
          return v;
        },
      }));
  }
}

function overrideKey(spec: VariableSpec): string {
  return spec.kind === 'wwr' ? `wwr:${spec.orientation}` : spec.kind;
}

/**
 * The Cartesian expansion of `req.variables` over `req.base`, capped at
 * `req.maxVariants`. Deterministic nested-loop (odometer) order: the LAST
 * variable in `req.variables` varies fastest, so a cap always keeps a
 * contiguous, reproducible prefix of the full product -- CONTRACTS.md §7.15
 * acceptance test 2 ("no misleading metadata").
 */
export function expandVariants(req: SweepRequest): ExpandedVariant[] {
  const specs = req.variables;
  const choiceLists = specs.map(choicesForSpec);
  const totalCombos = choiceLists.reduce((n, list) => n * list.length, 1);
  const count = Math.max(0, Math.min(req.maxVariants, totalCombos));

  const out: ExpandedVariant[] = [];
  const indices = new Array(specs.length).fill(0);
  for (let i = 0; i < count; i++) {
    const request = structuredClone(req.base);
    const overrides: Record<string, string | number | boolean> = {};
    for (let s = 0; s < specs.length; s++) {
      const choice = choiceLists[s]![indices[s]!]!;
      overrides[overrideKey(specs[s]!)] = choice.apply(request);
    }
    out.push({ id: `v${i}`, request, overrides });

    for (let s = specs.length - 1; s >= 0; s--) {
      indices[s]! += 1;
      if (indices[s]! < choiceLists[s]!.length) break;
      indices[s] = 0;
    }
  }
  return out;
}

// ============================== DISPATCH ==============================

/**
 * Hashes the fields that change the envelope's thermal mass (constructions,
 * thicknesses, storage elements, volume) -- CONTRACTS.md §7.15 / T-54's
 * prompt. Variants sharing this key share a spin-up-day cache entry.
 */
function massAffectingHash(request: SimulationRequest): string {
  const surfaces = [...request.building.surfaces]
    .map((s) => ({ id: s.id, type: s.type, construction: s.construction }))
    .sort((a, b) => a.id.localeCompare(b.id));
  const storage = [...(request.building.storageElements ?? [])]
    .map((e) => ({ kind: e.kind, materialId: e.materialId, massKg: e.massKg }))
    .sort((a, b) => a.materialId.localeCompare(b.materialId));
  return JSON.stringify({ surfaces, storage, volume: request.building.volume });
}

/**
 * The state cached per mass-hash group: enough to build a same-length,
 * same-ballpark `options.initialTemperatureK` for every later variant that
 * shares this hash.
 */
interface SpinUpCacheEntry {
  /** `SimulationResult.meta.nodeCount` of the first-computed variant in this group. */
  nodeCount: number;
  /** The uniform warm-start fill value, K -- see `warmStartFillK` below. */
  fillK: number;
}

/**
 * T-70 (`packages/engine`, merged on master) added `SimOptions.initialTemperatureK`:
 * an optional per-node seed for `integrate()`'s spin-up loop, validated against the
 * built model's node count. This is what `@shelter/optimise` was missing when this
 * task was first attempted (see this task's Evidence block, "NOT MET" sub-section) --
 * the day-count-only cap that used to live here (`SPIN_UP_SHARE_MARGIN_DAYS`) is
 * gone, replaced by an actual warm state.
 *
 * `initialTemperatureK` must be a `Float64Array` of length `n`, one entry per
 * INTERNAL solver node (each wall's mesh chain, the air node, the star node, every
 * storage node), in `packages/engine`'s own internal order. That order (and even
 * which index is which) is not part of the public contract -- `buildModel`, `Model`,
 * `AIR_NODE`, `STAR_NODE` are not exported from `@shelter/engine`'s index (CONTRACTS.md
 * §7.7 lists exactly what `SimulationResult` exposes, and it is per-channel series,
 * not the raw node vector). `@shelter/optimise`'s only approved dependency is
 * `@shelter/engine` (CONTRACTS.md §7.13), so this package cannot assume, guess at, or
 * hard-code that internal layout -- doing so would silently feed the wrong value into
 * the wrong node the moment `packages/engine` ever reordered its own nodes, and no
 * contract or test here would catch it.
 *
 * The one construction that is correct **regardless of internal node order** is a
 * UNIFORM fill: `new Float64Array(n).fill(v)` puts the same value `v` at every
 * index, so it cannot be "wrong node, right value" no matter how `n` is laid out
 * internally. `v` is chosen to be a much better guess than the engine's own cold
 * start (`fill(mean(T_amb))`, packages/engine/src/solve/integrator.ts): the plain
 * average, over every reported timestep, of every solved-node channel this
 * package's public contract actually exposes (`temperatures.indoorAir`, `.ground`,
 * `.meanRadiant`, and every surface's `.exterior`/`.interior`) -- see
 * `warmStartFillK` below. This is a SPEED lever only: T-70's own acceptance test 3
 * proved a warm start that is flatly wrong still converges to the same fixed point
 * within `spinUpToleranceK`, just possibly in more days than a good guess.
 */
function warmStartFillK(result: SimulationResult): number {
  let sum = 0;
  let count = 0;
  const add = (arr: Float64Array): void => {
    for (let i = 0; i < arr.length; i++) {
      sum += arr[i]!;
      count++;
    }
  };
  add(result.temperatures.indoorAir);
  add(result.temperatures.ground);
  add(result.temperatures.meanRadiant);
  for (const s of Object.values(result.temperatures.surfaces)) {
    add(s.exterior);
    add(s.interior);
  }
  return count > 0 ? sum / count : result.kpis.meanIndoorTemp;
}

function computeAchFloor(req: SweepRequest, request: SimulationRequest): number {
  const floor = Math.max(req.constraints.achMin, ACH_MIN);
  return request.operation.hasUnventedCombustion ? floor + ACH_MIN_COMBUSTION_ALLOWANCE : floor;
}

/** Rough BOQ-style estimate from catalogue numbers already on the request -- not a real quantity survey (T-24/T-57's job). */
function estimateCapitalCostINR(request: SimulationRequest): number {
  let total = 0;
  for (const s of request.building.surfaces) {
    for (const layer of s.construction) {
      const material = request.materials[layer.materialId];
      if (!material?.costPerM3) continue;
      total += s.area * layer.thickness * material.costPerM3;
    }
  }
  for (const w of request.building.windows) {
    const glazing = request.glazings[w.glazingId];
    if (glazing?.costPerM2) total += w.area * glazing.costPerM2;
  }
  for (const el of request.building.storageElements ?? []) {
    const material = request.materials[el.materialId];
    if (material?.costPerM3 && material.rho > 0) total += (el.massKg / material.rho) * material.costPerM3;
  }
  return total;
}

function estimateEmbodiedCarbonKg(request: SimulationRequest): number {
  let total = 0;
  for (const s of request.building.surfaces) {
    for (const layer of s.construction) {
      const material = request.materials[layer.materialId];
      if (!material?.embodiedCarbon) continue;
      total += s.area * layer.thickness * material.embodiedCarbon;
    }
  }
  for (const el of request.building.storageElements ?? []) {
    const material = request.materials[el.materialId];
    if (material?.embodiedCarbon && material.rho > 0) total += (el.massKg / material.rho) * material.embodiedCarbon;
  }
  return total;
}

/**
 * Expand, dispatch through the injected `runner`, and collect a
 * `SweepResult`. Dispatch is sequential (one `runner()` call in flight at a
 * time): that is what lets cancellation stop "within one variant's runtime"
 * (acceptance test 7) and what lets the spin-up cache above learn a mass
 * group's representative day-count before its later members are dispatched.
 * A pool-backed `runner` (T-55) is free to be fast per call; this loop does
 * not add its own concurrency on top of it (T-54's prompt: "no worker pool
 * of our own").
 */
export async function runSweep(
  req: SweepRequest,
  runner: (r: SimulationRequest) => Promise<SimulationResult>,
  onProgress?: (done: number, total: number) => void,
  signal?: AbortSignal,
): Promise<SweepResult> {
  const startedAt = performance.now();
  const expanded = expandVariants(req);
  const total = expanded.length;
  const spinUpCache = new Map<string, SpinUpCacheEntry>();
  let spinUpShared = false;

  const variants: SweepVariant[] = [];
  onProgress?.(0, total);

  for (const ev of expanded) {
    if (signal?.aborted) {
      throw new DOMException('Sweep cancelled', 'AbortError');
    }

    const hash = massAffectingHash(ev.request);
    const cached = spinUpCache.get(hash);
    if (cached !== undefined) {
      ev.request = {
        ...ev.request,
        options: { ...ev.request.options, initialTemperatureK: new Float64Array(cached.nodeCount).fill(cached.fillK) },
      };
      spinUpShared = true;
    }

    const result = await runner(ev.request);
    if (!spinUpCache.has(hash)) spinUpCache.set(hash, { nodeCount: result.meta.nodeCount, fillK: warmStartFillK(result) });

    const achFloor = computeAchFloor(req, ev.request);
    const minAch = Math.min(...ev.request.operation.achSchedule);
    const feasible = minAch >= achFloor - 1e-9;

    const variant: SweepVariant = {
      id: ev.id,
      overrides: ev.overrides,
      kpis: result.kpis,
      capitalCostINR: estimateCapitalCostINR(ev.request),
      embodiedCarbonKg: estimateEmbodiedCarbonKg(ev.request),
      feasible,
      paretoRank: 0, // T-56 owns Pareto ranking; not computed here.
      ...(feasible ? {} : { infeasibleReason: `ACH ${minAch.toFixed(3)} below safety floor ${achFloor.toFixed(3)}` }),
    };
    variants.push(variant);

    onProgress?.(variants.length, total);
  }

  // CONTRACTS.md §7.15: "variants: ordered by PRIMARY_METRIC, ties preserved."
  // A plain ascending sort -- NOT the tie-grouping / Pareto sort T-56 owns.
  const ordered = [...variants].sort((a, b) => a.kpis[PRIMARY_METRIC] - b.kpis[PRIMARY_METRIC]);
  const best = ordered.find((v) => v.feasible) ?? ordered[0];
  if (!best) {
    throw new Error('runSweep: expandVariants produced zero variants for this SweepRequest');
  }

  return {
    variants: ordered,
    ties: [],
    baselineId: expanded[0]?.id ?? '',
    best,
    meta: {
      evaluated: variants.length,
      wallClockMs: performance.now() - startedAt,
      workers: 1,
      spinUpShared,
    },
  };
}
