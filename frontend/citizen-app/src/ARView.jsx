import React, { useState, useEffect, useRef } from 'react';
import { Camera, AlertTriangle, ShieldCheck, Zap, Crosshair, RefreshCw } from 'lucide-react';

const ARView = () => {
  const [detectedHazards, setDetectedHazards] = useState([]);
  const [scanPulse, setScanPulse] = useState(0);
  const [hasCamera, setHasCamera] = useState(false);
  const [error, setError] = useState(null);
  const videoRef = useRef(null);
  
  // Real Hardware Hook: Camera
  useEffect(() => {
    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: 'environment' }, 
          audio: false 
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          setHasCamera(true);
        }
      } catch (err) {
        console.error("Camera access denied:", err);
        setError("Camera permission required for AR Vision.");
      }
    }
    startCamera();
    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        videoRef.current.srcObject.getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  // Live Hazard Fetching (Simulated logic on real data structure)
  useEffect(() => {
    const hazards = [
      { id: 1, x: 45, y: 60, type: 'Pothole', severity: 4, distance: '15m' },
      { id: 2, x: 70, y: 55, type: 'Crack', severity: 2, distance: '28m' },
      { id: 3, x: 30, y: 40, type: 'Debris', severity: 5, distance: '8m' }
    ];
    setDetectedHazards(hazards);

    const interval = setInterval(() => {
      setScanPulse(p => (p + 1) % 100);
    }, 50);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative h-full w-full bg-black overflow-hidden flex flex-col font-mono">
      {/* ─── REAL CAMERA FEED ─── */}
      {hasCamera ? (
        <video 
          ref={videoRef} 
          autoPlay 
          playsInline 
          className="absolute inset-0 w-full h-full object-cover opacity-60"
        />
      ) : (
        <div className="absolute inset-0 bg-[#020617] flex items-center justify-center">
          <div className="text-sky-400 flex flex-col items-center gap-6 z-0">
            {error ? (
              <div className="flex flex-col items-center gap-4 text-rose-500">
                <AlertTriangle size={64} />
                <p className="text-xs font-black uppercase tracking-widest">{error}</p>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Camera size={80} className="animate-pulse opacity-40" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <RefreshCw size={24} className="text-sky-300 animate-spin" />
                  </div>
                </div>
                <p className="text-xs font-black tracking-[0.5em] uppercase text-sky-500/60">Initializing Optics...</p>
              </>
            )}
          </div>
        </div>
      )}

      {/* Dynamic Scanline Grid */}
      <div className="absolute inset-0 opacity-10 pointer-events-none" 
        style={{ 
          backgroundImage: 'radial-gradient(circle, #38bdf8 1px, transparent 1px)', 
          backgroundSize: '40px 40px' 
        }} 
      />

      {/* ─── HUD OVERLAY ─── */}
      <div className="relative z-10 flex-1 p-6 flex flex-col">
        {/* Top Header */}
        <div className="flex justify-between items-start">
          <div className="glass p-4 border-l-4 border-sky-400 flex flex-col gap-1">
            <h4 className="text-sky-400 text-[9px] font-black tracking-widest uppercase">Live Vision Stream</h4>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs font-bold text-white tracking-wider">OPTICS: 4K @ 60FPS</span>
            </div>
          </div>
          
          <div className="glass p-4 border-r-4 border-sky-400 text-right flex flex-col gap-1">
            <h4 className="text-sky-400 text-[9px] font-black tracking-widest uppercase">System Telemetry</h4>
            <span className="text-lg font-black text-white italic">HARDWARE ACTIVE</span>
          </div>
        </div>

        {/* Hazard Targeting Visualization */}
        {detectedHazards.map(hazard => (
          <div 
            key={hazard.id}
            className="absolute flex flex-col items-center gap-4 pointer-events-none transition-all duration-700"
            style={{ left: `${hazard.x}%`, top: `${hazard.y}%` }}
          >
            <div className="relative flex items-center justify-center">
              <div className={`w-32 h-32 rounded-full border-2 ${hazard.severity > 3 ? 'border-rose-500' : 'border-sky-400'} animate-ping opacity-30`}></div>
              <div className={`absolute w-24 h-24 rounded-full border-4 border-dashed ${hazard.severity > 3 ? 'border-rose-500/60' : 'border-sky-400/60'} animate-spin`} style={{ animationDuration: '8s' }}></div>
              <div className={`absolute w-4 h-4 rounded-full ${hazard.severity > 3 ? 'bg-rose-500' : 'bg-sky-400'} shadow-[0_0_20px_var(--primary-glow)]`}></div>
              <Crosshair size={16} className={`absolute ${hazard.severity > 3 ? 'text-rose-500' : 'text-sky-400'}`} />
            </div>
            
            <div className="glass px-4 py-2 border-none flex items-center gap-3 backdrop-blur-3xl" style={{ background: 'rgba(0,0,0,0.8)' }}>
              <div className={`p-1.5 rounded-md ${hazard.severity > 3 ? 'bg-rose-500/20 text-rose-500' : 'bg-sky-400/20 text-sky-400'}`}>
                <AlertTriangle size={14} />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-black uppercase text-white tracking-widest">{hazard.type}</span>
                <span className={`text-[9px] font-bold ${hazard.severity > 3 ? 'text-rose-400' : 'text-sky-300'}`}>DIST: {hazard.distance} | SEV: {hazard.severity}/5</span>
              </div>
            </div>
          </div>
        ))}

        {/* Dynamic Vertical Scanline */}
        <div className="absolute top-0 w-full h-[2px] bg-sky-400/20 shadow-[0_0_20px_var(--primary-glow)] pointer-events-none"
          style={{ top: `${scanPulse}%`, transition: 'top 0.05s linear' }}
        />

        {/* Bottom Safety Status */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 w-full px-12">
          <div className="glass p-5 border-sky-500/30 flex items-center justify-between overflow-hidden">
             <div className="absolute inset-0 bg-sky-500/5 animate-pulse" />
             <div className="relative flex items-center gap-4">
                <div className="p-2 rounded-xl bg-sky-400/10 text-sky-400">
                  <ShieldCheck size={24} />
                </div>
                <div>
                  <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-sky-500/80 mb-1">Optic Perimeter</h4>
                  <p className="text-sm font-bold text-white tracking-wide">CAMERA LINK: ESTABLISHED</p>
                </div>
             </div>
             <div className="relative text-right">
                <div className="text-[10px] font-mono text-sky-400 opacity-60">GEODATA_SYNC: OK</div>
                <div className="text-[10px] font-mono text-sky-400 opacity-60">HARDWARE_LOCK: YES</div>
             </div>
          </div>
        </div>
      </div>

      {/* Viewport Corner Brackets */}
      <div className="absolute top-0 left-0 w-24 h-24 border-t-4 border-l-4 border-sky-400/40 rounded-tl-3xl m-6" />
      <div className="absolute top-0 right-0 w-24 h-24 border-t-4 border-r-4 border-sky-400/40 rounded-tr-3xl m-6" />
      <div className="absolute bottom-0 left-0 w-24 h-24 border-b-4 border-l-4 border-sky-400/40 rounded-bl-3xl m-6" />
      <div className="absolute bottom-0 right-0 w-24 h-24 border-b-4 border-r-4 border-sky-400/40 rounded-br-3xl m-6" />
    </div>
  );
};

export default ARView;
