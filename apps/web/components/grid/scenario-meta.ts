// apps/web/components/grid/scenario-meta.ts
//
// T-50, the survival grid (log/AREA-F-frontend.md).
//
// GOTCHA / documented contract gap: `store.ts`'s local `ScenarioResult` type
// (CONTRACTS.md §7 -- "a task that needs a type not here defines it locally")
// carries only `{ scenarioId, kpis, meta }`. It has no `name`, `description`
// or `startDayOfYear` -- those live on `packages/data/src/scenarios.ts`'s
// real `Scenario` type, which this directory may NOT import: `Scenario` is
// declared in the same file that imports `./tmy.js`, and `tmy.ts` reads
// bundled JSON via `node:fs` + `new URL(literal, import.meta.url)` at module
// top level (see its own header). `lib/store.ts`'s header comment documents
// that importing ANYTHING from `@shelter/data` breaks the Next.js client
// bundle the moment the import is reachable from the browser boundary --
// the import alone is enough, whether or not the function is ever called.
// This grid is a client component (T-50's own click handler needs it), so
// it cannot import `@shelter/data` at runtime, full stop.
//
// The fix that stays inside this task's own allow-list
// (`apps/web/components/grid/**`, `log/AREA-F-frontend.md`'s T-50 entry):
// a small STATIC display-metadata table, keyed by the eighteen scenario ids
// `packages/data/src/scenarios.ts` (T-59, DONE, `log/AREA-H-scenarios.md`)
// is documented to produce verbatim (its Evidence block lists them:
// month-01..month-12, coldest-day, hottest-day, design-winter-day,
// sunless-streak, clear-cold-night, annual-mean-day). This is presentation
// text, not physics, and not a shared contract -- CONTRACTS.md §7's own
// rule for exactly this situation.
//
// What this table CANNOT honestly provide: the real per-run date
// (`startDayOfYear`), because that value is computed from the real weather
// record at scenario-build time and `ScenarioResult` does not carry it.
// `date` below is therefore either derived from the id itself (the twelve
// monthly ids literally name their month) or left as an explicit "not
// available" string -- never a fabricated day-of-year. This is the same
// class of gap as this task's condition 4 (chart integration): the real fix
// is T-60, which owns shaping the real `ScenarioResult` contract (see this
// task's Evidence block).

export const SCENARIO_COUNT = 18; // T-59: the matrix is always exactly 18 scenarios.

const DATE_UNAVAILABLE = 'not available in current data (pending T-60)';

export interface ScenarioDisplayMeta {
  name: string;
  description: string;
  /** Best-effort, honest: derived from the id where possible, never invented. */
  date: string;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;

function monthlyMeta(monthIndex0: number): ScenarioDisplayMeta {
  const month = MONTH_NAMES[monthIndex0]!;
  return {
    name: month,
    description: `Representative day for ${month}: the day in the record closest to that month's mean temperature and mean solar input.`,
    date: `Representative day, ${month}`,
  };
}

const SCENARIO_META: Record<string, ScenarioDisplayMeta> = {
  'month-01': monthlyMeta(0),
  'month-02': monthlyMeta(1),
  'month-03': monthlyMeta(2),
  'month-04': monthlyMeta(3),
  'month-05': monthlyMeta(4),
  'month-06': monthlyMeta(5),
  'month-07': monthlyMeta(6),
  'month-08': monthlyMeta(7),
  'month-09': monthlyMeta(8),
  'month-10': monthlyMeta(9),
  'month-11': monthlyMeta(10),
  'month-12': monthlyMeta(11),
  'coldest-day': {
    name: 'Coldest day on record',
    description: 'The 24 h window with the lowest mean temperature anywhere in the record.',
    date: DATE_UNAVAILABLE,
  },
  'hottest-day': {
    name: 'Hottest day on record',
    description: 'The 24 h window with the highest mean temperature anywhere in the record -- a shelter optimised only for winter can bake in summer.',
    date: DATE_UNAVAILABLE,
  },
  'design-winter-day': {
    name: '1-in-100 design winter day',
    description: 'The cold-but-not-freak day engineers conventionally design to (1st percentile of daily mean temperature).',
    date: DATE_UNAVAILABLE,
  },
  'sunless-streak': {
    name: 'Longest sunless streak',
    description: 'The longest run of consecutive overcast days, run end to end -- the real test of thermal storage.',
    date: DATE_UNAVAILABLE,
  },
  'clear-cold-night': {
    name: 'Clear cold night',
    description: 'The coldest night that was also cloudless -- clear skies radiate more heat away than clouds trap, Ladakh’s true worst case.',
    date: DATE_UNAVAILABLE,
  },
  'annual-mean-day': {
    name: 'Annual-mean day',
    description: 'The reference day the other seventeen scenarios are read against.',
    date: DATE_UNAVAILABLE,
  },
};

/** Never throws: an id outside the known eighteen still renders, honestly
 * labelled, rather than crashing the grid (acceptance test 9's spirit
 * applied to metadata lookup, not just KPI validity). */
export function scenarioMetaFor(scenarioId: string): ScenarioDisplayMeta {
  return (
    SCENARIO_META[scenarioId] ?? {
      name: scenarioId,
      description: 'Not one of the known eighteen scenario ids (T-59) -- shown as-is.',
      date: DATE_UNAVAILABLE,
    }
  );
}
