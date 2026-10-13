import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { apiClient } from '../api/apiClient';
import { useAuthStore } from '../store/authStore';

export default function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { setAuth } = useAuthStore();
  const isSystemAdminPortal = window.location.pathname === '/system-admin/login';

  const [formData, setFormData] = useState({
    username: '',
    password: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const u = formData.username.trim();
    const p = formData.password;

    // Thứ tự endpoints tối ưu theo loại tài khoản nhưng có cơ chế fallback
    let endpointsToTry: string[] = [];
    const lowerU = u.toLowerCase();

    if (lowerU === 'superadmin' || lowerU.includes('admin') || isSystemAdminPortal) {
      endpointsToTry = ['/auth/admin-login', '/auth/owner-login', '/auth/login'];
    } else if (lowerU.includes('@')) {
      endpointsToTry = ['/auth/owner-login', '/auth/login', '/auth/admin-login'];
    } else {
      endpointsToTry = ['/auth/login', '/auth/owner-login', '/auth/admin-login'];
    }

    let lastError: any = null;
    let successData: any = null;

    for (const endpoint of endpointsToTry) {
      try {
        const response = await apiClient.post(endpoint, {
          username: u,
          password: p,
        });

        if (response.data?.success && response.data?.data) {
          successData = response.data.data;
          break;
        }
      } catch (err: any) {
        lastError = err;
        // Nếu là lỗi 429 (rate limit) thì ngưng thử ngay
        if (err.response?.status === 429) break;
      }
    }

    if (!successData) {
      setLoading(false);
      const status = lastError?.response?.status;
      const message = status === 429
        ? 'Bạn đã thử đăng nhập quá nhiều lần. Vui lòng chờ khoảng 1 phút rồi thử lại.'
        : status === 401
          ? 'Tên đăng nhập hoặc mật khẩu không chính xác.'
          : status === 403
            ? 'Tài khoản không có quyền đăng nhập vào khu vực này.'
            : lastError?.response?.data?.message || lastError?.message || 'Đăng nhập thất bại. Vui lòng kiểm tra lại thông tin.';
      setError(message);
      return;
    }

    try {
      const { token, username, fullName, role, tenantId, storeId, storeName, brandName } = successData;

      // Lưu token vào localStorage
      localStorage.setItem('token', token);

      // Lưu thông tin user vào store
      setAuth({
        token,
        user: {
          username,
          fullName,
          role,
          tenantId,
          storeId,
          storeName,
          brandName,
        },
      });

      // Kiểm tra URL redirect nhưng PHẢI kiểm tra quyền phù hợp với vai trò
      const redirect = searchParams.get('redirect');

      // Điều hướng dựa trên vai trò (Role-based redirection)
      if (role === 'SystemAdmin') {
        if (redirect && redirect.startsWith('/system-admin')) {
          navigate(redirect);
        } else {
          navigate('/system-admin');
        }
      } else if (role === 'Owner' || role === 'TenantOwner') {
        if (redirect && redirect.startsWith('/admin') && !redirect.startsWith('/system-admin')) {
          navigate(redirect);
        } else {
          navigate('/admin');
        }
      } else if (role === 'Staff') {
        if (redirect && redirect.startsWith('/staff')) {
          navigate(redirect);
        } else {
          navigate('/staff/orders');
        }
      } else {
        navigate('/'); // Customer → Thực đơn gọi món
      }
    } catch (err: any) {
      setError(err.message || 'Lỗi xử lý phiên đăng nhập.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 via-orange-50 to-orange-100 px-4 py-8">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl p-8 border border-orange-100">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-600 text-white font-black text-2xl shadow-lg mb-3">
            AI
          </div>
          <h1 className="text-2xl font-black text-[#5A4030] tracking-tight">AI-SMARTSERVE</h1>
          <p className="text-gray-500 text-sm mt-1">
            {isSystemAdminPortal ? 'Cổng Quản Trị Hệ Thống (SaaS Platform)' : 'Đăng nhập vào hệ thống vận hành'}
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-5 p-3.5 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5">
            <span className="material-symbols-outlined text-red-500 text-lg flex-shrink-0 mt-0.5">error</span>
            <p className="text-red-700 text-xs sm:text-sm leading-relaxed">{error}</p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
              Tên đăng nhập / Email
            </label>
            <input
              type="text"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              required
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm transition"
              placeholder="superadmin, email chủ quán hoặc tài khoản nhân viên"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
              Mật khẩu
            </label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              required
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm transition"
              placeholder="••••••••"
            />
          </div>

          <div className="flex items-center justify-between text-xs pt-1">
            <label className="flex items-center text-gray-600 cursor-pointer">
              <input type="checkbox" className="rounded border-gray-300 text-orange-600 focus:ring-orange-500 mr-2" />
              <span>Ghi nhớ đăng nhập</span>
            </label>
            <a href="#" className="text-orange-600 hover:text-orange-700 font-semibold">
              Quên mật khẩu?
            </a>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white py-3 px-4 rounded-xl font-bold shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 transition active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Đang xử lý đăng nhập...
              </span>
            ) : (
              'Đăng nhập'
            )}
          </button>
        </form>


        {/* Separator / Footer Navigation */}
        <div className="mt-6 pt-4 border-t border-gray-100 space-y-2 text-center text-xs text-gray-600">
          <p>
            Bạn là chủ doanh nghiệp F&B?{' '}
            <a href="/signup" className="text-orange-600 hover:text-orange-700 font-bold underline">
              Đăng ký mở quán mới
            </a>
          </p>
          <p>
            Bạn là khách hàng gọi món?{' '}
            <a href="/" className="text-amber-700 hover:text-amber-800 font-semibold underline">
              Về trang Thực đơn gọi món
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
