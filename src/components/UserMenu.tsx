import { useAuthStore } from '../store/authStore';
import { useNavigate } from 'react-router-dom';

interface UserMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function UserMenu({ isOpen, onClose }: UserMenuProps) {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    onClose();
    window.location.href = '/'; // Redirect về trang chủ
  };

  const handleNavigate = (path: string) => {
    navigate(path);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40"
        onClick={onClose}
      />

      {/* Dropdown Menu */}
      <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-200">
        {/* User Info Header */}
        <div className="bg-gradient-to-br from-orange-500 to-orange-600 p-4 text-white">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center">
              <span className="text-2xl font-bold">
                {user?.fullName?.charAt(0).toUpperCase() || 'U'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-base truncate">{user?.fullName || 'Người dùng'}</h3>
              <p className="text-xs text-white/80 truncate">@{user?.username}</p>
            </div>
          </div>
          {user?.role && (
            <div className="mt-2 inline-block px-2.5 py-0.5 bg-white/20 backdrop-blur-sm rounded-full text-[10px] font-bold uppercase">
              {user.role === 'SystemAdmin' ? 'Quản trị viên' : 
               user.role === 'Owner' ? 'Chủ quán' :
               user.role === 'Staff' ? 'Nhân viên' :
               'Khách hàng'}
            </div>
          )}
        </div>

        {/* Menu Items */}
        <div className="p-2">
          <button
            onClick={() => handleNavigate('/profile')}
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 rounded-xl transition-colors text-left"
          >
            <span className="material-symbols-outlined text-gray-600">person</span>
            <span className="text-sm font-medium text-gray-800">Thông tin cá nhân</span>
          </button>

          <button
            onClick={() => handleNavigate('/history')}
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 rounded-xl transition-colors text-left"
          >
            <span className="material-symbols-outlined text-gray-600">receipt_long</span>
            <span className="text-sm font-medium text-gray-800">Lịch sử đơn hàng</span>
          </button>

          {/* SystemAdmin Link */}
          {user?.role === 'SystemAdmin' && (
            <button
              onClick={() => handleNavigate('/system-admin')}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-purple-50 text-purple-900 rounded-xl transition-colors text-left"
            >
              <span className="material-symbols-outlined text-purple-600">shield_person</span>
              <span className="text-sm font-semibold">Cổng Super Admin</span>
            </button>
          )}

          {/* Store Owner Link */}
          {(user?.role === 'Owner' || user?.role === 'TenantOwner') && (
            <button
              onClick={() => handleNavigate('/admin')}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-amber-50 text-amber-900 rounded-xl transition-colors text-left"
            >
              <span className="material-symbols-outlined text-amber-600">store</span>
              <span className="text-sm font-semibold">Quản trị quán Cafe (Admin)</span>
            </button>
          )}

          {user?.role === 'Staff' && (
            <button
              onClick={() => handleNavigate('/staff')}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 rounded-xl transition-colors text-left"
            >
              <span className="material-symbols-outlined text-gray-600">work</span>
              <span className="text-sm font-medium text-gray-800">Giao diện nhân viên</span>
            </button>
          )}

          <button
            onClick={() => handleNavigate('/settings')}
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 rounded-xl transition-colors text-left"
          >
            <span className="material-symbols-outlined text-gray-600">settings</span>
            <span className="text-sm font-medium text-gray-800">Cài đặt</span>
          </button>

          <hr className="my-2 border-gray-200" />

          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-red-50 rounded-xl transition-colors text-left text-red-600"
          >
            <span className="material-symbols-outlined">logout</span>
            <span className="text-sm font-bold">Đăng xuất</span>
          </button>
        </div>
      </div>
    </>
  );
}
