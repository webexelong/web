import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { meApi } from '../../api/apis';
import type { MySubscriptionDto, SubscriptionPlanDto } from '../../types/apiTypes';

const featureLabels: Record<string, string> = { inventory: 'Quản lý kho', inventory_bom: 'Định lượng BOM', inventory_ai: 'AI quản lý kho', advanced_analytics: 'Analytics nâng cao', multi_store: 'Nhiều cửa hàng', centralized_reports: 'Báo cáo tập trung' };

export default function SubscriptionManagement() {
  const [access, setAccess] = useState<MySubscriptionDto | null>(null);
  const [plans, setPlans] = useState<SubscriptionPlanDto[]>([]);
  const [searchParams] = useSearchParams();
  const feature = searchParams.get('feature');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setError('');
    Promise.all([meApi.getSubscription(), meApi.getPlans()])
      .then(([current, available]) => { setAccess(current ?? null); setPlans(available ?? []); })
      .catch(() => setError('Không thể tải thông tin gói dịch vụ. Vui lòng kiểm tra backend đang chạy và thử tải lại trang.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="pt-24 p-8 text-center text-on-surface-variant">Đang tải thông tin gói dịch vụ...</div>;

  return <div className="pt-24 px-4 sm:px-6 md:px-8 w-full max-w-[1600px] mx-auto pb-16">
    <div className="mb-6"><h1 className="text-2xl font-black text-on-surface">Gói dịch vụ</h1><p className="mt-1 text-sm text-on-surface-variant">Quản lý gói hiện tại, giới hạn sử dụng và nâng cấp tính năng cho quán.</p></div>
    {error && <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-800">{error}</div>}
    {feature && <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950">Tính năng <strong>{featureLabels[feature] || feature}</strong> chưa có trong gói hiện tại. Chọn gói phù hợp bên dưới để sử dụng.</div>}
    {access && <section className="mb-8 rounded-3xl border border-primary/20 bg-white p-6 shadow-sm"><div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between"><div><p className="text-sm text-on-surface-variant">Gói hiện tại</p><h2 className="text-3xl font-black text-primary uppercase">{access.plan}</h2><p className="mt-1 text-sm">Trạng thái: <strong>{access.status}</strong>{access.daysRemaining != null && <> · Còn <strong>{access.daysRemaining} ngày</strong></>}</p></div><div className="grid grid-cols-3 gap-3 text-center text-sm"><div className="rounded-xl bg-surface-container-low p-3"><strong className="block text-lg">{access.storesUsed ?? 0}/{access.maxStores}</strong><span>Cửa hàng</span></div><div className="rounded-xl bg-surface-container-low p-3"><strong className="block text-lg">{access.staffUsed ?? 0}/{access.maxStaff}</strong><span>Nhân viên</span></div><div className="rounded-xl bg-surface-container-low p-3"><strong className="block text-lg">{access.tablesUsed ?? 0}</strong><span>Bàn đang dùng</span></div></div></div></section>}
    {plans.length > 0 ? <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">{plans.map(plan => { const isCurrent = plan.code === access?.plan; return <article key={plan.code} className={`rounded-3xl border p-6 ${isCurrent ? 'border-primary bg-primary/5 ring-2 ring-primary/20' : 'border-outline-variant/30 bg-white'}`}><div className="flex items-center justify-between"><h3 className="text-xl font-black text-on-surface">{plan.name || plan.code}</h3>{isCurrent && <span className="rounded-full bg-primary px-3 py-1 text-xs font-bold text-white">Đang dùng</span>}</div><p className="mt-3 text-2xl font-black text-primary">{new Intl.NumberFormat('vi-VN').format(plan.monthlyPrice)}đ<span className="text-sm font-normal text-on-surface-variant">/tháng</span></p><div className="mt-5 space-y-2 text-sm"><p>✓ {plan.maxStores} cửa hàng</p><p>✓ {plan.maxStaff} nhân viên</p><p>✓ {plan.maxTablesPerStore} bàn/cửa hàng</p>{Object.entries(plan.features || {}).filter(([, enabled]) => enabled).map(([code]) => <p key={code}>✓ {featureLabels[code] || code}</p>)}</div>{!isCurrent && <a href="https://zalo.me/0968013005" target="_blank" rel="noreferrer" className="mt-6 inline-flex w-full justify-center rounded-xl bg-primary px-4 py-3 font-bold text-white">Yêu cầu nâng cấp</a>}</article> })}</div> : !error && <div className="rounded-2xl border border-outline-variant/30 bg-white p-6 text-center text-on-surface-variant">Chưa có dữ liệu gói dịch vụ. Vui lòng chạy backend để tải cấu hình gói.</div>}
    <p className="mt-8 text-center text-sm text-on-surface-variant">Nếu cần hỗ trợ nâng cấp, vui lòng liên hệ quản trị hệ thống.</p>
  </div>;
}
