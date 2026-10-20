using WebCafe.Backend.Common.Models;
using WebCafe.Backend.Models.DTOs.Analytics;
using WebCafe.Backend.Models.DTOs.Auth;
using WebCafe.Backend.Models.DTOs.Inventory;
using WebCafe.Backend.Models.DTOs.Menu;
using WebCafe.Backend.Models.DTOs.Order;
using WebCafe.Backend.Models.DTOs.Payment;
using WebCafe.Backend.Models.DTOs.Table;
using WebCafe.Backend.Models.DTOs.Voucher;
using WebCafe.Backend.Services.Implementation;

namespace WebCafe.Backend.Services.Abstraction
{
    public interface IAuthService
    {
        Task<LoginResponse> LoginStaffAsync(LoginRequest request);
        Task<LoginResponse> LoginTenantOwnerAsync(LoginRequest request);
        Task<LoginResponse> LoginSystemAdminAsync(LoginRequest request);
        Task<LoginResponse> LoginCustomerAsync(LoginRequest request);
        Task<RegisterResponse> RegisterCustomerAsync(RegisterRequest request);
        Task<OwnerSignupResponse> SignupOwnerAsync(OwnerSignupRequest request);
        Task<LoginResponse> VerifyOwnerEmailAsync(string token);
    }

    public interface IEmailService
    {
        Task SendVerificationEmailAsync(string recipient, string verificationUrl, CancellationToken cancellationToken = default);
    }

    public interface ICategoryService
    {
        Task<List<CategoryDto>> GetCategoriesByTenantAsync(int tenantId);
        Task<CategoryDto> CreateCategoryAsync(int tenantId, CreateCategoryDto dto);
        Task DeleteCategoryAsync(int tenantId, int categoryId);
    }

    public interface IMenuItemService
    {
        Task<StoreMenuResponse> GetMenuByStoreAsync(int storeId);
        Task<List<MenuItemDto>> GetMenuItemsByTenantAsync(int tenantId, int? categoryId = null);
        Task<MenuItemDto?> GetByIdAsync(int menuItemId);
        Task<MenuItemDto> CreateAsync(int tenantId, CreateMenuItemDto dto);
        Task<MenuItemDto> UpdateAsync(int tenantId, int menuItemId, CreateMenuItemDto dto);
        Task DeleteAsync(int tenantId, int menuItemId);
    }

    public interface ITableService
    {
        Task<List<TableDto>> GetTablesByStoreAsync(int storeId);
        Task<TableDto> CreateTableAsync(CreateTableDto dto);
        Task<TableDto> UpdateStatusAsync(int tableId, string status);
        Task DeleteTableAsync(int tableId);
        Task<TableDto> RegenerateQrAsync(int tableId);
        Task<TableQrResolutionDto?> ResolveQrAsync(string qrToken);
        Task<TableQrResolutionDto?> ResolveQrAsyncByIds(int storeId, int tableId);
        Task<TableQrResolutionDto?> ResolveQrAsyncByNumber(int storeId, string tableNumber);
    }

    public interface IOrderService
    {
        Task<OrderDto> CreateOrderAsync(CreateOrderDto dto, int? authenticatedCustomerId = null);
        Task ApplyPostPaymentBenefitsAsync(int orderId);
        Task<OrderDto?> GetByIdAsync(int orderId);
        Task<OrderDto?> GetByCodeAsync(string orderCode);
        Task<List<OrderDto>> GetActiveOrdersByStoreAsync(int storeId);
        Task<PaginationRes<OrderDto>> SearchOrdersAsync(int storeId, PagedReq req, string? status = null);
        Task<OrderDto> UpdateStatusAsync(int orderId, string newStatus, int? staffId = null);
    }

    public interface IPaymentService
    {
        Task<PaymentResultDto> ProcessPaymentAsync(CreatePaymentDto dto, int? staffId = null);
    }

    public interface IVoucherService
    {
        Task<VoucherValidationResult> ValidateVoucherAsync(CheckVoucherRequest request);
        Task<List<VoucherDto>> GetActiveVouchersAsync(int tenantId, int? storeId);
    }

    public class VoucherDto
    {
        public int VoucherId { get; set; }
        public string Code { get; set; } = string.Empty;
        public string Title { get; set; } = string.Empty;
        public string? Description { get; set; }
        public string DiscountType { get; set; } = "percent";
        public decimal DiscountValue { get; set; }
        public decimal? MaxDiscount { get; set; }
        public decimal MinOrderAmount { get; set; }
        public DateTime EndDate { get; set; }
    }

    public interface IAnalyticsService
    {
        Task<DashboardStatsDto> GetDashboardStatsAsync(int storeId);
        Task<ShiftOperationsDto> GetShiftOperationsAsync(int storeId);
        Task<RevenueReportDto> GetRevenueReportAsync(int storeId, DateTime fromDate, DateTime toDate);
        Task<BusinessAnalyticsReportDto> GetBusinessAnalyticsReportAsync(int storeId, DateTime fromDate, DateTime toDate);
        Task<MenuEngineeringSummaryDto> GetMenuEngineeringMatrixAsync(int storeId, DateTime fromDate, DateTime toDate);
        Task<CustomerAnalyticsDto> GetCustomerAnalyticsAsync(int tenantId, DateTime fromDate, DateTime toDate);
        Task<List<CategoryPerformanceDto>> GetCategoryPerformanceAsync(int tenantId, DateTime fromDate, DateTime toDate);
    }

    public interface IInventoryService
    {
        Task DeductInventoryForOrderAsync(int orderId, int? staffId = null);
        Task ImportInventoryAsync(int storeId, int ingredientId, decimal quantity, int? staffId, string? note);
        Task AdjustInventoryAsync(int storeId, int ingredientId, decimal newQuantity, int? staffId, string? note);
        Task<List<InventoryStockDto>> GetInventoryByStoreAsync(int storeId);
        Task<List<InventoryTransactionDto>> GetTransactionHistoryAsync(int storeId, int? ingredientId = null, DateTime? fromDate = null, DateTime? toDate = null);

        // Ingredient CRUD
        Task<List<IngredientDto>> GetIngredientsAsync(int tenantId, int? storeId = null);
        Task<IngredientDto> CreateIngredientAsync(CreateIngredientDto dto);
        Task<IngredientDto> UpdateIngredientAsync(int ingredientId, UpdateIngredientDto dto);
        Task DeleteIngredientAsync(int ingredientId);

        // Recipe Management
        Task<List<MenuItemRecipeDto>> GetMenuItemRecipesAsync(int menuItemId);
        Task UpsertMenuItemRecipeAsync(UpsertRecipeDto dto);
        Task DeleteMenuItemRecipeAsync(int recipeId);

        // Alerts
        Task<List<LowStockAlertDto>> GetLowStockAlertsAsync(int storeId);
    }
}
