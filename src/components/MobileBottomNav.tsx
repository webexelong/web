import { Link, useLocation } from 'react-router-dom';
import { useStore } from '../store/useStore';

export default function MobileBottomNav() {
  const location = useLocation();
  const path = location.pathname;
  const activeOrder = useStore(state => state.activeOrder);
  const guestSession = useStore(state => state.guestSession);
  const cart = useStore(state => state.cart);
  const cartCount = cart.reduce((acc, item) => acc + item.quantity, 0);

  const isHome = path === '/' || path === '/menu';
  const isAi = path === '/ai-suggest';
  const isCart = path === '/cart';
  const isTracking = path.startsWith('/tracking');
  const isOrderSuccess = path.startsWith('/order-success');
  const isHistory = path === '/history';
  const isOrderActive = isTracking || isOrderSuccess || Boolean(activeOrder || guestSession?.guestId);
  const isProfile = path === '/profile';

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-surface/95 dark:bg-[#1C1613]/95 backdrop-blur-md shadow-[0_-2px_15px_rgba(0,0,0,0.08)] px-2 py-2 flex justify-around items-center z-[100] border-t border-outline-variant/15 dark:border-white/5 transition-colors">
      {/* 1. Trang chủ */}
      <Link 
        to="/" 
        className={`flex flex-col items-center transition-colors py-0.5 px-2 rounded-xl ${
          isHome ? 'text-primary dark:text-[#E8B98A] font-bold' : 'text-on-surface-variant dark:text-[#A4968C] hover:text-primary'
        }`}
      >
        <span className="material-symbols-outlined text-xl" style={isHome ? { fontVariationSettings: "'FILL' 1" } : {}}>home</span>
        <span className="text-[10px] font-bold mt-0.5">Trang chủ</span>
      </Link>

      {/* 2. Hỏi AI */}
      <Link 
        to="/ai-suggest" 
        className={`flex flex-col items-center transition-colors py-0.5 px-2 rounded-xl relative ${
          isAi ? 'text-amber-600 dark:text-amber-400 font-bold' : 'text-on-surface-variant dark:text-[#A4968C] hover:text-amber-600'
        }`}
      >
        <div className="relative">
          <span className="material-symbols-outlined text-xl text-amber-500" style={isAi ? { fontVariationSettings: "'FILL' 1" } : {}}>auto_awesome</span>
          <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-500 animate-ping" />
        </div>
        <span className="text-[10px] font-bold mt-0.5">Hỏi AI</span>
      </Link>

      {/* 3. Giỏ Hàng (Nổi bật trên Mobile) */}
      <Link 
        to="/cart" 
        className={`flex flex-col items-center transition-colors py-0.5 px-2.5 rounded-xl relative ${
          isCart ? 'text-primary dark:text-[#E8B98A] font-bold' : 'text-on-surface-variant dark:text-[#A4968C] hover:text-primary'
        }`}
        aria-label={`Giỏ hàng, ${cartCount} món`}
      >
        <div className="relative">
          <span className="material-symbols-outlined text-2xl" style={isCart ? { fontVariationSettings: "'FILL' 1" } : {}}>shopping_cart</span>
          {cartCount > 0 && (
            <span className="absolute -top-1.5 -right-2.5 bg-red-600 text-white rounded-full min-w-4 h-4 px-1 text-[9px] font-black flex items-center justify-center shadow-md animate-pulse">
              {cartCount > 99 ? '99+' : cartCount}
            </span>
          )}
        </div>
        <span className="text-[10px] font-bold mt-0.5">Giỏ hàng</span>
      </Link>

      {/* 4. Đơn hàng */}
      <Link 
        to={activeOrder ? `/tracking?code=${encodeURIComponent(activeOrder.orderCode || activeOrder.id)}` : guestSession?.guestId ? `/tracking?guestId=${encodeURIComponent(guestSession.guestId)}` : '/history'} 
        className={`flex flex-col items-center transition-colors py-0.5 px-2 rounded-xl ${
          (isOrderActive || isHistory) ? 'text-primary dark:text-[#E8B98A] font-bold' : 'text-on-surface-variant dark:text-[#A4968C] hover:text-primary'
        }`}
      >
        <div className="relative">
          <span className="material-symbols-outlined text-xl" style={(isOrderActive || isHistory) ? { fontVariationSettings: "'FILL' 1" } : {}}>receipt_long</span>
          {isOrderActive && <span className="absolute -top-1 -right-1 w-2 h-2 bg-error rounded-full animate-pulse"></span>}
        </div>
        <span className="text-[10px] font-bold mt-0.5">Đơn hàng</span>
      </Link>

      {/* 5. Cá nhân */}
      <Link 
        to="/profile" 
        className={`flex flex-col items-center transition-colors py-0.5 px-2 rounded-xl ${
          isProfile ? 'text-primary dark:text-[#E8B98A] font-bold' : 'text-on-surface-variant dark:text-[#A4968C] hover:text-primary'
        }`}
      >
        <span className="material-symbols-outlined text-xl" style={isProfile ? { fontVariationSettings: "'FILL' 1" } : {}}>person</span>
        <span className="text-[10px] font-bold mt-0.5">Cá nhân</span>
      </Link>
    </nav>
  );
}
