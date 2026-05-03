import { useState } from 'react';
import { Gift, Zap, Coffee, Fuel, ShieldCheck, ChevronRight, CheckCircle } from 'lucide-react';

export default function RewardsView({ points, onRedeem }) {
  const [redeemed, setRedeemed] = useState([]);

  const OFFERS = [
    { id: 'coffee', title: 'Free Starbucks Coffee', cost: 150, icon: <Coffee size={24} />, color: '#00704A', desc: 'Any tall size beverage' },
    { id: 'fuel', title: '₹500 Fuel Voucher', cost: 1000, icon: <Fuel size={24} />, color: '#ea580c', desc: 'Valid at BPCL stations' },
    { id: 'insurance', title: 'Insurance Discount', cost: 2500, icon: <ShieldCheck size={24} />, color: '#2563eb', desc: '5% off on your next renewal' },
    { id: 'service', title: 'Vehicle Health Check', cost: 500, icon: <Zap size={24} />, color: '#8b5cf6', desc: 'Free suspension alignment' },
  ];

  const handleRedeem = (offer) => {
    if (points >= offer.cost) {
      onRedeem(offer.cost);
      setRedeemed([...redeemed, offer.id]);
    }
  };

  return (
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 20, paddingBottom: 100 }}>
      <div className="glass" style={{ padding: '24px 20px', background: 'linear-gradient(135deg, rgba(56,189,248,0.1), rgba(139,92,246,0.1))', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 1 }}>Your Balance</div>
          <div style={{ fontSize: '2.2rem', fontWeight: 900, color: 'white' }}>{points} <span style={{ fontSize: '1rem', color: 'var(--primary)' }}>pts</span></div>
        </div>
        <Gift size={40} color="var(--primary)" />
      </div>

      <h3 style={{ fontSize: '1.2rem', fontWeight: 800 }}>Available Rewards</h3>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {OFFERS.map(offer => {
          const isRedeemed = redeemed.includes(offer.id);
          const canAfford = points >= offer.cost;

          return (
            <div key={offer.id} className="glass" style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 16, opacity: canAfford || isRedeemed ? 1 : 0.6 }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: `${offer.color}20`, color: offer.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {offer.icon}
              </div>
              
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{offer.title}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{offer.desc}</div>
              </div>

              <div style={{ textAlign: 'right' }}>
                {isRedeemed ? (
                  <div style={{ color: 'var(--success)', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 700, fontSize: '0.8rem' }}>
                    <CheckCircle size={14} /> Claimed
                  </div>
                ) : (
                  <button 
                    onClick={() => handleRedeem(offer)}
                    disabled={!canAfford}
                    style={{ background: canAfford ? 'var(--primary)' : 'rgba(255,255,255,0.05)', color: canAfford ? '#020617' : 'var(--text-muted)', border: 'none', padding: '8px 12px', borderRadius: 8, fontSize: '0.8rem', fontWeight: 800, cursor: canAfford ? 'pointer' : 'default', transition: 'all 0.2s' }}
                  >
                    {offer.cost} pts
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
