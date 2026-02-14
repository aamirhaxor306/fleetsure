/**
 * Fleetsure — AI Agent Loop
 * ──────────────────────────
 * Orchestrates a multi-turn tool-calling conversation with Groq.
 * Read tools auto-execute; write tools pause for user confirmation.
 */

import Groq from 'groq-sdk'
import crypto from 'crypto'
import { TOOL_MAP, TOOL_DEFINITIONS } from './agentTools.js'

// ── Conversation Store (in-memory, 30-min TTL) ─────────────────────────────
const conversations = new Map()
const CONVERSATION_TTL = 30 * 60 * 1000

function cleanExpired() {
  const now = Date.now()
  for (const [id, conv] of conversations) {
    if (now - conv.lastAccess > CONVERSATION_TTL) conversations.delete(id)
  }
}
setInterval(cleanExpired, 5 * 60 * 1000) // cleanup every 5 min

function getConversation(id) {
  const conv = conversations.get(id)
  if (conv) conv.lastAccess = Date.now()
  return conv || null
}

function createConversation(tenantId = null) {
  const id = crypto.randomUUID()
  const conv = {
    id,
    tenantId,
    messages: [],
    pendingAction: null,
    toolsUsed: [],
    lastAccess: Date.now(),
  }
  conversations.set(id, conv)
  return conv
}

// ── System Prompt ───────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are the Fleetsure AI Fleet Agent — an expert fleet operations assistant for an Indian trucking fleet management platform.

You have access to tools that can query and modify the entire CRM: vehicles, trips, drivers, documents, alerts, maintenance, insurance, routes, and more.

RULES:
1. ALWAYS fetch real data using tools before answering. NEVER guess or make up data.
2. For data questions, call the relevant read tool first, then summarize the results clearly.
3. For actions (create, update, delete), explain what you will do, then call the write tool.
4. Use Indian Rupee (₹) formatting for all amounts.
5. Be concise and action-oriented. Fleet owners are busy.
6. When listing items, use clear formatting with bullet points.
7. If you need to chain multiple tools, call them one by one.
8. If a tool returns an error, explain it to the user and suggest alternatives.
9. When asked vague questions, fetch the most relevant data and provide a clear summary.

You can help with:
- Fleet overview, vehicle status, and health
- Trip management and profitability analysis
- Driver performance and management
- Document compliance (insurance, FC, PUC, permits)
- Maintenance tracking and cost analysis
- Alert management
- Insurance renewals and cost optimization
- Route management
- Financial reporting and reconciliation`

// ── Agent Turn ──────────────────────────────────────────────────────────────
const MAX_TOOL_CALLS = 10
const MODEL = 'llama-3.3-70b-versatile'

/**
 * Run one agent turn.
 * @param {string} message - User message
 * @param {string|null} conversationId - Existing conversation ID (for multi-turn)
 * @param {string|null} tenantId - Tenant ID for tool execution (fleet scope)
 * @returns {{ response: string, conversationId: string, pendingAction: object|null, toolsUsed: string[], done: boolean }}
 */
export async function runAgentTurn(message, conversationId = null, tenantId = null) {
  const groqKey = process.env.GROQ_API_KEY
  if (!groqKey) {
    return { response: 'AI agent is not configured. Set GROQ_API_KEY in environment.', conversationId: '', pendingAction: null, toolsUsed: [], done: true }
  }

  const groq = new Groq({ apiKey: groqKey })
  let conv = conversationId ? getConversation(conversationId) : null
  if (!conv) conv = createConversation(tenantId)
  if (tenantId != null) conv.tenantId = tenantId

  // Add user message
  conv.messages.push({ role: 'user', content: message })
  conv.toolsUsed = []

  let toolCallCount = 0

  while (toolCallCount < MAX_TOOL_CALLS) {
    // Build messages for Groq
    const apiMessages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...conv.messages,
    ]

    try {
      const completion = await groq.chat.completions.create({
        model: MODEL,
        messages: apiMessages,
        tools: TOOL_DEFINITIONS,
        tool_choice: 'auto',
        temperature: 0.3,
        max_tokens: 2048,
      })

      const choice = completion.choices[0]
      const assistantMsg = choice.message

      // If there are no tool calls, we're done
      if (!assistantMsg.tool_calls || assistantMsg.tool_calls.length === 0) {
        const text = assistantMsg.content || 'I could not generate a response.'
        conv.messages.push({ role: 'assistant', content: text })
        return {
          response: text,
          conversationId: conv.id,
          pendingAction: null,
          toolsUsed: [...conv.toolsUsed],
          done: true,
        }
      }

      // Process tool calls
      // Store the full assistant message with tool_calls
      conv.messages.push({
        role: 'assistant',
        content: assistantMsg.content || null,
        tool_calls: assistantMsg.tool_calls,
      })

      for (const toolCall of assistantMsg.tool_calls) {
        const toolName = toolCall.function.name
        const tool = TOOL_MAP[toolName]

        if (!tool) {
          conv.messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify({ error: `Unknown tool: ${toolName}` }),
          })
          continue
        }

        let args = {}
        try {
          args = JSON.parse(toolCall.function.arguments || '{}')
        } catch {
          args = {}
        }

        // Check if this is a write tool needing confirmation
        if (tool.requiresConfirmation) {
          conv.pendingAction = {
            toolCallId: toolCall.id,
            toolName,
            toolDescription: tool.description,
            args,
            humanReadable: formatActionDescription(toolName, args),
          }
          return {
            response: assistantMsg.content || `I need your approval to proceed.`,
            conversationId: conv.id,
            pendingAction: conv.pendingAction,
            toolsUsed: [...conv.toolsUsed],
            done: false,
          }
        }

        // Read tool — execute immediately
        try {
          const result = await tool.execute(args, conv.tenantId)
          const resultStr = JSON.stringify(result, null, 0).slice(0, 8000) // limit size
          conv.messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: resultStr,
          })
          conv.toolsUsed.push(toolName)
          toolCallCount++
        } catch (err) {
          conv.messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify({ error: err.message }),
          })
          toolCallCount++
        }
      }
    } catch (err) {
      console.error('[AgentLoop] LLM call failed:', err.message)
      return {
        response: `Sorry, I encountered an error: ${err.message}. Please try again.`,
        conversationId: conv.id,
        pendingAction: null,
        toolsUsed: [...conv.toolsUsed],
        done: true,
      }
    }
  }

  // Safety: max tool calls reached
  const finalMessages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...conv.messages,
    { role: 'user', content: 'You have reached the maximum number of tool calls. Please summarize what you found so far.' },
  ]

  try {
    const groq2 = new Groq({ apiKey: groqKey })
    const finalCompletion = await groq2.chat.completions.create({
      model: MODEL,
      messages: finalMessages,
      temperature: 0.3,
      max_tokens: 2048,
    })
    const text = finalCompletion.choices[0]?.message?.content || 'I ran out of tool calls. Please try a more specific question.'
    conv.messages.push({ role: 'assistant', content: text })
    return { response: text, conversationId: conv.id, pendingAction: null, toolsUsed: [...conv.toolsUsed], done: true }
  } catch {
    return { response: 'Reached tool call limit. Please try a more specific question.', conversationId: conv.id, pendingAction: null, toolsUsed: [...conv.toolsUsed], done: true }
  }
}

/**
 * Confirm or reject a pending write action.
 * @param {string} conversationId
 * @param {boolean} confirmed
 * @returns {{ response: string, pendingAction: object|null, toolsUsed: string[], done: boolean }}
 */
export async function confirmAction(conversationId, confirmed) {
  const conv = getConversation(conversationId)
  if (!conv || !conv.pendingAction) {
    return { response: 'No pending action to confirm.', pendingAction: null, toolsUsed: [], done: true }
  }

  const { toolCallId, toolName, args } = conv.pendingAction
  const tool = TOOL_MAP[toolName]

  if (!confirmed) {
    // User rejected
    conv.messages.push({
      role: 'tool',
      tool_call_id: toolCallId,
      content: JSON.stringify({ cancelled: true, message: 'User rejected this action.' }),
    })
    conv.pendingAction = null

    // Let LLM acknowledge
    return runAgentContinue(conv)
  }

  // Execute the write tool
  try {
    const result = await tool.execute(args, conv.tenantId)
    conv.messages.push({
      role: 'tool',
      tool_call_id: toolCallId,
      content: JSON.stringify(result),
    })
    conv.toolsUsed.push(toolName)
  } catch (err) {
    conv.messages.push({
      role: 'tool',
      tool_call_id: toolCallId,
      content: JSON.stringify({ error: err.message }),
    })
  }

  conv.pendingAction = null

  // Continue the agent loop
  return runAgentContinue(conv)
}

/**
 * Continue the agent loop after a tool result is added (used after confirmation).
 */
async function runAgentContinue(conv) {
  const groqKey = process.env.GROQ_API_KEY
  if (!groqKey) {
    return { response: 'AI agent not configured.', pendingAction: null, toolsUsed: [...conv.toolsUsed], done: true }
  }

  const groq = new Groq({ apiKey: groqKey })
  let toolCallCount = 0

  while (toolCallCount < MAX_TOOL_CALLS) {
    const apiMessages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...conv.messages,
    ]

    try {
      const completion = await groq.chat.completions.create({
        model: MODEL,
        messages: apiMessages,
        tools: TOOL_DEFINITIONS,
        tool_choice: 'auto',
        temperature: 0.3,
        max_tokens: 2048,
      })

      const choice = completion.choices[0]
      const assistantMsg = choice.message

      if (!assistantMsg.tool_calls || assistantMsg.tool_calls.length === 0) {
        const text = assistantMsg.content || 'Done.'
        conv.messages.push({ role: 'assistant', content: text })
        return { response: text, conversationId: conv.id, pendingAction: null, toolsUsed: [...conv.toolsUsed], done: true }
      }

      conv.messages.push({
        role: 'assistant',
        content: assistantMsg.content || null,
        tool_calls: assistantMsg.tool_calls,
      })

      for (const toolCall of assistantMsg.tool_calls) {
        const tName = toolCall.function.name
        const t = TOOL_MAP[tName]
        if (!t) {
          conv.messages.push({ role: 'tool', tool_call_id: toolCall.id, content: JSON.stringify({ error: `Unknown tool: ${tName}` }) })
          continue
        }

        let tArgs = {}
        try { tArgs = JSON.parse(toolCall.function.arguments || '{}') } catch { tArgs = {} }

        if (t.requiresConfirmation) {
          conv.pendingAction = {
            toolCallId: toolCall.id, toolName: tName, toolDescription: t.description, args: tArgs,
            humanReadable: formatActionDescription(tName, tArgs),
          }
          return {
            response: assistantMsg.content || 'I need your approval to proceed.',
            conversationId: conv.id, pendingAction: conv.pendingAction,
            toolsUsed: [...conv.toolsUsed], done: false,
          }
        }

        try {
          const result = await t.execute(tArgs, conv.tenantId)
          conv.messages.push({ role: 'tool', tool_call_id: toolCall.id, content: JSON.stringify(result, null, 0).slice(0, 8000) })
          conv.toolsUsed.push(tName)
          toolCallCount++
        } catch (err) {
          conv.messages.push({ role: 'tool', tool_call_id: toolCall.id, content: JSON.stringify({ error: err.message }) })
          toolCallCount++
        }
      }
    } catch (err) {
      return { response: `Error: ${err.message}`, conversationId: conv.id, pendingAction: null, toolsUsed: [...conv.toolsUsed], done: true }
    }
  }

  return { response: 'Reached tool call limit.', conversationId: conv.id, pendingAction: null, toolsUsed: [...conv.toolsUsed], done: true }
}

// ── Human-readable action descriptions ──────────────────────────────────────
function formatActionDescription(toolName, args) {
  const labels = {
    createTrip: `Log a trip: ${args.loadingLocation || '?'} → ${args.destination || '?'}`,
    resolveAlert: `Resolve alert ${(args.alertId || '').slice(0, 8)}...`,
    runAlertEngine: 'Run the fleet alert engine to scan for new issues',
    createDocument: `Add ${args.documentType || 'document'} for vehicle`,
    updateDocument: `Update document expiry to ${args.expiryDate || '?'}`,
    createMaintenance: `Log ${args.maintenanceType || 'maintenance'} — ₹${args.amount || 0}`,
    createDriver: `Register driver: ${args.name || '?'} (${args.phone || '?'})`,
    updateDriver: `Update driver ${(args.driverId || '').slice(0, 8)}...`,
    updateVehicle: `Update vehicle ${(args.vehicleId || '').slice(0, 8)}...`,
    createRenewal: `Create ${args.documentType || 'document'} renewal request`,
    confirmRenewal: `Confirm renewal ${(args.renewalId || '').slice(0, 8)}...`,
    createSavedRoute: `Save route: ${args.shortName || args.loadingLocation || '?'}`,
    updateSavedRoute: `Update route ${(args.routeId || '').slice(0, 8)}...`,
    deleteSavedRoute: `Delete route ${(args.routeId || '').slice(0, 8)}...`,
    reconcileBill: `Reconcile bill with ${Object.keys(args.tripFreightMap || {}).length} trips`,
  }
  return labels[toolName] || `Execute ${toolName}`
}

export default { runAgentTurn, confirmAction }
