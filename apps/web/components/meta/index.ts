// apps/web/components/meta/index.ts
//
// Public barrel for T-52's four features, matching the convention other
// component directories with a barrel already use (components/inputs,
// components/house, components/charts/heatflow). Whoever wires
// `slot-assumptions` in app/app-shell.tsx (off this task's allow-list) can
// import everything from here.

export { AssumptionsPanel } from './assumptions/AssumptionsPanel';
export { LimitationsList } from './assumptions/LimitationsList';
export { ExportPanel } from './export/ExportPanel';
export { OfflineBanner } from './locale/OfflineBanner';
export { LocaleSwitch } from './locale/LocaleSwitch';
