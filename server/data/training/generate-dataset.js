/**
 * Fleetsure — Training Dataset Generator
 * ────────────────────────────────────────
 * Generates fleet Q&A training pairs using the knowledge base + Groq.
 * Run: node server/data/training/generate-dataset.js
 *
 * Creates fleet-qa-pairs.jsonl for fine-tuning on Together AI.
 */

import 'dotenv/config'
import Groq from 'groq-sdk'
import { readFileSync, writeFileSync, readdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const KNOWLEDGE_DIR = join(__dirname, '../knowledge')
const OUTPUT_FILE = join(__dirname, 'fleet-qa-pairs.jsonl')

const SYSTEM_PROMPT = `You are an expert Indian fleet operations advisor with 20+ years of experience in commercial vehicle management, IRDAI insurance, Motor Vehicle Act compliance, fleet economics, and Indian trucking operations. You give practical, actionable advice grounded in Indian regulations and market realities. Use Indian Rupee (₹) with Indian formatting. Be direct and specific.`

const CATEGORIES = [
  {
    name: 'insurance',
    promptTemplate: (chunk) => `Based on this Indian fleet insurance knowledge:

"${chunk.content}"

Generate 4 realistic question-answer pairs that an Indian fleet owner might ask. The questions should be practical and specific. The answers should be expert-level, mentioning specific ₹ amounts, regulations, and actionable advice.

Return as a JSON array:
[{"question": "...", "answer": "..."}]

Make questions conversational, like how a real fleet owner would ask (e.g., "Should I file this claim?", "What's the best insurance for my new truck?", "My NCB is 35%, what should I do?")`,
  },
  {
    name: 'operations',
    promptTemplate: (chunk) => `Based on this Indian fleet operations knowledge:

"${chunk.content}"

Generate 4 realistic question-answer pairs that an Indian fleet owner or manager might ask. Focus on practical daily operations advice. Answers should include specific numbers, benchmarks, and actionable steps.

Return as a JSON array:
[{"question": "...", "answer": "..."}]

Make questions natural (e.g., "My truck is giving only 2.5 km/L, what's wrong?", "How often should I service my Tata Prima?", "What's a good tyre brand for long-haul?")`,
  },
  {
    name: 'compliance',
    promptTemplate: (chunk) => `Based on this Indian fleet compliance knowledge:

"${chunk.content}"

Generate 4 realistic question-answer pairs about Indian Motor Vehicle Act, RTO rules, permits, or document compliance. Answers should cite specific penalty amounts, regulations, and deadlines.

Return as a JSON array:
[{"question": "...", "answer": "..."}]

Make questions practical (e.g., "My FC expired last week, what fine will I get?", "Do I need a national permit for Gujarat to Maharashtra?", "What's the overloading fine now?")`,
  },
  {
    name: 'financial',
    promptTemplate: (chunk) => `Based on this Indian fleet financial knowledge:

"${chunk.content}"

Generate 4 realistic question-answer pairs about fleet profitability, GST, TDS, financing, or cost management. Answers should include specific ₹ amounts, percentages, and tax rules.

Return as a JSON array:
[{"question": "...", "answer": "..."}]

Make questions business-focused (e.g., "What margin should I target?", "How does GST work on my freight?", "Should I buy or lease my next truck?")`,
  },
]

const CATEGORY_MAP = {
  'insurance': 'insurance',
  'motor-vehicle-act': 'compliance',
  'state-rto': 'compliance',
  'fuel-optimization': 'operations',
  'route-economics': 'operations',
  'maintenance': 'operations',
  'driver-management': 'operations',
  'financial': 'financial',
  'industry-benchmarks': 'financial',
}

async function generatePairs(groq, chunk, category) {
  const cat = CATEGORIES.find(c => c.name === category) || CATEGORIES[0]
  const prompt = cat.promptTemplate(chunk)

  try {
    const completion = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [
        { role: 'system', content: 'You generate training data for an Indian fleet operations AI. Return ONLY valid JSON arrays.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 2000,
    })

    const content = completion.choices[0]?.message?.content?.trim()
    if (!content) return []

    const jsonMatch = content.match(/\[[\s\S]*\]/)
    if (!jsonMatch) return []

    const pairs = JSON.parse(jsonMatch[0])
    return pairs.map(p => ({
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: p.question },
        { role: 'assistant', content: p.answer },
      ],
    }))
  } catch (err) {
    console.error(`  Error generating for ${chunk.id}:`, err.message)
    return []
  }
}

async function main() {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) {
    console.error('GROQ_API_KEY is required. Set it in .env')
    process.exit(1)
  }

  const groq = new Groq({ apiKey })
  const allPairs = []

  // Load all knowledge files
  const files = readdirSync(KNOWLEDGE_DIR).filter(f => f.endsWith('.json'))
  console.log(`Found ${files.length} knowledge files\n`)

  for (const file of files) {
    const filePath = join(KNOWLEDGE_DIR, file)
    const data = JSON.parse(readFileSync(filePath, 'utf-8'))
    const category = CATEGORY_MAP[file.replace('.json', '')] || 'operations'

    console.log(`Processing ${file} (${data.chunks.length} chunks, category: ${category})`)

    for (const chunk of data.chunks) {
      process.stdout.write(`  Generating for ${chunk.id}...`)
      const pairs = await generatePairs(groq, chunk, category)
      allPairs.push(...pairs)
      console.log(` ${pairs.length} pairs`)

      // Rate limit: wait 500ms between calls
      await new Promise(r => setTimeout(r, 500))
    }
    console.log()
  }

  // Also add manually curated high-quality examples
  const manualPairs = getManualPairs()
  allPairs.push(...manualPairs)
  console.log(`Added ${manualPairs.length} manually curated examples`)

  // Write JSONL
  const jsonl = allPairs.map(p => JSON.stringify(p)).join('\n')
  writeFileSync(OUTPUT_FILE, jsonl, 'utf-8')

  console.log(`\nTotal: ${allPairs.length} training pairs`)
  console.log(`Written to: ${OUTPUT_FILE}`)
  console.log(`\nNext: Run upload-and-train.js to fine-tune on Together AI`)
}

function getManualPairs() {
  const sys = SYSTEM_PROMPT
  return [
    {
      messages: [
        { role: 'system', content: sys },
        { role: 'user', content: 'My truck NCB is at 35%. I had a small accident, repair cost is ₹12,000. Should I file a claim?' },
        { role: 'assistant', content: 'No, do not file this claim. At 35% NCB, you save approximately ₹6,500-8,000 on your annual premium. Filing a ₹12,000 claim would reset your NCB to 0%, meaning you lose that discount for years. The net benefit of claiming is only ₹4,000-5,500, and it takes 3 years to rebuild to 35% NCB.\n\nPay the ₹12,000 out of pocket. You\'re one claim-free year away from 45% NCB, which saves even more. Rule of thumb for commercial vehicles: only file insurance claims above ₹50,000.' },
      ],
    },
    {
      messages: [
        { role: 'system', content: sys },
        { role: 'user', content: 'What\'s the penalty if my truck is caught overloaded on a highway?' },
        { role: 'assistant', content: 'Under the Motor Vehicle Act 2019, overloading penalties are steep:\n\n• Base fine: ₹20,000 for any overloading\n• Additional: ₹2,000 per extra tonne beyond the permitted weight\n• Vehicle can be detained until excess load is removed\n• Repeat offences: License suspension possible\n\nFor example, if your 16-wheeler is 3 tonnes overloaded: ₹20,000 + (3 × ₹2,000) = ₹26,000 fine, plus the cost of unloading, delay, and potential vehicle detention. Many states like Maharashtra and Gujarat have started weighbridge enforcement on all NHs.\n\nPractical tip: Always weigh at the loading point. The extra freight revenue from overloading (maybe ₹3,000-5,000 per trip) is not worth the risk of a ₹20,000+ fine plus vehicle downtime.' },
      ],
    },
    {
      messages: [
        { role: 'system', content: sys },
        { role: 'user', content: 'My fleet margin has dropped to 18% this quarter. What should I check?' },
        { role: 'assistant', content: 'An 18% margin is below the healthy 25-35% range for Indian fleet operators. Here\'s a systematic diagnosis:\n\n1. **Fuel costs** (35-45% of operating cost): Check km/L per vehicle. If any truck is below 3.0 km/L, investigate — could be driving habits, tyre pressure, or engine issues. Compare against benchmarks: Tata Prima should do 3.5-4.0 km/L.\n\n2. **Freight rates**: Compare your per-km rates against market. Delhi-Mumbai should be ₹3.2-3.8/km. If you\'re below, you\'re undercharging or accepting bad loads.\n\n3. **Driver cash/batta**: Check if cash expenses per trip are creeping up. Fair rate is ₹500-800/day for outstation. Some drivers inflate this.\n\n4. **Idle vehicles**: Any truck sitting idle costs you ₹2,000-3,000/day in EMI, insurance, and depreciation. Target 20-25 trips/month per vehicle.\n\n5. **Maintenance spike**: Check if any vehicle had a major repair recently. One ₹1-2 lakh engine overhaul can tank your quarterly margin.\n\n6. **Toll leakage**: Verify FASTag statements against expected routes.\n\nStart with fuel — it\'s usually the biggest lever. A 0.5 km/L improvement across your fleet can add 3-5% to your margin.' },
      ],
    },
    {
      messages: [
        { role: 'system', content: sys },
        { role: 'user', content: 'How does GST work on freight charges? I\'m confused about 5% vs 12%.' },
        { role: 'assistant', content: 'GST on Goods Transport Agency (GTA) services has two options:\n\n**Option 1: 5% GST (no ITC)**\n• You charge 5% GST on freight\n• You CANNOT claim Input Tax Credit on fuel, tyres, repairs, etc.\n• Simpler to manage, less compliance burden\n• Most small-medium fleet owners (under 50 trucks) choose this\n\n**Option 2: 12% GST (with ITC)**\n• You charge 12% GST on freight\n• You CAN claim ITC on diesel (if bought from registered dealer with invoice), tyres, maintenance, insurance, etc.\n• Better for large fleets with high input costs\n• Requires meticulous invoice management\n\n**Reverse Charge Mechanism (RCM):**\nIf the recipient is a registered business, THEY pay the GST under reverse charge. You don\'t charge GST on your invoice. This is the most common arrangement for B2B freight.\n\n**Practical advice:** If your monthly fuel + maintenance input is above ₹5 lakh, the 12% with ITC option often saves more. Below that, stick with 5% for simplicity. Consult your CA for your specific fleet size.\n\nAlso remember: TDS of 1% applies on freight payments exceeding ₹30,000 per transaction or ₹1,00,000 per year under Section 194C.' },
      ],
    },
    {
      messages: [
        { role: 'system', content: sys },
        { role: 'user', content: 'My driver is complaining about low salary. What\'s the market rate?' },
        { role: 'assistant', content: 'Driver salary benchmarks in India (2024-25):\n\n**Long-haul drivers (interstate):**\n• Fixed salary: ₹18,000-25,000/month for regular drivers\n• Experienced (5+ years, clean record): ₹25,000-35,000/month\n• Per-trip basis: ₹800-1,500 per trip (depending on distance)\n• Batta/daily allowance: ₹500-1,000/day for outstation\n\n**Local/short-haul drivers:**\n• Fixed: ₹12,000-18,000/month\n• City delivery: ₹15,000-22,000/month\n\n**Regional variations:**\n• North India (Delhi/Punjab/Haryana): 10-15% higher\n• South India: Market rate\n• West (Gujarat/Maharashtra): 5-10% higher\n\n**Retention tips that work better than just raising salary:**\n• On-time payment (biggest complaint in the industry)\n• Fuel savings incentive: Share 25-50% of fuel saved vs benchmark with the driver\n• Safety bonus: ₹1,000-2,000/month for zero incidents\n• Festival bonus: 1 month salary at Diwali\n• Health insurance: ₹2,000-3,000/year per driver\n\nIndia has a shortage of ~30 lakh commercial drivers. Good drivers are hard to find. Investing in retention is cheaper than constant hiring.' },
      ],
    },
    {
      messages: [
        { role: 'system', content: sys },
        { role: 'user', content: 'Which insurance company is best for commercial trucks in India?' },
        { role: 'assistant', content: 'Here\'s a practical comparison of major insurers for commercial vehicles in India:\n\n**Best overall value:**\n• **New India Assurance** — Government-owned, lowest premiums (8-12% cheaper), widest garage network. Claim settlement can be slow (30-45 days) but reliable. Best for cost-conscious fleet owners.\n• **Go Digit** — Competitive pricing, fastest digital claims process, good for tech-savvy fleet owners. Newer company but growing fast.\n\n**Best claim experience:**\n• **ICICI Lombard** — Excellent cashless network (5,500+ garages), fast claim settlement (15-20 days). Premium is 5-10% higher but worth it for frequent claims.\n• **Bajaj Allianz** — Strong in North India, good workshop network, decent digital experience.\n\n**Best for large fleets (10+ vehicles):**\n• **New India Assurance** or **United India** — Offer best fleet discounts (10-15%). Dedicated relationship manager for 20+ vehicles.\n• **HDFC ERGO** — Good fleet management portal, bulk renewal discounts.\n\n**Practical tips:**\n• Get quotes from at least 3 insurers every renewal — don\'t auto-renew\n• Negotiate fleet discount upfront if you have 10+ trucks\n• Keep all vehicles with same insurer for maximum discount\n• Prioritize garage network on your routes over premium savings\n• Always add PA cover (₹750-1,200/year, mandatory since 2019)' },
      ],
    },
    {
      messages: [
        { role: 'system', content: sys },
        { role: 'user', content: 'What MRF tyre should I use for my 16-wheeler on Delhi-Mumbai route?' },
        { role: 'assistant', content: 'For a 16-wheeler on the Delhi-Mumbai corridor (1,400 km, mostly NH-48), here\'s my recommendation:\n\n**Steer axle (front):**\n• MRF STEEL MUSCLE S1R4 — Best for highway steering, good wet grip. Expected life: 80,000-90,000 km. Price: ₹18,000-22,000 per tyre.\n\n**Drive axle (rear):**\n• MRF STEEL MUSCLE D1M — Deep tread, good traction for loaded trucks. Expected life: 70,000-85,000 km. Price: ₹17,000-21,000 per tyre.\n\n**Trailer axle:**\n• MRF STEEL MUSCLE T1 — Designed for free-rolling positions, lower heat buildup. Expected life: 85,000-1,00,000 km. Price: ₹16,000-20,000 per tyre.\n\n**Cost-effective alternative:** Apollo EnduRace RT if budget is tight — 15-20% cheaper, 70,000-80,000 km life.\n\n**Maintenance tips for this route:**\n• Check pressure every trip (100-110 PSI for loaded). Under-inflation costs 1-2% fuel per trip.\n• Rotate steer tyres every 30,000 km\n• Delhi-Mumbai has good highway surface but watch for Rajasthan section potholes\n• Consider retreading drive tyres once (saves 40-60% vs new)\n\n**Total tyre budget for 16-wheeler:** ₹2.8-3.5 lakh for full set (14-18 tyres depending on config). Plan replacement every 80,000 km or 12-14 months.' },
      ],
    },
  ]
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
