// apps/web/components/meta/messages.ts
//
// This component's own strings, registered into lib/i18n.ts's registry
// (T-36) the same way every Area F component is expected to. T-52 owns only
// the strings for what it renders -- the assumptions panel, the limitations
// list, the exporters and the offline banner/locale switch -- never another
// component's messages.ts (there are none yet; see locale/aggregator.ts).
//
// `registerMessages` merges, so importing this module (directly, or via
// locale/aggregator.ts) is what makes these keys resolve; until it is
// imported, `t()` falls back to the key itself (lib/i18n.ts's own documented
// behaviour), never `undefined` and never a throw.

import { registerMessages } from '../../lib/i18n';

registerMessages('en', {
  'meta.assumptions.title': 'Assumptions',
  'meta.assumptions.subtitle':
    'Every constant, correlation and conversion factor this simulation used.',
  'meta.assumptions.engineConstants': 'Physical & engine constants',
  'meta.assumptions.calibrationKnobs': 'Calibration knobs',
  'meta.assumptions.solarDistribution': 'Interior solar distribution',
  'meta.assumptions.correlations': 'Correlations & methods',
  'meta.assumptions.annualisation': 'Annualisation method',
  'meta.assumptions.fuelCost': 'Fuel & cost (editable — try it)',
  'meta.assumptions.fuelCostHint':
    'Edit any value below; the recomputed yearly figures update immediately.',
  'meta.assumptions.col.name': 'Constant',
  'meta.assumptions.col.value': 'Value',
  'meta.assumptions.col.unit': 'Unit',
  'meta.assumptions.col.source': 'Source',
  'meta.assumptions.calibrationNote': 'Calibration note',
  'meta.assumptions.litresPerYear': 'Kerosene equivalent',
  'meta.assumptions.costPerYear': 'Cost per year',
  'meta.assumptions.co2PerYear': 'CO2 per year',
  'meta.assumptions.noResult': 'Run a simulation to see live fuel/cost figures here.',
  'meta.limitations.title': 'Limitations',
  'meta.limitations.subtitle': 'Deliberate choices this model makes, and what each one costs.',
  'meta.export.title': 'Export',
  'meta.export.csv': 'Download CSV (every timestep)',
  'meta.export.json': 'Download design (JSON)',
  'meta.export.share': 'Get share link',
  'meta.export.shareUnavailable':
    'Sharing needs the server — download the design as a file instead.',
  'meta.export.print': 'Print / Save as PDF',
  'meta.export.noResult': 'Run a simulation first to export it.',
  'meta.offline.banner': 'Offline — showing 1 scenario, AI advice unavailable.',
  'meta.locale.label': 'Language',
  'meta.locale.en': 'English',
  'meta.locale.hi': 'हिन्दी',
});

registerMessages('hi', {
  'meta.assumptions.title': 'मान्यताएँ',
  'meta.assumptions.subtitle':
    'इस सिमुलेशन में उपयोग किया गया हर स्थिरांक, सहसंबंध और रूपांतरण कारक।',
  'meta.assumptions.engineConstants': 'भौतिक एवं इंजन स्थिरांक',
  'meta.assumptions.calibrationKnobs': 'कैलिब्रेशन नॉब',
  'meta.assumptions.solarDistribution': 'आंतरिक सौर वितरण',
  'meta.assumptions.correlations': 'सहसंबंध और विधियाँ',
  'meta.assumptions.annualisation': 'वार्षिकीकरण विधि',
  'meta.assumptions.fuelCost': 'ईंधन और लागत (संपादन योग्य — आज़माएँ)',
  'meta.assumptions.fuelCostHint':
    'नीचे कोई भी मान बदलें; पुनर्गणित वार्षिक आँकड़े तुरंत अपडेट होंगे।',
  'meta.assumptions.col.name': 'स्थिरांक',
  'meta.assumptions.col.value': 'मान',
  'meta.assumptions.col.unit': 'इकाई',
  'meta.assumptions.col.source': 'स्रोत',
  'meta.assumptions.calibrationNote': 'कैलिब्रेशन नोट',
  'meta.assumptions.litresPerYear': 'केरोसिन समतुल्य',
  'meta.assumptions.costPerYear': 'वार्षिक लागत',
  'meta.assumptions.co2PerYear': 'वार्षिक CO2',
  'meta.assumptions.noResult': 'यहाँ लाइव ईंधन/लागत आँकड़े देखने के लिए सिमुलेशन चलाएँ।',
  'meta.limitations.title': 'सीमाएँ',
  'meta.limitations.subtitle': 'इस मॉडल के जानबूझकर लिए गए निर्णय, और हर एक की कीमत।',
  'meta.export.title': 'निर्यात',
  'meta.export.csv': 'CSV डाउनलोड करें (हर टाइमस्टेप)',
  'meta.export.json': 'डिज़ाइन डाउनलोड करें (JSON)',
  'meta.export.share': 'साझा लिंक प्राप्त करें',
  'meta.export.shareUnavailable':
    'साझा करने के लिए सर्वर चाहिए — इसके बजाय डिज़ाइन को फ़ाइल के रूप में डाउनलोड करें।',
  'meta.export.print': 'प्रिंट करें / PDF के रूप में सहेजें',
  'meta.export.noResult': 'निर्यात करने से पहले सिमुलेशन चलाएँ।',
  'meta.offline.banner': 'ऑफ़लाइन — 1 परिदृश्य दिखाया जा रहा है, AI सलाह अनुपलब्ध है।',
  'meta.locale.label': 'भाषा',
  'meta.locale.en': 'English',
  'meta.locale.hi': 'हिन्दी',
});
