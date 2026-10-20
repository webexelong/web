import { apiClient } from './apiClient';
import type { 
  ApiResponse, 
  StoreMenuResponse, 
  MenuItemDto, 
  CategoryDto, 
  CreateOrderDto, 
  OrderDto, 
  TableDto, 
  LoginRequest, 
  LoginResponse, 
  OwnerSignupRequest,
  OwnerSignupResponse,
  MySubscriptionDto,
  SubscriptionPlanDto,
  StaffDto,
  CreateStaffRequest,
  UpdateStaffRequest,
  CheckVoucherRequest, 
  VoucherValidationResult, 
  DashboardStatsDto,
  ShiftOperationsDto,
  BusinessAnalyticsReportDto,
  MenuEngineeringSummaryDto,
  RevenueReportDto,
  CustomerAnalyticsDto,
  CategoryPerformanceDto,
  PaginationRes,
  AiRecommendationRequestDto,
  AiRecommendationResponseDto,
  AiChatRequestDto,
  AiChatResponseDto,
  InventoryAiChatRequestDto,
  InventoryAiChatResponseDto,
  IngredientDto,
  CreateIngredientDto,
  UpdateIngredientDto,
  InventoryStockDto,
  InventoryTransactionDto,
  ImportInventoryDto,
  AdjustInventoryDto,
  MenuItemRecipeDto,
  UpsertRecipeDto,
  LowStockAlertDto,
  PlatformStatsDto,
  TenantDetailDto,
  CreateTenantDto,
  UpdateTenantPlanDto,
  CustomerProfileDto,
  UpdateCustomerProfileDto,
  CustomerLoyaltyHistoryDto,
  CreatePayOSPaymentRequest,
  PayOSPaymentDto,
  PayOSStatusCheckDto,
  CreatePaymentDto,
  PaymentResultDto,
  StorePaymentConfigDto,
  UpdateStorePaymentConfigDto,
  TestStorePaymentConfigRequest,
  TestPaymentConfigResultDto
} from '../types/apiTypes';

// Menu API
export const menuApi = {
  getStoreMenu: async (storeId: number) => {
    const res = await apiClient.get<ApiResponse<StoreMenuResponse>>(`/Menu/store/${storeId}`);
    return res.data.data;
  },
  getCategories: async () => {
    const res = await apiClient.get<ApiResponse<CategoryDto[]>>('/Menu/categories');
    return res.data.data;
  },
  getMenuItems: async (categoryId?: number) => {
    const res = await apiClient.get<ApiResponse<MenuItemDto[]>>('/Menu/items', {
      params: { categoryId }
    });
    return res.data.data;
  },
  getMenuItemById: async (id: number) => {
    const res = await apiClient.get<ApiResponse<MenuItemDto>>(`/Menu/items/${id}`);
    return res.data.data;
  }
};

// Order API
export const orderApi = {
  createOrder: async (dto: CreateOrderDto) => {
    const res = await apiClient.post<ApiResponse<OrderDto>>('/orders', dto);
    return res.data.data;
  },
  getOrderById: async (id: number) => {
    const res = await apiClient.get<ApiResponse<OrderDto>>(`/orders/${id}`);
    return res.data.data;
  },
  getOrderByCode: async (code: string) => {
    const encodedCode = encodeURIComponent(code);
    const paymentAccessToken = typeof window !== 'undefined'
      ? sessionStorage.getItem(`webcafe_payment_access_code_${code}`) || undefined
      : undefined;
    const res = await apiClient.get<ApiResponse<OrderDto>>(`/orders/code/${encodedCode}`, {
      params: { paymentAccessToken }
    });
    return res.data.data;
  },
  getActiveOrders: async (storeId: number) => {
    const res = await apiClient.get<ApiResponse<OrderDto[]>>(`/orders/active/store/${storeId}`);
    return res.data.data;
  },
  searchOrders: async (storeId: number, pageNumber = 1, pageSize = 20, status?: string) => {
    const res = await apiClient.get<ApiResponse<PaginationRes<OrderDto>>>(`/orders/store/${storeId}`, {
      params: { pageNumber, pageSize, status }
    });
    return res.data.data;
  },
  updateStatus: async (orderId: number, status: string) => {
    const res = await apiClient.put<ApiResponse<OrderDto>>(`/orders/${orderId}/status`, { status });
    return res.data.data;
  }
};

// Auth API
export const authApi = {
  loginStaff: async (data: LoginRequest) => {
    const res = await apiClient.post<ApiResponse<LoginResponse>>('/Auth/login', data);
    return res.data.data;
  },
  loginOwner: async (data: LoginRequest) => {
    const res = await apiClient.post<ApiResponse<LoginResponse>>('/Auth/owner-login', data);
    return res.data.data;
  },
  signupOwner: async (data: OwnerSignupRequest) => {
    const res = await apiClient.post<ApiResponse<OwnerSignupResponse>>('/Auth/signup', data);
    return res.data.data;
  },
  verifyOwnerEmail: async (token: string) => {
    const res = await apiClient.get<ApiResponse<LoginResponse>>('/Auth/verify-owner', { params: { token } });
    return res.data.data;
  }
};

// Table API
export const tableApi = {
  getTablesByStore: async (storeId: number) => {
    const res = await apiClient.get<ApiResponse<TableDto[]>>(`/Tables/store/${storeId}`);
    return res.data.data;
  },
  updateStatus: async (tableId: number, status: string) => {
    const res = await apiClient.put<ApiResponse<TableDto>>(`/Tables/${tableId}/status`, { status });
    return res.data.data;
  },
  resolveQr: async (qrToken: string) => {
    const res = await apiClient.get<ApiResponse<{
      storeId: number;
      tableId: number;
      qrToken?: string;
      tableNumber: string;
      storeName: string;
      tenantName: string;
    }>>(`/Tables/qr/${encodeURIComponent(qrToken)}`);
    return res.data.data;
  },
  resolveLegacyQr: async (storeId: number, tableId: number) => {
    const res = await apiClient.get<ApiResponse<{
      storeId: number;
      tableId: number;
      qrToken?: string;
      tableNumber: string;
      storeName: string;
      tenantName: string;
    }>>(`/Tables/resolve/${storeId}/${tableId}`);
    return res.data.data;
  },
  resolveLegacyByNumber: async (storeId: number, tableNumber: string) => {
    const res = await apiClient.get<ApiResponse<{
      storeId: number;
      tableId: number;
      qrToken?: string;
      tableNumber: string;
      storeName: string;
      tenantName: string;
    }>>(`/Tables/resolve-by-number/${storeId}/${encodeURIComponent(tableNumber)}`);
    return res.data.data;
  },
  regenerateQr: async (tableId: number) => {
    const res = await apiClient.post<ApiResponse<TableDto>>(`/Tables/${tableId}/qr/regenerate`);
    return res.data.data;
  }
};

// Public product demo API. The backend returns only the isolated demo table.
export const demoApi = {
  getInfo: async () => {
    const res = await apiClient.get<ApiResponse<{
      tenantId: number;
      storeId: number;
      storeName: string;
      tableId: number;
      tableNumber: string;
      qrToken: string;
    }>>('/demo/info');
    return res.data.data;
  },
  getBackoffice: async (): Promise<DemoBackofficeSnapshot> => {
    const res = await apiClient.get<ApiResponse<DemoBackofficeSnapshot>>('/demo/backoffice');
    return res.data.data;
  }
};

export interface DemoBackofficeSnapshot {
  storeName: string;
  sampleLabel: string;
  categories: { categoryId: number; name: string }[];
  menu: { menuItemId: number; name: string; basePrice: number; isAvailable: boolean; isFeatured: boolean; categoryId: number; categoryName: string; imageUrl?: string | null }[];
  tables: { tableId: number; tableNumber: string; capacity: number; status: string }[];
  inventory: { ingredientId: number; name: string; unit: string; minimumStock: number; currentQuantity: number }[];
  sampleOrders: { orderCode: string; tableNumber: string; guestName: string; status: string; totalAmount: number; minutesAgo: number; items: { name: string; quantity: number }[] }[];
  sampleStaff: { name: string; role: string; shift: string; status: string }[];
  sampleRevenue: number[];
}

export const meApi = {
  getStores: async () => {
    const res = await apiClient.get<ApiResponse<Array<{ storeId: number; name: string; isActive: boolean }>>>('/me/stores');
    return res.data.data;
  },
  getSubscription: async () => {
    const res = await apiClient.get<ApiResponse<MySubscriptionDto>>('/me/subscription');
    return res.data.data;
  },
  getPlans: async () => {
    const res = await apiClient.get<ApiResponse<SubscriptionPlanDto[]>>('/me/subscription/plans');
    return res.data.data ?? [];
  },
};

export const staffApi = {
  list: async (storeId: number) => {
    const res = await apiClient.get<ApiResponse<StaffDto[]>>('/staff', { params: { storeId } });
    return res.data.data ?? [];
  },
  create: async (data: CreateStaffRequest) => {
    const res = await apiClient.post<ApiResponse<StaffDto>>('/staff', data);
    return res.data.data;
  },
  update: async (staffId: number, data: UpdateStaffRequest) => {
    const res = await apiClient.put<ApiResponse<StaffDto>>(`/staff/${staffId}`, data);
    return res.data.data;
  },
  updateStatus: async (staffId: number, isActive: boolean) => {
    const res = await apiClient.patch<ApiResponse<StaffDto>>(`/staff/${staffId}/status`, { isActive });
    return res.data.data;
  },
  remove: async (staffId: number) => {
    await apiClient.delete<ApiResponse<object>>(`/staff/${staffId}`);
  }
};

// Voucher API
export const voucherApi = {
  checkVoucher: async (data: CheckVoucherRequest) => {
    const res = await apiClient.post<ApiResponse<VoucherValidationResult>>('/Vouchers/check', data);
    return res.data.data;
  }
};

// Analytics API
export const analyticsApi = {
  getDashboardStats: async (storeId: number) => {
    const res = await apiClient.get<ApiResponse<DashboardStatsDto>>(`/Analytics/dashboard/store/${storeId}`);
    return res.data.data;
  },
  getShiftOperations: async (storeId: number) => {
    const res = await apiClient.get<ApiResponse<ShiftOperationsDto>>(`/Analytics/shift-operations/store/${storeId}`);
    return res.data.data;
  },
  getBusinessReport: async (storeId: number, fromDate?: string, toDate?: string) => {
    const res = await apiClient.get<ApiResponse<BusinessAnalyticsReportDto>>(`/Analytics/business-report/store/${storeId}`, {
      params: { fromDate, toDate }
    });
    return res.data.data;
  },
  getMenuEngineering: async (storeId: number, fromDate?: string, toDate?: string) => {
    const res = await apiClient.get<ApiResponse<MenuEngineeringSummaryDto>>(`/Analytics/menu-engineering/store/${storeId}`, {
      params: { fromDate, toDate }
    });
    return res.data.data;
  },
  getRevenueReport: async (storeId: number, fromDate: string, toDate: string) => {
    const res = await apiClient.get<ApiResponse<RevenueReportDto>>(`/Analytics/revenue/store/${storeId}`, {
      params: { fromDate, toDate }
    });
    return res.data.data;
  },
  getCustomerAnalytics: async (tenantId: number, fromDate?: string, toDate?: string) => {
    const res = await apiClient.get<ApiResponse<CustomerAnalyticsDto>>(`/Analytics/customers/tenant/${tenantId}`, {
      params: { fromDate, toDate }
    });
    return res.data.data;
  },
  getCategoryPerformance: async (tenantId: number, fromDate?: string, toDate?: string) => {
    const res = await apiClient.get<ApiResponse<CategoryPerformanceDto[]>>(`/Analytics/categories/tenant/${tenantId}`, {
      params: { fromDate, toDate }
    });
    return res.data.data;
  }
};

// AI SmartServe API
export const aiApi = {
  getRecommendations: async (dto: AiRecommendationRequestDto) => {
    const res = await apiClient.post<ApiResponse<AiRecommendationResponseDto>>('/AI/recommend', dto);
    return res.data.data;
  },
  chatWithSommelier: async (dto: AiChatRequestDto) => {
    const res = await apiClient.post<ApiResponse<AiChatResponseDto>>('/AI/chat', dto);
    return res.data.data;
  }
};

// Inventory API (FnB 4-Modules System)
export const inventoryApi = {
  getAiSummary: async (storeId: number, periodDays = 30) => {
    const res = await apiClient.get<ApiResponse<InventoryAiChatResponseDto>>('/inventory/ai/summary', { params: { storeId, periodDays } });
    return res.data.data;
  },
  chatWithAi: async (dto: InventoryAiChatRequestDto) => {
    const res = await apiClient.post<ApiResponse<InventoryAiChatResponseDto>>('/inventory/ai/chat', dto);
    return res.data.data;
  },
  getStocks: async (storeId: number) => {
    const res = await apiClient.get<ApiResponse<InventoryStockDto[]>>(`/inventory/store/${storeId}`);
    return res.data.data;
  },
  getIngredients: async (tenantId: number = 1, storeId?: number) => {
    const res = await apiClient.get<ApiResponse<IngredientDto[]>>('/inventory/ingredients', {
      params: { tenantId, storeId }
    });
    return res.data.data;
  },
  createIngredient: async (dto: CreateIngredientDto) => {
    const res = await apiClient.post<ApiResponse<IngredientDto>>('/inventory/ingredients', dto);
    return res.data.data;
  },
  updateIngredient: async (id: number, dto: UpdateIngredientDto) => {
    const res = await apiClient.put<ApiResponse<IngredientDto>>(`/inventory/ingredients/${id}`, dto);
    return res.data.data;
  },
  deleteIngredient: async (id: number) => {
    const res = await apiClient.delete<ApiResponse<object>>(`/inventory/ingredients/${id}`);
    return res.data;
  },
  importStock: async (dto: ImportInventoryDto) => {
    const res = await apiClient.post<ApiResponse<object>>('/inventory/import', dto);
    return res.data;
  },
  adjustStock: async (dto: AdjustInventoryDto) => {
    const res = await apiClient.post<ApiResponse<object>>('/inventory/adjust', dto);
    return res.data;
  },
  getTransactions: async (storeId: number, params?: { ingredientId?: number; fromDate?: string; toDate?: string }) => {
    const res = await apiClient.get<ApiResponse<InventoryTransactionDto[]>>(`/inventory/transactions/store/${storeId}`, {
      params
    });
    return res.data.data;
  },
  getMenuItemRecipes: async (menuItemId: number) => {
    const res = await apiClient.get<ApiResponse<MenuItemRecipeDto[]>>(`/inventory/recipes/menu-item/${menuItemId}`);
    return res.data.data;
  },
  upsertRecipe: async (dto: UpsertRecipeDto) => {
    const res = await apiClient.post<ApiResponse<object>>('/inventory/recipes/menu-item', dto);
    return res.data;
  },
  deleteRecipe: async (recipeId: number) => {
    const res = await apiClient.delete<ApiResponse<object>>(`/inventory/recipes/${recipeId}`);
    return res.data;
  },
  getLowStockAlerts: async (storeId: number) => {
    const res = await apiClient.get<ApiResponse<LowStockAlertDto[]>>(`/inventory/alerts/store/${storeId}`);
    return res.data.data;
  }
};

// Super Admin Platform API
export const systemAdminApi = {
  getPlatformStats: async () => {
    const res = await apiClient.get<ApiResponse<PlatformStatsDto>>('/system/stats');
    return res.data.data;
  },
  getTenants: async () => {
    const res = await apiClient.get<ApiResponse<TenantDetailDto[]>>('/system/tenants');
    return res.data.data;
  },
  createTenant: async (payload: CreateTenantDto) => {
    const res = await apiClient.post<ApiResponse<TenantDetailDto>>('/system/tenants', payload);
    return res.data.data;
  },
  toggleTenantStatus: async (tenantId: number) => {
    const res = await apiClient.put<ApiResponse<any>>(`/system/tenants/${tenantId}/toggle-status`);
    return res.data;
  },
  deleteTrialTenant: async (tenantId: number) => {
    const res = await apiClient.delete<ApiResponse<any>>(`/system/tenants/${tenantId}`);
    return res.data;
  },
  updateTenantPlan: async (tenantId: number, payload: UpdateTenantPlanDto) => {
    const res = await apiClient.put<ApiResponse<any>>(`/system/tenants/${tenantId}/plan`, payload);
    return res.data;
  },
  getPlans: async () => {
    const res = await apiClient.get<ApiResponse<any[]>>('/system/plans');
    return res.data.data;
  },
  updatePlan: async (code: string, payload: any) => {
    const res = await apiClient.put<ApiResponse<any>>(`/system/plans/${encodeURIComponent(code)}`, payload);
    return res.data.data;
  }
};

// Customer API
export const customerApi = {
  getProfile: async (options?: string | { phone?: string; storeId?: number }) => {
    let params: { phone?: string; storeId?: number } | undefined = undefined;
    if (typeof options === 'string') {
      params = { phone: options };
    } else if (options) {
      params = options;
    }
    const res = await apiClient.get<ApiResponse<CustomerProfileDto>>('/customer/profile', {
      params
    });
    return res.data.data;
  },
  updateProfile: async (data: UpdateCustomerProfileDto) => {
    const res = await apiClient.put<ApiResponse<CustomerProfileDto>>('/customer/profile', data);
    return res.data.data;
  },
  getOrders: async (params?: { phone?: string; pageNumber?: number; pageSize?: number; status?: string; storeId?: number; tenantId?: number }) => {
    const res = await apiClient.get<ApiResponse<PaginationRes<OrderDto>>>('/customer/orders', {
      params
    });
    return res.data.data;
  },
  getLoyaltyHistory: async (params?: { phone?: string; pageNumber?: number; pageSize?: number }) => {
    const res = await apiClient.get<ApiResponse<PaginationRes<CustomerLoyaltyHistoryDto>>>('/customer/loyalty-history', {
      params
    });
    return res.data.data;
  }
};

// Payment & PayOS Gateway API
export const paymentApi = {
  processPayment: async (payload: CreatePaymentDto) => {
    const res = await apiClient.post<ApiResponse<PaymentResultDto>>('/payments', payload);
    return res.data.data;
  },
  createPayOSPayment: async (payload: CreatePayOSPaymentRequest) => {
    const res = await apiClient.post<ApiResponse<PayOSPaymentDto>>('/payments/payos/create-link', payload);
    return res.data.data;
  },
  getPayOSStatus: async (orderCode: number, paymentAccessToken?: string) => {
    const res = await apiClient.get<ApiResponse<PayOSStatusCheckDto>>(`/payments/payos/status/${orderCode}`, { params: { paymentAccessToken } });
    return res.data.data;
  },
  cancelPayOSPayment: async (orderCode: number, reason?: string) => {
    const res = await apiClient.post<ApiResponse<any>>(`/payments/payos/cancel/${orderCode}`, null, {
      params: { reason }
    });
    return res.data;
  },
  createVietQRPayment: async (orderId: number, paymentAccessToken?: string) => {
    const res = await apiClient.post<ApiResponse<any>>('/payments/vietqr/create', { orderId, paymentAccessToken });
    return res.data.data;
  },
  getVietQRStatus: async (orderId: number, paymentAccessToken?: string) => {
    const res = await apiClient.get<ApiResponse<any>>(`/payments/vietqr/status/${orderId}`, { params: { paymentAccessToken } });
    return res.data.data;
  },
  getStorePaymentConfig: async (storeId: number) => {
    const res = await apiClient.get<ApiResponse<StorePaymentConfigDto>>(`/payments/store/${storeId}/config`);
    return res.data.data;
  },
  updateStorePaymentConfig: async (storeId: number, payload: UpdateStorePaymentConfigDto) => {
    const res = await apiClient.put<ApiResponse<StorePaymentConfigDto>>(`/payments/store/${storeId}/config`, payload);
    return res.data.data;
  },
  testStorePaymentConfig: async (payload: TestStorePaymentConfigRequest) => {
    const res = await apiClient.post<ApiResponse<TestPaymentConfigResultDto>>('/payments/store/test-connection', payload);
    return res.data.data;
  }
};
