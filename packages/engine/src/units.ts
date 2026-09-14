/**
 * Unit discipline. ENGINE_BLUEPRINT.md §5.1.
 *
 * Everything inside the engine is Kelvin, metres, seconds, watts, joules.
 * Radiation goes as T^4: feeding it 0 (meaning 0 degC) instead of 273.15 K yields
 * 0 instead of 5.6e9, the heat loss silently vanishes, and the plot still looks
 * plausible. The brands make that a compile error instead of a lost day.
 *
 * The rule bends in exactly two places -- toK and toC -- which are the JSON/UI
 * seam. Nothing else in the codebase may convert.
 */

export type Kelvin = number & { readonly __unit: 'K' };
export type Celsius = number & { readonly __unit: 'degC' };

export const T0 = 273.15;

export const toK = (c: Celsius | number): Kelvin => ((c as number) + T0) as Kelvin;
export const toC = (k: Kelvin | number): Celsius => ((k as number) - T0) as Celsius;

/** Assert a number is already Kelvin. Use only when reading trusted internal state. */
export const asK = (n: number): Kelvin => n as Kelvin;
export const asC = (n: number): Celsius => n as Celsius;

export const DEG = Math.PI / 180;
export const rad = (deg: number): number => deg * DEG;
export const deg = (r: number): number => r / DEG;
