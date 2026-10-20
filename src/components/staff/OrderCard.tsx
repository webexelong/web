import { useState } from 'react';
import { apiClient } from '../../api/apiClient';
import { useAuthStore } from '../../store/authStore';
import ReceiptPrintModal from '../print/ReceiptPrintModal';
import { useNotification } from '../NotificationProvider';
import type { ReceiptData } from '../../services/printService';

interface OrderCardProps {
  order: {
    orderId: number;
    orderCode: string;
    tableNumber?: string;
    customerName?: string;
    status: string;
    subTotal: number;
    totalAmount: number;
    items: Array<{
      menuItemName: string;
      sizeName?: string;
      quantity: number;
      unitPrice: number;
      sugarLevel: string;
      iceLevel: string;
      toppings?: string[];
      note?: string;
    }>;
    createdAt: string;
    note?: string;
  };
  onStatusUpdate: (orderId: number, newStatus: string) => void;
}

const STATUS_CONFIG: Record<string, {
  label: string;
  color: string;
  icon: string;
  nextAction: { status: string; label: string; color: string } | null;
}> = {
  awaiting_payment: {
    label: 'Chờ thanh toán PayOS',
    color: 'bg-amber-50 text-amber-700 border-amber-200',
    icon: 'hourglass_empty',
    nextAction: null
  },
  pending: {
    label: 'Chờ xác nhận',
    color: 'bg-amber-50 text-amber-800 border-amber-200',
    icon: 'schedule',
    nextAction: { status: 'confirmed', label: 'Xác nhận đơn', color: 'bg-primary hover:bg-primary-container text-white' }
  },
  confirmed: {
    label: 'Đã xác nhận (Chờ pha)',
    color: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    icon: 'verified',
    nextAction: { status: 'preparing', label: 'Nhận đơn pha chế', color: 'bg-primary hover:bg-primary/90 text-white' }
  },
  preparing: {
    label: 'Đang chuẩn bị',
    color: 'bg-blue-50 text-blue-800 border-blue-200',
    icon: 'restaurant',
    nextAction: { status: 'ready', label: 'Hoàn thành pha chế', color: 'bg-emerald-700 hover:bg-emerald-800 text-white' }
  },
  ready: {
    label: 'Sẵn sàng phục vụ',
    color: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    icon: 'check_circle',
    nextAction: { status: 'served', label: 'Đã phục vụ', color: 'bg-primary hover:bg-primary-container text-white' }
  },
  served: {
    label: 'Đã phục vụ',
    color: 'bg-primary/10 text-primary border-primary/20',
    icon: 'room_service',
    nextAction: { status: 'completed', label: 'Hoàn tất đơn', color: 'bg-on-surface hover:bg-on-surface/90 text-white' }
  },
  paid: {
    label: 'Đã thanh toán',
    color: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    icon: 'paid',
    nextAction: null // Khóa chặt: Không cho lặp lại
  },
  completed: {
    label: 'Đã hoàn thành',
    color: 'bg-surface-container text-on-surface-variant border-outline-variant/30',
    icon: 'task_alt',
    nextAction: null // Khóa chặt: Đơn đã kết thúc
  },
  cancelled: {
    label: 'Đã hủy',
    color: 'bg-red-100 text-red-800 border-red-200',
    icon: 'cancel',
    nextAction: null
  }
};

export default function OrderCard({ order, onStatusUpdate }: OrderCardProps) {
  const { confirm, alert } = useNotification();
  const [loading, setLoading] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const user = useAuthStore(state => state.user);

  const receiptData: ReceiptData = {
    orderCode: order.orderCode,
    tableNumber: order.tableNumber || 'Mang về',
    customerName: order.customerName,
    staffName: user?.fullName || 'Thu ngân',
    createdAt: order.createdAt,
    items: order.items.map(i => ({
      name: i.menuItemName,
      quantity: i.quantity,
      price: i.unitPrice,
      totalPrice: i.unitPrice * i.quantity,
      sizeName: i.sizeName,
      sugarLevel: i.sugarLevel,
      iceLevel: i.iceLevel,
      toppings: i.toppings,
      note: i.note,
    })),
    subTotal: order.subTotal,
    discountAmount: Math.max(0, order.subTotal - order.totalAmount),
    totalAmount: order.totalAmount,
    paymentMethod: order.status === 'paid' ? 'cash' : 'transfer',
    paymentStatus: order.status === 'paid' || order.status === 'completed' ? 'paid' : 'pending',
    note: order.note,
    storeInfo: {
      storeName: user?.storeName || 'WebCafe Quán',
      brandName: user?.brandName || 'AI-SMARTSERVE',
    },
  };

  const statusConfig = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;

  const handleStatusUpdate = async (newStatus: string) => {
    try {
      setLoading(true);
      await apiClient.put(`/orders/${order.orderId}/status`, { status: newStatus });
      onStatusUpdate(order.orderId, newStatus);
    } catch (err: any) {
      const msg = err.response?.data?.message || err.response?.data?.title || err.message || 'Không thể cập nhật trạng thái đơn hàng';
      alert(msg, 'error', 'Cập nhật đơn thất bại');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelOrder = async () => {
    confirm({ tone: 'warning', title: 'Hủy đơn hàng?', message: 'Bạn có chắc muốn hủy đơn hàng này?', confirmText: 'Hủy đơn', onConfirm: async () => {
    try {
      setLoading(true);
      await apiClient.put(`/orders/${order.orderId}/status`, { status: 'cancelled' });
      onStatusUpdate(order.orderId, 'cancelled');
    } catch (err: any) {
      const msg = err.response?.data?.message || err.response?.data?.title || err.message || 'Không thể hủy đơn hàng';
      alert(msg, 'error', 'Hủy đơn thất bại');
    } finally {
      setLoading(false);
    }
    }});
  };

  const getElapsedTime = () => {
    if (!order.createdAt) return '';
    const dateStr = order.createdAt.endsWith('Z') || order.createdAt.includes('+')
      ? order.createdAt
      : `${order.createdAt}Z`;
    const created = new Date(dateStr);
    const now = new Date();
    const diff = Math.floor((now.getTime() - created.getTime()) / 60000); // minutes
    
    if (isNaN(diff) || diff < 1) return 'Vừa xong';
    if (diff < 60) return `${diff} phút trước`;
    const hours = Math.floor(diff / 60);
    if (hours < 24) return `${hours} giờ trước`;
    const days = Math.floor(hours / 24);
    return `${days} ngày trước`;
  };

  return (
    <div className="bg-surface-container-lowest dark:bg-gray-800 rounded-3xl shadow-sm border border-outline-variant/20 dark:border-gray-700/30 overflow-hidden hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="bg-gradient-to-br from-primary to-primary-container dark:from-orange-600 dark:to-orange-700 p-4 text-white">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-bold text-lg">#{order.orderCode}</h3>
          <span className="text-sm opacity-90">{getElapsedTime()}</span>
        </div>
        <div className="flex items-center justify-between">
          {order.tableNumber && (
            <div className="flex items-center gap-1 text-sm">
              <span className="material-symbols-outlined text-base">table_restaurant</span>
              <span>Bàn {order.tableNumber}</span>
            </div>
          )}
          {order.customerName && (
            <div className="flex items-center gap-1 text-sm">
              <span className="material-symbols-outlined text-base">person</span>
              <span>{order.customerName}</span>
            </div>
          )}
        </div>
      </div>

      {/* Status Badge + Print Button */}
      <div className="px-4 py-3 bg-surface-container-low dark:bg-gray-700/40 border-b border-outline-variant/15 dark:border-gray-600/30 flex items-center justify-between">
        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border ${statusConfig.color} text-sm font-semibold`}>
          <span className="material-symbols-outlined text-base">{statusConfig.icon}</span>
          <span>{statusConfig.label}</span>
        </div>

        <button
          type="button"
          onClick={() => setShowPrintModal(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-primary/20 dark:border-orange-500/30 bg-surface-container-lowest dark:bg-gray-600/40 hover:bg-primary/5 dark:hover:bg-orange-500/10 text-primary dark:text-orange-400 font-bold text-xs shadow-2xs transition-all active:scale-95"
          title="In hóa đơn thanh toán hoặc phiếu pha chế bếp"
        >
          <span className="material-symbols-outlined text-base">print</span>
          <span>In Phiếu</span>
        </button>
      </div>

      {/* Order Items */}
      <div className="p-4">
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="w-full flex items-center justify-between text-left mb-3 hover:bg-surface-container-low dark:hover:bg-gray-700/40 p-2 rounded-xl transition-colors"
        >
          <span className="font-semibold text-on-surface dark:text-gray-200">
            {order.items.length} món ({order.items.reduce((sum, item) => sum + item.quantity, 0)} phần)
          </span>
          <span className={`material-symbols-outlined text-on-surface-variant dark:text-gray-400 transition-transform ${showDetails ? 'rotate-180' : ''}`}>
            expand_more
          </span>
        </button>

        {showDetails && (
          <div className="space-y-2 mb-3 max-h-64 overflow-y-auto">
            {order.items.map((item, idx) => (
              <div key={idx} className="bg-surface-container-low dark:bg-gray-700/40 p-3 rounded-2xl text-sm">
                <div className="flex justify-between items-start mb-1">
                  <span className="font-semibold text-on-surface dark:text-gray-200">
                    {item.quantity}x {item.menuItemName}
                  </span>
                  <span className="text-on-surface-variant dark:text-gray-400">{item.unitPrice.toLocaleString()}đ</span>
                </div>
                {item.sizeName && (
                  <p className="text-on-surface-variant dark:text-gray-400 text-xs">Size: {item.sizeName}</p>
                )}
                <div className="flex gap-3 text-xs text-on-surface-variant dark:text-gray-400 mt-1">
                  <span>🧊 {item.iceLevel}</span>
                  <span>🍯 {item.sugarLevel}</span>
                </div>
                {item.toppings && item.toppings.length > 0 && (
                  <p className="text-xs text-primary dark:text-orange-400 mt-1">+ {item.toppings.join(', ')}</p>
                )}
                {item.note && (
                  <p className="text-xs text-on-surface-variant dark:text-gray-400 italic mt-1">💬 {item.note}</p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Order Note */}
        {order.note && (
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 rounded-2xl p-3 mb-3">
            <div className="flex items-start gap-2">
            <span className="material-symbols-outlined text-amber-700 dark:text-amber-400 text-base">info</span>
            <p className="text-sm text-amber-900 dark:text-amber-300">{order.note}</p>
            </div>
          </div>
        )}

        {/* Total Amount */}
        <div className="border-t border-outline-variant/15 dark:border-gray-600/30 pt-3 mb-4">
          <div className="flex justify-between items-center">
            <span className="text-on-surface-variant dark:text-gray-400 font-medium">Tổng tiền:</span>
            <span className="text-xl font-bold text-primary dark:text-orange-400">
              {order.totalAmount.toLocaleString()}đ
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          {statusConfig.nextAction && (
            <button
              onClick={() => handleStatusUpdate(statusConfig.nextAction!.status)}
              disabled={loading}
              className={`flex-1 ${statusConfig.nextAction.color} py-2.5 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                  <span>Đang xử lý...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-xl">arrow_forward</span>
                  <span>{statusConfig.nextAction.label}</span>
                </>
              )}
            </button>
          )}
          
          {(order.status === 'pending' || order.status === 'confirmed') && (
            <button
              onClick={handleCancelOrder}
              disabled={loading}
              className="px-4 py-2.5 bg-error dark:bg-red-700 hover:bg-error/90 dark:hover:bg-red-800 text-white rounded-xl font-bold text-xs flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Hủy đơn hàng"
            >
              <span className="material-symbols-outlined text-xl">close</span>
            </button>
          )}
        </div>
      </div>

      {/* Modal In Hóa Đơn & Phiếu Bếp */}
      <ReceiptPrintModal
        isOpen={showPrintModal}
        onClose={() => setShowPrintModal(false)}
        data={receiptData}
      />
    </div>
  );
}
