import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { useStore } from '../store/useStore';
import { meApi } from '../api/apis';

export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { user, logout } = useAuthStore();
  const { setStoreId } = useStore();
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

    if (user?.storeId) {
      // Đảm bảo dữ liệu tải đúng chi nhánh/quán của chủ quán đăng nhập
      setStoreId(user.storeId);
    }
  }, [location.pathname, navigate, user, setStoreId]);

  useEffect(() => {
    if (!user || user.role === 'SystemAdmin') return;
    meApi.getStores().then((items) => {
      setStores(items ?? []);
      const initial = selectedStoreId || user.storeId || items?.[0]?.storeId || 0;
      if (initial) {
        setSelectedStoreId(initial);
        setStoreId(initial);
      }
    }).catch(() => setStores([]));
  }, [user, setStoreId]);

  useEffect(() => {
    if (user && user.role !== 'SystemAdmin') meApi.getSubscription().then(setSubscription).catch(() => setSubscription(null));
  }, [user]);

  const handleStoreChange = (storeId: number) => {
    setSelectedStoreId(storeId);
    setStoreId(storeId);
  };

  const navItems = [
    { path: '/admin/analytics', icon: 'analytics', label: 'Phân Tích' },
    { path: '/admin', icon: 'dashboard', label: 'Bảng Điều Khiển' },
    { path: '/admin/menu', icon: 'restaurant_menu', label: 'Thực Đơn' },
    { path: '/admin/inventory', icon: 'inventory_2', label: 'Kho & Nguyên Liệu' },
    { path: '/admin/tables', icon: 'table_restaurant', label: 'Bàn' },
    { path: '/admin/staff', icon: 'groups', label: 'Nhân Sự' },
    { path: '/admin/settings', icon: 'payments', label: 'Cổng Thanh Toán' },
    { path: '/admin/subscription', icon: 'workspace_premium', label: 'Gói dịch vụ' },
  ];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="bg-background text-on-background antialiased overflow-x-hidden min-h-screen">
      {/* Mobile Menu Backdrop */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 bg-black/50 z-30 md:hidden" onClick={() => setIsMobileMenuOpen(false)} />
      )}

      {/* Sidebar Navigation */}
      <aside className={`flex-col h-screen py-gutter px-4 bg-surface-container-low fixed left-0 top-0 w-64 shadow-sm z-40 border-r border-outline-variant/10 transition-transform ${isMobileMenuOpen ? 'flex translate-x-0' : 'hidden md:flex'}`}>
        <div className="mb-stack-lg px-2">
          <h1 className="font-headline-md text-headline-md text-primary tracking-tight">AI-SMARTSERVE</h1>
          <p className="font-label-sm text-label-sm text-on-surface-variant opacity-70">
            {user?.brandName || 'Trung Tâm Quản Lý Quán'}
          </p>
        </div>
        
        <nav className="flex-1 space-y-2">
          {navItems.map(item => {
            const isActive = location.pathname === item.path || (item.path !== '/admin' && location.pathname.startsWith(item.path));
            return (
              <Link 
                key={item.path}
                to={item.path} 
                onClick={() => setIsMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 active:scale-95 ${isActive ? 'text-primary bg-secondary-container/30 border-r-4 border-primary' : 'text-on-surface-variant hover:text-primary hover:bg-secondary-container/20'}`}
              >
                <span className="material-symbols-outlined" style={isActive ? { fontVariationSettings: "'FILL' 1" } : {}}>{item.icon}</span>
                <span className="font-label-md text-label-md">{item.label}</span>
              </Link>
            );
          })}
        </nav>
        
        {/* User Card with real Owner name & Logout */}
        <div className="mt-auto p-4 bg-surface-container-high rounded-2xl flex items-center gap-3 mb-4 relative group cursor-pointer" onClick={handleLogout} title="Bấm để đăng xuất">
          <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white font-bold text-base shadow-sm">
            {user?.fullName ? user.fullName.charAt(0).toUpperCase() : 'O'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-label-md text-label-md text-on-surface font-bold truncate">
              {user?.fullName || 'Chủ Quán'}
            </p>
            <p className="text-[10px] uppercase tracking-wider text-on-surface-variant font-bold truncate">
              {user?.brandName || user?.storeName || 'Chủ Cửa Hàng'}
            </p>
          </div>
          <div className="absolute inset-0 bg-surface/90 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl flex items-center justify-center gap-2 text-error font-bold text-xs">
            <span className="material-symbols-outlined text-error text-lg">logout</span>
            <span>Đăng Xuất</span>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="md:ml-64 min-h-screen pt-[104px] pb-24 md:pb-0">
        {/* Top Navigation Bar */}
        <header className="fixed top-0 right-0 w-full md:w-[calc(100%-16rem)] z-10 bg-surface/90 backdrop-blur-md h-[104px] flex justify-between items-center px-gutter shadow-sm border-b border-surface-container">
          <div className="flex items-center gap-4">
            {stores.length > 1 && (
              <select value={selectedStoreId} onChange={(e) => handleStoreChange(Number(e.target.value))} className="bg-surface-container-low border border-outline-variant/30 rounded-full px-3 py-2 text-sm">
                {stores.map((store) => <option key={store.storeId} value={store.storeId}>{store.name}</option>)}
              </select>
            )}
            <button className="md:hidden p-2 -ml-2 text-primary hover:bg-surface-variant rounded-full transition-colors" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
              <span className="material-symbols-outlined text-2xl">{isMobileMenuOpen ? 'close' : 'menu'}</span>
            </button>
            <div className="relative hidden sm:block">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-xl">search</span>
              <input className="bg-surface-container-low border border-outline-variant/30 rounded-full pl-10 pr-4 py-2 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-on-surface-variant/50" placeholder="Tìm kiếm đơn hàng, nhân sự..." type="text" />
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <button className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-secondary-container/50 transition-colors text-on-surface-variant">
              <span className="material-symbols-outlined">notifications</span>
            </button>
            <button className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-secondary-container/50 transition-colors text-on-surface-variant">
              <span className="material-symbols-outlined">settings</span>
            </button>
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
      <nav className="md:hidden fixed bottom-0 left-0 w-full bg-surface-container-lowest h-[68px] overflow-x-auto border-t border-surface-container z-40">
        <div className="flex min-w-max h-full items-center gap-1 px-2">
        {navItems.map(item => {
            const isActive = location.pathname === item.path || (item.path !== '/admin' && location.pathname.startsWith(item.path));
            return (
              <Link key={item.path} to={item.path} className={`flex h-full min-w-[62px] shrink-0 flex-col items-center justify-center gap-0.5 rounded-lg px-1 text-center ${isActive ? 'text-primary' : 'text-on-surface-variant'}`}>
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
