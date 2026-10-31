import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { signalRService } from '../api/signalr';
import { notificationService } from '../services/notificationService';

interface CustomerToastData {
  id: string;
  orderCode: string;
  orderId: number;
  status: string;
  title: string;
  message: string;
  icon: string;
  type: 'preparing' | 'ready' | 'paid' | 'info';
}

export default function CustomerNotificationToast() {
  const navigate = useNavigate();
  const { currentStoreId, currentTableId, guestSession, activeOrder } = useStore();
  const [toast, setToast] = useState<CustomerToastData | null>(null);

  useEffect(() => {
    const sId = currentStoreId || guestSession?.storeId || 1;
    const tId = currentTableId || guestSession?.tableId;

    const handleOrderStatusChanged = (orderId: number, status: string, orderCode: string) => {
      // 1. Check if this order belongs to this customer
      let isMyOrder = false;

      // Match with activeOrder in store
      if (activeOrder && (activeOrder.id === orderId.toString() || activeOrder.orderCode === orderCode)) {
        isMyOrder = true;
      }

      // Match with recent orders stored in localStorage
      if (!isMyOrder) {
        try {
          const recentStr = localStorage.getItem('webcafe_customer_recent_orders');
          if (recentStr) {
            const recent = JSON.parse(recentStr);
            if (Array.isArray(recent) && recent.some((r: any) => r.orderId === orderId || r.orderCode === orderCode)) {
              isMyOrder = true;
            }
          }
        } catch {}
      }

      // If still not matched, check if guest has placed any order or if guest is at this table
      if (!isMyOrder && guestSession?.guestId) {
        isMyOrder = true;
      }

      if (!isMyOrder) return;

      const normStatus = status?.toLowerCase() || '';

      let toastData: CustomerToastData | null = null;

      if (normStatus === 'preparing') {
        notificationService.playStatusChangeSound();
        toastData = {
          id: `${Date.now()}`,
          orderId,
          orderCode,
          status,
          type: 'preparing',
          icon: 'soup_kitchen',
          title: '👨‍🍳 Bếp Đang Pha Chế',
          message: `Đơn hàng #${orderCode || orderId} của bạn đang được pha chế tỉ mỉ. Vui lòng đợi trong giây lát!`,
        };
      } else if (normStatus === 'ready' || normStatus === 'done' || normStatus === 'served') {
        notificationService.playNewOrderSound();
        toastData = {
          id: `${Date.now()}`,
          orderId,
          orderCode,
          status,
          type: 'ready',
          icon: 'local_cafe',
          title: '☕ Món Đã Sẵn Sàng Phục Vụ!',
          message: `Đơn hàng #${orderCode || orderId} đã chuẩn bị xong. Nhân viên đang mang tới bàn cho bạn!`,
        };
      } else if (normStatus === 'paid') {
        notificationService.playStatusChangeSound();
        toastData = {
          id: `${Date.now()}`,
          orderId,
          orderCode,
          status,
          type: 'paid',
          icon: 'check_circle',
          title: '💳 Đã Thanh Toán Thành Công',
          message: `Đơn hàng #${orderCode || orderId} đã được thu tiền hoàn tất. Cảm ơn quý khách!`,
        };
      }

      if (toastData) {
        setToast(toastData);
      }
    };

    signalRService.onOrderStatusChanged(handleOrderStatusChanged);
    signalRService.startConnection(sId, typeof tId === 'number' ? tId : undefined).catch(() => {});

    return () => {
      signalRService.offOrderStatusChanged(handleOrderStatusChanged);
    };
  }, [currentStoreId, currentTableId, guestSession, activeOrder]);

  // Auto dismiss toast after 6 seconds
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => {
      setToast(null);
    }, 6000);
    return () => clearTimeout(timer);
  }, [toast]);

  if (!toast) return null;

  const typeConfig = {
    preparing: {
      bg: 'bg-amber-500/10 dark:bg-amber-950/70 border-amber-500/40 text-amber-950 dark:text-amber-200',
      badgeBg: 'bg-amber-500 text-white',
      borderAccent: 'border-amber-500/30',
    },
    ready: {
      bg: 'bg-emerald-500/10 dark:bg-emerald-950/70 border-emerald-500/40 text-emerald-950 dark:text-emerald-200',
      badgeBg: 'bg-emerald-600 text-white',
      borderAccent: 'border-emerald-500/30',
    },
    paid: {
      bg: 'bg-blue-500/10 dark:bg-blue-950/70 border-blue-500/40 text-blue-950 dark:text-blue-200',
      badgeBg: 'bg-blue-600 text-white',
      borderAccent: 'border-blue-500/30',
    },
    info: {
      bg: 'bg-surface-container dark:bg-white/10 border-outline-variant/30 text-on-surface dark:text-[#F3EDE6]',
      badgeBg: 'bg-primary text-white',
      borderAccent: 'border-primary/30',
    },
  }[toast.type];

  const handleOpenTracking = () => {
    const code = toast.orderCode || toast.orderId;
    setToast(null);
    navigate(`/tracking?code=${encodeURIComponent(code)}`);
  };

  return (
    <div
      role="alert"
      aria-live="polite"
      className="fixed top-28 left-4 right-4 sm:left-auto sm:right-6 sm:w-[400px] z-[90] animate-in slide-in-from-top-4 duration-300"
    >
      <div
        onClick={handleOpenTracking}
        className={`w-full p-4 rounded-3xl border-2 shadow-2xl backdrop-blur-md bg-white/95 dark:bg-[#1E1714]/95 transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.99] flex items-start gap-3.5 ${typeConfig.bg} ${typeConfig.borderAccent}`}
      >
        <div
          className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 shadow-md ${typeConfig.badgeBg}`}
        >
          <span className="material-symbols-outlined text-2xl">{toast.icon}</span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1">
            <h4 className="text-sm font-black tracking-tight truncate">{toast.title}</h4>
            <span className="text-[10px] font-bold opacity-60 shrink-0">Vừa xong</span>
          </div>

          <p className="text-xs mt-1 font-medium leading-relaxed line-clamp-2 opacity-90">
            {toast.message}
          </p>

          <div className="mt-2 flex items-center gap-2">
            <span className="text-[11px] font-bold text-primary dark:text-[#E8B98A] underline flex items-center gap-1">
              <span>Bấm để theo dõi tiến độ đơn</span>
              <span className="material-symbols-outlined text-xs">arrow_forward</span>
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setToast(null);
          }}
          className="p-1 rounded-full hover:bg-black/10 dark:hover:bg-white/10 opacity-60 hover:opacity-100 transition shrink-0"
          aria-label="Đóng thông báo"
        >
          <span className="material-symbols-outlined text-base">close</span>
        </button>
      </div>
    </div>
  );
}

