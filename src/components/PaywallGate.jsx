import { Link } from 'react-router-dom';
import { Crown } from 'lucide-react';
import { isPro } from '@/lib/mathActions';
import Logo from './Logo';
import GradeBadge from './GradeBadge';

export default function PaywallGate({ reason = 'אזלו לך הפעולות החינמיות' }) {
  return (
    <div className="card-base p-6 text-center animate-fade-in">
      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-violet-500 grid place-items-center mx-auto mb-4 ring-glow">
        <Crown className="w-7 h-7 text-white" />
      </div>
      <h3 className="text-lg font-bold mb-1">שדרוג ל-MathAI Pro</h3>
      <p className="text-sm text-muted-foreground mb-5 max-w-sm mx-auto">{reason}. שדרג לפרימיום לפעולות ללא הגבלה, או רכוש חבילת פעולות חד-פעמית.</p>
      <Link to="/paywall" className="inline-flex items-center gap-2 bg-gradient-to-l from-violet-500 to-cyan-400 text-white font-bold px-6 py-3 rounded-xl btn-glow hover:opacity-95 transition">
        <Crown className="w-4 h-4" /> עבור לפרימיום
      </Link>
    </div>
  );
}