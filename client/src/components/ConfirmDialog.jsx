import { useEffect } from 'react'
import { AlertTriangleIcon } from './Icons'

export default function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmLabel = 'Confirm', danger = false }) {
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  return (
    <>
      <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6">
          <div className="flex items-start gap-3">
            <div className={`p-2 rounded-lg ${danger ? 'bg-red-50' : 'bg-amber-50'}`}>
              <AlertTriangleIcon className={`w-5 h-5 ${danger ? 'text-red-600' : 'text-amber-600'}`} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
              <p className="text-sm text-slate-500 mt-1">{message}</p>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-5">
            <button onClick={onClose} className="btn-secondary text-xs">Cancel</button>
            <button onClick={onConfirm} className={danger ? 'btn-danger text-xs' : 'btn-primary text-xs'}>
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
