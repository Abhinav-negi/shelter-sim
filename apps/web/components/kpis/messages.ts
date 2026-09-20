// apps/web/components/kpis/messages.ts
//
// T-74: this component's own strings, registered into lib/i18n.ts's registry
// (T-36), the same pattern `apps/web/components/meta/messages.ts` (T-52)
// established. KpiColumn.tsx imports this module for its side effect
// (`registerMessages` runs at load time) exactly like
// `components/meta/locale/LocaleSwitch.tsx` imports `./aggregator`.
//
// Unit ABBREVIATIONS (°C, K, kWh, L/yr, kg/yr, ₹, "h" for hours) are produced
// by `lib/units.ts` (off this task's allow-list) or are internationally-
// recognised scientific/currency notation left as-is by design -- Hindi
// engineering text commonly keeps these verbatim rather than transliterating
// them. Only the natural-language card labels, the empty state, the
// integrity-badge text/tooltip and the descriptive suffixes ("vs outside
// air", "(dimensionless)") are translated.

import { registerMessages } from '../../lib/i18n';

registerMessages('en', {
  'kpis.column.empty': 'No result yet.',
  'kpis.column.integrityBadge.title':
    'Energy balance residual: |net energy in − stored energy| ÷ gross energy throughput, over the reported run (CONTRACTS.md §7.4). Below 0.1% is a converged, trustworthy result.',
  'kpis.column.integrityBadge.label': 'Energy balance: ',
  'kpis.column.vsOutsideAir': 'vs outside air',
  'kpis.column.dimensionlessSuffix': '(dimensionless)',
  'kpis.column.card.temp0600': '06:00 temperature',
  'kpis.column.card.hoursComfort': 'Hours in comfort',
  'kpis.column.card.auxHeating': 'Auxiliary heating',
  'kpis.column.card.fuel': 'Fuel (kerosene-equivalent)',
  'kpis.column.card.cost': 'Running cost',
  'kpis.column.card.co2': 'CO2 emitted',
  'kpis.column.card.minTemp': 'Min indoor temperature',
  'kpis.column.card.maxTemp': 'Max indoor temperature',
  'kpis.column.card.meanTemp': 'Mean indoor temperature',
  'kpis.column.card.swing': 'Daily swing (peak to peak)',
  'kpis.column.card.decrement': 'Decrement factor',
  'kpis.column.card.timeLag': 'Time lag',
  'kpis.column.card.below5': 'Hours below 5 °C',
  'kpis.column.card.belowFreezing': 'Hours below freezing',
  'kpis.column.card.condensation': 'Condensation risk',
});

registerMessages('hi', {
  'kpis.column.empty': 'अभी कोई परिणाम नहीं।',
  'kpis.column.integrityBadge.title':
    'ऊर्जा संतुलन अवशेष: |निवल ऊर्जा प्रवेश − संचित ऊर्जा| ÷ सकल ऊर्जा प्रवाह, पूरे रिपोर्ट किए गए रन पर (CONTRACTS.md §7.4)। 0.1% से नीचे एक अभिसरित, विश्वसनीय परिणाम है।',
  'kpis.column.integrityBadge.label': 'ऊर्जा संतुलन: ',
  'kpis.column.vsOutsideAir': 'बाहरी हवा की तुलना में',
  'kpis.column.dimensionlessSuffix': '(विमाहीन)',
  'kpis.column.card.temp0600': '06:00 तापमान',
  'kpis.column.card.hoursComfort': 'आरामदायक घंटे',
  'kpis.column.card.auxHeating': 'सहायक ऊष्मन',
  'kpis.column.card.fuel': 'ईंधन (केरोसिन-समतुल्य)',
  'kpis.column.card.cost': 'परिचालन लागत',
  'kpis.column.card.co2': 'उत्सर्जित CO2',
  'kpis.column.card.minTemp': 'न्यूनतम आंतरिक तापमान',
  'kpis.column.card.maxTemp': 'अधिकतम आंतरिक तापमान',
  'kpis.column.card.meanTemp': 'औसत आंतरिक तापमान',
  'kpis.column.card.swing': 'दैनिक उतार-चढ़ाव (शिखर से शिखर)',
  'kpis.column.card.decrement': 'ह्रास कारक',
  'kpis.column.card.timeLag': 'समय विलंब',
  'kpis.column.card.below5': '5 °C से नीचे के घंटे',
  'kpis.column.card.belowFreezing': 'हिमांक से नीचे के घंटे',
  'kpis.column.card.condensation': 'संघनन जोखिम',
});
