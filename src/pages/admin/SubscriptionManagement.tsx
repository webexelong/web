import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { meApi } from '../../api/apis';
import { useNotification } from '../../components/NotificationProvider';
import type { MySubscriptionDto, SubscriptionPlanDto } from '../../types/apiTypes';

const featureLabels: Record<string, string> = { inventory: 'Quản lý kho', inventory_bom: 'Định lượng BOM', inventory_ai: 'AI quản lý kho', advanced_analytics: 'Analytics nâng cao', multi_store: 'Nhiều cửa hàng', centralized_reports: 'Báo cáo tập trung' };
const PLAN_RANK: Record<string, number> = { basic: 1, premium: 2, pro: 3 };

function getPlanRank(code?: string | null) {
  return code ? PLAN_RANK[code.trim().toLowerCase()] : undefined;
}

export default function SubscriptionManagement() {
  const [access, setAccess] = useState<MySubscriptionDto | null>(null);
  const [plans, setPlans] = useState<SubscriptionPlanDto[]>([]);
  const [searchParams] = useSearchParams();
  const feature = searchParams.get('feature');
  const [loading, setLoading] = useState(true);
  const [upgradingPlanCode, setUpgradingPlanCode] = useState<string | null>(null);
  const [planToConfirm, setPlanToConfirm] = useState<SubscriptionPlanDto | null>(null);
  const [error, setError] = useState('');
  const { toast, alert } = useNotification();

  useEffect(() => {
    setError('');
    Promise.all([meApi.getSubscription(), meApi.getPlans()])
      .then(([current, available]) => { setAccess(current ?? null); setPlans(available ?? []); })
      .catch(() => setError('Không thể tải thông tin gói dịch vụ. Vui lòng kiểm tra backend đang chạy và thử tải lại trang.'))
      .finally(() => setLoading(false));
  }, []);

  const handleUpgrade = async (plan: SubscriptionPlanDto) => {
    if (upgradingPlanCode) return;
    setUpgradingPlanCode(plan.code);
    try {
      const updated = await meApi.upgradeSubscription(plan.code);
      if (updated) setAccess(updated);
      toast(`Đã chuyển sang gói ${plan.name}. Quản trị viên sẽ liên hệ riêng về phí và ưu đãi.`);
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Không thể nâng cấp gói lúc này. Vui lòng thử lại sau.');
    } finally {
      setUpgradingPlanCode(null);
    }
  };

  if (loading) return <div className="pt-24 p-8 text-center text-on-surface-variant">Đang tải thông tin gói dịch vụ...</div>;

  return <div className="pt-24 px-4 sm:px-6 md:px-8 w-full max-w-[1600px] mx-auto pb-16">
    <div className="mb-6"><h1 className="text-2xl font-black text-on-surface">Gói dịch vụ</h1><p className="mt-1 text-sm text-on-surface-variant">Quản lý gói hiện tại, giới hạn sử dụng và nâng cấp tính năng cho quán.</p></div>
    {error && <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-800">{error}</div>}
    {feature && <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950">Tính năng <strong>{featureLabels[feature] || feature}</strong> chưa có trong gói hiện tại. Chọn gói phù hợp bên dưới để sử dụng.</div>}
    {access && <section className="mb-8 rounded-3xl border border-primary/20 bg-white p-6 shadow-sm"><div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between"><div><p className="text-sm text-on-surface-variant">Gói hiện tại</p><h2 className="text-3xl font-black text-primary uppercase">{access.plan}</h2><p className="mt-1 text-sm">Trạng thái: <strong>{access.status}</strong>{access.daysRemaining != null && <> · Còn <strong>{access.daysRemaining} ngày</strong></>}</p></div><div className="grid grid-cols-3 gap-3 text-center text-sm"><div className="rounded-xl bg-surface-container-low p-3"><strong className="block text-lg">{access.storesUsed ?? 0}/{access.maxStores}</strong><span>Cửa hàng</span></div><div className="rounded-xl bg-surface-container-low p-3"><strong className="block text-lg">{access.staffUsed ?? 0}/{access.maxStaff}</strong><span>Nhân viên</span></div><div className="rounded-xl bg-surface-container-low p-3"><strong className="block text-lg">{access.tablesUsed ?? 0}</strong><span>Bàn đang dùng</span></div></div></div></section>}
    {plans.length > 0 ? <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">{plans.map(plan => { const isCurrent = plan.code.trim().toLowerCase() === access?.plan.trim().toLowerCase(); const currentRank = getPlanRank(access?.plan); const planRank = getPlanRank(plan.code); const canUpgrade = currentRank !== undefined && planRank !== undefined && planRank > currentRank; return <article key={plan.code} className={`rounded-3xl border p-6 ${isCurrent ? 'border-primary bg-primary/5 ring-2 ring-primary/20' : 'border-outline-variant/30 bg-white'}`}><div className="flex items-center justify-between"><h3 className="text-xl font-black text-on-surface">{plan.name || plan.code}</h3>{isCurrent && <span className="rounded-full bg-primary px-3 py-1 text-xs font-bold text-white">Đang dùng</span>}</div><p className="mt-3 text-2xl font-black text-primary">{new Intl.NumberFormat('vi-VN').format(plan.monthlyPrice)}đ<span className="text-sm font-normal text-on-surface-variant">/tháng</span></p><div className="mt-5 space-y-2 text-sm"><p>✓ {plan.maxStores} cửa hàng</p><p>✓ {plan.maxStaff} nhân viên</p><p>✓ {plan.maxTablesPerStore} bàn/cửa hàng</p>{Object.entries(plan.features || {}).filter(([, enabled]) => enabled).map(([code]) => <p key={code}>✓ {featureLabels[code] || code}</p>)}</div>{canUpgrade && <button type="button" onClick={() => setPlanToConfirm(plan)} disabled={upgradingPlanCode !== null} className="mt-6 inline-flex w-full justify-center rounded-xl bg-primary px-4 py-3 font-bold text-white disabled:cursor-wait disabled:opacity-60">{upgradingPlanCode === plan.code ? 'Đang nâng cấp...' : 'Nâng cấp ngay'}</button>}</article> })}</div> : !error && <div className="rounded-2xl border border-outline-variant/30 bg-white p-6 text-center text-on-surface-variant">Chưa có dữ liệu gói dịch vụ. Vui lòng chạy backend để tải cấu hình gói.</div>}
    <p className="mt-8 text-center text-sm text-on-surface-variant">Gói được áp dụng ngay khi bạn nâng cấp. Quản trị viên sẽ liên hệ riêng để trao đổi phí và ưu đãi.</p>
    {planToConfirm && <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/45 p-4" onMouseDown={event => { if (event.target === event.currentTarget) setPlanToConfirm(null); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="upgrade-confirm-title" className="w-full max-w-md rounded-3xl border border-[#e6d8ca] bg-[#F6F1E7] p-6 shadow-2xl">
        <div className="flex items-start gap-3">
          <span className="material-symbols-outlined flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#eadfc8] text-[#69452f]">workspace_premium</span>
          <div className="flex-1">
            <h2 id="upgrade-confirm-title" className="text-lg font-black text-[#4f3828]">Xác nhận nâng cấp gói</h2>
            <p className="mt-1 text-sm text-[#806d60]">Kiểm tra thông tin trước khi áp dụng thay đổi.</p>
          </div>
          <button type="button" onClick={() => setPlanToConfirm(null)} aria-label="Đóng popup" className="rounded-full p-1 text-[#806d60] hover:bg-[#eadfc8]">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div className="mt-5 rounded-2xl border border-[#e6d8ca] bg-white p-4">
          <div className="flex items-center justify-between gap-3 text-sm"><span className="text-[#806d60]">Gói hiện tại</span><strong className="text-[#4f3828]">{access?.plan}</strong></div>
          <div className="my-3 border-t border-dashed border-[#e6d8ca]" />
          <div className="flex items-center justify-between gap-3 text-sm"><span className="text-[#806d60]">Gói mới</span><strong className="text-[#69452f]">{planToConfirm.name}</strong></div>
          <p className="mt-3 text-sm font-bold text-[#69452f]">{new Intl.NumberFormat('vi-VN').format(planToConfirm.monthlyPrice)}đ/tháng theo giá niêm yết</p>
        </div>
        <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950">Gói mới sẽ được áp dụng ngay khi bạn xác nhận. Đây không phải bước thanh toán; quản trị viên sẽ liên hệ riêng để trao đổi phí và ưu đãi.</p>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={() => setPlanToConfirm(null)} className="rounded-xl border border-[#d8c8bb] px-4 py-3 font-semibold text-[#6f5b4d] hover:bg-white">Để sau</button>
          <button type="button" onClick={() => { const plan = planToConfirm; setPlanToConfirm(null); void handleUpgrade(plan); }} disabled={upgradingPlanCode !== null} className="rounded-xl bg-[#69452f] px-4 py-3 font-bold text-white hover:bg-[#553724] disabled:opacity-60">Xác nhận nâng cấp</button>
        </div>
      </section>
    </div>}
  </div>;
}
