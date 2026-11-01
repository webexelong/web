import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore, type MenuItem } from '../../store/useStore';
import { paymentApi } from '../../api/apis';
import { useAuthStore } from '../../store/authStore';

interface StockStatus {
  [productId: string]: boolean;
}

export default function StaffDashboard() {
  const navigate = useNavigate();
  const user = useAuthStore(state => state.user);
  const { orders, menuItems, fetchMenu, fetchOrders, initRealtime, currentStoreId, updateOrderStatus } = useStore();
  
  // Stock status keyed by storeId to isolate branches
  const [stockStatus, setStockStatus] = useState<StockStatus>({});

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchOrders(currentStoreId);
    fetchMenu(currentStoreId);
    initRealtime(currentStoreId);

    // Load branch-specific stock status
    const storeKey = `webcafe_stock_store_${currentStoreId}`;
    const saved = localStorage.getItem(storeKey);
    setStockStatus(saved ? JSON.parse(saved) : {});
  }, [currentStoreId]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const toggleStock = (productId: string, productName: string) => {
    setStockStatus(prev => {
      const current = prev[productId] !== false; // default true (in stock)
      const next = !current;
      const updated = { ...prev, [productId]: next };
      const storeKey = `webcafe_stock_store_${currentStoreId}`;
      localStorage.setItem(storeKey, JSON.stringify(updated));
      
      // Also broadcast storage event for other open tabs
      window.dispatchEvent(new Event('storage'));

      showToast(next ? `[Quán #${currentStoreId}] Mở bán lại: ${productName}` : `[Quán #${currentStoreId}] Chuyển sang tạm hết món: ${productName}`);
      return updated;
    });
  };

  // Metrics calculation
  const pendingOrders = orders.filter(o => o.status === 'pending');
  const preparingOrders = orders.filter(o => o.status === 'preparing');
  const activeOrdersCount = pendingOrders.length + preparingOrders.length;
  
  // Completed/Served/Paid orders
  const readyOrders = orders.filter(o => o.status === 'ready' || o.status === 'done' || o.status === 'served');
  const paidOrders = orders.filter(o => o.status === 'paid' || (o.status as string) === 'completed');
  const completedOrders = orders.filter(o => o.status === 'ready' || o.status === 'done' || o.status === 'served' || o.status === 'paid' || (o.status as string) === 'completed');
  const completedOrdersCount = completedOrders.length;

  // Cups served calculation from all processed orders
  const totalCupsServed = completedOrders.reduce((sum, order) => {
    return sum + (order.items?.reduce((iSum, item) => iSum + item.quantity, 0) || 0);
  }, 0);

  // Revenue: ONLY count orders that are PAID or COMPLETED!
  const totalRevenue = paidOrders.reduce((sum, order) => sum + (order.total || 0), 0);
  const pendingCollectionRevenue = readyOrders.reduce((sum, order) => sum + (order.total || 0), 0);

  // Best selling products from all orders in current shift (including paid)
  const productSalesMap: { [name: string]: { name: string; count: number; image?: string; revenue: number } } = {};
  orders.forEach(order => {
    order.items?.forEach(item => {
      if (!productSalesMap[item.name]) {
        productSalesMap[item.name] = { name: item.name, count: 0, image: item.image, revenue: 0 };
      }
      productSalesMap[item.name].count += item.quantity;
      productSalesMap[item.name].revenue += item.price * item.quantity;
    });
  });

  const topSellingProducts = Object.values(productSalesMap)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return (
    <div className="w-full max-w-[1600px] mx-auto space-y-5 pb-10">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-primary text-white text-xs sm:text-sm font-bold px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2 animate-bounce">
          <span className="material-symbols-outlined text-lg">check_circle</span>
          {toastMessage}
        </div>
      )}

      {/* Top Banner / Shift Overview */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-5 sm:p-6 rounded-3xl border border-outline-variant/15 shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 bg-green-100 text-green-800 text-[11px] font-extrabold px-2.5 py-0.5 rounded-full">
              <span className="w-2 h-2 rounded-full bg-green-600 animate-ping" />
              Ca Sáng / Đang Hoạt Động
            </span>
            <span className="text-[11px] text-on-surface-variant font-medium">
              {user?.storeName || user?.brandName || `Chi nhánh #${currentStoreId}`}
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-primary tracking-tight">
            Tổng Quan Ca Làm & Số Lượng Đơn
          </h1>
          <p className="text-xs sm:text-sm text-on-surface-variant mt-0.5">
            Dữ liệu doanh thu tính từ đơn đã thu tiền. Đơn đã thanh toán được lưu trữ nguyên vẹn trong ca.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          <button
            onClick={() => navigate('/staff/orders')}
            className="flex-1 md:flex-none flex items-center justify-center gap-1.5 px-4 py-2.5 bg-primary text-white rounded-xl text-xs font-bold shadow-xs hover:bg-primary-container active:scale-95 transition-all"
          >
            <span className="material-symbols-outlined text-base">assignment</span>
            <span>Màn Hình Xử Lý Đơn</span>
            {activeOrdersCount > 0 && (
              <span className="ml-1 px-1.5 py-0.2 bg-amber-400 text-primary rounded-full text-[10px] font-black">
                {activeOrdersCount}
              </span>
            )}
          </button>
          
          <button
            onClick={() => navigate('/staff/new-order')}
            className="flex-1 md:flex-none flex items-center justify-center gap-1.5 px-4 py-2.5 bg-secondary-container text-on-secondary-container rounded-xl text-xs font-bold shadow-xs hover:bg-surface-variant active:scale-95 transition-all"
          >
            <span className="material-symbols-outlined text-base">add</span>
            <span>Tạo Đơn POS</span>
          </button>
        </div>
      </header>

      {/* 4 Stat Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Card 1: Active Orders */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-outline-variant/20 shadow-xs flex flex-col justify-between relative overflow-hidden group hover:border-primary/30 transition-all">
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold text-on-surface-variant">Đơn Đang Xử Lý</span>
            <span className="p-2 rounded-xl bg-amber-50 text-amber-700">
              <span className="material-symbols-outlined text-xl">pending_actions</span>
            </span>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-black text-amber-700">
                {activeOrdersCount}
              </span>
              <span className="text-[11px] font-bold text-on-surface-variant">đơn</span>
            </div>
            <p className="text-[11px] text-on-surface-variant mt-1">
              {pendingOrders.length} chờ duyệt · {preparingOrders.length} đang pha chế
            </p>
          </div>
        </div>

        {/* Card 2: Completed Orders */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-outline-variant/20 shadow-xs flex flex-col justify-between relative overflow-hidden group hover:border-green-500/30 transition-all">
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold text-on-surface-variant">Đơn Hoàn Thành</span>
            <span className="p-2 rounded-xl bg-green-50 text-green-700">
              <span className="material-symbols-outlined text-xl">check_circle</span>
            </span>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-black text-green-700">
                {completedOrdersCount}
              </span>
              <span className="text-[11px] font-bold text-on-surface-variant">đơn đã phục vụ</span>
            </div>
            <p className="text-[11px] text-green-700/80 mt-1 font-medium">
              {paidOrders.length} đã thu tiền · {readyOrders.length} sẵn sàng
            </p>
          </div>
        </div>

        {/* Card 3: Cups Served */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-outline-variant/20 shadow-xs flex flex-col justify-between relative overflow-hidden group hover:border-primary/30 transition-all">
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold text-on-surface-variant">Số Ly Đã Phục Vụ</span>
            <span className="p-2 rounded-xl bg-orange-50 text-primary">
              <span className="material-symbols-outlined text-xl">local_cafe</span>
            </span>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-black text-primary">
                {totalCupsServed}
              </span>
              <span className="text-[11px] font-bold text-on-surface-variant">cốc / ly</span>
            </div>
            <p className="text-[11px] text-on-surface-variant mt-1">
              Trung bình ~3.2 phút / ly
            </p>
          </div>
        </div>

        {/* Card 4: Shift Revenue (ONLY PAID ORDERS) */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-outline-variant/20 shadow-xs flex flex-col justify-between relative overflow-hidden group hover:border-blue-500/30 transition-all">
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold text-on-surface-variant">Doanh Thu Đã Thu</span>
            <span className="p-2 rounded-xl bg-blue-50 text-blue-700">
              <span className="material-symbols-outlined text-xl">payments</span>
            </span>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-1">
              <span className="text-xl sm:text-2xl font-black text-blue-700">
                {totalRevenue.toLocaleString('vi-VN')}
              </span>
              <span className="text-xs font-extrabold text-blue-700">đ</span>
            </div>
            <p className="text-[11px] text-on-surface-variant mt-1">
              {pendingCollectionRevenue > 0 ? `Chờ thu: ${pendingCollectionRevenue.toLocaleString('vi-VN')}đ` : 'Đã quyết toán đủ'}
            </p>
          </div>
        </div>
      </div>

      {/* Main Grid: Live Orders Feed & Quick Stock Management */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column (7 Cols): Active Queue / Recent Activity */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white p-5 rounded-3xl border border-outline-variant/15 shadow-xs">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-xl">receipt_long</span>
                <h2 className="text-base font-bold text-on-surface">Đơn Hàng Gần Nhất Trong Ca</h2>
              </div>
              <button
                onClick={() => navigate('/staff/orders')}
                className="text-xs font-bold text-primary hover:underline flex items-center gap-0.5"
              >
                Xem tất cả ({orders.length}) <span className="material-symbols-outlined text-sm">chevron_right</span>
              </button>
            </div>

            {orders.length === 0 ? (
              <div className="py-10 text-center text-on-surface-variant text-xs">
                Chưa có đơn hàng nào trong ca làm việc.
              </div>
            ) : (
              <div className="space-y-3">
                {orders.slice(0, 5).map(order => {
                  const isPending = order.status === 'pending';
                  const isPreparing = order.status === 'preparing';
                  const isReady = order.status === 'ready' || order.status === 'done' || order.status === 'served';
                  const isPaid = order.status === 'paid' || (order.status as string) === 'completed';

                  return (
                    <div
                      key={order.id}
                      className={`p-3.5 rounded-2xl border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 transition-all ${
                        isPaid 
                        ? 'bg-gray-50/70 border-outline-variant/15 opacity-80' 
                        : 'bg-surface-container-lowest border-outline-variant/20 hover:border-primary/40'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[11px] font-extrabold px-2 py-0.5 rounded-md bg-primary/10 text-primary">
                            Bàn: {order.tableNumber}
                          </span>
                          <span className="text-xs font-bold text-on-surface">
                            #{order.orderCode || order.id}
                          </span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            isPending ? 'bg-amber-100 text-amber-800' :
                            isPreparing ? 'bg-orange-100 text-orange-900 animate-pulse' :
                            isReady ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
                          }`}>
                            {isPending ? 'Chờ xác nhận' : isPreparing ? 'Đang pha chế' : isReady ? 'Đã xong / Chờ thu tiền' : '✓ Đã thu tiền'}
                          </span>
                        </div>
                        <p className="text-xs text-on-surface-variant line-clamp-1">
                          {order.items?.map(i => `${i.quantity}x ${i.name}`).join(' · ')}
                        </p>
                      </div>

                      <div className="flex items-center justify-between w-full sm:w-auto sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-outline-variant/10 shrink-0">
                        <span className="text-xs font-extrabold text-primary">
                          {order.total.toLocaleString('vi-VN')}đ
                        </span>

                        {isPending && (
                          <button
                            onClick={() => updateOrderStatus(order.id, 'preparing')}
                            className="px-3 py-1.5 bg-primary text-white text-[11px] font-bold rounded-lg hover:bg-primary-container active:scale-95 transition-all shadow-xs"
                          >
                            Nhận đơn
                          </button>
                        )}
                        {isPreparing && (
                          <button
                            onClick={() => updateOrderStatus(order.id, 'ready')}
                            className="px-3 py-1.5 bg-secondary text-white text-[11px] font-bold rounded-lg hover:opacity-90 active:scale-95 transition-all shadow-xs"
                          >
                            Xong món
                          </button>
                        )}
                        {isReady && (
                          <button
                            onClick={() => {
                              void (async () => {
                                try {
                                  await paymentApi.processPayment({ orderId: Number(order.id), method: 'cash', amount: order.total });
                                  await fetchOrders(currentStoreId);
                                  showToast(`Đã thu tiền đơn #${order.orderCode || order.id} thành công!`);
                                } catch (error: any) {
                                  showToast(error?.response?.data?.message || 'Không thể ghi nhận tiền mặt. Vui lòng thử lại.');
                                }
                              })();
                            }}
                            className="px-3 py-1.5 bg-green-600 text-white text-[11px] font-bold rounded-lg hover:bg-green-700 active:scale-95 transition-all shadow-xs"
                          >
                            Thu tiền 💵
                          </button>
                        )}
                        {isPaid && (
                          <span className="text-[11px] font-bold text-green-700 flex items-center gap-1">
                            <span className="material-symbols-outlined text-sm">check</span>
                            Đã thu
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Top Selling Items (Retained accurately even after payment) */}
          <div className="bg-white p-5 rounded-3xl border border-outline-variant/15 shadow-xs">
            <div className="flex items-center gap-2 mb-3">
              <span className="material-symbols-outlined text-primary text-xl">star</span>
              <h2 className="text-base font-bold text-on-surface">Top Món Bán Chạy Trong Ca (Lũy kế)</h2>
            </div>

            {topSellingProducts.length === 0 ? (
              <p className="text-xs text-on-surface-variant py-4 text-center">Chưa có dữ liệu bán món trong ca hôm nay.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {topSellingProducts.map((p, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 rounded-2xl bg-surface-container-low/50 border border-outline-variant/15">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-black flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <span className="text-xs font-bold text-on-surface truncate">
                        {p.name}
                      </span>
                    </div>
                    <span className="text-xs font-extrabold text-primary shrink-0 pl-2">
                      {p.count} ly
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column (5 Cols): Out-of-Stock / Menu Availability Switcher Isolated per Store */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white p-5 rounded-3xl border border-outline-variant/15 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-xl">toggle_on</span>
                <h2 className="text-base font-bold text-on-surface">Tình Trạng Món - Quán #{currentStoreId}</h2>
              </div>
              <span className="text-[10px] font-bold text-on-surface-variant bg-surface-container-low px-2 py-0.5 rounded-full">
                {menuItems.length} món
              </span>
            </div>
            <p className="text-[11px] text-on-surface-variant mb-3">
              Nhân viên có thể bật/tắt trạng thái hết món riêng cho <span className="font-bold text-primary">Chi nhánh #{currentStoreId}</span> (không ảnh hưởng đến quán khác).
            </p>

            <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
              {menuItems.map((product: MenuItem) => {
                const pId = product.id.toString();
                const inStock = stockStatus[pId] !== false;

                return (
                  <div
                    key={product.id}
                    className={`flex items-center justify-between p-2.5 rounded-2xl border transition-all ${
                      inStock 
                      ? 'bg-white border-outline-variant/20 hover:border-outline-variant/50' 
                      : 'bg-red-50/60 border-red-200 opacity-80'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-10 h-10 rounded-xl overflow-hidden bg-surface-container shrink-0">
                        <img 
                          src={product.image || 'https://images.unsplash.com/photo-1541167760496-1628856ab772?auto=format&fit=crop&q=80&w=200'} 
                          alt={product.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="min-w-0">
                        <p className={`text-xs font-bold truncate ${inStock ? 'text-on-surface' : 'text-red-900 line-through'}`}>
                          {product.name}
                        </p>
                        <p className="text-[10px] text-on-surface-variant">
                          {product.price?.toLocaleString('vi-VN')}đ
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => toggleStock(pId, product.name)}
                      className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all shrink-0 active:scale-95 flex items-center gap-1 ${
                        inStock
                        ? 'bg-green-100 text-green-800 hover:bg-green-200'
                        : 'bg-red-600 text-white hover:bg-red-700 shadow-xs'
                      }`}
                    >
                      <span className="material-symbols-outlined text-sm">
                        {inStock ? 'check' : 'block'}
                      </span>
                      {inStock ? 'Còn Món' : 'Hết Món'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
