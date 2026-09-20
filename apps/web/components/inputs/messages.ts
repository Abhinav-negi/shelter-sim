// apps/web/components/inputs/messages.ts
//
// T-74: this component's own strings, registered into lib/i18n.ts's registry
// (T-36), the same pattern `apps/web/components/meta/messages.ts` (T-52)
// established. SimpleForm.tsx imports this module for its side effect
// (`registerMessages` runs at load time) exactly like
// `components/meta/locale/LocaleSwitch.tsx` imports `./aggregator`.
//
// Two keys (`inputs.simpleForm.error` and `inputs.simpleForm.location.notice`)
// carry a `{placeholder}` token instead of using string interpolation here,
// because the interpolated value (the engine's own error message, a place
// name) is only known at render time in SimpleForm.tsx -- the component does
// `t(key, locale).replace('{token}', value)` itself.
//
// A handful of unit ABBREVIATIONS used verbatim in en (kWh, L/yr, kg/yr, h,
// °C, K, ₹ -- all produced by `lib/units.ts`, off this task's allow-list) are
// left untranslated by design: they are internationally-recognised scientific
// notation, not natural-language text, and Hindi-language engineering
// material commonly leaves them as-is.

import { registerMessages } from '../../lib/i18n';

registerMessages('en', {
  'inputs.simpleForm.error':
    'That combination could not be simulated ({message}). Try a different value for whatever you just changed.',
  'inputs.simpleForm.location.label': 'Location',
  'inputs.simpleForm.location.title': "Which town's weather this design is tested against.",
  'inputs.simpleForm.location.notice':
    "Full weather for {location} is not bundled into this build's browser client yet (a known gap, see log/AREA-F-frontend.md T-44) -- still showing {site}'s weather.",
  'inputs.simpleForm.date.label': 'Design day',
  'inputs.simpleForm.date.title':
    "Which day of the year to test. Ladakh's coldest nights are in mid-January.",
  'inputs.simpleForm.size.legend': 'Size',
  'inputs.simpleForm.size.title': "The shelter's floor size and wall height.",
  'inputs.simpleForm.size.length': 'Length (m)',
  'inputs.simpleForm.size.width': 'Width (m)',
  'inputs.simpleForm.size.height': 'Height (m)',
  'inputs.simpleForm.shelterType.label': 'Shelter type',
  'inputs.simpleForm.shelterType.title':
    'A ready-made starting point. Loading one sets every material and window below.',
  'inputs.simpleForm.wallMaterial.label': 'Wall material',
  'inputs.simpleForm.wallMaterial.title': 'What the outer walls are built from.',
  'inputs.simpleForm.roofMaterial.label': 'Roof material',
  'inputs.simpleForm.roofMaterial.title': 'What the roof is built from.',
  'inputs.simpleForm.floorMaterial.label': 'Floor material',
  'inputs.simpleForm.floorMaterial.title': 'What the floor is built from.',
  'inputs.simpleForm.materialSelect.loading': 'Loading materials...',
  'inputs.simpleForm.materialSelect.sourceSummary': 'Where this number comes from',
  'inputs.simpleForm.windows.legend': 'Window size, by direction',
  'inputs.simpleForm.windows.title': 'How much of each wall is glass.',
  'inputs.simpleForm.windows.orientation.S': 'South-facing',
  'inputs.simpleForm.windows.orientation.E': 'East-facing',
  'inputs.simpleForm.windows.orientation.W': 'West-facing',
  'inputs.simpleForm.windows.orientation.N': 'North-facing',
  'inputs.simpleForm.windows.percentSuffix': 'windows: {pct}% of that wall',
  'inputs.simpleForm.glazing.label': 'Window glazing type',
  'inputs.simpleForm.glazing.title':
    'How many panes of glass, and how well they hold heat in.',
  'inputs.simpleForm.glazing.nightShutter':
    'Close an insulating shutter over the windows at night',
  'inputs.simpleForm.occupancy.label': "Who's staying here",
  'inputs.simpleForm.occupancy.title':
    'Who lives here and whether there is a heater running.',
});

registerMessages('hi', {
  'inputs.simpleForm.error':
    'यह संयोजन सिम्युलेट नहीं किया जा सका ({message})। आपने अभी जो मान बदला है, उसके लिए कोई और मान आज़माएँ।',
  'inputs.simpleForm.location.label': 'स्थान',
  'inputs.simpleForm.location.title': 'किस शहर के मौसम के विरुद्ध यह डिज़ाइन परखा जा रहा है।',
  'inputs.simpleForm.location.notice':
    '{location} का पूरा मौसम डेटा अभी इस बिल्ड के ब्राउज़र क्लाइंट में शामिल नहीं है (एक ज्ञात सीमा, देखें log/AREA-F-frontend.md T-44) — अभी भी {site} का मौसम दिखाया जा रहा है।',
  'inputs.simpleForm.date.label': 'डिज़ाइन दिवस',
  'inputs.simpleForm.date.title':
    'वर्ष का कौन-सा दिन परखना है। लद्दाख की सबसे ठंडी रातें जनवरी के मध्य में होती हैं।',
  'inputs.simpleForm.size.legend': 'आकार',
  'inputs.simpleForm.size.title': 'आश्रय का फ़र्श क्षेत्रफल और दीवार की ऊँचाई।',
  'inputs.simpleForm.size.length': 'लंबाई (मी)',
  'inputs.simpleForm.size.width': 'चौड़ाई (मी)',
  'inputs.simpleForm.size.height': 'ऊँचाई (मी)',
  'inputs.simpleForm.shelterType.label': 'आश्रय का प्रकार',
  'inputs.simpleForm.shelterType.title':
    'एक तैयार आरंभिक बिंदु। इसे चुनने से नीचे की हर सामग्री और खिड़की सेट हो जाती है।',
  'inputs.simpleForm.wallMaterial.label': 'दीवार की सामग्री',
  'inputs.simpleForm.wallMaterial.title': 'बाहरी दीवारें किस सामग्री से बनी हैं।',
  'inputs.simpleForm.roofMaterial.label': 'छत की सामग्री',
  'inputs.simpleForm.roofMaterial.title': 'छत किस सामग्री से बनी है।',
  'inputs.simpleForm.floorMaterial.label': 'फ़र्श की सामग्री',
  'inputs.simpleForm.floorMaterial.title': 'फ़र्श किस सामग्री से बना है।',
  'inputs.simpleForm.materialSelect.loading': 'सामग्री लोड हो रही है...',
  'inputs.simpleForm.materialSelect.sourceSummary': 'यह आँकड़ा कहाँ से आया',
  'inputs.simpleForm.windows.legend': 'दिशा अनुसार खिड़की का आकार',
  'inputs.simpleForm.windows.title': 'प्रत्येक दीवार का कितना हिस्सा शीशे का है।',
  'inputs.simpleForm.windows.orientation.S': 'दक्षिण-मुखी',
  'inputs.simpleForm.windows.orientation.E': 'पूर्व-मुखी',
  'inputs.simpleForm.windows.orientation.W': 'पश्चिम-मुखी',
  'inputs.simpleForm.windows.orientation.N': 'उत्तर-मुखी',
  'inputs.simpleForm.windows.percentSuffix': 'खिड़कियाँ: उस दीवार का {pct}%',
  'inputs.simpleForm.glazing.label': 'खिड़की के शीशे का प्रकार',
  'inputs.simpleForm.glazing.title':
    'शीशे की कितनी परतें हैं, और वे गर्मी को कितनी अच्छी तरह रोकती हैं।',
  'inputs.simpleForm.glazing.nightShutter':
    'रात में खिड़कियों पर इन्सुलेटिंग शटर बंद करें',
  'inputs.simpleForm.occupancy.label': 'यहाँ कौन रह रहा है',
  'inputs.simpleForm.occupancy.title': 'यहाँ कौन रहता है और क्या हीटर चल रहा है।',
});
