import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { useStore } from '../store/useStore';
import { meApi } from '../api/apis';
import SettingsDropdown from '../components/SettingsDropdown';
import NotificationBell from '../components/NotificationBell';

export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { user, logout } = useAuthStore();
  const { setStoreId, initRealtime } = useStore();
  const [stores, setStores] = useState<Array<{ storeId: number; name: string }>>([]);
  const [subscription, setSubscription] = useState<{ plan: string; status: string; daysRemaining?: number | null } | null>(null);
  const [selectedStoreId, setSelectedStoreId] = useState<number>(user?.storeId ?? 0);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }

    // Nếu là SuperAdmin đi lạc vào trang quán của Chủ quán, điều hướng về cổng SuperAdmin
    if (user?.role === 'SystemAdmin') {
      navigate('/system-admin', { replace: true });
      return;
    }

    // Nếu là Staff đi lạc vào trang quản lý của Chủ quán, điều hướng về màn hình nhân viên
    if (user?.role === 'Staff') {
      navigate('/staff/orders', { replace: true });
      return;
    }

    const loadStores = async () => {
      try {
        const [storeList, sub] = await Promise.all([
          meApi.getStores(),
          meApi.getSubscription().catch(() => null)
        ]);
        setStores(storeList);
        if (sub) setSubscription(sub);
        if (storeList.length > 0 && !selectedStoreId) {
          const firstId = storeList[0].storeId;
          setSelectedStoreId(firstId);
          setStoreId(firstId);
        }
      } catch (err) {
        console.error('Failed to load stores or subscription', err);
      }
    };
    loadStores();
  }, [navigate, user, selectedStoreId, setStoreId]);

  const handleStoreChange = (storeId: number) => {
    setSelectedStoreId(storeId);
    setStoreId(storeId);
    window.location.reload();
  };

  useEffect(() => {
    const activeStore = selectedStoreId || user?.storeId || 1;
    initRealtime(activeStore);
  }, [selectedStoreId, user?.storeId, initRealtime]);

  const navItems = [
    { path: '/admin', icon: 'dashboard', label: 'Tổng Quan' },
    { path: '/admin/orders', icon: 'receipt_long', label: 'Quản Lý Đơn' },
    { path: '/admin/menu', icon: 'restaurant_menu', label: 'Thực Đơn' },
    { path: '/admin/vouchers', icon: 'local_offer', label: 'Mã Giảm Giá' },
    { path: '/admin/tables', icon: 'table_restaurant', label: 'Bàn & Mã QR' },
    { path: '/admin/inventory', icon: 'inventory_2', label: 'Kho Nguyên Liệu' },
    { path: '/admin/analytics', icon: 'analytics', label: 'Báo Cáo & AI' },
    { path: '/admin/staff', icon: 'badge', label: 'Nhân Viên' },
    { path: '/admin/settings', icon: 'payments', label: 'Cổng Thanh Toán' },
    { path: '/admin/subscription', icon: 'workspace_premium', label: 'Gói Dịch Vụ' },
  ];

  return (
    <div className="flex min-h-screen bg-background font-body-md text-on-surface">
      {/* SideNavBar (Desktop) */}
      <aside className={`fixed left-0 top-0 bottom-0 w-64 flex flex-col p-4 z-50 md:z-30 bg-surface md:bg-surface-container-low dark:bg-[#1C1613] border-r border-outline-variant/15 dark:border-white/5 transition-transform duration-300 shadow-2xl md:shadow-none ${
        isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
      }`}>
        <div className="flex flex-col items-center py-4 mb-2 border-b border-outline-variant/10 md:border-none cursor-pointer" onClick={() => { setIsMobileMenuOpen(false); navigate('/admin'); }}>
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-primary to-primary-container flex items-center justify-center mb-2 shadow-xs">
            <span className="material-symbols-outlined text-white text-2xl">storefront</span>
          </div>
          <h2 className="text-sm font-black text-primary dark:text-[#F3EDE6]">QUẢN TRỊ VIÊN</h2>
          <p className="text-[11px] text-on-surface-variant dark:text-[#A4968C] opacity-70 truncate max-w-[190px]">{user?.brandName || 'Chuỗi Cà Phê'}</p>
        </div>

        <nav className="flex-1 space-y-1.5 overflow-y-auto py-2">
          {navItems.map(item => {
            const isActive = location.pathname === item.path || (item.path !== '/admin' && location.pathname.startsWith(item.path));
            return (
              <Link 
                key={item.path} 
                to={item.path} 
                onClick={() => setIsMobileMenuOpen(false)}
                className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 transition-all text-xs font-bold ${
                  isActive 
                    ? 'bg-secondary-container dark:bg-white/5 dark:border dark:border-amber-600/40 dark:text-white dark:rounded-full shadow-xs' 
                    : 'text-on-surface-variant dark:text-[#A4968C] hover:bg-surface-variant/40 dark:hover:bg-white/5'
                }`}
              >
                <span className="material-symbols-outlined text-lg" style={isActive ? { fontVariationSettings: "'FILL' 1" } : {}}>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="pt-3 border-t border-outline-variant/15 dark:border-white/5 mt-auto">
          <Link 
            to="/menu" 
            className="w-full mb-2 py-2.5 bg-primary/10 dark:bg-amber-500/10 text-primary dark:text-amber-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all hover:bg-primary/20"
          >
            <span className="material-symbols-outlined text-base">storefront</span>
            Xem Menu Khách
          </Link>
          
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
      <main className="flex-1 md:ml-64 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="sticky top-0 z-20 h-16 bg-surface/80 dark:bg-[#1C1613]/85 backdrop-blur-md border-b border-outline-variant/15 dark:border-white/5 flex items-center justify-between px-4 md:px-8">
          <div className="flex items-center gap-4">
            {stores.length > 0 && (
              <select 
                value={selectedStoreId} 
                onChange={(e) => handleStoreChange(Number(e.target.value))}
                className="bg-surface-container-low dark:bg-[#251D19] border border-outline-variant/30 dark:border-white/10 rounded-full px-3 py-1.5 text-xs font-bold text-primary dark:text-[#F3EDE6] focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
              >
                {stores.map(s => (
                  <option key={s.storeId} value={s.storeId}>📍 {s.name}</option>
                ))}
              </select>
            )}
            <button className="md:hidden p-2 -ml-2 text-primary hover:bg-surface-variant rounded-full transition-colors" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
              <span className="material-symbols-outlined text-2xl">{isMobileMenuOpen ? 'close' : 'menu'}</span>
            </button>
            <div className="relative hidden sm:block">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-xl">search</span>
              <input className="bg-surface-container-low dark:bg-[#251D19] border border-outline-variant/30 dark:border-white/10 rounded-full pl-10 pr-4 py-2 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-on-surface-variant/50 dark:placeholder:text-stone-500 text-on-surface dark:text-[#F3EDE6]" placeholder="Tìm kiếm đơn hàng, nhân sự..." type="text" />
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Realtime Notification Bell */}
            <NotificationBell storeId={selectedStoreId} isAdmin={true} />
            
            {/* Settings Dropdown */}
            <SettingsDropdown />

            <div className="w-8 h-8 rounded-full bg-primary-fixed-dim overflow-hidden md:hidden">
              <img className="w-full h-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCWXJoU7x7yuLjMM9_PDBOVcIoZZlz464R7SZDJOsWvMUu_M5czmWODSsjWXNCSUipj4fLa7XLoiP2XsN43l5OKxuY5J9j1V0nJSp2J8ZGSqeJXwF-oX1Nz0LOUTzQw7LyQUd7GljIuoI_vyWWs5aa3Jpj5PJI3qtIWz3JA7emAUbvXJqBwU1asOI-xpeRU-pmsvdAkEX6a1st6PFb9BbelCbUGKo3TN3WKCFCQVvSRwLGZ1gm61f8C" alt="Mobile User" />
            </div>
          </div>
        </header>

        {subscription?.status === 'trialing' && <div className="mx-4 mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 md:mx-8">Gói dùng thử <strong>{subscription.plan}</strong> còn <strong>{subscription.daysRemaining ?? 0} ngày</strong>.</div>}
        {subscription?.status === 'suspended' && <div className="mx-4 mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">Gói đã hết hạn. Vui lòng chọn gói để mở lại tính năng quản lý.</div>}

        {/* Content Outlet */}
        <Outlet />
      </main>

      {/* Mobile Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 w-full bg-surface-container-lowest dark:bg-[#1C1613] h-[68px] overflow-x-auto border-t border-surface-container dark:border-white/5 z-40">
        <div className="flex min-w-max h-full items-center gap-1 px-2">
        {navItems.map(item => {
            const isActive = location.pathname === item.path || (item.path !== '/admin' && location.pathname.startsWith(item.path));
            return (
              <Link key={item.path} to={item.path} className={`flex h-full min-w-[62px] shrink-0 flex-col items-center justify-center gap-0.5 rounded-lg px-1 text-center ${isActive ? 'text-primary dark:text-amber-400' : 'text-on-surface-variant dark:text-[#A4968C]'}`}>
                <span className="material-symbols-outlined text-[19px] leading-5" style={isActive ? { fontVariationSettings: "'FILL' 1" } : {}}>{item.icon}</span>
                <span className="max-w-[62px] text-[8px] font-bold uppercase leading-[10px] tracking-[-0.02em]">{item.label}</span>
              </Link>
            )
        })}
        </div>
      </nav>
    </div>
  );
}
