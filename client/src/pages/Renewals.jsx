import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { renewals as renewalsApi, vehicles as vehiclesApi } from '../api'
import PageHeader from '../components/PageHeader'
import RenewalsQueue from '../components/RenewalsQueue'
import InsuranceOptimizer from './InsuranceOptimizer'
import { useLang } from '../context/LanguageContext'

const TAB_QUEUE = 'queue'
const TAB_INSIGHTS = 'insights'

export default function Renewals() {
 const { t } = useLang()
 const [searchParams, setSearchParams] = useSearchParams()
 const tab = searchParams.get('tab') === TAB_INSIGHTS ? TAB_INSIGHTS : TAB_QUEUE

 const setTab = useCallback((next) => {
 if (next === TAB_INSIGHTS) setSearchParams({ tab: TAB_INSIGHTS })
 else setSearchParams({})
 }, [setSearchParams])

 const [renewalList, setRenewalList] = useState([])
 const [expiring, setExpiring] = useState([])
 const [vehicles, setVehicles] = useState([])
 const [loading, setLoading] = useState(true)

 useEffect(() => {
 Promise.allSettled([
 renewalsApi.list(),
 renewalsApi.expiring(),
 vehiclesApi.list(),
 ]).then(([r, e, v]) => {
 if (r.status === 'fulfilled') setRenewalList(r.value)
 if (e.status === 'fulfilled') setExpiring(e.value)
 if (v.status === 'fulfilled') setVehicles(v.value)
 setLoading(false)
 })
 }, [])

 return (
 <div>
 <PageHeader
 title={t('navRenewalsHub')}
 subtitle={t('renewalsHubSubtitle')}
 breadcrumbs={[{ label: t('navFleetHealth'), to: '/fleet-health' }, { label: t('navRenewalsHub') }]}
 />

 <div className="card overflow-hidden mb-5">
 <div
 role="tablist"
 aria-label={t('renewalsHubTabsAria')}
 className="flex w-full rounded-xl bg-slate-100 dark:bg-slate-800/90 p-1 gap-0.5"
 >
 <button
 type="button"
 role="tab"
 id="renewals-tab-queue"
 aria-selected={tab === TAB_QUEUE}
 aria-controls="renewals-panel-queue"
 onClick={() => setTab(TAB_QUEUE)}
 className={`flex-1 min-w-0 rounded-lg py-2.5 px-2 sm:px-3 text-center transition-all ${
 tab === TAB_QUEUE
 ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
 : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
 }`}
 >
 <span className="block text-xs sm:text-sm font-semibold">{t('renewalsTabQueue')}</span>
 <span className="block text-[10px] sm:text-xs font-medium opacity-70">{t('renewalsTabQueueHint')}</span>
 </button>
 <button
 type="button"
 role="tab"
 id="renewals-tab-insights"
 aria-selected={tab === TAB_INSIGHTS}
 aria-controls="renewals-panel-insights"
 onClick={() => setTab(TAB_INSIGHTS)}
 className={`flex-1 min-w-0 rounded-lg py-2.5 px-2 sm:px-3 text-center transition-all ${
 tab === TAB_INSIGHTS
 ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
 : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
 }`}
 >
 <span className="block text-xs sm:text-sm font-semibold">{t('renewalsTabInsights')}</span>
 <span className="block text-[10px] sm:text-xs font-medium opacity-70">{t('renewalsTabInsightsHint')}</span>
 </button>
 </div>
 </div>

 {tab === TAB_QUEUE && (
 <div role="tabpanel" id="renewals-panel-queue" aria-labelledby="renewals-tab-queue">
 <RenewalsQueue
 renewalList={renewalList}
 expiring={expiring}
 vehicles={vehicles}
 loading={loading}
 />
 </div>
 )}

 {tab === TAB_INSIGHTS && (
 <div role="tabpanel" id="renewals-panel-insights" aria-labelledby="renewals-tab-insights">
 <InsuranceOptimizer embedded />
 </div>
 )}
 </div>
 )
}
