import { useState, useEffect, useCallback } from 'react'
import PageHeader from '../components/PageHeader'
import { trips as tripsApi, vehicles as vehiclesApi } from '../api'

// ── Template definitions ────────────────────────────────────────────────────

const TEMPLATES = [
  {
    id: 'payment-receipt',
    label: 'Payment Receipt',
    description: 'Payment slip for driver pay, maintenance, vendor payments',
    icon: '💰',
    color: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    accent: 'bg-emerald-600',
  },
  {
    id: 'freight-invoice',
    label: 'Freight Invoice',
    description: 'Trip-based freight invoice with GST support',
    icon: '🧾',
    color: 'bg-blue-50 border-blue-200 text-blue-700',
    accent: 'bg-blue-600',
  },
  {
    id: 'letterhead',
    label: 'Letterhead',
    description: 'Company letterhead with free-text body',
    icon: '📄',
    color: 'bg-violet-50 border-violet-200 text-violet-700',
    accent: 'bg-violet-600',
  },
  {
    id: 'monthly-statement',
    label: 'Monthly Statement',
    description: 'Auto-generated revenue & expense summary',
    icon: '📊',
    color: 'bg-amber-50 border-amber-200 text-amber-700',
    accent: 'bg-amber-600',
  },
]

// ── Input component ─────────────────────────────────────────────────────────

function FormInput({ label, type = 'text', value, onChange, placeholder, disabled, required }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">
        {label} {required && <span className="text-red-400">*</span>}
      </label>
      <input
        type={type}
        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none disabled:bg-slate-50 disabled:text-slate-400"
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
      <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
      <select
        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
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
      <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
      <textarea
        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-y"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
      />
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════

export default function DocumentGenerator() {
  const [selectedTemplate, setSelectedTemplate] = useState(null)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Shared data for selectors
  const [tripsList, setTripsList] = useState([])
  const [vehiclesList, setVehiclesList] = useState([])

  // Form state for each template
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

  // Recent documents from localStorage
  const [recentDocs, setRecentDocs] = useState(() => {
    try { return JSON.parse(localStorage.getItem('fleetsure_recent_docs') || '[]') } catch { return [] }
  })

  // Load trips and vehicles for selectors
  useEffect(() => {
    tripsApi.list().then(data => {
      setTripsList(Array.isArray(data) ? data : data.trips || [])
    }).catch(() => {})
    vehiclesApi.list().then(data => {
      setVehiclesList(Array.isArray(data) ? data : data.vehicles || [])
    }).catch(() => {})
  }, [])

  // Auto-fill invoice from trip selection
  const handleTripSelect = useCallback((tripId) => {
    setInvoiceForm(prev => ({ ...prev, tripId }))
    if (!tripId) return
    const trip = tripsList.find(t => t.id === tripId)
    if (trip) {
      setInvoiceForm(prev => ({
        ...prev,
        tripId,
        origin: trip.origin || prev.origin,
        destination: trip.destination || prev.destination,
        vehicleNumber: trip.vehicle?.registrationNumber || prev.vehicleNumber,
        distance: trip.distance ? String(trip.distance) : prev.distance,
        freightAmount: trip.freightAmount ? String(trip.freightAmount) : prev.freightAmount,
        billTo: trip.partyName || prev.billTo,
      }))
    }
  }, [tripsList])

  // Flash messages
  const flash = (msg, isError = false) => {
    if (isError) { setError(msg); setSuccess('') }
    else { setSuccess(msg); setError('') }
    setTimeout(() => { setSuccess(''); setError('') }, 4000)
  }

  // Save to recent docs
  const addRecentDoc = (template, label) => {
    const entry = { template, label, date: new Date().toISOString() }
    const updated = [entry, ...recentDocs.slice(0, 9)]
    setRecentDocs(updated)
    localStorage.setItem('fleetsure_recent_docs', JSON.stringify(updated))
  }

  // ── Generate PDF ────────────────────────────────────────────────────────

  const handleGenerate = async () => {
    setGenerating(true)
    setError('')
    try {
      let url = '/api/pdf/generate'
      let body = {}

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
            body = {
              template: 'freight-invoice',
              data: {
                ...invoiceForm,
                invoiceNumber: invoiceForm.invoiceNumber || `FI-${Date.now()}`,
                freightAmount: Number(invoiceForm.freightAmount) || 0,
                gstPercent: Number(invoiceForm.gstPercent) || 0,
                distance: Number(invoiceForm.distance) || 0,
              },
            }
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

        default:
          throw new Error('Select a template first')
      }

      const res = await fetch(url, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || 'Failed to generate PDF')
      }

      const blob = await res.blob()
      const blobUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = blobUrl
      a.download = res.headers.get('Content-Disposition')?.match(/filename="(.+)"/)?.[1] || 'document.pdf'
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(blobUrl)

      const templateDef = TEMPLATES.find(t => t.id === selectedTemplate)
      addRecentDoc(selectedTemplate, templateDef?.label || selectedTemplate)
      flash(`${templateDef?.label || 'PDF'} downloaded successfully!`)
    } catch (err) {
      flash(err.message, true)
    } finally {
      setGenerating(false)
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <div>
      <PageHeader title="Documents" subtitle="Generate professional PDF documents for your fleet" />

      {/* Flash messages */}
      {success && <div className="bg-emerald-50 text-emerald-700 text-sm rounded-lg px-4 py-2 mb-4 border border-emerald-200">{success}</div>}
      {error && <div className="bg-red-50 text-red-700 text-sm rounded-lg px-4 py-2 mb-4 border border-red-100">{error}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── LEFT: Template selector + form ── */}
        <div className="lg:col-span-2 space-y-5">
          {/* Template cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {TEMPLATES.map(tmpl => (
              <button
                key={tmpl.id}
                onClick={() => setSelectedTemplate(tmpl.id)}
                className={`relative rounded-xl border-2 p-4 text-left transition-all hover:shadow-md ${
                  selectedTemplate === tmpl.id
                    ? 'border-blue-500 bg-blue-50 shadow-md ring-2 ring-blue-200'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="text-2xl mb-2">{tmpl.icon}</div>
                <div className="text-sm font-bold text-slate-900">{tmpl.label}</div>
                <div className="text-[11px] text-slate-500 mt-1 leading-tight">{tmpl.description}</div>
                {selectedTemplate === tmpl.id && (
                  <div className={`absolute top-2 right-2 w-2.5 h-2.5 rounded-full ${tmpl.accent}`} />
                )}
              </button>
            ))}
          </div>

          {/* Dynamic form */}
          {selectedTemplate && (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    {TEMPLATES.find(t => t.id === selectedTemplate)?.label} Details
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">Fill in the details below</p>
                </div>
                <button
                  onClick={handleGenerate}
                  disabled={generating}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white text-sm font-bold rounded-lg px-5 py-2 transition flex items-center gap-2"
                >
                  {generating ? (
                    <>
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                      Generating...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                      Download PDF
                    </>
                  )}
                </button>
              </div>

              <div className="px-5 py-5">
                {/* Payment Receipt Form */}
                {selectedTemplate === 'payment-receipt' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormInput label="Receipt Number" value={paymentForm.receiptNumber} onChange={v => setPaymentForm(p => ({ ...p, receiptNumber: v }))} placeholder="Auto-generated if empty" />
                    <FormInput label="Date" type="date" value={paymentForm.date} onChange={v => setPaymentForm(p => ({ ...p, date: v }))} />
                    <FormInput label="Paid To" value={paymentForm.paidTo} onChange={v => setPaymentForm(p => ({ ...p, paidTo: v }))} placeholder="Driver name, vendor, etc." required />
                    <FormInput label="Amount (₹)" type="number" value={paymentForm.amount} onChange={v => setPaymentForm(p => ({ ...p, amount: v }))} placeholder="0.00" required />
                    <FormInput label="Purpose" value={paymentForm.purpose} onChange={v => setPaymentForm(p => ({ ...p, purpose: v }))} placeholder="Driver salary, maintenance, etc." />
                    <FormSelect label="Payment Mode" value={paymentForm.paymentMode} onChange={v => setPaymentForm(p => ({ ...p, paymentMode: v }))} options={[
                      { value: 'Cash', label: 'Cash' },
                      { value: 'UPI', label: 'UPI' },
                      { value: 'Bank Transfer', label: 'Bank Transfer / NEFT' },
                      { value: 'Cheque', label: 'Cheque' },
                    ]} />
                    <FormInput label="Reference / Txn No." value={paymentForm.referenceNumber} onChange={v => setPaymentForm(p => ({ ...p, referenceNumber: v }))} placeholder="Optional" />
                    <div className="sm:col-span-2">
                      <FormTextarea label="Notes" value={paymentForm.notes} onChange={v => setPaymentForm(p => ({ ...p, notes: v }))} placeholder="Any additional notes..." rows={3} />
                    </div>
                  </div>
                )}

                {/* Freight Invoice Form */}
                {selectedTemplate === 'freight-invoice' && (
                  <div className="space-y-4">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-xs text-blue-700">
                      <strong>Tip:</strong> Select a trip to auto-fill details, or enter manually below.
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <FormSelect
                        label="Auto-fill from Trip"
                        value={invoiceForm.tripId}
                        onChange={handleTripSelect}
                        options={tripsList.map(t => ({
                          value: t.id,
                          label: `${t.origin} → ${t.destination} (${t.vehicle?.registrationNumber || 'N/A'}) ${t.freightAmount ? '₹' + Number(t.freightAmount).toLocaleString('en-IN') : ''}`,
                        }))}
                        placeholder="Select a trip (optional)..."
                      />
                      <FormInput label="Invoice Number" value={invoiceForm.invoiceNumber} onChange={v => setInvoiceForm(p => ({ ...p, invoiceNumber: v }))} placeholder="Auto-generated if empty" />
                      <FormInput label="Date" type="date" value={invoiceForm.date} onChange={v => setInvoiceForm(p => ({ ...p, date: v }))} />
                      <FormInput label="Bill To (Party Name)" value={invoiceForm.billTo} onChange={v => setInvoiceForm(p => ({ ...p, billTo: v }))} placeholder="Customer / party name" required />
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

                {/* Letterhead Form */}
                {selectedTemplate === 'letterhead' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

                {/* Monthly Statement Form */}
                {selectedTemplate === 'monthly-statement' && (
                  <div className="space-y-4">
                    <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-xs text-amber-700">
                      <strong>Auto-generated:</strong> All trips, revenue, and expenses in the selected date range will be pulled automatically.
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <FormInput label="Start Date" type="date" value={statementForm.startDate} onChange={v => setStatementForm(p => ({ ...p, startDate: v }))} required />
                      <FormInput label="End Date" type="date" value={statementForm.endDate} onChange={v => setStatementForm(p => ({ ...p, endDate: v }))} required />
                      <FormSelect
                        label="Filter by Vehicle"
                        value={statementForm.vehicleId}
                        onChange={v => setStatementForm(p => ({ ...p, vehicleId: v }))}
                        options={vehiclesList.map(v => ({
                          value: v.id,
                          label: v.registrationNumber || v.id,
                        }))}
                        placeholder="All vehicles"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* No template selected prompt */}
          {!selectedTemplate && (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
              <div className="text-4xl mb-3">📑</div>
              <h3 className="text-sm font-bold text-slate-900 mb-1">Select a template to get started</h3>
              <p className="text-xs text-slate-500">Choose a document type above, fill in the details, and download your PDF.</p>
            </div>
          )}
        </div>

        {/* ── RIGHT: Recent downloads ── */}
        <div className="space-y-5">
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">Recent Downloads</h3>
              <p className="text-xs text-slate-500 mt-0.5">Last 10 generated documents</p>
            </div>
            <div className="px-5 py-3">
              {recentDocs.length === 0 ? (
                <p className="text-xs text-slate-400 py-4 text-center">No documents generated yet</p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {recentDocs.map((doc, i) => (
                    <div key={i} className="py-2.5 flex items-center gap-3">
                      <div className="text-lg">
                        {TEMPLATES.find(t => t.id === doc.template)?.icon || '📄'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-slate-900 truncate">{doc.label}</div>
                        <div className="text-[10px] text-slate-400">
                          {new Date(doc.date).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Tips */}
          <div className="bg-slate-50 rounded-xl border border-slate-200 p-5">
            <h4 className="text-xs font-bold text-slate-700 mb-3">Quick Tips</h4>
            <ul className="space-y-2 text-[11px] text-slate-500 leading-relaxed">
              <li className="flex gap-2"><span>•</span> Update company details in <strong>Settings → Company</strong> for branded headers</li>
              <li className="flex gap-2"><span>•</span> Freight Invoice can auto-fill from an existing trip</li>
              <li className="flex gap-2"><span>•</span> Monthly Statement pulls all trips and expenses automatically</li>
              <li className="flex gap-2"><span>•</span> Add your GSTIN in Settings for GST-compliant invoices</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
