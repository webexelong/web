import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { useStore } from '../../store/useStore';
import { customerApi } from '../../api/apis';
import type { CustomerProfileDto, CustomerLoyaltyHistoryDto } from '../../types/apiTypes';
import AuthModal from '../../components/AuthModal';
import MobileBottomNav from '../../components/MobileBottomNav';

export default function Profile() {
  const { isAuthenticated, user, setAuth, token } = useAuthStore();
  const { guestSession, currentStoreId } = useStore();
  const navigate = useNavigate();

  const [profile, setProfile] = useState<CustomerProfileDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  // Lịch sử điểm
  const [loyaltyHistory, setLoyaltyHistory] = useState<CustomerLoyaltyHistoryDto[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const activeStoreId = guestSession?.storeId || currentStoreId;

  useEffect(() => {
    if (!isAuthenticated || !user?.username) {
      setLoading(false);
      return;
    }

    fetchProfile();
    fetchLoyaltyHistory();
  }, [isAuthenticated, user?.username, activeStoreId]);

  const fetchProfile = async () => {
    if (!user?.username) return;
    setLoading(true);
    try {
      const data = await customerApi.getProfile({
        phone: user.username,
        storeId: activeStoreId > 0 ? activeStoreId : undefined
      });
      setProfile(data);
      setNameInput(data.name || '');
    } catch (err: any) {
      console.error('Lỗi khi tải thông tin cá nhân:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchLoyaltyHistory = async () => {
    if (!user?.username) return;
    setLoadingHistory(true);
    try {
      const res = await customerApi.getLoyaltyHistory({ phone: user.username, pageSize: 5 });
      setLoyaltyHistory(res.items);
    } catch (err) {
      console.warn('Lỗi khi tải lịch sử điểm:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    if (!nameInput.trim()) {
      setMessage({ type: 'error', text: 'Họ và tên không được để trống.' });
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      const updated = await customerApi.updateProfile({
        phone: profile.phone,
        name: nameInput.trim(),
      });
      setProfile(updated);
      setMessage({ type: 'success', text: 'Cập nhật thông tin thành công!' });

      // Cập nhật authStore để Header/Navbar hiển thị tên mới
      if (token && user) {
        setAuth({
          token,
          user: {
            ...user,
            fullName: updated.name,
          },
        });
      }
    } catch (err: any) {
      const errMsg = err.response?.data?.message || 'Có lỗi xảy ra khi cập nhật.';
      setMessage({ type: 'error', text: errMsg });
    } finally {
      setSaving(false);
    }
  };

  // Tính hạng thành viên theo tổng chi tiêu
  const getMembershipTier = (spent: number) => {
    if (spent >= 2000000) return { name: 'Kim Cương', badge: 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white', icon: 'diamond' };
    if (spent >= 1000000) return { name: 'Vàng', badge: 'bg-gradient-to-r from-amber-400 to-amber-600 text-white', icon: 'military_tech' };
    if (spent >= 500000) return { name: 'Bạc', badge: 'bg-gradient-to-r from-slate-300 to-slate-500 text-white', icon: 'workspace_premium' };
    return { name: 'Đồng', badge: 'bg-gradient-to-r from-amber-700 to-amber-900 text-white', icon: 'verified' };
  };

  const tier = getMembershipTier(profile?.totalSpent || 0);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-between">
        <nav className="bg-white border-b border-gray-200 px-4 py-4 sticky top-0 z-10 shadow-sm">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <Link to="/" className="text-xl font-black text-orange-600 tracking-tight flex items-center gap-2">
              <span className="material-symbols-outlined text-orange-600">coffee</span>
              WebCafe
            </Link>
            <button
              onClick={() => setIsAuthModalOpen(true)}
              className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-bold shadow-sm transition-all"
            >
              Đăng Nhập
            </button>
          </div>
        </nav>

        <main className="flex-grow flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full text-center shadow-xl border border-gray-100 space-y-5">
            <div className="w-20 h-20 bg-orange-50 rounded-full flex items-center justify-center mx-auto text-orange-500 shadow-inner">
              <span className="material-symbols-outlined text-4xl">account_circle</span>
            </div>
            <h2 className="text-2xl font-black text-gray-900">Thông Tin Cá Nhân</h2>
            <p className="text-gray-500 text-sm leading-relaxed">
              Vui lòng đăng nhập để xem thông tin tài khoản, số điểm tích lũy hiện có và lịch sử đơn hàng của bạn.
            </p>
            <button
              onClick={() => setIsAuthModalOpen(true)}
              className="w-full py-3.5 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-bold rounded-2xl shadow-lg shadow-orange-500/30 transition-all active:scale-95"
            >
              Đăng Nhập Hoặc Đăng Ký
            </button>
            <Link
              to="/"
              className="block text-sm text-gray-500 hover:text-gray-800 font-semibold transition-colors"
            >
              Quay lại thực đơn
            </Link>
          </div>
        </main>

        <MobileBottomNav />
        <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fbf9f7] flex flex-col justify-between font-sans">
      {/* Top Header */}
      <nav className="bg-white/80 backdrop-blur-md border-b border-gray-100 px-4 py-3 sticky top-0 z-30 shadow-sm">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-sm font-bold text-gray-600 hover:text-orange-600 transition-colors py-1 px-2 rounded-lg hover:bg-gray-100"
          >
            <span className="material-symbols-outlined text-lg">arrow_back</span>
            <span>Quay lại</span>
          </button>
          <h1 className="text-base font-black text-gray-900">Tài Khoản Thành Viên</h1>
          <Link
            to="/history"
            className="text-xs font-bold text-orange-600 hover:text-orange-700 bg-orange-50 px-3 py-1.5 rounded-full flex items-center gap-1 border border-orange-200 transition-colors"
          >
            <span className="material-symbols-outlined text-sm">receipt_long</span>
            <span>Đơn hàng</span>
          </Link>
        </div>
      </nav>

      <main className="flex-grow max-w-4xl mx-auto w-full px-4 py-6 space-y-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-3">
            <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-sm font-semibold text-gray-500">Đang tải thông tin khách hàng...</p>
          </div>
        ) : (
          <>
            {/* VIP Loyalty Card */}
            <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-amber-900 via-stone-900 to-orange-950 p-6 sm:p-8 text-white shadow-2xl border border-amber-800/30">
              {/* Background Decor */}
              <div className="absolute -top-16 -right-16 w-48 h-48 bg-amber-500/20 rounded-full blur-3xl pointer-events-none"></div>
              <div className="absolute -bottom-16 -left-16 w-48 h-48 bg-orange-600/20 rounded-full blur-3xl pointer-events-none"></div>

              <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center shadow-inner text-amber-300 font-black text-2xl">
                    {profile?.name?.charAt(0).toUpperCase() || 'K'}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl sm:text-2xl font-black tracking-tight">{profile?.name || 'Khách Hàng'}</h2>
                      <span className={`inline-flex items-center gap-1 text-[11px] font-extrabold px-2.5 py-0.5 rounded-full shadow-sm ${tier.badge}`}>
                        <span className="material-symbols-outlined text-xs">{tier.icon}</span>
                        {tier.name}
                      </span>
                    </div>
                    <p className="text-white/70 text-xs font-mono mt-1 flex items-center gap-1">
                      <span className="material-symbols-outlined text-xs">phone_iphone</span>
                      {profile?.phone}
                    </p>
                    {profile?.tenantName && (
                      <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/10 text-[11px] font-semibold text-amber-200 border border-white/15">
                        <span className="material-symbols-outlined text-xs">storefront</span>
                        <span>Đang tại: {profile.tenantName}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Điểm tích lũy nổi bật */}
                <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl p-4 sm:text-right flex sm:flex-col justify-between items-center sm:items-end">
                  <span className="text-xs uppercase tracking-wider text-amber-200 font-bold flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm text-amber-300" style={{ fontVariationSettings: "'FILL' 1" }}>stars</span>
                    Điểm Tại {profile?.tenantName || 'Quán Này'}
                  </span>
                  <div className="text-2xl sm:text-3xl font-black text-amber-300">
                    {profile?.totalPoints.toLocaleString()} <span className="text-xs font-normal text-white/80">điểm</span>
                  </div>
                  <span className="text-[11px] text-white/60 mt-0.5">
                    ≈ {(profile ? profile.totalPoints * profile.pointsToMoney : 0).toLocaleString()}đ giảm giá
                  </span>
                </div>
              </div>

              {/* Thống kê chi tiêu */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-6 pt-6 border-t border-white/10 text-center">
                <div className="bg-white/5 rounded-xl p-2.5">
                  <div className="text-xs text-white/60">Tổng chi tiêu ({profile?.tenantName || 'Quán này'})</div>
                  <div className="text-sm sm:text-base font-extrabold text-white mt-0.5">
                    {profile?.totalSpent.toLocaleString()}đ
                  </div>
                </div>
                <div className="bg-white/5 rounded-xl p-2.5">
                  <div className="text-xs text-white/60">Số lần ghé quán</div>
                  <div className="text-sm sm:text-base font-extrabold text-white mt-0.5">
                    {profile?.visitCount} lần
                  </div>
                </div>
                <div className="col-span-2 sm:col-span-1 bg-white/5 rounded-xl p-2.5">
                  <div className="text-xs text-white/60">Tỷ lệ quy đổi điểm</div>
                  <div className="text-sm sm:text-base font-extrabold text-amber-300 mt-0.5">
                    1 điểm = {profile?.pointsToMoney.toLocaleString()}đ
                  </div>
                </div>
              </div>
            </section>

            {/* Ví Điểm Đa Quán Trên Toàn Nền Tảng SaaS */}
            {profile?.tenantPoints && profile.tenantPoints.length > 0 && (
              <section className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-gray-100 space-y-4">
                <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                  <div>
                    <h3 className="text-lg font-black text-gray-900 flex items-center gap-2">
                      <span className="material-symbols-outlined text-orange-500">account_balance_wallet</span>
                      Ví Điểm Tích Lũy Đa Quán (SaaS)
                    </h3>
                    <p className="text-xs text-gray-500 mt-1">
                      1 tài khoản dùng chung cho tất cả các quán trên nền tảng. Điểm được lưu trữ riêng và áp dụng khi bạn ghé từng quán.
                    </p>
                  </div>
                  <span className="text-xs font-bold bg-orange-50 text-orange-600 px-3 py-1 rounded-full border border-orange-200 shrink-0">
                    {profile.tenantPoints.length} quán đã ghé
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  {profile.tenantPoints.map((item) => {
                    const isCurrent = item.tenantId === profile.tenantId;
                    return (
                      <div
                        key={item.tenantId}
                        className={`p-4 rounded-2xl border transition-all ${
                          isCurrent
                            ? 'bg-amber-50/60 border-amber-300 shadow-sm'
                            : 'bg-gray-50/50 border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="material-symbols-outlined text-orange-600 text-lg shrink-0">
                              storefront
                            </span>
                            <span className="text-sm font-bold text-gray-900 truncate">
                              {item.tenantName}
                            </span>
                          </div>
                          {isCurrent ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500 text-white shadow-xs shrink-0">
                              Đang xem
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-200 text-gray-600 shrink-0">
                              Khác
                            </span>
                          )}
                        </div>

                        <div className="flex items-baseline justify-between mt-3 pt-3 border-t border-gray-100">
                          <div>
                            <span className="text-[11px] text-gray-500">Số điểm khả dụng</span>
                            <div className="text-base font-black text-amber-600">
                              {item.totalPoints.toLocaleString()} <span className="text-xs font-normal text-gray-600">điểm</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="text-[11px] text-gray-500">Chi tiêu tích lũy</span>
                            <div className="text-xs font-bold text-gray-700">
                              {item.totalSpent.toLocaleString()}đ
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Thông báo cập nhật */}
            {message && (
              <div
                className={`p-4 rounded-2xl text-sm font-semibold flex items-center gap-2.5 transition-all shadow-sm ${
                  message.type === 'success'
                    ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                    : 'bg-rose-50 border border-rose-200 text-rose-800'
                }`}
              >
                <span className="material-symbols-outlined text-lg">
                  {message.type === 'success' ? 'check_circle' : 'error'}
                </span>
                <span>{message.text}</span>
              </div>
            )}

            {/* Form chỉnh sửa thông tin */}
            <section className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-gray-100 space-y-6">
              <div className="border-b border-gray-100 pb-4">
                <h3 className="text-lg font-black text-gray-900 flex items-center gap-2">
                  <span className="material-symbols-outlined text-orange-500">manage_accounts</span>
                  Chỉnh Sửa Thông Tin
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  Cập nhật họ tên hiển thị của bạn khi đặt món tại quầy và trực tuyến.
                </p>
              </div>

              <form onSubmit={handleUpdateProfile} className="space-y-5">
                {/* Họ và tên */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                    Họ và tên <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                      <span className="material-symbols-outlined text-xl">person</span>
                    </span>
                    <input
                      type="text"
                      className="w-full pl-11 pr-4 py-3 bg-gray-50/50 border border-gray-200 rounded-2xl text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
                      placeholder="Nhập họ và tên của bạn"
                      value={nameInput}
                      onChange={(e) => setNameInput(e.target.value)}
                    />
                  </div>
                </div>

                {/* Số điện thoại (KHÓA CỨNG - KHÔNG CHO SỬA) */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Số điện thoại tích điểm
                    </label>
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                      <span className="material-symbols-outlined text-xs text-amber-600">lock</span>
                      Đã khóa bảo mật
                    </span>
                  </div>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                      <span className="material-symbols-outlined text-xl">phone</span>
                    </span>
                    <input
                      type="tel"
                      value={profile?.phone || ''}
                      readOnly
                      disabled
                      className="w-full pl-11 pr-11 py-3 bg-gray-100 border border-gray-200 rounded-2xl text-sm font-bold text-gray-500 cursor-not-allowed select-none"
                    />
                    <span className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-gray-400">
                      <span className="material-symbols-outlined text-lg">lock</span>
                    </span>
                  </div>
                  <div className="mt-2.5 p-3 rounded-xl bg-amber-50/60 border border-amber-200/70 text-amber-800 text-xs flex items-start gap-2">
                    <span className="material-symbols-outlined text-base text-amber-600 flex-shrink-0 mt-0.5">info</span>
                    <span>
                      <strong>Lưu ý bảo mật:</strong> Số điện thoại được dùng làm mã định danh duy nhất để lưu trữ toàn bộ điểm tích lũy và lịch sử đơn hàng. Để tránh bị mất điểm, hệ thống không cho phép thay đổi số điện thoại này.
                    </span>
                  </div>
                </div>

                {/* Nút lưu */}
                <div className="pt-2 flex justify-end">
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-8 py-3 bg-orange-500 hover:bg-orange-600 active:scale-95 text-white text-sm font-bold rounded-2xl shadow-lg shadow-orange-500/20 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {saving ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>Đang lưu...</span>
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-lg">save</span>
                        <span>Lưu Thay Đổi</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </section>

            {/* Lịch sử biến động điểm gần đây */}
            <section className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-gray-100 space-y-4">
              <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                <h3 className="text-lg font-black text-gray-900 flex items-center gap-2">
                  <span className="material-symbols-outlined text-amber-500" style={{ fontVariationSettings: "'FILL' 1" }}>history</span>
                  Biến Động Điểm Gần Đây
                </h3>
                <Link
                  to="/history"
                  className="text-xs font-bold text-orange-600 hover:text-orange-700 flex items-center gap-0.5"
                >
                  <span>Xem tất cả đơn</span>
                  <span className="material-symbols-outlined text-xs">arrow_forward</span>
                </Link>
              </div>

              {loadingHistory ? (
                <p className="text-xs text-gray-400 py-4 text-center">Đang tải lịch sử điểm...</p>
              ) : loyaltyHistory.length === 0 ? (
                <div className="py-8 text-center text-gray-400 space-y-2">
                  <span className="material-symbols-outlined text-4xl text-gray-300">receipt</span>
                  <p className="text-xs">Chưa có giao dịch tích/tiêu điểm nào.</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {loyaltyHistory.map((item) => (
                    <div key={item.pointId} className="py-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm ${
                            item.points >= 0
                              ? 'bg-emerald-50 text-emerald-600'
                              : 'bg-rose-50 text-rose-600'
                          }`}
                        >
                          <span className="material-symbols-outlined text-base">
                            {item.points >= 0 ? 'add_circle' : 'remove_circle'}
                          </span>
                        </div>
                        <div>
                          <div className="text-xs font-bold text-gray-800">
                            {item.description || (item.points >= 0 ? 'Tích điểm đơn hàng' : 'Tiêu điểm giảm giá')}
                          </div>
                          <div className="text-[11px] text-gray-400">
                            {new Date(item.createdAt).toLocaleString('vi-VN')}
                          </div>
                        </div>
                      </div>
                      <div
                        className={`text-sm font-black ${
                          item.points >= 0 ? 'text-emerald-600' : 'text-rose-600'
                        }`}
                      >
                        {item.points >= 0 ? `+${item.points}` : item.points} điểm
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </main>

      <footer className="w-full bg-white border-t border-gray-100 py-4 text-center text-xs text-gray-400">
        © 2024 AI-SMARTSERVE. Hệ thống thành viên & tích điểm QR Order.
      </footer>
      <MobileBottomNav />
    </div>
  );
}
