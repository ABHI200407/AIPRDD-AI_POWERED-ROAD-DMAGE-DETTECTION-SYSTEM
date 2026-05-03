import { Search, MapPin, ChevronRight } from 'lucide-react'

export default function SearchPanel({ 
  destSearch, 
  setDestSearch, 
  onSearch, 
  searchResults, 
  showResults, 
  onSelectDestination, 
  isSearching,
  searchError,
  vehicle,
  setVehicle,
  vehicles,
  recentSearches = []
}) {
  return (
    <div className="flex flex-col gap-6">
      {/* Vehicle Selector */}
      <div className="glass p-5 flex flex-col gap-4">
        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">1. Select Mobility Profile</label>
        <div className="flex gap-3">
          {vehicles.map(v => (
            <button 
              key={v.id} 
              onClick={() => setVehicle(v.id)}
              className={`flex-1 p-4 rounded-2xl flex flex-col items-center gap-2 transition-all border-2 ${
                vehicle === v.id 
                ? 'border-primary bg-primary/10 text-primary shadow-[0_0_20px_rgba(56,189,248,0.2)]' 
                : 'border-white/5 bg-white/5 text-slate-500 hover:border-white/10'
              }`}
            >
              <span className="text-3xl">{v.icon}</span>
              <span className="text-[10px] font-black uppercase tracking-tight">{v.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Destination Search */}
      <div className="glass p-5 flex flex-col gap-4 relative">
        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">2. Target Destination</label>
        <div className="flex gap-3">
          <div className="relative flex-1">
            <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
            <input 
              type="text" 
              value={destSearch} 
              onChange={e => setDestSearch(e.target.value)} 
              onKeyDown={e => e.key === 'Enter' && onSearch()} 
              placeholder="Search (e.g. Bandra, Mumbai)..."
              className="w-full bg-white/5 border border-white/5 rounded-xl py-4 pl-12 pr-4 text-white text-sm outline-none focus:border-primary/50 transition-all placeholder:text-slate-600"
            />
          </div>
          <button 
            onClick={() => onSearch()} 
            className="p-4 bg-primary text-white rounded-xl shadow-lg active:scale-95 transition-all hover:bg-primary/80"
          >
            {isSearching ? <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" /> : <Search size={20} />}
          </button>
        </div>

        {/* Recent Searches */}
        {!showResults && recentSearches.length > 0 && (
          <div className="flex flex-col gap-2 mt-2">
            <div className="flex items-center justify-between px-2">
              <span className="text-[9px] font-bold text-slate-600 uppercase tracking-widest">Recent Searches</span>
              <button onClick={() => localStorage.removeItem('recent_searches')} className="text-[9px] text-slate-700 hover:text-slate-400">Clear</button>
            </div>
            <div className="flex flex-wrap gap-2">
              {recentSearches.map((s, i) => (
                <button 
                  key={i} 
                  onClick={() => onSelectDestination(s)}
                  className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/5 text-[10px] text-slate-400 hover:bg-white/10 hover:text-white transition-all whitespace-nowrap overflow-hidden text-ellipsis max-w-[150px]"
                >
                  {s.name || s.display_name.split(',')[0]}
                </button>
              ))}
            </div>
          </div>
        )}

        {showResults && searchResults.length > 0 && (
          <div className="absolute top-full left-0 right-0 z-[3000] glass mt-2 max-h-[300px] overflow-y-auto border border-white/10 rounded-2xl animate-in fade-in slide-in-from-top-2">
            {searchResults.map((item, i) => (
              <div 
                key={i} 
                onClick={() => onSelectDestination(item)} 
                className="p-5 border-b border-white/5 hover:bg-white/5 cursor-pointer flex items-center justify-between group"
              >
                <div className="flex flex-col gap-1 pr-4">
                  <span className="font-black text-primary text-[10px] uppercase">{item.name || 'Location'}</span>
                  <span className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">{item.display_name}</span>
                </div>
                <ChevronRight size={16} className="text-slate-600 group-hover:text-primary transition-colors flex-shrink-0" />
              </div>
            ))}
          </div>
        )}
        
        {searchError && <p className="text-[10px] text-rose-500 font-bold uppercase mt-1">{searchError}</p>}
      </div>
    </div>
  )
}
