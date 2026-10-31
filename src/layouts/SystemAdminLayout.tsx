import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { systemNotificationApi } from '../api/apis';
import type { SystemNotificationDto } from '../types/apiTypes';
import SettingsDropdown from '../components/SettingsDropdown';

export default function SystemAdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<SystemNotificationDto[]>([]);
  const { user, logout } = useAuthStore();

  useEffect(() => {
    let mounted = true;
    const loadNotifications = async () => {
      try {
        const result = await systemNotificationApi.list();
        if (mounted) setNotifications(result);
      } catch {
        // The notification area should not block the system admin workspace.
      }
    };
    void loadNotifications();
    const timer = window.setInterval(loadNotifications, 30000);
    return () => { mounted = false; window.clearInterval(timer); };
  }, []);

  const markNotificationRead = async (notificationId: number) => {
    try {
      await systemNotificationApi.markRead(notificationId);
      setNotifications(current => current.map(item => item.notificationId === notificationId ? { ...item, isRead: true } : item));
    } catch {
      // Leave it unread if the server could not persist the read state.
    }
  };

  const unreadNotifications = notifications.filter(item => !item.isRead).length;

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
      <aside className={`flex-col h-screen py-gutter px-4 bg-surface-container-low dark:bg-[#1C1613] fixed left-0 top-0 w-64 shadow-sm z-40 border-r border-outline-variant/10 dark:border-white/5 transition-transform ${isMobileMenuOpen ? 'flex translate-x-0' : 'hidden md:flex'}`}>
        {/* Brand Header */}
        <div className="mb-stack-lg px-2">
          <div className="flex items-center gap-2">
            <h1 className="font-headline-md text-headline-md text-primary dark:text-[#F3EDE6] tracking-tight">AI-SMARTSERVE</h1>
          </div>
          <p className="font-label-sm text-label-sm text-on-surface-variant dark:text-[#A4968C] opacity-70 flex items-center gap-1.5 mt-0.5">
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
                    ? 'text-primary dark:text-white bg-secondary-container/30 dark:bg-white/5 border-r-4 border-primary dark:border-amber-600/50 dark:border dark:rounded-full font-bold' 
                    : 'text-on-surface-variant dark:text-[#A4968C] hover:text-primary dark:hover:text-[#F8F4EE] hover:bg-secondary-container/20 dark:hover:bg-white/5'
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
        
        {/* Super Admin User Card at bottom-left with Click to Logout */}
        <div 
          className="mt-auto p-4 bg-surface-container-high dark:bg-[#251D19] rounded-2xl flex items-center gap-3 mb-4 relative group cursor-pointer border border-outline-variant/10 dark:border-white/5" 
          onClick={handleLogout} 
          title="Bấm để đăng xuất"
        >
          <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white font-bold text-base shadow-sm">
            SA
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-label-md text-label-md text-on-surface dark:text-[#F3EDE6] font-bold truncate">
              {user?.fullName || 'Super Admin'}
            </p>
            <p className="text-[10px] uppercase tracking-wider text-primary dark:text-amber-400 font-bold truncate">
              Quản Trị Hệ Thống
            </p>
          </div>
          {/* Hover overlay: Nút Đăng Xuất màu đỏ */}
          <div className="absolute inset-0 bg-surface/95 dark:bg-[#1C1613]/95 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl flex items-center justify-center gap-2 text-error font-bold text-xs shadow-lg">
            <span className="material-symbols-outlined text-error text-lg">logout</span>
            <span>Đăng Xuất</span>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="md:ml-64 min-h-screen pt-[104px] pb-24 md:pb-0">
        {/* Top Navigation Bar */}
        <header className="fixed top-0 right-0 w-full md:w-[calc(100%-16rem)] z-10 bg-surface/90 dark:bg-[#1C1613]/90 backdrop-blur-md h-[104px] flex justify-between items-center px-gutter shadow-sm border-b border-surface-container dark:border-white/5 transition-colors">
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
                className="bg-surface-container-low dark:bg-[#251D19] border border-outline-variant/30 dark:border-white/10 rounded-full pl-10 pr-4 py-2 text-sm w-72 focus:outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-on-surface-variant/50 dark:placeholder:text-stone-500 text-on-surface dark:text-[#F3EDE6]" 
                placeholder="Tìm kiếm quán cafe, đối tác, SĐT..." 
                type="text" 
              />
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <Link
              to="/menu"
              target="_blank"
              className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-surface-container dark:bg-white/5 hover:bg-surface-container-high dark:hover:bg-white/10 text-on-surface-variant dark:text-[#F3EDE6] hover:text-primary text-xs font-semibold border border-outline-variant/20 dark:border-white/10 transition"
              title="Xem giao diện khách hàng gọi món"
            >
              <span className="material-symbols-outlined text-sm">open_in_new</span>
              <span>Menu Khách</span>
            </Link>

            <div className="relative">
              <button onClick={() => setIsNotificationsOpen(open => !open)} aria-label={`Thông báo${unreadNotifications ? `, ${unreadNotifications} chưa đọc` : ''}`} aria-expanded={isNotificationsOpen} className="relative w-10 h-10 flex items-center justify-center rounded-full hover:bg-secondary-container/50 dark:hover:bg-white/10 transition-colors text-on-surface-variant dark:text-[#F3EDE6]">
                <span className="material-symbols-outlined">notifications</span>
                {unreadNotifications > 0 && <span className="absolute -right-0.5 -top-0.5 min-w-5 h-5 rounded-full bg-red-600 px-1 text-[10px] font-bold text-white flex items-center justify-center">{unreadNotifications > 9 ? '9+' : unreadNotifications}</span>}
              </button>
              {isNotificationsOpen && <div className="absolute right-0 top-full mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-outline-variant/30 dark:border-white/10 bg-white dark:bg-[#1E1714] shadow-2xl z-50">
                <div className="flex items-center justify-between border-b border-outline-variant/20 dark:border-white/10 px-4 py-3">
                  <strong className="text-sm text-primary dark:text-amber-400">Thông báo hệ thống</strong>
                  <span className="text-xs text-on-surface-variant dark:text-stone-400">{unreadNotifications} chưa đọc</span>
                </div>
                <div className="max-h-[65vh] overflow-y-auto">
                  {notifications.length === 0 ? <p className="p-5 text-sm text-on-surface-variant dark:text-stone-400">Chưa có thông báo.</p> : notifications.map(notification => <div key={notification.notificationId} className={`border-b border-outline-variant/10 dark:border-white/5 p-4 last:border-0 ${notification.isRead ? 'bg-white dark:bg-[#1E1714]' : 'bg-amber-50/70 dark:bg-amber-950/30'}`}>
                    <div className="flex items-start gap-2">
                      <span className="material-symbols-outlined mt-0.5 text-base text-primary dark:text-amber-400">{notification.type === 'tenant_plan_upgraded' ? 'workspace_premium' : 'notifications'}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-on-surface dark:text-[#F3EDE6]">{notification.title}</p>
                        <p className="mt-1 text-xs leading-5 text-on-surface-variant dark:text-[#A4968C]">{notification.message}</p>
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <span className="text-[10px] text-on-surface-variant dark:text-stone-400">{new Date(notification.createdAt).toLocaleString('vi-VN')}</span>
                          <Link to="/system-admin/tenants" onClick={() => { void markNotificationRead(notification.notificationId); setIsNotificationsOpen(false); }} className="text-xs font-bold text-primary dark:text-amber-400 hover:underline">Quản lý quán</Link>
                        </div>
                        {!notification.isRead && <button onClick={() => void markNotificationRead(notification.notificationId)} className="mt-2 text-[11px] font-semibold text-on-surface-variant dark:text-stone-400 hover:text-primary dark:hover:text-amber-400">Đánh dấu đã đọc</button>}
                      </div>
                    </div>
                  </div>)}
                </div>
              </div>}
            </div>

            {/* Settings Dropdown */}
            <SettingsDropdown />
          </div>
        </header>

        {/* Content Outlet with standard padding */}
        <div className="p-gutter max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>

      {/* Mobile Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 w-full bg-surface-container-lowest dark:bg-[#1C1613] h-20 flex justify-around items-center px-4 border-t border-surface-container dark:border-white/5 z-40">
        {navItems.map(item => {
          const isActive = location.pathname === item.path || (item.path !== '/system-admin' && location.pathname.startsWith(item.path));
          return (
            <Link 
              key={item.path} 
              to={item.path} 
              className={`flex flex-col items-center gap-1 ${isActive ? 'text-primary dark:text-amber-400' : 'text-on-surface-variant dark:text-[#A4968C]'}`}
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
