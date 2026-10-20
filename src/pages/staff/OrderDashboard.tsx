import { useState, useEffect } from 'react';
import { useStore, type OrderStatus } from '../../store/useStore';
import Pagination from '../../components/Pagination';

export default function OrderDashboard() {
  const { orders, updateOrderStatus, fetchOrders, initRealtime, currentStoreId } = useStore();
  const [filter, setFilter] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 6;
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchOrders(currentStoreId);
    initRealtime(currentStoreId);
  }, [currentStoreId]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filter]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleStatusChange = (orderId: string, newStatus: OrderStatus, orderCode?: string) => {
    updateOrderStatus(orderId, newStatus);
    if (newStatus === 'paid') {
      showToast(`Đã thu tiền đơn #${orderCode || orderId} thành công!`);
    } else if (newStatus === 'ready') {
      showToast(`Đơn #${orderCode || orderId} đã sẵn sàng phục vụ!`);
    } else if (newStatus === 'preparing') {
      showToast(`Đang pha chế đơn #${orderCode || orderId}...`);
    }
  };

  const filteredOrders = orders.filter(o => {
    if (filter === 'All') return true;
    if (filter === 'pending') return o.status === 'pending';
    if (filter === 'preparing') return o.status === 'preparing';
    if (filter === 'ready') return o.status === 'ready' || o.status === 'done' || o.status === 'served';
    if (filter === 'paid') return o.status === 'paid';
    return true;
  });

  const totalPages = Math.ceil(filteredOrders.length / PAGE_SIZE);
  const paginatedOrders = filteredOrders.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const getStatusStyles = (status: OrderStatus) => {
    switch(status) {
      case 'pending':
        return {
          card: "bg-white rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col transition-all hover:shadow-md border border-outline-variant/30",
          badge: "bg-amber-100 text-amber-900 font-bold px-2.5 py-0.5 rounded-full text-[11px]",
          badgeText: "Chờ Xác Nhận",
          btn: "bg-primary text-white shadow-primary/20 hover:bg-primary-container",
          btnText: "Bắt đầu pha chế ➔",
          nextStatus: "preparing" as OrderStatus
        };
      case 'preparing':
        return {
          card: "bg-white rounded-2xl p-4 sm:p-5 shadow-xs border-2 border-primary/20 flex flex-col transition-all hover:shadow-md relative overflow-hidden",
          badge: "bg-[#85532a] text-white font-bold px-2.5 py-0.5 rounded-full text-[11px] animate-pulse",
          badgeText: "Đang Pha Chế",
          btn: "bg-secondary text-white shadow-xs hover:opacity-90",
          btnText: "Xong món (Lên khay) ➔",
          nextStatus: "ready" as OrderStatus
        };
      case 'ready':
      case 'done':
      case 'served':
        return {
          card: "bg-white rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col transition-all hover:shadow-md border border-green-200",
          badge: "bg-green-100 text-green-800 font-bold px-2.5 py-0.5 rounded-full text-[11px] flex items-center gap-1",
          badgeText: "Món Đã Sẵn Sàng (Chờ Thu Tiền)",
          btn: "bg-green-600 text-white shadow-xs hover:bg-green-700",
          btnText: "Thu tiền 💵 ➔",
          nextStatus: "paid" as OrderStatus
        };
      case 'paid':
        return {
          card: "bg-white rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col transition-all opacity-75 border border-outline-variant/20 bg-gray-50/50",
          badge: "bg-blue-100 text-blue-800 font-bold px-2.5 py-0.5 rounded-full text-[11px] flex items-center gap-1",
          badgeText: "✓ Đã Thu Tiền",
          btn: "hidden",
          btnText: "",
          nextStatus: "paid" as OrderStatus
        };
      default:
        return { card: "bg-white", badge: "", badgeText: "", btn: "", btnText: "", nextStatus: "pending" as OrderStatus };
    }
  };

  return (
    <div className="w-full max-w-[1600px] mx-auto space-y-4">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-primary text-white text-xs sm:text-sm font-bold px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2 animate-bounce">
          <span className="material-symbols-outlined text-lg">check_circle</span>
          {toastMessage}
        </div>
      )}

      {/* Header Bar */}
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white p-4 rounded-2xl border border-outline-variant/15 shadow-xs">
        <div>
          <h1 className="text-lg sm:text-2xl font-black text-primary tracking-tight">
            Đơn Hàng Trực Tiếp (Live Orders)
          </h1>
          <p className="text-xs text-on-surface-variant">
            Tự động đồng bộ và nhận đơn mới qua WebSocket SignalR. Đơn đã thu tiền được lưu trong ca.
          </p>
        </div>
        
        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
          <div className="flex items-center bg-surface-container-low px-3 py-1.5 rounded-xl border border-outline-variant/20 text-xs w-full sm:w-auto">
            <span className="font-bold text-on-surface-variant mr-2 whitespace-nowrap">Lọc:</span>
            <select 
              className="bg-transparent border-none font-bold text-primary cursor-pointer outline-none w-full sm:w-auto"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              <option value="All">Tất Cả Đơn ({orders.length})</option>
              <option value="pending">Chờ Xác Nhận ({orders.filter(o => o.status === 'pending').length})</option>
              <option value="preparing">Đang Pha Chế ({orders.filter(o => o.status === 'preparing').length})</option>
              <option value="ready">Sẵn Sàng / Chờ Thu Tiền ({orders.filter(o => o.status === 'ready' || o.status === 'done' || o.status === 'served').length})</option>
              <option value="paid">Đã Thu Tiền ({orders.filter(o => o.status === 'paid').length})</option>
            </select>
          </div>
        </div>
      </header>

      {/* Orders Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5 sm:gap-5">
        {paginatedOrders.length === 0 ? (
          <div className="col-span-full py-16 text-center bg-white rounded-2xl border border-outline-variant/20 p-6 shadow-xs">
            <span className="material-symbols-outlined text-4xl text-outline-variant mb-2">assignment_turned_in</span>
            <h3 className="text-sm sm:text-base font-bold text-on-surface mb-1">Hiện không có đơn hàng nào trong mục này</h3>
            <p className="text-xs text-on-surface-variant">Khi khách hàng đặt món tại bàn, đơn mới sẽ tự động hiển thị tại đây.</p>
          </div>
        ) : (
          paginatedOrders.map(order => {
            const styles = getStatusStyles(order.status);
            return (
              <div key={order.id} className={styles.card}>
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <span className="text-[11px] font-black text-primary uppercase tracking-wider bg-primary/10 px-2 py-0.5 rounded-md">
                      Bàn: {order.tableNumber}
                    </span>
                    <h3 className="text-base font-bold text-on-surface mt-1">
                      Đơn #{order.orderCode || order.id}
                    </h3>
                    <span className="text-[11px] text-on-surface-variant">
                      {order.createdAt ? new Date(order.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : 'Vừa xong'}
                    </span>
                  </div>
                  <span className={styles.badge}>{styles.badgeText}</span>
                </div>

                {/* Items List */}
                <div className="space-y-2.5 mb-4 flex-grow border-y border-outline-variant/10 py-2.5">
                  {order.items?.map((item, index) => (
                    <div key={index} className="flex justify-between items-start text-xs sm:text-sm">
                      <div className="pr-2">
                        <p className="font-bold text-on-surface">
                          {item.quantity}x {item.name} {item.sizeName ? `(${item.sizeName})` : ''}
                        </p>
                        <p className="text-[11px] text-on-surface-variant leading-tight mt-0.5">
                          {[item.sugarLevel ? `Đường ${item.sugarLevel}` : '', item.iceLevel ? `Đá ${item.iceLevel}` : '', item.note ? `"${item.note}"` : ''].filter(Boolean).join(', ')}
                        </p>
                      </div>
                      <span className="font-bold text-xs text-primary whitespace-nowrap">
                        {(item.price * item.quantity).toLocaleString('vi-VN')}đ
                      </span>
                    </div>
                  ))}
                </div>

                {/* Footer Action */}
                <div className="flex justify-between items-center mt-auto pt-1">
                  <div>
                    <p className="text-[10px] text-on-surface-variant uppercase font-bold">Tổng tiền</p>
                    <p className="text-sm sm:text-base font-extrabold text-primary">
                      {order.total.toLocaleString('vi-VN')}đ
                    </p>
                  </div>
                  {styles.btn !== "hidden" && (
                    <button 
                      onClick={() => handleStatusChange(order.id, styles.nextStatus, order.orderCode)}
                      className={`px-3.5 py-2 rounded-xl font-bold text-xs shadow-xs transition-all active:scale-95 whitespace-nowrap ${styles.btn}`}
                    >
                      {styles.btnText}
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pagination Controls */}
      <div className="bg-white rounded-2xl p-2 border border-outline-variant/15 shadow-2xs">
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={(p) => {
            setCurrentPage(p);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          totalItems={filteredOrders.length}
          pageSize={PAGE_SIZE}
          itemName="đơn hàng"
        />
      </div>
    </div>
  );
}
