export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  errors?: Record<string, string[]> | null;
}

export interface PaginationRes<T> {
  items: T[];
  pageNumber: number;
  pageSize: number;
  totalRecords: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
}

// --- Menu Types ---
export interface CategoryDto {
  categoryId: number;
  tenantId: number;
  name: string;
  icon?: string | null;
  sortOrder: number;
  isActive: boolean;
}

export interface SizeDto {
  sizeId: number;
  name: string;
  extraPrice: number;
}

export interface ToppingDto {
  toppingId: number;
  name: string;
  price: number;
  isAvailable: boolean;
}

export interface MenuItemDto {
  menuItemId: number;
  tenantId: number;
  categoryId: number;
  categoryName: string;
  name: string;
  description?: string | null;
  basePrice: number;
  imageUrl?: string | null;
  rating: number;
  isFeatured: boolean;
  isAvailable: boolean;
  sortOrder: number;
  sizes: SizeDto[];
  toppings: ToppingDto[];
}

export interface StoreMenuResponse {
  storeId: number;
  tenantId: number;
  storeName: string;
  address?: string | null;
  phone?: string | null;
  bankAccount?: string | null;
  bankName?: string | null;
  bankAccountName?: string | null;
  brandName: string;
  logoUrl?: string | null;
  categories: CategoryDto[];
  menuItems: MenuItemDto[];
}

// --- Order Types ---
export interface CreateOrderItemToppingDto {
  toppingId: number;
}

export interface CreateOrderItemDto {
  menuItemId: number;
  sizeId?: number | null;
  quantity: number;
  sugarLevel: string;
  iceLevel: string;
  note?: string | null;
  toppings?: CreateOrderItemToppingDto[];
}

export interface CreateOrderDto {
  storeId: number;
  tableId?: number | null;
  tableToken?: string | null;
  customerPhone?: string | null;
  customerName?: string | null;
  guestId?: string | null;
  guestName?: string | null;
  guestPhone?: string | null;
  source?: 'qr_table' | 'pos_staff';
  paymentMethod?: 'cash' | 'payos' | 'unpaid' | string | null;
  voucherCode?: string | null;
  pointsToUse: number;
  note?: string | null;
  items: CreateOrderItemDto[];
}

export interface OrderItemToppingDto {
  orderItemToppingId: number;
  toppingId: number;
  toppingName: string;
  price: number;
}

export interface OrderItemDto {
  orderItemId: number;
  menuItemId: number;
  menuItemName: string;
  imageUrl?: string | null;
  sizeId?: number | null;
  sizeName?: string | null;
  quantity: number;
  unitPrice: number;
  toppingTotal: number;
  subTotal: number;
  sugarLevel: string;
  iceLevel: string;
  note?: string | null;
  toppings: OrderItemToppingDto[];
}

export interface OrderDto {
  orderId: number;
  tenantId: number;
  tenantName?: string;
  storeId: number;
  storeName: string;
  orderCode: string;
  tableId?: number | null;
  tableNumber?: string | null;
  customerId?: number | null;
  customerName?: string | null;
  customerPhone?: string | null;
  guestId?: string | null;
  guestName?: string | null;
  guestPhone?: string | null;
  paymentAccessToken?: string | null;
  status: 'awaiting_payment' | 'pending' | 'confirmed' | 'preparing' | 'ready' | 'served' | 'paid' | 'completed' | 'cancelled' | 'done';
  subTotal: number;
  discountAmount: number;
  pointsUsed: number;
  pointsEarned: number;
  totalAmount: number;
  note?: string | null;
  createdAt: string;
  items: OrderItemDto[];
}

// --- Table Types ---
export interface TableDto {
  tableId: number;
  storeId: number;
  tableNumber: string;
  capacity: number;
  location?: string | null;
  qrCodeUrl?: string | null;
  qrToken?: string | null;
  status: 'Available' | 'Occupied' | 'Reserved';
  isActive: boolean;
  activeOrderId?: number | null;
  activeOrderCode?: string | null;
}

// --- Auth Types ---
export interface LoginRequest {
  username: string;
  password: string;
  storeId?: number;
}

export interface LoginResponse {
  token: string;
  username: string;
  fullName: string;
  role: string;
  tenantId: number;
  storeId?: number | null;
  storeName?: string | null;
  brandName?: string | null;
}

export interface OwnerSignupRequest {
  email: string;
  password: string;
  storeName: string;
  phone?: string;
  plan?: string;
}

export interface OwnerSignupResponse {
  tenantId: number;
  storeId: number;
  email: string;
  plan: string;
  trialEndsAt: string;
  emailVerificationRequired: boolean;
  emailSent: boolean;
  verificationUrl?: string | null;
}

export interface MySubscriptionDto {
  plan: string;
  status: string;
  trialEndsAt?: string | null;
  daysRemaining?: number | null;
  maxStores?: number;
  maxStaff?: number;
  maxTablesPerStore?: number;
  storesUsed?: number;
  staffUsed?: number;
  tablesUsed?: number;
  features?: Record<string, boolean>;
}

export interface SubscriptionPlanDto {
  code: string;
  name: string;
  monthlyPrice: number;
  maxStores: number;
  maxStaff: number;
  maxTablesPerStore: number;
  isActive: boolean;
  features: Record<string, boolean>;
}

export interface StaffDto {
  staffId: number;
  storeId: number;
  storeName: string;
  username: string;
  fullName: string;
  email?: string | null;
  phone?: string | null;
  role: 'Staff';
  isActive: boolean;
  createdAt: string;
}

export interface CreateStaffRequest {
  storeId: number;
  username: string;
  fullName: string;
  email?: string;
  phone?: string;
  password: string;
}

export interface UpdateStaffRequest {
  storeId: number;
  fullName: string;
  email?: string;
  phone?: string;
  password?: string;
}

// --- Voucher Types ---
export interface CheckVoucherRequest {
  code: string;
  storeId: number;
  orderAmount: number;
  customerPhone?: string | null;
}

export interface VoucherValidationResult {
  isValid: boolean;
  message: string;
  voucherId?: number | null;
  code: string;
  title: string;
  discountType: 'percent' | 'fixed';
  discountAmount: number;
  finalAmount: number;
}

// --- Analytics Types ---
export interface TopProductDto {
  menuItemId: number;
  name: string;
  imageUrl?: string | null;
  categoryName?: string;
  soldCount: number;
  totalRevenue: number;
}

export interface DailyRevenueDto {
  date: string;
  revenue: number;
  ordersCount: number;
  estimatedProfit?: number;
}

export interface RevenueReportDto {
  storeId: number;
  fromDate: string;
  toDate: string;
  totalRevenue: number;
  totalOrders: number;
  dailyRevenue: DailyRevenueDto[];
}

export interface DashboardStatsDto {
  todayRevenue: number;
  todayOrders: number;
  totalCustomers: number;
  availableTables: number;
  occupiedTables: number;
  topProducts: TopProductDto[];
  revenueChart: DailyRevenueDto[];
}

// --- Shift Operations Types (/admin) ---
export interface ActiveTableStatusDto {
  tableId: number;
  tableNumber: string;
  capacity: number;
  status: 'Available' | 'Occupied' | 'Reserved';
  activeOrderId?: number | null;
  activeOrderCode?: string | null;
  itemCount: number;
  totalAmount: number;
  occupiedMinutes: number;
  isLongStaying: boolean;
}

export interface ShiftStockAlertDto {
  ingredientId: number;
  ingredientName: string;
  currentQuantity: number;
  minThreshold: number;
  unit: string;
  severity: 'Critical' | 'Warning';
}

export interface HourlyTrafficDto {
  hour: number;
  timeLabel: string;
  revenue: number;
  orderCount: number;
  isPeakHour: boolean;
}

export interface ShiftOperationsDto {
  storeId: number;
  storeName: string;
  shiftDate: string;
  todayRevenue: number;
  yesterdayRevenueSameTime: number;
  revenueGrowthPercent: number;
  cashRevenue: number;
  bankTransferRevenue: number;
  todayOrdersCount: number;
  pendingOrdersCount: number;
  preparingOrdersCount: number;
  readyOrdersCount: number;
  servedOrdersCount: number;
  avgFulfillmentMinutes: number;
  totalTables: number;
  occupiedTables: number;
  availableTables: number;
  tableOccupancyPercent: number;
  activeTablesList: ActiveTableStatusDto[];
  lowStockAlerts: ShiftStockAlertDto[];
  hourlyTraffic: HourlyTrafficDto[];
  topProductsToday: TopProductDto[];
}

// --- Business Analytics & Menu Engineering Types (/admin/analytics) ---
export interface MenuEngineeringItemDto {
  menuItemId: number;
  name: string;
  categoryName: string;
  imageUrl?: string | null;
  basePrice: number;
  estimatedCost: number;
  marginPerUnit: number;
  marginPercent: number;
  soldCount: number;
  totalRevenue: number;
  totalProfit: number;
  classification: 'Star' | 'Plowhorse' | 'Puzzle' | 'Dog';
  strategicRecommendation: string;
}

export interface MenuEngineeringSummaryDto {
  stars: MenuEngineeringItemDto[];
  plowhorses: MenuEngineeringItemDto[];
  puzzles: MenuEngineeringItemDto[];
  dogs: MenuEngineeringItemDto[];
}

export interface ChannelSalesDto {
  channel: string;
  orderCount: number;
  revenue: number;
  percentage: number;
}

export interface PaymentMethodStatsDto {
  method: string;
  count: number;
  totalAmount: number;
  percentage: number;
}

export interface CategoryPerformanceDto {
  categoryId: number;
  categoryName: string;
  totalSold: number;
  totalRevenue: number;
  orderCount: number;
  percentage: number;
}

export interface TopCustomerDto {
  customerId: number;
  name: string;
  phone: string;
  totalSpent: number;
  visitCount: number;
  totalPoints: number;
}

export interface CustomerAnalyticsDto {
  totalCustomers: number;
  newCustomers: number;
  activeCustomers: number;
  retentionRate: number;
  topCustomers: TopCustomerDto[];
}

export interface BusinessAnalyticsReportDto {
  fromDate: string;
  toDate: string;
  storeId: number;
  grossRevenue: number;
  totalDiscount: number;
  netRevenue: number;
  estimatedCOGS: number;
  grossProfit: number;
  grossMarginPercent: number;
  totalOrders: number;
  averageOrderValue: number;
  averageSpendPerCustomer: number;
  dailyTrend: DailyRevenueDto[];
  categoryBreakdown: CategoryPerformanceDto[];
  paymentMethodBreakdown: PaymentMethodStatsDto[];
  channelBreakdown: ChannelSalesDto[];
  menuEngineering: MenuEngineeringSummaryDto;
  customerAnalytics: CustomerAnalyticsDto;
}

// --- Cart Item State (Local) ---
export interface CartItemState {
  cartItemId: string; // unique for cart item (same menuItemId + sizeId + toppings)
  menuItem: MenuItemDto;
  selectedSize?: SizeDto | null;
  selectedToppings: ToppingDto[];
  sugarLevel: string;
  iceLevel: string;
  quantity: number;
  note?: string;
  itemPrice: number; // base + size extra + toppings
  subTotal: number;
}

// --- AI Recommendation Types ---
export interface AiRecommendationRequestDto {
  storeId: number;
  tenantId: number;
  customerId?: number | null;
  currentCartItemIds?: number[];
  occasion?: string | null;
  moodOrPreference?: string | null;
}

export interface AiRecommendedItemDto {
  menuItemId: number;
  name: string;
  imageUrl?: string | null;
  price: number;
  categoryName: string;
  reason: string;
  pairingTip?: string | null;
  badge: string;
  confidenceScore: number;
  suggestedSugarLevel?: string | null;
  suggestedIceLevel?: string | null;
  suggestedSize?: string | null;
  isDrink?: boolean;
}

export interface AiRecommendedComboDto {
  title: string;
  description: string;
  itemIds: number[];
  items: AiRecommendedItemDto[];
  originalPrice: number;
  discountedPrice: number;
  discountPercent: number;
  tag: string;
}

export interface AiRecommendationResponseDto {
  isAiGenerated: boolean;
  modelUsed: string;
  headline: string;
  chefNote: string;
  recommendations: AiRecommendedItemDto[];
  combos: AiRecommendedComboDto[];
}

// --- AI Sommelier Chat Types ---
export interface AiChatMessageDto {
  role: 'user' | 'model';
  content: string;
  timestamp?: string;
}

export interface AiChatRequestDto {
  storeId: number;
  tenantId: number;
  customerId?: number | null;
  message: string;
  history?: AiChatMessageDto[];
  currentCartItemIds?: number[];
}

export interface AiChatResponseDto {
  reply: string;
  suggestedItems: AiRecommendedItemDto[];
  quickFollowUps: string[];
  isAiGenerated: boolean;
  modelUsed: string;
}

export interface InventoryAiChatRequestDto {
  storeId: number;
  message: string;
  periodDays?: number;
  history?: AiChatMessageDto[];
}

export interface InventoryAiRecommendationDto {
  ingredientName: string;
  suggestedQuantity: number;
  unit: string;
  priority: string;
  reason: string;
}

export interface InventoryAiChatResponseDto {
  reply: string;
  recommendations: InventoryAiRecommendationDto[];
  quickFollowUps: string[];
  isAiGenerated: boolean;
  storeName: string;
  periodDays: number;
  topSellingItems: { menuItemId: number; menuItemName: string; soldQuantity: number }[];
}

// --- Inventory Types ---
export interface IngredientDto {
  ingredientId: number;
  tenantId: number;
  name: string;
  unit: string;
  minimumStock: number;
  description?: string | null;
  isActive: boolean;
  currentStock: number;
  createdAt: string;
}

export interface CreateIngredientDto {
  tenantId: number;
  storeId: number;
  name: string;
  unit: string;
  minimumStock: number;
  initialStock: number;
  description?: string;
}

export interface UpdateIngredientDto {
  name: string;
  unit: string;
  minimumStock: number;
  description?: string;
  isActive: boolean;
}

export interface InventoryStockDto {
  stockId: number;
  ingredientId: number;
  ingredientName: string;
  unit: string;
  currentQuantity: number;
  minimumStock: number;
  isLowStock: boolean;
  lastUpdated?: string | null;
}

export interface InventoryTransactionDto {
  transactionId: number;
  ingredientName: string;
  type: string; // import, export, deduction, adjustment
  quantity: number;
  quantityBefore: number;
  quantityAfter: number;
  orderCode?: string | null;
  staffName?: string | null;
  note?: string | null;
  createdAt: string;
}

export interface ImportInventoryDto {
  storeId: number;
  ingredientId: number;
  quantity: number;
  note?: string;
}

export interface AdjustInventoryDto {
  storeId: number;
  ingredientId: number;
  newQuantity: number;
  note?: string;
}

export interface MenuItemRecipeDto {
  recipeId: number;
  menuItemId: number;
  menuItemName: string;
  ingredientId: number;
  ingredientName: string;
  unit: string;
  sizeId?: number | null;
  sizeName?: string | null;
  quantityRequired: number;
}

export interface UpsertRecipeDto {
  menuItemId: number;
  ingredientId: number;
  sizeId?: number | null;
  quantityRequired: number;
}

export interface LowStockAlertDto {
  stockId: number;
  ingredientId: number;
  ingredientName: string;
  unit: string;
  currentQuantity: number;
  minimumStock: number;
  deficit: number;
  lastUpdated?: string | null;
}

// --- Super Admin SaaS Platform Types ---
export interface SystemDailyRevenueDto {
  date: string;
  dayLabel: string;
  revenue: number;
  orderCount: number;
}

export interface PlatformStatsDto {
  totalTenants: number;
  activeTenants: number;
  totalStores: number;
  totalTables: number;
  totalOrders: number;
  totalGmv: number;
  monthlySubscriptionRevenue: number;
  dailyRevenue?: SystemDailyRevenueDto[];
}

export interface TenantDetailDto {
  tenantId: number;
  name: string;
  slug: string;
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string;
  logoUrl?: string | null;
  plan: string;
  maxStores: number;
  isActive: boolean;
  createdAt: string;
  storeCount: number;
  tableCount: number;
  orderCount: number;
  totalGmv: number;
}

export interface CreateTenantDto {
  name: string;
  slug?: string;
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string;
  ownerPassword: string;
  logoUrl?: string;
  plan?: string;
  maxStores?: number;
  initialStoreName?: string;
  initialStoreAddress?: string;
  initialStorePhone?: string;
}

export interface UpdateTenantPlanDto {
  plan: string;
  maxStores: number;
}

export interface TenantLoyaltyDto {
  tenantId: number;
  tenantName: string;
  totalPoints: number;
  totalSpent: number;
  pointsToMoney: number;
}

// --- Customer Types ---
export interface CustomerProfileDto {
  customerId: number;
  tenantId: number;
  tenantName?: string;
  phone: string;
  name: string;
  totalPoints: number;
  totalSpent: number;
  visitCount: number;
  pointsToMoney: number;
  pointsPerAmount: number;
  createdAt: string;
  lastVisitAt?: string | null;
  tenantPoints?: TenantLoyaltyDto[];
}

export interface UpdateCustomerProfileDto {
  phone?: string;
  newPhone?: string;
  name?: string;
}

export interface CustomerLoyaltyHistoryDto {
  pointId: number;
  customerId: number;
  orderId?: number | null;
  points: number;
  type: string;
  description?: string | null;
  createdAt: string;
}

// --- PayOS Payment Gateway Types ---
export interface CreatePayOSPaymentRequest {
  orderId?: number;
  paymentAccessToken?: string;
  orderCode?: string;
  returnUrl?: string;
  cancelUrl?: string;
}

export interface PayOSPaymentDto {
  paymentId: number;
  orderId: number;
  orderCode: string;
  payOSOrderCode: number;
  amount: number;
  status: string;
  checkoutUrl?: string;
  qrCode?: string;
  paymentLinkId?: string;
  accountNumber?: string;
  accountName?: string;
  bin?: string;
  description?: string;
  storeBankAccount?: string;
  storeBankName?: string;
  createdAt: string;
}

export interface PayOSStatusCheckDto {
  orderCode: number;
  orderId: number;
  status: string; // PENDING, PAID, CANCELLED
  amount: number;
  amountPaid: number;
  amountRemaining: number;
  isSuccess: boolean;
  message?: string;
}

export interface CreatePaymentDto {
  orderId: number;
  method: 'cash' | 'bank_transfer' | 'momo' | 'vnpay' | string;
  amount: number;
  transactionRef?: string;
}

export interface PaymentResultDto {
  paymentId: number;
  orderId: number;
  method: string;
  amount: number;
  status: string;
  qrCodeUrl?: string;
  message?: string;
}

export interface StorePaymentConfigDto {
  storeId: number;
  storeName: string;
  hasCustomPayOS: boolean;
  payOSClientId?: string;
  maskedApiKey?: string;
  maskedChecksumKey?: string;
  bankAccount?: string;
  bankName?: string;
  bankAccountName?: string;
}

export interface UpdateStorePaymentConfigDto {
  payOSClientId?: string;
  payOSApiKey?: string;
  payOSChecksumKey?: string;
  bankAccount?: string;
  bankName?: string;
  bankAccountName?: string;
}

export interface TestStorePaymentConfigRequest {
  clientId: string;
  apiKey: string;
  checksumKey: string;
}

export interface TestPaymentConfigResultDto {
  isValid: boolean;
  message: string;
  accountName?: string;
  accountNumber?: string;
}

