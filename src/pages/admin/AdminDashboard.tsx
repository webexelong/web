import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { analyticsApi, orderApi, menuApi, meApi } from '../../api/apis';
import type { MySubscriptionDto } from '../../types/apiTypes';
import type { ShiftOperationsDto, ActiveTableStatusDto, ShiftStockAlertDto } from '../../types/apiTypes';
import { 
  Coffee, 
  DollarSign, 
  Users, 
  Clock, 
  AlertTriangle, 
  TrendingUp, 
  TrendingDown, 
  RefreshCw, 
  Layers, 
  Sparkles, 
  ChevronRight, 
  CheckCircle2, 
  Flame,
  CreditCard,
  Banknote,
  UtensilsCrossed,
  X
} from 'lucide-react';

export default function AdminDashboard() {
  const { user } = useAuthStore();
  const activeStoreId = user?.storeId ?? 0;


  const [shiftData, setShiftData] = useState<ShiftOperationsDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTable, setSelectedTable] = useState<ActiveTableStatusDto | null>(null);
  const [subscription, setSubscription] = useState<MySubscriptionDto | null>(null);

  useEffect(() => { meApi.getSubscription().then(setSubscription).catch(() => setSubscription(null)); }, []);

  const fetchShiftData = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    else setRefreshing(true);

    try {
      const data = await analyticsApi.getShiftOperations(activeStoreId);
      setShiftData(data);
    } catch (err) {
      console.error('Failed to load shift operations:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeStoreId]);

  useEffect(() => {
    fetchShiftData(true);
    // Auto refresh every 30 seconds for live shift monitoring
    const interval = setInterval(() => fetchShiftData(false), 30000);
    return () => clearInterval(interval);
  }, [fetchShiftData]);

  if (loading && !shiftData) {
    return (
      <div className="pt-24 px-container-margin pb-stack-lg min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          <p className="text-on-surface-variant font-medium text-sm">Đang tải số liệu ca trực hôm nay...</p>
        </div>
      </div>
    );
  }

  const d = shiftData;

  return (
    <div className="pt-24 px-4 sm:px-6 md:px-8 w-full max-w-[1600px] mx-auto pb-16 animate-in fade-in duration-500 font-sans">
      {/* Shift Header & Action Toolbar */}
      <header className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/80 dark:bg-surface-container-low backdrop-blur-md p-5 rounded-3xl border border-primary/10 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-primary-container flex items-center justify-center text-white shadow-md">
            <Coffee size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl sm:text-2xl font-black text-on-surface tracking-tight">
                {d?.storeName || user?.storeName || user?.brandName || 'Cửa hàng hiện tại'}
              </h2>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                Đang mở ca trực
              </span>
            </div>
            <p className="text-xs sm:text-sm text-on-surface-variant mt-0.5">
              Bảng điều khiển tác chiến ca trực hôm nay ({new Date().toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })})
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 self-start md:self-auto">
          <button
            onClick={() => fetchShiftData(false)}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface text-xs font-bold transition-all border border-outline-variant/30 active:scale-95 disabled:opacity-50"
            title="Làm mới dữ liệu"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin text-primary' : ''} />
            <span>{refreshing ? 'Đang cập nhật...' : 'Cập nhật'}</span>
          </button>
          
          <Link
            to="/admin/analytics"
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary-container transition-all shadow-sm active:scale-95"
          >
            <span>Báo Cáo Doanh Thu</span>
            <ChevronRight size={14} />
          </Link>
        </div>
      </header>

      {subscription && <section className="mb-6 rounded-2xl border border-primary/15 bg-white p-5 shadow-sm"><div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between"><div><p className="text-xs font-bold uppercase tracking-wide text-on-surface-variant">Gói dịch vụ hiện tại</p><h3 className="mt-1 text-xl font-black text-primary uppercase">{subscription.plan}</h3><p className="mt-1 text-sm text-on-surface-variant">{subscription.status === 'suspended' ? 'Gói đã hết hạn, một số tính năng đang bị khóa.' : subscription.daysRemaining != null ? `Còn ${subscription.daysRemaining} ngày dùng thử.` : 'Đang hoạt động.'}</p></div><div className="flex flex-wrap gap-2 text-xs"><span className="rounded-lg bg-surface-container-low px-3 py-2">Cửa hàng: {subscription.storesUsed ?? 0}/{subscription.maxStores}</span><span className="rounded-lg bg-surface-container-low px-3 py-2">Nhân viên: {subscription.staffUsed ?? 0}/{subscription.maxStaff}</span><Link to="/admin/subscription" className="rounded-lg bg-primary px-4 py-2 font-bold text-white">Xem gói & nâng cấp</Link></div></div></section>}

      {/* Critical Stock Alert Banner if any */}
      {d?.lowStockAlerts && d.lowStockAlerts.length > 0 && (
        <div className="mb-6 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-800 flex items-center justify-center shrink-0">
              <AlertTriangle size={20} className="text-amber-700" />
            </div>
            <div>
              <p className="font-bold text-sm text-amber-900">
                Cảnh báo kho ca trực: {d.lowStockAlerts.length} nguyên vật liệu chạm ngưỡng an toàn!
              </p>
              <p className="text-xs text-amber-800/80 mt-0.5">
                {d.lowStockAlerts.slice(0, 3).map(a => `${a.ingredientName} (còn ${a.currentQuantity} ${a.unit})`).join(' • ')}
                {d.lowStockAlerts.length > 3 ? ` và +${d.lowStockAlerts.length - 3} món khác` : ''}
              </p>
            </div>
          </div>
          <Link
            to="/admin/inventory"
            className="px-4 py-2 bg-amber-800 hover:bg-amber-900 text-white rounded-xl text-xs font-bold transition-all self-start sm:self-auto shadow-xs whitespace-nowrap"
          >
            Nhập Kho Ngay
          </Link>
        </div>
      )}

      {/* 4 Core Shift Metrics (FnB Operations Scorecard) */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* Metric 1: Today Revenue */}
        <div className="bg-white dark:bg-surface-container-lowest p-5 rounded-3xl border border-primary/10 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
          <div className="flex justify-between items-start mb-3">
            <div className="w-11 h-11 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
              <DollarSign size={22} />
            </div>
            <div className={`flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-extrabold ${
              (d?.revenueGrowthPercent ?? 0) >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
            }`}>
              {(d?.revenueGrowthPercent ?? 0) >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
              <span>{Math.abs(d?.revenueGrowthPercent ?? 0)}% vs hôm qua</span>
            </div>
          </div>
          <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Doanh Thu Trong Ca</p>
          <h3 className="text-2xl font-black text-on-surface mt-1">
            {(d?.todayRevenue ?? 0).toLocaleString('vi-VN')}đ
          </h3>
          <div className="flex items-center gap-3 mt-3 pt-3 border-t border-outline-variant/10 text-xs text-on-surface-variant">
            <span className="flex items-center gap-1 font-semibold text-emerald-700">
              <Banknote size={13} /> {(d?.cashRevenue ?? 0).toLocaleString('vi-VN')}đ Tiền mặt
            </span>
            <span className="text-outline-variant">•</span>
            <span className="flex items-center gap-1 font-semibold text-primary">
              <CreditCard size={13} /> {(d?.bankTransferRevenue ?? 0).toLocaleString('vi-VN')}đ VietQR
            </span>
          </div>
        </div>

        {/* Metric 2: Barista Kitchen Queue */}
        <div className="bg-white dark:bg-surface-container-lowest p-5 rounded-3xl border border-primary/10 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start mb-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-700">
              <Coffee size={22} />
            </div>
            <span className="px-2.5 py-0.5 rounded-lg text-xs font-bold bg-surface-container text-on-surface">
              {d?.todayOrdersCount ?? 0} đơn hôm nay
            </span>
          </div>
          <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Hàng Đợi Barista</p>
          <div className="flex items-baseline gap-2 mt-1">
            <h3 className="text-2xl font-black text-amber-800">
              {(d?.pendingOrdersCount ?? 0) + (d?.preparingOrdersCount ?? 0)}
            </h3>
            <span className="text-xs text-on-surface-variant font-medium">đơn đang chờ & pha</span>
          </div>
          <div className="grid grid-cols-3 gap-1 mt-3 pt-3 border-t border-outline-variant/10 text-center text-xs">
            <div className="bg-amber-50/80 py-1 rounded-lg">
              <p className="font-extrabold text-amber-800">{d?.pendingOrdersCount ?? 0}</p>
              <p className="text-[10px] text-amber-700/80">Chờ nhận</p>
            </div>
            <div className="bg-blue-50/80 py-1 rounded-lg">
              <p className="font-extrabold text-blue-800">{d?.preparingOrdersCount ?? 0}</p>
              <p className="text-[10px] text-blue-700/80">Đang pha</p>
            </div>
            <div className="bg-emerald-50/80 py-1 rounded-lg">
              <p className="font-extrabold text-emerald-800">{d?.servedOrdersCount ?? 0}</p>
              <p className="text-[10px] text-emerald-700/80">Đã xong</p>
            </div>
          </div>
        </div>

        {/* Metric 3: Live Table Occupancy */}
        <div className="bg-white dark:bg-surface-container-lowest p-5 rounded-3xl border border-primary/10 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start mb-3">
            <div className="w-11 h-11 rounded-2xl bg-secondary/10 flex items-center justify-center text-secondary">
              <Users size={22} />
            </div>
            <span className={`px-2.5 py-0.5 rounded-lg text-xs font-bold ${
              (d?.tableOccupancyPercent ?? 0) > 80 ? 'bg-rose-100 text-rose-800' : 'bg-secondary/15 text-secondary'
            }`}>
              {d?.tableOccupancyPercent ?? 0}% công suất
            </span>
          </div>
          <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Tải Trọng Bàn Trực Tiếp</p>
          <div className="flex items-baseline gap-2 mt-1">
            <h3 className="text-2xl font-black text-on-surface">
              {d?.occupiedTables ?? 0} <span className="text-sm font-semibold text-on-surface-variant">/ {d?.totalTables ?? 0} bàn</span>
            </h3>
          </div>
          <div className="mt-3 pt-3 border-t border-outline-variant/10 flex items-center justify-between text-xs text-on-surface-variant font-medium">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span> {d?.availableTables ?? 0} bàn trống
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-primary"></span> {d?.occupiedTables ?? 0} có khách
            </span>
          </div>
        </div>

        {/* Metric 4: Avg Fulfillment Time */}
        <div className="bg-white dark:bg-surface-container-lowest p-5 rounded-3xl border border-primary/10 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start mb-3">
            <div className="w-11 h-11 rounded-2xl bg-purple-500/10 flex items-center justify-center text-purple-700">
              <Clock size={22} />
            </div>
            <span className="px-2.5 py-0.5 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-700 flex items-center gap-1">
              <CheckCircle2 size={12} /> Tốc độ chuẩn
            </span>
          </div>
          <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Thời Gian Phục Vụ TB</p>
          <h3 className="text-2xl font-black text-on-surface mt-1">
            {d && d.avgFulfillmentMinutes > 0 ? d.avgFulfillmentMinutes : '—'} <span className="text-sm font-semibold text-on-surface-variant">{d && d.avgFulfillmentMinutes > 0 ? 'phút/đơn' : 'chưa có dữ liệu'}</span>
          </h3>
          <p className="mt-3 pt-3 border-t border-outline-variant/10 text-xs text-on-surface-variant flex items-center justify-between">
            <span>Tiêu chuẩn quán: <strong>&lt; 8 phút</strong></span>
            <span className={d && d.avgFulfillmentMinutes > 0 ? 'text-emerald-700 font-bold' : 'text-on-surface-variant font-bold'}>{d && d.avgFulfillmentMinutes > 0 ? 'Rất tốt' : 'Chưa có đơn hoàn tất'}</span>
          </p>
        </div>
      </section>

      {/* Main Grid: Live Floor Map & Hourly Traffic */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-6">
        {/* Left 7 Cols: Live Floor Map */}
        <div className="lg:col-span-7 bg-white dark:bg-surface-container-lowest p-6 rounded-3xl border border-primary/10 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-black text-on-surface flex items-center gap-2">
                <Layers size={18} className="text-primary" />
                Sơ Đồ Bàn Trực Tiếp (Live Floor Map)
              </h3>
              <p className="text-xs text-on-surface-variant mt-0.5">
                Nhấp vào bàn để xem hóa đơn tạm tính và thời gian khách ngồi
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs font-bold">
              <span className="flex items-center gap-1 px-2 py-1 rounded-md bg-surface-container text-on-surface-variant">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Trống
              </span>
              <span className="flex items-center gap-1 px-2 py-1 rounded-md bg-primary/10 text-primary">
                <span className="w-2 h-2 rounded-full bg-primary"></span> Có Khách
              </span>
              <span className="flex items-center gap-1 px-2 py-1 rounded-md bg-rose-50 text-rose-700">
                <span className="w-2 h-2 rounded-full bg-rose-500"></span> &gt;90p
              </span>
            </div>
          </div>

          {/* Table Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 my-auto pt-2 pb-2">
            {d?.activeTablesList.map(table => {
              const isOccupied = table.status === 'Occupied';
              const isLong = table.isLongStaying;

              let cardBg = 'bg-surface-container/60 hover:bg-surface-container border-outline-variant/30 text-on-surface-variant';
              if (isLong) {
                cardBg = 'bg-rose-500/10 hover:bg-rose-500/20 border-rose-500/40 text-rose-900 shadow-sm';
              } else if (isOccupied) {
                cardBg = 'bg-primary/10 hover:bg-primary/15 border-primary/40 text-primary shadow-sm';
              }

              return (
                <button
                  key={table.tableId}
                  onClick={() => setSelectedTable(table)}
                  className={`p-3.5 rounded-2xl border-2 transition-all flex flex-col items-center justify-between min-h-[110px] text-center active:scale-95 group relative overflow-hidden ${cardBg}`}
                >
                  <div className="flex justify-between w-full items-center text-[11px] font-bold">
                    <span className="px-1.5 py-0.5 rounded bg-white/70 shadow-2xs font-mono">{table.tableNumber}</span>
                    <span>{table.capacity} chỗ</span>
                  </div>

                  <div className="my-1 flex flex-col items-center">
                    <span className={`text-sm font-black ${isOccupied ? 'text-primary' : 'text-on-surface-variant/60'}`}>
                      {isOccupied ? `${table.totalAmount.toLocaleString('vi-VN')}đ` : 'Sẵn sàng'}
                    </span>
                    {isOccupied && (
                      <span className="text-[10px] text-on-surface-variant font-medium">
                        {table.itemCount} món • {table.occupiedMinutes}p
                      </span>
                    )}
                  </div>

                  <div className="w-full text-center">
                    {isLong ? (
                      <span className="text-[10px] font-black px-2 py-0.5 bg-rose-600 text-white rounded-full">Ngồi lâu</span>
                    ) : isOccupied ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-primary text-white rounded-full">Phục vụ</span>
                    ) : (
                      <span className="text-[10px] text-emerald-600 font-bold">Trống</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right 5 Cols: Hourly Traffic Today */}
        <div className="lg:col-span-5 bg-white dark:bg-surface-container-lowest p-6 rounded-3xl border border-primary/10 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-black text-on-surface flex items-center gap-2">
                <Flame size={18} className="text-amber-600" />
                Tải Trọng Giờ Cao Điểm Hôm Nay
              </h3>
              <p className="text-xs text-on-surface-variant mt-0.5">Phân bổ doanh số theo từng khung giờ trong ngày</p>
            </div>
            <span className="px-2.5 py-1 rounded-xl bg-amber-50 text-amber-800 text-xs font-bold">
              7:00 - 22:00
            </span>
          </div>

          {/* Bar Chart */}
          <div className="flex-1 min-h-[200px] flex items-end justify-between gap-1.5 pt-4 pb-2 px-1">
            {d?.hourlyTraffic.map((hour, idx) => {
              const maxRev = Math.max(...(d.hourlyTraffic.map(h => h.revenue) || [100000]), 100000);
              const heightPercent = Math.max(8, Math.round((hour.revenue / maxRev) * 100));

              return (
                <div key={idx} className="flex-1 flex flex-col items-center gap-1 group relative">
                  {/* Tooltip */}
                  <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-stone-900 text-white text-[10px] px-2 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-20 shadow-md">
                    <p className="font-bold">{hour.timeLabel}: {hour.revenue.toLocaleString('vi-VN')}đ</p>
                    <p className="text-stone-300">{hour.orderCount} đơn hàng</p>
                  </div>

                  {/* Bar */}
                  <div className="w-full bg-surface-container rounded-t-md h-36 flex items-end overflow-hidden">
                    <div 
                      className={`w-full rounded-t-md transition-all duration-500 ${
                        hour.isPeakHour 
                          ? 'bg-gradient-to-t from-amber-600 to-amber-400 group-hover:brightness-110 shadow-xs' 
                          : 'bg-primary/30 group-hover:bg-primary/50'
                      }`}
                      style={{ height: `${heightPercent}%` }}
                    ></div>
                  </div>
                  <span className={`text-[9px] font-bold ${hour.isPeakHour ? 'text-amber-700' : 'text-on-surface-variant'}`}>
                    {hour.hour}h
                  </span>
                </div>
              );
            })}
          </div>

          <div className="mt-3 pt-3 border-t border-outline-variant/10 flex items-center justify-between text-xs text-on-surface-variant">
            <span className="flex items-center gap-1.5 font-medium">
              <span className="w-2.5 h-2.5 rounded-sm bg-gradient-to-r from-amber-600 to-amber-400"></span> Khung giờ cao điểm (Sáng 8-10h, Tối 19-21h)
            </span>
            <span className="font-bold text-primary">Tối ưu điều phối Barista</span>
          </div>
        </div>
      </div>

      {/* Bottom Row: Today's Top Products & Fast Management Toolbox */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Top 5 Products Today */}
        <div className="lg:col-span-7 bg-white dark:bg-surface-container-lowest p-6 rounded-3xl border border-primary/10 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-black text-on-surface flex items-center gap-2">
                <Sparkles size={18} className="text-primary" />
                Món Bán Chạy Nhất Hôm Nay
              </h3>
              <p className="text-xs text-on-surface-variant mt-0.5">Top đồ uống được gọi nhiều nhất trong ca trực</p>
            </div>
            <Link to="/admin/menu" className="text-xs font-bold text-primary hover:underline flex items-center gap-1">
              Xem thực đơn <ChevronRight size={14} />
            </Link>
          </div>

          <div className="space-y-3">
            {d?.topProductsToday && d.topProductsToday.length > 0 ? (
              d.topProductsToday.map((item, idx) => (
                <div key={item.menuItemId} className="flex items-center justify-between p-3 rounded-2xl bg-surface-container-low/50 hover:bg-surface-container-low transition-colors border border-outline-variant/20">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-primary/10 text-primary font-black text-xs flex items-center justify-center">
                      #{idx + 1}
                    </span>
                    <div>
                      <h4 className="font-bold text-sm text-on-surface">{item.name}</h4>
                      <p className="text-xs text-on-surface-variant">Đã bán {item.soldCount} ly hôm nay</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-extrabold text-sm text-primary">{item.totalRevenue.toLocaleString('vi-VN')}đ</p>
                    <p className="text-[10px] text-emerald-600 font-bold">Doanh số ca</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-on-surface-variant py-6 text-center">Chưa có đơn hoàn tất trong ca hôm nay</p>
            )}
          </div>
        </div>

        {/* Quick Manager Toolbox */}
        <div className="lg:col-span-5 bg-gradient-to-br from-secondary-container/40 to-primary/5 p-6 rounded-3xl border border-primary/15 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-lg font-black text-primary flex items-center gap-2 mb-1">
              <UtensilsCrossed size={18} />
              Thao Tác Quản Lý Nhanh
            </h3>
            <p className="text-xs text-on-surface-variant mb-4">Các tác vụ điều phối khẩn cấp dành cho Trưởng ca</p>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <Link
                to="/admin/menu"
                className="p-3.5 rounded-2xl bg-white dark:bg-surface-container border border-primary/10 shadow-2xs hover:shadow-xs transition-all flex flex-col gap-1 active:scale-95"
              >
                <span className="text-xs font-black text-primary">Khóa / Mở Món</span>
                <span className="text-[11px] text-on-surface-variant">Bật tắt món khi quầy bar hết đá/sữa</span>
              </Link>

              <Link
                to="/admin/inventory"
                className="p-3.5 rounded-2xl bg-white dark:bg-surface-container border border-primary/10 shadow-2xs hover:shadow-xs transition-all flex flex-col gap-1 active:scale-95"
              >
                <span className="text-xs font-black text-primary">Nhập Kho Nhanh</span>
                <span className="text-[11px] text-on-surface-variant">Ghi nhận nhập thêm sữa, cafe, đá</span>
              </Link>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-white/90 border border-primary/10">
            <div className="flex justify-between items-center text-xs">
              <span className="text-on-surface-variant">Đồng bộ ca trực với máy POS</span>
              <span className="text-emerald-700 font-bold flex items-center gap-1">
                <CheckCircle2 size={12} /> Thời gian thực
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Selected Table Detail Modal */}
      {selectedTable && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 border border-outline-variant/30 animate-in zoom-in-95">
            <div className="flex justify-between items-start mb-4 border-b pb-3">
              <div>
                <h3 className="text-xl font-black text-primary">Chi Tiết Bàn {selectedTable.tableNumber}</h3>
                <p className="text-xs text-on-surface-variant">Sức chứa: {selectedTable.capacity} khách</p>
              </div>
              <button 
                onClick={() => setSelectedTable(null)} 
                className="p-1.5 rounded-full hover:bg-stone-100 text-stone-500"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-3 text-sm mb-6">
              <div className="flex justify-between py-1.5 border-b border-stone-100">
                <span className="text-stone-500">Trạng thái:</span>
                <span className="font-bold text-primary">
                  {selectedTable.status === 'Occupied' ? 'Đang có khách' : 'Bàn trống'}
                </span>
              </div>
              {selectedTable.activeOrderCode && (
                <div className="flex justify-between py-1.5 border-b border-stone-100">
                  <span className="text-stone-500">Mã đơn hàng:</span>
                  <span className="font-mono font-bold">{selectedTable.activeOrderCode}</span>
                </div>
              )}
              {selectedTable.status === 'Occupied' && (
                <>
                  <div className="flex justify-between py-1.5 border-b border-stone-100">
                    <span className="text-stone-500">Thời gian khách ngồi:</span>
                    <span className="font-bold">{selectedTable.occupiedMinutes} phút</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-stone-100">
                    <span className="text-stone-500">Số lượng món:</span>
                    <span className="font-bold">{selectedTable.itemCount} món</span>
                  </div>
                  <div className="flex justify-between py-1.5 text-base font-black text-primary">
                    <span>Tổng tiền tạm tính:</span>
                    <span>{selectedTable.totalAmount.toLocaleString('vi-VN')}đ</span>
                  </div>
                </>
              )}
            </div>

            <div className="flex">
              <button
                onClick={() => setSelectedTable(null)}
                className="w-full py-2.5 rounded-xl bg-stone-100 dark:bg-surface-container font-bold text-xs text-stone-700 dark:text-stone-300 hover:bg-stone-200 transition-colors"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
