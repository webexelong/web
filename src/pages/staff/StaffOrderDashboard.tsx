import { useState, useEffect, useCallback, useMemo } from 'react';
import { apiClient } from '../../api/apiClient';
import OrderCard from '../../components/staff/OrderCard';
import StatusFilter from '../../components/staff/StatusFilter';
import { notificationService } from '../../services/notificationService';
import { signalRService } from '../../api/signalr';
import { useStore } from '../../store/useStore';
import type { OrderStatus } from '../../store/useStore';
import { useAuthStore } from '../../store/authStore';

interface Order {
  orderId: number;
  orderCode: string;
  tableNumber?: string;
  customerName?: string;
  status: string;
  subTotal: number;
  totalAmount: number;
  items: OrderItem[];
  createdAt: string;
  note?: string;
}

interface OrderItem {
  menuItemName: string;
  sizeName?: string;
  quantity: number;
  unitPrice: number;
  sugarLevel: string;
  iceLevel: string;
  toppings?: string[];
  note?: string;
}

type LocalOrderStatus = 'all' | 'pending' | 'preparing' | 'ready' | 'paid';

export default function StaffOrderDashboard() {
  const { orders: storeOrders } = useStore();
  const authStoreId = useAuthStore(state => state.user?.storeId);
  const currentStoreId = useStore(state => state.currentStoreId);
  const storeId = authStoreId || currentStoreId || 1;
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [activeFilter, setActiveFilter] = useState<LocalOrderStatus>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Convert store orders to component format (memoized to prevent re-creation)
  const orders: Order[] = useMemo(() => {
    const seen = new Set<string>();
    const uniqueStoreOrders: typeof storeOrders = [];
    for (const o of storeOrders) {
      const idKey = o.id || o.orderCode;
      if (idKey && !seen.has(idKey)) {
        seen.add(idKey);
        uniqueStoreOrders.push(o);
      }
    }

    return uniqueStoreOrders.map(o => ({
      orderId: parseInt(o.id),
      orderCode: o.orderCode || '',
      tableNumber: o.tableNumber || 'Mang về',
      customerName: o.rawDto?.customerName || o.rawDto?.guestName || 'Khách',
      status: o.status,
      subTotal: o.rawDto?.subTotal || o.total,
      totalAmount: o.total,
      items: o.items.map(item => ({
        menuItemName: item.name,
        sizeName: item.sizeName,
        quantity: item.quantity,
        unitPrice: item.price,
        sugarLevel: item.sugarLevel || '100%',
        iceLevel: item.iceLevel || '100%',
        toppings: item.toppingNames,
        note: item.note,
      })),
      createdAt: o.createdAt,
      note: o.rawDto?.note || undefined,
    }));
  }, [storeOrders]);

  // Fetch orders from API and update store
  const fetchOrders = async () => {
    try {
      setLoading(true);
      setError('');
      if (!storeId) {
        throw new Error('Tài khoản chưa được gán cửa hàng.');
      }
      const response = await apiClient.get(`/orders/active/store/${storeId}`);
      const ordersData = response.data.data || [];
      
      // Deduplicate by orderId
      const seenIds = new Set<number>();
      const uniqueOrdersData = ordersData.filter((dto: any) => {
        if (!dto.orderId) return true;
        if (seenIds.has(dto.orderId)) return false;
        seenIds.add(dto.orderId);
        return true;
      });

      // Map to store format
      const mappedOrders = uniqueOrdersData.map((dto: any) => ({
        id: dto.orderId.toString(),
        orderCode: dto.orderCode,
        tableNumber: dto.tableNumber || 'Mang về',
        total: dto.totalAmount,
        status: dto.status as OrderStatus,
        createdAt: dto.createdAt,
        rawDto: dto,
        items: (dto.items || []).map((item: any) => ({
          id: item.menuItemId.toString(),
          name: item.menuItemName,
          description: '',
          price: item.unitPrice,
          image: item.imageUrl || '',
          categoryId: '',
          quantity: item.quantity,
          sizeName: item.sizeName,
          toppingNames: item.toppings?.map((t: any) => t.toppingName),
          sugarLevel: item.sugarLevel,
          iceLevel: item.iceLevel,
          note: item.note,
        })),
      }));
      
      useStore.setState({ orders: mappedOrders });
      console.log(`✅ Loaded ${mappedOrders.length} orders`);
    } catch (err: any) {
      setError(err.message || 'Không thể tải danh sách đơn hàng');
      console.error('❌ Error fetching orders:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();

    // Connect SignalR & listen to live new order events
    if (storeId) {
      signalRService.startConnection(storeId);

      const handleNewOrder = (orderDto: any) => {
        console.log('🔔 [SignalR] Có đơn hàng mới tại StaffOrderDashboard:', orderDto);
        if (soundEnabled) {
          notificationService.playNewOrderSound();
        }
        fetchOrders();
      };

      const handleStatusChanged = (orderId: number, status: string, orderCode: string) => {
        console.log('🔔 [SignalR] Trạng thái đơn thay đổi:', orderId, status, orderCode);
        if (soundEnabled) {
          notificationService.playStatusChangeSound();
        }
        fetchOrders();
      };

      signalRService.onNewOrder(handleNewOrder);
      signalRService.onOrderStatusChanged(handleStatusChanged);

      return () => {
        signalRService.offNewOrder(handleNewOrder);
        signalRService.offOrderStatusChanged(handleStatusChanged);
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId, soundEnabled]);

  // Polling dự phòng mỗi 15 giây (thay vì 60s) để đảm bảo không bị miss đơn
  useEffect(() => {
    const interval = setInterval(fetchOrders, 15000);

    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId]);

  // Filter orders by status (memoized to prevent infinite loops)
  const filterOrders = useCallback((ordersList: Order[], status: LocalOrderStatus) => {
    // Luôn ẩn các đơn đang chờ thanh toán PayOS (awaiting_payment) để chống spam
    const validOrders = ordersList.filter(order => order.status !== 'awaiting_payment');
    
    if (status === 'all') {
      setFilteredOrders(validOrders);
    } else if (status === 'pending') {
      setFilteredOrders(validOrders.filter(order => order.status === 'pending' || order.status === 'confirmed'));
    } else if (status === 'paid') {
      setFilteredOrders(validOrders.filter(order => order.status === 'paid' || (order.status as string) === 'served' || (order.status as string) === 'completed'));
    } else {
      setFilteredOrders(validOrders.filter(order => order.status === status));
    }
  }, []);

  // Auto-filter orders when orders or activeFilter changes
  useEffect(() => {
    filterOrders(orders, activeFilter);
  }, [orders, activeFilter, filterOrders]);

  const handleFilterChange = (status: LocalOrderStatus) => {
    setActiveFilter(status);
  };

  // Count orders by status (không đếm đơn awaiting_payment chưa trả tiền)
  const getStatusCounts = () => {
    const validOrders = orders.filter(o => o.status !== 'awaiting_payment');
    return {
      all: validOrders.length,
      pending: validOrders.filter(o => o.status === 'pending' || o.status === 'confirmed').length,
      preparing: validOrders.filter(o => o.status === 'preparing').length,
      ready: validOrders.filter(o => o.status === 'ready').length,
      paid: validOrders.filter(o => o.status === 'paid' || (o.status as string) === 'served' || (o.status as string) === 'completed').length,
    };
  };

  const statusCounts = getStatusCounts();

  // Handle order status update
  const handleOrderUpdate = (orderId: number, newStatus: string) => {
    // Update in store
    useStore.setState((state) => ({
      orders: state.orders.map(o =>
        parseInt(o.id) === orderId
          ? { ...o, status: newStatus as OrderStatus }
          : o
      ),
    }));
  };

  const toggleSound = () => {
    const newState = notificationService.toggle();
    setSoundEnabled(newState);
  };

  return (
    <div className="min-h-screen bg-background font-body-md text-on-surface">
      {/* Header */}
      <header className="bg-surface/95 backdrop-blur-md border-b border-outline-variant/15 sticky top-0 z-30 shadow-xs">
        <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-primary tracking-tight">Quản Lý Đơn Hàng</h1>
              <p className="text-xs sm:text-sm text-on-surface-variant mt-1">
                Tổng đơn: <span className="font-bold text-primary">{orders.length}</span> đơn
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={toggleSound}
                className={`p-2.5 rounded-xl border transition-colors ${
                  soundEnabled
                    ? 'bg-primary/10 border-primary/30 text-primary'
                    : 'bg-surface-container border-outline-variant/30 text-on-surface-variant'
                }`}
                title={soundEnabled ? 'Tắt âm thanh' : 'Bật âm thanh'}
              >
                <span className="material-symbols-outlined text-xl">
                  {soundEnabled ? 'volume_up' : 'volume_off'}
                </span>
              </button>
              <button
                onClick={fetchOrders}
                className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-xl hover:bg-primary-container transition-colors font-bold text-xs shadow-xs"
              >
                <span className="material-symbols-outlined text-xl">refresh</span>
                <span className="hidden sm:inline">Làm mới</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Status Filter */}
        <StatusFilter
          activeFilter={activeFilter}
          onFilterChange={handleFilterChange}
          counts={statusCounts}
        />

        {/* Error State */}
        {error && (
          <div className="mb-6 p-4 bg-error-container border border-error/20 rounded-2xl">
            <div className="flex items-center gap-2 text-error">
              <span className="material-symbols-outlined">error</span>
              <p className="font-medium">{error}</p>
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-10 w-10 border-4 border-outline-variant/30 border-t-primary"></div>
              <p className="mt-4 text-on-surface-variant">Đang tải đơn hàng...</p>
            </div>
          </div>
        ) : filteredOrders.length === 0 ? (
          /* Empty State */
          <div className="text-center py-12">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-surface-container rounded-2xl mb-4">
              <span className="material-symbols-outlined text-4xl text-on-surface-variant">receipt_long</span>
            </div>
            <h3 className="text-lg font-bold text-on-surface mb-2">
              Không có đơn hàng
            </h3>
            <p className="text-on-surface-variant">
              {activeFilter === 'all' 
                ? 'Chưa có đơn hàng nào trong hệ thống'
                : `Không có đơn hàng ở trạng thái "${activeFilter}"`}
            </p>
          </div>
        ) : (
          /* Orders Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredOrders.map((order, idx) => (
              <OrderCard
                key={order.orderId ? `order-${order.orderId}` : `order-idx-${idx}`}
                order={order}
                onStatusUpdate={handleOrderUpdate}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
