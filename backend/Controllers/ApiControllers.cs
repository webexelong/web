using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Cryptography;
using WebCafe.Backend.Common.Exceptions;
using WebCafe.Backend.Common.Constants;
using WebCafe.Backend.Common.Models;
using WebCafe.Backend.Infrastructure.Data;
using WebCafe.Backend.Models.DTOs.Analytics;
using WebCafe.Backend.Models.DTOs.Auth;
using WebCafe.Backend.Models.DTOs.Menu;
using WebCafe.Backend.Models.DTOs.Order;
using WebCafe.Backend.Models.DTOs.Payment;
using WebCafe.Backend.Models.DTOs.Table;
using WebCafe.Backend.Models.DTOs.Voucher;
using WebCafe.Backend.Models.DTOs.AI;
using WebCafe.Backend.Models.DTOs.Inventory;
using WebCafe.Backend.Services.Abstraction;
using WebCafe.Backend.Services.Implementation;
using PayOS;
using PayOS.Models.V2.PaymentRequests;
using PayOS.Models.Webhooks;

namespace WebCafe.Backend.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [EnableRateLimiting("auth")]
    public class AuthController : ControllerBase
    {
        private readonly IAuthService _authService;
        private readonly ILogger<AuthController> _logger;

        public AuthController(IAuthService authService, ILogger<AuthController> logger)
        {
            _authService = authService;
            _logger = logger;
        }

        [HttpPost("login")]
        public async Task<ActionResult<ApiResponse<LoginResponse>>> Login([FromBody] LoginRequest request)
        {
            try
            {
                var res = await _authService.LoginStaffAsync(request);
                return Ok(ApiResponse<LoginResponse>.Ok(res, "Đăng nhập nhân viên thành công."));
            }
            catch (Exception)
            {
                // Customer login cũng phải xác thực mật khẩu và cửa hàng đã chọn.
                try
                {
                    if (!request.StoreId.HasValue) throw new AppException("Vui lòng chọn cửa hàng để đăng nhập.");
                    var customerRes = await _authService.LoginCustomerAsync(request);
                    return Ok(ApiResponse<LoginResponse>.Ok(customerRes, "Đăng nhập khách hàng thành công."));
                }
                catch (AppException appEx)
                {
                    return BadRequest(ApiResponse<LoginResponse>.Fail(appEx.Message));
                }
            }
        }

        [HttpPost("customer-login")]
        public async Task<ActionResult<ApiResponse<LoginResponse>>> CustomerLogin([FromBody] LoginRequest request)
        {
            try
            {
                var res = await _authService.LoginCustomerAsync(request);
                return Ok(ApiResponse<LoginResponse>.Ok(res, "Đăng nhập khách hàng thành công."));
            }
            catch (AppException ex)
            {
                return BadRequest(ApiResponse<LoginResponse>.Fail(ex.Message));
            }
        }

        [HttpPost("owner-login")]
        public async Task<ActionResult<ApiResponse<LoginResponse>>> OwnerLogin([FromBody] LoginRequest request)
        {
            try
            {
                var res = await _authService.LoginTenantOwnerAsync(request);
                return Ok(ApiResponse<LoginResponse>.Ok(res, "Đăng nhập chủ quán thành công."));
            }
            catch (AppException ex)
            {
                return BadRequest(ApiResponse<LoginResponse>.Fail(ex.Message));
            }
        }

        [HttpPost("admin-login")]
        public async Task<ActionResult<ApiResponse<LoginResponse>>> AdminLogin([FromBody] LoginRequest request)
        {
            try
            {
                var res = await _authService.LoginSystemAdminAsync(request);
                return Ok(ApiResponse<LoginResponse>.Ok(res, "Đăng nhập quản trị viên thành công."));
            }
            catch (AppException ex)
            {
                return BadRequest(ApiResponse<LoginResponse>.Fail(ex.Message));
            }
        }

        [HttpPost("register")]
        public async Task<ActionResult<ApiResponse<RegisterResponse>>> Register([FromBody] RegisterRequest request)
        {
            try
            {
                var res = await _authService.RegisterCustomerAsync(request);
                return Ok(ApiResponse<RegisterResponse>.Ok(res, "Đăng ký tài khoản thành công."));
            }
            catch (AppException ex)
            {
                return BadRequest(ApiResponse<RegisterResponse>.Fail(ex.Message));
            }
        }

        [HttpPost("signup")]
        public async Task<ActionResult<ApiResponse<OwnerSignupResponse>>> SignupOwner([FromBody] OwnerSignupRequest request)
        {
            try
            {
                var result = await _authService.SignupOwnerAsync(request);
                var message = result.EmailSent
                    ? "Tạo quán thành công. Vui lòng xác minh email để tiếp tục."
                    : "Quán đã được tạo và lưu. Chưa gửi được email xác minh; hãy thử gửi lại email từ màn hình này.";
                return Ok(ApiResponse<OwnerSignupResponse>.Ok(result, message));
            }
            catch (AppException ex)
            {
                return BadRequest(ApiResponse<OwnerSignupResponse>.Fail(ex.Message));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Owner signup failed.");
                return StatusCode(StatusCodes.Status500InternalServerError,
                    ApiResponse<OwnerSignupResponse>.Fail("Không thể gửi email xác minh nên quán chưa được tạo. Vui lòng kiểm tra lại email hoặc thử lại sau."));
            }
        }

        [HttpGet("verify-owner")]
        public async Task<ActionResult<ApiResponse<LoginResponse>>> VerifyOwnerEmail([FromQuery] string token)
        {
            try
            {
                var result = await _authService.VerifyOwnerEmailAsync(token);
                return Ok(ApiResponse<LoginResponse>.Ok(result, "Xác minh email thành công."));
            }
            catch (AppException ex)
            {
                return BadRequest(ApiResponse<LoginResponse>.Fail(ex.Message));
            }
        }
    }

    [ApiController]
    [Route("api/[controller]")]
    public class MenuController : ControllerBase
    {
        private readonly IMenuItemService _menuService;
        private readonly ICategoryService _categoryService;
        private readonly ICurrentUserService _currentUser;

        public MenuController(
            IMenuItemService menuService,
            ICategoryService categoryService,
            ICurrentUserService currentUser)
        {
            _menuService = menuService;
            _categoryService = categoryService;
            _currentUser = currentUser;
        }

        // Helper: Extract TenantId from JWT token
        private int GetTenantIdFromToken()
        {
            return _currentUser.TenantId
                ?? throw new AppException("Không tìm thấy thông tin Tenant. Vui lòng đăng nhập lại.");
        }

        [HttpGet("store/{storeId}")]
        public async Task<ActionResult<ApiResponse<StoreMenuResponse>>> GetMenuByStore(int storeId)
        {
            var menu = await _menuService.GetMenuByStoreAsync(storeId);
            return Ok(ApiResponse<StoreMenuResponse>.Ok(menu));
        }

        // ===== CATEGORY ENDPOINTS (JWT-based) =====
        [HttpGet("categories")]
        [Authorize(Policy = "ManagerAccess")]
        public async Task<ActionResult<ApiResponse<List<CategoryDto>>>> GetCategories()
        {
            var tenantId = GetTenantIdFromToken();
            var cats = await _categoryService.GetCategoriesByTenantAsync(tenantId);
            return Ok(ApiResponse<List<CategoryDto>>.Ok(cats));
        }

        [HttpPost("categories")]
        [Authorize(Policy = "ManagerAccess")]
        public async Task<ActionResult<ApiResponse<CategoryDto>>> CreateCategory([FromBody] CreateCategoryDto dto)
        {
            var tenantId = GetTenantIdFromToken();
            var cat = await _categoryService.CreateCategoryAsync(tenantId, dto);
            return Ok(ApiResponse<CategoryDto>.Ok(cat, "Thêm danh mục thành công."));
        }

        [HttpDelete("categories/{categoryId}")]
        [Authorize(Policy = "ManagerAccess")]
        public async Task<ActionResult<ApiResponse<object>>> DeleteCategory(int categoryId)
        {
            var tenantId = GetTenantIdFromToken();
            await _categoryService.DeleteCategoryAsync(tenantId, categoryId);
            return Ok(ApiResponse<object>.Ok(new { }, "Xóa danh mục thành công."));
        }

        // ===== MENU ITEM ENDPOINTS (JWT-based) =====
        [HttpGet("items")]
        [Authorize(Policy = "ManagerAccess")]
        public async Task<ActionResult<ApiResponse<List<MenuItemDto>>>> GetMenuItems([FromQuery] int? categoryId)
        {
            var tenantId = GetTenantIdFromToken();
            var items = await _menuService.GetMenuItemsByTenantAsync(tenantId, categoryId);
            return Ok(ApiResponse<List<MenuItemDto>>.Ok(items));
        }

        [HttpGet("items/{id}")]
        [Authorize(Policy = "ManagerAccess")]
        public async Task<ActionResult<ApiResponse<MenuItemDto>>> GetMenuItemById(int id)
        {
            var tenantId = GetTenantIdFromToken();
            var item = await _menuService.GetByIdAsync(id);
            if (item == null) return NotFound(ApiResponse<MenuItemDto>.Fail("Không tìm thấy món."));
            
            // Security: Verify item belongs to this tenant
            if (item.TenantId != tenantId)
            {
                return Forbid();
            }
            
            return Ok(ApiResponse<MenuItemDto>.Ok(item));
        }

        [HttpPost("items")]
        [Authorize(Policy = "ManagerAccess")]
        public async Task<ActionResult<ApiResponse<MenuItemDto>>> CreateMenuItem([FromBody] CreateMenuItemDto dto)
        {
            var tenantId = GetTenantIdFromToken();
            var item = await _menuService.CreateAsync(tenantId, dto);
            return Ok(ApiResponse<MenuItemDto>.Ok(item, "Tạo món thành công."));
        }

        [HttpPut("items/{id}")]
        [Authorize(Policy = "ManagerAccess")]
        public async Task<ActionResult<ApiResponse<MenuItemDto>>> UpdateMenuItem(int id, [FromBody] CreateMenuItemDto dto)
        {
            var tenantId = GetTenantIdFromToken();
            var item = await _menuService.UpdateAsync(tenantId, id, dto);
            return Ok(ApiResponse<MenuItemDto>.Ok(item, "Cập nhật món thành công."));
        }

        [HttpDelete("items/{id}")]
        [Authorize(Policy = "ManagerAccess")]
        public async Task<ActionResult<ApiResponse<object>>> DeleteMenuItem(int id)
        {
            var tenantId = GetTenantIdFromToken();
            await _menuService.DeleteAsync(tenantId, id);
            return Ok(ApiResponse<object>.Ok(new { }, "Xóa món thành công."));
        }
    }

    [ApiController]
    [Route("api/[controller]")]
    public class TablesController : ControllerBase
    {
        private readonly ITableService _tableService;
        private readonly ITenantAccessService _tenantAccess;
        private readonly ICurrentUserService _currentUser;
        private readonly ISubscriptionService _subscriptionService;

        public TablesController(ITableService tableService, ITenantAccessService tenantAccess, ICurrentUserService currentUser, ISubscriptionService subscriptionService)
        {
            _tableService = tableService;
            _tenantAccess = tenantAccess;
            _currentUser = currentUser;
            _subscriptionService = subscriptionService;
        }

        [HttpGet("store/{storeId}")]
        [Authorize(Policy = AppPolicies.StaffAccess)]
        public async Task<ActionResult<ApiResponse<List<TableDto>>>> GetTablesByStore(int storeId)
        {
            await _tenantAccess.EnsureStoreAccessAsync(storeId);
            var tables = await _tableService.GetTablesByStoreAsync(storeId);
            return Ok(ApiResponse<List<TableDto>>.Ok(tables));
        }

        [HttpPost]
        [Authorize(Policy = "ManagerAccess")]
        public async Task<ActionResult<ApiResponse<TableDto>>> CreateTable([FromBody] CreateTableDto dto)
        {
            await _tenantAccess.EnsureStoreAccessAsync(dto.StoreId);
            if (_currentUser.TenantId.HasValue) await _subscriptionService.EnsureCanCreateTableAsync(_currentUser.TenantId.Value, dto.StoreId);
            var table = await _tableService.CreateTableAsync(dto);
            return Ok(ApiResponse<TableDto>.Ok(table, "Thêm bàn mới thành công."));
        }

        [HttpPut("{id}/status")]
        [Authorize(Policy = "StaffAccess")]
        public async Task<ActionResult<ApiResponse<TableDto>>> UpdateStatus(int id, [FromBody] UpdateTableStatusDto dto)
        {
            await _tenantAccess.EnsureTableAccessAsync(id);
            var table = await _tableService.UpdateStatusAsync(id, dto.Status);
            return Ok(ApiResponse<TableDto>.Ok(table, "Cập nhật trạng thái bàn thành công."));
        }

        [HttpGet("qr/{qrToken}")]
        public async Task<ActionResult<ApiResponse<TableQrResolutionDto>>> ResolveQr(string qrToken)
        {
            var table = await _tableService.ResolveQrAsync(qrToken);
            if (table == null) return NotFound(ApiResponse<TableQrResolutionDto>.Fail("Mã QR không hợp lệ hoặc bàn đã ngừng hoạt động."));
            return Ok(ApiResponse<TableQrResolutionDto>.Ok(table));
        }

        [HttpGet("resolve/{storeId}/{tableId}")]
        public async Task<ActionResult<ApiResponse<TableQrResolutionDto>>> ResolveLegacyQr(int storeId, int tableId)
        {
            var table = await _tableService.ResolveQrAsyncByIds(storeId, tableId);
            if (table == null) return NotFound(ApiResponse<TableQrResolutionDto>.Fail("Cửa hàng hoặc bàn không hợp lệ."));
            return Ok(ApiResponse<TableQrResolutionDto>.Ok(table));
        }

        [HttpGet("resolve-by-number/{storeId}/{tableNumber}")]
        public async Task<ActionResult<ApiResponse<TableQrResolutionDto>>> ResolveLegacyQrByNumber(int storeId, string tableNumber)
        {
            var table = await _tableService.ResolveQrAsyncByNumber(storeId, tableNumber);
            if (table == null) return NotFound(ApiResponse<TableQrResolutionDto>.Fail("Cửa hàng hoặc bàn không hợp lệ."));
            return Ok(ApiResponse<TableQrResolutionDto>.Ok(table));
        }

        [HttpPost("{id}/qr/regenerate")]
        [Authorize(Policy = AppPolicies.TenantAdminAccess)]
        public async Task<ActionResult<ApiResponse<TableDto>>> RegenerateQr(int id)
        {
            await _tenantAccess.EnsureTableAccessAsync(id);
            var table = await _tableService.RegenerateQrAsync(id);
            return Ok(ApiResponse<TableDto>.Ok(table, "Đã tạo lại mã QR cho bàn."));
        }

        [HttpDelete("{id}")]
        [Authorize(Policy = AppPolicies.TenantAdminAccess)]
        public async Task<ActionResult<ApiResponse<object>>> DeleteTable(int id)
        {
            await _tenantAccess.EnsureTableAccessAsync(id);
            await _tableService.DeleteTableAsync(id);
            return Ok(ApiResponse<object>.Ok(new { }, "Xóa bàn thành công."));
        }
    }

    [ApiController]
    [Route("api/[controller]")]
    public class OrdersController : ControllerBase
    {
        private readonly IOrderService _orderService;
        private readonly ICurrentUserService _currentUser;
        private readonly ITenantAccessService _tenantAccess;
        private readonly WebCafeDbContext _db;

        public OrdersController(
            IOrderService orderService,
            ICurrentUserService currentUser,
            ITenantAccessService tenantAccess,
            WebCafeDbContext db)
        {
            _orderService = orderService;
            _currentUser = currentUser;
            _tenantAccess = tenantAccess;
            _db = db;
        }

        [HttpPost]
        public async Task<ActionResult<ApiResponse<OrderDto>>> CreateOrder([FromBody] CreateOrderDto dto)
        {
            var source = string.IsNullOrWhiteSpace(dto.Source) ? "qr_table" : dto.Source;
            if (source.Equals("pos_staff", StringComparison.OrdinalIgnoreCase))
            {
                var staffRoles = new[] { AppRoles.SystemAdmin, AppRoles.TenantOwner, AppRoles.Staff };
                if (!_currentUser.IsAuthenticated || !staffRoles.Contains(_currentUser.Role, StringComparer.OrdinalIgnoreCase)) return Unauthorized();
                await _tenantAccess.EnsureStoreAccessAsync(dto.StoreId);
            }
            else if (!source.Equals("qr_table", StringComparison.OrdinalIgnoreCase))
            {
                return BadRequest(ApiResponse<OrderDto>.Fail("Nguồn tạo đơn không hợp lệ."));
            }
            if (dto.PointsToUse > 0 && !_currentUser.CustomerId.HasValue)
                return Unauthorized(ApiResponse<OrderDto>.Fail("Đăng nhập khách hàng để sử dụng điểm."));
            if (source.Equals("qr_table", StringComparison.OrdinalIgnoreCase))
            {
                dto.PaymentMethod = null;
            }
            var order = await _orderService.CreateOrderAsync(dto, _currentUser.CustomerId);
            return Ok(ApiResponse<OrderDto>.Ok(order, "Đặt món thành công!"));
        }

        [HttpGet("{id}")]
        [Authorize(Policy = AppPolicies.RequireAuthenticated)]
        public async Task<ActionResult<ApiResponse<OrderDto>>> GetOrderById(int id)
        {
            var order = await _orderService.GetByIdAsync(id);
            if (order == null) return NotFound(ApiResponse<OrderDto>.Fail("Không tìm thấy đơn hàng."));

            var isCustomerOwner = _currentUser.CustomerId.HasValue && order.CustomerId == _currentUser.CustomerId;
            var isStaff = string.Equals(_currentUser.Role, AppRoles.SystemAdmin, StringComparison.OrdinalIgnoreCase)
                || string.Equals(_currentUser.Role, AppRoles.TenantOwner, StringComparison.OrdinalIgnoreCase)
                || string.Equals(_currentUser.Role, AppRoles.Staff, StringComparison.OrdinalIgnoreCase)
                ;
            if (!isCustomerOwner && !isStaff) return Forbid();
            if (isStaff) await _tenantAccess.EnsureOrderAccessAsync(id);
            return Ok(ApiResponse<OrderDto>.Ok(order));
        }

        [HttpGet("code/{code}")]
        public async Task<ActionResult<ApiResponse<OrderDto>>> GetOrderByCode(string code, [FromQuery] string? paymentAccessToken)
        {
            var order = await _orderService.GetByCodeAsync(code);
            if (order == null) return NotFound(ApiResponse<OrderDto>.Fail("Không tìm thấy đơn hàng."));
            var entity = await _db.Orders.AsNoTracking().FirstOrDefaultAsync(o => o.OrderCode == code);
            if (entity == null) return NotFound(ApiResponse<OrderDto>.Fail("Không tìm thấy đơn hàng."));
            var staffRoles = new[] { AppRoles.SystemAdmin, AppRoles.TenantOwner, AppRoles.Staff };
            var isCustomerOwner = _currentUser.CustomerId.HasValue && entity.CustomerId == _currentUser.CustomerId;
            if (!isCustomerOwner && _currentUser.IsAuthenticated && staffRoles.Contains(_currentUser.Role, StringComparer.OrdinalIgnoreCase))
            {
                await _tenantAccess.EnsureOrderAccessAsync(entity.OrderId);
            }
            else if (!isCustomerOwner && !IsValidPaymentAccessToken(entity.PaymentAccessToken, paymentAccessToken))
            {
                return Unauthorized();
            }
            order.PaymentAccessToken = null;
            return Ok(ApiResponse<OrderDto>.Ok(order));
        }

        [HttpGet("active/store/{storeId}")]
        [Authorize(Policy = AppPolicies.StaffAccess)]
        public async Task<ActionResult<ApiResponse<List<OrderDto>>>> GetActiveOrders(int storeId)
        {
            await _tenantAccess.EnsureStoreAccessAsync(storeId);
            var orders = await _orderService.GetActiveOrdersByStoreAsync(storeId);
            return Ok(ApiResponse<List<OrderDto>>.Ok(orders));
        }

        [HttpGet("store/{storeId}")]
        [Authorize(Policy = "StaffAccess")]
        public async Task<ActionResult<ApiResponse<PaginationRes<OrderDto>>>> SearchOrders(int storeId, [FromQuery] PagedReq req, [FromQuery] string? status)
        {
            await _tenantAccess.EnsureStoreAccessAsync(storeId);
            var orders = await _orderService.SearchOrdersAsync(storeId, req, status);
            return Ok(ApiResponse<PaginationRes<OrderDto>>.Ok(orders));
        }

        [HttpPut("{id}/status")]
        [Authorize(Policy = AppPolicies.OrderStatusAccess)]
        public async Task<ActionResult<ApiResponse<OrderDto>>> UpdateStatus(int id, [FromBody] UpdateOrderStatusDto dto)
        {
            await _tenantAccess.EnsureOrderAccessAsync(id);
            var order = await _orderService.UpdateStatusAsync(id, dto.Status, _currentUser.UserId);
            return Ok(ApiResponse<OrderDto>.Ok(order, "Cập nhật trạng thái đơn thành công."));
        }

        private static bool IsValidPaymentAccessToken(string expectedToken, string? providedToken)
        {
            if (string.IsNullOrWhiteSpace(providedToken)) return false;
            return CryptographicOperations.FixedTimeEquals(
                System.Text.Encoding.UTF8.GetBytes(expectedToken),
                System.Text.Encoding.UTF8.GetBytes(providedToken));
        }
    }

    [ApiController]
    [Route("api/[controller]")]
    public class PaymentsController : ControllerBase
    {
        private readonly IPaymentService _paymentService;
        private readonly IVietQRPaymentService _vietQRPaymentService;
        private readonly IPayOSService _payOSService;
        private readonly ILogger<PaymentsController> _logger;
        private readonly ICurrentUserService _currentUser;
        private readonly ITenantAccessService _tenantAccess;
        private readonly WebCafeDbContext _db;

        public PaymentsController(
            IPaymentService paymentService, 
            IVietQRPaymentService vietQRPaymentService,
            IPayOSService payOSService,
            ILogger<PaymentsController> logger,
            ICurrentUserService currentUser,
            ITenantAccessService tenantAccess,
            WebCafeDbContext db)
        {
            _paymentService = paymentService;
            _vietQRPaymentService = vietQRPaymentService;
            _payOSService = payOSService;
            _logger = logger;
            _currentUser = currentUser;
            _tenantAccess = tenantAccess;
            _db = db;
        }

        private async Task EnsurePaymentAccessAsync(int orderId, string? accessToken)
        {
            var order = await _db.Orders.AsNoTracking().FirstOrDefaultAsync(o => o.OrderId == orderId);
            if (order == null) throw new NotFoundException("Không tìm thấy đơn hàng.");

            if (_currentUser.IsAuthenticated)
            {
                if (_currentUser.CustomerId.HasValue && order.CustomerId == _currentUser.CustomerId)
                {
                    return;
                }
                var staffRoles = new[] { AppRoles.SystemAdmin, AppRoles.TenantOwner, AppRoles.Staff };
                if (staffRoles.Contains(_currentUser.Role, StringComparer.OrdinalIgnoreCase) && _currentUser.TenantId.HasValue)
                {
                    await _tenantAccess.EnsureOrderAccessAsync(orderId);
                    return;
                }
            }

            if (!IsValidPaymentAccessToken(order.PaymentAccessToken, accessToken))
                throw new ForbiddenException("Payment access token không hợp lệ.");
        }

        private static bool IsValidPaymentAccessToken(string expectedToken, string? providedToken)
        {
            if (string.IsNullOrWhiteSpace(providedToken)) return false;
            return CryptographicOperations.FixedTimeEquals(
                System.Text.Encoding.UTF8.GetBytes(expectedToken),
                System.Text.Encoding.UTF8.GetBytes(providedToken));
        }

        [HttpPost]
        [Authorize(Policy = AppPolicies.StaffAccess)]
        public async Task<ActionResult<ApiResponse<PaymentResultDto>>> ProcessPayment([FromBody] CreatePaymentDto dto)
        {
                var paymentRoles = new[] { AppRoles.SystemAdmin, AppRoles.TenantOwner, AppRoles.Staff };
            if (!paymentRoles.Contains(_currentUser.Role, StringComparer.OrdinalIgnoreCase)) return Forbid();
            await _tenantAccess.EnsureOrderAccessAsync(dto.OrderId);
            var result = await _paymentService.ProcessPaymentAsync(dto, _currentUser.UserId);
            return Ok(ApiResponse<PaymentResultDto>.Ok(result, "Thanh toán thành công."));
        }

        #region PayOS Gateway
        [HttpPost("payos/create-link")]
        public async Task<ActionResult<ApiResponse<PayOSPaymentDto>>> CreatePayOSPayment([FromBody] CreatePayOSPaymentRequest request)
        {
            await EnsurePaymentAccessAsync(request.OrderId, request.PaymentAccessToken);
            var payment = await _payOSService.CreatePaymentLinkAsync(request.OrderId, request.OrderCode, request.ReturnUrl, request.CancelUrl);
            return Ok(ApiResponse<PayOSPaymentDto>.Ok(payment, "Đã tạo link thanh toán PayOS."));
        }

        [HttpGet("payos/status/{orderCode}")]
        public async Task<ActionResult<ApiResponse<PayOSStatusCheckDto>>> GetPayOSPaymentStatus(long orderCode, [FromQuery] string? paymentAccessToken)
        {
            var payment = await _db.Payments.Include(p => p.Order).AsNoTracking().FirstOrDefaultAsync(p => p.TransactionRef == orderCode.ToString());
            if (payment?.Order == null) return NotFound();
            await EnsurePaymentAccessAsync(payment.OrderId, paymentAccessToken);
            var status = await _payOSService.GetPaymentStatusAsync(orderCode);
            return Ok(ApiResponse<PayOSStatusCheckDto>.Ok(status));
        }

        [HttpPost("payos/cancel/{orderCode}")]
        [Authorize(Policy = AppPolicies.TenantAdminAccess)]
        public async Task<ActionResult<ApiResponse<object>>> CancelPayOSPayment(long orderCode, [FromQuery] string? reason)
        {
            var payment = await _db.Payments.AsNoTracking().FirstOrDefaultAsync(p => p.TransactionRef == orderCode.ToString());
            if (payment == null) return NotFound();
            await _tenantAccess.EnsureOrderAccessAsync(payment.OrderId);
            var result = await _payOSService.CancelPaymentLinkAsync(orderCode, reason);
            return Ok(ApiResponse<object>.Ok(result, "Đã hủy link thanh toán PayOS."));
        }

        [HttpPost("payos/webhook")]
        [AllowAnonymous] // Webhook IPN từ PayOS Server
        [EnableRateLimiting("webhook")]
        public async Task<IActionResult> PayOSWebhook([FromBody] object webhookPayload)
        {
            try
            {
                var json = System.Text.Json.JsonSerializer.Serialize(webhookPayload);
                var webhook = System.Text.Json.JsonSerializer.Deserialize<Webhook>(json, new System.Text.Json.JsonSerializerOptions { PropertyNameCaseInsensitive = true });
                if (webhook == null) return BadRequest(new { error = -1, message = "Payload rỗng hoặc không hợp lệ" });

                var result = await _payOSService.ProcessWebhookAsync(webhook);
                return Ok(new 
                { 
                    error = 0, 
                    message = "Webhook processed successfully",
                    data = result
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error processing PayOS webhook");
                return BadRequest(new { error = -1, message = ex.Message });
            }
        }

        [HttpGet("store/{storeId}/config")]
        [Authorize(Policy = AppPolicies.TenantAdminAccess)]
        public async Task<ActionResult<ApiResponse<StorePaymentConfigDto>>> GetStorePaymentConfig(int storeId)
        {
            await _tenantAccess.EnsureStoreAccessAsync(storeId);
            var config = await _payOSService.GetStorePaymentConfigAsync(storeId);
            return Ok(ApiResponse<StorePaymentConfigDto>.Ok(config));
        }

        [HttpPut("store/{storeId}/config")]
        [Authorize(Policy = AppPolicies.TenantAdminAccess)]
        public async Task<ActionResult<ApiResponse<StorePaymentConfigDto>>> UpdateStorePaymentConfig(int storeId, [FromBody] UpdateStorePaymentConfigDto dto)
        {
            await _tenantAccess.EnsureStoreAccessAsync(storeId);
            var updated = await _payOSService.UpdateStorePaymentConfigAsync(storeId, dto);
            return Ok(ApiResponse<StorePaymentConfigDto>.Ok(updated, "Đã cập nhật cấu hình thanh toán cửa hàng thành công."));
        }

        [HttpPost("store/test-connection")]
        [Authorize(Policy = AppPolicies.TenantAdminAccess)]
        public async Task<ActionResult<ApiResponse<TestPaymentConfigResultDto>>> TestStorePaymentConfig([FromBody] TestStorePaymentConfigRequest request)
        {
            var result = await _payOSService.TestStorePaymentConfigAsync(request);
            return Ok(ApiResponse<TestPaymentConfigResultDto>.Ok(result, result.Message));
        }
        #endregion

        #region VietQR Legacy
        [HttpPost("vietqr/create")]
        public async Task<ActionResult<ApiResponse<VietQRPaymentDto>>> CreateVietQRPayment([FromBody] CreateVietQRPaymentRequest request)
        {
            await EnsurePaymentAccessAsync(request.OrderId, request.PaymentAccessToken);
            var payment = await _vietQRPaymentService.CreateVietQRPaymentAsync(request.OrderId);
            return Ok(ApiResponse<VietQRPaymentDto>.Ok(payment, "Đã tạo mã QR thanh toán."));
        }

        [HttpGet("vietqr/status/{orderId}")]
        public async Task<ActionResult<ApiResponse<VietQRPaymentDto>>> GetVietQRPaymentStatus(int orderId, [FromQuery] string? paymentAccessToken)
        {
            await EnsurePaymentAccessAsync(orderId, paymentAccessToken);
            var payment = await _vietQRPaymentService.GetPendingPaymentByOrderIdAsync(orderId);
            if (payment == null)
            {
                return NotFound(ApiResponse<VietQRPaymentDto>.Fail("Không tìm thấy giao dịch thanh toán."));
            }
            return Ok(ApiResponse<VietQRPaymentDto>.Ok(payment));
        }

        [HttpPost("vietqr/webhook")]
        [AllowAnonymous] // Webhook từ ngân hàng không có authentication
        [EnableRateLimiting("webhook")]
        public async Task<IActionResult> VietQRWebhook([FromBody] VietQRWebhookDto webhook, [FromHeader(Name = "X-Signature")] string? signature)
        {
            try
            {
                _logger.LogInformation($"VietQR Webhook received: {webhook.TransactionId}");

                if (string.IsNullOrWhiteSpace(signature) || !await _vietQRPaymentService.VerifyWebhookSignatureAsync(webhook, signature))
                {
                    _logger.LogWarning("Invalid or missing VietQR webhook signature");
                    return Unauthorized(new { message = "Invalid signature" });
                }

                var result = await _vietQRPaymentService.ProcessWebhookAsync(webhook);
                
                return Ok(new 
                { 
                    success = true, 
                    message = "Webhook processed successfully",
                    data = result
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error processing VietQR webhook");
                return BadRequest(new { success = false, message = ex.Message });
            }
        }
        #endregion
    }

    public class CreateVietQRPaymentRequest
    {
        public int OrderId { get; set; }
        public string? PaymentAccessToken { get; set; }
    }

    [ApiController]
    [Route("api/[controller]")]
    public class VouchersController : ControllerBase
    {
        private readonly IVoucherService _voucherService;

        public VouchersController(IVoucherService voucherService)
        {
            _voucherService = voucherService;
        }

        [HttpPost("check")]
        public async Task<ActionResult<ApiResponse<VoucherValidationResult>>> CheckVoucher([FromBody] CheckVoucherRequest request)
        {
            var result = await _voucherService.ValidateVoucherAsync(request);
            if (!result.IsValid)
            {
                return BadRequest(ApiResponse<VoucherValidationResult>.Fail(result.Message, null));
            }
            return Ok(ApiResponse<VoucherValidationResult>.Ok(result, result.Message));
        }

        [HttpGet("store/{storeId}")]
        public async Task<ActionResult<ApiResponse<List<VoucherDto>>>> GetActiveVouchers(int storeId, [FromQuery] int tenantId)
        {
            var vouchers = await _voucherService.GetActiveVouchersAsync(tenantId, storeId);
            return Ok(ApiResponse<List<VoucherDto>>.Ok(vouchers));
        }
    }

    [ApiController]
    [Route("api/[controller]")]
    public class AnalyticsController : ControllerBase
    {
        private readonly IAnalyticsService _analyticsService;
        private readonly ITenantAccessService _tenantAccess;
        private readonly ICurrentUserService _currentUser;
        private readonly ISubscriptionService _subscription;

        public AnalyticsController(IAnalyticsService analyticsService, ITenantAccessService tenantAccess, ICurrentUserService currentUser, ISubscriptionService subscription)
        {
            _analyticsService = analyticsService;
            _tenantAccess = tenantAccess;
            _currentUser = currentUser;
            _subscription = subscription;
        }

        [HttpGet("dashboard/store/{storeId}")]
        [Authorize(Policy = "StaffAccess")]
        public async Task<ActionResult<ApiResponse<DashboardStatsDto>>> GetDashboard(int storeId)
        {
            await _tenantAccess.EnsureStoreAccessAsync(storeId);
            var stats = await _analyticsService.GetDashboardStatsAsync(storeId);
            return Ok(ApiResponse<DashboardStatsDto>.Ok(stats));
        }

        [HttpGet("shift-operations/store/{storeId}")]
        [Authorize(Policy = "StaffAccess")]
        public async Task<ActionResult<ApiResponse<ShiftOperationsDto>>> GetShiftOperations(int storeId)
        {
            await _tenantAccess.EnsureStoreAccessAsync(storeId);
            var operations = await _analyticsService.GetShiftOperationsAsync(storeId);
            return Ok(ApiResponse<ShiftOperationsDto>.Ok(operations));
        }

        [HttpGet("business-report/store/{storeId}")]
        [Authorize(Policy = "StaffAccess")]
        public async Task<ActionResult<ApiResponse<BusinessAnalyticsReportDto>>> GetBusinessReport(
            int storeId,
            [FromQuery] DateTime? fromDate,
            [FromQuery] DateTime? toDate)
        {
            await _tenantAccess.EnsureStoreAccessAsync(storeId);
            if (_currentUser.TenantId.HasValue) await _subscription.EnsureFeatureAccessAsync(_currentUser.TenantId.Value, "advanced_analytics", "premium");
            var from = fromDate ?? DateTime.UtcNow.Date.AddDays(-6);
            var to = toDate ?? DateTime.UtcNow;
            var report = await _analyticsService.GetBusinessAnalyticsReportAsync(storeId, from, to);
            return Ok(ApiResponse<BusinessAnalyticsReportDto>.Ok(report));
        }

        [HttpGet("menu-engineering/store/{storeId}")]
        [Authorize(Policy = "StaffAccess")]
        public async Task<ActionResult<ApiResponse<MenuEngineeringSummaryDto>>> GetMenuEngineering(
            int storeId,
            [FromQuery] DateTime? fromDate,
            [FromQuery] DateTime? toDate)
        {
            await _tenantAccess.EnsureStoreAccessAsync(storeId);
            if (_currentUser.TenantId.HasValue) await _subscription.EnsureFeatureAccessAsync(_currentUser.TenantId.Value, "advanced_analytics", "premium");
            var from = fromDate ?? DateTime.UtcNow.Date.AddDays(-29);
            var to = toDate ?? DateTime.UtcNow;
            var summary = await _analyticsService.GetMenuEngineeringMatrixAsync(storeId, from, to);
            return Ok(ApiResponse<MenuEngineeringSummaryDto>.Ok(summary));
        }

        [HttpGet("revenue/store/{storeId}")]
        [Authorize(Policy = "StaffAccess")]
        public async Task<ActionResult<ApiResponse<RevenueReportDto>>> GetRevenueReport(
            int storeId,
            [FromQuery] DateTime fromDate,
            [FromQuery] DateTime toDate)
        {
            await _tenantAccess.EnsureStoreAccessAsync(storeId);
            var report = await _analyticsService.GetRevenueReportAsync(storeId, fromDate, toDate);
            return Ok(ApiResponse<RevenueReportDto>.Ok(report));
        }

        [HttpGet("customers/tenant/{tenantId}")]
        [Authorize(Policy = AppPolicies.TenantAdminAccess)]
        public async Task<ActionResult<ApiResponse<CustomerAnalyticsDto>>> GetCustomerAnalytics(
            int tenantId,
            [FromQuery] DateTime fromDate,
            [FromQuery] DateTime toDate)
        {
            _tenantAccess.EnsureTenantAccess(tenantId);
            var analytics = await _analyticsService.GetCustomerAnalyticsAsync(tenantId, fromDate, toDate);
            return Ok(ApiResponse<CustomerAnalyticsDto>.Ok(analytics));
        }

        [HttpGet("categories/tenant/{tenantId}")]
        [Authorize(Policy = AppPolicies.TenantAdminAccess)]
        public async Task<ActionResult<ApiResponse<List<CategoryPerformanceDto>>>> GetCategoryPerformance(
            int tenantId,
            [FromQuery] DateTime fromDate,
            [FromQuery] DateTime toDate)
        {
            _tenantAccess.EnsureTenantAccess(tenantId);
            var performance = await _analyticsService.GetCategoryPerformanceAsync(tenantId, fromDate, toDate);
            return Ok(ApiResponse<List<CategoryPerformanceDto>>.Ok(performance));
        }
    }

    [ApiController]
    [Route("api/[controller]")]
    public class RecommendationsController : ControllerBase
    {
        private readonly IRecommendationService _recommendationService;
        private readonly ICurrentUserService _currentUser;
        private readonly ITenantAccessService _tenantAccess;

        public RecommendationsController(IRecommendationService recommendationService, ICurrentUserService currentUser, ITenantAccessService tenantAccess)
        {
            _recommendationService = recommendationService;
            _currentUser = currentUser;
            _tenantAccess = tenantAccess;
        }

        [HttpGet("combos/tenant/{tenantId}")]
        public async Task<ActionResult<ApiResponse<List<RecommendedComboDto>>>> GetRecommendedCombos(
            int tenantId,
            [FromQuery] int top = 5)
        {
            var combos = await _recommendationService.GetRecommendedCombosAsync(tenantId, top);
            return Ok(ApiResponse<List<RecommendedComboDto>>.Ok(combos, "Gợi ý combo dựa trên dữ liệu mua hàng."));
        }

        [HttpGet("popular/store/{storeId}")]
        public async Task<ActionResult<ApiResponse<List<MenuItemRecommendationDto>>>> GetPopularItems(
            int storeId,
            [FromQuery] int top = 10)
        {
            var items = await _recommendationService.GetPopularItemsAsync(storeId, top);
            return Ok(ApiResponse<List<MenuItemRecommendationDto>>.Ok(items, "Các món bán chạy nhất."));
        }

        [HttpGet("personalized/customer/{customerId}/store/{storeId}")]
        [Authorize(Policy = AppPolicies.CustomerOnly)]
        public async Task<ActionResult<ApiResponse<List<MenuItemRecommendationDto>>>> GetPersonalizedRecommendations(
            int customerId,
            int storeId,
            [FromQuery] int top = 5)
        {
            if (_currentUser.CustomerId != customerId) return Forbid();
            await _tenantAccess.EnsureStoreAccessAsync(storeId);
            var recommendations = await _recommendationService.GetPersonalizedRecommendationsAsync(customerId, storeId, top);
            return Ok(ApiResponse<List<MenuItemRecommendationDto>>.Ok(recommendations, "Gợi ý dành riêng cho bạn."));
        }

        [HttpGet("frequently-bought-together/tenant/{tenantId}/item/{menuItemId}")]
        public async Task<ActionResult<ApiResponse<List<FrequentPairDto>>>> GetFrequentlyBoughtTogether(
            int tenantId,
            int menuItemId,
            [FromQuery] int top = 3)
        {
            var pairs = await _recommendationService.GetFrequentlyBoughtTogetherAsync(tenantId, menuItemId, top);
            return Ok(ApiResponse<List<FrequentPairDto>>.Ok(pairs, "Khách hàng thường mua kèm."));
        }
    }

    [ApiController]
    [Route("api/[controller]")]
    public class InventoryController : ControllerBase
    {
        private readonly IInventoryService _inventoryService;
        private readonly ICurrentUserService _currentUser;
        private readonly ITenantAccessService _tenantAccess;
        private readonly IGeminiService _geminiService;
        private readonly ISubscriptionService _subscription;

        public InventoryController(
            IInventoryService inventoryService,
            ICurrentUserService currentUser,
            ITenantAccessService tenantAccess,
            IGeminiService geminiService,
            ISubscriptionService subscription)
        {
            _inventoryService = inventoryService;
            _currentUser = currentUser;
            _tenantAccess = tenantAccess;
            _geminiService = geminiService;
            _subscription = subscription;
        }

        [HttpGet("store/{storeId}")]
        [Authorize(Policy = "StaffAccess")]
        public async Task<ActionResult<ApiResponse<List<InventoryStockDto>>>> GetInventory(int storeId)
        {
            await _tenantAccess.EnsureStoreAccessAsync(storeId);
            if (_currentUser.TenantId.HasValue) await _subscription.EnsureFeatureAccessAsync(_currentUser.TenantId.Value, "inventory", "premium");
            var stocks = await _inventoryService.GetInventoryByStoreAsync(storeId);
            return Ok(ApiResponse<List<InventoryStockDto>>.Ok(stocks));
        }

        [HttpPost("import")]
        [Authorize(Policy = "ManagerAccess")]
        public async Task<ActionResult<ApiResponse<object>>> ImportInventory([FromBody] ImportInventoryDto dto)
        {
            await _tenantAccess.EnsureStoreAccessAsync(dto.StoreId);
            if (_currentUser.TenantId.HasValue) await _subscription.EnsureFeatureAccessAsync(_currentUser.TenantId.Value, "inventory", "premium");
            await _inventoryService.ImportInventoryAsync(dto.StoreId, dto.IngredientId, dto.Quantity, _currentUser.UserId, dto.Note);
            return Ok(ApiResponse<object>.Ok(new { }, "Nhập kho thành công."));
        }

        [HttpPost("adjust")]
        [Authorize(Policy = "ManagerAccess")]
        public async Task<ActionResult<ApiResponse<object>>> AdjustInventory([FromBody] AdjustInventoryDto dto)
        {
            await _tenantAccess.EnsureStoreAccessAsync(dto.StoreId);
            if (_currentUser.TenantId.HasValue) await _subscription.EnsureFeatureAccessAsync(_currentUser.TenantId.Value, "inventory", "premium");
            await _inventoryService.AdjustInventoryAsync(dto.StoreId, dto.IngredientId, dto.NewQuantity, _currentUser.UserId, dto.Note);
            return Ok(ApiResponse<object>.Ok(new { }, "Điều chỉnh kho thành công."));
        }

        [HttpGet("transactions/store/{storeId}")]
        [Authorize(Policy = "StaffAccess")]
        public async Task<ActionResult<ApiResponse<List<InventoryTransactionDto>>>> GetTransactions(
            int storeId, 
            [FromQuery] int? ingredientId,
            [FromQuery] DateTime? fromDate,
            [FromQuery] DateTime? toDate)
        {
            await _tenantAccess.EnsureStoreAccessAsync(storeId);
            if (_currentUser.TenantId.HasValue) await _subscription.EnsureFeatureAccessAsync(_currentUser.TenantId.Value, "inventory", "premium");
            var transactions = await _inventoryService.GetTransactionHistoryAsync(storeId, ingredientId, fromDate, toDate);
            return Ok(ApiResponse<List<InventoryTransactionDto>>.Ok(transactions));
        }

        [HttpGet("ingredients")]
        [Authorize(Policy = "StaffAccess")]
        public async Task<ActionResult<ApiResponse<List<IngredientDto>>>> GetIngredients(
            [FromQuery] int? storeId = null)
        {
            if (storeId.HasValue) await _tenantAccess.EnsureStoreAccessAsync(storeId.Value);
            var tenantId = _currentUser.TenantId ?? throw new ForbiddenException();
            await _subscription.EnsureFeatureAccessAsync(tenantId, "inventory", "premium");
            var list = await _inventoryService.GetIngredientsAsync(tenantId, storeId);
            return Ok(ApiResponse<List<IngredientDto>>.Ok(list));
        }

        [HttpPost("ingredients")]
        [Authorize(Policy = "ManagerAccess")]
        public async Task<ActionResult<ApiResponse<IngredientDto>>> CreateIngredient([FromBody] CreateIngredientDto dto)
        {
            await _tenantAccess.EnsureStoreAccessAsync(dto.StoreId);
            dto.TenantId = _currentUser.TenantId ?? throw new ForbiddenException();
            await _subscription.EnsureFeatureAccessAsync(dto.TenantId, "inventory", "premium");
            var result = await _inventoryService.CreateIngredientAsync(dto);
            return Ok(ApiResponse<IngredientDto>.Ok(result, "Tạo nguyên liệu thành công."));
        }

        [HttpPut("ingredients/{id}")]
        [Authorize(Policy = "ManagerAccess")]
        public async Task<ActionResult<ApiResponse<IngredientDto>>> UpdateIngredient(int id, [FromBody] UpdateIngredientDto dto)
        {
            var tenantId = _currentUser.TenantId ?? throw new ForbiddenException();
            await _subscription.EnsureFeatureAccessAsync(tenantId, "inventory", "premium");
            var result = await _inventoryService.UpdateIngredientAsync(id, dto);
            return Ok(ApiResponse<IngredientDto>.Ok(result, "Cập nhật nguyên liệu thành công."));
        }

        [HttpDelete("ingredients/{id}")]
        [Authorize(Policy = "ManagerAccess")]
        public async Task<ActionResult<ApiResponse<object>>> DeleteIngredient(int id)
        {
            var tenantId = _currentUser.TenantId ?? throw new ForbiddenException();
            await _subscription.EnsureFeatureAccessAsync(tenantId, "inventory", "premium");
            await _inventoryService.DeleteIngredientAsync(id);
            return Ok(ApiResponse<object>.Ok(new { }, "Xóa nguyên liệu thành công."));
        }

        [HttpGet("recipes/menu-item/{menuItemId}")]
        [Authorize(Policy = "StaffAccess")]
        public async Task<ActionResult<ApiResponse<List<MenuItemRecipeDto>>>> GetMenuItemRecipes(int menuItemId)
        {
            var tenantId = _currentUser.TenantId ?? throw new ForbiddenException();
            await _subscription.EnsureFeatureAccessAsync(tenantId, "inventory_bom", "premium");
            var recipes = await _inventoryService.GetMenuItemRecipesAsync(menuItemId);
            return Ok(ApiResponse<List<MenuItemRecipeDto>>.Ok(recipes));
        }

        [HttpPost("recipes/menu-item")]
        [Authorize(Policy = "ManagerAccess")]
        public async Task<ActionResult<ApiResponse<object>>> UpsertRecipe([FromBody] UpsertRecipeDto dto)
        {
            var tenantId = _currentUser.TenantId ?? throw new ForbiddenException();
            await _subscription.EnsureFeatureAccessAsync(tenantId, "inventory_bom", "premium");
            await _inventoryService.UpsertMenuItemRecipeAsync(dto);
            return Ok(ApiResponse<object>.Ok(new { }, "Lưu định lượng công thức thành công."));
        }

        [HttpDelete("recipes/{recipeId}")]
        [Authorize(Policy = "ManagerAccess")]
        public async Task<ActionResult<ApiResponse<object>>> DeleteRecipe(int recipeId)
        {
            var tenantId = _currentUser.TenantId ?? throw new ForbiddenException();
            await _subscription.EnsureFeatureAccessAsync(tenantId, "inventory_bom", "premium");
            await _inventoryService.DeleteMenuItemRecipeAsync(recipeId);
            return Ok(ApiResponse<object>.Ok(new { }, "Xóa nguyên liệu khỏi công thức thành công."));
        }

        [HttpGet("alerts/store/{storeId}")]
        [Authorize(Policy = "StaffAccess")]
        public async Task<ActionResult<ApiResponse<List<LowStockAlertDto>>>> GetLowStockAlerts(int storeId)
        {
            var tenantId = _currentUser.TenantId ?? throw new ForbiddenException();
            await _subscription.EnsureFeatureAccessAsync(tenantId, "inventory", "premium");
            var alerts = await _inventoryService.GetLowStockAlertsAsync(storeId);
            return Ok(ApiResponse<List<LowStockAlertDto>>.Ok(alerts));
        }

        [HttpPost("ai/chat")]
        [Authorize(Policy = "ManagerAccess")]
        public async Task<ActionResult<ApiResponse<InventoryAiChatResponseDto>>> ChatWithInventoryAi([FromBody] InventoryAiChatRequestDto request)
        {
            if (request.StoreId <= 0 || string.IsNullOrWhiteSpace(request.Message))
                return BadRequest(ApiResponse<InventoryAiChatResponseDto>.Fail("StoreId và câu hỏi là bắt buộc."));
            await _tenantAccess.EnsureStoreAccessAsync(request.StoreId);
            var tenantId = _currentUser.TenantId ?? throw new ForbiddenException();
            await _subscription.EnsureFeatureAccessAsync(tenantId, "inventory_ai", "premium");
            request.PeriodDays = request.PeriodDays is 7 or 30 or 90 ? request.PeriodDays : 30;
            var result = await _geminiService.ChatWithInventoryAsync(request);
            return Ok(ApiResponse<InventoryAiChatResponseDto>.Ok(result));
        }

        [HttpGet("ai/summary")]
        [Authorize(Policy = "ManagerAccess")]
        public async Task<ActionResult<ApiResponse<InventoryAiChatResponseDto>>> GetInventoryAiSummary([FromQuery] int storeId, [FromQuery] int periodDays = 30)
        {
            if (storeId <= 0) return BadRequest(ApiResponse<InventoryAiChatResponseDto>.Fail("StoreId không hợp lệ."));
            await _tenantAccess.EnsureStoreAccessAsync(storeId);
            var tenantId = _currentUser.TenantId ?? throw new ForbiddenException();
            await _subscription.EnsureFeatureAccessAsync(tenantId, "inventory_ai", "premium");
            var result = await _geminiService.GetInventorySummaryAsync(storeId, periodDays is 7 or 30 or 90 ? periodDays : 30);
            return Ok(ApiResponse<InventoryAiChatResponseDto>.Ok(result));
        }
    }

    public class ImportInventoryDto
    {
        public int StoreId { get; set; }
        public int IngredientId { get; set; }
        public decimal Quantity { get; set; }
        public string? Note { get; set; }
    }

    public class AdjustInventoryDto
    {
        public int StoreId { get; set; }
        public int IngredientId { get; set; }
        public decimal NewQuantity { get; set; }
        public string? Note { get; set; }
    }

    [ApiController]
    [Route("api/[controller]")]
    public class AIController : ControllerBase
    {
        private readonly IGeminiService _geminiService;
        private readonly ILogger<AIController> _logger;

        public AIController(IGeminiService geminiService, ILogger<AIController> logger)
        {
            _geminiService = geminiService;
            _logger = logger;
        }

        /// <summary>
        /// Gợi ý món ăn thông minh & cá nhân hóa sử dụng Google Gemini AI (với caching và statistical fallback)
        /// </summary>
        [HttpPost("recommend")]
        [AllowAnonymous]
        public async Task<ActionResult<ApiResponse<AiRecommendationResponseDto>>> GetSmartRecommendations([FromBody] AiRecommendationRequestDto request)
        {
            if (request.StoreId <= 0 && request.TenantId <= 0)
            {
                return BadRequest(ApiResponse<AiRecommendationResponseDto>.Fail("StoreId hoặc TenantId không hợp lệ."));
            }

            try
            {
                var recommendations = await _geminiService.GetSmartRecommendationsAsync(request);
                return Ok(ApiResponse<AiRecommendationResponseDto>.Ok(recommendations, "Lấy gợi ý món ăn thành công."));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi khi lấy AI recommendations");
                return StatusCode(500, ApiResponse<AiRecommendationResponseDto>.Fail($"Lỗi hệ thống khi xử lý gợi ý AI: {ex.Message}"));
            }
        }

        /// <summary>
        /// Trò chuyện tự do cùng AI Sommelier để tư vấn món ăn & đồ uống chuẩn vị
        /// </summary>
        [HttpPost("chat")]
        [AllowAnonymous]
        public async Task<ActionResult<ApiResponse<AiChatResponseDto>>> ChatWithSommelier([FromBody] AiChatRequestDto request)
        {
            if (request.StoreId <= 0 && request.TenantId <= 0)
            {
                return BadRequest(ApiResponse<AiChatResponseDto>.Fail("StoreId hoặc TenantId không hợp lệ."));
            }

            if (string.IsNullOrWhiteSpace(request.Message))
            {
                return BadRequest(ApiResponse<AiChatResponseDto>.Fail("Vui lòng nhập câu hỏi hoặc yêu cầu cho AI Sommelier."));
            }

            try
            {
                var chatResponse = await _geminiService.ChatWithSommelierAsync(request);
                return Ok(ApiResponse<AiChatResponseDto>.Ok(chatResponse, "AI Sommelier phản hồi thành công."));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi khi xử lý cuộc trò chuyện với AI Sommelier");
                return StatusCode(500, ApiResponse<AiChatResponseDto>.Fail($"Lỗi hệ thống khi trò chuyện cùng AI: {ex.Message}"));
            }
        }
    }
}


