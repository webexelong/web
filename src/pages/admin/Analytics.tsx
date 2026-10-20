import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '../../store/authStore';
import { analyticsApi } from '../../api/apis';
import type { 
  BusinessAnalyticsReportDto, 
  DailyRevenueDto
} from '../../types/apiTypes';
import { 
  BarChart3, 
  DollarSign, 
  Package, 
  TrendingUp, 
  Receipt, 
  Users, 
  Calendar, 
  Sparkles, 
  RefreshCw, 
  ShieldCheck, 
  UtensilsCrossed, 
  CreditCard, 
  PieChart, 
  Award, 
  Info, 
  Lightbulb, 
  QrCode 
} from 'lucide-react';

type DatePreset = 'today' | '7days' | '30days' | 'thisMonth' | 'custom';

export default function Analytics() {
  const { user } = useAuthStore();
  const activeStoreId = user?.storeId ?? 0;

  // Date Filter State
  const [preset, setPreset] = useState<DatePreset>('30days');
  const [fromDate, setFromDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [toDate, setToDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });

  // Report Data State
  const [report, setReport] = useState<BusinessAnalyticsReportDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);


  // Hovered Chart Day State
  const [hoveredDay, setHoveredDay] = useState<DailyRevenueDto | null>(null);

  // Apply Date Preset
  const handlePresetChange = (p: DatePreset) => {
    setPreset(p);
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    if (p === 'today') {
      setFromDate(todayStr);
      setToDate(todayStr);
    } else if (p === '7days') {
      const past = new Date();
      past.setDate(today.getDate() - 7);
      setFromDate(past.toISOString().split('T')[0]);
      setToDate(todayStr);
    } else if (p === '30days') {
      const past = new Date();
      past.setDate(today.getDate() - 30);
      setFromDate(past.toISOString().split('T')[0]);
      setToDate(todayStr);
    } else if (p === 'thisMonth') {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      setFromDate(firstDay.toISOString().split('T')[0]);
      setToDate(todayStr);
    }
  };

  const fetchAnalytics = useCallback(async (isInitial = true) => {
    if (isInitial) setLoading(true);
    else setRefreshing(true);
    setError(null);

    try {
      const data = await analyticsApi.getBusinessReport(activeStoreId, fromDate, toDate);
      setReport(data);
    } catch (err: any) {
      console.error('Failed to load business analytics:', err);
      setError(err?.response?.data?.message || 'Không thể tải báo cáo phân tích. Vui lòng thử lại.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeStoreId, fromDate, toDate]);

  useEffect(() => {
    fetchAnalytics(true);
  }, [fetchAnalytics]);

  const formatVND = (num: number) => {
    return (num || 0).toLocaleString('vi-VN') + ' đ';
  };

  const formatShortVND = (num: number) => {
    if (num >= 1000000000) return (num / 1000000000).toFixed(1) + ' tỷ';
    if (num >= 1000000) return (num / 1000000).toFixed(1) + ' tr';
    if (num >= 1000) return (num / 1000).toFixed(0) + ' k';
    return (num || 0).toString();
  };

  if (loading && !report) {
    return (
      <div className="pt-24 px-container-margin pb-stack-lg min-h-screen flex items-center justify-center font-sans">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          <p className="text-on-surface-variant font-medium text-sm">Đang tính toán dữ liệu doanh thu &amp; lợi nhuận COGS...</p>
        </div>
      </div>
    );
  }

  const r = report;
  const cogsPercent = r && r.netRevenue > 0 ? (r.estimatedCOGS / r.netRevenue) * 100 : 0;

  // Chart max calculation
  const chartDays: DailyRevenueDto[] = r?.dailyTrend || [];
  const maxRevenueInChart = Math.max(...chartDays.map((d: DailyRevenueDto) => d.revenue), 100000);

  return (
    <div className="pt-24 px-4 sm:px-6 md:px-8 w-full max-w-[1600px] mx-auto pb-20 animate-in fade-in duration-500 font-sans">
      
      {/* Header & Range Filter Bar */}
      <header className="mb-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white/80 dark:bg-surface-container-low backdrop-blur-md p-5 rounded-3xl border border-primary/10 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-600 to-amber-800 flex items-center justify-center text-white shadow-md shrink-0">
            <BarChart3 size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl sm:text-2xl font-black text-on-surface tracking-tight">
                Phân Tích Chiến Lược &amp; Lợi Nhuận
              </h2>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-200">
                <Sparkles size={11} className="mr-1" />
                FnB Intelligence
              </span>
            </div>
            <p className="text-xs text-on-surface-variant mt-0.5">
              Phân tích doanh thu thuần, giá vốn COGS, cơ cấu kênh bán &amp; phương thức thanh toán
            </p>
          </div>
        </div>

        {/* Date Filters Control Container */}
        <div className="flex flex-col items-start lg:items-end gap-2.5 shrink-0">
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            {/* Presets Button Group */}
            <div className="flex bg-surface-container p-1 rounded-2xl border border-outline-variant/30 text-xs font-semibold shadow-inner">
              <button 
                onClick={() => handlePresetChange('today')}
                className={`px-3 py-1.5 rounded-xl transition-all ${preset === 'today' ? 'bg-primary text-white shadow-sm font-bold' : 'text-on-surface-variant hover:text-primary'}`}
              >
                Hôm nay
              </button>
              <button 
                onClick={() => handlePresetChange('7days')}
                className={`px-3 py-1.5 rounded-xl transition-all ${preset === '7days' ? 'bg-primary text-white shadow-sm font-bold' : 'text-on-surface-variant hover:text-primary'}`}
              >
                7 ngày
              </button>
              <button 
                onClick={() => handlePresetChange('30days')}
                className={`px-3 py-1.5 rounded-xl transition-all ${preset === '30days' ? 'bg-primary text-white shadow-sm font-bold' : 'text-on-surface-variant hover:text-primary'}`}
              >
                30 ngày
              </button>
              <button 
                onClick={() => handlePresetChange('thisMonth')}
                className={`px-3 py-1.5 rounded-xl transition-all ${preset === 'thisMonth' ? 'bg-primary text-white shadow-sm font-bold' : 'text-on-surface-variant hover:text-primary'}`}
              >
                Tháng này
              </button>
              <button 
                onClick={() => setPreset('custom')}
                className={`px-3 py-1.5 rounded-xl transition-all ${preset === 'custom' ? 'bg-primary text-white shadow-sm font-bold' : 'text-on-surface-variant hover:text-primary'}`}
              >
                Tùy chọn
              </button>
            </div>

            {/* Refresh Button */}
            <button 
              onClick={() => fetchAnalytics(false)}
              disabled={refreshing}
              className="p-2.5 rounded-2xl bg-white dark:bg-surface-container-high border border-outline-variant/30 text-primary hover:bg-primary/5 transition-all shadow-sm flex items-center justify-center shrink-0"
              title="Làm mới báo cáo"
            >
              <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
            </button>
          </div>

          {/* Custom Date Inputs (Aligned perfectly under the presets) */}
          {preset === 'custom' && (
            <div className="flex items-center gap-2 bg-surface-container px-3.5 py-1.5 rounded-2xl border border-outline-variant/30 text-xs shadow-inner animate-in fade-in slide-in-from-top-1 duration-200">
              <span className="text-[11px] font-bold text-on-surface-variant">Từ:</span>
              <input 
                type="date" 
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="bg-white dark:bg-surface-container-high px-2 py-1 rounded-xl border border-outline-variant/30 text-xs font-semibold text-on-surface focus:ring-1 focus:ring-primary outline-none shadow-sm cursor-pointer"
              />
              <span className="text-on-surface-variant font-bold">→ Đến:</span>
              <input 
                type="date" 
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="bg-white dark:bg-surface-container-high px-2 py-1 rounded-xl border border-outline-variant/30 text-xs font-semibold text-on-surface focus:ring-1 focus:ring-primary outline-none shadow-sm cursor-pointer"
              />
            </div>
          )}
        </div>
      </header>

      {error && (
        <div className="mb-6 p-4 rounded-2xl bg-error-container text-error text-sm font-medium border border-error/20 flex items-center gap-2">
          <Info size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* 1. Executive Financial Scorecards (5 Cards) */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        
        {/* Net Revenue */}
        <div className="bg-white/80 dark:bg-surface-container-low backdrop-blur-md p-5 rounded-3xl border border-primary/10 shadow-sm relative overflow-hidden group hover:border-primary/30 transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">Doanh Thu Thuần</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold">
              <DollarSign size={16} />
            </div>
          </div>
          <h3 className="text-xl sm:text-2xl font-black text-on-surface tracking-tight">
            {formatVND(r?.netRevenue || 0)}
          </h3>
          <div className="flex items-center gap-1.5 mt-2 text-[11px] text-on-surface-variant">
            <span>Tổng gộp: <strong className="text-on-surface font-semibold">{formatShortVND(r?.grossRevenue || 0)}</strong></span>
            {r?.totalDiscount ? (
              <span className="text-rose-600 font-semibold bg-rose-50 dark:bg-rose-950/30 px-1.5 py-0.5 rounded">
                -{formatShortVND(r.totalDiscount)}
              </span>
            ) : null}
          </div>
        </div>

        {/* Estimated COGS */}
        <div className="bg-white/80 dark:bg-surface-container-low backdrop-blur-md p-5 rounded-3xl border border-primary/10 shadow-sm relative overflow-hidden group hover:border-primary/30 transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">Giá Vốn (COGS)</span>
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold">
              <Package size={16} />
            </div>
          </div>
          <h3 className="text-xl sm:text-2xl font-black text-on-surface tracking-tight">
            {r && r.estimatedCOGS > 0 ? formatVND(r.estimatedCOGS) : 'Chưa có dữ liệu'}
          </h3>
          <div className="flex items-center gap-1.5 mt-2 text-[11px] text-on-surface-variant">
            <span>Tỷ lệ giá vốn:</span>
            <span className={`font-bold px-1.5 py-0.5 rounded ${
              cogsPercent <= 32 ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
            }`}>
              {r && r.estimatedCOGS > 0 ? `${cogsPercent.toFixed(1)}%` : 'Chưa cấu hình'}
            </span>
            <span className="text-[10px] text-on-surface-variant/80">(Chuẩn 28-35%)</span>
          </div>
        </div>

        {/* Gross Profit & Margin */}
        <div className="bg-white/80 dark:bg-surface-container-low backdrop-blur-md p-5 rounded-3xl border border-emerald-500/20 shadow-sm relative overflow-hidden group hover:border-emerald-500/40 transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">Lợi Nhuận Gộp</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold">
              <TrendingUp size={16} />
            </div>
          </div>
          <h3 className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight">
            {r && r.estimatedCOGS > 0 ? formatVND(r.grossProfit) : 'Chưa có dữ liệu'}
          </h3>
          <div className="flex items-center gap-1.5 mt-2 text-[11px] text-on-surface-variant">
            <span>Biên lợi nhuận:</span>
            <span className="font-bold text-emerald-700 bg-emerald-100/70 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full">
              {(r?.grossMarginPercent || 0).toFixed(1)}%
            </span>
          </div>
        </div>

        {/* AOV (Average Order Value) */}
        <div className="bg-white/80 dark:bg-surface-container-low backdrop-blur-md p-5 rounded-3xl border border-primary/10 shadow-sm relative overflow-hidden group hover:border-primary/30 transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">Giá Trị Đơn TB (AOV)</span>
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center font-bold">
              <Receipt size={16} />
            </div>
          </div>
          <h3 className="text-xl sm:text-2xl font-black text-on-surface tracking-tight">
            {formatVND(r?.averageOrderValue || 0)}
          </h3>
          <div className="flex items-center gap-1.5 mt-2 text-[11px] text-on-surface-variant">
            <span>Tổng: <strong className="text-on-surface font-semibold">{r?.totalOrders || 0}</strong> đơn hoàn tất</span>
          </div>
        </div>

        {/* Total Customers & Retention */}
        <div className="bg-white/80 dark:bg-surface-container-low backdrop-blur-md p-5 rounded-3xl border border-primary/10 shadow-sm relative overflow-hidden group hover:border-primary/30 transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">Tỷ Lệ Giữ Chân</span>
            <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-600 flex items-center justify-center font-bold">
              <Users size={16} />
            </div>
          </div>
          <h3 className="text-xl sm:text-2xl font-black text-on-surface tracking-tight">
            {(r?.customerAnalytics?.retentionRate ?? 0).toFixed(1)}%
          </h3>
          <div className="flex items-center gap-1.5 mt-2 text-[11px] text-on-surface-variant">
            <span>{r?.customerAnalytics?.activeCustomers || 0} khách quay lại thường xuyên</span>
          </div>
        </div>
      </section>

      {/* 2. Financial Performance Trend Chart (Interactive Daily Bars) */}
      <section className="bg-white/80 dark:bg-surface-container-low backdrop-blur-md p-6 rounded-3xl border border-primary/10 shadow-sm mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <div>
            <h3 className="text-lg font-bold text-on-surface flex items-center gap-2">
              <BarChart3 size={18} className="text-primary" />
              Diễn Biến Doanh Thu &amp; Lợi Nhuận Theo Ngày
            </h3>
            <p className="text-xs text-on-surface-variant mt-0.5">
              Hover để xem chi tiết doanh thu, lợi nhuận gộp và số đơn từng ngày
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-primary"></div>
              <span className="text-on-surface-variant font-medium">Doanh thu thuần</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-emerald-500"></div>
              <span className="text-on-surface-variant font-medium">Lợi nhuận gộp (ước tính)</span>
            </div>
          </div>
        </div>

        {/* Chart Container */}
        {chartDays.length === 0 ? (
          <div className="h-56 flex items-center justify-center text-on-surface-variant text-sm border border-dashed border-outline-variant/30 rounded-2xl">
            Không có dữ liệu giao dịch trong khoảng thời gian này
          </div>
        ) : (
          <div className="space-y-4">
            {/* Interactive Bar Grid */}
            <div className="h-56 flex items-end justify-between gap-1.5 sm:gap-2 px-2 pt-6 pb-2 border-b border-outline-variant/20 overflow-x-auto">
              {chartDays.map((day: DailyRevenueDto, idx: number) => {
                const heightPercent = Math.max(8, Math.min(100, Math.round((day.revenue / maxRevenueInChart) * 100)));
                const profitHeightPercent = day.revenue > 0
                  ? Math.max(4, Math.min(heightPercent, Math.round(((day.estimatedProfit ?? 0) / maxRevenueInChart) * 100)))
                  : 0;
                const isHovered = hoveredDay?.date === day.date;
                const formattedDate = day.date.includes('-') ? day.date.split('-').slice(1).join('/') : day.date;

                return (
                  <div 
                    key={idx}
                    onMouseEnter={() => setHoveredDay(day)}
                    onMouseLeave={() => setHoveredDay(null)}
                    className="flex-1 min-w-[28px] max-w-[48px] h-full flex flex-col justify-end items-center group cursor-pointer relative"
                  >
                    {/* Tooltip on Hover */}
                    {isHovered && (
                      <div className="absolute -top-16 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[11px] p-2 rounded-xl shadow-xl z-30 whitespace-nowrap pointer-events-none border border-white/10 animate-in fade-in zoom-in-95 duration-150">
                        <div className="font-bold text-amber-300">{day.date}</div>
                        <div>Doanh thu: <strong>{formatVND(day.revenue)}</strong></div>
                        <div>Lợi nhuận gộp: <strong className="text-emerald-400">{formatVND(day.estimatedProfit ?? 0)}</strong></div>
                        <div className="text-slate-400">{day.ordersCount} đơn hàng</div>
                      </div>
                    )}

                    {/* Stacked Bars */}
                    <div className="w-full bg-surface-container rounded-t-lg relative flex items-end justify-center overflow-hidden transition-all group-hover:scale-105" style={{ height: `${heightPercent}%` }}>
                      {/* Revenue background */}
                      <div className="absolute inset-0 bg-primary/20 group-hover:bg-primary/30 transition-colors"></div>
                      {/* Profit bar */}
                      <div 
                        className="w-full bg-emerald-500/80 group-hover:bg-emerald-500 rounded-t-md transition-all relative z-10" 
                        style={{ height: `${profitHeightPercent}%` }}
                      ></div>
                    </div>

                    <span className="text-[10px] font-semibold text-on-surface-variant mt-2 group-hover:text-primary transition-colors">
                      {formattedDate}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Hovered Day Details bar */}
            {hoveredDay ? (
              <div className="flex items-center justify-between bg-primary/5 p-3 rounded-2xl border border-primary/15 text-xs">
                <div className="flex items-center gap-2">
                  <Calendar size={14} className="text-primary" />
                  <span className="font-bold text-primary">Ngày {hoveredDay.date}:</span>
                </div>
                <div className="flex items-center gap-4">
                  <span>Doanh thu: <strong className="text-on-surface">{formatVND(hoveredDay.revenue)}</strong></span>
                  <span>Lợi nhuận gộp: <strong className="text-emerald-600">{formatVND(hoveredDay.estimatedProfit ?? 0)}</strong></span>
                  <span>Số đơn: <strong className="text-on-surface">{hoveredDay.ordersCount}</strong></span>
                </div>
              </div>
            ) : (
              <div className="text-right text-[11px] text-on-surface-variant/70 italic">
                * Di chuột vào từng cột để xem chi tiết lợi nhuận gộp theo ngày
              </div>
            )}
          </div>
        )}
      </section>

      {/* 3. Operational Breakdown (Channels, Payments, Categories) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-6">
        
        {/* Channel Breakdown */}
        <section className="lg:col-span-4 bg-white/80 dark:bg-surface-container-low backdrop-blur-md p-6 rounded-3xl border border-primary/10 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-on-surface mb-1 flex items-center gap-2">
              <UtensilsCrossed size={18} className="text-primary" />
              Cơ Cấu Kênh Bán Hàng
            </h3>
            <p className="text-xs text-on-surface-variant mb-5">Tỷ trọng Tại Quán vs Mang Đi / Đặt Online</p>

            <div className="space-y-4">
              {r?.channelBreakdown?.map((channel, idx) => (
                <div key={idx} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-on-surface">{channel.channel}</span>
                    <span className="font-bold text-primary">{channel.percentage.toFixed(1)}% ({formatVND(channel.revenue)})</span>
                  </div>
                  <div className="w-full h-3 rounded-full bg-surface-container overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${
                        idx === 0 ? 'bg-primary' : 'bg-secondary'
                      }`}
                      style={{ width: `${channel.percentage}%` }}
                    ></div>
                  </div>
                  <div className="text-[11px] text-on-surface-variant text-right">
                    {channel.orderCount} đơn hàng
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 p-3.5 bg-surface-container/50 rounded-2xl border border-outline-variant/20 text-xs text-on-surface-variant flex items-start gap-2">
            <Lightbulb size={16} className="text-amber-600 shrink-0 mt-0.5" />
            <span>Mẹo: Tăng cường chương trình ưu đãi mang đi để giải phóng diện tích bàn giờ cao điểm.</span>
          </div>
        </section>

        {/* Payment Methods Breakdown */}
        <section className="lg:col-span-4 bg-white/80 dark:bg-surface-container-low backdrop-blur-md p-6 rounded-3xl border border-primary/10 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-on-surface mb-1 flex items-center gap-2">
              <CreditCard size={18} className="text-primary" />
              Phương Thức Thanh Toán
            </h3>
            <p className="text-xs text-on-surface-variant mb-5">Tỷ lệ Chuyển Khoản QR vs Tiền Mặt</p>

            <div className="space-y-4">
              {r?.paymentMethodBreakdown?.map((pay: any, idx: number) => (
                <div key={idx} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-on-surface flex items-center gap-1.5">
                      {pay.method.toLowerCase().includes('qr') || pay.method.toLowerCase().includes('bank') ? (
                        <QrCode size={14} className="text-emerald-600" />
                      ) : (
                        <DollarSign size={14} className="text-amber-600" />
                      )}
                      {pay.method}
                    </span>
                    <span className="font-bold text-on-surface">{pay.percentage.toFixed(1)}%</span>
                  </div>
                  <div className="w-full h-3 rounded-full bg-surface-container overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${
                        idx === 0 ? 'bg-emerald-500' : 'bg-amber-500'
                      }`}
                      style={{ width: `${pay.percentage}%` }}
                    ></div>
                  </div>
                  <div className="flex justify-between text-[11px] text-on-surface-variant">
                    <span>{pay.count} giao dịch</span>
                    <strong className="text-on-surface">{formatVND(pay.totalAmount)}</strong>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 p-3.5 bg-surface-container/50 rounded-2xl border border-outline-variant/20 text-xs text-on-surface-variant flex items-start gap-2">
            <ShieldCheck size={16} className="text-emerald-600 shrink-0 mt-0.5" />
            <span>Thanh toán VietQR giúp giảm 100% rủi ro thất thoát tiền mặt và lệch két cuối ca.</span>
          </div>
        </section>

        {/* Category Performance */}
        <section className="lg:col-span-4 bg-white/80 dark:bg-surface-container-low backdrop-blur-md p-6 rounded-3xl border border-primary/10 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-on-surface mb-1 flex items-center gap-2">
              <PieChart size={18} className="text-primary" />
              Doanh Số Theo Nhóm Món
            </h3>
            <p className="text-xs text-on-surface-variant mb-5">Tỷ trọng doanh thu các nhóm sản phẩm</p>

            <div className="space-y-3.5">
              {r?.categoryBreakdown?.slice(0, 4).map((cat: any) => (
                <div key={cat.categoryId} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-on-surface">{cat.categoryName}</span>
                    <span className="font-bold text-primary">{cat.percentage.toFixed(1)}% ({formatShortVND(cat.totalRevenue)})</span>
                  </div>
                  <div className="w-full h-2.5 rounded-full bg-surface-container overflow-hidden">
                    <div 
                      className="h-full rounded-full bg-gradient-to-r from-primary to-primary-container"
                      style={{ width: `${cat.percentage}%` }}
                    ></div>
                  </div>
                  <div className="text-[11px] text-on-surface-variant text-right">
                    {cat.totalSold} ly đã bán
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 text-right">
            <span className="text-xs text-primary font-bold hover:underline cursor-pointer">
              Xem toàn bộ danh mục &rarr;
            </span>
          </div>
        </section>

      </div>

      {/* 4. Customer Intelligence & Top VIP Leaderboard */}
      <section className="bg-white/80 dark:bg-surface-container-low backdrop-blur-md p-6 rounded-3xl border border-primary/10 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <div>
            <h3 className="text-lg font-bold text-on-surface flex items-center gap-2">
              <Award size={20} className="text-amber-500" />
              Bảng Vinh Danh Khách Hàng Thân Thiết VIP (Top Loyal Customers)
            </h3>
            <p className="text-xs text-on-surface-variant mt-0.5">
              Top 10 khách hàng có chi tiêu cao nhất và số lần ghé quán nhiều nhất
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-200">
              Loyalty Club VIP
            </span>
          </div>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-outline-variant/20">
          <table className="w-full min-w-[900px] text-left border-collapse text-xs">
            <thead>
              <tr className="bg-surface-container/60 text-on-surface-variant font-bold border-b border-outline-variant/20">
                <th className="py-3 px-4">Hạng</th>
                <th className="py-3 px-4">Khách Hàng</th>
                <th className="py-3 px-4">Số Điện Thoại</th>
                <th className="py-3 px-4 text-center">Số Lượt Ghé Quán</th>
                <th className="py-3 px-4 text-right">Tổng Chi Tiêu</th>
                <th className="py-3 px-4 text-center">Điểm Tích Lũy</th>
                <th className="py-3 px-4">Phân Hạng VIP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/10">
              {r?.customerAnalytics?.topCustomers?.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-on-surface-variant">
                    Chưa có dữ liệu khách hàng VIP
                  </td>
                </tr>
              ) : (
                r?.customerAnalytics?.topCustomers?.map((cust, idx) => {
                  let rankBadge = `${idx + 1}`;
                  let rankColor = 'bg-surface-container text-on-surface';
                  let tierName = 'Thành Viên Bạc';
                  let tierBadge = 'bg-slate-100 text-slate-800 border-slate-300';

                  if (idx === 0) {
                    rankColor = 'bg-amber-500 text-white font-black shadow-sm';
                    tierName = '👑 Kim Cương (VIP)';
                    tierBadge = 'bg-amber-100 text-amber-950 border-amber-300 font-bold';
                  } else if (idx === 1) {
                    rankColor = 'bg-slate-400 text-white font-black';
                    tierName = '🥇 Bạch Kim';
                    tierBadge = 'bg-slate-200 text-slate-900 border-slate-300 font-semibold';
                  } else if (idx === 2) {
                    rankColor = 'bg-amber-700 text-white font-black';
                    tierName = '🥈 Vàng';
                    tierBadge = 'bg-amber-50 text-amber-800 border-amber-200 font-semibold';
                  }

                  return (
                    <tr key={cust.customerId} className="hover:bg-primary/5 transition-colors">
                      <td className="py-3 px-4 font-bold">
                        <span className={`w-6 h-6 rounded-full inline-flex items-center justify-center text-xs ${rankColor}`}>
                          {rankBadge}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-semibold text-on-surface">
                        {cust.name}
                      </td>
                      <td className="py-3 px-4 text-on-surface-variant font-mono">
                        {cust.phone}
                      </td>
                      <td className="py-3 px-4 text-center font-bold text-on-surface">
                        {cust.visitCount} lần
                      </td>
                      <td className="py-3 px-4 text-right font-black text-emerald-600">
                        {formatVND(cust.totalSpent)}
                      </td>
                      <td className="py-3 px-4 text-center font-bold text-amber-600">
                        {cust.totalPoints} pts
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2.5 py-1 rounded-full text-[11px] border ${tierBadge}`}>
                          {tierName}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

    </div>
  );
}
