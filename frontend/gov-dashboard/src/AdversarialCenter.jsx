import React, { useState } from 'react';
import { ShieldAlert, Zap, Lock, Globe, Filter, RefreshCw, XCircle } from 'lucide-react';

const AdversarialCenter = () => {
  const [alerts, setAlerts] = useState([
    { id: 'att-1', time: '10:42', sector: 'Sector 4-B', intensity: 88, status: 'QUARANTINED', description: 'Bot swarm detected: 142 reports in 3 mins' },
    { id: 'att-2', time: '09:15', sector: 'Downtown Core', intensity: 45, status: 'MONITORING', description: 'Suspicious location spoofing detected from user-882' }
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl mb-1">Adversarial Defense Center</h2>
          <p className="text-sm text-slate-400 font-medium uppercase tracking-wider">Infrastructure Integrity Control</p>
        </div>
        <div className="flex gap-4">
          <button className="btn-secondary">
            <Filter size={16} /> Filter Alerts
          </button>
          <button className="btn-primary">
            <Zap size={16} /> Hard Lock All Quarantines
          </button>
        </div>
      </div>

      <div className="metric-grid">
        <div className="metric-card border-l-4 border-l-rose-500">
          <div className="label">Active Threats</div>
          <div className="value text-rose-500">02</div>
        </div>
        <div className="metric-card border-l-4 border-l-sky-400">
          <div className="label">Blocked Reports (24h)</div>
          <div className="value">1,402</div>
        </div>
        <div className="metric-card border-l-4 border-l-emerald-400">
          <div className="label">Integrity Score</div>
          <div className="value">99.4%</div>
        </div>
      </div>

      <div className="glass-card">
        <div className="flex items-center gap-3 mb-6">
          <ShieldAlert size={20} className="text-rose-500" />
          <h3 className="text-lg">Real-time Anomaly Stream</h3>
        </div>

        <table className="data-table">
          <thead>
            <tr>
              <th>Incident ID</th>
              <th>Sector</th>
              <th>Time</th>
              <th>Intensity</th>
              <th>Defense Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {alerts.map(alert => (
              <tr key={alert.id}>
                <td className="font-mono text-xs">{alert.id}</td>
                <td>{alert.sector}</td>
                <td className="text-slate-400">{alert.time}</td>
                <td>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div className={`h-full ${alert.intensity > 70 ? 'bg-rose-500' : 'bg-amber-400'}`} style={{ width: `${alert.intensity}%` }}></div>
                    </div>
                    <span className="text-xs font-bold">{alert.intensity}%</span>
                  </div>
                </td>
                <td>
                  <span className={`badge ${alert.status === 'QUARANTINED' ? 'badge-critical' : 'badge-warning'}`}>
                    {alert.status}
                  </span>
                </td>
                <td>
                  <div className="flex gap-2">
                    <button className="p-2 hover:bg-rose-500/20 rounded-md transition-colors text-rose-500">
                      <XCircle size={16} />
                    </button>
                    <button className="p-2 hover:bg-sky-500/20 rounded-md transition-colors text-sky-400">
                      <RefreshCw size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="glass-card">
          <div className="flex items-center gap-3 mb-4">
            <Lock size={18} className="text-sky-400" />
            <h4 className="text-sm uppercase tracking-widest font-black">Security Policy</h4>
          </div>
          <p className="text-sm text-slate-400 leading-relaxed mb-4">
            Current automated threshold is set to 50 reports/sector/5min. Velocity spikes exceeding this will trigger immediate local quarantine.
          </p>
          <button className="text-xs font-bold text-sky-400 hover:underline">Edit Policy Parameters →</button>
        </div>
        
        <div className="glass-card">
          <div className="flex items-center gap-3 mb-4">
            <Globe size={18} className="text-emerald-400" />
            <h4 className="text-sm uppercase tracking-widest font-black">Regional Trust Map</h4>
          </div>
          <p className="text-sm text-slate-400 leading-relaxed mb-4">
            trust levels in Downtown are currently at 0.98. Sector 4-B trust has dropped to 0.12 due to active spoofing attempts.
          </p>
          <button className="text-xs font-bold text-emerald-400 hover:underline">View Trust Heatmap →</button>
        </div>
      </div>
    </div>
  );
};

export default AdversarialCenter;
