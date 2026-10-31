import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { signalRService } from '../api/signalr';
import { notificationService } from '../services/notificationService';
import type { OrderDto } from '../types/apiTypes';

export interface AppNotification {
  id: string;
  type: 'order_new' | 'order_status' | 'payment_received' | 'table_call';
  title: string;
  message: string;
  orderId?: number | string;
  orderCode?: string;
  tableNumber?: string | null;
  totalAmount?: number;
  status?: string;
  createdAt: string;
  isRead: boolean;
}

interface NotificationBellProps {
  storeId?: number;
  isAdmin?: boolean;
}

function formatTimeAgo(isoString: string): string {
  try {
    const diffMs = Date.now() - new Date(isoString).getTime();
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 60) return 'Vừa xong';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin} phút trước`;
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `${diffHour} giờ trước`;
    return new Date(isoString).toLocaleDateString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit',
    });
  } catch {
    return 'Gần đây';
  }
}

function formatOrderStatus(status?: string): string {
  switch (status?.toLowerCase()) {
    case 'pending':
      return 'Chờ xác nhận';
    case 'preparing':
      return 'Đang pha chế';
    case 'ready':
    case 'done':
    case 'served':
      return 'Món đã sẵn sàng phục vụ';
    case 'paid':
      return 'Đã thanh toán';
    case 'cancelled':
      return 'Đã hủy đơn';
    default:
      return status || '';
  }
}

export default function NotificationBell({ storeId, isAdmin = false }: NotificationBellProps) {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [activeTab, setActiveTab] = useState<'all' | 'unread' | 'order'>('all');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isShaking, setIsShaking] = useState(false);
  const [toastAlert, setToastAlert] = useState<AppNotification | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const storageKey = `webcafe_notifications_store_${storeId || 'default'}`;

  // 1. Load sound state & notifications from storage
  useEffect(() => {
    setSoundEnabled(notificationService.isNotificationEnabled());
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        setNotifications(JSON.parse(saved));
      }
    } catch {
      setNotifications([]);
    }
  }, [storageKey]);

  // Save to localStorage when notifications update
  const saveNotifications = (items: AppNotification[]) => {
    setNotifications(items);
    try {
      localStorage.setItem(storageKey, JSON.stringify(items.slice(0, 40)));
    } catch {}
  };

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // 2. Realtime SignalR connection & listeners
  useEffect(() => {
    if (!storeId) return;

    // Helper to add notification
    const pushNotification = (item: Omit<AppNotification, 'id' | 'createdAt' | 'isRead'>) => {
      const newNotif: AppNotification = {
        ...item,
        id: `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        createdAt: new Date().toISOString(),
        isRead: false,
      };

      setNotifications((prev) => {
        // Prevent duplicate order within 2 seconds
        if (item.orderId && prev.some((p) => p.orderId === item.orderId && Date.now() - new Date(p.createdAt).getTime() < 2000)) {
          return prev;
        }
        const updated = [newNotif, ...prev].slice(0, 40);
        try {
          localStorage.setItem(storageKey, JSON.stringify(updated));
        } catch {}
        return updated;
      });

      // Sound & animations
      if (item.type === 'order_new') {
        notificationService.playNewOrderSound();
      } else {
        notificationService.playStatusChangeSound();
      }

      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 1200);

      // Show floating toast
      setToastAlert(newNotif);
      setTimeout(() => {
        setToastAlert((curr) => (curr?.id === newNotif.id ? null : curr));
      }, 4500);
    };

    // Handler: New order received
    const handleNewOrder = (order: OrderDto) => {
      pushNotification({
        type: 'order_new',
        title: `Đơn Hàng Mới • ${order.tableNumber ? `Bàn ${order.tableNumber}` : 'Mang Về'}`,
        message: `Mã đơn #${order.orderCode} • Tổng tiền: ${order.totalAmount.toLocaleString('vi-VN')}đ`,
        orderId: order.orderId,
        orderCode: order.orderCode,
        tableNumber: order.tableNumber || undefined,
        totalAmount: order.totalAmount,
        status: order.status,
      });
    };

    // Handler: Order status changed
    const handleOrderStatus = (orderId: number, status: string, orderCode: string) => {
      const statusText = formatOrderStatus(status);
      pushNotification({
        type: status.toLowerCase() === 'paid' ? 'payment_received' : 'order_status',
        title: status.toLowerCase() === 'paid' ? `Đã Thu Tiền • Đơn #${orderCode || orderId}` : `Cập Nhật Đơn #${orderCode || orderId}`,
        message: `Trạng thái mới: ${statusText}`,
        orderId,
        orderCode,
        status,
      });
    };

    // Handler: Table status changed
    const handleTableStatus = (tableId: number, status: string) => {
      pushNotification({
        type: 'table_call',
        title: `Bàn #${tableId}`,
        message: `Trạng thái bàn: ${status}`,
      });
    };

    // Register listeners
    signalRService.onNewOrder(handleNewOrder);
    signalRService.onOrderStatusChanged(handleOrderStatus);
    signalRService.onTableStatusChanged(handleTableStatus);

    // Ensure connection is started
    signalRService.startConnection(storeId).catch(() => {});

    return () => {
      signalRService.offNewOrder(handleNewOrder);
      signalRService.offOrderStatusChanged(handleOrderStatus);
      signalRService.offTableStatusChanged(handleTableStatus);
    };
  }, [storeId, storageKey]);

  // Counts
  const unreadCount = useMemo(() => {
    return notifications.filter((n) => !n.isRead).length;
  }, [notifications]);

  const filteredNotifications = useMemo(() => {
    if (activeTab === 'unread') return notifications.filter((n) => !n.isRead);
    if (activeTab === 'order') return notifications.filter((n) => n.type === 'order_new' || n.type === 'order_status' || n.type === 'payment_received');
    return notifications;
  }, [notifications, activeTab]);

  // Actions
  const handleToggleSound = () => {
    const nextState = notificationService.toggle();
    setSoundEnabled(nextState);
  };

  const handleMarkAsRead = (id: string) => {
    const updated = notifications.map((n) => (n.id === id ? { ...n, isRead: true } : n));
    saveNotifications(updated);
  };

  const handleMarkAllAsRead = () => {
    const updated = notifications.map((n) => ({ ...n, isRead: true }));
    saveNotifications(updated);
  };

  const handleClearAll = () => {
    saveNotifications([]);
  };

  const handleClickNotification = (item: AppNotification) => {
    handleMarkAsRead(item.id);
    setIsOpen(false);
    if (isAdmin) {
      navigate('/admin/orders');
    } else {
      navigate('/staff/orders');
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      {/* Bell Trigger Button */}
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className={`relative w-10 h-10 flex items-center justify-center rounded-full hover:bg-secondary-container/50 dark:hover:bg-white/10 transition-colors text-on-surface-variant dark:text-[#F3EDE6] ${
          isShaking ? 'animate-[wiggle_0.4s_ease-in-out_infinite]' : ''
        }`}
        title="Thông báo hệ thống"
        aria-label="Chuông thông báo"
      >
        <span
          className="material-symbols-outlined text-2xl"
          style={unreadCount > 0 ? { fontVariationSettings: "'FILL' 1" } : {}}
        >
          notifications
        </span>

        {/* Unread Badge Pill */}
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-red-600 text-white text-[10px] font-black rounded-full flex items-center justify-center shadow-md animate-in zoom-in">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Floating Toast Notification on top right */}
      {toastAlert && (
        <div
          onClick={() => {
            handleClickNotification(toastAlert);
            setToastAlert(null);
          }}
          className="fixed top-24 left-4 right-4 sm:left-auto sm:right-8 z-50 max-w-sm mx-auto sm:mx-0 bg-white dark:bg-[#1E1714] border-2 border-primary/40 dark:border-amber-500/40 rounded-2xl p-3.5 shadow-2xl flex items-start gap-3 cursor-pointer hover:scale-[1.02] transition-all animate-in slide-in-from-top-4 duration-300"
        >
          <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-xl">
              {toastAlert.type === 'order_new' ? 'receipt_long' : 'notifications_active'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <p className="text-xs font-black text-on-surface dark:text-[#F8F4EE] truncate">
                {toastAlert.title}
              </p>
              <span className="text-[10px] text-on-surface-variant dark:text-[#A4968C] ml-1 shrink-0">
                Vừa xong
              </span>
            </div>
            <p className="text-xs text-on-surface-variant dark:text-[#A4968C] mt-0.5 line-clamp-2">
              {toastAlert.message}
            </p>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setToastAlert(null);
            }}
            className="text-on-surface-variant/50 hover:text-on-surface dark:hover:text-white p-0.5"
          >
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        </div>
      )}

      {/* Facebook-style Notification Popover */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 max-w-[calc(100vw-1.5rem)] bg-white dark:bg-[#1E1714] border border-outline-variant/30 dark:border-white/10 rounded-3xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
          {/* Popover Header */}
          <div className="p-4 border-b border-outline-variant/15 dark:border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-base text-on-surface dark:text-[#F8F4EE]">Thông Báo</h3>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-400 text-xs font-bold rounded-full">
                  {unreadCount} mới
                </span>
              )}
            </div>

            <div className="flex items-center gap-1">
              {/* Sound Toggle */}
              <button
                type="button"
                onClick={handleToggleSound}
                title={soundEnabled ? 'Tắt âm báo' : 'Bật âm báo'}
                className="p-1.5 rounded-xl hover:bg-surface-container dark:hover:bg-white/10 text-on-surface-variant dark:text-[#A4968C] transition"
              >
                <span className="material-symbols-outlined text-lg">
                  {soundEnabled ? 'volume_up' : 'volume_off'}
                </span>
              </button>

              {/* Mark all as read */}
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllAsRead}
                  title="Đánh dấu tất cả là đã đọc"
                  className="p-1.5 rounded-xl hover:bg-surface-container dark:hover:bg-white/10 text-on-surface-variant dark:text-[#A4968C] transition"
                >
                  <span className="material-symbols-outlined text-lg">done_all</span>
                </button>
              )}
            </div>
          </div>

          {/* Quick Filter Tabs */}
          <div className="px-4 py-2 border-b border-outline-variant/10 dark:border-white/5 flex gap-1 bg-surface-container-low/40 dark:bg-white/[0.02]">
            {[
              { id: 'all', label: 'Tất cả' },
              { id: 'unread', label: `Chưa đọc (${unreadCount})` },
              { id: 'order', label: 'Đơn hàng' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                  activeTab === tab.id
                    ? 'bg-primary text-white shadow-xs'
                    : 'text-on-surface-variant dark:text-[#A4968C] hover:bg-surface-container dark:hover:bg-white/5'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Notification List */}
          <div className="max-h-[380px] overflow-y-auto divide-y divide-outline-variant/10 dark:divide-white/5">
            {filteredNotifications.length === 0 ? (
              <div className="py-12 px-4 text-center">
                <span className="material-symbols-outlined text-4xl text-on-surface-variant/40 mb-2">
                  notifications_off
                </span>
                <p className="text-xs font-bold text-on-surface dark:text-[#F8F4EE]">
                  Không có thông báo nào
                </p>
                <p className="text-[11px] text-on-surface-variant dark:text-[#A4968C] mt-0.5">
                  Đơn đặt món và sự kiện mới từ khách hàng sẽ xuất hiện tại đây theo thời gian thực.
                </p>
              </div>
            ) : (
              filteredNotifications.map((item) => {
                const isNewOrder = item.type === 'order_new';
                const isPaid = item.type === 'payment_received';

                return (
                  <div
                    key={item.id}
                    onClick={() => handleClickNotification(item)}
                    className={`p-3.5 flex items-start gap-3 transition-colors cursor-pointer group ${
                      !item.isRead
                        ? 'bg-primary/5 dark:bg-amber-500/10 hover:bg-primary/10 dark:hover:bg-amber-500/15'
                        : 'hover:bg-surface-container-low dark:hover:bg-white/[0.03]'
                    }`}
                  >
                    {/* Icon Badge */}
                    <div
                      className={`w-9 h-9 rounded-2xl flex items-center justify-center shrink-0 shadow-xs ${
                        isNewOrder
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400'
                          : isPaid
                          ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400'
                          : 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400'
                      }`}
                    >
                      <span className="material-symbols-outlined text-lg">
                        {isNewOrder ? 'receipt_long' : isPaid ? 'payments' : 'info'}
                      </span>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <p
                          className={`text-xs truncate ${
                            !item.isRead
                              ? 'font-black text-on-surface dark:text-[#F8F4EE]'
                              : 'font-semibold text-on-surface-variant dark:text-[#A4968C]'
                          }`}
                        >
                          {item.title}
                        </p>
                        <span className="text-[10px] text-on-surface-variant/70 dark:text-[#A4968C]/70 shrink-0 font-medium">
                          {formatTimeAgo(item.createdAt)}
                        </span>
                      </div>

                      <p className="text-xs text-on-surface-variant dark:text-[#A4968C] mt-0.5 line-clamp-2 leading-relaxed">
                        {item.message}
                      </p>

                      {item.orderCode && (
                        <div className="mt-1 flex items-center gap-1.5">
                          <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 bg-surface-container dark:bg-white/10 rounded text-primary dark:text-[#E8B98A]">
                            #{item.orderCode}
                          </span>
                          <span className="text-[10px] font-bold text-primary dark:text-[#E8B98A] group-hover:underline">
                            Xem đơn ➔
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Blue Unread Dot */}
                    {!item.isRead && (
                      <span className="w-2 h-2 rounded-full bg-primary dark:bg-amber-400 shrink-0 mt-1.5" />
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Popover Footer */}
          <div className="p-3 border-t border-outline-variant/15 dark:border-white/5 bg-surface-container-lowest dark:bg-[#140F0D] flex items-center justify-between text-xs">
            {notifications.length > 0 && (
              <button
                type="button"
                onClick={handleClearAll}
                className="text-[11px] font-semibold text-on-surface-variant hover:text-red-500 dark:text-[#A4968C] dark:hover:text-red-400 transition"
              >
                Xóa tất cả
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                navigate(isAdmin ? '/admin/orders' : '/staff/orders');
              }}
              className="text-[11px] font-bold text-primary dark:text-[#E8B98A] hover:underline ml-auto"
            >
              Mở trang Quản lý đơn ➔
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
