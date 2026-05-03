import { ShieldCheck, Wrench, AlertTriangle, TrendingUp } from 'lucide-react'

export default function StatsGrid({ routeData }) {
  if (!routeData) return null;

  const stats = [
    {
      label: 'Suspension Safety',
      value: routeData.suspension_safety_index !== undefined ? `${Math.round(routeData.suspension_safety_index)}%` : '--',
      sub: 'Longevity Score',
      icon: ShieldCheck,
      color: (routeData.suspension_safety_index || 0) > 80 ? 'text-emerald-400' : 'text-amber-400',
      border: 'border-l-sky-400'
    },
    {
      label: 'Wear & Tear Risk',
      value: routeData.estimated_wear_cost !== undefined ? `₹${routeData.estimated_wear_cost}` : '--',
      sub: 'Repair Liability',
      icon: Wrench,
      color: 'text-rose-400',
      border: 'border-l-rose-400'
    },
    {
      label: 'Hazards Bypassed',
      value: routeData.hazards_on_route === 0 ? 'SAFE' : (routeData.hazards_on_route || '--'),
      sub: 'Detected Objects',
      icon: AlertTriangle,
      color: routeData.hazards_on_route === 0 ? 'text-emerald-400' : 'text-amber-400',
      border: 'border-l-emerald-400'
    },
    {
      label: 'Road Quality',
      value: routeData.road_quality_score || '--',
      sub: 'A* Weight Index',
      icon: TrendingUp,
      color: 'text-sky-400',
      border: 'border-l-sky-400'
    }
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full">
      {stats.map((s, i) => (
        <div key={i} className={`glass p-5 flex flex-col gap-1 border-l-4 ${s.border} transition-all hover:translate-y-[-2px]`}>
          <div className="flex items-center gap-2 text-slate-500 mb-1">
            <s.icon size={14} />
            <span className="text-[10px] font-black uppercase tracking-widest">{s.label}</span>
          </div>
          <div className="flex items-end gap-1">
            <span className={`text-2xl md:text-3xl font-black ${s.color}`}>{s.value}</span>
            <span className="text-[10px] text-slate-500 mb-1 font-bold">{s.sub}</span>
          </div>
        </div>
      ))}
    </div>
  )
}
