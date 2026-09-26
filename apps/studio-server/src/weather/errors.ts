// apps/studio-server/src/weather/errors.ts — shared upstream-failure error
// for both GET /api/locations/search (P3 condition 1) and custom-location
// weather resolution (P3 condition 2). Same shape/convention as
// design/assemble.ts's CustomLocationUnavailableError: a plain Error
// subclass with a literal `code`, mapped to an HTTP status in app.ts's
// error handler.

export class UpstreamUnavailableError extends Error {
  readonly code = 'UPSTREAM_UNAVAILABLE' as const;
  constructor(message: string) {
    super(message);
    this.name = 'UpstreamUnavailableError';
  }
}
