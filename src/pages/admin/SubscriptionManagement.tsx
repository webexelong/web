import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { meApi } from '../../api/apis';
import { useNotification } from '../../components/NotificationProvider';
import type { MySubscriptionDto, SubscriptionPlanDto, SubscriptionUpgradeRequestDto } from '../../types/apiTypes';

const featureLabels: Record<string, string> = {
  inventory: 'Quản lý kho',
  inventory_bom: 'Định lượng BOM',
  inventory_ai: 'AI quản lý kho',
  advanced_analytics: 'Analytics nâng cao',
  multi_store: 'Nhiều cửa hàng',
  centralized_reports: 'Báo cáo tập trung'
};

export default function SubscriptionManagement() {
  const [access, setAccess] = useState<MySubscriptionDto | null>(null);
  const [plans, setPlans] = useState<SubscriptionPlanDto[]>([]);
  const [pendingRequest, setPendingRequest] = useState<SubscriptionUpgradeRequestDto | null>(null);
  const [searchParams] = useSearchParams();
  const feature = searchParams.get('feature');
  const [loading, setLoading] = useState(true);
  const [upgradingPlanCode, setUpgradingPlanCode] = useState<string | null>(null);
  const [planToConfirm, setPlanToConfirm] = useState<SubscriptionPlanDto | null>(null);
  const [contactPhone, setContactPhone] = useState('');
  const [userNote, setUserNote] = useState('');
  const [error, setError] = useState('');
  const { toast, alert } = useNotification();

  const loadData = () => {
    setError('');
    Promise.all([meApi.getSubscription(), meApi.getPlans(), meApi.getMyUpgradeRequest()])
      .then(([current, available, myReq]) => {
        setAccess(current ?? null);
        setPlans(available ?? []);
        setPendingRequest(myReq ?? null);
      })
      .catch(() => setError('Không thể tải thông tin gói dịch vụ. Vui lòng kiểm tra backend đang chạy và thử tải lại trang.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRequestUpgrade = async (plan: SubscriptionPlanDto) => {
    if (upgradingPlanCode) return;
    setUpgradingPlanCode(plan.code);
    try {
      await meApi.upgradeSubscription({
        planCode: plan.code,
        phone: contactPhone || undefined,
        note: userNote || undefined
      });
      toast(`Đã gửi yêu cầu chuyển sang gói ${plan.name}. Quản trị viên sẽ liên hệ qua Zalo/SĐT để xác nhận và kích hoạt!`);
      setPlanToConfirm(null);
      setUserNote('');
      loadData();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Không thể gửi yêu cầu lúc này. Vui lòng thử lại sau.');
    } finally {
      setUpgradingPlanCode(null);
    }
  };

  const handleCancelRequest = async () => {
    try {
      await meApi.cancelMyUpgradeRequest();
      toast('Đã hủy yêu cầu chuyển gói.');
      setPendingRequest(null);
      loadData();
    } catch {
      alert('Không thể hủy yêu cầu lúc này.');
    }
  };

  if (loading) return <div className="pt-24 p-8 text-center text-on-surface-variant">Đang tải thông tin gói dịch vụ...</div>;

  return (
    <div className="pt-24 px-4 sm:px-6 md:px-8 w-full max-w-[1600px] mx-auto pb-16">
      <div className="mb-6">
        <h1 className="text-2xl font-black text-on-surface">Gói dịch vụ</h1>
        <p className="mt-1 text-sm text-on-surface-variant">Quản lý gói hiện tại, giới hạn sử dụng và gửi yêu cầu nâng cấp tính năng cho quán.</p>
      </div>

      {error && <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-800">{error}</div>}

      {/* Pending Request Alert */}
      {pendingRequest && (
        <div className="mb-6 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-2xl text-amber-600 animate-spin">sync</span>
            <div>
              <p className="font-bold text-sm">
                Đang có yêu cầu chuyển sang gói <span className="uppercase text-primary font-black">{pendingRequest.requestedPlanCode}</span> chờ duyệt
              </p>
              <p className="text-xs text-amber-800 mt-0.5">
                Yêu cầu gửi lúc {new Date(pendingRequest.createdAt).toLocaleString('vi-VN')}. Quản trị viên sẽ liên hệ qua Zalo/SĐT để xác nhận và kích hoạt gói cho quán.
              </p>
            </div>
          </div>
          <button
            onClick={handleCancelRequest}
            className="px-3.5 py-1.5 rounded-xl border border-amber-300 bg-white hover:bg-amber-100 text-xs font-bold text-amber-900 transition self-start sm:self-auto shrink-0"
          >
            Hủy yêu cầu
          </button>
        </div>
      )}

      {feature && (
        <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950">
          Tính năng <strong>{featureLabels[feature] || feature}</strong> chưa có trong gói hiện tại. Chọn gói phù hợp bên dưới để gửi yêu cầu mở khóa.
        </div>
      )}

      {/* Current Access Card */}
      {access && (
        <section className="mb-8 rounded-3xl border border-primary/20 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm text-on-surface-variant">Gói hiện tại</p>
              <h2 className="text-3xl font-black text-primary uppercase">{access.plan}</h2>
              <p className="mt-1 text-sm">
                Trạng thái:{' '}
                <strong className={`capitalize ${access.status === 'trialing' ? 'text-amber-700' : 'text-emerald-700'}`}>
                  {access.status === 'trialing' ? 'Dùng thử 14 ngày' : access.status}
                </strong>
                {access.daysRemaining != null && <> · Còn <strong>{access.daysRemaining} ngày</strong></>}
              </p>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center text-sm">
              <div className="rounded-xl bg-surface-container-low p-3">
                <strong className="block text-lg">{access.storesUsed ?? 0}/{access.maxStores}</strong>
                <span>Cửa hàng</span>
              </div>
              <div className="rounded-xl bg-surface-container-low p-3">
                <strong className="block text-lg">{access.staffUsed ?? 0}/{access.maxStaff}</strong>
                <span>Nhân viên</span>
              </div>
              <div className="rounded-xl bg-surface-container-low p-3">
                <strong className="block text-lg">{access.tablesUsed ?? 0}/{access.maxTablesPerStore ?? '∞'}</strong>
                <span>Bàn phục vụ</span>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Plans Grid */}
      {plans.length > 0 ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {plans.map(plan => {
            const isCurrent = plan.code.trim().toLowerCase() === access?.plan.trim().toLowerCase();
            const isTargetPending = pendingRequest?.requestedPlanCode.trim().toLowerCase() === plan.code.trim().toLowerCase();

            return (
              <article
                key={plan.code}
                className={`rounded-3xl border p-6 flex flex-col justify-between ${
                  isCurrent ? 'border-primary bg-primary/5 ring-2 ring-primary/20' : 'border-outline-variant/30 bg-white'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-black text-on-surface">{plan.name || plan.code}</h3>
                    {isCurrent && <span className="rounded-full bg-primary px-3 py-1 text-xs font-bold text-white">Đang dùng</span>}
                    {isTargetPending && <span className="rounded-full bg-amber-500 px-3 py-1 text-xs font-bold text-white">Đang chờ duyệt</span>}
                  </div>
                  <p className="mt-3 text-2xl font-black text-primary">
                    {new Intl.NumberFormat('vi-VN').format(plan.monthlyPrice)}đ
                    <span className="text-sm font-normal text-on-surface-variant">/tháng</span>
                  </p>
                  <div className="mt-5 space-y-2 text-sm">
                    <p>✓ {plan.maxStores} cửa hàng</p>
                    <p>✓ {plan.maxStaff} nhân viên</p>
                    <p>✓ {plan.maxTablesPerStore} bàn/cửa hàng</p>
                    {Object.entries(plan.features || {})
                      .filter(([, enabled]) => enabled)
                      .map(([code]) => (
                        <p key={code}>✓ {featureLabels[code] || code}</p>
                      ))}
                  </div>
                </div>

                {!isCurrent && (
                  <button
                    type="button"
                    onClick={() => {
                      setPlanToConfirm(plan);
                      setUserNote('');
                    }}
                    disabled={upgradingPlanCode !== null || isTargetPending}
                    className="mt-6 inline-flex w-full justify-center rounded-xl bg-primary px-4 py-3 font-bold text-white transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isTargetPending ? 'Đang chờ duyệt...' : 'Yêu Cầu Đổi Gói'}
                  </button>
                )}
              </article>
            );
          })}
        </div>
      ) : (
        !error && <div className="rounded-2xl border border-outline-variant/30 bg-white p-6 text-center text-on-surface-variant">Chưa có dữ liệu gói dịch vụ.</div>
      )}

      <p className="mt-8 text-center text-sm text-on-surface-variant">
        Sau khi gửi yêu cầu, Quản trị viên hệ thống sẽ liên hệ trực tiếp qua Zalo/SĐT để xác nhận thông tin thanh toán chuyển khoản và kích hoạt gói cho quán.
      </p>

      {/* Confirmation Modal */}
      {planToConfirm && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/45 backdrop-blur-xs p-4"
          onMouseDown={event => {
            if (event.target === event.currentTarget) setPlanToConfirm(null);
          }}
        >
          <section role="dialog" aria-modal="true" className="w-full max-w-md rounded-3xl border border-[#e6d8ca] bg-[#F6F1E7] p-6 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#eadfc8] text-[#69452f]">
                workspace_premium
              </span>
              <div className="flex-1">
                <h2 className="text-lg font-black text-[#4f3828]">Gửi yêu cầu đổi gói cước</h2>
                <p className="mt-1 text-sm text-[#806d60]">Xác nhận thông tin chuyển đổi gói dịch vụ.</p>
              </div>
              <button
                type="button"
                onClick={() => setPlanToConfirm(null)}
                aria-label="Đóng popup"
                className="rounded-full p-1 text-[#806d60] hover:bg-[#eadfc8]"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="mt-5 rounded-2xl border border-[#e6d8ca] bg-white p-4 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-[#806d60]">Gói hiện tại:</span>
                <strong className="text-[#4f3828] uppercase">{access?.plan}</strong>
              </div>
              <div className="border-t border-dashed border-[#e6d8ca]" />
              <div className="flex items-center justify-between text-sm">
                <span className="text-[#806d60]">Gói muốn chuyển:</span>
                <strong className="text-[#69452f] uppercase">{planToConfirm.name}</strong>
              </div>
              <p className="text-sm font-bold text-[#69452f] text-right">
                {new Intl.NumberFormat('vi-VN').format(planToConfirm.monthlyPrice)}đ/tháng
              </p>
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-bold text-[#4f3828] mb-1">
                  Số điện thoại / Zalo để Admin liên hệ:
                </label>
                <input
                  type="text"
                  placeholder="Nhập SĐT / Zalo của bạn..."
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-[#d8c8bb] bg-white text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#69452f]/30"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#4f3828] mb-1">
                  Lời nhắn / Ghi chú thêm (Tùy chọn):
                </label>
                <textarea
                  placeholder="VD: Cần hỗ trợ thanh toán gói 6 tháng, muốn xuất hóa đơn..."
                  value={userNote}
                  onChange={(e) => setUserNote(e.target.value)}
                  className="w-full p-3 rounded-xl border border-[#d8c8bb] bg-white text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#69452f]/30 resize-none h-18"
                />
              </div>
            </div>

            <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-950 border border-amber-200">
              Yêu cầu sẽ được gửi tới Ban quản trị. Quản trị viên sẽ liên hệ với bạn qua Zalo/SĐT để hướng dẫn thanh toán và kích hoạt gói ngay cho quán.
            </p>

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setPlanToConfirm(null)}
                className="rounded-xl border border-[#d8c8bb] px-4 py-2.5 font-semibold text-xs text-[#6f5b4d] hover:bg-white"
              >
                Để sau
              </button>
              <button
                type="button"
                onClick={() => void handleRequestUpgrade(planToConfirm)}
                disabled={upgradingPlanCode !== null}
                className="rounded-xl bg-[#69452f] px-4 py-2.5 font-bold text-xs text-white hover:bg-[#553724] disabled:opacity-60 transition"
              >
                {upgradingPlanCode === planToConfirm.code ? 'Đang gửi yêu cầu...' : 'Gửi Yêu Cầu Đổi Gói'}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
