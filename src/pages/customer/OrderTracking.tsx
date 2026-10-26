import { useSearchParams, Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import MobileBottomNav from '../../components/MobileBottomNav';
import { useStore, type Order } from '../../store/useStore';
import { orderApi } from '../../api/apis';

export default function OrderTracking() {
  const [searchParams] = useSearchParams();
  const codeParam = searchParams.get('code');
  const guestIdParam = searchParams.get('guestId');
  
  const { activeOrder, orders, initRealtime, currentStoreId, guestSession } = useStore();
  const [currentOrder, setCurrentOrder] = useState<Order | null>(activeOrder || null);

  useEffect(() => {
    initRealtime(currentStoreId);
  }, [currentStoreId]);

  useEffect(() => {
    // Priority 1: Active order in store
    if (activeOrder) {
      setCurrentOrder(activeOrder);
      return;
    }

    // Priority 2: Guest tracking by guestId
    if (guestIdParam || guestSession?.guestId) {
      const trackingGuestId = guestIdParam || guestSession?.guestId;
      const guestOrder = orders.find(o => o.rawDto?.guestId === trackingGuestId);
      if (guestOrder) {
        setCurrentOrder(guestOrder);
        return;
      }
      // TODO: Could add API call to fetch guest orders by guestId
    }

    // Priority 3: Order code lookup
    if (codeParam) {
      const match = orders.find(o => o.orderCode === codeParam || o.id === codeParam);
      if (match) {
        setCurrentOrder(match);
      } else {
        // Fetch from API
        orderApi.getOrderByCode(codeParam).then(dto => {
          if (dto) {
            const mapped: Order = {
              id: dto.orderId.toString(),
              orderCode: dto.orderCode,
              tableNumber: dto.tableNumber || 'Tại bàn',
              total: dto.totalAmount,
              status: (dto.status as any) || 'pending',
              createdAt: dto.createdAt,
              rawDto: dto,
              items: dto.items.map(i => ({
                id: i.menuItemId.toString(),
                name: i.menuItemName,
                description: '',
                price: i.unitPrice,
                image: i.imageUrl || '',
                categoryId: '',
                quantity: i.quantity,
                sizeName: i.sizeName || undefined,
                toppingNames: i.toppings?.map(t => t.toppingName),
                sugarLevel: i.sugarLevel,
                iceLevel: i.iceLevel,
                note: i.note || undefined,
              })),
            };
            setCurrentOrder(mapped);
          }
        }).catch(() => {});
      }
    } else if (orders.length > 0) {
      setCurrentOrder(orders[0]);
    }
  }, [codeParam, guestIdParam, activeOrder, orders, guestSession]);

  const status = currentOrder?.status || 'pending';
  const isAwaitingPayment = status === 'awaiting_payment';
  const isStep1 = true;
  const isStep2 = ['preparing', 'ready', 'served', 'completed', 'paid'].includes(status) && status !== 'confirmed' && status !== 'pending' && status !== 'awaiting_payment';
  const isStep3 = ['ready', 'served', 'completed', 'paid'].includes(status) && status !== 'confirmed' && status !== 'pending' && status !== 'awaiting_payment' && status !== 'preparing';
  const isStep4 = status === 'served' || status === 'completed' || status === 'paid';

  return (
    <div className="min-h-screen flex flex-col font-body-md text-body-md bg-background text-on-surface pb-24 md:pb-12">
      <style>{`
        .brewing-pulse {
          animation: pulse-ring 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        @keyframes pulse-ring {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: .5; transform: scale(1.1); }
        }
        .stepper-line {
          background: repeating-linear-gradient(90deg, #d4c3ba, #d4c3ba 4px, transparent 4px, transparent 8px);
        }
        .stepper-line-active {
          background: #553722;
        }
      `}</style>

      <main className="flex-grow max-w-7xl mx-auto w-full px-4 sm:px-6 md:px-8 py-4 sm:py-6">
        {!currentOrder ? (
          <div className="py-20 text-center flex flex-col items-center justify-center gap-4 bg-white rounded-3xl border border-outline-variant/20 p-8 shadow-sm">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-primary text-4xl">receipt_long</span>
            </div>
            <h2 className="font-headline-md text-headline-md text-on-surface font-bold">Bạn chưa có đơn hàng nào đang xử lý</h2>
            <p className="text-on-surface-variant max-w-md text-sm">
              Hãy chọn những món thức uống tuyệt hảo từ thực đơn của chúng tôi để bắt đầu trải nghiệm nhé!
            </p>
            <Link to="/menu" className="mt-2 px-8 py-3 bg-primary text-white rounded-full font-label-md font-bold shadow-md hover:bg-primary-container transition-all active:scale-95">
              Khám Phá Thực Đơn
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter">
            {/* Tracking Card */}
            <div className="lg:col-span-8 space-y-gutter">
              {isAwaitingPayment && (
                <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl flex items-center justify-between text-amber-900 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-amber-600 text-lg">schedule</span>
                    <span>Đơn hàng đang chờ thanh toán PayOS để gửi sang quầy Barista pha chế.</span>
                  </div>
                  <Link 
                    to={`/order-success?code=${currentOrder.orderCode}&orderId=${currentOrder.id}`}
                    className="font-bold underline text-primary hover:text-primary-container whitespace-nowrap ml-2"
                  >
                    Quét mã PayOS ngay
                  </Link>
                </div>
              )}

              <div className="bg-surface-container-lowest p-stack-lg rounded-xl shadow-sm border border-outline-variant/30">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-stack-lg">
                  <div>
                    <span className="text-label-sm font-label-sm text-on-surface-variant uppercase tracking-widest font-bold">
                      {status === 'awaiting_payment'
                        ? 'Đang Chờ Thanh Toán PayOS...'
                        : status === 'pending' 
                        ? 'Đã Tiếp Nhận Đơn Hàng' 
                        : status === 'confirmed' 
                        ? 'Đã Thanh Toán • Chờ Quầy Bar Nhận Đơn' 
                        : status === 'preparing' 
                        ? 'Đang Pha Chế Thức Uống' 
                        : status === 'ready' 
                        ? 'Món Đã Sẵn Sàng Phục Vụ' 
                        : status === 'served'
                        ? 'Đã Phục Vụ Tại Bàn'
                        : 'Đơn Hàng Đã Hoàn Thành'}
                    </span>
                    <h2 className="font-headline-lg text-headline-lg text-primary mt-1 font-bold">
                      Đơn hàng #{currentOrder.orderCode || currentOrder.id}
                    </h2>
                  </div>
                  <div className="bg-primary-fixed px-4 py-2 rounded-full">
                    <span className="text-on-primary-fixed font-label-md text-label-md font-bold">
                      {status === 'awaiting_payment'
                        ? 'Chờ thanh toán'
                        : status === 'pending' || status === 'confirmed'
                        ? 'Dự kiến: 10-15 phút' 
                        : status === 'preparing' 
                        ? 'Dự kiến: 5 phút nữa' 
                        : 'Đã chuẩn bị xong'}
                    </span>
                  </div>
                </div>
                
                {/* Order Timeline */}
                <div className="relative py-4">
                  <div className="flex justify-between items-start">
                    {/* Step 1: Received */}
                    <div className="flex flex-col items-center z-10 w-1/4 group">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white mb-3 shadow-md ${isStep1 ? 'bg-secondary' : 'bg-surface-container-high text-on-surface-variant'}`}>
                        <span className="material-symbols-outlined text-xl">check</span>
                      </div>
                      <span className={`text-label-md font-label-md text-center ${isStep1 ? 'text-secondary font-bold' : 'text-on-surface-variant'}`}>Đã tiếp nhận</span>
                      <span className="text-xs text-on-surface-variant mt-1">
                        {status === 'awaiting_payment'
                          ? 'Chờ thanh toán'
                          : status === 'confirmed' 
                          ? '✓ Đã TT PayOS' 
                          : 'Đã xác nhận'}
                      </span>
                    </div>

                    {/* Step 2: Preparing */}
                    <div className="flex flex-col items-center z-10 w-1/4 relative">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white mb-3 shadow-lg ${status === 'preparing' ? 'bg-primary brewing-pulse' : isStep2 ? 'bg-secondary' : 'bg-surface-container-high text-on-surface-variant border border-outline-variant'}`}>
                        <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>coffee_maker</span>
                      </div>
                      <span className={`text-label-md font-label-md text-center ${status === 'preparing' ? 'text-primary font-bold' : isStep2 ? 'text-secondary' : 'text-on-surface-variant'}`}>Đang pha chế</span>
                      <span className="text-xs text-primary font-semibold mt-1">{status === 'preparing' ? 'Hiện tại' : isStep2 ? 'Xong' : 'Chờ...'}</span>
                    </div>

                    {/* Step 3: Ready/Delivery */}
                    <div className="flex flex-col items-center z-10 w-1/4">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white mb-3 ${isStep3 ? 'bg-secondary shadow-md' : 'bg-surface-container-high text-on-surface-variant border border-outline-variant'}`}>
                        <span className="material-symbols-outlined text-xl">room_service</span>
                      </div>
                      <span className={`text-label-md font-label-md text-center ${isStep3 ? 'text-secondary font-bold' : 'text-on-surface-variant'}`}>Chờ nhận món</span>
                      <span className="text-xs text-on-surface-variant/50 mt-1">{isStep3 ? 'Sẵn sàng' : 'Chờ...'}</span>
                    </div>

                    {/* Step 4: Completed */}
                    <div className="flex flex-col items-center z-10 w-1/4">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white mb-3 ${isStep4 ? 'bg-primary shadow-md' : 'bg-surface-container-high text-on-surface-variant border border-outline-variant'}`}>
                        <span className="material-symbols-outlined text-xl">done_all</span>
                      </div>
                      <span className={`text-label-md font-label-md text-center ${isStep4 ? 'text-primary font-bold' : 'text-on-surface-variant'}`}>Hoàn thành</span>
                      <span className="text-xs text-on-surface-variant/50 mt-1">{isStep4 ? 'Đã giao' : 'Chờ...'}</span>
                    </div>
                    
                    {/* Background Lines */}
                    <div className="absolute top-9 left-[12.5%] right-[12.5%] h-0.5 flex">
                      <div className={`w-1/3 h-full ${isStep2 ? 'bg-secondary' : 'stepper-line'}`}></div>
                      <div className={`w-1/3 h-full ${isStep3 ? 'bg-secondary' : 'stepper-line'}`}></div>
                      <div className={`w-1/3 h-full ${isStep4 ? 'bg-primary' : 'stepper-line'}`}></div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Visual Content (Barista / Pickup Notice) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-gutter">
                <div className="relative rounded-xl overflow-hidden h-64 shadow-md group">
                  <div className="w-full h-full bg-cover bg-center transition-transform duration-700 group-hover:scale-105" style={{ backgroundImage: "url('https://lh3.googleusercontent.com/aida-public/AB6AXuC3hxd-jfwMD3YIX3VLUFcyyfMYWhFst6mfCZ7nwKdFgezcOvV8zm9t-1iZ0sxEUi9CRpNqNCNA0JJdyZPdtpE9AnghfDgmkFdkHMlMtP7oom2uFfNK3bCGIfUWxWpqZetZ5hXY9B5SgMeOuFJsmVemHqL735iW2i-VXh1WaqtdSG8VrrZVuPjXx3gu7kT_JHNG56pA00xH1c-Lc29bP7lM0_a9Yx2RdvBBwxzcegpkCstdnIv5aPdS')" }}></div>
                  <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/60 to-transparent">
                    <p className="text-white font-label-md text-label-md font-bold">Barista đang chuẩn bị đồ uống tươi ngon cho bạn</p>
                  </div>
                </div>
                <div className="relative rounded-xl overflow-hidden h-64 shadow-md border border-outline-variant bg-surface-container-low flex flex-col items-center justify-center p-6 text-center">
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                    <span className="material-symbols-outlined text-primary text-3xl">notifications_active</span>
                  </div>
                  <h3 className="font-headline-md text-primary font-bold mb-2">Phục vụ tại bàn: {currentOrder.tableNumber}</h3>
                  <p className="text-on-surface-variant font-body-md text-sm">Nhân viên sẽ mang đồ uống thơm ngon đến tận bàn của bạn ngay khi hoàn thành!</p>
                </div>
              </div>
            </div>
            
            {/* Order Details Sidebar */}
            <div className="lg:col-span-4 space-y-gutter">
              <div className="bg-surface-container-lowest p-stack-md rounded-xl shadow-sm border border-outline-variant/30 h-full">
                <h3 className="font-headline-md text-headline-md text-primary mb-stack-md font-bold">Chi tiết đơn hàng</h3>
                
                <div className="space-y-4 mb-stack-lg max-h-96 overflow-y-auto pr-1">
                  {currentOrder.items?.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center p-2 hover:bg-surface-container-low rounded-lg transition-all cursor-default">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-lg bg-primary-fixed flex items-center justify-center shrink-0">
                          <span className="material-symbols-outlined text-primary">coffee</span>
                        </div>
                        <div>
                          <p className="font-label-md text-label-md text-on-surface font-bold">
                            {item.name} {item.sizeName ? `(${item.sizeName})` : ''} x{item.quantity}
                          </p>
                          <p className="text-xs text-on-surface-variant">
                            {[item.sugarLevel ? `Đường ${item.sugarLevel}` : '', item.iceLevel ? `Đá ${item.iceLevel}` : '', item.note ? `"${item.note}"` : ''].filter(Boolean).join(', ')}
                          </p>
                        </div>
                      </div>
                      <span className="font-label-md text-label-md font-bold text-primary">
                        {(item.price * item.quantity).toLocaleString('vi-VN')}đ
                      </span>
                    </div>
                  ))}
                </div>
                
                {(() => {
                  const subTotal = currentOrder.rawDto?.subTotal 
                    || currentOrder.items?.reduce((sum, i) => sum + (i.price * i.quantity), 0) 
                    || currentOrder.total;
                  const discount = currentOrder.rawDto?.discountAmount || Math.max(0, subTotal - currentOrder.total);
                  const pointsUsed = currentOrder.rawDto?.pointsUsed || 0;

                  return (
                    <div className="border-t border-outline-variant/20 pt-stack-md space-y-2 text-sm">
                      <div className="flex justify-between text-on-surface-variant">
                        <span>Số lượng</span>
                        <span>{currentOrder.items?.reduce((acc, i) => acc + i.quantity, 0) || 1} món</span>
                      </div>
                      <div className="flex justify-between text-on-surface-variant">
                        <span>Tạm tính (Tiền món)</span>
                        <span>{subTotal.toLocaleString('vi-VN')}đ</span>
                      </div>
                      {discount > 0 && (
                        <div className="flex justify-between text-emerald-600 font-medium">
                          <span>
                            {pointsUsed > 0 ? `Ưu đãi & Điểm thưởng (${pointsUsed} điểm)` : 'Giảm giá ưu đãi'}
                          </span>
                          <span>-{discount.toLocaleString('vi-VN')}đ</span>
                        </div>
                      )}
                      <div className="flex justify-between font-bold text-base text-on-surface pt-2 border-t border-outline-variant/10">
                        <span>Tổng thanh toán</span>
                        <span className="text-primary text-lg font-bold">{currentOrder.total.toLocaleString('vi-VN')}đ</span>
                      </div>
                    </div>
                  );
                })()}

                <div className="mt-6">
                  <Link to="/menu" className="w-full py-3 bg-secondary-container text-on-secondary-container rounded-xl font-bold text-xs flex items-center justify-center gap-2 hover:opacity-90 transition-opacity">
                    <span className="material-symbols-outlined text-sm">add</span>
                    Đặt thêm món khác
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      <MobileBottomNav />
    </div>
  );
}
