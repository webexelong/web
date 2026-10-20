import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { meApi } from '../api/apis';
import { useAuthStore } from '../store/authStore';

type Props = { feature: string; requiredPlan?: string; children: ReactNode };

export default function SubscriptionFeatureGate({ feature, requiredPlan = 'Premium', children }: Props) {
  const user = useAuthStore(state => state.user);
  const [allowed, setAllowed] = useState<boolean | null>(null);
  useEffect(() => {
    if (!user || user.role === 'SystemAdmin') { setAllowed(true); return; }
    meApi.getSubscription().then(access => setAllowed(access?.features?.[feature] !== false)).catch(() => setAllowed(true));
  }, [feature, user]);
  if (allowed === null) return <div className="p-8 text-center text-on-surface-variant">Đang kiểm tra quyền sử dụng gói...</div>;
  if (!allowed) return <div className="mx-4 mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center text-amber-950 md:mx-8"><span className="material-symbols-outlined text-4xl">lock</span><h2 className="mt-3 text-xl font-bold">Tính năng chưa có trong gói hiện tại</h2><p className="mt-2">Gói của bạn chưa hỗ trợ tính năng này. Vui lòng nâng cấp lên {requiredPlan} trở lên để sử dụng.</p><Link to={`/admin/subscription?feature=${encodeURIComponent(feature)}`} className="mt-5 inline-flex rounded-xl bg-primary px-5 py-3 font-bold text-white">Xem gói nâng cấp</Link></div>;
  return <>{children}</>;
}
