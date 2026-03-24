import { useState, useEffect } from 'react'
import { invoices as invoiceApi } from '../api'

export default function Invoices() {
  const [invoices, setInvoices] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadInvoices()
  }, [])

  const loadInvoices = async () => {
    try {
      const data = await invoiceApi.list()
      setInvoices(data)
    } catch (err) {
      console.error('Failed to load invoices:', err)
    } finally {
      setLoading(false)
    }
  }

  const printInvoice = (inv) => {
    const printWindow = window.open('', '_blank')
    printWindow.document.write(`
      <html>
      <head>
        <title>Invoice #${inv.id.split('-')[0]}</title>
        <style>
          body { font-family: 'Inter', system-ui, sans-serif; padding: 0; margin: 0; color: #1e293b; line-height: 1.6; background: #f8fafc; }
          .invoice-container { background: white; max-width: 800px; margin: 40px auto; padding: 40px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); border-radius: 12px; }
          .notepad-header { background: #0f172a; color: white; padding: 35px 40px; margin: -40px -40px 40px -40px; border-radius: 12px 12px 0 0; display: flex; justify-content: space-between; align-items: center; border-bottom: 8px solid #f59e0b; }
          .brand h1 { margin: 0; font-size: 28px; font-weight: 800; letter-spacing: -1px; }
          .brand p { margin: 5px 0 0 0; opacity: 0.7; font-size: 13px; font-weight: 500; }
          .invoice-badge { background: rgba(245,158,11,0.2); color: #fbbf24; padding: 8px 16px; border-radius: 6px; font-weight: 800; font-size: 16px; letter-spacing: 1px; border: 1px solid rgba(245,158,11,0.3); }
          
          .meta-row { display: flex; justify-content: space-between; margin-bottom: 40px; padding-bottom: 25px; border-bottom: 1px solid #e2e8f0; }
          .meta-block strong { color: #64748b; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; display: block; margin-bottom: 5px; }
          .meta-block div { font-size: 15px; font-weight: 600; color: #0f172a; }
          
          .details { margin-bottom: 40px; display: grid; grid-template-columns: 1fr 1fr; gap: 40px; background: #f8fafc; padding: 25px; border-radius: 10px; border: 1px solid #e2e8f0; }
          .details strong { font-size: 11px; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px; display: block; margin-bottom: 8px; }
          
          table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
          th, td { padding: 16px 12px; text-align: right; border-bottom: 1px solid #f1f5f9; }
          th { text-align: left; background: #f8fafc; font-weight: 700; color: #475569; text-transform: uppercase; font-size: 11px; letter-spacing: 1px; }
          td:first-child, th:first-child { text-align: left; }
          .summary-card { width: 300px; float: right; background: #0f172a; color: white; padding: 20px; border-radius: 10px; margin-top: 20px; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1); }
          .total-row { display: flex; justify-content: space-between; align-items: center; font-size: 20px; font-weight: 800; }
          .total-label { color: rgba(255,255,255,0.6); font-size: 12px; text-transform: uppercase; }
          
          .badge { display: inline-block; padding: 4px 12px; border-radius: 6px; font-size: 12px; font-weight: 700; text-transform: uppercase; }
          .paid { background: #dcfce7; color: #166534; }
          .pending { background: #fef9c3; color: #854d0e; }
          
          @media print {
            body { background: white; }
            .invoice-container { box-shadow: none; margin: 0; padding: 20px; max-width: 100%; }
            .summary-card { color: black; background: #f1f5f9; box-shadow: none; float: right; }
            .total-label { color: #64748b; }
          }
        </style>
      </head>
      <body>
        <div class="invoice-container">
          <div class="notepad-header">
            <div class="brand">
              <h1>FLEETSURE</h1>
              <p>Har Gaadi. Hamesha Tayyar.</p>
            </div>
            <div class="invoice-badge">INVOICE</div>
          </div>
          
          <div class="meta-row">
            <div class="meta-block">
              <strong>Invoice #</strong>
              <div>${inv.id.split('-')[0].toUpperCase()}</div>
            </div>
            <div class="meta-block">
              <strong>Date Issued</strong>
              <div>${new Date(inv.createdAt).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
            </div>
            <div class="meta-block" style="text-align: right;">
              <strong>Status</strong>
              <div style="margin-top: 5px;"><span class="badge ${inv.paymentStatus === 'PAID' ? 'paid' : 'pending'}">${inv.paymentStatus}</span></div>
            </div>
          </div>
        
          <div class="details">
            <div>
              <strong>Service For:</strong>
              <div style="font-size: 16px; font-weight: 700; color: #0f172a;">${inv.tenant?.name || 'Your Fleet'}</div>
              <div style="font-size: 14px; color: #475569; margin-top: 4px;">Vehicle: <span style="font-family: monospace; font-weight: 700;">${inv.job?.vehicle?.vehicleNumber || 'N/A'}</span></div>
            </div>
            <div style="text-align: right;">
              <strong>Service Provider:</strong>
              <div style="font-size: 14px; font-weight: 700; color: #0f172a;">${inv.job?.workshop?.name || 'Fleetsure Network Workshop'}</div>
              <div style="font-size: 13px; color: #475569; margin-top: 4px;">Job ID: ${inv.jobId.split('-')[0].toUpperCase()}</div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Description</th>
                <th style="text-align: right">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Spare Parts Subtotal (Filters, Brake Pads, Consumables)</td>
                <td>₹${inv.partsTotal.toLocaleString('en-IN')}</td>
              </tr>
              <tr>
                <td>Labor & Service Charges</td>
                <td>₹${inv.laborTotal.toLocaleString('en-IN')}</td>
              </tr>
            </tbody>
          </table>

          <div class="summary-card">
            <div class="total-row">
              <span class="total-label">Grand Total</span>
              <span>₹${inv.totalAmount.toLocaleString('en-IN')}</span>
            </div>
          </div>
          
          <div style="clear: both; margin-top: 100px; text-align: center; color: #94a3b8; font-size: 11px; padding-top: 30px; border-top: 1px solid #f1f5f9;">
            Questions? Contact Fleetsure Support via WhatsApp at +91 91118 04380<br>
            Generated on ${new Date().toLocaleString()}
          </div>
        </div>
      </body>
      </html>
    `)
    printWindow.document.close()
    setTimeout(() => printWindow.print(), 500)
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900"></div>
      </div>
    )
  }

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Invoices & Billing</h1>
        <p className="text-slate-500 mt-1">Manage your service invoices and payment history.</p>
      </div>

      <div className="grid gap-6">
        {invoices.length > 0 ? (
          invoices.map(inv => (
            <div key={inv.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
              <div className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-900 font-mono uppercase">INV-{inv.id.split('-')[0]}</div>
                    <div className="text-xs text-slate-500">{new Date(inv.createdAt).toLocaleDateString(undefined, { dateStyle: 'long' })}</div>
                  </div>
                </div>

                <div className="flex-1 md:px-8">
                  <div className="text-sm font-semibold text-slate-700">Vehicle: <span className="font-mono text-slate-900">{inv.job?.vehicle?.vehicleNumber || 'N/A'}</span></div>
                  <div className="text-xs text-slate-500 mt-0.5">Job: {inv.issueDescription || 'Regular Service'}</div>
                </div>

                <div className="text-right">
                  <div className="text-xl font-black text-slate-900">₹{inv.totalAmount.toLocaleString('en-IN')}</div>
                  <div className={`text-[10px] font-bold uppercase tracking-wider mt-1 inline-block px-2 py-0.5 rounded ${inv.paymentStatus === 'PAID' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                    {inv.paymentStatus}
                  </div>
                </div>

                <div className="flex items-center gap-2 md:pl-4 border-t md:border-t-0 md:border-l border-slate-100 pt-4 md:pt-0">
                  <button
                    onClick={() => printInvoice(inv)}
                    className="flex-1 md:flex-none px-4 py-2 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-slate-800 transition-colors flex items-center justify-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                    </svg>
                    Print PDF
                  </button>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 p-12 text-center">
            <div className="text-slate-400 mb-2">No invoices found</div>
            <p className="text-sm text-slate-500">Invoices will appear here once your service jobs are completed.</p>
          </div>
        )}
      </div>
    </div>
  )
}
