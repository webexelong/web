import React, { useState, useEffect, useRef, useCallback } from 'react';
import QRCode from 'qrcode';
import { paymentApi } from '../../api/apis';
import { signalRService } from '../../api/signalr';
import { notificationService } from '../../services/notificationService';
import type { Order } from '../../store/useStore';
import type { PayOSPaymentDto } from '../../types/apiTypes';
import { useNotification } from '../NotificationProvider';

interface PayOSCounterModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order | null;
  onPaidSuccess: (order: Order) => void;
}

export const PayOSCounterModal: React.FC<PayOSCounterModalProps> = ({
  isOpen,
  onClose,
  order,
  onPaidSuccess,
}) => {
  const { alert } = useNotification();
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [payosData, setPayosData] = useState<PayOSPaymentDto | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isPaid, setIsPaid] = useState<boolean>(false);
  const [isConvertingCash, setIsConvertingCash] = useState<boolean>(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const isMountedRef = useRef<boolean>(true);
  const hasTriggeredSuccess = useRef<boolean>(false);

  // Trigger Success Flow
  const triggerSuccess = useCallback(() => {
    if (hasTriggeredSuccess.current) return;
    hasTriggeredSuccess.current = true;
    setIsPaid(true);

    try {
      notificationService.playStatusChangeSound();
    } catch {
      // Ignore audio error
    }

    if (order) {
      setTimeout(() => {
        if (isMountedRef.current) {
          onPaidSuccess(order);
          onClose();
        }
      }, 1800);
    }
  }, [order, onPaidSuccess, onClose]);

  // Load PayOS payment details when opened
  useEffect(() => {
    isMountedRef.current = true;
    hasTriggeredSuccess.current = false;
    setIsPaid(false);
    setError(null);
    setPayosData(null);
    setQrDataUrl('');

    if (!isOpen || !order) return;

    // Nếu đơn hàng đã ở trạng thái đã thanh toán hoặc hoàn thành, kích hoạt ngay thành công
    if (order.status === 'paid' || order.status === 'confirmed' || (order.status as string) === 'completed') {
      setIsLoading(false);
      triggerSuccess();
      return;
    }

    let isSubscribed = true;
    setIsLoading(true);

    const initPayment = async () => {
      try {
        const orderIdNum = order.id ? parseInt(order.id.replace(/\D/g, '')) : undefined;
        const res = await paymentApi.createPayOSPayment({
          orderId: orderIdNum && !isNaN(orderIdNum) ? orderIdNum : undefined,
          orderCode: order.orderCode,
        });

        if (!isSubscribed) return;

        if (res) {
          setPayosData(res);
          if (res.status === 'PAID' || res.status === 'completed') {
            triggerSuccess();
          }
        }
      } catch (err: any) {
        console.error('Lỗi khởi tạo PayOS cho đơn tại quầy:', err);
        const errMsg = err?.response?.data?.message || err?.message || '';
        if (errMsg.toLowerCase().includes('đã được thanh toán') || errMsg.toLowerCase().includes('already paid')) {
          // Đơn hàng đã thanh toán trước đó -> kích hoạt ngay thành công thay vì báo lỗi
          if (isSubscribed) {
            triggerSuccess();
          }
          return;
        }

        if (isSubscribed) {
          setError(errMsg || 'Không thể tạo mã VietQR PayOS.');
        }
      } finally {
        if (isSubscribed) {
          setIsLoading(false);
        }
      }
    };

    initPayment();

    return () => {
      isSubscribed = false;
      isMountedRef.current = false;
    };
  }, [isOpen, order, triggerSuccess]);

  // Render QR Code (QRCode library or VietQR CDN fallback)
  useEffect(() => {
    if (!payosData) return;

    const amount = payosData.amount || order?.total || 0;
    const desc = payosData.description || order?.orderCode || '';

    if (payosData.qrCode) {
      QRCode.toDataURL(payosData.qrCode, {
        width: 380,
        margin: 1,
        color: {
          dark: '#0f172a',
          light: '#ffffff',
        },
        errorCorrectionLevel: 'M',
      })
        .then((url) => setQrDataUrl(url))
        .catch((err) => {
          console.warn('Lỗi vẽ QR, fallback sang ảnh VietQR CDN:', err);
          const fallback = `https://img.vietqr.io/image/${payosData.bin || '970422'}-${payosData.accountNumber}-compact2.png?amount=${amount}&addInfo=${encodeURIComponent(desc)}&accountName=${encodeURIComponent(payosData.accountName || 'WEBCAFE')}`;
          setQrDataUrl(fallback);
        });
    } else if (payosData.accountNumber) {
      const fallback = `https://img.vietqr.io/image/${payosData.bin || '970422'}-${payosData.accountNumber}-compact2.png?amount=${amount}&addInfo=${encodeURIComponent(desc)}&accountName=${encodeURIComponent(payosData.accountName || 'WEBCAFE')}`;
      setQrDataUrl(fallback);
    }
  }, [payosData, order]);

  // Realtime SignalR listener for Order status change
  useEffect(() => {
    if (!isOpen || !order || isPaid) return;

    const orderIdNum = order.id ? parseInt(order.id.replace(/\D/g, '')) : undefined;

    const handleStatusChanged = (changedOrderId: number, newStatus: string, orderCode?: string) => {
      const matchId = orderIdNum && changedOrderId === orderIdNum;
      const matchCode = order.orderCode && orderCode === order.orderCode;

      if (matchId || matchCode) {
        if (['paid', 'confirmed', 'completed'].includes(newStatus.toLowerCase())) {
          triggerSuccess();
        }
      }
    };

    signalRService.onOrderStatusChanged(handleStatusChanged);

    return () => {
      signalRService.offOrderStatusChanged(handleStatusChanged);
    };
  }, [isOpen, order, isPaid, triggerSuccess]);

  // Auto Polling Fallback every 2.5s
  useEffect(() => {
    if (!isOpen || isPaid || !payosData?.payOSOrderCode) return;

    const interval = setInterval(async () => {
      try {
        const statusRes = await paymentApi.getPayOSStatus(payosData.payOSOrderCode);
        if (
          statusRes?.isSuccess ||
          statusRes?.status === 'PAID' ||
          statusRes?.status === 'completed'
        ) {
          triggerSuccess();
          clearInterval(interval);
        }
      } catch (err) {
        console.warn('Polling PayOS status error:', err);
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [isOpen, isPaid, payosData?.payOSOrderCode, triggerSuccess]);

  // Handle Copy to Clipboard
  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 1800);
  };

  // Convert to Cash Fallback button
  const handleConvertToCash = async () => {
    if (!order || isConvertingCash || isPaid) return;

    setIsConvertingCash(true);
    try {
      const orderIdNum = order.id ? parseInt(order.id.replace(/\D/g, '')) : undefined;
      if (!orderIdNum || isNaN(orderIdNum)) {
        throw new Error('Mã đơn không hợp lệ để chuyển đổi.');
      }

      await paymentApi.processPayment({
        orderId: orderIdNum,
        method: 'cash',
        amount: order.total,
        transactionRef: `COUNTER-CASH-${order.orderCode}`,
      });

      triggerSuccess();
    } catch (err: any) {
      console.error('Lỗi chuyển đổi sang tiền mặt:', err);
      alert(err?.response?.data?.message || err?.message || 'Chuyển tiền mặt thất bại.', 'error', 'Thanh toán thất bại');
    } finally {
      setIsConvertingCash(false);
    }
  };

  if (!isOpen || !order) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/70 backdrop-blur-xs transition-opacity duration-300" 
        onClick={() => !isPaid && onClose()} 
      />

      {/* Modal Dialog */}
      <div className="relative bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl z-10 border border-outline-variant/20 animate-in zoom-in-95 duration-200">
        {/* Header Bar */}
        <div className="bg-gradient-to-r from-primary to-primary-container text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-2xl">qr_code_scanner</span>
            <div>
              <h2 className="text-base font-bold leading-tight">Thanh Toán VietQR PayOS</h2>
              <p className="text-xs text-white/80 font-medium">
                Đơn #{order.orderCode} · {order.tableNumber || 'Mang Về'}
              </p>
            </div>
          </div>
          {!isPaid && (
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors text-white"
            >
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          )}
        </div>

        {/* Modal Body */}
        <div className="p-6">
          {/* PAID SUCCESS STATE */}
          {isPaid ? (
            <div className="py-8 flex flex-col items-center justify-center text-center animate-in zoom-in duration-300">
              <div className="w-20 h-20 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mb-4 shadow-lg ring-8 ring-emerald-50 animate-bounce">
                <span className="material-symbols-outlined text-4xl font-black">check</span>
              </div>
              <h3 className="text-xl font-black text-gray-900 mb-1">Thanh Toán Thành Công!</h3>
              <p className="text-sm font-bold text-emerald-600 mb-3">
                Đã thu: {order.total.toLocaleString('vi-VN')} đ
              </p>
              <div className="inline-flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-2 rounded-xl text-xs font-semibold">
                <span className="material-symbols-outlined text-base animate-spin">sync</span>
                Đã kích hoạt đơn & gửi chuông thông báo sang Quầy Pha Chế!
              </div>
            </div>
          ) : isLoading ? (
            <div className="py-14 flex flex-col items-center justify-center space-y-3">
              <div className="w-10 h-10 border-3 border-primary/20 border-t-primary rounded-full animate-spin" />
              <p className="text-sm font-semibold text-gray-600">Đang tạo mã VietQR từ cổng PayOS...</p>
            </div>
          ) : error ? (
            <div className="py-6 space-y-4 text-center">
              <div className="w-14 h-14 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
                <span className="material-symbols-outlined text-2xl">error_outline</span>
              </div>
              <div>
                <p className="text-sm font-bold text-rose-700">{error}</p>
                <p className="text-xs text-gray-500 mt-1">
                  Khách có thể thanh toán trực tiếp bằng Tiền Mặt tại quầy bên dưới.
                </p>
              </div>
              <button
                onClick={handleConvertToCash}
                disabled={isConvertingCash}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined">payments</span>
                {isConvertingCash ? 'Đang xác nhận...' : 'Chuyển Sang Thu Tiền Mặt Ngay'}
              </button>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Amount Display */}
              <div className="bg-surface-container-low rounded-2xl p-3.5 flex items-center justify-between border border-outline-variant/15">
                <div>
                  <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">
                    Số Tiền Cần Thu
                  </span>
                  <span className="text-2xl font-black text-primary">
                    {(payosData?.amount || order.total).toLocaleString('vi-VN')} đ
                  </span>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                  Chờ quét mã
                </div>
              </div>

              {/* QR Box with Border Animation */}
              <div className="flex flex-col items-center justify-center">
                <div className="p-3 bg-white rounded-2xl border-2 border-primary/20 shadow-md relative group">
                  {qrDataUrl ? (
                    <img
                      src={qrDataUrl}
                      alt="VietQR PayOS"
                      className="w-60 h-60 object-contain rounded-lg"
                    />
                  ) : (
                    <div className="w-60 h-60 bg-gray-100 flex items-center justify-center text-xs text-gray-400">
                      Đang chuẩn bị QR...
                    </div>
                  )}

                  {/* Corner Accent Decor */}
                  <div className="absolute top-1 left-1 w-3 h-3 border-t-2 border-l-2 border-primary rounded-tl-sm pointer-events-none" />
                  <div className="absolute top-1 right-1 w-3 h-3 border-t-2 border-r-2 border-primary rounded-tr-sm pointer-events-none" />
                  <div className="absolute bottom-1 left-1 w-3 h-3 border-b-2 border-l-2 border-primary rounded-bl-sm pointer-events-none" />
                  <div className="absolute bottom-1 right-1 w-3 h-3 border-b-2 border-r-2 border-primary rounded-br-sm pointer-events-none" />
                </div>
                <p className="text-[11px] text-gray-500 font-medium mt-2 flex items-center gap-1">
                  <span className="material-symbols-outlined text-xs text-primary">verified</span>
                  Quét bằng mọi ứng dụng Ngân hàng (MB, Vietcombank, Techcombank, ...)
                </p>
              </div>

              {/* Bank Details Table */}
              <div className="bg-gray-50/80 rounded-2xl p-3.5 space-y-2 text-xs border border-gray-100">
                {/* Account Number */}
                <div className="flex items-center justify-between">
                  <span className="text-gray-500 font-medium">Số Tài Khoản (PayOS):</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-bold text-gray-900 text-sm">
                      {payosData?.accountNumber || '—'}
                    </span>
                    {payosData?.accountNumber && (
                      <button
                        onClick={() => handleCopy(payosData.accountNumber!, 'account')}
                        className="px-2 py-0.5 rounded-md bg-white border border-gray-200 text-primary font-bold text-[10px] hover:bg-gray-50 active:scale-95 transition-all"
                      >
                        {copiedField === 'account' ? '✓ Đã chép' : 'Sao chép'}
                      </button>
                    )}
                  </div>
                </div>

                {/* Account Name */}
                <div className="flex items-center justify-between">
                  <span className="text-gray-500 font-medium">Chủ Tài Khoản:</span>
                  <span className="font-bold text-gray-900 uppercase">
                    {payosData?.accountName || 'WEBCAFE COFFEE'}
                  </span>
                </div>

                {/* Transfer Content */}
                <div className="flex items-center justify-between">
                  <span className="text-gray-500 font-medium">Nội dung chuyển khoản:</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-bold text-primary text-xs">
                      {payosData?.description || order.orderCode}
                    </span>
                    <button
                      onClick={() =>
                        handleCopy(payosData?.description || order.orderCode || '', 'desc')
                      }
                      className="px-2 py-0.5 rounded-md bg-white border border-gray-200 text-primary font-bold text-[10px] hover:bg-gray-50 active:scale-95 transition-all"
                    >
                      {copiedField === 'desc' ? '✓ Đã chép' : 'Sao chép'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="pt-2 flex flex-col sm:flex-row gap-2.5">
                {/* Fallback to Cash Button */}
                <button
                  onClick={handleConvertToCash}
                  disabled={isConvertingCash}
                  className="flex-1 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-sm transition-all"
                  title="Nếu khách đổi ý hoặc ứng dụng ngân hàng bị lỗi, thu tiền mặt trực tiếp"
                >
                  <span className="material-symbols-outlined text-lg">payments</span>
                  <span>{isConvertingCash ? 'Đang xử lý...' : 'Khách Đổi Sang Tiền Mặt'}</span>
                </button>

                {/* Close Button */}
                <button
                  onClick={onClose}
                  className="py-3 px-4 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs sm:text-sm font-bold transition-all"
                >
                  Đóng
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
