import { useState, useEffect, useCallback } from 'react'
import { trips as tripsApi, vehicles as vehiclesApi } from '../api'

// ── SVG Icons for templates ─────────────────────────────────────────────────

const ReceiptIcon = (p) => (
  <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z" />
    <path d="M8 8h8M8 12h8M8 16h4" />
  </svg>
)

const InvoiceIcon = (p) => (
  <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <path d="M7 7h10M7 11h10M7 15h6" />
    <path d="M16 15l1 1 2-3" />
  </svg>
)

const LetterIcon = (p) => (
  <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
    <path d="M14 2v6h6M8 13h8M8 17h8M8 9h2" />
  </svg>
)

const StatementIcon = (p) => (
  <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
    <path d="M14 2v6h6" />
    <path d="M8 18v-4M12 18v-6M16 18v-2" />
  </svg>
)

const DownloadIcon = (p) => (
  <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
)

// ── Template definitions ────────────────────────────────────────────────────

const TEMPLATES = [
  {
    id: 'payment-receipt',
    label: 'Payment Receipt',
    description: 'Driver payments, maintenance bills, vendor settlements',
    icon: ReceiptIcon,
    color: 'emerald',
    tag: 'PAYMENTS',
  },
  {
    id: 'freight-invoice',
    label: 'Freight Invoice',
    description: 'GST-compliant freight billing with auto-fill from trips',
    icon: InvoiceIcon,
    color: 'blue',
    tag: 'BILLING',
  },
  {
    id: 'letterhead',
    label: 'Company Letter',
    description: 'Professional letterhead with your company branding',
    icon: LetterIcon,
    color: 'violet',
    tag: 'CORRESPONDENCE',
  },
  {
    id: 'monthly-statement',
    label: 'Monthly Statement',
    description: 'Revenue, expenses & vehicle-wise P&L breakdown',
    icon: StatementIcon,
    color: 'amber',
    tag: 'REPORTS',
  },
]

const COLOR_MAP = {
  emerald: { bg: 'bg-emerald-500', light: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-200', ring: 'ring-emerald-500' },
  blue:    { bg: 'bg-blue-500',    light: 'bg-blue-50',    text: 'text-blue-600',    border: 'border-blue-200',    ring: 'ring-blue-500' },
  violet:  { bg: 'bg-violet-500',  light: 'bg-violet-50',  text: 'text-violet-600',  border: 'border-violet-200',  ring: 'ring-violet-500' },
  amber:   { bg: 'bg-amber-500',   light: 'bg-amber-50',   text: 'text-amber-600',   border: 'border-amber-200',   ring: 'ring-amber-500' },
}

// ── Form components ─────────────────────────────────────────────────────────

function FormInput({ label, type = 'text', value, onChange, placeholder, disabled, required }) {
  return (
    <div>
      <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
        {label} {required && <span className="text-red-400">*</span>}
      </label>
      <input
        type={type}
        className="w-full border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-300 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition-all disabled:bg-slate-50 disabled:text-slate-400"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
      />
    </div>
  )
}

function FormSelect({ label, value, onChange, options, placeholder }) {
  return (
    <div>
      <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">{label}</label>
      <select
        className="w-full border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm text-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none bg-white transition-all"
        value={value}
        onChange={e => onChange(e.target.value)}
      >
        <option value="">{placeholder || 'Select...'}</option>
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  )
}

function FormTextarea({ label, value, onChange, placeholder, rows = 6 }) {
  return (
    <div>
      <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">{label}</label>
      <textarea
        className="w-full border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-300 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none resize-y transition-all"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
      />
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// DOCUMENT SUITE
// ═══════════════════════════════════════════════════════════════════════════

export default function DocumentGenerator() {
  const [selectedTemplate, setSelectedTemplate] = useState(null)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [tripsList, setTripsList] = useState([])
  const [vehiclesList, setVehiclesList] = useState([])

  const [paymentForm, setPaymentForm] = useState({
    receiptNumber: '', date: new Date().toISOString().slice(0, 10), paidTo: '',
    amount: '', purpose: '', paymentMode: 'Cash', referenceNumber: '', notes: '',
  })
  const [invoiceForm, setInvoiceForm] = useState({
    invoiceNumber: '', date: new Date().toISOString().slice(0, 10), billTo: '',
    billToAddress: '', tripId: '', origin: '', destination: '', vehicleNumber: '',
    distance: '', freightAmount: '', gstPercent: '5', notes: '',
  })
  const [letterForm, setLetterForm] = useState({
    date: new Date().toISOString().slice(0, 10), referenceNumber: '', to: '',
    subject: '', body: '',
  })
  const [statementForm, setStatementForm] = useState({
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10),
    endDate: new Date().toISOString().slice(0, 10),
    vehicleId: '',
  })

  const [recentDocs, setRecentDocs] = useState(() => {
    try { return JSON.parse(localStorage.getItem('fleetsure_recent_docs') || '[]') } catch { return [] }
  })

  useEffect(() => {
    tripsApi.list().then(data => setTripsList(Array.isArray(data) ? data : data.trips || [])).catch(() => {})
    vehiclesApi.list().then(data => setVehiclesList(Array.isArray(data) ? data : data.vehicles || [])).catch(() => {})
  }, [])

  const handleTripSelect = useCallback((tripId) => {
    setInvoiceForm(prev => ({ ...prev, tripId }))
    if (!tripId) return
    const trip = tripsList.find(t => t.id === tripId)
    if (trip) {
      setInvoiceForm(prev => ({
        ...prev, tripId,
        origin: trip.origin || prev.origin,
        destination: trip.destination || prev.destination,
        vehicleNumber: trip.vehicle?.registrationNumber || prev.vehicleNumber,
        distance: trip.distance ? String(trip.distance) : prev.distance,
        freightAmount: trip.freightAmount ? String(trip.freightAmount) : prev.freightAmount,
        billTo: trip.partyName || prev.billTo,
      }))
    }
  }, [tripsList])

  const flash = (msg, isError = false) => {
    if (isError) { setError(msg); setSuccess('') } else { setSuccess(msg); setError('') }
    setTimeout(() => { setSuccess(''); setError('') }, 4000)
  }

  const addRecentDoc = (template, label) => {
    const entry = { template, label, date: new Date().toISOString() }
    const updated = [entry, ...recentDocs.slice(0, 9)]
    setRecentDocs(updated)
    localStorage.setItem('fleetsure_recent_docs', JSON.stringify(updated))
  }

  // ── Generate PDF ──────────────────────────────────────────────────────────

  const handleGenerate = async () => {
    setGenerating(true); setError('')
    try {
      let url = '/api/pdf/generate', body = {}
      switch (selectedTemplate) {
        case 'payment-receipt':
          if (!paymentForm.paidTo || !paymentForm.amount) throw new Error('Paid To and Amount are required')
          body = { template: 'payment-receipt', data: { ...paymentForm, receiptNumber: paymentForm.receiptNumber || `PR-${Date.now()}` } }
          break
        case 'freight-invoice':
          if (invoiceForm.tripId) {
            url = `/api/pdf/generate/trip-invoice/${invoiceForm.tripId}`
            body = { billTo: invoiceForm.billTo, billToAddress: invoiceForm.billToAddress, gstPercent: Number(invoiceForm.gstPercent) || 0, notes: invoiceForm.notes }
          } else {
            if (!invoiceForm.freightAmount) throw new Error('Freight amount is required')
            body = { template: 'freight-invoice', data: { ...invoiceForm, invoiceNumber: invoiceForm.invoiceNumber || `FI-${Date.now()}`, freightAmount: Number(invoiceForm.freightAmount) || 0, gstPercent: Number(invoiceForm.gstPercent) || 0, distance: Number(invoiceForm.distance) || 0 } }
          }
          break
        case 'letterhead':
          if (!letterForm.body) throw new Error('Letter body is required')
          body = { template: 'letterhead', data: letterForm }
          break
        case 'monthly-statement':
          if (!statementForm.startDate || !statementForm.endDate) throw new Error('Date range is required')
          url = '/api/pdf/generate/statement'
          body = { ...statementForm }
          break
        default: throw new Error('Select a template first')
      }
      const res = await fetch(url, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (!res.ok) { const errData = await res.json().catch(() => ({})); throw new Error(errData.error || 'Failed to generate PDF') }
      const blob = await res.blob()
      const blobUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = blobUrl
      a.download = res.headers.get('Content-Disposition')?.match(/filename="(.+)"/)?.[1] || 'document.pdf'
      document.body.appendChild(a); a.click(); a.remove()
      URL.revokeObjectURL(blobUrl)
      const templateDef = TEMPLATES.find(t => t.id === selectedTemplate)
      addRecentDoc(selectedTemplate, templateDef?.label || selectedTemplate)
      flash(`${templateDef?.label || 'PDF'} downloaded successfully!`)
    } catch (err) { flash(err.message, true) } finally { setGenerating(false) }
  }

  const selectedTmpl = TEMPLATES.find(t => t.id === selectedTemplate)
  const colors = selectedTmpl ? COLOR_MAP[selectedTmpl.color] : null

  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <div className="min-h-[80vh]">
      {/* ── Suite Header ──────────────────────────────────────────────────── */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 rounded-xl bg-slate-900 flex items-center justify-center">
            <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
              <path d="M14 2v6h6" />
            </svg>
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900 tracking-tight">Document Suite</h1>
            <p className="text-xs text-slate-400">Professional PDF documents for your fleet operations</p>
          </div>
        </div>
      </div>

      {/* Flash messages */}
      {success && (
        <div className="mb-5 flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
          <svg className="w-5 h-5 text-emerald-500 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          <span className="text-sm font-medium text-emerald-800">{success}</span>
        </div>
      )}
      {error && (
        <div className="mb-5 flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <svg className="w-5 h-5 text-red-500 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          <span className="text-sm font-medium text-red-800">{error}</span>
        </div>
      )}

      {/* ── Template Selector ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {TEMPLATES.map(tmpl => {
          const c = COLOR_MAP[tmpl.color]
          const isActive = selectedTemplate === tmpl.id
          const Icon = tmpl.icon
          return (
            <button
              key={tmpl.id}
              onClick={() => setSelectedTemplate(tmpl.id)}
              className={`relative group rounded-xl border-2 p-0 text-left overflow-hidden transition-all duration-200 ${
                isActive
                  ? `border-slate-900 shadow-lg ring-1 ${c.ring}`
                  : 'border-slate-100 bg-white hover:border-slate-200 hover:shadow-md'
              }`}
            >
              {/* Top accent */}
              <div className={`h-1 ${isActive ? c.bg : 'bg-slate-100 group-hover:bg-slate-200'} transition-colors`} />

              <div className="px-4 pt-4 pb-4">
                {/* Tag */}
                <span className={`inline-block text-[9px] font-bold uppercase tracking-widest mb-3 ${isActive ? c.text : 'text-slate-300'}`}>
                  {tmpl.tag}
                </span>

                {/* Icon + Title */}
                <div className="flex items-center gap-3 mb-2">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${isActive ? c.light : 'bg-slate-50 group-hover:bg-slate-100'}`}>
                    <Icon className={`w-5 h-5 transition-colors ${isActive ? c.text : 'text-slate-400 group-hover:text-slate-500'}`} />
                  </div>
                  <h3 className={`text-sm font-bold ${isActive ? 'text-slate-900' : 'text-slate-700'}`}>{tmpl.label}</h3>
                </div>

                <p className="text-[11px] text-slate-400 leading-relaxed">{tmpl.description}</p>
              </div>

              {/* Active indicator */}
              {isActive && (
                <div className="absolute top-3 right-3">
                  <div className={`w-5 h-5 rounded-full ${c.bg} flex items-center justify-center`}>
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                  </div>
                </div>
              )}
            </button>
          )
        })}
      </div>

      {/* ── Main Content Area ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── LEFT: Form ── */}
        <div className="lg:col-span-2">
          {selectedTemplate ? (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              {/* Form header */}
              <div className={`px-6 py-5 border-b border-slate-100 flex items-center justify-between`}>
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg ${colors.light} flex items-center justify-center`}>
                    <selectedTmpl.icon className={`w-4 h-4 ${colors.text}`} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">{selectedTmpl.label}</h3>
                    <p className="text-[11px] text-slate-400">Complete the fields below to generate your document</p>
                  </div>
                </div>
                <button
                  onClick={handleGenerate}
                  disabled={generating}
                  className={`${generating ? 'bg-slate-300' : 'bg-slate-900 hover:bg-slate-800'} text-white text-sm font-semibold rounded-xl px-6 py-2.5 transition-all flex items-center gap-2 shadow-sm`}
                >
                  {generating ? (
                    <>
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                      Generating...
                    </>
                  ) : (
                    <>
                      <DownloadIcon className="w-4 h-4" />
                      Generate PDF
                    </>
                  )}
                </button>
              </div>

              {/* Form body */}
              <div className="px-6 py-6">
                {selectedTemplate === 'payment-receipt' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <FormInput label="Receipt Number" value={paymentForm.receiptNumber} onChange={v => setPaymentForm(p => ({ ...p, receiptNumber: v }))} placeholder="Auto-generated if empty" />
                    <FormInput label="Date" type="date" value={paymentForm.date} onChange={v => setPaymentForm(p => ({ ...p, date: v }))} />
                    <FormInput label="Paid To" value={paymentForm.paidTo} onChange={v => setPaymentForm(p => ({ ...p, paidTo: v }))} placeholder="Driver name, vendor, etc." required />
                    <FormInput label="Amount (₹)" type="number" value={paymentForm.amount} onChange={v => setPaymentForm(p => ({ ...p, amount: v }))} placeholder="0.00" required />
                    <FormInput label="Purpose" value={paymentForm.purpose} onChange={v => setPaymentForm(p => ({ ...p, purpose: v }))} placeholder="Driver salary, maintenance, etc." />
                    <FormSelect label="Payment Mode" value={paymentForm.paymentMode} onChange={v => setPaymentForm(p => ({ ...p, paymentMode: v }))} options={[
                      { value: 'Cash', label: 'Cash' }, { value: 'UPI', label: 'UPI' },
                      { value: 'Bank Transfer', label: 'Bank Transfer / NEFT' }, { value: 'Cheque', label: 'Cheque' },
                    ]} />
                    <FormInput label="Reference / Txn No." value={paymentForm.referenceNumber} onChange={v => setPaymentForm(p => ({ ...p, referenceNumber: v }))} placeholder="Optional" />
                    <div className="sm:col-span-2">
                      <FormTextarea label="Notes" value={paymentForm.notes} onChange={v => setPaymentForm(p => ({ ...p, notes: v }))} placeholder="Any additional notes..." rows={3} />
                    </div>
                  </div>
                )}

                {selectedTemplate === 'freight-invoice' && (
                  <div className="space-y-5">
                    <div className="flex items-center gap-3 bg-blue-50/60 border border-blue-100 rounded-xl px-4 py-3">
                      <svg className="w-4 h-4 text-blue-500 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      <span className="text-xs text-blue-700">Select a trip to auto-fill, or enter details manually</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      <FormSelect label="Auto-fill from Trip" value={invoiceForm.tripId} onChange={handleTripSelect}
                        options={tripsList.map(t => ({ value: t.id, label: `${t.origin} → ${t.destination} (${t.vehicle?.registrationNumber || 'N/A'}) ${t.freightAmount ? '₹' + Number(t.freightAmount).toLocaleString('en-IN') : ''}` }))}
                        placeholder="Select a trip (optional)..." />
                      <FormInput label="Invoice Number" value={invoiceForm.invoiceNumber} onChange={v => setInvoiceForm(p => ({ ...p, invoiceNumber: v }))} placeholder="Auto-generated if empty" />
                      <FormInput label="Date" type="date" value={invoiceForm.date} onChange={v => setInvoiceForm(p => ({ ...p, date: v }))} />
                      <FormInput label="Bill To (Party)" value={invoiceForm.billTo} onChange={v => setInvoiceForm(p => ({ ...p, billTo: v }))} placeholder="Customer / party name" required />
                      <div className="sm:col-span-2">
                        <FormInput label="Bill To Address" value={invoiceForm.billToAddress} onChange={v => setInvoiceForm(p => ({ ...p, billToAddress: v }))} placeholder="Address (optional)" />
                      </div>
                      <FormInput label="Origin" value={invoiceForm.origin} onChange={v => setInvoiceForm(p => ({ ...p, origin: v }))} placeholder="Mumbai" />
                      <FormInput label="Destination" value={invoiceForm.destination} onChange={v => setInvoiceForm(p => ({ ...p, destination: v }))} placeholder="Delhi" />
                      <FormInput label="Vehicle Number" value={invoiceForm.vehicleNumber} onChange={v => setInvoiceForm(p => ({ ...p, vehicleNumber: v }))} placeholder="MH-12-AB-1234" />
                      <FormInput label="Distance (km)" type="number" value={invoiceForm.distance} onChange={v => setInvoiceForm(p => ({ ...p, distance: v }))} placeholder="0" />
                      <FormInput label="Freight Amount (₹)" type="number" value={invoiceForm.freightAmount} onChange={v => setInvoiceForm(p => ({ ...p, freightAmount: v }))} placeholder="0" required />
                      <FormInput label="GST %" type="number" value={invoiceForm.gstPercent} onChange={v => setInvoiceForm(p => ({ ...p, gstPercent: v }))} placeholder="5" />
                      <div className="sm:col-span-2">
                        <FormTextarea label="Notes" value={invoiceForm.notes} onChange={v => setInvoiceForm(p => ({ ...p, notes: v }))} placeholder="Payment terms, bank details, etc." rows={3} />
                      </div>
                    </div>
                  </div>
                )}

                {selectedTemplate === 'letterhead' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <FormInput label="Date" type="date" value={letterForm.date} onChange={v => setLetterForm(p => ({ ...p, date: v }))} />
                    <FormInput label="Reference Number" value={letterForm.referenceNumber} onChange={v => setLetterForm(p => ({ ...p, referenceNumber: v }))} placeholder="Optional" />
                    <div className="sm:col-span-2">
                      <FormInput label="To" value={letterForm.to} onChange={v => setLetterForm(p => ({ ...p, to: v }))} placeholder="Recipient name / address" />
                    </div>
                    <div className="sm:col-span-2">
                      <FormInput label="Subject" value={letterForm.subject} onChange={v => setLetterForm(p => ({ ...p, subject: v }))} placeholder="Subject of the letter" />
                    </div>
                    <div className="sm:col-span-2">
                      <FormTextarea label="Body" value={letterForm.body} onChange={v => setLetterForm(p => ({ ...p, body: v }))} placeholder="Type your letter content here..." rows={12} />
                    </div>
                  </div>
                )}

                {selectedTemplate === 'monthly-statement' && (
                  <div className="space-y-5">
                    <div className="flex items-center gap-3 bg-amber-50/60 border border-amber-100 rounded-xl px-4 py-3">
                      <svg className="w-4 h-4 text-amber-500 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      <span className="text-xs text-amber-700">All trips, revenue & expenses in the date range will be pulled automatically</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                      <FormInput label="Start Date" type="date" value={statementForm.startDate} onChange={v => setStatementForm(p => ({ ...p, startDate: v }))} required />
                      <FormInput label="End Date" type="date" value={statementForm.endDate} onChange={v => setStatementForm(p => ({ ...p, endDate: v }))} required />
                      <FormSelect label="Filter by Vehicle" value={statementForm.vehicleId} onChange={v => setStatementForm(p => ({ ...p, vehicleId: v }))}
                        options={vehiclesList.map(v => ({ value: v.id, label: v.registrationNumber || v.id }))} placeholder="All vehicles" />
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* ── Empty state ── */
            <div className="bg-white rounded-2xl border border-dashed border-slate-200 flex flex-col items-center justify-center py-20 px-8">
              <div className="w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center mb-5">
                <svg className="w-8 h-8 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
                  <path d="M14 2v6h6M12 18v-6M9 15l3-3 3 3" />
                </svg>
              </div>
              <h3 className="text-base font-bold text-slate-900 mb-1">Choose a document template</h3>
              <p className="text-sm text-slate-400 text-center max-w-sm">Select one of the templates above to start creating a professional PDF document for your fleet.</p>
            </div>
          )}
        </div>

        {/* ── RIGHT: Sidebar ── */}
        <div className="space-y-5">
          {/* Recent Documents */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-50 bg-slate-50/50">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Recent Documents</h3>
            </div>
            <div className="px-4 py-3">
              {recentDocs.length === 0 ? (
                <div className="text-center py-8">
                  <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center mx-auto mb-2">
                    <svg className="w-5 h-5 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
                  </div>
                  <p className="text-xs text-slate-400">No documents yet</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {recentDocs.map((doc, i) => {
                    const tmpl = TEMPLATES.find(t => t.id === doc.template)
                    const c = tmpl ? COLOR_MAP[tmpl.color] : null
                    const Icon = tmpl?.icon || LetterIcon
                    return (
                      <div key={i} className="flex items-center gap-3 px-2 py-2.5 rounded-lg hover:bg-slate-50 transition-colors">
                        <div className={`w-8 h-8 rounded-lg ${c?.light || 'bg-slate-50'} flex items-center justify-center flex-shrink-0`}>
                          <Icon className={`w-4 h-4 ${c?.text || 'text-slate-400'}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-semibold text-slate-800 truncate">{doc.label}</div>
                          <div className="text-[10px] text-slate-400">
                            {new Date(doc.date).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Quick Guide */}
          <div className="bg-slate-900 rounded-2xl p-5 text-white">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">Quick Guide</h4>
            <div className="space-y-3">
              {[
                { step: '1', text: 'Choose a document template above' },
                { step: '2', text: 'Fill in the required details' },
                { step: '3', text: 'Click "Generate PDF" to download' },
              ].map(s => (
                <div key={s.step} className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-[10px] font-bold text-white/70">{s.step}</span>
                  </div>
                  <span className="text-xs text-slate-300 leading-relaxed">{s.text}</span>
                </div>
              ))}
            </div>
            <div className="mt-5 pt-4 border-t border-white/10">
              <p className="text-[10px] text-slate-500 leading-relaxed">
                Update your company name, address & GSTIN in <strong className="text-slate-400">Settings → Company</strong> for branded document headers.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
