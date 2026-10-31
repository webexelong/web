import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { useAuthStore } from '../store/authStore';
import SettingsDropdown from '../components/SettingsDropdown';
import NotificationBell from '../components/NotificationBell';

export default function StaffLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { orders, fetchOrders, initRealtime, currentStoreId } = useStore();
  const { logout, user } = useAuthStore();
  const currentStoreName = user?.storeName || user?.brandName || 'Cửa hàng hiện tại';

  // Initialize once on mount
  useEffect(() => {
    fetchOrders(currentStoreId);
    initRealtime(currentStoreId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty deps - only run once on mount

  // Realtime pending/preparing orders count
  const pendingCount = orders.filter(o => o.status === 'pending').length;
  const preparingCount = orders.filter(o => o.status === 'preparing').length;
  const activeOrdersCount = pendingCount + preparingCount;

  return (
    <div className="flex min-h-screen bg-background font-body-md text-on-surface">
      {/* TopAppBar */}
      <header className="fixed top-0 left-0 w-full z-40 flex justify-between items-center px-3 sm:px-6 h-[104px] bg-surface/95 backdrop-blur-md dark:bg-[#1C1613]/95 shadow-xs border-b border-outline-variant/15 dark:border-white/5 transition-colors">
        <div className="flex items-center gap-2 sm:gap-4">
          <button 
            className="md:hidden p-1.5 text-on-surface-variant hover:bg-surface-variant rounded-full transition-colors flex items-center justify-center" 
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label="Toggle Staff Menu"
          >
            <span className="material-symbols-outlined text-2xl">{isMobileMenuOpen ? 'close' : 'menu'}</span>
          </button>
          <div className="flex items-center gap-1.5 cursor-pointer" onClick={() => navigate('/staff/dashboard')}>
            <span className="material-symbols-outlined text-primary text-xl hidden sm:inline-block" style={{ fontVariationSettings: "'FILL' 1" }}>local_cafe</span>
            <h1 className="text-base sm:text-xl font-black text-primary dark:text-primary-fixed-dim whitespace-nowrap tracking-tight">
              AI-SMARTSERVE
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-container-low dark:bg-surface-dim transition-all focus-within:ring-2 ring-primary/20">
            <span className="material-symbols-outlined text-on-surface-variant text-lg">search</span>
            <input className="bg-transparent border-none focus:ring-0 text-xs text-on-surface-variant w-40 outline-none" placeholder="Tìm đơn hàng..." type="text" />
          </div>
          
          {/* Realtime Notification Bell */}
          <NotificationBell storeId={currentStoreId} isAdmin={false} />
          
          {/* Settings Dropdown with Staff Sound Control */}
          <SettingsDropdown isStaff />
          
          <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-full overflow-hidden border border-outline-variant shrink-0">
            <img className="w-full h-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAoIJV4b1TkjJNBv6lp6U10KgMWD0nrpBYjnQ6VckiyLjwh0QDzlQEjQYuEnI_uGgO2j58tuyjYPahvT4FMtUHAYvu6I0Zvp8CF5dOHzShckrD7RYBq9ram42N6UZGIqoAz_rnuci-PWHZGC9LzNFU0giX4JzIFOQH6bmsYlDvvyGN0v_DFWMPs_gS48r522GKqbnibANoRX8YgiBAH5t4KHAaJKgubHTX_YbbAvq_h7Kb7UnXUsaLp" alt="Staff" />
          </div>
        </div>
      </header>

      {/* Mobile Menu Backdrop */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 md:hidden transition-opacity" 
          onClick={() => setIsMobileMenuOpen(false)} 
        />
      )}

      {/* SideNavBar (Desktop & Mobile Drawer) */}
      <aside className={`fixed left-0 top-0 bottom-0 md:top-[104px] w-64 flex flex-col p-4 z-50 md:z-30 bg-surface md:bg-surface-container-low dark:bg-[#1C1613] border-r border-outline-variant/15 dark:border-white/5 transition-transform duration-300 shadow-2xl md:shadow-none ${
        isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
      }`}>
        <div className="flex flex-col items-center py-4 mb-2 border-b border-outline-variant/10 md:border-none cursor-pointer" onClick={() => { setIsMobileMenuOpen(false); navigate('/staff/dashboard'); }}>
          <div className="w-12 h-12 rounded-2xl bg-primary-container flex items-center justify-center mb-2 shadow-xs">
            <span className="material-symbols-outlined text-on-primary-container text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>local_cafe</span>
          </div>
          <h2 className="text-sm font-black text-primary">CỔNG NHÂN VIÊN</h2>
          <p className="text-[11px] text-on-surface-variant opacity-70 truncate max-w-[190px]">{currentStoreName}</p>
        </div>
        
        <nav className="flex-1 space-y-1.5 overflow-y-auto py-2">
          {/* Item 1: Live Orders */}
          <Link 
            to="/staff/orders" 
            onClick={() => setIsMobileMenuOpen(false)} 
            className={`flex items-center justify-between rounded-xl px-3.5 py-2.5 transition-all text-xs font-bold ${
              location.pathname.endsWith('/orders') 
              ? 'bg-secondary-container dark:bg-white/5 dark:border dark:border-amber-600/40 text-on-secondary-container dark:text-white dark:rounded-full shadow-xs' 
              : 'text-on-surface-variant dark:text-[#A4968C] hover:bg-surface-variant/40 dark:hover:bg-white/5'
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-lg">assignment</span>
              <span>Đơn Hàng Trực Tiếp</span>
            </div>
            {activeOrdersCount > 0 && (
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                pendingCount > 0 ? 'bg-amber-400 text-stone-950 animate-pulse' : 'bg-primary/20 dark:bg-amber-500/20 text-primary dark:text-amber-300'
              }`}>
                {activeOrdersCount}
              </span>
            )}
          </Link>
          
          {/* Item 2: Shift Dashboard & Live Metrics */}
          <Link 
            to="/staff/dashboard" 
            onClick={() => setIsMobileMenuOpen(false)} 
            className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 transition-all text-xs font-bold ${
              location.pathname.endsWith('/dashboard') 
              ? 'bg-secondary-container dark:bg-white/5 dark:border dark:border-amber-600/40 text-on-secondary-container dark:text-white dark:rounded-full shadow-xs' 
              : 'text-on-surface-variant dark:text-[#A4968C] hover:bg-surface-variant/40 dark:hover:bg-white/5'
            }`}
          >
            <span className="material-symbols-outlined text-lg">dashboard</span>
            <span>Tổng Quan Ca Làm</span>
          </Link>

          {/* Item 3: Quick POS Order */}
          <Link 
            to="/staff/new-order" 
            onClick={() => setIsMobileMenuOpen(false)} 
            className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 transition-all text-xs font-bold ${
              location.pathname.endsWith('/new-order') 
              ? 'bg-secondary-container dark:bg-white/5 dark:border dark:border-amber-600/40 text-on-secondary-container dark:text-white dark:rounded-full shadow-xs' 
              : 'text-on-surface-variant dark:text-[#A4968C] hover:bg-surface-variant/40 dark:hover:bg-white/5'
            }`}
          >
            <span className="material-symbols-outlined text-lg">point_of_sale</span>
            <span>Bán Hàng Tại Quầy (POS)</span>
          </Link>

        </nav>
        
        <div className="pt-3 border-t border-outline-variant/15 dark:border-white/5 mt-auto">
          <button 
            onClick={() => { setIsMobileMenuOpen(false); navigate('/staff/new-order'); }} 
            className="w-full mb-2 py-2.5 bg-primary text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all hover:bg-primary-container active:scale-95 shadow-xs"
          >
            <span className="material-symbols-outlined text-base">add</span>
            + Tạo Đơn Tại Quầy
          </button>
          
          <button 
            onClick={() => { 
              setIsMobileMenuOpen(false);
              logout();
              navigate('/login');
            }} 
            className="w-full flex items-center gap-2.5 text-error px-3 py-2 hover:bg-error/10 rounded-xl transition-all text-xs font-bold text-left"
          >
            <span className="material-symbols-outlined text-base">logout</span>
            <span>Đăng Xuất</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 md:ml-64 mt-[104px] p-3 sm:p-6 md:p-8 overflow-y-auto max-w-full">
        <Outlet />
      </main>
    </div>
  );
}
