/**
 * Insurance Benefits & Coverage Data
 * ───────────────────────────────────
 * Static reference data for the Insurance Optimizer feature.
 * Covers policy types, add-on details, claim process, and NCB slabs.
 */

// ── Policy Type Coverage ────────────────────────────────────────────────────

export const POLICY_TYPES = {
  comprehensive: {
    label: 'Comprehensive',
    labelHi: 'कम्प्रीहेंसिव',
    description: 'Full coverage for your vehicle and third parties. Best protection for commercial fleets.',
    descriptionHi: 'आपकी गाड़ी और तीसरे पक्ष दोनों के लिए पूरी सुरक्षा। कमर्शियल फ्लीट के लिए सबसे अच्छा।',
    coveredRisks: [
      { key: 'accident', label: 'Accident Damage', labelHi: 'एक्सीडेंट', icon: '💥', covered: true },
      { key: 'theft', label: 'Vehicle Theft', labelHi: 'चोरी', icon: '🔒', covered: true },
      { key: 'fire', label: 'Fire Damage', labelHi: 'आग', icon: '🔥', covered: true },
      { key: 'flood', label: 'Flood / Natural Calamity', labelHi: 'बाढ़/प्राकृतिक आपदा', icon: '🌊', covered: true },
      { key: 'third_party', label: 'Third Party Liability', labelHi: 'थर्ड पार्टी', icon: '👥', covered: true },
      { key: 'personal_accident', label: 'Driver Personal Accident', labelHi: 'ड्राइवर दुर्घटना', icon: '🏥', covered: true },
      { key: 'riot', label: 'Riot / Strike Damage', labelHi: 'दंगा/हड़ताल', icon: '🛡️', covered: true },
      { key: 'transit', label: 'In-Transit Damage', labelHi: 'रास्ते में नुकसान', icon: '🚛', covered: true },
    ],
    bestFor: 'Fleet vehicles with high daily mileage and valuable cargo. Covers everything -- recommended for trucks over 3 years old.',
    bestForHi: 'ज़्यादा चलने वाली और कीमती माल ढोने वाली गाड़ियों के लिए। 3 साल से पुराने ट्रकों के लिए सबसे अच्छा।',
    estimatedAnnualRange: { min: 25000, max: 55000 },
  },
  third_party: {
    label: 'Third Party Only',
    labelHi: 'थर्ड पार्टी',
    description: 'Legally mandatory minimum coverage. Only covers damage to other people/property.',
    descriptionHi: 'कानूनी रूप से ज़रूरी न्यूनतम कवर। सिर्फ दूसरों को हुए नुकसान का कवर।',
    coveredRisks: [
      { key: 'accident', label: 'Accident Damage', icon: '💥', covered: false },
      { key: 'theft', label: 'Vehicle Theft', icon: '🔒', covered: false },
      { key: 'fire', label: 'Fire Damage', icon: '🔥', covered: false },
      { key: 'flood', label: 'Flood / Natural Calamity', icon: '🌊', covered: false },
      { key: 'third_party', label: 'Third Party Liability', icon: '👥', covered: true },
      { key: 'personal_accident', label: 'Driver Personal Accident', icon: '🏥', covered: true },
      { key: 'riot', label: 'Riot / Strike Damage', icon: '🛡️', covered: false },
      { key: 'transit', label: 'In-Transit Damage', icon: '🚛', covered: false },
    ],
    bestFor: 'Only if you must cut costs drastically. No own-damage protection -- one accident repair could cost more than the yearly comprehensive premium.',
    bestForHi: 'सिर्फ तभी जब खर्चा बहुत कम करना हो। खुद की गाड़ी की मरम्मत का कोई कवर नहीं।',
    estimatedAnnualRange: { min: 15000, max: 22000 },
  },
  own_damage: {
    label: 'Own Damage Only',
    labelHi: 'ओन डैमेज',
    description: 'Covers damage to your own vehicle only. No third-party liability.',
    descriptionHi: 'सिर्फ अपनी गाड़ी के नुकसान का कवर। थर्ड पार्टी कवर नहीं।',
    coveredRisks: [
      { key: 'accident', label: 'Accident Damage', icon: '💥', covered: true },
      { key: 'theft', label: 'Vehicle Theft', icon: '🔒', covered: true },
      { key: 'fire', label: 'Fire Damage', icon: '🔥', covered: true },
      { key: 'flood', label: 'Flood / Natural Calamity', icon: '🌊', covered: true },
      { key: 'third_party', label: 'Third Party Liability', icon: '👥', covered: false },
      { key: 'personal_accident', label: 'Driver Personal Accident', icon: '🏥', covered: false },
      { key: 'riot', label: 'Riot / Strike Damage', icon: '🛡️', covered: true },
      { key: 'transit', label: 'In-Transit Damage', icon: '🚛', covered: true },
    ],
    bestFor: 'Not recommended as standalone for commercial vehicles. Third-party is legally mandatory -- use Comprehensive instead.',
    bestForHi: 'कमर्शियल गाड़ियों के लिए अकेला सही नहीं। थर्ड पार्टी कानूनी तौर पर ज़रूरी है।',
    estimatedAnnualRange: { min: 10000, max: 35000 },
  },
}

// ── Add-On Details ──────────────────────────────────────────────────────────

export const ADD_ONS = [
  {
    key: 'zero_dep',
    label: 'Zero Depreciation',
    labelHi: 'ज़ीरो डेप्रिसिएशन',
    icon: '🛡️',
    description: 'Get full claim amount without depreciation deduction on parts. Normally insurance deducts 15-50% for wear and tear.',
    descriptionHi: 'पार्ट्स पर बिना घिसावट की कटौती के पूरा क्लेम मिलेगा। आम तौर पर 15-50% कट जाता है।',
    value: 'Saves Rs 8,000-25,000 per claim on a commercial vehicle.',
    valueHi: 'कमर्शियल गाड़ी पर हर क्लेम में Rs 8,000-25,000 की बचत।',
    recommendedFor: 'New trucks (< 5 years), vehicles in accident-prone routes',
    estimatedCost: { min: 3000, max: 8000 },
  },
  {
    key: 'rsa',
    label: 'Roadside Assistance (RSA)',
    labelHi: 'रोडसाइड असिस्टेंस',
    icon: '🚨',
    description: '24/7 breakdown help: towing, flat tyre, battery jump-start, fuel delivery, on-spot minor repairs.',
    descriptionHi: '24/7 ब्रेकडाउन मदद: टोइंग, पंक्चर, बैटरी, डीज़ल, छोटी मरम्मत।',
    value: 'One towing incident costs Rs 5,000-15,000. RSA pays for itself in one use.',
    valueHi: 'एक टोइंग में Rs 5,000-15,000 लगते हैं। एक बार इस्तेमाल में पैसे वसूल।',
    recommendedFor: 'Long-haul trucks, old vehicles (> 5 years)',
    estimatedCost: { min: 800, max: 2500 },
  },
  {
    key: 'engine_protect',
    label: 'Engine Protector',
    labelHi: 'इंजन प्रोटेक्टर',
    icon: '⚙️',
    description: 'Covers engine damage due to water ingression, oil leakage, and hydrostatic lock. Standard insurance excludes this.',
    descriptionHi: 'पानी भरने, ऑइल लीकेज और हाइड्रोस्टैटिक लॉक से इंजन खराब होने पर कवर। सामान्य बीमा में ये शामिल नहीं।',
    value: 'Engine repair costs Rs 50,000-2,00,000 for commercial vehicles.',
    valueHi: 'कमर्शियल गाड़ी का इंजन रिपेयर Rs 50,000-2,00,000 तक आता है।',
    recommendedFor: 'Vehicles driving through flood-prone or monsoon-heavy areas',
    estimatedCost: { min: 1500, max: 5000 },
  },
  {
    key: 'return_to_invoice',
    label: 'Return to Invoice',
    labelHi: 'रिटर्न टू इनवॉइस',
    icon: '📄',
    description: 'In case of total loss or theft, get the original purchase price (not depreciated IDV).',
    descriptionHi: 'टोटल लॉस या चोरी में असली खरीद कीमत मिलेगी (IDV नहीं)।',
    value: 'Can mean Rs 3-5 lakh extra payout on a 5-year-old truck.',
    valueHi: '5 साल पुराने ट्रक पर Rs 3-5 लाख ज़्यादा मिल सकता है।',
    recommendedFor: 'New vehicles (< 3 years), high-value trucks',
    estimatedCost: { min: 2000, max: 6000 },
  },
  {
    key: 'consumables',
    label: 'Consumable Cover',
    labelHi: 'कंज़्यूमेबल कवर',
    icon: '🔧',
    description: 'Covers items normally excluded from claims: engine oil, coolant, brake fluid, nuts/bolts, AC gas.',
    descriptionHi: 'क्लेम में आमतौर पर नहीं मिलने वाले सामान: इंजन ऑइल, कूलैंट, ब्रेक ऑइल, नट-बोल्ट, AC गैस।',
    value: 'Saves Rs 2,000-5,000 per claim.',
    valueHi: 'हर क्लेम में Rs 2,000-5,000 की बचत।',
    recommendedFor: 'All commercial vehicles',
    estimatedCost: { min: 500, max: 1500 },
  },
  {
    key: 'key_replacement',
    label: 'Key Replacement',
    labelHi: 'चाबी बदलना',
    icon: '🔑',
    description: 'Covers cost of replacing lost/damaged vehicle keys and reprogramming locks.',
    descriptionHi: 'चाबी खोने या खराब होने पर नई चाबी और लॉक रिप्रोग्रामिंग का खर्चा।',
    value: 'Commercial vehicle key replacement: Rs 3,000-8,000.',
    valueHi: 'कमर्शियल गाड़ी की चाबी: Rs 3,000-8,000।',
    recommendedFor: 'Fleets with multiple drivers sharing vehicles',
    estimatedCost: { min: 300, max: 800 },
  },
  {
    key: 'driver_pa',
    label: 'Driver Personal Accident',
    labelHi: 'ड्राइवर पर्सनल एक्सीडेंट',
    icon: '🏥',
    description: 'Rs 15 lakh cover for driver death/disability due to accident while driving. Mandatory for commercial vehicles since 2019.',
    descriptionHi: 'ड्राइविंग के दौरान एक्सीडेंट में मृत्यु/विकलांगता पर Rs 15 लाख तक। 2019 से कमर्शियल गाड़ियों के लिए ज़रूरी।',
    value: 'Mandatory add-on. Protects your drivers and avoids legal liability.',
    valueHi: 'ज़रूरी ऐड-ऑन। ड्राइवरों की सुरक्षा और कानूनी जिम्मेदारी से बचाव।',
    recommendedFor: 'All commercial vehicles (legally mandatory)',
    estimatedCost: { min: 750, max: 1200 },
  },
]

// ── NCB (No Claim Bonus) Slab Table ─────────────────────────────────────────

export const NCB_SLABS = [
  { year: 0, percentage: 0, label: 'Year 1 (New Policy)', savings: 0 },
  { year: 1, percentage: 20, label: 'After 1 claim-free year', savings: 20 },
  { year: 2, percentage: 25, label: 'After 2 claim-free years', savings: 25 },
  { year: 3, percentage: 35, label: 'After 3 claim-free years', savings: 35 },
  { year: 4, percentage: 45, label: 'After 4 claim-free years', savings: 45 },
  { year: 5, percentage: 50, label: 'After 5+ claim-free years (max)', savings: 50 },
]

/**
 * Get the next NCB slab from a given percentage.
 * @param {number} currentNcb - Current NCB percentage
 * @returns {{ current, next, savingsIncrease }}
 */
export function getNextNcbSlab(currentNcb) {
  const slabs = [0, 20, 25, 35, 45, 50]
  const currentIdx = slabs.indexOf(currentNcb)
  const nextIdx = currentIdx >= 0 ? Math.min(currentIdx + 1, slabs.length - 1) : 1
  return {
    current: currentNcb || 0,
    next: slabs[nextIdx],
    isMax: currentNcb >= 50,
    increase: slabs[nextIdx] - (currentNcb || 0),
  }
}

// ── Claim Process Steps ─────────────────────────────────────────────────────

export const CLAIM_PROCESS = [
  {
    step: 1,
    title: 'Report the Incident',
    titleHi: 'घटना की रिपोर्ट करें',
    description: 'Call your insurer\'s helpline or use their app within 24 hours. File an FIR if theft or accident involves third party.',
    descriptionHi: '24 घंटे के अंदर बीमा कंपनी के हेल्पलाइन पर कॉल करें। चोरी या दूसरे पक्ष के एक्सीडेंट में FIR दर्ज करें।',
    tip: 'Take photos of damage, note the date/time, get witness details.',
    tipHi: 'नुकसान की फोटो लें, तारीख/समय नोट करें, गवाहों की जानकारी लें।',
  },
  {
    step: 2,
    title: 'Get Claim Number',
    titleHi: 'क्लेम नंबर लें',
    description: 'Insurer will issue a claim number. Keep this for all follow-ups.',
    descriptionHi: 'बीमा कंपनी क्लेम नंबर देगी। सभी फॉलो-अप में ये ज़रूरी है।',
    tip: 'Save the claim number in Fleetsure for tracking.',
    tipHi: 'ट्रैकिंग के लिए क्लेम नंबर Fleetsure में सेव करें।',
  },
  {
    step: 3,
    title: 'Vehicle Survey',
    titleHi: 'गाड़ी का सर्वे',
    description: 'Insurer sends a surveyor to inspect damage. For cashless claims, take the vehicle to a network garage.',
    descriptionHi: 'बीमा कंपनी सर्वेयर भेजेगी। कैशलेस क्लेम के लिए नेटवर्क गैराज में गाड़ी ले जाएं।',
    tip: 'Cashless is faster -- ask for network garage list in your city.',
    tipHi: 'कैशलेस तेज़ है -- अपने शहर के नेटवर्क गैराज की लिस्ट मांगें।',
  },
  {
    step: 4,
    title: 'Submit Documents',
    titleHi: 'डॉक्यूमेंट जमा करें',
    description: 'RC copy, driving license, FIR (if applicable), repair estimate, policy copy, photos.',
    descriptionHi: 'RC कॉपी, ड्राइविंग लाइसेंस, FIR (अगर ज़रूरी), रिपेयर अनुमान, पॉलिसी कॉपी, फोटो।',
    tip: 'Keep scanned copies of all documents ready in Fleetsure.',
    tipHi: 'सभी डॉक्यूमेंट की स्कैन कॉपी Fleetsure में तैयार रखें।',
  },
  {
    step: 5,
    title: 'Claim Settlement',
    titleHi: 'क्लेम सेटलमेंट',
    description: 'Cashless: insurer pays garage directly (3-7 days). Reimbursement: you pay, insurer refunds (15-30 days).',
    descriptionHi: 'कैशलेस: बीमा कंपनी सीधे गैराज को पैसा देगी (3-7 दिन)। रीइम्बर्समेंट: आप पहले दें, बीमा कंपनी वापस करे (15-30 दिन)।',
    tip: 'Prefer cashless claims to avoid cash flow issues.',
    tipHi: 'कैश फ्लो की समस्या से बचने के लिए कैशलेस क्लेम चुनें।',
  },
]

// ── Smart Recommendation Templates ──────────────────────────────────────────

export const RECOMMENDATION_TYPES = {
  upgrade_to_comprehensive: {
    icon: '🛡️',
    severity: 'high',
    template: (vehicle, maintenanceCost) =>
      `${vehicle.vehicleNumber} had Rs ${maintenanceCost.toLocaleString('en-IN')} in maintenance this year. Comprehensive insurance would cover most of these repairs.`,
    templateHi: (vehicle, maintenanceCost) =>
      `${vehicle.vehicleNumber} पर इस साल Rs ${maintenanceCost.toLocaleString('en-IN')} मेंटेनेंस खर्च हुआ। कम्प्रीहेंसिव बीमा इन रिपेयर को कवर करेगा।`,
  },
  ncb_preservation: {
    icon: '💰',
    severity: 'medium',
    template: (vehicle, ncb, nextNcb, savings) =>
      `${vehicle.vehicleNumber} has ${ncb}% NCB (${nextNcb.isMax ? 'maximum' : `next year: ${nextNcb.next}%`}). Claim-free driving saves you Rs ${savings.toLocaleString('en-IN')}/year.`,
  },
  high_mileage_zero_dep: {
    icon: '🛣️',
    severity: 'medium',
    template: (vehicle, monthlyKm) =>
      `${vehicle.vehicleNumber} runs ~${monthlyKm.toLocaleString('en-IN')} km/month. Zero Depreciation add-on pays for itself after one claim.`,
  },
  coverage_gap: {
    icon: '⚠️',
    severity: 'high',
    template: (vehicle) =>
      `${vehicle.vehicleNumber} has only Third Party coverage. Any accident repair comes from your pocket.`,
  },
  expired_insurance: {
    icon: '🔴',
    severity: 'critical',
    template: (vehicle, daysPast) =>
      `${vehicle.vehicleNumber} insurance expired ${daysPast} days ago! Driving without insurance is illegal and risky.`,
  },
}
