/**
 * Fleetsure — Fleet Domain LLM Router
 * ─────────────────────────────────────
 * Routes LLM calls to the best available model:
 * 1. Fine-tuned model via Together AI (if configured)
 * 2. Groq Llama 3.3 70B (default, great for tool-calling)
 * 3. Gemini 2.0 Flash (fallback)
 *
 * Domain-specific questions route to fine-tuned model.
 * Tool-calling always goes through Groq (better at structured output).
 */

import Groq from 'groq-sdk'

// ── Provider Configuration ──────────────────────────────────────────────────

function getTogetherConfig() {
  const key = process.env.TOGETHER_API_KEY
  const model = process.env.FLEET_FINETUNED_MODEL
  if (key && model) return { key, model }
  return null
}

function getGroqConfig() {
  const key = process.env.GROQ_API_KEY
  if (key) return { key, model: 'llama-3.3-70b-versatile' }
  return null
}

// ── Domain Detection ────────────────────────────────────────────────────────

const DOMAIN_KEYWORDS = [
  'insurance', 'irdai', 'ncb', 'claim', 'premium', 'policy', 'comprehensive',
  'third party', 'tp', 'od', 'idv', 'depreciation', 'add-on', 'zero dep',
  'motor vehicle act', 'mv act', 'overloading', 'penalty', 'fine', 'fitness',
  'puc', 'permit', 'national permit', 'rto', 'compliance', 'document expiry',
  'fuel efficiency', 'diesel', 'km per litre', 'mileage', 'fuel cost',
  'maintenance schedule', 'brake', 'clutch', 'tyre', 'tire', 'oil change',
  'gst', 'tds', 'depreciation', 'cost per km', 'profitability', 'margin',
  'freight rate', 'toll', 'route economics', 'backhaul',
  'driver salary', 'driver management', 'driving hours', 'fatigue',
  'fleet benchmark', 'industry', 'utilization', 'breakdown',
  'nhai', 'golden quadrilateral', 'dedicated freight corridor',
  'fleet discount', 'renewal', 'break-in', 'scrapping policy',
  'axle load', 'speed governor', 'bs-vi', 'emission',
]

/**
 * Detect if a query is domain-specific (should use fine-tuned model).
 */
function isDomainQuery(query) {
  const lower = query.toLowerCase()
  let matchCount = 0
  for (const kw of DOMAIN_KEYWORDS) {
    if (lower.includes(kw)) matchCount++
  }
  return matchCount >= 1
}

// ── LLM Call Functions ──────────────────────────────────────────────────────

/**
 * Call the fine-tuned model via Together AI (OpenAI-compatible API).
 */
async function callFineTuned(systemPrompt, userMessage) {
  const config = getTogetherConfig()
  if (!config) return null

  try {
    const response = await fetch('https://api.together.xyz/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        temperature: 0.3,
        max_tokens: 2048,
      }),
    })

    const data = await response.json()
    if (data.choices?.[0]?.message?.content) {
      return {
        text: data.choices[0].message.content,
        source: 'fine-tuned',
        model: config.model,
      }
    }
    return null
  } catch (err) {
    console.error('[FleetLLM] Fine-tuned model error:', err.message)
    return null
  }
}

/**
 * Call Groq Llama (default for tool-calling and general queries).
 */
async function callGroq(systemPrompt, userMessage) {
  const config = getGroqConfig()
  if (!config) return null

  try {
    const groq = new Groq({ apiKey: config.key })
    const completion = await groq.chat.completions.create({
      model: config.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.3,
      max_tokens: 2048,
    })

    return {
      text: completion.choices[0]?.message?.content || '',
      source: 'groq',
      model: config.model,
    }
  } catch (err) {
    console.error('[FleetLLM] Groq error:', err.message)
    return null
  }
}

// ── Main Router ─────────────────────────────────────────────────────────────

/**
 * Route a query to the best available model.
 * Domain questions → fine-tuned model (if available) → Groq fallback
 * General questions → Groq
 *
 * @param {string} systemPrompt
 * @param {string} userMessage
 * @param {object} options - { forceDomain: boolean, forceGroq: boolean }
 * @returns {{ text: string, source: string, model: string }}
 */
export async function callFleetLLM(systemPrompt, userMessage, options = {}) {
  const { forceDomain = false, forceGroq = false } = options

  // If Groq is forced (e.g., for tool-calling), use Groq directly
  if (forceGroq) {
    const result = await callGroq(systemPrompt, userMessage)
    if (result) return result
  }

  // Check if this is a domain-specific query
  const domain = forceDomain || isDomainQuery(userMessage)

  if (domain) {
    // Try fine-tuned model first
    const ftResult = await callFineTuned(systemPrompt, userMessage)
    if (ftResult) return ftResult

    // Fall back to Groq
    const groqResult = await callGroq(systemPrompt, userMessage)
    if (groqResult) return groqResult
  } else {
    // Non-domain query → Groq directly
    const groqResult = await callGroq(systemPrompt, userMessage)
    if (groqResult) return groqResult
  }

  return { text: 'No AI provider available. Please configure GROQ_API_KEY.', source: 'error', model: 'none' }
}

/**
 * Get status of all configured LLM providers.
 */
export function getLLMStatus() {
  return {
    fineTuned: getTogetherConfig() ? { configured: true, model: getTogetherConfig().model } : { configured: false },
    groq: getGroqConfig() ? { configured: true, model: 'llama-3.3-70b-versatile' } : { configured: false },
    domainKeywords: DOMAIN_KEYWORDS.length,
  }
}

export default { callFleetLLM, getLLMStatus, isDomainQuery }
