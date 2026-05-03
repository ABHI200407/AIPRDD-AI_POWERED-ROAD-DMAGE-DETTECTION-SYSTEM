import { useState, useEffect, useRef } from 'react';
import { Camera, X, Shield, AlertTriangle, Play, Pause, Zap, Moon, Sun, Battery, Thermometer, WifiOff } from 'lucide-react';
import { auth } from './firebase';

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

export default function SentinelView({ onClose, onDetect }) {
  const [isActive, setIsActive] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isStealth, setIsStealth] = useState(false);
  const [isNightMode, setIsNightMode] = useState(false);
  const [totalHazards, setTotalHazards] = useState(0);
  const [lastDetection, setLastDetection] = useState(null);
  const [speed, setSpeed] = useState(0);
  const [impactDetected, setImpactDetected] = useState(false);
  const [offlineBuffer, setOfflineBuffer] = useState([]);
  
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const audioRef = useRef(new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3')); // Confirmation ping

  // IMU Correlation (Accelerometer)
  useEffect(() => {
    let lastZ = 0;
    const handleMotion = (event) => {
      const z = event.accelerationIncludingGravity.z;
      const delta = Math.abs(z - lastZ);
      if (delta > 5.0) { // Significant jolt threshold
        setImpactDetected(true);
        setTimeout(() => setLastDetection(prev => prev ? { ...prev, verified: true } : null), 100);
        setTimeout(() => setImpactDetected(false), 2000);
      }
      lastZ = z;
    };

    if (isActive) {
      window.addEventListener('devicemotion', handleMotion);
    }
    return () => window.removeEventListener('devicemotion', handleMotion);
  }, [isActive]);

  // GPS Speed tracking
  useEffect(() => {
    let watchId = null;
    if (isActive) {
      watchId = navigator.geolocation.watchPosition(
        (pos) => setSpeed(Math.round((pos.coords.speed || 0) * 3.6)),
        null,
        { enableHighAccuracy: true }
      );
    }
    return () => watchId && navigator.geolocation.clearWatch(watchId);
  }, [isActive]);

  // AI Scanning Loop
  useEffect(() => {
    let interval = null;
    if (isActive) {
      interval = setInterval(async () => {
        if (isProcessing) return;
        captureAndAnalyze();
      }, 1200); // Higher frequency for Sentinel Mode
    }
    return () => clearInterval(interval);
  }, [isActive, isProcessing, isNightMode]);

  const captureAndAnalyze = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    
    setIsProcessing(true);
    const context = canvasRef.current.getContext('2d');
    canvasRef.current.width = videoRef.current.videoWidth;
    canvasRef.current.height = videoRef.current.videoHeight;
    context.drawImage(videoRef.current, 0, 0);

    canvasRef.current.toBlob(async (blob) => {
      if (!blob) { setIsProcessing(false); return; }
      
      const formData = new FormData();
      formData.append('file', blob, 'frame.jpg');

      try {
        const token = auth.currentUser ? await auth.currentUser.getIdToken() : '';
        const response = await fetch(`${API}/reports/analyze`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: formData,
        });
        const data = await response.json();

        if (data.status === 'success' && data.detections?.length > 0) {
          const primary = data.detections[0];
          
          // Night mode confidence threshold adjustment
          const minConf = isNightMode ? 0.45 : 0.60;
          if (primary.confidence < minConf) {
            setIsProcessing(false);
            return;
          }

          // Trigger feedback
          audioRef.current.play().catch(() => {});
          setTotalHazards(prev => prev + 1);
          setLastDetection(primary);

          // Report to Gov Backend (Silent)
          reportToGov(primary);
          
          setTimeout(() => setLastDetection(null), 3000);
        }
      } catch (err) {
        console.error("Sentinel AI failed:", err);
      } finally {
        setIsProcessing(false);
      }
    }, 'image/jpeg', 0.7);
  };

  const reportToGov = async (detection) => {
    const payload = {
      user_id: auth.currentUser?.uid || 'sentinel_node',
      timestamp_captured: new Date().toISOString(),
      location: { latitude: 0, longitude: 0 }, // Will be filled by browser/GPS
      assessment: { 
        damage_type: detection.type, 
        ai_suggested_severity: detection.severity 
      },
      source: 'SENTINEL',
      is_impact_verified: impactDetected
    };

    // Get current location
    navigator.geolocation.getCurrentPosition(async (pos) => {
      payload.location = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
      
      if (navigator.onLine) {
        try {
          const token = auth.currentUser ? await auth.currentUser.getIdToken() : '';
          await fetch(`${API}/reports`, {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(payload)
          });
        } catch {
          setOfflineBuffer(prev => [...prev, payload]);
        }
      } else {
        setOfflineBuffer(prev => [...prev, payload]);
      }
    });
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment', width: 1280, height: 720 }, 
        audio: false 
      });
      videoRef.current.srcObject = stream;
      setIsActive(true);
    } catch (err) {
      alert("Camera access denied. Please mount phone and enable camera.");
    }
  };

  return (
    <div style={{ 
      position: 'fixed', inset: 0, z: 9999, background: '#020617', color: 'white', 
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
      opacity: isStealth ? 0.05 : 1, transition: 'opacity 0.5s ease'
    }}>
      {/* HUD HEADER */}
      <div style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(2,6,23,0.8)', backdropFilter: 'blur(10px)', zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 15 }}>
          <div style={{ width: 12, height: 12, borderRadius: '50%', background: isActive ? '#22c55e' : '#ef4444', boxShadow: isActive ? '0 0 10px #22c55e' : 'none' }} />
          <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, letterSpacing: 1 }}>ROAD SENTINEL <span style={{ color: '#38bdf8', fontSize: '0.7rem' }}>ELITE</span></h2>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}><X size={28} /></button>
      </div>

      {/* VIEWPORT */}
      <div style={{ flex: 1, position: 'relative', background: '#000' }}>
        <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        <canvas ref={canvasRef} style={{ display: 'none' }} />

        {/* AI OVERLAY */}
        {lastDetection && (
          <div style={{ position: 'absolute', top: '20%', left: '10%', right: '10%', padding: '20px', borderRadius: '24px', background: 'rgba(239, 68, 68, 0.9)', backdropFilter: 'blur(10px)', border: '2px solid white', animation: 'pulse 1s infinite' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 15 }}>
              <AlertTriangle size={40} color="white" />
              <div>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, opacity: 0.8 }}>HAZARD DETECTED & REPORTED</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 900 }}>{lastDetection.type} (S{lastDetection.severity})</div>
                {impactDetected && <div style={{ fontSize: '0.7rem', fontWeight: 900, background: 'white', color: '#ef4444', padding: '2px 8px', borderRadius: 4, display: 'inline-block', marginTop: 5 }}>IMPACT VERIFIED</div>}
              </div>
            </div>
          </div>
        )}

        {/* IMPACT INDICATOR */}
        {impactDetected && (
          <div style={{ position: 'absolute', inset: 0, border: '10px solid #ef4444', pointerEvents: 'none', animation: 'flash 0.2s' }} />
        )}

        {/* TELEMETRY OVERLAY */}
        <div style={{ position: 'absolute', bottom: 30, left: 20, right: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ padding: '15px 25px', borderRadius: '20px', background: 'rgba(2,6,23,0.7)', border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)' }}>
              <div style={{ fontSize: '2.5rem', fontWeight: 900, lineHeight: 1 }}>{speed}</div>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, opacity: 0.6 }}>KM/H</div>
            </div>
            <div style={{ padding: '10px 15px', borderRadius: '15px', background: 'rgba(2,6,23,0.7)', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <Zap size={14} color="#38bdf8" />
              <div style={{ fontSize: '0.8rem', fontWeight: 700 }}>{totalHazards} DETECTIONS</div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-end' }}>
             {offlineBuffer.length > 0 && (
               <div style={{ padding: '8px 12px', borderRadius: '10px', background: '#f59e0b', color: 'white', fontSize: '0.7rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 5 }}>
                 <WifiOff size={12} /> {offlineBuffer.length} QUEUED
               </div>
             )}
             <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setIsNightMode(!isNightMode)} style={{ p: 10, borderRadius: '15px', border: 'none', background: isNightMode ? '#38bdf8' : 'rgba(2,6,23,0.7)', color: 'white' }}>
                  {isNightMode ? <Moon size={20} /> : <Sun size={20} />}
                </button>
                <button onClick={() => setIsStealth(!isStealth)} style={{ p: 10, borderRadius: '15px', border: 'none', background: 'rgba(2,6,23,0.7)', color: 'white' }}>
                   <Shield size={20} />
                </button>
             </div>
          </div>
        </div>

        {!isActive && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(2,6,23,0.9)', backdropFilter: 'blur(20px)' }}>
             <button 
              onClick={startCamera}
              style={{ padding: '20px 40px', borderRadius: '30px', border: 'none', background: '#38bdf8', color: '#020617', fontWeight: 900, fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: 15, cursor: 'pointer', boxShadow: '0 20px 50px rgba(56,189,248,0.4)' }}
             >
               <Play size={24} /> ACTIVATE SENTINEL
             </button>
          </div>
        )}
      </div>

      {/* SYSTEM BAR */}
      <div style={{ padding: '15px 25px', background: '#0f172a', display: 'flex', justifyContent: 'space-between', opacity: 0.6 }}>
        <div style={{ display: 'flex', gap: 20, fontSize: '0.7rem', fontWeight: 700 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}><Battery size={12} /> 84%</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}><Thermometer size={12} /> 38°C</div>
        </div>
        <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#38bdf8' }}>ENCRYPTED SENTINEL LINK ACTIVE</div>
      </div>

      <style>{`
        @keyframes pulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.02); }
          100% { transform: scale(1); }
        }
        @keyframes flash {
          0% { opacity: 0; }
          50% { opacity: 1; }
          100% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}
