import { lazy, Suspense, useState } from 'react';
import { Outlet, Link } from 'react-router-dom';
import { Coffee, ShoppingCart, Sparkles } from 'lucide-react';
import { useStore } from '../store/useStore';
import { useAuthStore } from '../store/authStore';
import UserMenu from '../components/UserMenu';

const AuthModal = lazy(() => import('../components/AuthModal'));

export default function CustomerLayout() {
  const cart = useStore(state => state.cart);
  const guestSession = useStore(state => state.guestSession);
  const cartCount = cart.reduce((acc, item) => acc + item.quantity, 0);
  
  const { isAuthenticated, user } = useAuthStore();
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  const handleUserIconClick = () => {
    if (isAuthenticated) {
      setIsUserMenuOpen(!isUserMenuOpen);
    } else {
      setIsAuthModalOpen(true);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background font-body-md text-on-surface">
      {/* Header/TopAppBar - Responsive */}
      <header className="sticky top-0 z-50 w-full bg-surface/95 backdrop-blur-md border-b border-outline-variant/10 shadow-sm h-[104px] flex items-center">
        <div className="flex justify-between items-center px-4 sm:px-6 md:px-8 w-full max-w-7xl mx-auto">
          {/* Left: Logo + Brand */}
          <Link 
            to="/menu" 
            className="flex items-center gap-2 sm:gap-3 text-primary hover:opacity-90 transition-opacity"
          >
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-primary to-primary-container rounded-xl flex items-center justify-center shadow-md">
              <Coffee size={24} className="text-white" />
            </div>
            <h1 className="text-lg sm:text-xl md:text-2xl font-black tracking-tight whitespace-nowrap">
              AI-SMARTSERVE
            </h1>
          </Link>

          {/* Right: Table Badge + Ask AI + Login/User + Cart */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Ask AI Sommelier Button (Desktop & Tablet only - Mobile uses bottom nav) */}
            <Link
              to="/ai-suggest"
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 bg-gradient-to-r from-amber-500/15 via-amber-400/20 to-primary/10 border border-amber-500/40 rounded-full text-xs font-bold text-amber-900 hover:shadow-xs hover:scale-105 active:scale-95 transition-all"
            >
              <Sparkles size={14} className="text-amber-600 animate-pulse" />
              <span>Hỏi AI Sommelier</span>
            </Link>

            {/* Table Badge */}
            {(guestSession?.tableNumber || guestSession?.tableId) && (
              <div className="flex items-center gap-1 sm:gap-1.5 px-2.5 py-1 sm:px-3 sm:py-1.5 bg-amber-500/10 text-amber-900 border border-amber-500/30 rounded-full shadow-xs">
                <span className="material-symbols-outlined text-xs sm:text-sm text-amber-700">table_restaurant</span>
                <span className="text-[11px] sm:text-xs font-bold text-amber-900 whitespace-nowrap">
                  {guestSession.tableNumber?.toLowerCase().includes('bàn')
                    ? guestSession.tableNumber
                    : `Bàn ${guestSession.tableNumber || guestSession.tableId}`}
                </span>
              </div>
            )}

            {/* Login/User Button Container */}
            {!isAuthenticated ? (
              <button
                onClick={() => setIsAuthModalOpen(true)}
                className="flex items-center gap-1 sm:gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 active:scale-95 text-white font-bold text-xs sm:text-sm rounded-full shadow-xs transition-all"
                aria-label="Đăng nhập tài khoản"
              >
                <span className="material-symbols-outlined text-sm sm:text-base">login</span>
                <span>Đăng Nhập</span>
              </button>
            ) : (
              <div className="relative">
                <button
                  onClick={handleUserIconClick}
                  className="flex items-center gap-2 p-1 sm:px-2.5 sm:py-1.5 rounded-full hover:bg-surface-container-high transition-all text-primary border border-outline-variant/30"
                  aria-label="Menu người dùng"
                >
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-tr from-orange-500 to-amber-500 text-white font-black text-xs sm:text-sm flex items-center justify-center shadow-xs">
                    {user?.fullName ? user.fullName.charAt(0).toUpperCase() : (user?.username?.charAt(0).toUpperCase() || 'U')}
                  </div>
                  <span className="hidden md:inline-block text-xs font-bold text-gray-800 max-w-[120px] truncate">
                    {user?.fullName || user?.username}
                  </span>
                  <span className="material-symbols-outlined text-sm text-gray-500 hidden sm:inline-block">expand_more</span>
                </button>

                {/* User Menu Dropdown */}
                <UserMenu isOpen={isUserMenuOpen} onClose={() => setIsUserMenuOpen(false)} />
              </div>
            )}

            {/* Cart Button */}
            <Link 
              to="/cart" 
              className="relative p-2 sm:p-2.5 rounded-full hover:bg-surface-container-high transition-all text-primary flex items-center justify-center"
              aria-label="Giỏ hàng"
            >
              <ShoppingCart className="w-5 h-5 sm:w-6 sm:h-6" />
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-error text-white rounded-full w-5 h-5 sm:w-6 sm:h-6 text-[10px] sm:text-xs font-bold flex items-center justify-center shadow-md animate-pulse">
                  {cartCount}
                </span>
              )}
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content - Full width responsive */}
      <main className="flex-1 w-full">
        <Outlet />
      </main>

      {/* Footer (Desktop & Tablet only - Mobile uses bottom nav) */}
      <footer className="hidden md:block w-full mt-auto bg-surface-container-highest border-t border-outline-variant/20 py-6 px-4 sm:px-6 md:px-8">
        <div className="flex flex-col md:flex-row justify-between items-center max-w-7xl mx-auto gap-4">
          <div className="flex flex-col gap-1 items-center md:items-start text-center md:text-left">
            <span className="text-base sm:text-xl text-primary font-bold">AI-SMARTSERVE</span>
            <p className="text-xs text-on-surface-variant">© 2024 AI-SMARTSERVE. Pha chế thủ công cho thói quen mỗi ngày của bạn.</p>
          </div>
          <div className="flex flex-wrap justify-center gap-4 text-xs text-on-surface-variant">
            <a className="hover:text-primary transition-colors cursor-pointer">Chính Sách</a>
            <a className="hover:text-primary transition-colors cursor-pointer">Điều Khoản</a>
            <a className="hover:text-primary transition-colors cursor-pointer">Liên Hệ</a>
          </div>
        </div>
      </footer>

      {/* Auth Modal */}
      {isAuthModalOpen && (
        <Suspense fallback={null}>
          <AuthModal isOpen onClose={() => setIsAuthModalOpen(false)} />
        </Suspense>
      )}
    </div>
  );
}
