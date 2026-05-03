import { useState } from 'react';
import { Navigation, Camera, Zap, ChevronRight, Check } from 'lucide-react';

export default function Onboarding({ onComplete }) {
  const [step, setStep] = useState(0);

  const slides = [
    {
      icon: <Navigation size={64} color="#38bdf8" />,
      title: "Navigate Safely",
      desc: "Alive Navigation routes you around severe potholes and bad road conditions to protect your vehicle."
    },
    {
      icon: <Camera size={64} color="#8b5cf6" />,
      title: "Report & Earn",
      desc: "Snap photos of road damage. Our AI analyzes the severity, and you earn points for helping the city."
    },
    {
      icon: <Zap size={64} color="#f59e0b" />,
      title: "Shadow Drive",
      desc: "Drive normally while your phone's sensors automatically detect hidden bumps in the background."
    }
  ];

  return (
    <div style={{ height: '100%', width: '100%', background: '#020617', display: 'flex', flexDirection: 'column', color: 'white', position: 'absolute', top: 0, left: 0, zIndex: 9998 }}>
      
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 32px' }}>
        
        <div style={{ display: 'flex', gap: 8, marginBottom: 40 }}>
          {slides.map((_, i) => (
            <div key={i} style={{ height: 4, width: step === i ? 24 : 8, borderRadius: 2, background: step === i ? '#38bdf8' : 'rgba(255,255,255,0.2)', transition: 'all 0.3s' }} />
          ))}
        </div>

        <div style={{ width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,255,255,0.03)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 32, border: '1px solid rgba(255,255,255,0.05)' }}>
          {slides[step].icon}
        </div>

        <h2 style={{ fontSize: '1.8rem', fontWeight: 800, marginBottom: 16, textAlign: 'center' }}>
          {slides[step].title}
        </h2>
        
        <p style={{ color: '#94a3b8', textAlign: 'center', lineHeight: 1.6, fontSize: '1.05rem' }}>
          {slides[step].desc}
        </p>

      </div>

      <div style={{ padding: '32px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button 
          onClick={onComplete}
          style={{ background: 'transparent', border: 'none', color: '#64748b', fontSize: '0.9rem', fontWeight: 600, padding: '12px', cursor: 'pointer' }}
        >
          Skip
        </button>
        
        <button 
          onClick={() => step < slides.length - 1 ? setStep(step + 1) : onComplete()}
          style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#38bdf8', color: '#020617', border: 'none', padding: '12px 24px', borderRadius: '999px', fontSize: '0.95rem', fontWeight: 800, cursor: 'pointer', boxShadow: '0 8px 16px rgba(56,189,248,0.3)' }}
        >
          {step < slides.length - 1 ? (
            <>Next <ChevronRight size={18} /></>
          ) : (
            <>Get Started <Check size={18} /></>
          )}
        </button>
      </div>

    </div>
  );
}
