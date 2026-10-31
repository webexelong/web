import { useStore } from '../../store/useStore';
import { Link, useNavigate } from 'react-router-dom';
import MobileBottomNav from '../../components/MobileBottomNav';
import { ShoppingCart } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useAuthStore } from '../../store/authStore';
import { customerApi, paymentApi } from '../../api/apis';
import { apiClient } from '../../api/apiClient';
import { voucherApi } from '../../api/apis';
import type { CustomerProfileDto } from '../../types/apiTypes';
import AuthModal from '../../components/AuthModal';

export default function Cart() {
  const {
    cart,
    updateQuantity,
    removeFromCart,
    createOrder,
    currentStoreId,
    currentTable,
    currentTableId,
    currentTableNumber,
    appliedVoucherCode,
    voucherDiscount,
    setVoucher,
    guestSession,
    updateGuestInfo
  } = useStore();

  const { isAuthenticated, user } = useAuthStore();
  const navigate = useNavigate();

  const [voucherInput, setVoucherInput] = useState('');
  const [voucherError, setVoucherError] = useState('');
  const [appliedVoucherDetail, setAppliedVoucherDetail] = useState<{
    code: string;
    title: string;
    discountType: 'percent' | 'fixed';
    discountAmount: number;
  } | null>(null);
  const [availableVouchers, setAvailableVouchers] = useState<any[]>([]);
  const [showVoucherList, setShowVoucherList] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  // Loyalty Points State
  const [customerProfile, setCustomerProfile] = useState<CustomerProfileDto | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [pointsInput, setPointsInput] = useState<string>('');
  const [pointsToUse, setPointsToUse] = useState<number>(0);
  const [pointsError, setPointsError] = useState<string>('');

  const cartCount = cart ? cart.reduce((acc, item) => acc + item.quantity, 0) : 0;
  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const discountAmount = appliedVoucherDetail
    ? appliedVoucherDetail.discountAmount
    : (voucherDiscount ? Math.round((subtotal * voucherDiscount) / 100) : 0);
  const serviceFee = cart.length > 0 ? 0 : 0;

  // Lấy thông tin điểm tích lũy của khách theo đúng quán đang ghé
  useEffect(() => {
    if (isAuthenticated && user?.username) {
      setLoadingProfile(true);
      const storeIdForProfile = guestSession?.storeId || currentStoreId;
      customerApi.getProfile({ phone: user.username, storeId: storeIdForProfile > 0 ? storeIdForProfile : undefined })
        .then(profile => {
          setCustomerProfile(profile);
          if (profile.phone && !customerPhone) {
            setCustomerPhone(profile.phone);
          }
          if (profile.name && !customerName) {
            setCustomerName(profile.name);
          }
        })
        .catch(err => {
          console.warn('Không thể tải điểm tích lũy:', err);
        })
        .finally(() => setLoadingProfile(false));
    } else {
      setCustomerProfile(null);
      setPointsToUse(0);
      setPointsInput('');
    }
  }, [isAuthenticated, user?.username, guestSession?.storeId, currentStoreId]);

  const pointsToMoney = customerProfile?.pointsToMoney || 200;
  const maxPointsByOrder = Math.floor(Math.max(0, subtotal - discountAmount) / pointsToMoney);
  const maxUsablePoints = Math.min(customerProfile?.totalPoints || 0, maxPointsByOrder);
  const pointsDiscountAmount = pointsToUse * pointsToMoney;
  const total = Math.max(0, subtotal - discountAmount - pointsDiscountAmount + serviceFee);

  useEffect(() => {
    const sId = currentStoreId || guestSession?.storeId || 1;
    const tId = (guestSession as any)?.tenantId || 1;
    voucherApi.getByStore(sId, tId).then((list: any[]) => setAvailableVouchers(list)).catch(() => {});
  }, [currentStoreId, guestSession]);

  const handleApplyVoucher = async (codeToApply?: string) => {
    const targetCode = (codeToApply || voucherInput).trim().toUpperCase();
    if (!targetCode) return;
    try {
      setVoucherError('');
      const sId = currentStoreId || guestSession?.storeId || 1;
      const res = await apiClient.post('/vouchers/validate', {
        code: targetCode,
        storeId: sId,
        orderAmount: subtotal,
        customerPhone: customerPhone || undefined
      });
      if (res.data?.success && res.data?.data?.isValid) {
        const v = res.data.data;
        setAppliedVoucherDetail({
          code: v.code,
          title: v.title,
          discountType: v.discountType,
          discountAmount: v.discountAmount
        });
        setVoucher(v.code, v.discountType === 'percent' ? Math.round((v.discountAmount / subtotal) * 100) : 0);
        setVoucherError('');
        setVoucherInput('');
        setShowVoucherList(false);
      } else {
        setVoucherError(res.data?.data?.message || res.data?.message || 'Mã ưu đãi không hợp lệ hoặc đã hết hạn.');
      }
    } catch (err: any) {
      setVoucherError(err.response?.data?.message || 'Mã ưu đãi không hợp lệ hoặc chưa đủ điều kiện.');
    }
  };

  const handleRemoveVoucher = () => {
    setAppliedVoucherDetail(null);
    setVoucher('', 0);
    setVoucherInput('');
    setVoucherError('');
  };

  const handleApplyPoints = (val: number) => {
    setPointsError('');
    if (isNaN(val) || val < 0) {
      setPointsToUse(0);
      setPointsInput('');
      return;
    }
    if (val > (customerProfile?.totalPoints || 0)) {
      setPointsError(`Bạn chỉ có tối đa ${customerProfile?.totalPoints || 0} điểm.`);
      return;
    }
    if (val > maxUsablePoints) {
      setPointsError(`Đơn hàng này chỉ có thể dùng tối đa ${maxUsablePoints} điểm.`);
      val = maxUsablePoints;
    }
    setPointsToUse(val);
    setPointsInput(val > 0 ? val.toString() : '');
  };

  const handleUseMaxPoints = () => {
    handleApplyPoints(maxUsablePoints);
  };

  const handleClearPoints = () => {
    setPointsToUse(0);
    setPointsInput('');
    setPointsError('');
  };

  const handleCheckout = async (paymentMethod: 'cash' | 'payos') => {
    if (cart.length === 0 || isSubmitting) return;
    setIsSubmitting(true);
    setCheckoutError('');
    try {
      if (guestSession) {
        updateGuestInfo(customerName, customerPhone);
      }

      const tableToUse = guestSession?.tableId || currentTableId || currentTable;
      if (!tableToUse) {
        setCheckoutError('Chưa xác định được số bàn của bạn. Vui lòng quét mã QR tại bàn trước khi đặt món.');
        setIsSubmitting(false);
        return;
      }
      const storeId = guestSession?.storeId || currentStoreId;
      if (paymentMethod === 'payos') {
        if (!storeId || storeId <= 0) {
          setCheckoutError('Không xác định được cửa hàng để kiểm tra thanh toán QR. Vui lòng chọn tiền mặt hoặc quét lại mã QR tại bàn.');
          return;
        }
        const hasPayOSConfigured = await paymentApi.getStorePayOSAvailability(storeId);
        if (!hasPayOSConfigured) {
          setCheckoutError('Quán chưa cấu hình thanh toán QR PayOS. Vui lòng chọn thanh toán tiền mặt.');
          return;
        }
      }
      const order = await createOrder(tableToUse, customerPhone, customerName, '', 'qr_table', paymentMethod, pointsToUse);
      navigate(`/order-success?code=${order.orderCode}&orderId=${order.id}&method=${paymentMethod}`);
    } catch (err: any) {
      console.error('Order creation error:', err);
      setCheckoutError(err?.response?.data?.message || err?.message || 'Không thể tạo đơn hàng. Vui lòng thử lại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="font-body-md text-on-surface custom-scrollbar py-stack-md">
      <main className="max-w-7xl mx-auto w-full px-container-margin">
        <div className="flex flex-col lg:flex-row gap-stack-lg">
          {/* Left Side: Cart Items & Payment */}
          <div className="flex-grow space-y-stack-lg">
            {/* Section Header */}
            <div className="flex items-center gap-stack-sm mb-stack-md">
              <button className="p-2 hover:bg-surface-container-high rounded-full transition-colors active:scale-90" onClick={() => window.history.back()}>
                <span className="material-symbols-outlined">arrow_back</span>
              </button>
              <h1 className="font-headline-lg text-headline-lg text-primary font-bold">Thanh Toán & Đặt Món</h1>
            </div>

            {/* Table Identification Card */}
            {(guestSession?.tableNumber || currentTableNumber || currentTable) ? (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex items-center justify-between shadow-xs">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-amber-500/20 text-amber-800 flex items-center justify-center">
                    <span className="material-symbols-outlined text-xl">table_restaurant</span>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-amber-800 uppercase tracking-wider">Vị trí phục vụ</div>
                    <div className="text-base font-bold text-amber-950">
                      {(guestSession?.tableNumber || currentTableNumber || currentTable)?.toLowerCase().includes('bàn')
                        ? (guestSession?.tableNumber || currentTableNumber || currentTable)
                        : `Bàn ${guestSession?.tableNumber || currentTableNumber || currentTable}`}
                      {guestSession?.storeName && <span className="text-xs font-normal text-amber-800 ml-2">({guestSession.storeName})</span>}
                    </div>
                  </div>
                </div>
                <span className="text-xs px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-900 font-bold">
                  Phục vụ tại bàn
                </span>
              </div>
            ) : (
              <div className="bg-error/10 border border-error/30 rounded-2xl p-4 flex items-center gap-3 shadow-xs text-error">
                <span className="material-symbols-outlined text-2xl">error</span>
                <div className="text-xs font-medium">
                  <strong>Chưa xác định được số bàn:</strong> Vui lòng quét mã QR đặt tại bàn của bạn để nhân viên mang món ra chính xác vị trí bạn ngồi.
                </div>
              </div>
            )}

            {/* Cart Items List */}
            <section className="space-y-stack-md">
              <h2 className="font-headline-md text-headline-md text-on-surface-variant border-b border-outline-variant/20 pb-2 font-bold">Đơn Hàng Của Bạn</h2>

              {cart.length === 0 ? (
                <div className="text-center py-16 flex flex-col items-center gap-4 bg-white rounded-2xl border border-outline-variant/20 p-8">
                  <span className="material-symbols-outlined text-[64px] text-outline-variant" style={{ fontVariationSettings: "'FILL' 1" }}>shopping_cart</span>
                  <h2 className="font-headline-md text-on-surface font-bold">Giỏ hàng của bạn đang trống.</h2>
                  <p className="text-on-surface-variant text-sm">Hãy khám phá các món đồ uống thơm ngon và thêm vào giỏ nhé!</p>
                  <Link to="/menu" className="px-8 py-3 bg-primary text-white rounded-full font-label-md shadow-md hover:bg-primary-container transition-all active:scale-95 font-bold mt-2">
                    Khám Phá Thực Đơn
                  </Link>
                </div>
              ) : (
                cart.map(item => {
                  const itemKey = item.cartItemId || `${item.id}-${item.sizeId}-${item.sugarLevel}-${item.iceLevel}`;
                  return (
                    <div key={itemKey} className="bg-surface-container-lowest p-4 rounded-xl shadow-[0_4px_20px_rgba(85,55,34,0.05)] border border-surface-variant flex items-center gap-4 group transition-all hover:shadow-[0_8px_30px_rgba(85,55,34,0.1)]">
                      <div className="w-24 h-24 rounded-lg overflow-hidden flex-shrink-0 bg-surface-container-low">
                        <img className="w-full h-full object-cover" src={item.image} alt={item.name} />
                      </div>
                      <div className="flex-grow">
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="font-headline-md text-label-md font-bold text-on-surface">{item.name}</h3>
                            <div className="text-xs text-on-surface-variant mt-1 flex flex-wrap gap-2">
                              {item.sizeName && <span className="px-2 py-0.5 bg-primary/10 text-primary rounded-md font-bold">Size: {item.sizeName}</span>}
                              {item.sugarLevel && <span>Đường: {item.sugarLevel}</span>}
                              {item.iceLevel && <span>Đá: {item.iceLevel}</span>}
                              {item.note && <span className="italic text-primary">"{item.note}"</span>}
                            </div>
                          </div>
                          <button
                            onClick={() => removeFromCart(item.cartItemId || item.id)}
                            className="text-error hover:bg-error/10 p-1.5 rounded-full transition-colors"
                            title="Xóa món"
                          >
                            <span className="material-symbols-outlined text-sm">delete</span>
                          </button>
                        </div>

                        <div className="flex justify-between items-center mt-4">
                          <div>
                            <span className="font-headline-md text-label-md text-primary font-bold">
                              {(item.price * item.quantity).toLocaleString('vi-VN')}đ
                            </span>
                            {item.quantity > 1 && (
                              <span className="text-xs text-on-surface-variant ml-2">
                                ({item.price.toLocaleString('vi-VN')}đ / ly)
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2 bg-surface-variant/40 rounded-full px-2 py-1">
                            <button
                              onClick={() => updateQuantity(item.cartItemId || item.id, item.quantity - 1)}
                              className="w-6 h-6 rounded-full bg-white flex items-center justify-center text-primary shadow-xs hover:bg-primary hover:text-white transition-colors"
                            >
                              <span className="material-symbols-outlined text-xs">remove</span>
                            </button>
                            <span className="text-xs font-bold w-4 text-center">{item.quantity}</span>
                            <button
                              onClick={() => updateQuantity(item.cartItemId || item.id, item.quantity + 1)}
                              className="w-6 h-6 rounded-full bg-white flex items-center justify-center text-primary shadow-xs hover:bg-primary hover:text-white transition-colors"
                            >
                              <span className="material-symbols-outlined text-xs">add</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </section>

          </div>

          {/* Right Side: Order Summary */}
          {cart.length > 0 && (
            <div className="w-full lg:w-96 flex-shrink-0 space-y-stack-md">
              <div className="bg-surface-container-lowest p-6 rounded-2xl shadow-md border border-outline-variant/20 sticky top-24 space-y-4">
                <h3 className="font-headline-md text-headline-md font-bold text-primary border-b border-outline-variant/20 pb-3">
                  Tóm Tắt Đơn Hàng
                </h3>

                {/* Voucher Box */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-on-surface-variant flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm">local_offer</span>
                      <span>Mã Giảm Giá</span>
                    </label>
                    {availableVouchers.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setShowVoucherList(!showVoucherList)}
                        className="text-[11px] font-bold text-primary dark:text-[#E8B98A] hover:underline flex items-center gap-0.5"
                      >
                        <span>{showVoucherList ? 'Ẩn mã' : 'Xem ưu đãi (' + availableVouchers.length + ')'}</span>
                        <span className="material-symbols-outlined text-xs">
                          {showVoucherList ? 'expand_less' : 'expand_more'}
                        </span>
                      </button>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Nhập mã ưu đãi (VD: BANMOI20)"
                      className="flex-grow px-3 py-2 bg-surface dark:bg-[#1E1714] border border-outline-variant/40 dark:border-white/10 rounded-xl text-xs uppercase font-mono font-bold text-on-surface dark:text-[#F8F4EE] placeholder:normal-case placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-primary/20"
                      value={voucherInput}
                      onChange={(e) => setVoucherInput(e.target.value.toUpperCase().replace(/\s+/g, ''))}
                      onKeyDown={(e) => e.key === 'Enter' && handleApplyVoucher()}
                    />
                    <button
                      type="button"
                      onClick={() => handleApplyVoucher()}
                      className="px-4 py-2 bg-primary hover:bg-primary-container text-white rounded-xl text-xs font-bold transition-all active:scale-95 shadow-xs"
                    >
                      Áp Dụng
                    </button>
                  </div>

                  {/* Applied Voucher Card */}
                  {(appliedVoucherDetail || appliedVoucherCode) && (
                    <div className="flex items-center justify-between p-2.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/40 rounded-xl mt-2 animate-in fade-in">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-emerald-600 dark:text-emerald-400 text-lg">check_circle</span>
                        <div>
                          <p className="text-xs font-mono font-bold text-emerald-800 dark:text-emerald-300">
                            Mã: {appliedVoucherDetail?.code || appliedVoucherCode}
                          </p>
                          <p className="text-[11px] text-emerald-700/80 dark:text-emerald-400 font-medium">
                            {appliedVoucherDetail
                              ? 'Giảm -' + appliedVoucherDetail.discountAmount.toLocaleString('vi-VN') + 'đ'
                              : 'Giảm -' + voucherDiscount + '%'}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleRemoveVoucher}
                        className="text-[11px] text-red-500 hover:text-red-700 dark:text-red-400 font-bold px-2 py-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 transition"
                      >
                        Gỡ mã
                      </button>
                    </div>
                  )}

                  {voucherError && (
                    <p className="text-xs text-red-500 font-semibold mt-1.5 flex items-center gap-1">
                      <span className="material-symbols-outlined text-xs">error</span>
                      <span>{voucherError}</span>
                    </p>
                  )}

                  {/* Available Vouchers Dropdown List */}
                  {showVoucherList && availableVouchers.length > 0 && (
                    <div className="mt-2.5 space-y-1.5 p-2 bg-surface-container-low dark:bg-[#1E1714] rounded-xl border border-outline-variant/30 dark:border-white/10 max-h-48 overflow-y-auto animate-in fade-in">
                      <p className="text-[10px] uppercase font-bold text-on-surface-variant dark:text-[#A4968C] px-1">
                        Mã ưu đãi đang áp dụng cho quán:
                      </p>
                      {availableVouchers.map((v) => (
                        <div
                          key={v.voucherId}
                          onClick={() => handleApplyVoucher(v.code)}
                          className="flex items-center justify-between p-2 bg-surface dark:bg-[#241C18] hover:border-primary border border-outline-variant/20 dark:border-white/5 rounded-lg cursor-pointer transition group"
                        >
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono font-bold text-xs text-primary dark:text-[#E8B98A] group-hover:underline">
                                {v.code}
                              </span>
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-400 font-bold">
                                {v.discountType === 'percent' ? '-' + v.discountValue + '%' : '-' + v.discountValue.toLocaleString('vi-VN') + 'đ'}
                              </span>
                            </div>
                            <p className="text-[10px] text-on-surface-variant dark:text-[#A4968C] line-clamp-1">
                              {v.title}
                            </p>
                          </div>
                          <span className="text-[11px] font-bold text-primary dark:text-[#E8B98A] opacity-0 group-hover:opacity-100 transition">
                            Dùng
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Loyalty Points Section */}
                <div className="pt-3 border-t border-outline-variant/20">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-on-surface-variant flex items-center gap-1">
                      <span className="material-symbols-outlined text-amber-500 text-base" style={{ fontVariationSettings: "'FILL' 1" }}>stars</span>
                      Điểm Tích Lũy {customerProfile?.tenantName ? `(${customerProfile.tenantName})` : ''}
                    </label>
                    {isAuthenticated && customerProfile && (
                      <span className="text-[11px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                        Có: {customerProfile.totalPoints.toLocaleString()} điểm
                      </span>
                    )}
                  </div>

                  {isAuthenticated ? (
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <input
                          type="number"
                          placeholder={maxUsablePoints > 0 ? `Tối đa ${maxUsablePoints} điểm` : '0 điểm'}
                          className="flex-grow px-3 py-2 bg-surface border border-outline-variant/40 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                          value={pointsInput}
                          onChange={(e) => handleApplyPoints(parseInt(e.target.value) || 0)}
                          min={0}
                          max={maxUsablePoints}
                          disabled={maxUsablePoints === 0}
                        />
                        {maxUsablePoints > 0 && pointsToUse < maxUsablePoints && (
                          <button
                            type="button"
                            onClick={handleUseMaxPoints}
                            className="px-3 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition-colors whitespace-nowrap shadow-sm"
                          >
                            Dùng Hết
                          </button>
                        )}
                        {pointsToUse > 0 && (
                          <button
                            type="button"
                            onClick={handleClearPoints}
                            className="px-2.5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition-colors"
                            title="Bỏ dùng điểm"
                          >
                            ✕
                          </button>
                        )}
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-on-surface-variant">
                        <span>Quy đổi: 1 điểm = {pointsToMoney.toLocaleString()}đ</span>
                        {pointsToUse > 0 && (
                          <span className="text-green-600 font-bold">
                            -{(pointsToUse * pointsToMoney).toLocaleString()}đ
                          </span>
                        )}
                      </div>

                      {pointsError && (
                        <p className="text-xs text-error font-semibold">{pointsError}</p>
                      )}

                      {pointsToUse > 0 && (
                        <p className="text-xs text-green-600 font-bold flex items-center gap-1">
                          <span className="material-symbols-outlined text-xs">check_circle</span>
                          Đã dùng {pointsToUse.toLocaleString()} điểm (-{(pointsToUse * pointsToMoney).toLocaleString()}đ)
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="p-3 bg-amber-50/80 border border-amber-200/90 rounded-xl text-xs space-y-2">
                      <div className="flex items-start gap-2 text-amber-900">
                        <span className="material-symbols-outlined text-sm text-amber-600 mt-0.5">lock</span>
                        <span>Đăng nhập để xem số điểm hiện có và dùng điểm trừ tiền trực tiếp vào đơn hàng.</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsAuthModalOpen(true)}
                        className="w-full py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-bold text-xs transition-colors flex items-center justify-center gap-1 shadow-sm"
                      >
                        <span className="material-symbols-outlined text-xs">login</span>
                        Đăng Nhập Dùng Điểm
                      </button>
                    </div>
                  )}
                </div>

                {/* Price Breakdown */}
                <div className="space-y-2 pt-3 border-t border-outline-variant/20 text-sm">
                  <div className="flex justify-between text-on-surface-variant">
                    <span>Tạm tính ({cartCount} món)</span>
                    <span className="font-bold">{subtotal.toLocaleString('vi-VN')}đ</span>
                  </div>
                  {discountAmount > 0 && (
                    <div className="flex justify-between text-green-600 font-bold">
                      <span>Giảm giá voucher</span>
                      <span>-{discountAmount.toLocaleString('vi-VN')}đ</span>
                    </div>
                  )}
                  {pointsDiscountAmount > 0 && (
                    <div className="flex justify-between text-amber-600 font-bold">
                      <span>Giảm từ điểm tích lũy</span>
                      <span>-{pointsDiscountAmount.toLocaleString('vi-VN')}đ</span>
                    </div>
                  )}
                  <div className="flex justify-between text-on-surface font-extrabold text-base pt-2 border-t border-outline-variant/20">
                    <span>Tổng thanh toán</span>
                    <span className="text-primary text-xl font-bold">{total.toLocaleString('vi-VN')}đ</span>
                  </div>
                </div>

                {checkoutError && (
                  <p role="alert" className="mt-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
                    {checkoutError}
                  </p>
                )}
                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <button
                    onClick={() => handleCheckout('cash')}
                    disabled={isSubmitting}
                    className="w-full rounded-2xl border border-primary/30 bg-surface px-4 py-4 text-primary font-bold hover:bg-primary/5 transition-all active:scale-[0.99] disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined block mb-1">payments</span>
                    {isSubmitting ? 'Đang gửi đơn...' : 'Đặt món, trả tiền mặt'}
                  </button>
                  <button
                    onClick={() => handleCheckout('payos')}
                    disabled={isSubmitting}
                    className="w-full rounded-2xl bg-primary px-4 py-4 text-white font-bold hover:bg-primary-container transition-all active:scale-[0.99] shadow-lg disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined block mb-1">qr_code_2</span>
                    {isSubmitting ? 'Đang gửi đơn...' : 'Thanh toán QR PayOS'}
                  </button>
                </div>
                <p className="mt-2 text-center text-xs text-on-surface-variant">
                  Tiền mặt: nhân viên nhận đơn ngay, bạn thanh toán tại quán. QR: quét mã sau khi đặt món thành công.
                </p>
              </div>
            </div>
          )}
        </div>
      </main>
      <MobileBottomNav />

      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
    </div>
  );
}
