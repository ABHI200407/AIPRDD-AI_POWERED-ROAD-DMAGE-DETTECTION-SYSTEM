import { useState, useEffect, useRef } from 'react';
import { Camera, X, Shield, AlertTriangle, Play, Pause, Zap } from 'lucide-react';
import { auth } from './firebase';
import { API_BASE } from './api';

const API = API_BASE;

export default function DashcamView({ onClose, onDetect }) {
  const [isActive, setIsActive] = useState(false);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [lastDetection, setLastDetection] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [totalHazards, setTotalHazards] = useState(0);

  useEffect(() => {
    let stream = null;
    if (isActive) {
      navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        .then(s => {
          stream = s;
          if (videoRef.current) videoRef.current.srcObject = s;
        })
        .catch(err => console.error("Camera error:", err));
    }
    return () => {
      if (stream) stream.getTracks().forEach(track => track.stop());
    };
  }, [isActive]);

  // Real AI Detection Loop
  useEffect(() => {
    let interval = null;
    if (isActive) {
      interval = setInterval(async () => {
        if (isProcessing) return;
        captureAndAnalyze();
      }, 1500); // Analyze every 1.5 seconds
    }
    return () => clearInterval(interval);
  }, [isActive, isProcessing]);

  async function captureAndAnalyze() {
    if (!videoRef.current || !canvasRef.current) return;
    
    setIsProcessing(true);
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    // Set canvas dimensions to match video
    if (video.videoWidth) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);

        canvas.toBlob(async (blob) => {
          if (!blob) {
              setIsProcessing(false);
              return;
          }
          const formData = new FormData();
          formData.append('file', blob, 'frame.jpg');

          try {
            let token = '';
            if (auth.currentUser) {
              token = await auth.currentUser.getIdToken();
            }
            const response = await fetch(`${API}/reports/analyze`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${token}`
              },
              body: formData,
            });
            const data = await response.json();

            if (data.status === 'success' && data.detections && data.detections.length > 0) {
              const primary = data.detections[0];
              setLastDetection({
                type: primary.type,
                severity: primary.severity,
                confidence: primary.confidence
              });
              setTotalHazards(prev => prev + 1);
              onDetect(primary); // Pass real data back to main app
              
              // Clear notification after 3 seconds
              setTimeout(() => setLastDetection(null), 3000);
            }
          } catch (err) {
            console.error("AI Analysis failed:", err);
          } finally {
            setIsProcessing(false);
          }
        }, 'image/jpeg', 0.8);
    } else {
        setIsProcessing(false);
    }
  }

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: '#000', zIndex: 10000, display: 'flex', flexDirection: 'column' }}>
      
      {/* Hidden canvas for frame capture */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {/* Video Feed Background */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {isActive ? (
          <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ color: '#333', textAlign: 'center' }}>
            <div style={{ position: 'relative', display: 'inline-block', marginBottom: 24 }}>
                <Camera size={100} style={{ opacity: 0.1 }} />
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Play size={40} color="#38bdf8" />
                </div>
            </div>
            <p style={{ color: '#94a3b8', fontSize: '1.1rem', fontWeight: 600 }}>Ready for AI Dashcam Mode</p>
            <p style={{ color: '#475569', fontSize: '0.8rem', marginTop: 8 }}>Mount device and tap START below</p>
          </div>
        )}

        {/* HUD Overlays */}
        <div style={{ position: 'absolute', top: 20, left: 20, right: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <button onClick={onClose} style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(0,0,0,0.5)', border: 'none', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <X size={24} />
          </button>
          
          <div className="glass" style={{ padding: '10px 20px', background: 'rgba(2,6,23,0.8)', border: '1px solid rgba(56,189,248,0.2)', color: 'white', borderRadius: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ position: 'relative' }}>
                <Shield size={18} color={isActive ? '#38bdf8' : '#64748b'} />
                {isActive && <div style={{ position: 'absolute', inset: -4, borderRadius: '50%', border: '2px solid #38bdf8', animation: 'ping 2s infinite' }} />}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontWeight: 900, fontSize: '0.7rem', letterSpacing: '0.1em', color: isActive ? '#38bdf8' : '#64748b' }}>
                    {isActive ? 'AI PROCESSING ACTIVE' : 'SYSTEM STANDBY'}
                </span>
                <span style={{ fontSize: '0.6rem', color: '#64748b' }}>MOD: RDD-INDIA-V1.0</span>
            </div>
          </div>
        </div>

        {/* Real-time Detection Notification */}
        {lastDetection && (
          <div style={{ position: 'absolute', top: '40%', left: '50%', transform: 'translate(-50%, -50%)', pointerEvents: 'none', width: '80%' }}>
             <div className="glass" style={{ 
                 background: 'rgba(2,6,23,0.9)', 
                 padding: '24px', 
                 borderRadius: 24, 
                 color: 'white', 
                 border: '2px solid #ef4444',
                 display: 'flex',
                 flexDirection: 'column',
                 alignItems: 'center',
                 gap: 12,
                 boxShadow: '0 0 40px rgba(239, 68, 68, 0.4)',
                 animation: 'alert-in 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)'
             }}>
                <div style={{ background: '#ef4444', color: 'white', padding: '4px 12px', borderRadius: 8, fontSize: '0.7rem', fontWeight: 900 }}>HAZARD DETECTED</div>
                <div style={{ fontSize: '1.8rem', fontWeight: 900, textAlign: 'center' }}>{lastDetection.type.toUpperCase()}</div>
                <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.6rem', color: '#94a3b8', fontWeight: 800 }}>SEVERITY</span>
                        <span style={{ fontSize: '1.2rem', fontWeight: 900, color: '#ef4444' }}>{lastDetection.severity}/5</span>
                    </div>
                    <div style={{ width: 1, height: 24, background: 'rgba(255,255,255,0.1)' }} />
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.6rem', color: '#94a3b8', fontWeight: 800 }}>CONFIDENCE</span>
                        <span style={{ fontSize: '1.2rem', fontWeight: 900, color: '#38bdf8' }}>{Math.round(lastDetection.confidence * 100)}%</span>
                    </div>
                </div>
             </div>
          </div>
        )}

        {/* Scanline Effect */}
        {isActive && (
            <div style={{ position: 'absolute', left: 0, right: 0, height: '1px', background: 'rgba(56,189,248,0.5)', boxShadow: '0 0 10px #38bdf8', animation: 'scan 4s linear infinite', zIndex: 5 }} />
        )}
      </div>

      {/* Control Bar */}
      <div style={{ height: 180, background: '#020617', padding: '0 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ color: '#64748b', fontSize: '0.7rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Session Analytics</div>
          <div style={{ color: 'white', fontSize: '1.5rem', fontWeight: 900 }}>{totalHazards} <span style={{ fontSize: '0.8rem', color: '#38bdf8', fontWeight: 700 }}>LOGGED</span></div>
        </div>

        <button 
          onClick={() => setIsActive(!isActive)}
          style={{ width: 88, height: 88, borderRadius: '50%', background: isActive ? '#ef4444' : '#38bdf8', border: 'none', color: '#020617', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 12px 32px ${isActive ? 'rgba(239, 68, 68, 0.4)' : 'rgba(56,189,248,0.4)'}`, transition: 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)', cursor: 'pointer' }}
        >
          {isActive ? <Pause size={36} fill="currentColor" /> : <Play size={36} fill="currentColor" style={{ marginLeft: 6 }} />}
        </button>

        <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ color: '#64748b', fontSize: '0.7rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Vision Link</div>
          <div style={{ color: '#10b981', fontSize: '1.1rem', fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
              <Zap size={16} fill="currentColor" />
              ULTRA-LATENCY
          </div>
        </div>
      </div>

      <style>{`
        @keyframes ping {
          0% { transform: scale(1); opacity: 1; }
          100% { transform: scale(2); opacity: 0; }
        }
        @keyframes scan {
            0% { top: 0; }
            100% { top: 100%; }
        }
        @keyframes alert-in {
            0% { transform: translate(-50%, -50%) scale(0.5); opacity: 0; }
            100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
