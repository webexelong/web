import { create } from 'zustand';
import { menuApi, orderApi, authApi } from '../api/apis';
import { signalRService } from '../api/signalr';
import { trackAddToCart } from '../utils/analytics';
import type { 
  MenuItemDto, 
  OrderDto, 
  LoginResponse,
  StoreMenuResponse 
} from '../types/apiTypes';

// --- UI Compatible Types ---
export type OrderStatus = 'awaiting_payment' | 'pending' | 'confirmed' | 'preparing' | 'ready' | 'done' | 'served' | 'paid' | 'completed' | 'cancelled';

export interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  image: string;
  categoryId: string;
  categoryName?: string;
  rating?: number;
  rawDto?: MenuItemDto;
}

export interface Category {
  id: string;
  name: string;
  icon?: string;
}

export interface CartItem extends MenuItem {
  cartItemId?: string;
  quantity: number;
  sizeId?: number;
  sizeName?: string;
  toppingIds?: number[];
  toppingNames?: string[];
  sugarLevel?: string;
  iceLevel?: string;
  note?: string;
}

export interface Order {
  id: string;
  orderCode?: string;
  tableNumber: string;
  items: CartItem[];
  total: number;
  status: OrderStatus;
  createdAt: string;
  rawDto?: OrderDto;
}

// Guest Session Interface
export interface GuestSession {
  guestId: string; // UUID for tracking
  storeId: number;
  tableId: string | number;
  tableToken?: string;
  tableNumber: string;
  storeName?: string;
  guestName?: string;
  guestPhone?: string;
  timestamp: string;
}

const loadInitialGuestSession = (): GuestSession | null => {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    const saved = localStorage.getItem('guestSession');
    if (!saved) return null;
    const parsed = JSON.parse(saved);
    if (parsed && parsed.storeId && (parsed.tableId !== undefined || parsed.tableNumber)) {
      return {
        ...parsed,
        tableNumber: parsed.tableNumber || (typeof parsed.tableId === 'string' ? parsed.tableId : `Bàn ${parsed.tableId}`),
      };
    }
  } catch (e) {
    console.error('Failed to parse guestSession from localStorage', e);
  }
  return null;
};

const initialGuestSession = loadInitialGuestSession();
const menuRequests = new Map<number, Promise<void>>();

interface StoreState {
  // Data
  menuItems: MenuItem[];
  categories: Category[];
  orders: Order[];
  activeOrder: Order | null;
  storeInfo: StoreMenuResponse | null;
  user: LoginResponse | null;
  
  // Customer State
  currentStoreId: number;
  currentTable: string | null;
  currentTableId: number | null;
  currentTableNumber: string | null;
  cart: CartItem[];
  appliedVoucherCode: string | null;
  voucherDiscount: number;
  isLoading: boolean;
  
  // Guest Session State
  guestSession: GuestSession | null;
  
  // Actions
  setStoreId: (storeId: number) => void;
  setTable: (table: string) => void;
  fetchMenu: (storeId?: number) => Promise<void>;
  fetchOrders: (storeId?: number) => Promise<void>;
  
  // Guest Session Actions
  initGuestSession: (storeId: number, tableId: string | number, tableNumber?: string, storeName?: string, tableToken?: string) => void;
  updateGuestInfo: (name?: string, phone?: string) => void;
  clearGuestSession: () => void;
  
  addToCart: (item: any, options?: {
    quantity?: number;
    sizeId?: number;
    sizeName?: string;
    sizeExtra?: number;
    toppingIds?: number[];
    toppingNames?: string[];
    toppingExtra?: number;
    sugarLevel?: string;
    iceLevel?: string;
    note?: string;
  }) => void;
  removeFromCart: (itemId: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  setVoucher: (code: string, discount: number) => void;
  
  placeOrder: () => void;
  createOrder: (
    tableId?: string | number, 
    customerPhone?: string, 
    customerName?: string, 
    note?: string, 
    sourceOrPoints?: 'qr_table' | 'pos_staff' | number, 
    paymentMethod?: 'cash' | 'payos' | 'unpaid',
    pointsToUse?: number
  ) => Promise<Order>;
  updateOrderStatus: (orderId: string, status: OrderStatus) => Promise<void>;
  
  initRealtime: (storeId?: number) => void;
  loginStaff: (username: string, password: string) => Promise<void>;
  logout: () => void;
  addMenuItem: (item: MenuItem) => void;
  updateMenuItem: (item: MenuItem) => void;
  deleteMenuItem: (id: string) => void;
}

const mockCategories: Category[] = [
  { id: 'Cà Phê Pha Máy', name: 'Cà Phê Pha Máy', icon: 'coffee' },
  { id: 'Sinh Tố & Trà Sữa', name: 'Sinh Tố & Trà Sữa', icon: 'bubble_chart' },
  { id: 'Trà & Trái Cây', name: 'Trà & Trái Cây', icon: 'energy_savings_leaf' },
  { id: 'Bánh Ngọt', name: 'Bánh Ngọt', icon: 'bakery_dining' }
];

export const useStore = create<StoreState>((set, get) => ({
  menuItems: [],
  categories: mockCategories,
  orders: [],
  activeOrder: null,
  storeInfo: null,
  user: null,

  currentStoreId: initialGuestSession?.storeId || 0,
  currentTable: initialGuestSession?.tableNumber || (initialGuestSession?.tableId ? String(initialGuestSession.tableId) : null),
  currentTableId: typeof initialGuestSession?.tableId === 'number' ? initialGuestSession.tableId : (Number(initialGuestSession?.tableId) || null),
  currentTableNumber: initialGuestSession?.tableNumber || null,
  cart: [],
  appliedVoucherCode: null,
  voucherDiscount: 0,
  isLoading: false,
  guestSession: initialGuestSession,

  setStoreId: (storeId) => set({ currentStoreId: storeId }),
  setTable: (table) => set({ currentTable: table, currentTableNumber: table }),

  // Guest Session Management
  initGuestSession: (storeId, tableId, tableNumber, storeName, tableToken) => {
    const guestId = `guest-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const displayTableNumber = tableNumber || (typeof tableId === 'string' ? tableId : `Bàn ${tableId}`);
    const numericTableId = typeof tableId === 'number' ? tableId : (parseInt(tableId) || 0);

    const session: GuestSession = {
      guestId,
      storeId,
      tableId,
      tableNumber: displayTableNumber,
      storeName,
      tableToken,
      timestamp: new Date().toISOString(),
    };

    const previousStoreId = get().currentStoreId;
    const isSwitchingStore = previousStoreId > 0 && previousStoreId !== storeId;

    // Persist to localStorage
    localStorage.setItem('guestSession', JSON.stringify(session));
    
    set({ 
      guestSession: session,
      currentStoreId: storeId,
      currentTable: typeof tableId === 'string' ? tableId : displayTableNumber,
      currentTableId: numericTableId > 0 ? numericTableId : null,
      currentTableNumber: displayTableNumber,
      // Tự động làm sạch giỏ hàng khi đổi sang quán khác để tránh lẫn món
      cart: isSwitchingStore ? [] : get().cart,
      appliedVoucherCode: isSwitchingStore ? null : get().appliedVoucherCode,
      voucherDiscount: isSwitchingStore ? 0 : get().voucherDiscount,
    });
  },

  updateGuestInfo: (name, phone) => {
    const { guestSession } = get();
    if (!guestSession) return;
    
    const updated = { ...guestSession, guestName: name, guestPhone: phone };
    localStorage.setItem('guestSession', JSON.stringify(updated));
    set({ guestSession: updated });
  },

  clearGuestSession: () => {
    localStorage.removeItem('guestSession');
    set({ 
      guestSession: null,
      currentTable: null,
      currentTableId: null,
      currentTableNumber: null,
    });
  },

  fetchMenu: async (storeId) => {
    const sId = storeId || get().currentStoreId;
    if (!Number.isInteger(sId) || sId <= 0) return;

    const pendingRequest = menuRequests.get(sId);
    if (pendingRequest) return pendingRequest;

    const request = (async () => {
      try {
        set({ isLoading: true });
        const data = await menuApi.getStoreMenu(sId);

        // Filter out 'Quà Lưu Niệm'
        const mappedCategories: Category[] = data.categories
          .filter(c => !c.name.toLowerCase().includes('quà') && !c.name.toLowerCase().includes('lưu niệm'))
          .map(c => ({
            id: c.name,
            name: c.name,
            icon: c.icon || 'coffee',
          }));

        const mappedItems: MenuItem[] = data.menuItems
          .filter(m => !m.categoryName?.toLowerCase().includes('quà') && !m.categoryName?.toLowerCase().includes('lưu niệm'))
          .map(m => ({
            id: m.menuItemId.toString(),
            name: m.name,
            description: m.description || '',
            price: m.basePrice,
            image: m.imageUrl || 'https://images.unsplash.com/photo-1510591509098-f4fdc6d0ff04?w=500&q=80',
            categoryId: m.categoryName || 'Cà Phê Pha Máy',
            categoryName: m.categoryName,
            rating: m.rating || 4.8,
            rawDto: m,
          }));

        set({
          storeInfo: data,
          categories: mappedCategories.length > 0 ? mappedCategories : mockCategories,
          menuItems: mappedItems,
          isLoading: false
        });
      } catch (err) {
        console.warn('API menu fetch failed, using fallback UI state:', err);
        set({ isLoading: false });
      }
    })();

    menuRequests.set(sId, request);
    try {
      await request;
    } finally {
      menuRequests.delete(sId);
    }
  },

  fetchOrders: async (storeId) => {
    const sId = storeId || get().currentStoreId;
    try {
      const orders = await orderApi.getActiveOrders(sId);
      const mappedOrders: Order[] = orders.map((o: OrderDto) => ({
        id: o.orderId.toString(),
        orderCode: o.orderCode,
        tableNumber: o.tableNumber || 'Mang về',
        total: o.totalAmount,
        status: (o.status as OrderStatus) || 'pending',
        createdAt: o.createdAt,
        rawDto: o,
        items: o.items.map(i => ({
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
      }));

      set({ orders: mappedOrders });
    } catch (err) {
      console.warn('Failed to fetch orders from API:', err);
    }
  },

  addToCart: (item, options = {}) => {
    const itemId = item.id?.toString() || item.menuItemId?.toString() || '1';
    const itemName = item.name;
    const itemPrice = item.price || item.basePrice || 0;
    const itemImage = item.image || item.imageUrl || '';
    const categoryId = item.categoryId || '';

    const sizeExtra = options.sizeExtra || 0;
    const toppingExtra = options.toppingExtra || 0;
    const finalUnitPrice = itemPrice + sizeExtra + toppingExtra;

    const toppingsKey = (options.toppingIds || []).slice().sort().join(',');
    const cartItemId = `${itemId}_s${options.sizeId || 0}_sg${options.sugarLevel || '100'}_ic${options.iceLevel || '100'}_tp${toppingsKey}_n${options.note || ''}`;

    const existingIndex = get().cart.findIndex(i => 
      (i.cartItemId ? i.cartItemId === cartItemId : (
        i.id === itemId && 
        i.sizeId === options.sizeId && 
        (i.sizeName || '') === (options.sizeName || '') &&
        (i.sugarLevel || '') === (options.sugarLevel || '100%') &&
        (i.iceLevel || '') === (options.iceLevel || '100%') &&
        JSON.stringify(i.toppingIds || []) === JSON.stringify(options.toppingIds || [])
      ))
    );

    if (existingIndex > -1) {
      const updatedCart = [...get().cart];
      updatedCart[existingIndex].quantity += (options.quantity || 1);
      set({ cart: updatedCart });
    } else {
      const newCartItem: CartItem = {
        cartItemId,
        id: itemId,
        name: itemName,
        description: item.description || '',
        price: finalUnitPrice,
        image: itemImage,
        categoryId: categoryId,
        quantity: options.quantity || 1,
        sizeId: options.sizeId,
        sizeName: options.sizeName,
        toppingIds: options.toppingIds,
        toppingNames: options.toppingNames,
        sugarLevel: options.sugarLevel || '100%',
        iceLevel: options.iceLevel || '100%',
        note: options.note,
        rawDto: item.rawDto || item,
      };
      set({ cart: [...get().cart, newCartItem] });
    }

    // Gửi sự kiện add_to_cart lên Google Analytics 4
    try {
      trackAddToCart({
        id: itemId,
        name: itemName,
        price: finalUnitPrice,
        quantity: options.quantity || 1,
        size: options.sizeName,
      });
    } catch {
      // Bỏ qua lỗi nếu GA chưa sẵn sàng
    }
  },

  removeFromCart: (key: string) => set({
    cart: get().cart.filter(i => (i.cartItemId || i.id) !== key)
  }),

  updateQuantity: (key: string, quantity: number) => {
    if (quantity <= 0) {
      get().removeFromCart(key);
      return;
    }
    set({
      cart: get().cart.map(i => (i.cartItemId || i.id) === key ? { ...i, quantity } : i)
    });
  },

  clearCart: () => set({ cart: [], appliedVoucherCode: null, voucherDiscount: 0 }),

  setVoucher: (code, discount) => set({ appliedVoucherCode: code, voucherDiscount: discount }),

  placeOrder: () => {
    const { cart, currentTable, currentTableNumber, guestSession } = get();
    if (cart.length === 0) return;
    
    const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const newOrder: Order = {
      id: `o${Math.random().toString(36).substr(2, 9)}`,
      orderCode: `ORD-${Math.floor(1000 + Math.random() * 9000)}`,
      tableNumber: guestSession?.tableNumber || currentTableNumber || currentTable || 'Mang về',
      items: [...cart],
      total,
      status: 'pending',
      createdAt: new Date().toISOString()
    };
    
    set({ orders: [newOrder, ...get().orders], activeOrder: newOrder, cart: [] });
  },

  createOrder: async (tableId, customerPhone, customerName, note, sourceOrPoints = 'qr_table', paymentMethod, pointsToUseParam) => {
    let source: 'qr_table' | 'pos_staff' = 'qr_table';
    let pointsToUse = 0;

    if (typeof sourceOrPoints === 'number') {
      pointsToUse = sourceOrPoints;
      source = 'qr_table';
    } else if (sourceOrPoints) {
      source = sourceOrPoints;
      pointsToUse = pointsToUseParam || 0;
    }
    const { cart, currentStoreId, currentTableId, currentTableNumber, currentTable, appliedVoucherCode, guestSession } = get();
    if (cart.length === 0) throw new Error('Giỏ hàng trống');

    // Xác định chính xác tableId (khóa chính số nguyên) và tableNumber (chuỗi hiển thị)
    let finalTableNumId: number | undefined = undefined;
    let finalDisplayTable: string = 'Mang về';

    if (typeof tableId === 'number' && tableId > 0) {
      finalTableNumId = tableId;
      finalDisplayTable = guestSession?.tableNumber || currentTableNumber || `Bàn ${tableId}`;
    } else if (guestSession?.tableId) {
      if (typeof guestSession.tableId === 'number' && guestSession.tableId > 0) {
        finalTableNumId = guestSession.tableId;
      } else {
        const parsed = parseInt(String(guestSession.tableId));
        if (!isNaN(parsed) && parsed > 0) finalTableNumId = parsed;
      }
      finalDisplayTable = guestSession.tableNumber || `Bàn ${guestSession.tableId}`;
    } else if (currentTableId && currentTableId > 0) {
      finalTableNumId = currentTableId;
      finalDisplayTable = currentTableNumber || `Bàn ${currentTableId}`;
    } else if (typeof tableId === 'string' && tableId.trim()) {
      const parsed = parseInt(tableId);
      if (!isNaN(parsed) && parsed > 0) {
        finalTableNumId = parsed;
      }
      finalDisplayTable = tableId;
    } else if (currentTable) {
      finalDisplayTable = currentTable;
    }

    if (source === 'qr_table' && (!finalTableNumId || finalTableNumId <= 0)) {
      throw new Error('Vui lòng quét mã QR tại bàn để xác định vị trí phục vụ trước khi gọi món.');
    }

    const effectiveStoreId = currentStoreId || guestSession?.storeId || 0;
    if (effectiveStoreId <= 0) {
      throw new Error('Không xác định được chi nhánh quán. Vui lòng quét lại mã QR tại bàn.');
    }

    try {
      const payload = {
        storeId: effectiveStoreId,
        tableId: finalTableNumId,
        tableToken: guestSession?.tableToken || undefined,
        customerPhone: customerPhone || undefined,
        customerName: customerName || undefined,
        
        // Guest Session Support
        guestId: guestSession?.guestId || undefined,
        guestName: guestSession?.guestName || customerName || undefined,
        guestPhone: guestSession?.guestPhone || customerPhone || undefined,
        source: source,
        paymentMethod: paymentMethod || undefined,
        
        voucherCode: appliedVoucherCode || undefined,
        pointsToUse: pointsToUse || 0,
        note: note || undefined,
        items: cart.map(i => {
          const numId = parseInt(i.id);
          return {
            menuItemId: isNaN(numId) ? 5 : numId,
            sizeId: i.sizeId ? Number(i.sizeId) : undefined,
            quantity: i.quantity,
            sugarLevel: i.sugarLevel || '100%',
            iceLevel: i.iceLevel || '100%',
            note: i.note,
            toppings: (i.toppingIds || []).map(tId => ({ toppingId: tId })),
          };
        }),
      };

      const res = await orderApi.createOrder(payload);

      // Keep the guest capability out of the URL; it is needed after refresh and
      // when the payment provider redirects back to this browser tab.
      if (res.paymentAccessToken) {
        sessionStorage.setItem(`webcafe_payment_access_code_${res.orderCode}`, res.paymentAccessToken);
        sessionStorage.setItem(`webcafe_payment_access_order_${res.orderId}`, res.paymentAccessToken);
      }
      
      const newOrder: Order = {
        id: res.orderId.toString(),
        orderCode: res.orderCode,
        tableNumber: res.tableNumber || finalDisplayTable,
        total: res.totalAmount,
        status: (res.status as OrderStatus) || (source === 'pos_staff' ? (paymentMethod === 'cash' ? 'paid' : 'awaiting_payment') : 'awaiting_payment'),
        createdAt: res.createdAt,
        rawDto: res,
        items: [...cart],
      };

      const existingOrders = get().orders.filter(o => o.id !== newOrder.id);
      set({
        orders: [newOrder, ...existingOrders],
        activeOrder: newOrder,
        cart: [],
        appliedVoucherCode: null,
        voucherDiscount: 0,
      });

      return newOrder;
    } catch (err) {
      console.warn('API createOrder failed:', err);
      throw err;
    }
  },

  updateOrderStatus: async (orderId, newStatus) => {
    let mappedStatus = newStatus;
    if (newStatus === 'done') mappedStatus = 'ready';
    
    const numId = parseInt(orderId);
    if (!isNaN(numId)) {
      try {
        await orderApi.updateStatus(numId, mappedStatus);
      } catch (err) {
        console.warn('API updateStatus failed:', err);
      }
    }

    set({
      orders: get().orders.map(o => o.id === orderId ? { ...o, status: newStatus } : o)
    });
  },

  initRealtime: async (storeId) => {
    const sId = storeId || get().currentStoreId;
    
    // Register event listeners first
    signalRService.onNewOrder((newDto) => {
      const mapped: Order = {
        id: newDto.orderId.toString(),
        orderCode: newDto.orderCode,
        tableNumber: newDto.tableNumber || 'Mang về',
        total: newDto.totalAmount,
        status: (newDto.status as OrderStatus) || 'pending',
        createdAt: newDto.createdAt,
        rawDto: newDto,
        items: newDto.items.map(i => ({
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

      set({
        orders: [mapped, ...get().orders.filter(o => o.id !== mapped.id)]
      });
    });

    signalRService.onOrderStatusChanged((orderId, status) => {
      set({
        orders: get().orders.map(o => o.id === orderId.toString() ? { ...o, status: status as OrderStatus } : o)
      });
    });

    signalRService.onTableStatusChanged((tableId, status) => {
      console.log(`📡 SignalR Table #${tableId} status: ${status}`);
    });

    // Then start connection
    try {
      await signalRService.startConnection(sId);
      console.log('✅ Realtime initialized for store:', sId);
    } catch (err) {
      console.error('❌ Failed to initialize realtime:', err);
    }
  },

  loginStaff: async (username, password) => {
    const res = await authApi.loginStaff({ username, password });
    localStorage.setItem('token', res.token);
    localStorage.setItem('user', JSON.stringify(res));
    if (!res.storeId) throw new Error('Tài khoản chưa được gán cửa hàng.');
    set({ user: res, currentStoreId: res.storeId });
  },

  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    set({ user: null });
  },

  addMenuItem: (item) => set({ menuItems: [...get().menuItems, item] }),
  updateMenuItem: (item) => set({
    menuItems: get().menuItems.map(m => m.id === item.id ? item : m)
  }),
  deleteMenuItem: (id) => set({
    menuItems: get().menuItems.filter(m => m.id !== id)
  })
}));
