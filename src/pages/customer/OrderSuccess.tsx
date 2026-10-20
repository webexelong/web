import { Link, useSearchParams } from 'react-router-dom';
import { useEffect, useState, useRef, useCallback } from 'react';
import MobileBottomNav from '../../components/MobileBottomNav';
import { useStore } from '../../store/useStore';
import { Copy, Check, ExternalLink, ShieldCheck, RefreshCw, CheckCircle2, Clock, Download, Landmark, Smartphone } from 'lucide-react';
import { trackPurchase } from '../../utils/analytics';
import { paymentApi, orderApi } from '../../api/apis';
import type { PayOSPaymentDto, OrderDto } from '../../types/apiTypes';
import QRCode from 'qrcode';

export default function OrderSuccess() {
  const [searchParams] = useSearchParams();
  const orderCodeParam = searchParams.get('code') || searchParams.get('orderCode');
  const orderIdParam = searchParams.get('orderId');

  const { activeOrder, guestSession, orders, initRealtime, currentStoreId } = useStore();

  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [payosData, setPayosData] = useState<PayOSPaymentDto | null>(null);
  const [isLoadingPayOS, setIsLoadingPayOS] = useState<boolean>(true);
  // The return URL is user-controlled. Only backend payment/order state is authoritative.
  const [isPaid, setIsPaid] = useState<boolean>(false);
  const [, setPollCount] = useState<number>(0);
  const [isManualChecking, setIsManualChecking] = useState<boolean>(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [fetchedOrder, setFetchedOrder] = useState<OrderDto | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef<boolean>(true);
  const hasInitiatedRef = useRef<boolean>(false);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);

  // Keep track of component mount state reliably across StrictMode
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Fetch full order by code if refreshing and activeOrder is not in memory
  useEffect(() => {
    if (!activeOrder && orderCodeParam) {
      orderApi.getOrderByCode(orderCodeParam)
        .then(res => {
          if (res) {
            setFetchedOrder(res);
            if (res.status === 'paid' || res.status === 'completed' || res.status === 'confirmed') {
              setIsPaid(true);
            }
          }
        })
        .catch(err => console.warn('Could not fetch order by code:', err));
    }
  }, [activeOrder, orderCodeParam]);

  // Resolve display order with fallbacks
  const displayOrder = activeOrder || (fetchedOrder ? {
    orderCode: fetchedOrder.orderCode,
    id: fetchedOrder.orderId.toString(),
    total: fetchedOrder.totalAmount,
    items: fetchedOrder.items.map(i => ({ name: i.menuItemName, quantity: i.quantity, price: i.unitPrice }))
  } : {
    orderCode: orderCodeParam || 'N/A',
    id: orderIdParam || '',
    total: 0,
    items: []
  });

  const effectiveOrderId = orderIdParam 
    ? parseInt(orderIdParam, 10) 
    : (activeOrder ? parseInt(activeOrder.id, 10) : (fetchedOrder ? fetchedOrder.orderId : null));

  const effectiveOrderCode = orderCodeParam || activeOrder?.orderCode || fetchedOrder?.orderCode || '';
  const paymentAccessToken = activeOrder?.rawDto?.paymentAccessToken
    || fetchedOrder?.paymentAccessToken
    || (effectiveOrderCode ? sessionStorage.getItem(`webcafe_payment_access_code_${effectiveOrderCode}`) || undefined : undefined)
    || (effectiveOrderId ? sessionStorage.getItem(`webcafe_payment_access_order_${effectiveOrderId}`) || undefined : undefined);

  // Initialize Realtime SignalR
  useEffect(() => {
    initRealtime(currentStoreId);
  }, [currentStoreId, initRealtime]);

  // Sync with store orders if status changes via SignalR
  useEffect(() => {
    if (orderCodeParam) {
      const match = orders.find(o => o.orderCode === orderCodeParam || o.id === orderCodeParam);
      if (match && (['confirmed', 'paid', 'completed'].includes(match.status)
        || ['confirmed', 'paid', 'completed'].includes(match.rawDto?.status || ''))) {
        setIsPaid(true);
      }
    }
  }, [orders, orderCodeParam]);

  // Handler to call PayOS API reliably
  const triggerInitPayOS = useCallback(async () => {
    const targetOrderId = effectiveOrderId && !isNaN(effectiveOrderId) ? effectiveOrderId : undefined;
    const targetOrderCode = effectiveOrderCode || undefined;

    if (!targetOrderId && !targetOrderCode) {
      setIsLoadingPayOS(false);
      return;
    }

    try {
      setIsLoadingPayOS(true);
      const codeForUrl = targetOrderCode || (targetOrderId ? `order-${targetOrderId}` : 'WC-ORDER');
      const returnUrl = `${window.location.origin}/order-success?orderId=${targetOrderId || ''}&code=${codeForUrl}`;
      const cancelUrl = `${window.location.origin}/cart?orderId=${targetOrderId || ''}&status=CANCELLED`;

      const res = await paymentApi.createPayOSPayment({
        orderId: targetOrderId,
        paymentAccessToken,
        orderCode: targetOrderCode,
        returnUrl,
        cancelUrl
      });

      if (isMountedRef.current && res) {
        setPayosData(res);
        if (res.status === 'PAID' || res.status === 'completed') {
          setIsPaid(true);
        }
      }
    } catch (err) {
      console.error('Lỗi khởi tạo PayOS payment link:', err);
    } finally {
      if (isMountedRef.current) {
        setIsLoadingPayOS(false);
      }
    }
  }, [effectiveOrderId, effectiveOrderCode, paymentAccessToken]);

  // Trigger PayOS Create Link on mount or when order id/code is resolved
  useEffect(() => {
    if (hasInitiatedRef.current) return;
    if (effectiveOrderId || effectiveOrderCode) {
      hasInitiatedRef.current = true;
      triggerInitPayOS();
    }
  }, [effectiveOrderId, effectiveOrderCode, triggerInitPayOS]);

  // Generate QR Code Image from PayOS EMVCo string payload or VietQR CDN
  useEffect(() => {
    if (!payosData) return;

    const totalAmount = payosData.amount || displayOrder.total || 0;
    const cleanDesc = payosData.description || `WC ${displayOrder.orderCode}`;

    if (payosData.qrCode) {
      // Chuỗi VietQR EMVCo chuẩn (00020101...) được render thành ảnh Base64
      QRCode.toDataURL(payosData.qrCode, {
        width: 380,
        margin: 1,
        color: {
          dark: '#111827',
          light: '#ffffff'
        },
        errorCorrectionLevel: 'M'
      })
      .then(url => {
        setQrDataUrl(url);
      })
      .catch(err => {
        console.warn('Lỗi vẽ QR bằng thư viện qrcode, dùng fallback VietQR CDN:', err);
        // Fallback sang link ảnh VietQR CDN
        const fallback = `https://img.vietqr.io/image/${payosData.bin || '970422'}-${payosData.accountNumber}-compact2.png?amount=${totalAmount}&addInfo=${encodeURIComponent(cleanDesc)}&accountName=${encodeURIComponent(payosData.accountName || 'WEBCAFE')}`;
        setQrDataUrl(fallback);
      });
    } else if (payosData.accountNumber) {
      const fallback = `https://img.vietqr.io/image/${payosData.bin || '970422'}-${payosData.accountNumber}-compact2.png?amount=${totalAmount}&addInfo=${encodeURIComponent(cleanDesc)}&accountName=${encodeURIComponent(payosData.accountName || 'WEBCAFE')}`;
      setQrDataUrl(fallback);
    }
  }, [payosData, displayOrder.orderCode, displayOrder.total]);

  // Auto-Polling Status Loop (every 2.5s while pending)
  useEffect(() => {
    if (isPaid || !payosData?.payOSOrderCode) return;

    const interval = setInterval(async () => {
      try {
        setPollCount(prev => prev + 1);
        const statusRes = await paymentApi.getPayOSStatus(payosData.payOSOrderCode, paymentAccessToken);
        if (statusRes?.isSuccess || statusRes?.status === 'PAID' || statusRes?.status === 'completed') {
          setIsPaid(true);
          clearInterval(interval);
        }
      } catch (err) {
        console.warn('Polling check PayOS status error:', err);
      }
    }, 2500);

    pollingRef.current = interval;

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [isPaid, payosData?.payOSOrderCode, paymentAccessToken]);

  // Manual Check Button Handler
  const handleManualCheck = async () => {
    if (!payosData?.payOSOrderCode || isManualChecking) return;
    setIsManualChecking(true);
    try {
      const res = await paymentApi.getPayOSStatus(payosData.payOSOrderCode, paymentAccessToken);
      if (res?.isSuccess || res?.status === 'PAID' || res?.status === 'completed') {
        setIsPaid(true);
      }
    } catch (err) {
      console.error('Lỗi kiểm tra trạng thái thanh toán:', err);
    } finally {
      setIsManualChecking(false);
    }
  };

  // Download QR Image
  const handleDownloadQr = async () => {
    if (!qrDataUrl || isDownloading) return;
    try {
      setIsDownloading(true);
      if (qrDataUrl.startsWith('data:image/')) {
        const link = document.createElement('a');
        link.href = qrDataUrl;
        link.download = `PayOS-VietQR-${displayOrder.orderCode}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        const response = await fetch(qrDataUrl);
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = `PayOS-VietQR-${displayOrder.orderCode}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(blobUrl);
      }
    } catch (e) {
      console.error('Download QR failed:', e);
      window.open(qrDataUrl, '_blank');
    } finally {
      setIsDownloading(false);
    }
  };

  // Tracking link
  const trackingUrl = guestSession 
    ? `${window.location.origin}/tracking?guestId=${guestSession.guestId}`
    : `${window.location.origin}/tracking?code=${displayOrder.orderCode}`;

  const copyToClipboard = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Confetti effect
  useEffect(() => {
    const createConfetti = () => {
      const container = document.getElementById('confetti-container');
      if (!container) return;
      
      const colors = ['#8B5CF6', '#A78BFA', '#C4B5FD', '#DDD6FE', '#10B981', '#34D399'];
      
      for (let i = 0; i < 35; i++) {
        const confetto = document.createElement('div');
        confetto.classList.add('confetti');
        confetto.style.left = Math.random() * 100 + '%';
        confetto.style.top = Math.random() * 100 + '%';
        confetto.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        confetto.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
        confetto.style.transform = `rotate(${Math.random() * 360}deg) scale(${Math.random() * 0.5 + 0.5})`;
        confetto.style.opacity = (Math.random() * 0.4 + 0.2).toString();
        
        confetto.animate([
            { transform: `translate(0, 0) rotate(0deg)`, opacity: 0.6 },
            { transform: `translate(${Math.random() * 60 - 30}px, ${Math.random() * -120 - 60}px) rotate(${Math.random() * 360}deg)`, opacity: 0 }
        ], {
            duration: 2500 + Math.random() * 2500,
            easing: 'cubic-bezier(0, .9, .57, 1)',
            fill: 'forwards'
        });

        container.appendChild(confetto);
      }
    };

    createConfetti();

    // GA4 track purchase
    if (displayOrder.orderCode && displayOrder.orderCode !== 'N/A') {
      try {
        trackPurchase({
          orderCode: displayOrder.orderCode,
          totalAmount: displayOrder.total || payosData?.amount || 0,
          items: displayOrder.items || [],
        });
      } catch {
        // Ignore if GA not initialized
      }
    }
  }, [displayOrder.orderCode, displayOrder.total, displayOrder.items, payosData?.amount, isPaid]);

  const totalAmount = payosData?.amount || displayOrder.total || 0;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center overflow-x-hidden bg-background font-body-md py-8">
      <style>{`
        .success-float {
            animation: float 3s ease-in-out infinite;
        }
        @keyframes float {
            0% { transform: translateY(0px); }
            50% { transform: translateY(-8px); }
            100% { transform: translateY(0px); }
        }
        .confetti {
            position: absolute;
            width: 8px;
            height: 8px;
            opacity: 0.3;
        }
      `}</style>

      {/* Main Container */}
      <main className="flex-grow flex items-center justify-center w-full px-container-margin py-stack-lg">
        <div className="max-w-xl w-full text-center space-y-6 relative">
          
          {/* Confetti Container */}
          <div className="absolute inset-0 pointer-events-none overflow-visible" id="confetti-container"></div>
          
          {/* Header Status Card */}
          <div className="relative inline-block mt-4">
            <div className={`w-36 h-36 md:w-44 md:h-44 ${isPaid ? 'bg-emerald-100 text-emerald-600' : 'bg-secondary-container text-primary'} rounded-full flex items-center justify-center success-float mx-auto shadow-md transition-colors duration-500`}>
              {isPaid ? (
                <CheckCircle2 className="w-20 h-20 md:w-24 md:h-24 text-emerald-600 animate-in zoom-in" />
              ) : (
                <span className="material-symbols-outlined text-[72px] md:text-[84px] text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>coffee</span>
              )}
              <div className={`absolute -top-1 -right-1 ${isPaid ? 'bg-emerald-600' : 'bg-primary'} w-12 h-12 md:w-14 md:h-14 rounded-full border-4 border-surface flex items-center justify-center shadow-lg transition-colors`}>
                <span className="material-symbols-outlined text-white text-2xl md:text-3xl font-bold">
                  {isPaid ? 'done_all' : 'check'}
                </span>
              </div>
            </div>
          </div>
          
          {/* Title Section */}
          <div className="space-y-2">
            <h2 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface font-bold">
              {isPaid ? 'Thanh Toán Thành Công! 🎉' : 'Đặt Món Thành Công! 🎉'}
            </h2>
            <p className="text-sm text-on-surface-variant max-w-md mx-auto">
              {isPaid 
                ? 'Đơn hàng của bạn đã được xác nhận thanh toán. Quán đang chuẩn bị đồ uống thơm ngon ngay!' 
                : 'Vui lòng quét mã QR PayOS bên dưới để hoàn tất thanh toán. Quán sẽ nhận đơn và tiến hành pha chế ngay khi bạn chuyển khoản thành công!'}
            </p>
            <div className="flex items-center justify-center gap-2 flex-wrap pt-2">
              <span className="text-xs text-on-surface-variant uppercase tracking-widest font-bold">Mã đơn hàng:</span>
              <span className="text-sm font-extrabold text-primary bg-primary-fixed px-3.5 py-1 rounded-full border border-primary/20">
                {displayOrder.orderCode}
              </span>
              {guestSession?.tableId && (
                <span className="text-xs font-bold text-on-surface-variant bg-surface-container-high px-3 py-1 rounded-full flex items-center gap-1">
                  <span className="material-symbols-outlined text-xs">table_restaurant</span>
                  Bàn {guestSession.tableId}
                </span>
              )}
            </div>
          </div>
          
          {/* Payment Status / QR Container */}
          {isPaid ? (
            <div className="bg-emerald-50 border-2 border-emerald-500/30 rounded-2xl p-6 text-center space-y-4 shadow-sm animate-in fade-in">
              <div className="flex items-center justify-center gap-2 text-emerald-700 font-bold text-lg">
                <ShieldCheck className="w-6 h-6 text-emerald-600" />
                <span>Giao dịch PayOS đã được bảo chứng & hoàn tất</span>
              </div>
              <p className="text-xs text-emerald-800">
                Số tiền: <strong className="text-base">{totalAmount.toLocaleString('vi-VN')}đ</strong> • Trạng thái: <span className="bg-emerald-200 text-emerald-900 px-2.5 py-0.5 rounded-full font-bold uppercase text-[11px]">Đã thanh toán</span>
              </p>
              <div className="pt-2">
                <Link
                  to={guestSession ? `/tracking?guestId=${guestSession.guestId}` : `/tracking?code=${displayOrder.orderCode}`}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-full font-bold text-sm shadow-md hover:bg-emerald-700 active:scale-95 transition-all"
                >
                  <span className="material-symbols-outlined text-base">receipt_long</span>
                  Theo dõi tiến độ pha chế trực tiếp
                </Link>
              </div>
            </div>
          ) : (
            <div className="bg-surface-container-lowest rounded-2xl p-6 border-2 border-primary/30 shadow-xl space-y-5 text-left relative z-10">
              {/* Header Box */}
              <div className="flex items-center justify-between border-b border-outline-variant/20 pb-4">
                <div>
                  <h3 className="font-bold text-lg text-on-surface flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">qr_code_2</span>
                    Chuyển Khoản Nhanh (PayOS 24/7)
                  </h3>
                  <p className="text-xs text-on-surface-variant flex items-center gap-1 mt-0.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-green-600" />
                    Hệ thống xác nhận tự động chỉ sau 3 giây
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-xs text-on-surface-variant">Tổng thanh toán</div>
                  <span className="text-2xl font-black text-primary">
                    {totalAmount.toLocaleString('vi-VN')}đ
                  </span>
                </div>
              </div>

              {/* QR Image & Banking details */}
              <div className="flex flex-col md:flex-row items-center gap-6">
                {/* QR Container */}
                <div className="bg-white p-3.5 rounded-2xl border border-outline-variant/30 shadow-sm flex-shrink-0 flex flex-col items-center">
                  {isLoadingPayOS ? (
                    <div className="w-52 h-52 flex flex-col items-center justify-center gap-3 text-on-surface-variant">
                      <RefreshCw className="w-8 h-8 animate-spin text-primary" />
                      <span className="text-xs font-medium">Đang tạo mã QR PayOS...</span>
                    </div>
                  ) : !qrDataUrl ? (
                    <div className="w-52 h-52 flex flex-col items-center justify-center gap-2 text-on-surface-variant text-center p-3">
                      <span className="material-symbols-outlined text-3xl text-secondary">error_outline</span>
                      <span className="text-xs font-medium">Chưa tải được mã QR</span>
                      <button
                        onClick={triggerInitPayOS}
                        className="mt-1 px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-bold hover:bg-primary/90 flex items-center gap-1 shadow-xs transition-all active:scale-95"
                      >
                        <RefreshCw size={12} />
                        <span>Thử tạo lại</span>
                      </button>
                    </div>
                  ) : (
                    <div className="relative group flex flex-col items-center">
                      <img 
                        src={qrDataUrl} 
                        alt="PayOS QR Code" 
                        className="w-52 h-52 object-contain rounded-xl shadow-xs"
                      />
                      <div className="text-center mt-2 text-[11px] font-bold text-primary flex items-center justify-center gap-1">
                        <span className="material-symbols-outlined text-xs">verified</span>
                        VietQR • PayOS Gateway
                      </div>
                      
                      {/* Download QR Button */}
                      <button
                        type="button"
                        onClick={handleDownloadQr}
                        disabled={isDownloading}
                        className="mt-2 text-[11px] font-bold text-primary hover:text-primary-container inline-flex items-center gap-1 transition-colors px-2.5 py-1 rounded-lg bg-surface-container-low hover:bg-surface-container-high disabled:opacity-50"
                        title="Tải ảnh mã QR về điện thoại hoặc máy tính"
                      >
                        <Download size={13} />
                        <span>{isDownloading ? 'Đang tải...' : 'Tải Ảnh Mã QR'}</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Transfer Info Details */}
                <div className="flex-grow space-y-2.5 w-full text-xs">
                  {/* Account Name */}
                  <div className="bg-surface p-3 rounded-xl border border-outline-variant/30 flex items-center justify-between">
                    <div>
                      <div className="text-[11px] text-on-surface-variant font-medium">Chủ tài khoản thụ hưởng</div>
                      <div className="font-bold text-on-surface text-sm uppercase">
                        {payosData?.accountName || (isLoadingPayOS ? 'Đang tải...' : 'Tài khoản quán')}
                      </div>
                    </div>
                  </div>

                  {/* PayOS Virtual Account (Recommended) */}
                  <div className="bg-surface p-3 rounded-xl border-2 border-primary/20 flex items-center justify-between">
                    <div>
                      <div className="text-[11px] font-bold text-primary flex items-center gap-1">
                        <Smartphone size={13} />
                        <span>Số tài khoản PayOS (Khuyên dùng - Duyệt tự động)</span>
                      </div>
                      <div className="font-extrabold text-primary text-base tracking-wider font-mono mt-0.5">
                        {payosData?.accountNumber || (isLoadingPayOS ? 'Đang tạo số tài khoản...' : 'Chưa có thông tin')}
                      </div>
                      <div className="text-[10px] text-on-surface-variant mt-0.5">
                        Ngân hàng: <strong>{payosData?.bin ? 'VietinBank / MB' : 'MBBank'}</strong> (Quét QR tự điền)
                      </div>
                    </div>
                    {payosData?.accountNumber && (
                      <button
                        onClick={() => copyToClipboard(payosData.accountNumber!, 'acc')}
                        className="p-1.5 hover:bg-surface-container-high rounded-lg text-primary transition-colors"
                        title="Sao chép số tài khoản PayOS"
                      >
                        {copiedField === 'acc' ? <Check size={16} className="text-green-600" /> : <Copy size={16} />}
                      </button>
                    )}
                  </div>

                  {/* Transfer Description */}
                  <div className="bg-surface p-3 rounded-xl border border-outline-variant/30 flex items-center justify-between">
                    <div>
                      <div className="text-[11px] text-on-surface-variant font-medium">Nội dung chuyển khoản (bắt buộc đúng)</div>
                      <div className="font-mono font-bold text-secondary text-sm">
                        {payosData?.description || `WC ${displayOrder.orderCode}`}
                      </div>
                    </div>
                    <button
                      onClick={() => copyToClipboard(payosData?.description || `WC ${displayOrder.orderCode}`, 'desc')}
                      className="p-1.5 hover:bg-surface-container-high rounded-lg text-primary transition-colors"
                      title="Sao chép nội dung"
                    >
                      {copiedField === 'desc' ? <Check size={16} className="text-green-600" /> : <Copy size={16} />}
                    </button>
                  </div>

                  {/* Store Actual Bank Account Info (Transparency Note) */}
                  {payosData?.storeBankAccount && (
                    <div className="p-2.5 rounded-xl bg-surface-container-low border border-outline-variant/20 text-[11px] space-y-1">
                      <div className="flex items-center gap-1 font-bold text-on-surface">
                        <Landmark size={13} className="text-secondary" />
                        <span>Tài khoản ngân hàng của Quán:</span>
                        <span className="font-mono text-primary font-extrabold">{payosData.storeBankAccount}</span>
                        <span className="text-on-surface-variant font-normal">({payosData.storeBankName || 'MB Bank'})</span>
                      </div>
                      <p className="text-[10px] text-on-surface-variant italic">
                        💡 Tiền bạn chuyển vào tài khoản PayOS sẽ được ngân hàng tự động chuyển thẳng vào tài khoản MB Bank của quán ngay lập tức.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons: Direct PayOS checkout & Manual Status check */}
              <div className="pt-2 flex flex-col sm:flex-row gap-3">
                {payosData?.checkoutUrl && (
                  <a
                    href={payosData.checkoutUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 py-3 px-4 bg-primary text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors shadow-sm"
                  >
                    <span>Mở Cổng Thanh Toán PayOS</span>
                    <ExternalLink size={14} />
                  </a>
                )}
                <button
                  onClick={handleManualCheck}
                  disabled={isManualChecking}
                  className="py-3 px-4 bg-surface-container-high text-on-surface rounded-xl font-bold text-xs flex items-center justify-center gap-2 hover:bg-surface-container-highest transition-colors disabled:opacity-50"
                >
                  <RefreshCw size={14} className={isManualChecking ? 'animate-spin' : ''} />
                  <span>{isManualChecking ? 'Đang kiểm tra...' : 'Tôi đã chuyển khoản (Kiểm tra ngay)'}</span>
                </button>
              </div>

              {/* Polling heartbeat indicator */}
              <div className="text-center pt-1">
                <div className="inline-flex items-center gap-1.5 text-[11px] text-on-surface-variant bg-surface-container-low px-3 py-1 rounded-full">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                  <span>Đang tự động đồng bộ trạng thái giao dịch theo thời gian thực...</span>
                </div>
              </div>
            </div>
          )}
          
          {/* Tracking Link Box */}
          <div className="bg-surface-container-lowest rounded-xl p-4 border border-outline-variant/30 space-y-2 text-left relative z-10">
            <p className="text-xs font-bold text-on-surface">Link theo dõi đơn hàng của bạn:</p>
            <div className="flex items-center gap-2">
              <input 
                type="text" 
                readOnly 
                value={trackingUrl}
                className="flex-1 px-3 py-2 bg-surface border border-outline-variant/40 rounded-lg text-xs text-on-surface-variant select-all"
              />
              <button
                onClick={() => copyToClipboard(trackingUrl, 'tracking')}
                className="p-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
                title="Sao chép link"
              >
                {copiedField === 'tracking' ? <Check size={16} /> : <Copy size={16} />}
              </button>
            </div>
          </div>
          
          {/* Preparation SLA Card */}
          <div className="bg-surface-container-lowest rounded-xl p-4 border border-outline-variant/30 shadow-sm text-left space-y-3 relative z-10">
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-secondary-container rounded-lg text-primary">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-on-surface-variant">Thời gian phục vụ dự kiến</p>
                <p className="text-sm text-on-surface font-bold">10 - 15 phút</p>
              </div>
            </div>
            
            <div className="h-px bg-outline-variant/20 w-full"></div>
            
            <p className="text-xs text-on-surface-variant leading-relaxed">
              Barista WebCafe đã nhận thông tin và đang chuẩn bị những ly đồ uống thơm ngon nhất cho bạn. 
            </p>
          </div>
          
          {/* Navigation Action Buttons */}
          <div className="pt-2 relative z-10">
            <Link 
              to="/" 
              className="w-full bg-primary hover:bg-primary/95 active:scale-[0.98] text-white font-bold text-sm py-3.5 rounded-full transition-all flex items-center justify-center gap-2 shadow-md shadow-primary/20"
            >
              <span className="material-symbols-outlined text-base">home</span>
              <span>Quay Về Trang Chủ</span>
            </Link>
          </div>
        </div>
      </main>

      <MobileBottomNav />
    </div>
  );
}
