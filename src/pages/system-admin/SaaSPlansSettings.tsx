import { useState, useEffect } from 'react';
import { 
  Check, 
  Sparkles, 
  Building2, 
  QrCode, 
  Layers, 
  Edit3, 
  Save, 
  RotateCcw,
  CheckCircle2,
  HelpCircle
} from 'lucide-react';
import { systemAdminApi } from '../../api/apis';
import { useNotification } from '../../components/NotificationProvider';

interface SaaSPlan {
  id: string;
  name: string;
  subtitle: string;
  priceMonth: number;
  maxStores: number;
  maxTablesPerStore: number | null; // null = unlimited
  isPopular?: boolean;
  features: string[];
  description: string;
}

const FEATURE_OPTIONS = [
  ['inventory', 'Quản lý kho'],
  ['inventory_bom', 'Định lượng BOM'],
  ['inventory_ai', 'AI quản lý kho'],
  ['advanced_analytics', 'Analytics nâng cao'],
  ['multi_store', 'Nhiều cửa hàng'],
  ['centralized_reports', 'Báo cáo tập trung']
] as const;

const DEFAULT_PLANS: SaaSPlan[] = [
  {
    id: 'basic',
    name: 'Basic',
    subtitle: 'Dành cho các quán cafe độc lập hoặc xe takeaway',
    priceMonth: 239000,
    maxStores: 1,
    maxTablesPerStore: 10,
    features: [
      '1 Điểm bán / Chi nhánh duy nhất',
      'Tối đa 10 Bàn QR đặt món',
      'Menu điện tử & AI Gợi ý đồ uống',
      'Màn hình Bếp / Pha chế (KDS)',
      'Báo cáo doanh thu & đơn hàng cơ bản'
    ],
    description: 'Giải pháp số hóa gọi món tiết kiệm, giúp quán vận hành trơn tru không cần nhiều nhân viên thu ngân.'
  },
  {
    id: 'premium',
    name: 'Premium',
    subtitle: 'Dành cho quán cafe vừa & chuỗi 2 - 3 chi nhánh',
    priceMonth: 1299000,
    maxStores: 3,
    maxTablesPerStore: null,
    isPopular: true,
    features: [
      'Tối đa 3 Điểm bán / Chi nhánh',
      'Không giới hạn số bàn gắn mã QR',
      'Màn hình Điều phối & Thu ngân chuyên sâu',
      'Quản lý kho nguyên vật liệu & Định lượng BOM',
      'Cảnh báo nguyên liệu sắp hết',
      'Phân quyền Nhân viên / Bếp / Quản lý',
      'Hỗ trợ kỹ thuật ưu tiên 24/7'
    ],
    description: 'Gói dịch vụ được ưa chuộng nhất, trang bị đầy đủ nghiệp vụ kho, nhân sự và quản lý nhiều chi nhánh.'
  },
  {
    id: 'pro',
    name: 'Pro',
    subtitle: 'Dành cho thương hiệu FnB lớn & chuỗi nhượng quyền',
    priceMonth: 1999000,
    maxStores: 99,
    maxTablesPerStore: null,
    features: [
      'Không giới hạn số chi nhánh & điểm bán',
      'Không giới hạn số bàn QR toàn hệ thống',
      'Tự động đồng bộ tồn kho giữa các cơ sở',
      'Báo cáo phân tích hành vi khách hàng & AI Analytics',
      'Tùy biến nhận diện thương hiệu (Custom Branding)',
      'API tích hợp ERP / Kế toán bên thứ ba',
      'Quản lý cấp cao & Đội ngũ hỗ trợ chuyên biệt'
    ],
    description: 'Dành cho các chuỗi FnB lớn cần mở rộng nhanh chóng và quản lý tập trung từ hội sở.'
  }
];

export default function SaaSPlansSettings() {
  const { confirm } = useNotification();
  const [plans, setPlans] = useState<SaaSPlan[]>(() => {
    try {
      const saved = localStorage.getItem('system_saas_plans');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
    return DEFAULT_PLANS;
  });

  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState<number>(0);
  const [editMaxStores, setEditMaxStores] = useState<number>(1);
  const [editMaxStaff, setEditMaxStaff] = useState<number>(5);
  const [editMaxTables, setEditMaxTables] = useState<number>(20);
  const [editFeatures, setEditFeatures] = useState<Record<string, boolean>>({});
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    systemAdminApi.getPlans().then((remote: any[]) => {
      if (!remote?.length) return;
      setPlans(current => current.map(local => {
        const server = remote.find(item => item.code === local.id);
        return server ? { ...local, name: server.name || local.name, priceMonth: Number(server.monthlyPrice), maxStores: server.maxStores, maxTablesPerStore: server.maxTablesPerStore, features: Object.entries(server.features ?? {}).filter(([, enabled]) => enabled).map(([code]) => code) } : local;
      }));
    }).catch(() => undefined);
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const startEdit = (plan: SaaSPlan) => {
    setEditingPlanId(plan.id);
    setEditPrice(plan.priceMonth);
    setEditMaxStores(plan.maxStores);
    setEditMaxStaff(plan.id === 'basic' ? 5 : plan.id === 'premium' ? 20 : 50);
    setEditMaxTables(plan.maxTablesPerStore ?? 100);
    setEditFeatures(Object.fromEntries(FEATURE_OPTIONS.map(([code]) => [code, plan.id !== 'basic'])));
  };

  const handleSaveEdit = async (planId: string) => {
    const updated = plans.map(p => {
      if (p.id === planId) {
        return {
          ...p,
          priceMonth: Number(editPrice) || p.priceMonth,
          maxStores: Number(editMaxStores) || p.maxStores
        };
      }
      return p;
    });
    const saved = updated.find(plan => plan.id === planId);
    if (!saved) return;
    try {
      await systemAdminApi.updatePlan(planId, { monthlyPrice: saved.priceMonth, maxStores: saved.maxStores, maxStaff: editMaxStaff, maxTablesPerStore: editMaxTables, isActive: true, features: editFeatures });
      setPlans(updated);
      localStorage.setItem('system_saas_plans', JSON.stringify(updated));
      setEditingPlanId(null);
      showToast('Đã lưu cấu hình gói vào hệ thống.');
    } catch (error: any) {
      showToast(error?.response?.data?.message || 'Không thể lưu cấu hình gói. Vui lòng thử lại.');
    }
  };

  const handleResetDefaults = () => {
    confirm({ tone: 'warning', title: 'Khôi phục bảng giá mặc định?', message: 'Bạn có chắc chắn muốn khôi phục bảng giá về mặc định ban đầu không?', confirmText: 'Khôi phục', onConfirm: async () => {
      setPlans(DEFAULT_PLANS);
      localStorage.removeItem('system_saas_plans');
      setEditingPlanId(null);
      showToast('Đã khôi phục bảng giá mặc định thành công.');
    }});
  };

  const formatVND = (num: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(num);
  };

  return (
    <div className="space-y-stack-lg animate-in fade-in duration-300 pb-12">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-xl border bg-emerald-950/90 text-emerald-200 border-emerald-500/40 text-sm font-bold backdrop-blur-md animate-in slide-in-from-top-3">
          <CheckCircle2 size={18} className="text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-headline-lg text-headline-lg text-primary">
            Cấu Hình Gói Cước & Dịch Vụ SaaS
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1">
            Quản trị biểu phí thuê bao và thông số hạn mức áp dụng cho các quán cafe đối tác trên toàn hệ thống.
          </p>
        </div>

        <button
          onClick={handleResetDefaults}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-container-high hover:bg-secondary-container/40 text-on-surface-variant hover:text-primary text-xs font-bold border border-outline-variant/30 transition self-start sm:self-auto active:scale-95"
          title="Khôi phục lại bảng giá tiêu chuẩn"
        >
          <RotateCcw size={14} />
          <span>Khôi Phục Mặc Định</span>
        </button>
      </div>

      {/* Information Banner */}
      <div className="p-4 rounded-2xl bg-surface-container-low border border-primary/10 flex items-start gap-3">
        <HelpCircle size={20} className="text-primary shrink-0 mt-0.5" />
        <div className="text-xs text-on-surface-variant leading-relaxed">
          <span className="font-bold text-on-surface">Lưu ý quản trị: </span>
          Mục này được tách riêng khỏi Bảng điều khiển để giúp Super Admin tập trung giám sát doanh thu hàng ngày. Khi cập nhật biểu phí tại đây, giá cước sẽ tự động hiển thị khi thêm quán mới hoặc nâng cấp gói cho các quán hiện hành.
        </div>
      </div>

      {/* Pricing Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-stack-lg">
        {plans.map(plan => {
          const isEditing = editingPlanId === plan.id;

          return (
            <div 
              key={plan.id}
              className={`rounded-3xl p-6 sm:p-7 flex flex-col justify-between transition-all duration-300 relative border ${
                plan.isPopular 
                  ? 'bg-surface-container-lowest border-primary/40 shadow-[0_8px_30px_rgba(85,55,34,0.12)] ring-1 ring-primary/20' 
                  : 'bg-surface-container-lowest border-outline-variant/20 shadow-sm hover:border-outline-variant/40'
              }`}
            >
              {plan.isPopular && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-primary text-on-primary px-3.5 py-1 rounded-full text-[11px] font-black uppercase tracking-wider flex items-center gap-1 shadow-md">
                  <Sparkles size={12} />
                  <span>Phổ Biến Nhất</span>
                </div>
              )}

              <div>
                {/* Plan Title & Subtitle */}
                <div className="flex items-center justify-between gap-2 mb-2">
                  <h3 className="font-headline-md text-headline-md text-on-surface font-bold">
                    {plan.name}
                  </h3>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-surface-container-high text-on-surface-variant uppercase font-bold">
                    {plan.id}
                  </span>
                </div>
                <p className="text-xs text-on-surface-variant min-h-[36px] mb-6 leading-relaxed">
                  {plan.subtitle}
                </p>

                {/* Price Display / Edit Form */}
                <div className="p-4 rounded-2xl bg-surface-container-low border border-outline-variant/15 mb-6">
                  {isEditing ? (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-[11px] font-bold text-on-surface-variant mb-1">
                          Giá Thuê Bao (VNĐ / tháng)
                        </label>
                        <input
                          type="number"
                          value={editPrice}
                          onChange={(e) => setEditPrice(Number(e.target.value))}
                          step="10000"
                          className="w-full px-3 py-2 bg-surface-container-lowest border border-primary/40 rounded-xl text-sm font-bold text-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <label className="text-[11px] font-bold text-on-surface-variant">Nhân viên tối đa<input type="number" min="1" value={editMaxStaff} onChange={e => setEditMaxStaff(Number(e.target.value))} className="mt-1 w-full px-3 py-2 bg-surface-container-lowest border rounded-xl text-sm" /></label>
                        <label className="text-[11px] font-bold text-on-surface-variant">Bàn/cửa hàng<input type="number" min="1" value={editMaxTables} onChange={e => setEditMaxTables(Number(e.target.value))} className="mt-1 w-full px-3 py-2 bg-surface-container-lowest border rounded-xl text-sm" /></label>
                      </div>
                      <div className="space-y-1.5">
                        <span className="block text-[11px] font-bold text-on-surface-variant">Tính năng được phép</span>
                        {FEATURE_OPTIONS.map(([code, label]) => <label key={code} className="flex items-center gap-2 text-xs"><input type="checkbox" checked={!!editFeatures[code]} onChange={e => setEditFeatures(prev => ({ ...prev, [code]: e.target.checked }))} />{label}</label>)}
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-on-surface-variant mb-1">
                          Số Điểm Bán / Chi Nhánh Tối Đa
                        </label>
                        <input
                          type="number"
                          value={editMaxStores}
                          onChange={(e) => setEditMaxStores(Number(e.target.value))}
                          min="1"
                          max="999"
                          className="w-full px-3 py-2 bg-surface-container-lowest border border-outline-variant/30 rounded-xl text-sm font-bold text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20"
                        />
                      </div>
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          onClick={() => handleSaveEdit(plan.id)}
                          className="flex-1 py-2 bg-primary hover:bg-primary-container text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition active:scale-95 shadow-sm"
                        >
                          <Save size={14} />
                          <span>Lưu Thay Đổi</span>
                        </button>
                        <button
                          onClick={() => setEditingPlanId(null)}
                          className="px-3 py-2 rounded-xl text-xs font-bold text-on-surface-variant hover:bg-surface-container transition"
                        >
                          Hủy
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-2xl sm:text-3xl font-black text-primary">
                          {formatVND(plan.priceMonth)}
                        </span>
                        <span className="text-xs text-on-surface-variant font-medium">/ tháng</span>
                      </div>
                      <div className="mt-2 flex items-center gap-4 text-xs text-on-surface-variant">
                        <div className="flex items-center gap-1">
                          <Building2 size={14} className="text-primary" />
                          <span>Tối đa <strong className="text-on-surface">{plan.maxStores} chi nhánh</strong></span>
                        </div>
                        <div className="flex items-center gap-1">
                          <QrCode size={14} className="text-primary" />
                          <span>
                            {plan.maxTablesPerStore ? `${plan.maxTablesPerStore} bàn/quán` : 'Không giới hạn bàn'}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Features List */}
                <div className="space-y-3 mb-6">
                  <p className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">
                    Quyền Lợi & Tính Năng Gói:
                  </p>
                  <ul className="space-y-2.5">
                    {plan.features.map((f, idx) => (
                      <li key={idx} className="flex items-start gap-2.5 text-xs text-on-surface">
                        <div className="w-4 h-4 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0 mt-0.5">
                          <Check size={11} strokeWidth={3} />
                        </div>
                        <span className="leading-snug">{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Bottom Action */}
              <div className="pt-4 border-t border-outline-variant/15">
                {!isEditing && (
                  <button
                    onClick={() => startEdit(plan)}
                    className="w-full py-2.5 rounded-xl border border-outline-variant/30 hover:border-primary/40 text-on-surface-variant hover:text-primary hover:bg-secondary-container/20 text-xs font-bold flex items-center justify-center gap-2 transition active:scale-95"
                  >
                    <Edit3 size={14} />
                    <span>Điều Chỉnh Giá & Cấu Hình</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
}
