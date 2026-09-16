/**
 * @shelter/data public surface: the material, glazing and construction
 * catalogues. LOG.md 7.11 / T-24.
 */
export { MATERIALS, materialById, SCHEMA_VERSION as MATERIALS_SCHEMA_VERSION } from './materials.js';
export type { Material } from './materials.js';

export { GLAZING, glazingById, SCHEMA_VERSION as GLAZING_SCHEMA_VERSION } from './glazing.js';
export type { Glazing } from './glazing.js';

export { CONSTRUCTIONS, SCHEMA_VERSION as CONSTRUCTIONS_SCHEMA_VERSION } from './constructions.js';
export type { Layer, NamedConstruction } from './constructions.js';

export { EngineError } from './errors.js';
export type { DataErrorCode } from './errors.js';

export { TMY_LOCATIONS, tmyById, groundAlbedoById } from './tmy.js';
export type { TmyLocation } from './tmy.js';

export { PRESETS, presetById, SCHEMA_VERSION as PRESETS_SCHEMA_VERSION } from './presets.js';

export { buildScenarios, scenarioWeather } from './scenarios.js';
export type { Scenario } from './scenarios.js';

import { EngineError } from './errors.js';
import { SCHEMA_VERSION } from './materials.js';

/**
 * There is no runtime migration -- the catalogue and the code ship together.
 * A caller that persisted `SCHEMA_VERSION` alongside a saved design (T-32)
 * calls this on load so a stale save fails loudly instead of silently reading
 * the wrong row shapes.
 */
export function assertSchemaVersion(v: number): void {
  if (v !== SCHEMA_VERSION) {
    throw new EngineError(
      'DATA_SCHEMA_MISMATCH',
      `Data catalogue schema version mismatch: expected ${SCHEMA_VERSION}, got ${v}.`,
      { expected: SCHEMA_VERSION, got: v },
    );
  }
}
