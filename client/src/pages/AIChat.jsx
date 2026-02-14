import { useState, useEffect, useRef } from 'react'
import { insights as insightsApi } from '../api'
import { useLang } from '../context/LanguageContext'
import PageHeader from '../components/PageHeader'
import { SparkleIcon } from '../components/Icons'

// ── Human-readable tool labels ──────────────────────────────────────────────
const TOOL_LABELS = {
  listVehicles: 'Fetched vehicle list',
  getVehicle: 'Loaded vehicle details',
  listTrips: 'Fetched trips',
  getTripDetail: 'Loaded trip details',
  getTripAnalytics: 'Analyzed fleet P&L',
  listDrivers: 'Fetched driver list',
  getDriver: 'Loaded driver details',
  listAlerts: 'Fetched alerts',
  listDocuments: 'Checked documents',
  listMaintenance: 'Fetched maintenance logs',
  listSavedRoutes: 'Loaded saved routes',
  listRenewals: 'Fetched renewals',
  getRenewal: 'Loaded renewal details',
  getExpiringDocuments: 'Checked expiring documents',
  getRevenueSummary: 'Loaded revenue summary',
  listMonthlyBills: 'Fetched monthly bills',
  getMonthlyBill: 'Loaded bill details',
  listTyres: 'Checked tyres',
  getFleetHealth: 'Analyzed fleet health',
  getInsuranceOptimizer: 'Checked insurance optimizer',
  getTelegramStatus: 'Checked Telegram status',
  getWeeklySummary: 'Generated weekly summary',
}

export default function AIChat() {
  const { t } = useLang()
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [suggestions, setSuggestions] = useState([])
  const [conversationId, setConversationId] = useState(null)
  const [pendingAction, setPendingAction] = useState(null)
  const [confirmingAction, setConfirmingAction] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => {
    insightsApi.suggestions().then(res => {
      setSuggestions(res.suggestions || res || [])
    }).catch(() => {})
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, pendingAction])

  const sendMessage = async (question) => {
    if (!question.trim() || loading) return
    const q = question.trim()
    setInput('')
    setMessages(prev => [...prev, { role: 'user', text: q }])
    setLoading(true)
    setPendingAction(null)

    try {
      const res = await insightsApi.agent(q, conversationId)
      setConversationId(res.conversationId)

      // Add tool chips + AI response
      const aiMsg = {
        role: 'ai',
        text: res.response || 'No response',
        toolsUsed: res.toolsUsed || [],
      }
      setMessages(prev => [...prev, aiMsg])

      if (res.pendingAction) {
        setPendingAction(res.pendingAction)
      }
    } catch (err) {
      setMessages(prev => [...prev, { role: 'ai', text: 'Sorry, the agent could not process your request. Please try again.' }])
    }
    setLoading(false)
  }

  const handleConfirm = async (confirmed) => {
    if (!conversationId || !pendingAction || confirmingAction) return
    setConfirmingAction(true)

    // Show user's decision
    setMessages(prev => [...prev, {
      role: 'user',
      text: confirmed ? 'Approved' : 'Rejected',
    }])

    setPendingAction(null)

    try {
      const res = await insightsApi.agentConfirm(conversationId, confirmed)
      const aiMsg = {
        role: 'ai',
        text: res.response || (confirmed ? 'Action completed.' : 'Action cancelled.'),
        toolsUsed: res.toolsUsed || [],
      }
      setMessages(prev => [...prev, aiMsg])

      if (res.pendingAction) {
        setPendingAction(res.pendingAction)
      }
    } catch (err) {
      setMessages(prev => [...prev, { role: 'ai', text: 'Failed to process confirmation.' }])
    }
    setConfirmingAction(false)
  }

  const startNewConversation = () => {
    setMessages([])
    setConversationId(null)
    setPendingAction(null)
  }

  return (
    <div className="max-w-3xl mx-auto flex flex-col" style={{ height: 'calc(100vh - 120px)' }}>
      <div className="flex items-center justify-between">
        <PageHeader
          title="Fleet AI Agent"
          subtitle="Ask questions, take actions — powered by live fleet data"
        />
        {messages.length > 0 && (
          <button onClick={startNewConversation} className="text-xs text-slate-400 hover:text-slate-600 font-medium px-3 py-1.5 rounded-lg border border-slate-200 hover:border-slate-300 transition-colors">
            New Chat
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-3 mb-4">
        {messages.length === 0 && (
          <div className="text-center py-12">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center mx-auto mb-4">
              <SparkleIcon className="w-7 h-7 text-blue-500" />
            </div>
            <h3 className="text-sm font-bold text-slate-800">Fleet AI Agent</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
              I can query your fleet data, analyze performance, manage documents, resolve alerts, and more.
              Ask me anything or try a suggestion below.
            </p>

            {suggestions.length > 0 && (
              <div className="flex flex-wrap gap-2 justify-center mt-6">
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => sendMessage(s)}
                    className="px-3 py-1.5 bg-blue-50 text-blue-700 text-xs rounded-lg hover:bg-blue-100 transition-colors font-medium"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] ${msg.role === 'user' ? '' : ''}`}>
              {/* Tool execution chips */}
              {msg.role === 'ai' && msg.toolsUsed && msg.toolsUsed.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-1.5">
                  {msg.toolsUsed.map((tool, j) => (
                    <span key={j} className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-500 text-[10px] rounded-full font-medium">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      {TOOL_LABELS[tool] || tool}
                    </span>
                  ))}
                </div>
              )}

              <div className={`rounded-xl px-4 py-3 ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white border border-slate-200 text-slate-800'
              }`}>
                {msg.role === 'ai' ? <FormattedText text={msg.text} /> : <span className="text-sm">{msg.text}</span>}
              </div>
            </div>
          </div>
        ))}

        {/* Pending action confirmation card */}
        {pendingAction && !loading && (
          <div className="flex justify-start">
            <div className="max-w-[85%]">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  <span className="text-xs font-bold text-amber-800 uppercase tracking-wider">Action Requires Approval</span>
                </div>
                <div className="text-sm font-semibold text-slate-800 mb-1">
                  {pendingAction.humanReadable}
                </div>
                <div className="text-xs text-slate-500 mb-3">
                  {pendingAction.toolDescription}
                </div>
                {pendingAction.args && Object.keys(pendingAction.args).length > 0 && (
                  <div className="bg-white rounded-lg p-2.5 mb-3 border border-amber-100">
                    <div className="text-[10px] text-slate-400 uppercase font-semibold mb-1">Parameters</div>
                    {Object.entries(pendingAction.args).map(([k, v]) => (
                      <div key={k} className="flex gap-2 text-xs">
                        <span className="text-slate-400 font-mono">{k}:</span>
                        <span className="text-slate-700 truncate">{typeof v === 'object' ? JSON.stringify(v) : String(v)}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={() => handleConfirm(true)}
                    disabled={confirmingAction}
                    className="flex-1 px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
                  >
                    {confirmingAction ? 'Processing...' : 'Approve'}
                  </button>
                  <button
                    onClick={() => handleConfirm(false)}
                    disabled={confirmingAction}
                    className="flex-1 px-4 py-2 bg-slate-200 text-slate-700 text-xs font-bold rounded-lg hover:bg-slate-300 transition-colors disabled:opacity-50"
                  >
                    Reject
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-white border border-slate-200 rounded-xl px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-blue-300 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 bg-blue-300 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 bg-blue-300 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
                <span className="text-xs text-slate-400">Agent is thinking...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Suggestion chips after messages */}
      {messages.length > 0 && suggestions.length > 0 && !loading && !pendingAction && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {suggestions.slice(0, 4).map((s, i) => (
            <button key={i} onClick={() => sendMessage(s)} className="px-2.5 py-1 bg-slate-100 text-slate-600 text-xs rounded-md hover:bg-slate-200 transition-colors">
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="flex gap-2">
        <input
          type="text"
          className="inp flex-1"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage(input)}
          placeholder="Ask about your fleet or request an action..."
          disabled={loading || !!pendingAction}
        />
        <button
          onClick={() => sendMessage(input)}
          disabled={loading || !input.trim() || !!pendingAction}
          className="btn-primary"
        >
          Send
        </button>
      </div>
    </div>
  )
}

function FormattedText({ text }) {
  const lines = text.split('\n')
  return (
    <div className="text-sm space-y-1">
      {lines.map((line, i) => {
        // Bold text
        if (line.startsWith('**') && line.endsWith('**')) {
          return <div key={i} className="font-semibold text-slate-900">{line.slice(2, -2)}</div>
        }
        // Inline bold
        const boldParts = line.split(/\*\*(.*?)\*\*/g)
        const hasBold = boldParts.length > 1

        // Bullet points
        if (line.startsWith('• ') || line.startsWith('- ')) {
          return (
            <div key={i} className="flex gap-2">
              <span className="text-blue-400 shrink-0">•</span>
              <span>{hasBold ? renderBold(boldParts) : line.slice(2)}</span>
            </div>
          )
        }
        // Numbered list
        if (/^\d+\.\s/.test(line)) {
          const num = line.match(/^\d+/)[0]
          return (
            <div key={i} className="flex gap-2">
              <span className="text-blue-400 shrink-0 font-mono text-xs">{num}.</span>
              <span>{hasBold ? renderBold(boldParts) : line.replace(/^\d+\.\s/, '')}</span>
            </div>
          )
        }
        // Empty line
        if (line.trim() === '') return <div key={i} className="h-2" />
        // Regular line
        return <div key={i}>{hasBold ? renderBold(boldParts) : line}</div>
      })}
    </div>
  )
}

function renderBold(parts) {
  return parts.map((part, i) =>
    i % 2 === 1
      ? <strong key={i} className="font-semibold text-slate-900">{part}</strong>
      : <span key={i}>{part}</span>
  )
}
