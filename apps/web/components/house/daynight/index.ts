// apps/web/components/house/daynight/index.ts
export { DayNightAnimation } from './DayNightAnimation';
export { computeShadow, isSunUp, skyColor, skyGradientCss, starPositions, sunScreenPosition } from './sceneMath';
export type { ShadowResult, SunScreenPosition } from './sceneMath';
export { attachDayNightLoop, prefersReducedMotion, startAnimationLoop } from './loop';
export type { AnimationLoopHandle, CafFn, RafFn } from './loop';
export { getProgress, setProgress, subscribeProgress, __resetProgressForTest } from './progress';
export type { Progress } from './progress';
