import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { useStore } from '../../store/useStore';
import { customerApi } from '../../api/apis';
import type { OrderDto, PaginationRes } from '../../types/apiTypes';
import AuthModal from '../../components/AuthModal';
import MobileBottomNav from '../../components/MobileBottomNav';

export default function OrderHistory() {
  const { isAuthenticated, user } = useAuthStore();
  const { guestSession, currentStoreId } = useStore();
  const navigate = useNavigate();

  const [ordersData, setOrdersData] = useState<PaginationRes<OrderDto> | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [filterStoreOnly, setFilterStoreOnly] = useState<boolean>(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  const activeStoreId = guestSession?.storeId || currentStoreId;
  const pageSize = 5;

  useEffect(() => {
    if (!isAuthenticated || !user?.username) {
      setLoading(false);
      return;
    }

    fetchOrders(page, statusFilter, filterStoreOnly);
  }, [isAuthenticated, user?.username, page, statusFilter, filterStoreOnly]);

  const fetchOrders = async (pageNum: number, status: string, storeOnly: boolean) => {
    if (!user?.username) return;
    setLoading(true);
    try {
      const data = await customerApi.getOrders({
        phone: user.username,
        pageNumber: pageNum,
        pageSize,
        status: status === 'all' ? undefined : status,
        storeId: storeOnly && activeStoreId > 0 ? activeStoreId : undefined,
      });
      setOrdersData(data);
    } catch (err) {
      console.error('Lỗi khi tải lịch sử đơn hàng:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (newStatus: string) => {
    setStatusFilter(newStatus);
    setPage(1); // Reset về trang 1 khi đổi bộ lọc
  };

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case 'pending':
        return {
          text: 'Chờ xác nhận',
          className: 'bg-amber-50 text-amber-700 border-amber-200',
          icon: 'hourglass_empty',
        };
      case 'confirmed':
        return {
          text: 'Đã nhận đơn',
          className: 'bg-blue-50 text-blue-700 border-blue-200',
          icon: 'check',
        };
      case 'preparing':
        return {
          text: 'Đang pha chế',
          className: 'bg-indigo-50 text-indigo-700 border-indigo-200',
          icon: 'skillet',
        };
      case 'ready':
        return {
          text: 'Sẵn sàng phục vụ',
          className: 'bg-purple-50 text-purple-700 border-purple-200',
          icon: 'notifications_active',
        };
      case 'served':
      case 'paid':
      case 'completed':
        return {
          text: 'Hoàn tất',
          className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          icon: 'task_alt',
        };
      case 'cancelled':
        return {
          text: 'Đã hủy',
          className: 'bg-gray-100 text-gray-600 border-gray-200',
          icon: 'cancel',
        };
      default:
        return {
          text: status,
          className: 'bg-gray-50 text-gray-700 border-gray-200',
          icon: 'info',
        };
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-between">
        <nav className="bg-white border-b border-gray-200 px-4 py-4 sticky top-0 z-10 shadow-sm">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <Link to="/" className="text-xl font-black text-orange-600 tracking-tight flex items-center gap-2">
              <span className="material-symbols-outlined text-orange-600">coffee</span>
              WebCafe
            </Link>
            <button
              onClick={() => setIsAuthModalOpen(true)}
              className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-bold shadow-sm transition-all"
            >
              Đăng Nhập
            </button>
          </div>
        </nav>

        <main className="flex-grow flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full text-center shadow-xl border border-gray-100 space-y-5">
            <div className="w-20 h-20 bg-orange-50 rounded-full flex items-center justify-center mx-auto text-orange-500 shadow-inner">
              <span className="material-symbols-outlined text-4xl">receipt_long</span>
            </div>
            <h2 className="text-2xl font-black text-gray-900">Lịch Sử Đơn Hàng</h2>
            <p className="text-gray-500 text-sm leading-relaxed">
              Vui lòng đăng nhập để tra cứu lại toàn bộ các đơn món bạn đã từng đặt, theo dõi tiến độ và số điểm tích lũy được nhận.
            </p>
            <button
              onClick={() => setIsAuthModalOpen(true)}
              className="w-full py-3.5 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-bold rounded-2xl shadow-lg shadow-orange-500/30 transition-all active:scale-95"
            >
              Đăng Nhập Hoặc Đăng Ký
            </button>
            <Link
              to="/"
              className="block text-sm text-gray-500 hover:text-gray-800 font-semibold transition-colors"
            >
              Quay lại thực đơn
            </Link>
          </div>
        </main>

        <MobileBottomNav />
        <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
      </div>
    );
  }

  const orders = ordersData?.items || [];
  const totalPages = ordersData?.totalPages || 1;
  const totalRecords = ordersData?.totalRecords || 0;

  return (
    <div className="min-h-screen bg-[#fbf9f7] flex flex-col justify-between font-sans">
      {/* Top Navigation */}
      <nav className="bg-white/80 backdrop-blur-md border-b border-gray-100 px-4 py-3 sticky top-0 z-30 shadow-sm">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-sm font-bold text-gray-600 hover:text-orange-600 transition-colors py-1 px-2 rounded-lg hover:bg-gray-100"
          >
            <span className="material-symbols-outlined text-lg">arrow_back</span>
            <span>Quay lại</span>
          </button>
          <h1 className="text-base font-black text-gray-900">Lịch Sử Đơn Hàng</h1>
          <Link
            to="/profile"
            className="text-xs font-bold text-orange-600 hover:text-orange-700 bg-orange-50 px-3 py-1.5 rounded-full flex items-center gap-1 border border-orange-200 transition-colors"
          >
            <span className="material-symbols-outlined text-sm">person</span>
            <span>Tài khoản</span>
          </Link>
        </div>
      </nav>

      <main className="flex-grow max-w-4xl mx-auto w-full px-4 py-6 space-y-6">
        {/* Bộ lọc quán & trạng thái */}
        <div className="space-y-2">
          {activeStoreId > 0 && (
            <div className="flex items-center gap-2 px-1">
              <button
                onClick={() => setFilterStoreOnly(false)}
                className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
                  !filterStoreOnly ? 'bg-gray-900 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                🌐 Tất cả các quán
              </button>
              <button
                onClick={() => setFilterStoreOnly(true)}
                className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
                  filterStoreOnly ? 'bg-amber-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                📍 Chỉ quán hiện tại
              </button>
            </div>
          )}

          <section className="bg-white rounded-2xl p-2 shadow-sm border border-gray-100 flex gap-1.5 overflow-x-auto custom-scrollbar">
            {[
              { id: 'all', label: 'Tất cả' },
              { id: 'pending', label: 'Chờ duyệt' },
              { id: 'preparing', label: 'Đang làm' },
              { id: 'completed', label: 'Hoàn tất' },
              { id: 'cancelled', label: 'Đã hủy' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleFilterChange(tab.id)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                  statusFilter === tab.id
                    ? 'bg-orange-500 text-white shadow-sm'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </section>
        </div>

        {/* Danh sách đơn hàng */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-3">
            <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-sm font-semibold text-gray-500">Đang tải lịch sử đơn hàng...</p>
          </div>
        ) : orders.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 text-center shadow-sm border border-gray-100 space-y-4">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto text-gray-300">
              <span className="material-symbols-outlined text-3xl">receipt</span>
            </div>
            <h3 className="text-lg font-bold text-gray-800">Chưa tìm thấy đơn hàng nào</h3>
            <p className="text-xs text-gray-500 max-w-xs mx-auto">
              Bạn chưa có đơn hàng nào ở mục này. Hãy thử đặt những món đồ uống tuyệt hảo ngay hôm nay!
            </p>
            <Link
              to="/"
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-xl shadow-md transition-all active:scale-95"
            >
              <span className="material-symbols-outlined text-sm">local_cafe</span>
              <span>Khám Phá Thực Đơn</span>
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => {
              const statusBadge = getStatusBadge(order.status);
              return (
                <div
                  key={order.orderId}
                  className="bg-white rounded-3xl p-5 sm:p-6 shadow-sm border border-gray-100 hover:shadow-md transition-all space-y-4"
                >
                  {/* Card Header */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-3.5">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-black text-gray-900 font-mono tracking-tight">
                          #{order.orderCode}
                        </span>
                        {order.tenantName && (
                          <span className="text-[11px] font-bold text-amber-800 bg-amber-50 border border-amber-200/60 px-2 py-0.5 rounded-md flex items-center gap-1">
                            <span className="material-symbols-outlined text-xs">storefront</span>
                            {order.tenantName}
                          </span>
                        )}
                        {order.tableNumber && (
                          <span className="text-[11px] font-bold text-gray-600 bg-gray-100 px-2 py-0.5 rounded-md">
                            Bàn {order.tableNumber}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-gray-400 mt-1 flex items-center gap-2 flex-wrap">
                        <span>{new Date(order.createdAt).toLocaleString('vi-VN')}</span>
                        {order.storeName && (
                          <span>• Chi nhánh: <strong className="text-gray-600">{order.storeName}</strong></span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1 text-xs font-bold px-3 py-1 rounded-full border shadow-sm ${statusBadge.className}`}
                      >
                        <span className="material-symbols-outlined text-xs">{statusBadge.icon}</span>
                        {statusBadge.text}
                      </span>
                    </div>
                  </div>

                  {/* Items List */}
                  <div className="space-y-2.5">
                    {order.items.map((item) => (
                      <div key={item.orderItemId} className="flex items-start justify-between text-xs py-1">
                        <div className="flex items-start gap-2.5">
                          <span className="font-extrabold text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded text-[11px]">
                            {item.quantity}x
                          </span>
                          <div>
                            <div className="font-bold text-gray-800">
                              {item.menuItemName}
                              {item.sizeName ? ` (${item.sizeName})` : ''}
                            </div>
                            {item.toppings && item.toppings.length > 0 && (
                              <div className="text-[11px] text-gray-400 mt-0.5">
                                + {item.toppings.map((t) => t.toppingName).join(', ')}
                              </div>
                            )}
                            {(item.sugarLevel || item.iceLevel) && (
                              <div className="text-[10px] text-gray-400">
                                {item.sugarLevel ? `Đường: ${item.sugarLevel}` : ''}
                                {item.sugarLevel && item.iceLevel ? ' • ' : ''}
                                {item.iceLevel ? `Đá: ${item.iceLevel}` : ''}
                              </div>
                            )}
                          </div>
                        </div>
                        <span className="font-bold text-gray-700 whitespace-nowrap ml-2">
                          {item.subTotal.toLocaleString('vi-VN')}đ
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Summary & Points Details */}
                  <div className="pt-3 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    {/* Thông tin điểm tích/dùng */}
                    <div className="flex flex-wrap items-center gap-2">
                      {order.pointsUsed > 0 && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                          <span className="material-symbols-outlined text-xs text-amber-600">remove_circle</span>
                          Đã dùng {order.pointsUsed.toLocaleString()} điểm
                        </span>
                      )}
                      {order.pointsEarned > 0 && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                          <span className="material-symbols-outlined text-xs text-emerald-600">add_circle</span>
                          Tích lũy +{order.pointsEarned.toLocaleString()} điểm
                        </span>
                      )}
                      {order.discountAmount > 0 && order.pointsUsed === 0 && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded-md">
                          Giảm giá: -{order.discountAmount.toLocaleString('vi-VN')}đ
                        </span>
                      )}
                    </div>

                    {/* Tổng tiền & Nút Theo dõi */}
                    <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto">
                      <div className="text-right">
                        <span className="text-[10px] text-gray-400 block uppercase tracking-wider">Tổng thanh toán</span>
                        <span className="text-base font-black text-orange-600">
                          {order.totalAmount.toLocaleString('vi-VN')}đ
                        </span>
                      </div>
                      <Link
                        to={`/tracking?code=${order.orderCode}`}
                        className="px-4 py-2 bg-orange-50 hover:bg-orange-100 text-orange-600 font-bold rounded-xl text-xs flex items-center gap-1 transition-colors border border-orange-200"
                      >
                        <span className="material-symbols-outlined text-sm">visibility</span>
                        <span>Theo dõi</span>
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Phân Trang (Pagination) */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between bg-white rounded-2xl p-4 shadow-sm border border-gray-100 mt-6">
                <div className="text-xs text-gray-500 font-medium">
                  Hiển thị trang <span className="font-bold text-gray-800">{page}</span> / <span className="font-bold text-gray-800">{totalPages}</span> (Tổng {totalRecords} đơn)
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="px-3.5 py-1.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-sm">chevron_left</span>
                    <span>Trước</span>
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="px-3.5 py-1.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-1"
                  >
                    <span>Sau</span>
                    <span className="material-symbols-outlined text-sm">chevron_right</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      <footer className="w-full bg-white border-t border-gray-100 py-4 text-center text-xs text-gray-400">
        © 2024 AI-SMARTSERVE. Hệ thống quản lý & đặt món thông minh.
      </footer>
      <MobileBottomNav />
    </div>
  );
}
