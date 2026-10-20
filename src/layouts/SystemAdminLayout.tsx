import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';

export default function SystemAdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { user, logout } = useAuthStore();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }

    // Role guard: Nếu không phải SuperAdmin (ví dụ là Chủ quán hoặc Staff), chuyển về đúng nơi
    if (user && user.role !== 'SystemAdmin') {
      if (user.role === 'Owner' || user.role === 'TenantOwner') {
        navigate('/admin', { replace: true });
      } else {
        navigate('/staff/orders', { replace: true });
      }
    }
  }, [location.pathname, navigate, user]);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const navItems = [
    { path: '/system-admin', icon: 'dashboard', label: 'Bảng Điều Khiển' },
    { path: '/system-admin/tenants', icon: 'storefront', label: 'Quán Cafe Đối Tác' },
    { path: '/system-admin/plans', icon: 'tune', label: 'Gói Cước & Cấu Hình' },
  ];

  return (
    <div className="bg-background text-on-background antialiased overflow-x-hidden min-h-screen">
      {/* Mobile Menu Backdrop */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-30 md:hidden backdrop-blur-xs" 
          onClick={() => setIsMobileMenuOpen(false)} 
        />
      )}

      {/* Sidebar Navigation - Đồng bộ 100% cấu trúc và màu sắc với trang Chủ Quán */}
      <aside className={`flex-col h-screen py-gutter px-4 bg-surface-container-low fixed left-0 top-0 w-64 shadow-sm z-40 border-r border-outline-variant/10 transition-transform ${isMobileMenuOpen ? 'flex translate-x-0' : 'hidden md:flex'}`}>
        {/* Brand Header */}
        <div className="mb-stack-lg px-2">
          <div className="flex items-center gap-2">
            <h1 className="font-headline-md text-headline-md text-primary tracking-tight">AI-SMARTSERVE</h1>
          </div>
          <p className="font-label-sm text-label-sm text-on-surface-variant opacity-70 flex items-center gap-1.5 mt-0.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Quản Trị Nền Tảng SaaS
          </p>
        </div>
        
        {/* Navigation Items */}
        <nav className="flex-1 space-y-2">
          {navItems.map(item => {
            const isActive = location.pathname === item.path || (item.path !== '/system-admin' && location.pathname.startsWith(item.path));
            return (
              <Link 
                key={item.path}
                to={item.path} 
                onClick={() => setIsMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 active:scale-95 ${
                  isActive 
                    ? 'text-primary bg-secondary-container/30 border-r-4 border-primary font-bold' 
                    : 'text-on-surface-variant hover:text-primary hover:bg-secondary-container/20'
                }`}
              >
                <span className="material-symbols-outlined" style={isActive ? { fontVariationSettings: "'FILL' 1" } : {}}>
                  {item.icon}
                </span>
                <span className="font-label-md text-label-md">{item.label}</span>
              </Link>
            );
          })}
        </nav>
        
        {/* Super Admin User Card at bottom-left with Click to Logout (giống trang Chủ quán) */}
        <div 
          className="mt-auto p-4 bg-surface-container-high rounded-2xl flex items-center gap-3 mb-4 relative group cursor-pointer border border-outline-variant/10" 
          onClick={handleLogout} 
          title="Bấm để đăng xuất"
        >
          <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white font-bold text-base shadow-sm">
            SA
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-label-md text-label-md text-on-surface font-bold truncate">
              {user?.fullName || 'Super Admin'}
            </p>
            <p className="text-[10px] uppercase tracking-wider text-primary font-bold truncate">
              Quản Trị Hệ Thống
            </p>
          </div>
          {/* Hover overlay: Nút Đăng Xuất màu đỏ */}
          <div className="absolute inset-0 bg-surface/95 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl flex items-center justify-center gap-2 text-error font-bold text-xs shadow-lg">
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
            <button 
              className="md:hidden p-2 -ml-2 text-primary hover:bg-surface-variant rounded-full transition-colors" 
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              <span className="material-symbols-outlined text-2xl">{isMobileMenuOpen ? 'close' : 'menu'}</span>
            </button>
            <div className="relative hidden sm:block">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-xl">search</span>
              <input 
                className="bg-surface-container-low border border-outline-variant/30 rounded-full pl-10 pr-4 py-2 text-sm w-72 focus:outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-on-surface-variant/50" 
                placeholder="Tìm kiếm quán cafe, đối tác, SĐT..." 
                type="text" 
              />
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <Link
              to="/menu"
              target="_blank"
              className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-surface-container hover:bg-surface-container-high text-on-surface-variant hover:text-primary text-xs font-semibold border border-outline-variant/20 transition"
              title="Xem giao diện khách hàng gọi món"
            >
              <span className="material-symbols-outlined text-sm">open_in_new</span>
              <span>Menu Khách</span>
            </Link>

            <button className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-secondary-container/50 transition-colors text-on-surface-variant">
              <span className="material-symbols-outlined">notifications</span>
            </button>
            <button className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-secondary-container/50 transition-colors text-on-surface-variant">
              <span className="material-symbols-outlined">settings</span>
            </button>
          </div>
        </header>

        {/* Content Outlet with standard padding */}
        <div className="p-gutter max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>

      {/* Mobile Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 w-full bg-surface-container-lowest h-20 flex justify-around items-center px-4 border-t border-surface-container z-40">
        {navItems.map(item => {
          const isActive = location.pathname === item.path || (item.path !== '/system-admin' && location.pathname.startsWith(item.path));
          return (
            <Link 
              key={item.path} 
              to={item.path} 
              className={`flex flex-col items-center gap-1 ${isActive ? 'text-primary' : 'text-on-surface-variant'}`}
            >
              <span className="material-symbols-outlined" style={isActive ? { fontVariationSettings: "'FILL' 1" } : {}}>
                {item.icon}
              </span>
              <span className="text-[10px] font-bold uppercase tracking-tighter">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
