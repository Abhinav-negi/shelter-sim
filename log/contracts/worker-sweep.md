# log/contracts/worker-sweep.md — the worker message protocol and the sweep contract

> Extracted from `log/CONTRACTS.md` §7.14-7.15. Read this when your task's Area README names it (Area E, G).

---

### 7.14 The worker message protocol

Added by T-06. One protocol, used by the browser Web Worker (T-43) and the server worker-thread
pool (T-40), so the two cannot drift.

```ts
export type WorkerRequest =
  | { id: string; kind: 'simulate'; payload: SimulationRequest }
  | { id: string; kind: 'sweep'; payload: SweepRequest }
  | { id: string; kind: 'cancel'; targetId: string };

export type WorkerResponse =
  | { id: string; kind: 'result'; payload: SimulationResult }
  | { id: string; kind: 'sweepResult'; payload: SweepResult }
  | { id: string; kind: 'progress'; done: number; total: number }
  | { id: string; kind: 'error'; code: EngineErrorCode; message: string };
```

Every request carries a caller-generated `id`; every response echoes it. A superseded request (the
user moved the slider again) is cancelled **by id**, never left to race. No stale result may ever
reach the store.

### 7.15 The sweep contract

Added by T-06. Does not exist in any source document — `AUDIT.md` F-3 records that Compare and
Optimise existed only as two words in an ASCII mockup, with no contract, no target and no owner.

```ts
export type VariableSpec =
  | { kind: 'wallConstruction'; values: string[] }
  | { kind: 'insulationThickness'; values: number[] } // metres
  | { kind: 'insulationPosition'; values: ('inside' | 'outside' | 'cavity')[] }
  | { kind: 'roofConstruction'; values: string[] }
  | { kind: 'glazing'; values: string[] }
  | { kind: 'wwr'; orientation: 'S' | 'E' | 'W' | 'N'; values: number[] } // 0-1
  | { kind: 'buildingAzimuth'; values: number[] } // degrees
  | { kind: 'aspectRatio'; values: number[] }
  | { kind: 'nightShutters'; values: boolean[] }
  | { kind: 'massStrategy'; values: ('none' | 'floor' | 'trombe' | 'water' | 'pcm')[] }
  | { kind: 'ach'; values: number[] };

export interface SweepRequest {
  base: SimulationRequest;
  variables: VariableSpec[];
  mode: 'grid' | 'random' | 'nsga2';
  maxVariants: number; // hard cap, default 200
  constraints: {
    achMin: number; // NEVER below ACH_MIN
    localMaterialsOnly?: boolean;
    budgetCeilingINR?: number;
    fixedFloorArea?: boolean;
  };
  objectives: { metric: keyof SimulationKpis; direction: 'min' | 'max' }[];
}

export interface SweepVariant {
  id: string;
  overrides: Record<string, string | number | boolean>; // human-readable, for the UI
  kpis: SimulationKpis;
  capitalCostINR: number;
  embodiedCarbonKg: number;
  feasible: boolean;
  infeasibleReason?: string; // e.g. "ACH below safety floor"
  paretoRank: number; // 1 = on the front
}

export interface SweepResult {
  variants: SweepVariant[]; // ordered by PRIMARY_METRIC, ties preserved
  ties: string[][]; // ids grouped where |delta| < RANK_NOISE_FLOOR
  baselineId: string;
  best: SweepVariant;
  meta: { evaluated: number; wallClockMs: number; workers: number; spinUpShared: boolean };
}
```

**Performance budget — a requirement, not an aspiration:** 100 variants over a 72 h simulation
complete in **under 10 s**. The engine's current measured sweep speed (§10) already clears this by
a wide margin, so any sweep that misses it has an orchestration bug, not a physics one.
