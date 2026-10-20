import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore, type MenuItem, type Order } from '../../store/useStore';
import { useAuthStore } from '../../store/authStore';
import Pagination from '../../components/Pagination';
import { PayOSCounterModal } from '../../components/staff/PayOSCounterModal';
import ReceiptPrintModal from '../../components/print/ReceiptPrintModal';
import type { ReceiptData } from '../../services/printService';

interface PosCartItem {
  cartId: string;
  item: MenuItem;
  quantity: number;
  sizeName: string;
  sizeExtra: number;
  sugarLevel: string;
  iceLevel: string;
  note: string;
}

export default function NewOrder() {
  const navigate = useNavigate();
  const user = useAuthStore(state => state.user);
  const { 
    menuItems, 
    categories, 
    fetchMenu, 
    currentStoreId, 
    createOrder 
  } = useStore();

  const [activeCategory, setActiveCategory] = useState<string>('Tất Cả');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 8;

  const [orderType, setOrderType] = useState<'Dine-in' | 'Takeaway'>('Dine-in');
  const [selectedTable, setSelectedTable] = useState<string>('T01');
  const [posCart, setPosCart] = useState<PosCartItem[]>([]);
  const [isMobileCartOpen, setIsMobileCartOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittingAction, setSubmittingAction] = useState<'cash' | 'payos' | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Print Receipt Modal State
  const [printReceiptData, setPrintReceiptData] = useState<ReceiptData | null>(null);
  const [showPrintModal, setShowPrintModal] = useState(false);

  // PayOS Counter Modal State
  const [payOSModalOpen, setPayOSModalOpen] = useState(false);
  const [currentPayOSOrder, setCurrentPayOSOrder] = useState<Order | null>(null);

  // Customization Modal State
  const [customizingItem, setCustomizingItem] = useState<MenuItem | null>(null);
  const [modalSize, setModalSize] = useState<'Medium' | 'Large'>('Medium');
  const [modalSugar, setModalSugar] = useState<string>('100%');
  const [modalIce, setModalIce] = useState<string>('100%');
  const [modalNote, setModalNote] = useState<string>('');
  const [modalQuantity, setModalQuantity] = useState<number>(1);

  // Stock status for current branch
  const [stockStatus, setStockStatus] = useState<{ [id: string]: boolean }>({});

  useEffect(() => {
    fetchMenu(currentStoreId);

    const loadStock = () => {
      const saved = localStorage.getItem(`webcafe_stock_store_${currentStoreId}`);
      setStockStatus(saved ? JSON.parse(saved) : {});
    };

    loadStock();
    window.addEventListener('storage', loadStock);
    return () => window.removeEventListener('storage', loadStock);
  }, [currentStoreId]);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeCategory, searchQuery]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };
  const openCustomizeModal = (item: MenuItem, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }

    const isOutOfStock = stockStatus[item.id.toString()] === false;
    if (isOutOfStock) {
      showToast(`Món ${item.name} đang tạm hết tại quán!`);
      return;
    }

    setCustomizingItem(item);
    setModalSize('Medium');
    setModalSugar('100%');
    setModalIce('100%');
    setModalNote('');
    setModalQuantity(1);
  };

  const handleAddCustomizedItem = () => {
    if (!customizingItem) return;

    const sizeExtra = modalSize === 'Large' ? 15000 : 0;
    const cartId = `${customizingItem.id}_${modalSize}_${modalSugar}_${modalIce}_${modalNote.trim()}`;

    setPosCart(prev => {
      const existingIdx = prev.findIndex(p => p.cartId === cartId);
      if (existingIdx > -1) {
        const updated = [...prev];
        updated[existingIdx].quantity += modalQuantity;
        return updated;
      } else {
        return [...prev, {
          cartId,
          item: customizingItem,
          quantity: modalQuantity,
          sizeName: modalSize,
          sizeExtra,
          sugarLevel: modalSugar,
          iceLevel: modalIce,
          note: modalNote.trim(),
        }];
      }
    });

    showToast(`Đã thêm ${modalQuantity}x ${customizingItem.name}`);
    setCustomizingItem(null);
  };

  const handleUpdateQuantity = (index: number, delta: number, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }

    setPosCart(prev => {
      const updated = [...prev];
      const newQty = updated[index].quantity + delta;
      if (newQty <= 0) {
        return updated.filter((_, i) => i !== index);
      }
      updated[index].quantity = newQty;
      return updated;
    });
  };

  const handleClearCart = () => {
    setPosCart([]);
  };

  // Calculations
  const subTotal = posCart.reduce((sum, ci) => {
    const unitPrice = (ci.item.price || 0) + ci.sizeExtra;
    return sum + (unitPrice * ci.quantity);
  }, 0);

  const totalItemsCount = posCart.reduce((sum, ci) => sum + ci.quantity, 0);

  // 1-Click Cash Payment Checkout (F2)
  const handleCashCheckout = async () => {
    if (posCart.length === 0) {
      showToast('Vui lòng chọn ít nhất 1 món!');
      return;
    }

    setIsSubmitting(true);
    setSubmittingAction('cash');
    try {
      useStore.setState({
        cart: posCart.map(ci => ({
          ...ci.item,
          quantity: ci.quantity,
          sizeName: ci.sizeName,
          price: (ci.item.price || 0) + ci.sizeExtra,
          sugarLevel: ci.sugarLevel,
          iceLevel: ci.iceLevel,
          note: ci.note,
        }))
      });

      const tableIdentifier = orderType === 'Dine-in' ? selectedTable : 'Mang Về';
      const itemsSnapshot = [...posCart];
      const subTotalSnapshot = subTotal;

      const createdOrder = await createOrder(
        tableIdentifier, 
        undefined, 
        'Khách tại quầy', 
        `${orderType === 'Takeaway' ? '[Mang Về]' : `[Tại Bàn ${selectedTable}]`} POS Thu Tiền Mặt`,
        'pos_staff',
        'cash'
      );
      
      showToast('Đã thu tiền mặt! Mở phiếu in...');
      setPosCart([]);
      setIsMobileCartOpen(false);

      const receiptData: ReceiptData = {
        orderCode: createdOrder?.orderCode || `ORD-${Date.now()}`,
        tableNumber: tableIdentifier,
        customerName: 'Khách tại quầy',
        staffName: user?.fullName || 'Thu ngân',
        createdAt: new Date().toISOString(),
        items: itemsSnapshot.map(ci => ({
          name: ci.item.name,
          quantity: ci.quantity,
          price: (ci.item.price || 0) + ci.sizeExtra,
          totalPrice: ((ci.item.price || 0) + ci.sizeExtra) * ci.quantity,
          sizeName: ci.sizeName,
          sugarLevel: ci.sugarLevel,
          iceLevel: ci.iceLevel,
          note: ci.note,
        })),
        subTotal: subTotalSnapshot,
        totalAmount: subTotalSnapshot,
        paymentMethod: 'cash',
        paymentStatus: 'paid',
        storeInfo: {
          storeName: user?.storeName || 'WebCafe Quán',
          brandName: user?.brandName || 'AI-SMARTSERVE',
        },
      };

      setPrintReceiptData(receiptData);
      setShowPrintModal(true);
    } catch (err: any) {
      console.error('POS Cash order failed:', err);
      showToast('Đã ghi nhận đơn hàng tại quầy!');
      setPosCart([]);
      setIsMobileCartOpen(false);
    } finally {
      setIsSubmitting(false);
      setSubmittingAction(null);
    }
  };

  // PayOS QR Checkout Flow (F4)
  const handlePayOSCheckout = async () => {
    if (posCart.length === 0) {
      showToast('Vui lòng chọn ít nhất 1 món!');
      return;
    }

    setIsSubmitting(true);
    setSubmittingAction('payos');
    try {
      useStore.setState({
        cart: posCart.map(ci => ({
          ...ci.item,
          quantity: ci.quantity,
          sizeName: ci.sizeName,
          price: (ci.item.price || 0) + ci.sizeExtra,
          sugarLevel: ci.sugarLevel,
          iceLevel: ci.iceLevel,
          note: ci.note,
        }))
      });

      const tableIdentifier = orderType === 'Dine-in' ? selectedTable : 'Mang Về';
      const createdOrder = await createOrder(
        tableIdentifier, 
        undefined, 
        'Khách tại quầy', 
        `${orderType === 'Takeaway' ? '[Mang Về]' : `[Tại Bàn ${selectedTable}]`} POS Quét VietQR PayOS`,
        'pos_staff',
        'payos'
      );
      
      setCurrentPayOSOrder(createdOrder);
      setPayOSModalOpen(true);
      setPosCart([]);
      setIsMobileCartOpen(false);
    } catch (err: any) {
      console.error('POS PayOS order failed:', err);
      showToast('Không thể tạo đơn PayOS: ' + (err?.message || 'Lỗi kết nối'));
    } finally {
      setIsSubmitting(false);
      setSubmittingAction(null);
    }
  };

  const handlePayOSSuccess = (paidOrder: Order) => {
    showToast('Thanh toán PayOS thành công! Mở phiếu in...');
    setPayOSModalOpen(false);

    const receiptData: ReceiptData = {
      orderCode: paidOrder.orderCode || paidOrder.id,
      tableNumber: paidOrder.tableNumber,
      customerName: 'Khách tại quầy',
      staffName: user?.fullName || 'Thu ngân',
      createdAt: paidOrder.createdAt || new Date().toISOString(),
      items: (paidOrder.items || []).map(i => ({
        name: i.name,
        quantity: i.quantity,
        price: i.price,
        totalPrice: i.price * i.quantity,
        sizeName: i.sizeName,
        sugarLevel: i.sugarLevel,
        iceLevel: i.iceLevel,
        note: i.note,
      })),
      subTotal: paidOrder.total,
      totalAmount: paidOrder.total,
      paymentMethod: 'payos',
      paymentStatus: 'paid',
      storeInfo: {
        storeName: user?.storeName || 'WebCafe Quán',
        brandName: user?.brandName || 'AI-SMARTSERVE',
      },
    };

    setPrintReceiptData(receiptData);
    setShowPrintModal(true);
    setCurrentPayOSOrder(null);
  };

  // Keyboard Shortcuts (F2: Cash, F4: PayOS)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }
      if (payOSModalOpen || customizingItem) return;

      if (e.key === 'F2') {
        e.preventDefault();
        handleCashCheckout();
      } else if (e.key === 'F4') {
        e.preventDefault();
        handlePayOSCheckout();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [posCart, isSubmitting, payOSModalOpen, customizingItem, orderType, selectedTable]);

  // Filter & Pagination
  const filteredItems = menuItems.filter(item => {
    const matchCat = activeCategory === 'Tất Cả' || (item.categoryName || item.categoryId || '').includes(activeCategory);
    const matchSearch = !searchQuery || item.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCat && matchSearch;
  });

  const totalPages = Math.ceil(filteredItems.length / PAGE_SIZE);
  const paginatedItems = filteredItems.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  return (
    <div className="w-full max-w-[1600px] mx-auto -m-3 sm:-m-6 md:-m-8 flex flex-col lg:flex-row h-[calc(100vh-3.5rem)] sm:h-[calc(100vh-4rem)] overflow-hidden bg-background">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 bg-primary text-white text-xs sm:text-sm font-bold px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2 animate-bounce">
          <span className="material-symbols-outlined text-lg">check_circle</span>
          {toastMessage}
        </div>
      )}

      {/* Left Section: Menu Catalog */}
      <section className="flex-1 flex flex-col h-full overflow-hidden p-3 sm:p-5 lg:p-6 pb-24 lg:pb-6">
        {/* Top Control Bar: Search & Categories */}
        <div className="space-y-3 mb-3 shrink-0">
          <div className="flex items-center justify-between gap-3">
            <div className="relative flex-1">
              <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant text-base">search</span>
              <input 
                type="text" 
                placeholder="Tìm nhanh món theo tên..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-white rounded-xl border border-outline-variant/20 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 shadow-xs"
              />
            </div>
            <div className="text-[11px] font-bold text-on-surface-variant shrink-0 bg-surface-container-low px-2.5 py-1.5 rounded-xl border border-outline-variant/15">
              {user?.storeName || user?.brandName || `Quán #${currentStoreId}`}
            </div>
          </div>

          {/* Category Chips Scroller */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 hide-scrollbar">
            <button
              onClick={() => setActiveCategory('Tất Cả')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                activeCategory === 'Tất Cả' ? 'bg-primary text-white shadow-xs' : 'bg-white border border-outline-variant/20 text-on-surface-variant hover:bg-surface-variant/50'
              }`}
            >
              Tất Cả ({menuItems.length})
            </button>
            {categories.map(c => {
              const cName = c.name || c.id;
              return (
                <button
                  key={cName}
                  onClick={() => setActiveCategory(cName)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                    activeCategory === cName ? 'bg-primary text-white shadow-xs' : 'bg-white border border-outline-variant/20 text-on-surface-variant hover:bg-surface-variant/50'
                  }`}
                >
                  {cName}
                </button>
              );
            })}
          </div>
        </div>

        {/* Menu Items Grid */}
        <div className="flex-1 overflow-y-auto pr-1">
          {paginatedItems.length === 0 ? (
            <div className="py-16 text-center text-xs sm:text-sm text-on-surface-variant bg-white rounded-2xl border border-outline-variant/15 p-6">
              Không tìm thấy món nào phù hợp.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-3.5">
              {paginatedItems.map(item => {
                const isOutOfStock = stockStatus[item.id.toString()] === false;

                return (
                  <div
                    key={item.id}
                    onClick={(e) => openCustomizeModal(item, e)}
                    className={`bg-white rounded-2xl border transition-all flex flex-col overflow-hidden group select-none ${
                      isOutOfStock
                      ? 'border-red-200 bg-red-50/30 opacity-70 cursor-not-allowed'
                      : 'border-outline-variant/20 hover:border-primary/40 hover:shadow-md cursor-pointer active:scale-98'
                    }`}
                  >
                    <div className="relative h-28 sm:h-36 bg-surface-container overflow-hidden">
                      <img 
                        src={item.image || 'https://images.unsplash.com/photo-1541167760496-1628856ab772?auto=format&fit=crop&q=80&w=200'} 
                        alt={item.name} 
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <span className="absolute bottom-2 right-2 bg-primary text-white text-[11px] font-extrabold px-2 py-0.5 rounded-md shadow-md">
                        {item.price?.toLocaleString('vi-VN')}đ
                      </span>

                      {isOutOfStock ? (
                        <span className="absolute top-2 left-2 bg-red-600 text-white font-black text-[9px] uppercase px-2 py-0.5 rounded-md shadow-md">
                          Hết Món
                        </span>
                      ) : (
                        <span className="absolute top-2 right-2 w-7 h-7 rounded-full bg-white/90 text-primary flex items-center justify-center shadow-md group-hover:bg-primary group-hover:text-white transition-colors">
                          <span className="material-symbols-outlined text-base font-bold">tune</span>
                        </span>
                      )}
                    </div>

                    <div className="p-2.5 sm:p-3 flex-1 flex flex-col justify-between">
                      <h4 className={`text-xs sm:text-sm font-bold line-clamp-1 ${isOutOfStock ? 'text-red-900 line-through' : 'text-on-surface'}`}>
                        {item.name}
                      </h4>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-[10px] sm:text-xs text-on-surface-variant truncate">
                          {item.categoryName || item.categoryId}
                        </span>
                        <span className="text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                          Tùy chỉnh
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* POS Pagination Bar */}
        <div className="mt-2 shrink-0 bg-white rounded-xl p-1.5 border border-outline-variant/15 shadow-2xs">
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={(p) => setCurrentPage(p)}
            totalItems={filteredItems.length}
            pageSize={PAGE_SIZE}
            itemName="món"
          />
        </div>
      </section>

      {/* Right Section: Desktop POS Order Panel */}
      <aside className="hidden lg:flex w-96 bg-white border-l border-outline-variant/20 flex-col p-5 shadow-lg shrink-0 z-20">
        <div className="flex items-center justify-between pb-3 border-b border-outline-variant/15">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-xl">point_of_sale</span>
            <h2 className="text-base font-black text-primary">Đơn Hàng Tại Quầy</h2>
          </div>
          {posCart.length > 0 && (
            <button 
              onClick={handleClearCart}
              className="text-[11px] text-error hover:underline font-bold"
            >
              Xóa tất cả
            </button>
          )}
        </div>

        {/* Dine-in vs Takeaway Switch */}
        <div className="grid grid-cols-2 gap-2 p-1 bg-surface-container-low rounded-xl my-3 border border-outline-variant/15">
          <button
            onClick={() => setOrderType('Dine-in')}
            className={`py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 ${
              orderType === 'Dine-in' ? 'bg-white text-primary shadow-xs' : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-sm">table_restaurant</span>
            Tại Quán
          </button>
          <button
            onClick={() => setOrderType('Takeaway')}
            className={`py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 ${
              orderType === 'Takeaway' ? 'bg-white text-primary shadow-xs' : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-sm">shopping_bag</span>
            Mang Về
          </button>
        </div>

        {/* Table Selector (If Dine-in) */}
        {orderType === 'Dine-in' && (
          <div className="flex items-center gap-2 mb-3 bg-surface-container-lowest p-2 rounded-xl border border-outline-variant/20">
            <span className="text-xs font-bold text-on-surface-variant whitespace-nowrap">Chọn Bàn:</span>
            <select
              value={selectedTable}
              onChange={(e) => setSelectedTable(e.target.value)}
              className="bg-transparent text-xs font-bold text-primary border-none outline-none cursor-pointer flex-1"
            >
              {Array.from({ length: 15 }, (_, i) => `T${(i + 1).toString().padStart(2, '0')}`).map(t => (
                <option key={t} value={t}>Bàn {t}</option>
              ))}
            </select>
          </div>
        )}

        {/* Order Items List */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-2.5 my-2">
          {posCart.length === 0 ? (
            <div className="py-20 text-center text-xs text-on-surface-variant">
              <span className="material-symbols-outlined text-3xl text-outline-variant mb-1">touch_app</span>
              <p>Chưa có món nào được chọn.</p>
              <p className="text-[10px] opacity-70">Nhấn vào món để tùy chỉnh đường/đá/size.</p>
            </div>
          ) : (
            posCart.map((ci, index) => (
              <div key={ci.cartId} className="p-2.5 rounded-xl bg-surface-container-low/40 border border-outline-variant/10 flex flex-col gap-1.5">
                <div className="flex items-start justify-between">
                  <div className="min-w-0 pr-2">
                    <p className="text-xs font-bold text-on-surface truncate">{ci.item.name}</p>
                    <p className="text-[10px] text-on-surface-variant font-medium leading-tight">
                      {ci.sizeName} · Đường {ci.sugarLevel} · Đá {ci.iceLevel}
                      {ci.note ? ` · "${ci.note}"` : ''}
                    </p>
                  </div>

                  <span className="text-xs font-extrabold text-primary shrink-0">
                    {((ci.item.price + ci.sizeExtra) * ci.quantity).toLocaleString('vi-VN')}đ
                  </span>
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-outline-variant/10">
                  <span className="text-[10px] text-on-surface-variant font-bold">
                    {(ci.item.price + ci.sizeExtra).toLocaleString('vi-VN')}đ / ly
                  </span>

                  <div className="flex items-center gap-1.5 shrink-0 bg-white px-1.5 py-0.5 rounded-lg border border-outline-variant/20 shadow-2xs">
                    <button 
                      onClick={(e) => handleUpdateQuantity(index, -1, e)}
                      className="w-5 h-5 rounded flex items-center justify-center text-primary hover:bg-surface-variant active:scale-95"
                    >
                      <span className="material-symbols-outlined text-sm font-bold">remove</span>
                    </button>
                    <span className="w-5 text-center text-xs font-extrabold text-on-surface">{ci.quantity}</span>
                    <button 
                      onClick={(e) => handleUpdateQuantity(index, 1, e)}
                      className="w-5 h-5 rounded flex items-center justify-center text-primary hover:bg-surface-variant active:scale-95"
                    >
                      <span className="material-symbols-outlined text-sm font-bold">add</span>
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer Checkout Info */}
        <div className="pt-3 border-t border-outline-variant/15 space-y-2 mt-auto">
          <div className="flex justify-between text-xs text-on-surface-variant">
            <span>Tổng số lượng:</span>
            <span className="font-bold">{totalItemsCount} món</span>
          </div>
          <div className="flex justify-between text-sm sm:text-base font-extrabold text-primary">
            <span>Tổng thanh toán:</span>
            <span>{subTotal.toLocaleString('vi-VN')}đ</span>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1">
            {/* Cash Checkout Button (F2) */}
            <button
              disabled={posCart.length === 0 || isSubmitting}
              onClick={handleCashCheckout}
              className={`py-3 px-2 rounded-xl font-bold text-xs flex flex-col items-center justify-center gap-1 shadow-sm transition-all ${
                posCart.length === 0 || isSubmitting
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white active:scale-95 shadow-emerald-600/20'
              }`}
              title="Phím tắt: F2"
            >
              <div className="flex items-center gap-1">
                <span className="material-symbols-outlined text-base">payments</span>
                <span>{submittingAction === 'cash' ? 'Đang gửi...' : 'Tiền Mặt'}</span>
              </div>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/20 text-white/90">F2</span>
            </button>

            {/* PayOS QR Checkout Button (F4) */}
            <button
              disabled={posCart.length === 0 || isSubmitting}
              onClick={handlePayOSCheckout}
              className={`py-3 px-2 rounded-xl font-bold text-xs flex flex-col items-center justify-center gap-1 shadow-sm transition-all ${
                posCart.length === 0 || isSubmitting
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200'
                : 'bg-primary hover:bg-primary-container text-white active:scale-95 shadow-primary/20'
              }`}
              title="Phím tắt: F4"
            >
              <div className="flex items-center gap-1">
                <span className="material-symbols-outlined text-base">qr_code_scanner</span>
                <span>{submittingAction === 'payos' ? 'Tạo QR...' : 'QR PayOS'}</span>
              </div>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/20 text-white/90">F4</span>
            </button>
          </div>
        </div>
      </aside>
      {/* Mobile Floating Bottom Bar */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 p-3 bg-white/95 backdrop-blur-md border-t border-outline-variant/20 shadow-2xl z-30">
        <div className="flex items-center justify-between gap-3 max-w-md mx-auto">
          <div>
            <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-wider">
              {totalItemsCount} món đã chọn
            </p>
            <p className="text-base font-black text-primary">
              {subTotal.toLocaleString('vi-VN')}đ
            </p>
          </div>

          <button
            onClick={() => setIsMobileCartOpen(true)}
            disabled={posCart.length === 0}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md transition-all ${
              posCart.length === 0
              ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
              : 'bg-primary text-white active:scale-95'
            }`}
          >
            <span>Xem Đơn ({totalItemsCount})</span>
            <span className="material-symbols-outlined text-base">shopping_cart_checkout</span>
          </button>
        </div>
      </div>

      {/* Mobile Cart Drawer (Bottom Sheet) */}
      {isMobileCartOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex flex-col justify-end">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity" 
            onClick={() => setIsMobileCartOpen(false)}
          />

          {/* Sheet Container */}
          <div className="relative bg-white rounded-t-3xl max-h-[85vh] flex flex-col p-5 shadow-2xl z-10 animate-in slide-in-from-bottom duration-300">
            {/* Sheet Handle */}
            <div className="w-12 h-1 bg-outline-variant/40 rounded-full mx-auto mb-3 shrink-0" />

            <div className="flex items-center justify-between pb-3 border-b border-outline-variant/15 shrink-0">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-xl">receipt_long</span>
                <h3 className="text-base font-black text-primary">Hóa Đơn Tại Quầy</h3>
              </div>
              <button 
                onClick={() => setIsMobileCartOpen(false)}
                className="p-1 rounded-full text-on-surface-variant hover:bg-surface-variant"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            {/* Dine-in vs Takeaway Switch */}
            <div className="grid grid-cols-2 gap-2 p-1 bg-surface-container-low rounded-xl my-3 border border-outline-variant/15 shrink-0">
              <button
                onClick={() => setOrderType('Dine-in')}
                className={`py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 ${
                  orderType === 'Dine-in' ? 'bg-white text-primary shadow-xs' : 'text-on-surface-variant'
                }`}
              >
                <span className="material-symbols-outlined text-sm">table_restaurant</span>
                Tại Quán
              </button>
              <button
                onClick={() => setOrderType('Takeaway')}
                className={`py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 ${
                  orderType === 'Takeaway' ? 'bg-white text-primary shadow-xs' : 'text-on-surface-variant'
                }`}
              >
                <span className="material-symbols-outlined text-sm">shopping_bag</span>
                Mang Về
              </button>
            </div>

            {/* Table Selector */}
            {orderType === 'Dine-in' && (
              <div className="flex items-center gap-2 mb-3 bg-surface-container-lowest p-2.5 rounded-xl border border-outline-variant/20 shrink-0">
                <span className="text-xs font-bold text-on-surface-variant whitespace-nowrap">Chọn Bàn:</span>
                <select
                  value={selectedTable}
                  onChange={(e) => setSelectedTable(e.target.value)}
                  className="bg-transparent text-xs font-bold text-primary border-none outline-none cursor-pointer flex-1"
                >
                  {Array.from({ length: 15 }, (_, i) => `T${(i + 1).toString().padStart(2, '0')}`).map(t => (
                    <option key={t} value={t}>Bàn {t}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Items List in Sheet */}
            <div className="flex-1 overflow-y-auto space-y-2.5 my-2 pr-1">
              {posCart.map((ci, index) => (
                <div key={ci.cartId} className="p-3 rounded-2xl bg-surface-container-low/50 border border-outline-variant/15 flex flex-col gap-1.5">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 pr-2">
                      <p className="text-xs font-bold text-on-surface truncate">{ci.item.name}</p>
                      <p className="text-[10px] text-on-surface-variant font-medium mt-0.5">
                        {ci.sizeName} · Đường {ci.sugarLevel} · Đá {ci.iceLevel}
                        {ci.note ? ` · "${ci.note}"` : ''}
                      </p>
                    </div>

                    <span className="text-xs font-extrabold text-primary shrink-0">
                      {((ci.item.price + ci.sizeExtra) * ci.quantity).toLocaleString('vi-VN')}đ
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-outline-variant/10">
                    <span className="text-[10px] text-on-surface-variant font-bold">
                      {(ci.item.price + ci.sizeExtra).toLocaleString('vi-VN')}đ / ly
                    </span>

                    <div className="flex items-center gap-2 shrink-0 bg-white px-2 py-1 rounded-xl border border-outline-variant/20 shadow-2xs">
                      <button 
                        onClick={(e) => handleUpdateQuantity(index, -1, e)}
                        className="w-6 h-6 rounded flex items-center justify-center text-primary hover:bg-surface-variant active:scale-95"
                      >
                        <span className="material-symbols-outlined text-base font-bold">remove</span>
                      </button>
                      <span className="w-5 text-center text-xs font-black text-on-surface">{ci.quantity}</span>
                      <button 
                        onClick={(e) => handleUpdateQuantity(index, 1, e)}
                        className="w-6 h-6 rounded flex items-center justify-center text-primary hover:bg-surface-variant active:scale-95"
                      >
                        <span className="material-symbols-outlined text-base font-bold">add</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Sheet Footer */}
            <div className="pt-3 border-t border-outline-variant/15 space-y-2 mt-auto shrink-0">
              <div className="flex justify-between items-center text-sm font-black text-primary">
                <span>Tổng Cộng:</span>
                <span className="text-base">{subTotal.toLocaleString('vi-VN')}đ</span>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  disabled={isSubmitting || posCart.length === 0}
                  onClick={handleCashCheckout}
                  className={`py-3.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all ${
                    posCart.length === 0 || isSubmitting
                    ? 'bg-gray-200 text-gray-400'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20'
                  }`}
                >
                  <span className="material-symbols-outlined text-base">payments</span>
                  <span>{submittingAction === 'cash' ? 'Đang gửi...' : 'Thu Tiền Mặt'}</span>
                </button>

                <button
                  disabled={isSubmitting || posCart.length === 0}
                  onClick={handlePayOSCheckout}
                  className={`py-3.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all ${
                    posCart.length === 0 || isSubmitting
                    ? 'bg-gray-200 text-gray-400'
                    : 'bg-primary hover:bg-primary-container text-white shadow-primary/20'
                  }`}
                >
                  <span className="material-symbols-outlined text-base">qr_code_scanner</span>
                  <span>{submittingAction === 'payos' ? 'Tạo QR...' : 'Quét QR PayOS'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* POS Quick Customization Modal (Sugar / Ice / Size / Notes) */}
      {customizingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
            onClick={() => setCustomizingItem(null)}
          />

          {/* Modal Box */}
          <div className="relative bg-white rounded-3xl w-full max-w-md max-h-[90vh] flex flex-col p-5 sm:p-6 shadow-2xl z-10 animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-outline-variant/15 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl overflow-hidden bg-surface-container shrink-0">
                  <img 
                    src={customizingItem.image || 'https://images.unsplash.com/photo-1541167760496-1628856ab772?auto=format&fit=crop&q=80&w=200'} 
                    alt={customizingItem.name} 
                    className="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-on-surface">{customizingItem.name}</h3>
                  <p className="text-xs font-extrabold text-primary">
                    {((customizingItem.price || 0) + (modalSize === 'Large' ? 15000 : 0)).toLocaleString('vi-VN')}đ
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setCustomizingItem(null)}
                className="p-1 rounded-full text-on-surface-variant hover:bg-surface-variant"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            {/* Customization Options Body */}
            <div className="flex-1 overflow-y-auto space-y-4 py-3 pr-1">
              {/* Size Selector */}
              <div>
                <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block mb-1.5">
                  1. Kích Cỡ (Size)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setModalSize('Medium')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all flex items-center justify-between ${
                      modalSize === 'Medium' 
                      ? 'border-primary bg-primary/10 text-primary shadow-xs' 
                      : 'border-outline-variant/30 text-on-surface-variant hover:border-primary/50'
                    }`}
                  >
                    <span>Vừa (Medium)</span>
                    <span className="text-[10px] opacity-80">+0đ</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setModalSize('Large')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all flex items-center justify-between ${
                      modalSize === 'Large' 
                      ? 'border-primary bg-primary/10 text-primary shadow-xs' 
                      : 'border-outline-variant/30 text-on-surface-variant hover:border-primary/50'
                    }`}
                  >
                    <span>Lớn (Large)</span>
                    <span className="text-[10px] font-extrabold text-primary">+15.000đ</span>
                  </button>
                </div>
              </div>

              {/* Sugar Level */}
              <div>
                <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block mb-1.5">
                  2. Mức Đường
                </label>
                <div className="grid grid-cols-5 gap-1.5">
                  {['100%', '70%', '50%', '30%', '0%'].map(lvl => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setModalSugar(lvl)}
                      className={`py-1.5 rounded-lg text-xs font-bold border transition-all ${
                        modalSugar === lvl 
                        ? 'border-primary bg-primary text-white shadow-xs' 
                        : 'border-outline-variant/30 text-on-surface-variant hover:bg-surface-variant'
                      }`}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>
              </div>

              {/* Ice Level */}
              <div>
                <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block mb-1.5">
                  3. Mức Đá
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                  {['100%', '70%', '50%', '30%', 'Ko đá', 'Nóng'].map(lvl => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setModalIce(lvl)}
                      className={`py-1.5 rounded-lg text-xs font-bold border transition-all ${
                        modalIce === lvl 
                        ? 'border-primary bg-primary text-white shadow-xs' 
                        : 'border-outline-variant/30 text-on-surface-variant hover:bg-surface-variant'
                      }`}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>
              </div>

              {/* Special Note */}
              <div>
                <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block mb-1.5">
                  4. Ghi Chú Riêng Cho Bếp / Barista
                </label>
                <input 
                  type="text"
                  placeholder="VD: Ít ngọt, tách đá riêng, nhiều sữa..."
                  value={modalNote}
                  onChange={(e) => setModalNote(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-container-lowest border border-outline-variant/30 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              {/* Quantity */}
              <div className="flex items-center justify-between pt-2 border-t border-outline-variant/10">
                <span className="text-xs font-bold text-on-surface">Số lượng ly:</span>
                <div className="flex items-center gap-2 bg-surface-container-low px-2 py-1 rounded-xl border border-outline-variant/20">
                  <button
                    type="button"
                    onClick={() => setModalQuantity(q => q > 1 ? q - 1 : 1)}
                    className="w-7 h-7 rounded-lg bg-white flex items-center justify-center text-primary shadow-xs active:scale-95"
                  >
                    <span className="material-symbols-outlined text-base font-bold">remove</span>
                  </button>
                  <span className="w-6 text-center text-sm font-black text-primary">{modalQuantity}</span>
                  <button
                    type="button"
                    onClick={() => setModalQuantity(q => q + 1)}
                    className="w-7 h-7 rounded-lg bg-white flex items-center justify-center text-primary shadow-xs active:scale-95"
                  >
                    <span className="material-symbols-outlined text-base font-bold">add</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="pt-3 border-t border-outline-variant/15 shrink-0">
              <button
                type="button"
                onClick={handleAddCustomizedItem}
                className="w-full py-3 bg-primary text-white rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-md hover:bg-primary-container active:scale-95 transition-all"
              >
                <span className="material-symbols-outlined text-base">add_shopping_cart</span>
                <span>Thêm Vào Đơn • {(((customizingItem.price || 0) + (modalSize === 'Large' ? 15000 : 0)) * modalQuantity).toLocaleString('vi-VN')}đ</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* POS PayOS VietQR Modal */}
      <PayOSCounterModal
        isOpen={payOSModalOpen}
        order={currentPayOSOrder}
        onClose={() => {
          setPayOSModalOpen(false);
          setCurrentPayOSOrder(null);
        }}
        onPaidSuccess={handlePayOSSuccess}
      />

      {/* POS Print Bill / Kitchen Ticket Modal */}
      {printReceiptData && (
        <ReceiptPrintModal
          isOpen={showPrintModal}
          onClose={() => {
            setShowPrintModal(false);
            setPrintReceiptData(null);
          }}
          data={printReceiptData}
        />
      )}
    </div>
  );
}
