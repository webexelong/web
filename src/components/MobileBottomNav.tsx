import { Link, useLocation } from 'react-router-dom';
import { useStore } from '../store/useStore';

export default function MobileBottomNav() {
  const location = useLocation();
  const path = location.pathname;
  const activeOrder = useStore(state => state.activeOrder);
  const guestSession = useStore(state => state.guestSession);

  const isHome = path === '/' || path === '/menu';
  const isAi = path === '/ai-suggest';
  const isTracking = path.startsWith('/tracking');
  const isOrderSuccess = path.startsWith('/order-success');
  const isHistory = path === '/history';
  const isOrderActive = isTracking || isOrderSuccess || Boolean(activeOrder || guestSession?.guestId);
  const isProfile = path === '/profile';

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 bg-surface shadow-[0_-2px_10px_rgba(0,0,0,0.05)] px-container-margin py-2.5 flex justify-around items-center z-[100] border-t border-outline-variant/10">
      <Link to="/" className={`flex flex-col items-center transition-colors ${isHome ? 'text-primary font-bold' : 'text-on-surface-variant hover:text-primary'}`}>
        <span className="material-symbols-outlined text-xl" style={isHome ? { fontVariationSettings: "'FILL' 1" } : {}}>home</span>
        <span className="text-[10px] font-bold mt-0.5">Trang chủ</span>
      </Link>

      <Link to="/ai-suggest" className={`flex flex-col items-center transition-colors relative ${isAi ? 'text-amber-600 font-bold' : 'text-on-surface-variant hover:text-amber-600'}`}>
        <div className="relative">
          <span className="material-symbols-outlined text-xl text-amber-500" style={isAi ? { fontVariationSettings: "'FILL' 1" } : {}}>auto_awesome</span>
          <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-500 animate-ping" />
        </div>
        <span className="text-[10px] font-bold mt-0.5">Hỏi AI</span>
      </Link>

      <Link to={activeOrder ? `/tracking?code=${encodeURIComponent(activeOrder.orderCode || activeOrder.id)}` : guestSession?.guestId ? `/tracking?guestId=${encodeURIComponent(guestSession.guestId)}` : '/history'} className={`flex flex-col items-center transition-colors ${(isOrderActive || isHistory) ? 'text-primary font-bold' : 'text-on-surface-variant hover:text-primary'}`}>
        <div className="relative">
          <span className="material-symbols-outlined text-xl" style={(isOrderActive || isHistory) ? { fontVariationSettings: "'FILL' 1" } : {}}>receipt_long</span>
          {isOrderActive && <span className="absolute -top-1 -right-1 w-2 h-2 bg-error rounded-full animate-pulse"></span>}
        </div>
        <span className="text-[10px] font-bold mt-0.5">Đơn hàng</span>
      </Link>

      <Link to="/profile" className={`flex flex-col items-center transition-colors ${isProfile ? 'text-primary font-bold' : 'text-on-surface-variant hover:text-primary'}`}>
        <span className="material-symbols-outlined text-xl" style={isProfile ? { fontVariationSettings: "'FILL' 1" } : {}}>person</span>
        <span className="text-[10px] font-bold mt-0.5">Cá nhân</span>
      </Link>
    </div>
  );
}
