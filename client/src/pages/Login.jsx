import { SignIn } from '@clerk/clerk-react'

export default function Login() {
 return (
 <div className="min-h-screen bg-slate-900 flex items-center justify-center px-4">
 <div className="w-full max-w-sm">
 <div className="text-center mb-8">
 <div className="w-14 h-14 rounded-2xl bg-blue-600 flex items-center justify-center text-white font-bold text-2xl mx-auto mb-3 shadow-lg shadow-blue-500/30">
 F
 </div>
 <h1 className="text-xl font-bold text-white tracking-tight">Fleetsure</h1>
 <p className="text-sm text-slate-400 mt-1">Fleet Management Platform</p>
 </div>

 <div className="flex justify-center">
 <SignIn
 appearance={{
 elements: {
 rootBox: 'w-full',
 card: 'rounded-2xl shadow-2xl shadow-black/20',
 },
 }}
 routing="hash"
 />
 </div>

 <p className="text-center text-xs text-slate-500 mt-6">
 Enterprise-grade fleet operations platform
 </p>
 </div>
 </div>
 )
}
