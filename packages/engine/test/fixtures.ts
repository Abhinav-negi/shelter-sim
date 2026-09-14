/**
 * Test materials. Deliberately NOT imported from the production catalogue: a
 * validation test whose expected values move when someone edits a catalogue
 * entry is not a validation test. Values are from BLUEPRINT.md Appendix B.
 */

import type { Glazing, Material } from '../src/types.js';

const base = { category: 'structural', alphaSolar: 0.7, emissivity: 0.9, locallyAvailableLadakh: true, source: 'BLUEPRINT.md Appendix B (test fixture)' } as const;

export const M: Record<string, Material> = {
  denseConcrete: { ...base, id: 'denseConcrete', name: 'Dense concrete', k: 1.75, rho: 2400, c: 880 },
  rammedEarth: { ...base, id: 'rammedEarth', name: 'Rammed earth', k: 1.0, rho: 1900, c: 880 },
  firedBrick: { ...base, id: 'firedBrick', name: 'Fired clay brick', k: 0.72, rho: 1920, c: 835 },
  mudBrick: { ...base, id: 'mudBrick', name: 'Mud brick', k: 0.75, rho: 1700, c: 880 },
  granite: { ...base, id: 'granite', name: 'Stone masonry', k: 2.8, rho: 2600, c: 820 },
  eps: { ...base, id: 'eps', category: 'insulation', name: 'EPS', k: 0.036, rho: 20, c: 1400 },
  cementPlaster: { ...base, id: 'cementPlaster', category: 'finish', name: 'Cement plaster', k: 0.72, rho: 1860, c: 840 },
  steelSheet: { ...base, id: 'steelSheet', name: 'CGI steel sheet', k: 50, rho: 7800, c: 480, alphaSolar: 0.6, emissivity: 0.28 },
};

export const G: Record<string, Glazing> = {
  single: { id: 'single', name: 'Single glazing', U: 5.8, SHGC: 0.86, tauVis: 0.9, b0: 0.04, source: 'BLUEPRINT.md Appendix B (test fixture)' },
  double: { id: 'double', name: 'Double glazing', U: 2.8, SHGC: 0.76, tauVis: 0.78, b0: 0.05, source: 'BLUEPRINT.md Appendix B (test fixture)' },
};
