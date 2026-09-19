// apps/web/components/charts/temp/colors.ts
//
// T-47. Categorical colours for up to 4 overlaid variants' indoor-temperature
// lines -- the dataviz skill's validated default categorical palette, fixed
// hue order, never cycled or reassigned by rank (skill: color-formula.md).
// This app has no dark-mode theming anywhere yet (no `prefers-color-scheme`/
// `data-theme` in the codebase), so light-mode hex only; add a dark set if
// the app grows one (LOG.md rule 13 -- ceiling noted, not hidden).

/** Slots 1-4 of the reference categorical palette: blue, orange, aqua,
 * yellow. Worst adjacent CVD Delta E 9.1, worst adjacent normal-vision Delta
 * E 19.6 (both light mode) -- clears the skill's hard gates. */
export const VARIANT_COLORS: readonly string[] = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100'];

export const MAX_VARIANTS = 4;

/** Ambient is shared weather context, not a compared design -- ONE neutral
 * dashed line regardless of variant count, so it never competes with the
 * categorical hues above for identity. */
export const AMBIENT_COLOR = '#6b6a64';
export const AMBIENT_DASH = '5,4';
export const MEAN_RADIANT_DASH = '2,3';

export const COMFORT_BAND_FILL = 'rgba(27,175,122,0.15)';
export const COMFORT_BAND_STROKE = '#1baf7a';

export const MIN_MARKER_COLOR = '#2a78d6';
export const MAX_MARKER_COLOR = '#e34948';
export const REF_0600_COLOR = '#4a3aa7';
