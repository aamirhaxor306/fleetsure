import { useLang } from '../context/LanguageContext'

/**
 * Axle layout definitions for each truck configuration.
 * Each axle has: label, y-position, and tyre positions (left/right pairs).
 * Dual tyres have inner (I) and outer (O) on each side.
 */
const AXLE_CONFIGS = {
 '6W': {
 label: '6-Wheeler',
 axles: [
 { label: 'Front', y: 0, tyres: [{ pos: 'FL', side: 'left' }, { pos: 'FR', side: 'right' }] },
 { label: 'Rear', y: 1, tyres: [
 { pos: 'R1LO', side: 'left-outer' }, { pos: 'R1LI', side: 'left-inner' },
 { pos: 'R1RI', side: 'right-inner' }, { pos: 'R1RO', side: 'right-outer' },
 ]},
 ],
 stepney: ['S1'],
 },
 '10W': {
 label: '10-Wheeler',
 axles: [
 { label: 'Front', y: 0, tyres: [{ pos: 'FL', side: 'left' }, { pos: 'FR', side: 'right' }] },
 { label: 'Rear 1', y: 1, tyres: [
 { pos: 'R1LO', side: 'left-outer' }, { pos: 'R1LI', side: 'left-inner' },
 { pos: 'R1RI', side: 'right-inner' }, { pos: 'R1RO', side: 'right-outer' },
 ]},
 { label: 'Rear 2', y: 2, tyres: [
 { pos: 'R2LO', side: 'left-outer' }, { pos: 'R2LI', side: 'left-inner' },
 { pos: 'R2RI', side: 'right-inner' }, { pos: 'R2RO', side: 'right-outer' },
 ]},
 ],
 stepney: ['S1'],
 },
 '12W': {
 label: '12-Wheeler',
 axles: [
 { label: 'Front 1', y: 0, tyres: [{ pos: 'F1L', side: 'left' }, { pos: 'F1R', side: 'right' }] },
 { label: 'Front 2', y: 1, tyres: [{ pos: 'F2L', side: 'left' }, { pos: 'F2R', side: 'right' }] },
 { label: 'Rear 1', y: 2, tyres: [
 { pos: 'R1LO', side: 'left-outer' }, { pos: 'R1LI', side: 'left-inner' },
 { pos: 'R1RI', side: 'right-inner' }, { pos: 'R1RO', side: 'right-outer' },
 ]},
 { label: 'Rear 2', y: 3, tyres: [
 { pos: 'R2LO', side: 'left-outer' }, { pos: 'R2LI', side: 'left-inner' },
 { pos: 'R2RI', side: 'right-inner' }, { pos: 'R2RO', side: 'right-outer' },
 ]},
 ],
 stepney: ['S1'],
 },
 '14W': {
 label: '14-Wheeler',
 axles: [
 { label: 'Front', y: 0, tyres: [{ pos: 'FL', side: 'left' }, { pos: 'FR', side: 'right' }] },
 { label: 'Rear 1', y: 1, tyres: [
 { pos: 'R1LO', side: 'left-outer' }, { pos: 'R1LI', side: 'left-inner' },
 { pos: 'R1RI', side: 'right-inner' }, { pos: 'R1RO', side: 'right-outer' },
 ]},
 { label: 'Rear 2', y: 2, tyres: [
 { pos: 'R2LO', side: 'left-outer' }, { pos: 'R2LI', side: 'left-inner' },
 { pos: 'R2RI', side: 'right-inner' }, { pos: 'R2RO', side: 'right-outer' },
 ]},
 { label: 'Rear 3', y: 3, tyres: [
 { pos: 'R3LO', side: 'left-outer' }, { pos: 'R3LI', side: 'left-inner' },
 { pos: 'R3RI', side: 'right-inner' }, { pos: 'R3RO', side: 'right-outer' },
 ]},
 ],
 stepney: ['S1'],
 },
}

/** Color mapping based on tyre condition / life remaining */
function getTyreColor(tyre, vehicleKm) {
 if (!tyre) return { fill: '#f3f4f6', stroke: '#d1d5db', text: '#9ca3af', status: 'empty' } // gray - empty

 if (tyre.condition === 'burst') return { fill: '#1f2937', stroke: '#111827', text: '#fff', status: 'burst' }
 if (tyre.condition === 'replace') return { fill: '#fef2f2', stroke: '#ef4444', text: '#dc2626', status: 'replace' }

 // Calculate life remaining based on km
 const kmDone = Math.max(0, vehicleKm - tyre.installedKm)
 const lifePercent = Math.max(0, Math.min(100, ((tyre.expectedLifeKm - kmDone) / tyre.expectedLifeKm) * 100))

 if (tyre.condition === 'warn' || lifePercent < 20) {
 return { fill: '#fef2f2', stroke: '#ef4444', text: '#dc2626', status: 'replace' }
 }
 if (lifePercent < 40) {
 return { fill: '#fffbeb', stroke: '#f59e0b', text: '#d97706', status: 'warn' }
 }
 return { fill: '#ecfdf5', stroke: '#10b981', text: '#059669', status: 'good' }
}

function getLifeLabel(tyre, vehicleKm) {
 if (!tyre) return ''
 const kmDone = Math.max(0, vehicleKm - tyre.installedKm)
 const kmRemaining = Math.max(0, tyre.expectedLifeKm - kmDone)
 if (kmRemaining >= 1000) return `${Math.round(kmRemaining / 1000)}k`
 return `${kmRemaining}`
}

export default function TyreDiagram({ axleConfig = '6W', tyres = [], vehicleKm = 0, onTyreClick }) {
 const { t } = useLang()
 const config = AXLE_CONFIGS[axleConfig] || AXLE_CONFIGS['6W']

 // Build tyre lookup by position
 const tyreMap = {}
 for (const tyre of tyres) {
 tyreMap[tyre.position] = tyre
 }

 const axleCount = config.axles.length
 const TYRE_W = 28
 const TYRE_H = 48
 const TYRE_GAP = 4 // gap between dual tyres
 const AXLE_SPACING = 72
 const BODY_W = 120
 const MARGIN_X = 60
 const MARGIN_TOP = 40
 const STEPNEY_GAP = 30

 // SVG dimensions
 const svgW = BODY_W + MARGIN_X * 2
 const bodyH = (axleCount - 1) * AXLE_SPACING + TYRE_H + 40
 const svgH = MARGIN_TOP + bodyH + STEPNEY_GAP + (config.stepney.length > 0 ? TYRE_H + 40 : 0) + 20

 const bodyX = MARGIN_X
 const bodyY = MARGIN_TOP
 const centerX = bodyX + BODY_W / 2

 // Helper to get tyre x position
 function getTyreX(side) {
 const leftEdge = bodyX - TYRE_W - 6
 const rightEdge = bodyX + BODY_W + 6
 switch (side) {
 case 'left': return leftEdge
 case 'right': return rightEdge
 case 'left-outer': return leftEdge - TYRE_W - TYRE_GAP
 case 'left-inner': return leftEdge
 case 'right-inner': return rightEdge
 case 'right-outer': return rightEdge + TYRE_W + TYRE_GAP
 default: return leftEdge
 }
 }

 return (
 <div className="flex flex-col items-center">
 {/* Legend */}
 <div className="flex items-center gap-4 mb-4 text-xs">
 <span className="flex items-center gap-1.5">
 <span className="w-3 h-3 rounded-sm bg-emerald-100 border border-emerald-500" />
 {t('tyres.good')}
 </span>
 <span className="flex items-center gap-1.5">
 <span className="w-3 h-3 rounded-sm bg-amber-50 border border-amber-500" />
 {t('tyres.warn')}
 </span>
 <span className="flex items-center gap-1.5">
 <span className="w-3 h-3 rounded-sm bg-red-50 border border-red-500" />
 {t('tyres.replace')}
 </span>
 <span className="flex items-center gap-1.5">
 <span className="w-3 h-3 rounded-sm bg-gray-900 border border-gray-900" />
 {t('tyres.burst')}
 </span>
 <span className="flex items-center gap-1.5">
 <span className="w-3 h-3 rounded-sm bg-gray-100 border border-gray-300 border-dashed" />
 {t('tyres.empty')}
 </span>
 </div>

 <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full max-w-sm" style={{ maxHeight: '500px' }}>
 {/* Truck body */}
 <rect
 x={bodyX}
 y={bodyY}
 width={BODY_W}
 height={bodyH}
 rx={16}
 fill="#f8fafc"
 stroke="#cbd5e1"
 strokeWidth={2}
 />

 {/* Cabin (top rounded area) */}
 <rect
 x={bodyX + 10}
 y={bodyY + 8}
 width={BODY_W - 20}
 height={36}
 rx={8}
 fill="#e2e8f0"
 stroke="#94a3b8"
 strokeWidth={1}
 />
 <text x={centerX} y={bodyY + 30} textAnchor="middle" fontSize={11} fill="#64748b" fontWeight={600}>
 {config.label}
 </text>

 {/* Axle lines and tyres */}
 {config.axles.map((axle, axleIdx) => {
 const axleY = bodyY + 50 + axle.y * AXLE_SPACING
 const tyreCenterY = axleY

 return (
 <g key={axle.label}>
 {/* Axle line */}
 <line
 x1={bodyX - TYRE_W * 2 - TYRE_GAP - 10}
 y1={tyreCenterY + TYRE_H / 2}
 x2={bodyX + BODY_W + TYRE_W * 2 + TYRE_GAP + 10}
 y2={tyreCenterY + TYRE_H / 2}
 stroke="#cbd5e1"
 strokeWidth={2}
 />

 {/* Axle label */}
 <text
 x={centerX}
 y={tyreCenterY + TYRE_H / 2 + 4}
 textAnchor="middle"
 fontSize={9}
 fill="#94a3b8"
 fontWeight={500}
 >
 {axle.label}
 </text>

 {/* Tyres on this axle */}
 {axle.tyres.map((tyrePos) => {
 const tyre = tyreMap[tyrePos.pos]
 const color = getTyreColor(tyre, vehicleKm)
 const lifeLabel = getLifeLabel(tyre, vehicleKm)
 const tx = getTyreX(tyrePos.side)

 return (
 <g
 key={tyrePos.pos}
 onClick={() => onTyreClick && onTyreClick(tyrePos.pos, tyre)}
 style={{ cursor: 'pointer' }}
 >
 <rect
 x={tx}
 y={tyreCenterY}
 width={TYRE_W}
 height={TYRE_H}
 rx={6}
 fill={color.fill}
 stroke={color.stroke}
 strokeWidth={2}
 strokeDasharray={!tyre ? '4 3' : 'none'}
 />
 {/* Tread pattern lines */}
 {tyre && (
 <>
 <line x1={tx + 4} y1={tyreCenterY + 12} x2={tx + TYRE_W - 4} y2={tyreCenterY + 12} stroke={color.stroke} strokeWidth={0.5} opacity={0.4} />
 <line x1={tx + 4} y1={tyreCenterY + 24} x2={tx + TYRE_W - 4} y2={tyreCenterY + 24} stroke={color.stroke} strokeWidth={0.5} opacity={0.4} />
 <line x1={tx + 4} y1={tyreCenterY + 36} x2={tx + TYRE_W - 4} y2={tyreCenterY + 36} stroke={color.stroke} strokeWidth={0.5} opacity={0.4} />
 </>
 )}
 {/* Position label */}
 <text
 x={tx + TYRE_W / 2}
 y={tyreCenterY + (tyre ? 18 : TYRE_H / 2 + 2)}
 textAnchor="middle"
 fontSize={7}
 fill={color.text}
 fontWeight={600}
 >
 {tyrePos.pos}
 </text>
 {/* Life remaining */}
 {tyre && lifeLabel && (
 <text
 x={tx + TYRE_W / 2}
 y={tyreCenterY + 34}
 textAnchor="middle"
 fontSize={9}
 fill={color.text}
 fontWeight={700}
 >
 {lifeLabel}
 </text>
 )}
 {/* "+" for empty */}
 {!tyre && (
 <text
 x={tx + TYRE_W / 2}
 y={tyreCenterY + TYRE_H / 2 + 14}
 textAnchor="middle"
 fontSize={14}
 fill="#9ca3af"
 fontWeight={300}
 >
 +
 </text>
 )}
 </g>
 )
 })}
 </g>
 )
 })}

 {/* Stepney */}
 {config.stepney.map((pos, i) => {
 const tyre = tyreMap[pos]
 const color = getTyreColor(tyre, vehicleKm)
 const lifeLabel = getLifeLabel(tyre, vehicleKm)
 const stepneyY = bodyY + bodyH + STEPNEY_GAP
 const stepneyX = centerX - TYRE_W / 2

 return (
 <g key={pos}>
 <text
 x={centerX}
 y={stepneyY - 6}
 textAnchor="middle"
 fontSize={9}
 fill="#94a3b8"
 fontWeight={500}
 >
 {t('tyres.stepney')}
 </text>
 <g
 onClick={() => onTyreClick && onTyreClick(pos, tyre)}
 style={{ cursor: 'pointer' }}
 >
 <rect
 x={stepneyX}
 y={stepneyY}
 width={TYRE_W}
 height={TYRE_H}
 rx={6}
 fill={color.fill}
 stroke={color.stroke}
 strokeWidth={2}
 strokeDasharray={!tyre ? '4 3' : 'none'}
 />
 <text
 x={centerX}
 y={stepneyY + (tyre ? 18 : TYRE_H / 2 + 2)}
 textAnchor="middle"
 fontSize={7}
 fill={color.text}
 fontWeight={600}
 >
 {pos}
 </text>
 {tyre && lifeLabel && (
 <text
 x={centerX}
 y={stepneyY + 34}
 textAnchor="middle"
 fontSize={9}
 fill={color.text}
 fontWeight={700}
 >
 {lifeLabel}
 </text>
 )}
 {!tyre && (
 <text
 x={centerX}
 y={stepneyY + TYRE_H / 2 + 14}
 textAnchor="middle"
 fontSize={14}
 fill="#9ca3af"
 fontWeight={300}
 >
 +
 </text>
 )}
 </g>
 </g>
 )
 })}
 </svg>
 </div>
 )
}

/** Export the config for use in forms */
export { AXLE_CONFIGS }
