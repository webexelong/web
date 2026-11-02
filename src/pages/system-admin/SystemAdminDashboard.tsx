import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { systemAdminApi } from '../../api/apis';
import type { PlatformStatsDto, TenantDetailDto } from '../../types/apiTypes';

export default function SystemAdminDashboard() {
  const [stats, setStats] = useState<PlatformStatsDto | null>(null);
  const [tenants, setTenants] = useState<TenantDetailDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [trendRange, setTrendRange] = useState<'7days' | 'monthly'>('7days');

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [statsData, tenantsData] = await Promise.all([
          systemAdminApi.getPlatformStats(),
          systemAdminApi.getTenants()
        ]);
        setStats(statsData);
        setTenants(tenantsData || []);
      } catch (err) {
        console.error('Lỗi khi tải thống kê nền tảng:', err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
  };

  // Dữ liệu doanh thu thực tế 7 ngày gần nhất từ cơ sở dữ liệu (Orders)
  const dailyData = stats?.dailyRevenue || [];
  const maxRevenue = Math.max(...dailyData.map(d => d.revenue), 1);

  const trendDays = dailyData.map((day, idx) => {
    // Chiều cao cột tương đối theo doanh thu thực tế (tối thiểu 8% để hiển thị trục)
    const heightPercent = day.revenue > 0 ? Math.max(Math.round((day.revenue / maxRevenue) * 90), 14) : 8;
    return {
      label: day.dayLabel,
      date: day.date,
      amount: day.revenue,
      orderCount: day.orderCount,
      height: heightPercent,
      isToday: idx === dailyData.length - 1
    };
  });

  const total7DaysRevenue = dailyData.reduce((sum, d) => sum + d.revenue, 0);
  const total7DaysOrders = dailyData.reduce((sum, d) => sum + d.orderCount, 0);
  const avgDailyRevenue = dailyData.length > 0 ? Math.round(total7DaysRevenue / dailyData.length) : 0;

  return (
    <div className="pt-4 pb-stack-lg animate-in fade-in duration-300">
      {/* Header - Gọn gàng, chuyên nghiệp, loại bỏ toàn bộ banner văn vẻ sáo rỗng */}
      <header className="mb-stack-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-headline-lg text-headline-lg text-primary">
            Tổng Quan Nền Tảng
          </h2>
          <p className="font-body-md text-body-md text-on-surface-variant">
            Giám sát vận hành các đối tác quán cafe, lưu lượng giao dịch và doanh thu dịch vụ toàn sàn.
          </p>
        </div>

        <Link
          to="/system-admin/tenants"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-container text-white text-sm font-bold shadow-sm transition-all active:scale-95 self-start sm:self-auto"
        >
          <span className="material-symbols-outlined text-xl">add</span>
          <span>Thêm Quán Mới</span>
        </Link>
      </header>

      {/* Top Level Bento Grid Stats - Các chỉ số TO RÕ, NỔI BẬT DỄ NHÌN */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-stack-md mb-stack-lg">
        {/* Doanh Thu Toàn Sàn (GMV) */}
        <div className="bg-surface-container-lowest p-stack-md rounded-3xl shadow-[0_4px_20px_rgba(85,55,34,0.06)] border border-primary/5 hover:border-primary/20 transition-all">
          <div className="flex justify-between items-start mb-4">
            <div className="w-12 h-12 rounded-2xl bg-secondary-container/40 flex items-center justify-center text-primary">
              <span className="material-symbols-outlined text-2xl">payments</span>
            </div>
            <span className="text-emerald-500 font-label-sm bg-emerald-500/10 px-2 py-1 rounded-lg font-bold">
              +18.4%
            </span>
          </div>
          <p className="text-on-surface-variant font-label-md mb-1">Doanh Thu Toàn Sàn (GMV)</p>
          <h3 className="font-headline-md text-headline-md text-on-surface font-black truncate" title={formatCurrency(stats?.totalGmv ?? 0)}>
            {loading ? '...' : formatCurrency(stats?.totalGmv ?? 0)}
          </h3>
          <p className="text-[11px] text-on-surface-variant mt-2">Tổng giá trị đơn hàng khách đã thanh toán</p>
        </div>

        {/* Doanh Thu Thuê Bao SaaS */}
        <div className="bg-surface-container-lowest p-stack-md rounded-3xl shadow-[0_4px_20px_rgba(85,55,34,0.06)] border border-primary/5 hover:border-primary/20 transition-all">
          <div className="flex justify-between items-start mb-4">
            <div className="w-12 h-12 rounded-2xl bg-secondary-container/40 flex items-center justify-center text-primary">
              <span className="material-symbols-outlined text-2xl">credit_card</span>
            </div>
            <span className="text-primary font-label-sm bg-primary/10 px-2 py-1 rounded-lg font-bold">
              Hàng tháng
            </span>
          </div>
          <p className="text-on-surface-variant font-label-md mb-1">Phí Dịch Vụ SaaS</p>
          <h3 className="font-headline-md text-headline-md text-on-surface font-black truncate" title={formatCurrency(stats?.monthlySubscriptionRevenue ?? 0)}>
            {loading ? '...' : formatCurrency(stats?.monthlySubscriptionRevenue ?? 0)}
          </h3>
          <p className="text-[11px] text-on-surface-variant mt-2">Ước tính phí thuê bao thu từ đối tác</p>
        </div>

        {/* Tổng Quán Đối Tác */}
        <div className="bg-surface-container-lowest p-stack-md rounded-3xl shadow-[0_4px_20px_rgba(85,55,34,0.06)] border border-primary/5 hover:border-primary/20 transition-all">
          <div className="flex justify-between items-start mb-4">
            <div className="w-12 h-12 rounded-2xl bg-secondary-container/40 flex items-center justify-center text-primary">
              <span className="material-symbols-outlined text-2xl">storefront</span>
            </div>
            <span className="text-emerald-500 font-label-sm bg-emerald-500/10 px-2 py-1 rounded-lg font-bold">
              {stats?.activeTenants ?? 0} đang chạy
            </span>
          </div>
          <p className="text-on-surface-variant font-label-md mb-1">Quán Cafe Đối Tác</p>
          <h3 className="font-headline-md text-headline-md text-on-surface font-black">
            {loading ? '...' : (stats?.totalTenants ?? 0)} <span className="text-sm font-normal text-on-surface-variant">thương hiệu</span>
          </h3>
          <p className="text-[11px] text-on-surface-variant mt-2">
            Đang quản lý {stats?.totalStores ?? 0} điểm bán trên toàn quốc
          </p>
        </div>

        {/* Bàn Gắn Mã QR */}
        <div className="bg-surface-container-lowest p-stack-md rounded-3xl shadow-[0_4px_20px_rgba(85,55,34,0.06)] border border-primary/5 hover:border-primary/20 transition-all">
          <div className="flex justify-between items-start mb-4">
            <div className="w-12 h-12 rounded-2xl bg-secondary-container/40 flex items-center justify-center text-primary">
              <span className="material-symbols-outlined text-2xl">qr_code_2</span>
            </div>
            <span className="text-on-surface-variant font-label-sm bg-surface-container px-2 py-1 rounded-lg">
              {stats?.totalOrders ?? 0} lượt đặt
            </span>
          </div>
          <p className="text-on-surface-variant font-label-md mb-1">Bàn Gắn Mã QR</p>
          <h3 className="font-headline-md text-headline-md text-on-surface font-black">
            {loading ? '...' : (stats?.totalTables ?? 0)} <span className="text-sm font-normal text-on-surface-variant">bàn</span>
          </h3>
          <p className="text-[11px] text-on-surface-variant mt-2">Tổng số điểm quét tự phục vụ</p>
        </div>
      </div>

      {/* Analytics & Trends Section - Biểu đồ cột Xu hướng Tăng Trưởng */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-stack-lg mb-stack-lg">
        {/* Platform Revenue Trend Chart */}
        <div className="lg:col-span-2 bg-surface-container-lowest p-stack-lg rounded-[2.5rem] shadow-[0_4px_20px_rgba(85,55,34,0.06)] border border-primary/5 flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
              <div>
                <h4 className="font-headline-md text-primary">Biến Động Doanh Thu Toàn Hệ Thống</h4>
                <p className="text-xs text-on-surface-variant">Theo dõi xu hướng giao dịch của tất cả các quán đối tác</p>
              </div>
              <div className="flex items-center gap-1 bg-surface-container p-1 rounded-xl">
                <button
                  onClick={() => setTrendRange('7days')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition ${trendRange === '7days' ? 'bg-primary text-white shadow-xs' : 'text-on-surface-variant hover:text-on-surface'}`}
                >
                  7 Ngày Qua
                </button>
                <button
                  onClick={() => setTrendRange('monthly')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition ${trendRange === 'monthly' ? 'bg-primary text-white shadow-xs' : 'text-on-surface-variant hover:text-on-surface'}`}
                >
                  Theo Tháng
                </button>
              </div>
            </div>

            {/* Simulated Dynamic Bar Chart */}
            <div className="h-[200px] w-full relative overflow-hidden flex items-end justify-between gap-3 px-4 pt-6">
              {trendDays.map((day, idx) => (
                <div key={idx} className="flex-1 flex flex-col items-center gap-2 group h-full justify-end">
                  {/* Tooltip on hover with real order count */}
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] font-bold bg-surface-container-high px-2 py-1 rounded-lg shadow-md text-primary whitespace-nowrap mb-1 flex flex-col items-center pointer-events-none">
                    <span>{formatCurrency(day.amount)}</span>
                    <span className="text-[9px] text-on-surface-variant font-normal">{day.orderCount} đơn hàng</span>
                  </div>
                  {/* Bar */}
                  <div 
                    style={{ height: `${day.height}%` }}
                    className={`w-full rounded-t-xl transition-all duration-300 group-hover:brightness-125 ${
                      day.isToday 
                        ? 'bg-primary shadow-[0_0_12px_rgba(202,138,4,0.4)]' 
                        : 'bg-primary/20 group-hover:bg-primary/50'
                    }`}
                  />
                </div>
              ))}
            </div>

            {/* Date Labels */}
            <div className="flex justify-between mt-4 px-4 text-[11px] text-on-surface-variant font-bold uppercase tracking-wider">
              {trendDays.map((day, idx) => (
                <span key={idx} className={day.isToday ? 'text-primary font-black' : ''}>
                  {day.label}
                </span>
              ))}
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-outline-variant/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-on-surface-variant">
            <span>
              Tổng 7 ngày: <strong className="text-on-surface font-bold">{formatCurrency(total7DaysRevenue)}</strong> ({total7DaysOrders} đơn thực tế)
            </span>
            <span>
              Trung bình/ngày: <strong className="text-primary font-bold">{formatCurrency(avgDailyRevenue)}</strong>
            </span>
          </div>
        </div>

        {/* Top Performing Tenants List */}
        <div className="bg-surface-container-lowest p-stack-lg rounded-[2.5rem] shadow-[0_4px_20px_rgba(85,55,34,0.06)] border border-primary/5 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-stack-md">
              <h4 className="font-headline-md text-primary">Top Quán Tích Cực</h4>
              <Link to="/system-admin/tenants" className="text-xs text-primary font-bold hover:underline">
                Xem tất cả
              </Link>
            </div>

            <div className="space-y-4">
              {tenants.slice(0, 4).map((t, idx) => (
                <div key={t.tenantId} className="flex items-center gap-3 p-2 rounded-2xl hover:bg-surface-container transition">
                  <div className="w-11 h-11 rounded-2xl overflow-hidden bg-surface-container border border-outline-variant/20 shrink-0 relative">
                    <img 
                      src={t.logoUrl || 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=100&q=80'} 
                      alt={t.name}
                      className="w-full h-full object-cover" 
                    />
                    <span className="absolute bottom-0 right-0 w-4 h-4 bg-primary text-white text-[9px] font-black flex items-center justify-center rounded-tl-lg">
                      {idx + 1}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-label-md text-on-surface font-bold truncate">{t.name}</p>
                    <p className="text-[11px] text-on-surface-variant truncate">
                      {t.storeCount} chi nhánh • {t.tableCount} bàn QR
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-black text-primary block">
                      {t.totalGmv > 0 ? formatCurrency(t.totalGmv) : 'Đang chạy'}
                    </span>
                    <span className="text-[10px] text-on-surface-variant">
                      {t.orderCount} đơn
                    </span>
                  </div>
                </div>
              ))}

              {tenants.length === 0 && !loading && (
                <div className="py-8 text-center text-xs text-on-surface-variant">
                  Chưa có quán cafe đối tác nào.
                </div>
              )}
            </div>
          </div>

          <div className="pt-4 border-t border-outline-variant/10 mt-4">
            <Link
              to="/system-admin/tenants"
              className="w-full py-2.5 rounded-xl border border-outline-variant/30 hover:border-primary/40 text-on-surface-variant hover:text-primary hover:bg-secondary-container/20 text-xs font-bold flex items-center justify-center gap-2 transition"
            >
              <span>Quản Lý Toàn Bộ Đối Tác</span>
              <span className="material-symbols-outlined text-sm">arrow_forward</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Bottom Quick Table: Recent Tenants Summary */}
      <div className="bg-surface-container-lowest p-stack-lg rounded-[2.5rem] shadow-[0_4px_20px_rgba(85,55,34,0.06)] border border-primary/5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h3 className="font-headline-md text-primary">Thương Hiệu FnB Đang Kết Nối</h3>
            <p className="text-xs text-on-surface-variant">Trạng thái gói cước và điểm bán thực tế</p>
          </div>

          <Link
            to="/system-admin/tenants"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-surface-container hover:bg-secondary-container/40 text-on-surface text-xs font-bold transition border border-outline-variant/20 self-start sm:self-auto"
          >
            <span>Mở Bảng Quản Lý Chi Tiết</span>
            <span className="material-symbols-outlined text-sm">open_in_new</span>
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-on-surface-variant uppercase tracking-wider font-bold border-b border-outline-variant/15">
              <tr>
                <th className="pb-3 px-3">Quán Cafe</th>
                <th className="pb-3 px-3">Chủ Sở Hữu</th>
                <th className="pb-3 px-3">Gói Dịch Vụ</th>
                <th className="pb-3 px-3">Quy Mô</th>
                <th className="pb-3 px-3">Trạng Thái</th>
                <th className="pb-3 px-3 text-right">Liên Hệ Nhanh</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/10">
              {tenants.slice(0, 5).map(t => (
                <tr key={t.tenantId} className="hover:bg-surface-container/50 transition">
                  <td className="py-3.5 px-3">
                    <div className="flex items-center gap-3">
                      <img 
                        src={t.logoUrl || 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=100&q=80'} 
                        alt={t.name}
                        className="w-9 h-9 rounded-xl object-cover border border-outline-variant/20" 
                      />
                      <div>
                        <div className="font-bold text-on-surface text-sm">{t.name}</div>
                        <div className="text-[11px] text-on-surface-variant font-mono">slug: {t.slug}</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3.5 px-3">
                    <div className="font-bold text-on-surface">{t.ownerName}</div>
                    <div className="text-[11px] text-on-surface-variant">{t.ownerEmail}</div>
                  </td>
                  <td className="py-3.5 px-3">
                    <div className="flex flex-col items-start gap-1">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                        t.plan === 'premium' || t.plan === 'enterprise'
                          ? 'bg-purple-500/15 text-purple-400 border border-purple-500/30'
                          : t.plan === 'pro'
                          ? 'bg-secondary-container text-on-secondary-container border border-primary/20'
                          : t.plan === 'basic'
                          ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30'
                          : 'bg-slate-200/80 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-300 dark:border-slate-700'
                      }`}>
                        {t.plan === 'free' ? 'MIỄN PHÍ' : (t.plan || 'basic')}
                      </span>
                      {(t.isTrial || t.subscriptionStatus === 'trialing') && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/40 uppercase tracking-tight">
                          <span className="w-1 h-1 rounded-full bg-amber-500 animate-pulse"></span>
                          Trial
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-3.5 px-3">
                    <span className="font-bold text-on-surface">{t.storeCount} chi nhánh</span>
                    <span className="text-[11px] text-on-surface-variant block">{t.tableCount} bàn QR</span>
                  </td>
                  <td className="py-3.5 px-3">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                      t.isActive 
                        ? 'bg-emerald-500/10 text-emerald-500' 
                        : 'bg-rose-500/10 text-rose-500'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${t.isActive ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                      {t.isActive ? 'Hoạt động' : 'Tạm khóa'}
                    </span>
                  </td>
                  <td className="py-3.5 px-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <a 
                        href={`tel:${t.ownerPhone}`} 
                        className="p-1.5 rounded-xl bg-surface-container hover:bg-primary/20 text-on-surface-variant hover:text-primary transition" 
                        title={`Gọi ${t.ownerPhone}`}
                      >
                        <span className="material-symbols-outlined text-base">call</span>
                      </a>
                      <a 
                        href={`mailto:${t.ownerEmail}`} 
                        className="p-1.5 rounded-xl bg-surface-container hover:bg-primary/20 text-on-surface-variant hover:text-primary transition" 
                        title={`Gửi email đến ${t.ownerEmail}`}
                      >
                        <span className="material-symbols-outlined text-base">mail</span>
                      </a>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
