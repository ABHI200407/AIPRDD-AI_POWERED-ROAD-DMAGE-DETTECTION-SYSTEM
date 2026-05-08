import { useState, useEffect } from 'react';
import { auth, googleProvider, signInWithPopup, RecaptchaVerifier, signInWithPhoneNumber } from './firebase';
import { Shield, Smartphone, Globe, LogIn, ChevronRight, X } from 'lucide-react';

export default function LoginView({ onLogin, onGuest }) {
  const [method, setMethod] = useState('select'); // 'select', 'phone'
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [confirmationResult, setConfirmationResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // Check if user is already signed in
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        onLogin({ id: user.uid, type: 'authenticated', email: user.email, phone: user.phoneNumber });
      }
    });
    return () => unsubscribe();
  }, [onLogin]);

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      setError('');
      const result = await signInWithPopup(auth, googleProvider);
      onLogin({ id: result.user.uid, type: 'authenticated', email: result.user.email });
    } catch (err) {
      console.error(err);
      setError('Google Sign-In failed. Check configuration.');
    } finally {
      setLoading(false);
    }
  };

  const setupRecaptcha = () => {
    if (!window.recaptchaVerifier) {
      window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
        size: 'invisible'
      });
    }
  };

  const handleSendOtp = async (e) => {
    e.preventDefault();
    if (!phone) return;
    try {
      setLoading(true);
      setError('');
      setupRecaptcha();
      const formattedPhone = phone.startsWith('+') ? phone : `+91${phone}`; // Default to India +91
      const confirmation = await signInWithPhoneNumber(auth, formattedPhone, window.recaptchaVerifier);
      setConfirmationResult(confirmation);
    } catch (err) {
      console.error(err);
      setError('Failed to send OTP. Ensure phone format is +91XXXXXXXXXX.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (!otp || !confirmationResult) return;
    try {
      setLoading(true);
      setError('');
      const result = await confirmationResult.confirm(otp);
      onLogin({ id: result.user.uid, type: 'authenticated', phone: result.user.phoneNumber });
    } catch (err) {
      console.error(err);
      setError('Invalid OTP code.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ height: '100%', width: '100%', background: 'linear-gradient(to bottom, #0f172a, #020617)', display: 'flex', flexDirection: 'column', color: 'white', position: 'absolute', top: 0, left: 0, zIndex: 9999 }}>
      
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 24px' }}>
        
        <div style={{ width: 80, height: 80, borderRadius: '24px', background: 'linear-gradient(135deg, #38bdf8, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24, boxShadow: '0 12px 32px rgba(56,189,248,0.4)' }}>
          <Shield size={40} color="white" />
        </div>
        
        <h1 style={{ fontSize: '2rem', fontWeight: 900, marginBottom: 8, letterSpacing: '-0.02em', textAlign: 'center' }}>Alive Navigation</h1>
        <p style={{ color: '#94a3b8', textAlign: 'center', marginBottom: 40, lineHeight: 1.5, fontSize: '0.95rem' }}>
          Your AI-powered civic co-pilot. Help make city roads safer and get rewarded.
        </p>

        {error && (
          <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#fca5a5', padding: '12px 16px', borderRadius: '12px', width: '100%', maxWidth: 320, marginBottom: 24, fontSize: '0.85rem', textAlign: 'center' }}>
            {error}
          </div>
        )}

        <div style={{ width: '100%', maxWidth: 320, display: 'flex', flexDirection: 'column', gap: 16 }}>
          
          {method === 'select' && (
            <>
              <button 
                onClick={handleGoogleLogin} 
                disabled={loading}
                style={{ width: '100%', padding: '16px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: 'white', fontWeight: 700, fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, cursor: 'pointer', transition: 'all 0.2s' }}
              >
                <Globe size={20} color="#38bdf8" />
                {loading ? 'Connecting...' : 'Continue with Google'}
              </button>

              <button 
                onClick={() => setMethod('phone')} 
                style={{ width: '100%', padding: '16px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.02)', color: 'white', fontWeight: 700, fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, cursor: 'pointer', transition: 'all 0.2s' }}
              >
                <Smartphone size={20} color="#8b5cf6" />
                Phone Number (OTP)
              </button>

              <button 
                onClick={onGuest} 
                style={{ width: '100%', padding: '16px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.02)', color: '#94a3b8', fontWeight: 700, fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, cursor: 'pointer', transition: 'all 0.2s' }}
              >
                Continue as Guest
                <ChevronRight size={18} />
              </button>

            </>
          )}

          {method === 'phone' && !confirmationResult && (
            <form onSubmit={handleSendOtp} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <button type="button" onClick={() => setMethod('select')} style={{ background: 'transparent', border: 'none', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', padding: 0, width: 'max-content' }}>
                <X size={16} /> Cancel
              </button>
              
              <div>
                <label style={{ display: 'block', marginBottom: 8, fontSize: '0.85rem', color: '#cbd5e1', fontWeight: 600 }}>Phone Number</label>
                <input 
                  type="tel" 
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98765 43210" 
                  style={{ width: '100%', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.3)', color: 'white', fontSize: '1.1rem', outline: 'none' }}
                  required
                />
              </div>
              <button 
                type="submit" 
                disabled={loading}
                style={{ width: '100%', padding: '16px', borderRadius: '12px', border: 'none', background: '#38bdf8', color: '#020617', fontWeight: 800, fontSize: '1rem', cursor: 'pointer' }}
              >
                {loading ? 'Sending...' : 'Send OTP'}
              </button>
            </form>
          )}

          {method === 'phone' && confirmationResult && (
            <form onSubmit={handleVerifyOtp} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', marginBottom: 8, fontSize: '0.85rem', color: '#cbd5e1', fontWeight: 600 }}>Enter OTP Code</label>
                <input 
                  type="text" 
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  placeholder="123456" 
                  style={{ width: '100%', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.3)', color: 'white', fontSize: '1.2rem', textAlign: 'center', letterSpacing: '0.5em', outline: 'none' }}
                  required
                />
              </div>
              <button 
                type="submit" 
                disabled={loading}
                style={{ width: '100%', padding: '16px', borderRadius: '12px', border: 'none', background: '#38bdf8', color: '#020617', fontWeight: 800, fontSize: '1rem', cursor: 'pointer' }}
              >
                {loading ? 'Verifying...' : 'Verify & Login'}
              </button>
            </form>
          )}

        </div>
        
      </div>
      
      <div id="recaptcha-container"></div>
      
      <p style={{ textAlign: 'center', padding: '24px', color: '#64748b', fontSize: '0.75rem' }}>
        By continuing, you agree to our Terms of Service & Privacy Policy.
      </p>
    </div>
  );
}
