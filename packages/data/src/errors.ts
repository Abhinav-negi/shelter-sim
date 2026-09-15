/**
 * Local error type for @shelter/data.
 *
 * `packages/data` carries ZERO runtime dependencies (LOG.md 7.13) and, per this
 * task's own decision (see .work/T-24.md, Deviations), does not take a runtime
 * dependency on `@shelter/engine` either -- it stays decoupled from the physics
 * package, consistent with the "data layer does not import physics
 * correlations" boundary. `packages/engine/src/types.ts` defines an
 * `EngineError` with the exact same constructor shape (`code`, `message`,
 * optional `detail`) and the same error-code vocabulary; this class mirrors it
 * on purpose so call sites elsewhere in the app that already handle
 * `EngineError('UNKNOWN_MATERIAL', ...)` are not surprised by a differently
 * shaped error coming out of the data layer.
 */
export type DataErrorCode = 'UNKNOWN_MATERIAL' | 'UNKNOWN_GLAZING' | 'DATA_SCHEMA_MISMATCH';

export class EngineError extends Error {
  constructor(
    readonly code: DataErrorCode,
    message: string,
    readonly detail?: unknown,
  ) {
    super(message);
    this.name = 'EngineError';
  }
}
