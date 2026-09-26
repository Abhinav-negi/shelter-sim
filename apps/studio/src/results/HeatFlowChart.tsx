// Heat-flow pathway breakdown, daily kWh (F3.md condition 4). Gain/loss is
// shown by bar direction against a zero reference line, not by colour — the
// thermal scale is reserved for temperature data only (PLAN.md §Design
// system), and this chart is energy, not temperature, so a second diverging
// pair would break that rule. One hue (accent), direct value labels, no
// legend needed (dataviz skill: position already encodes the two states).
//
// Plain flexbox rows, not recharts: a first version used recharts'
// `BarChart`/`LabelList` with the category label on the left (its Y axis)
// and the kWh value floated next to the bar's own tip. Both label-placement
// strategies tried there (recharts' built-in `position="right"`, then a
// custom renderer anchored at the bar rect's screen-right edge) still left
// the category text and the value text competing for the same horizontal
// space at narrow widths — overlapping for a long category name or a large
// negative value, and the longest value ("+225.5 kWh") clipping against the
// container's right edge at 390 px (F3.md condition 6 visual QA, orchestrator
// review of F3 e9e0211). Root cause: cramming category label + bar + value
// into one 32 px-tall row leaves no width that's *guaranteed* free for the
// value text regardless of the category name's length or the bar's sign.
// Fixing that structurally (not just re-tuning offsets) means the value
// never shares a line with the category label at all: each row is now two
// lines -- the category label alone on its own full-width line, then the
// bar and its value below it, the value in its own fixed-width column
// (`w-24`, comfortably fits the longest string) that the bar's track never
// reaches into. No SVG label-collision math left to get wrong.
import { HEAT_FLOW_KEYS, HEAT_FLOW_LABELS } from './labels';
import type { ResultJson } from './types';

export function HeatFlowChart({ result }: { result: ResultJson }) {
  const totals = result.heatFlows.dailyTotalsKWh;
  const data = HEAT_FLOW_KEYS.map((key) => ({
    key,
    label: HEAT_FLOW_LABELS[key],
    value: Number((totals[key] ?? 0).toFixed(2)),
  }))
    .filter((d) => d.value !== 0)
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value));

  if (data.length === 0) {
    return <p className="text-xs text-ink-muted">No heat-flow data in this preview.</p>;
  }

  // A shared scale across all rows (domain always includes 0, like the old
  // chart's implicit zero reference) so bar lengths are comparable row to
  // row, same as a real bar chart's shared axis would give.
  const values = data.map((d) => d.value);
  const domainMin = Math.min(0, ...values);
  const domainMax = Math.max(0, ...values);
  const span = domainMax - domainMin || 1;
  const zeroPct = ((0 - domainMin) / span) * 100;

  return (
    <div className="flex flex-col gap-3">
      {data.map((d) => {
        const valuePct = ((d.value - domainMin) / span) * 100;
        const barLeft = Math.min(zeroPct, valuePct);
        const barWidth = Math.max(Math.abs(valuePct - zeroPct), 0.5);
        return (
          <div key={d.key} className="flex flex-col gap-1">
            <span className="text-xs text-ink-muted">{d.label}</span>
            <div className="flex items-center gap-2">
              <div className="relative h-2 flex-1">
                <div
                  aria-hidden
                  className="absolute inset-y-0 w-px bg-hairline"
                  style={{ left: `${zeroPct}%` }}
                />
                <div
                  className="absolute inset-y-0 rounded-[1px] bg-accent"
                  style={{ left: `${barLeft}%`, width: `${barWidth}%`, opacity: d.value >= 0 ? 1 : 0.55 }}
                />
              </div>
              <span className="w-24 shrink-0 text-right font-mono text-xs text-ink-muted">
                {`${d.value >= 0 ? '+' : ''}${d.value.toFixed(1)} kWh`}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
