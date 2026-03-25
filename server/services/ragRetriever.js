/**
 * Fleetsure — RAG Retriever (Lightweight TF-IDF)
 * ────────────────────────────────────────────────
 * Loads Indian fleet knowledge base and retrieves relevant chunks
 * using TF-IDF cosine similarity. Zero external dependencies.
 *
 * - loadKnowledgeBase() → loads all JSON knowledge files on startup
 * - retrieveContext(query, topK) → returns top-K relevant knowledge chunks
 * - searchKnowledge(query, topK) → same as above, exposed for tool use
 */

import { readFileSync, readdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const KNOWLEDGE_DIR = join(__dirname, '../data/knowledge')

let chunks = []
let idfCache = {}
let tfidfVectors = []
let loaded = false

// ── Text Processing ─────────────────────────────────────────────────────────

function tokenize(text) {
 return text
 .toLowerCase()
 .replace(/[^\w\s₹]/g, ' ')
 .split(/\s+/)
 .filter(w => w.length > 1)
}

function termFrequency(tokens) {
 const tf = {}
 for (const t of tokens) {
 tf[t] = (tf[t] || 0) + 1
 }
 const len = tokens.length || 1
 for (const t in tf) {
 tf[t] /= len
 }
 return tf
}

function computeIDF(allDocTokens) {
 const idf = {}
 const N = allDocTokens.length
 const docCount = {}

 for (const tokens of allDocTokens) {
 const seen = new Set(tokens)
 for (const t of seen) {
 docCount[t] = (docCount[t] || 0) + 1
 }
 }

 for (const t in docCount) {
 idf[t] = Math.log((N + 1) / (docCount[t] + 1)) + 1
 }

 return idf
}

function tfidfVector(tokens, idf) {
 const tf = termFrequency(tokens)
 const vec = {}
 for (const t in tf) {
 vec[t] = tf[t] * (idf[t] || 1)
 }
 return vec
}

function cosineSimilarity(a, b) {
 let dot = 0, magA = 0, magB = 0
 const allKeys = new Set([...Object.keys(a), ...Object.keys(b)])

 for (const k of allKeys) {
 const va = a[k] || 0
 const vb = b[k] || 0
 dot += va * vb
 magA += va * va
 magB += vb * vb
 }

 const denom = Math.sqrt(magA) * Math.sqrt(magB)
 return denom === 0 ? 0 : dot / denom
}

// ── Tag Boost ───────────────────────────────────────────────────────────────

function tagBoost(queryTokens, tags) {
 if (!tags || tags.length === 0) return 0
 const tagSet = new Set(tags.map(t => t.toLowerCase()))
 let matches = 0
 for (const qt of queryTokens) {
 if (tagSet.has(qt)) matches++
 for (const tag of tagSet) {
 if (tag.includes(qt) || qt.includes(tag)) {
 matches += 0.5
 break
 }
 }
 }
 return matches * 0.15
}

// ── Knowledge Base Loader ───────────────────────────────────────────────────

export function loadKnowledgeBase() {
 if (loaded) return chunks.length

 try {
 const files = readdirSync(KNOWLEDGE_DIR).filter(f => f.endsWith('.json'))
 chunks = []

 for (const file of files) {
 const filePath = join(KNOWLEDGE_DIR, file)
 const data = JSON.parse(readFileSync(filePath, 'utf-8'))
 const category = file.replace('.json', '')

 if (data.chunks && Array.isArray(data.chunks)) {
 for (const chunk of data.chunks) {
 chunks.push({
 id: chunk.id,
 title: chunk.title,
 content: chunk.content,
 tags: chunk.tags || [],
 category,
 searchText: `${chunk.title} ${chunk.content} ${(chunk.tags || []).join(' ')}`,
 })
 }
 }
 }

 // Build TF-IDF index
 const allDocTokens = chunks.map(c => tokenize(c.searchText))
 idfCache = computeIDF(allDocTokens)
 tfidfVectors = allDocTokens.map(tokens => tfidfVector(tokens, idfCache))

 loaded = true
 console.log(`[RAG] Loaded ${chunks.length} knowledge chunks from ${files.length} files`)
 return chunks.length
 } catch (err) {
 console.error('[RAG] Failed to load knowledge base:', err.message)
 return 0
 }
}

// ── Retrieval ───────────────────────────────────────────────────────────────

/**
 * Retrieve the most relevant knowledge chunks for a query.
 * @param {string} query - User's question
 * @param {number} topK - Number of chunks to return (default: 5)
 * @returns {Array<{id, title, content, category, score}>}
 */
export function retrieveContext(query, topK = 5) {
 if (!loaded) loadKnowledgeBase()
 if (chunks.length === 0) return []

 const queryTokens = tokenize(query)
 const queryVec = tfidfVector(queryTokens, idfCache)

 const scored = chunks.map((chunk, i) => {
 const tfidfScore = cosineSimilarity(queryVec, tfidfVectors[i])
 const boost = tagBoost(queryTokens, chunk.tags)
 return {
 id: chunk.id,
 title: chunk.title,
 content: chunk.content,
 category: chunk.category,
 score: tfidfScore + boost,
 }
 })

 scored.sort((a, b) => b.score - a.score)
 return scored.slice(0, topK).filter(s => s.score > 0.01)
}

/**
 * Format retrieved chunks as context text for injection into LLM prompts.
 * @param {string} query
 * @param {number} topK
 * @returns {string} Formatted context string
 */
export function getRAGContext(query, topK = 5) {
 const results = retrieveContext(query, topK)
 if (results.length === 0) return ''

 let context = '\n\n--- INDIAN FLEET INDUSTRY KNOWLEDGE ---\n'
 for (const r of results) {
 context += `\n[${r.category.toUpperCase()}] ${r.title}\n${r.content}\n`
 }
 context += '\n--- END KNOWLEDGE ---\n'
 return context
}

/**
 * Search knowledge base (for agent tool use).
 * @param {string} query
 * @param {number} topK
 * @returns {Array}
 */
export function searchKnowledge(query, topK = 5) {
 return retrieveContext(query, topK)
}

/**
 * Get all available categories.
 */
export function getCategories() {
 if (!loaded) loadKnowledgeBase()
 return [...new Set(chunks.map(c => c.category))]
}

/**
 * Get chunks by category.
 */
export function getChunksByCategory(category, limit = 10) {
 if (!loaded) loadKnowledgeBase()
 return chunks
 .filter(c => c.category === category)
 .slice(0, limit)
 .map(c => ({ id: c.id, title: c.title, content: c.content, category: c.category }))
}

export default {
 loadKnowledgeBase,
 retrieveContext,
 getRAGContext,
 searchKnowledge,
 getCategories,
 getChunksByCategory,
}
