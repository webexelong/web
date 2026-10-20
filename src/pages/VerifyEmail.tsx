import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { authApi } from '../api/apis';
import { useAuthStore } from '../store/authStore';

export default function VerifyEmail() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const navigate = useNavigate();
  const setAuth = useAuthStore(state => state.setAuth);
  const [message, setMessage] = useState('Đang xác minh email...');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!token) { setMessage('Liên kết xác minh không hợp lệ.'); setFailed(true); return; }
    authApi.verifyOwnerEmail(token)
      .then(result => {
        if (!result) throw new Error('Không nhận được phiên đăng nhập.');
        setAuth({ token: result.token, user: { username: result.username, fullName: result.fullName, role: result.role, tenantId: result.tenantId, storeId: result.storeId ?? undefined, storeName: result.storeName ?? undefined, brandName: result.brandName ?? undefined } });
        setMessage('Xác minh thành công. Đang chuyển vào trang quản lý...');
        setTimeout(() => navigate('/admin', { replace: true }), 700);
      })
      .catch(err => { setMessage(err?.response?.data?.message || 'Liên kết đã hết hạn hoặc không hợp lệ.'); setFailed(true); });
  }, [navigate, setAuth, token]);

  return <main className="flex min-h-screen items-center justify-center bg-[#F6F1E7] px-4"><div className="max-w-md rounded-3xl bg-white p-8 text-center shadow-xl"><h1 className="text-2xl font-bold text-[#5A4030]">AI-SMARTSERVE</h1><p className="mt-4">{message}</p>{failed && <Link className="mt-5 inline-block font-semibold underline" to="/signup">Tạo lại tài khoản</Link>}</div></main>;
}
