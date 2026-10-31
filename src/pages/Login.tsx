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
    <div className="min-h-screen relative overflow-hidden flex items-center justify-center px-4 py-8 bg-gradient-to-br from-[#2D1B12] via-[#1B110B] to-[#0D0805] selection:bg-amber-500 selection:text-white">
      {/* Warm Ambient Coffee Glow Orbs */}
      <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-amber-500/20 blur-[100px] pointer-events-none" />
      <div className="absolute -bottom-24 -right-24 w-96 h-96 rounded-full bg-orange-600/20 blur-[110px] pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[520px] h-[520px] rounded-full bg-amber-600/10 blur-[120px] pointer-events-none" />

      {/* Login Card */}
      <div className="relative z-10 max-w-md w-full bg-[#1A1411]/95 border border-amber-600/25 rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.6)] p-8 sm:p-10 backdrop-blur-xl">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-500 via-orange-500 to-amber-600 text-white font-black text-2xl shadow-lg shadow-orange-950/60 mb-3 border border-amber-400/30">
            AI
          </div>
          <h1 className="text-2xl font-black text-[#F8F4EE] tracking-tight">AI-SMARTSERVE</h1>
          <p className="text-[#A4968C] text-xs sm:text-sm mt-1 font-medium">
            {isSystemAdminPortal ? 'Cổng Quản Trị Hệ Thống (SaaS Platform)' : 'Đăng nhập vào hệ thống vận hành'}
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-5 p-3.5 bg-red-950/50 border border-red-500/40 rounded-xl flex items-start gap-2.5">
            <span className="material-symbols-outlined text-red-400 text-lg flex-shrink-0 mt-0.5">error</span>
            <p className="text-red-200 text-xs sm:text-sm leading-relaxed">{error}</p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-[#E2D4C9] uppercase tracking-wider mb-1.5">
              Tên đăng nhập / Email
            </label>
            <input
              type="text"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              required
              className="w-full px-4 py-2.5 bg-[#120D0A] border border-amber-900/50 rounded-xl text-amber-50 placeholder-stone-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-sm transition"
              placeholder="superadmin, email chủ quán hoặc tài khoản nhân viên"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#E2D4C9] uppercase tracking-wider mb-1.5">
              Mật khẩu
            </label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              required
              className="w-full px-4 py-2.5 bg-[#120D0A] border border-amber-900/50 rounded-xl text-amber-50 placeholder-stone-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-sm transition"
              placeholder="••••••••"
            />
          </div>

          <div className="flex items-center justify-between text-xs pt-1">
            <label className="flex items-center text-[#B0A298] cursor-pointer hover:text-white transition">
              <input type="checkbox" className="rounded border-amber-900/60 bg-[#120D0A] text-amber-500 focus:ring-amber-500 mr-2" />
              <span>Ghi nhớ đăng nhập</span>
            </label>
            <a href="#" className="text-amber-400 hover:text-amber-300 font-semibold transition">
              Quên mật khẩu?
            </a>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 hover:from-amber-500 hover:to-orange-500 text-white py-3 px-4 rounded-xl font-bold shadow-lg shadow-orange-950/60 hover:shadow-orange-950/80 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 focus:ring-offset-[#1A1411] transition active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
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
        <div className="mt-6 pt-4 border-t border-white/10 text-center text-xs text-[#A4968C]">
          <p>
            Bạn là chủ doanh nghiệp F&B?{' '}
            <a href="/signup" className="text-amber-400 hover:text-amber-300 font-bold underline decoration-amber-400/50">
              Đăng ký mở quán mới
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
