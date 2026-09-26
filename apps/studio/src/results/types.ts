// PreviewResponse.result is typed `unknown` on the wire (studio-server's
// design/types.ts: the engine's Float64Array-bearing SimulationResult has no
// JSON-safe type export; the shape is documented, not typed — API.md §4 /
// apps/server/API.md §4's ResultJson table). This is the client's own
// hand-typed view of that documented shape, trimmed to the fields the
// results panel actually reads (F3.md condition 4: temperature chart +
// heat-flow breakdown). Not a hand-copy of a server-typed shape — there is
// no server type to copy from for this one.
export interface ResultJson {
  time: number[]; // seconds from period start, one per timestep
  temperatures: {
    indoorAir: number[]; // Kelvin
    ambient: number[]; // Kelvin
  };
  heatFlows: {
    /** Period totals, kWh. Positive = heat entering the indoor air node (gain). */
    dailyTotalsKWh: Record<string, number>;
  };
}
