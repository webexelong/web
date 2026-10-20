import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authApi } from '../../api/apis';
import { useAuthStore } from '../../store/authStore';
import { useStore } from '../../store/useStore';

export default function StaffLogin() {
  const navigate = useNavigate();
  const setAuth = useAuthStore(state => state.setAuth);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await authApi.loginStaff({ username: username.trim(), password });
      if (!result || result.role !== 'Staff') {
        throw new Error('Tài khoản này không phải tài khoản nhân viên.');
      }
      setAuth({
        token: result.token,
        user: {
          username: result.username,
          fullName: result.fullName,
          role: 'Staff',
          tenantId: result.tenantId,
          storeId: result.storeId ?? undefined,
          storeName: result.storeName ?? undefined,
          brandName: result.brandName ?? undefined,
        },
      });
      if (result.storeId) useStore.getState().setStoreId(result.storeId);
      navigate('/staff/orders', { replace: true });
    } catch (err: any) {
      const status = err?.response?.status;
      const message = status === 404
        ? 'Backend chưa được cập nhật chức năng đăng nhập nhân viên.'
        : status === 401 || status === 400
          ? 'Tên đăng nhập hoặc mật khẩu không chính xác.'
          : status === 403
            ? 'Tài khoản nhân viên đã bị khóa hoặc không có quyền truy cập.'
            : err?.response?.data?.message || err?.message || 'Đăng nhập thất bại. Vui lòng thử lại.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return <main className="flex min-h-screen items-center justify-center bg-[#F6F1E7] px-4 py-10">
    <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-xl">
      <div className="text-center"><div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#5A4030] text-3xl text-white">☕</div><h1 className="mt-4 text-2xl font-black text-[#5A4030]">Cổng nhân viên</h1><p className="mt-2 text-sm text-gray-600">Đăng nhập để nhận đơn và thanh toán tại quầy.</p></div>
      {error && <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div>}
      <form onSubmit={submit} className="mt-6 space-y-4">
        <label className="block text-sm font-semibold">Tên đăng nhập<input required value={username} onChange={event => setUsername(event.target.value)} className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-3 outline-none focus:ring-2 focus:ring-[#5A4030]/20" placeholder="staff_quan1" /></label>
        <label className="block text-sm font-semibold">Mật khẩu<input required type="password" value={password} onChange={event => setPassword(event.target.value)} className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-3 outline-none focus:ring-2 focus:ring-[#5A4030]/20" placeholder="Mật khẩu của bạn" /></label>
        <button disabled={loading} className="w-full rounded-xl bg-[#5A4030] px-4 py-3 font-bold text-white disabled:opacity-50">{loading ? 'Đang đăng nhập...' : 'Đăng nhập'}</button>
      </form>
      <p className="mt-6 text-center text-sm text-gray-600"><Link className="font-semibold text-[#5A4030] underline" to="/login">Quay lại trang đăng nhập</Link></p>
    </div>
  </main>;
}
