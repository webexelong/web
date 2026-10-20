using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WebCafe.Backend.Common.Helper;
using WebCafe.Backend.Common.Models;
using WebCafe.Backend.Infrastructure.Data;
using WebCafe.Backend.Models.DTOs.SystemAdmin;
using WebCafe.Backend.Models.Entities;

namespace WebCafe.Backend.Controllers
{
    [ApiController]
    [Route("api/system")]
    [Authorize(Policy = "SystemAdminOnly")]
    public class SystemAdminController : ControllerBase
    {
        private readonly WebCafeDbContext _db;
        private readonly ILogger<SystemAdminController> _logger;

        public SystemAdminController(WebCafeDbContext db, ILogger<SystemAdminController> logger)
        {
            _db = db;
            _logger = logger;
        }

        /// <summary>
        /// Lấy thống kê tổng quan toàn sàn SaaS
        /// </summary>
        [HttpGet("stats")]
        public async Task<ActionResult<ApiResponse<PlatformStatsDto>>> GetPlatformStats()
        {
            var totalTenants = await _db.Tenants.CountAsync();
            var activeTenants = await _db.Tenants.CountAsync(t => t.IsActive);
            var totalStores = await _db.Stores.CountAsync();
            var totalTables = await _db.Tables.CountAsync();
            var totalOrders = await _db.Orders.CountAsync();
            var totalGmv = await _db.Orders
                .Where(o => o.Status != "cancelled")
                .SumAsync(o => (decimal?)o.TotalAmount) ?? 0m;

            // Tính ước tính doanh thu thuê bao phần mềm dựa trên gói
            var activePlanPrices = await _db.SubscriptionPlans
                .Where(p => p.IsActive)
                .ToDictionaryAsync(p => p.Code.ToLower(), p => p.MonthlyPrice);
            var tenants = await _db.Tenants.Where(t => t.IsActive).Select(t => t.Plan).ToListAsync();
            decimal subscriptionRevenue = tenants.Sum(plan => activePlanPrices.TryGetValue((plan ?? "basic").ToLower(), out var price) ? price : 0m);

            // Tính toán doanh thu thực tế 7 ngày gần nhất từ cơ sở dữ liệu Orders
            var now = DateTime.UtcNow;
            var sevenDaysAgo = now.Date.AddDays(-6);
            var recentOrders = await _db.Orders
                .Where(o => o.CreatedAt >= sevenDaysAgo && o.Status != "cancelled")
                .Select(o => new { o.CreatedAt, o.TotalAmount })
                .ToListAsync();

            var dailyRevenueList = new List<DailyRevenueDto>();
            for (int i = 0; i < 7; i++)
            {
                var dayDate = sevenDaysAgo.AddDays(i);
                var ordersInDay = recentOrders.Where(o => o.CreatedAt.Date == dayDate.Date).ToList();
                var label = i == 6 ? "Hôm nay" : dayDate.DayOfWeek switch
                {
                    DayOfWeek.Monday => "T2",
                    DayOfWeek.Tuesday => "T3",
                    DayOfWeek.Wednesday => "T4",
                    DayOfWeek.Thursday => "T5",
                    DayOfWeek.Friday => "T6",
                    DayOfWeek.Saturday => "T7",
                    DayOfWeek.Sunday => "CN",
                    _ => dayDate.ToString("dd/MM")
                };

                dailyRevenueList.Add(new DailyRevenueDto
                {
                    Date = dayDate.ToString("yyyy-MM-dd"),
                    DayLabel = label,
                    Revenue = ordersInDay.Sum(x => x.TotalAmount),
                    OrderCount = ordersInDay.Count
                });
            }

            var stats = new PlatformStatsDto
            {
                TotalTenants = totalTenants,
                ActiveTenants = activeTenants,
                TotalStores = totalStores,
                TotalTables = totalTables,
                TotalOrders = totalOrders,
                TotalGmv = totalGmv,
                MonthlySubscriptionRevenue = subscriptionRevenue,
                DailyRevenue = dailyRevenueList
            };

            return Ok(ApiResponse<PlatformStatsDto>.Ok(stats, "Lấy thống kê nền tảng thành công."));
        }

        [HttpGet("subscriptions/report")]
        public async Task<ActionResult<ApiResponse<SubscriptionReportDto>>> GetSubscriptionReport()
        {
            var now = DateTime.UtcNow;
            var active = await _db.TenantSubscriptions.CountAsync(s => s.Status == "active");
            var trialing = await _db.TenantSubscriptions.CountAsync(s => s.Status == "trialing" && s.TrialEndsAt > now);
            var grace = await _db.TenantSubscriptions.CountAsync(s => s.Status == "grace" && s.GraceEndsAt > now);
            var revenue = await _db.SubscriptionBillingRecords
                .Where(b => b.Status == "paid")
                .SumAsync(b => (decimal?)b.Amount) ?? 0m;
            var plans = await _db.SubscriptionPlans
                .Select(p => new SubscriptionPlanReportDto
                {
                    PlanCode = p.Code,
                    TenantCount = _db.TenantSubscriptions.Count(s => s.PlanId == p.PlanId && (s.Status == "active" || s.Status == "trialing")),
                    MonthlyRevenue = p.MonthlyPrice * _db.TenantSubscriptions.Count(s => s.PlanId == p.PlanId && s.Status == "active")
                }).ToListAsync();
            return Ok(ApiResponse<SubscriptionReportDto>.Ok(new SubscriptionReportDto
            {
                ActiveSubscriptions = active,
                TrialingSubscriptions = trialing,
                GracePeriodSubscriptions = grace,
                PaidRevenue = revenue,
                Plans = plans
            }));
        }

        [HttpGet("plans")]
        public async Task<ActionResult<ApiResponse<List<SubscriptionPlanConfigDto>>>> GetPlans()
        {
            var plans = await _db.SubscriptionPlans.Include(p => p.Features).OrderBy(p => p.MonthlyPrice).ToListAsync();
            return Ok(ApiResponse<List<SubscriptionPlanConfigDto>>.Ok(plans.Select(ToPlanConfig).ToList()));
        }

        [HttpPut("plans/{code}")]
        public async Task<ActionResult<ApiResponse<SubscriptionPlanConfigDto>>> UpdatePlan(string code, [FromBody] UpdateSubscriptionPlanRequest request)
        {
            var plan = await _db.SubscriptionPlans.Include(p => p.Features).FirstOrDefaultAsync(p => p.Code == code.ToLower());
            if (plan == null) return NotFound(ApiResponse<SubscriptionPlanConfigDto>.Fail("Không tìm thấy gói dịch vụ."));
            plan.MonthlyPrice = request.MonthlyPrice;
            plan.MaxStores = request.MaxStores;
            plan.MaxStaff = request.MaxStaff;
            plan.MaxTablesPerStore = request.MaxTablesPerStore;
            plan.IsActive = request.IsActive;
            if (request.Features != null)
            {
                foreach (var pair in request.Features)
                {
                    var feature = plan.Features.FirstOrDefault(f => f.FeatureCode == pair.Key);
                    if (feature == null) plan.Features.Add(new SubscriptionPlanFeature { PlanId = plan.PlanId, FeatureCode = pair.Key, IsEnabled = pair.Value });
                    else feature.IsEnabled = pair.Value;
                }
            }
            await _db.SaveChangesAsync();
            return Ok(ApiResponse<SubscriptionPlanConfigDto>.Ok(ToPlanConfig(plan), "Đã cập nhật cấu hình gói."));
        }

        private static SubscriptionPlanConfigDto ToPlanConfig(SubscriptionPlan plan) => new()
        {
            Code = plan.Code, Name = plan.Name, MonthlyPrice = plan.MonthlyPrice,
            MaxStores = plan.MaxStores, MaxStaff = plan.MaxStaff, MaxTablesPerStore = plan.MaxTablesPerStore,
            IsActive = plan.IsActive, Features = plan.Features.ToDictionary(f => f.FeatureCode, f => f.IsEnabled, StringComparer.OrdinalIgnoreCase)
        };

        /// <summary>
        /// Lấy danh sách tất cả các quán cafe đối tác trên hệ thống
        /// </summary>
        [HttpGet("tenants")]
        public async Task<ActionResult<ApiResponse<List<TenantDetailDto>>>> GetTenants()
        {
            var tenants = await _db.Tenants
                .Include(t => t.Stores)
                .OrderByDescending(t => t.CreatedAt)
                .ToListAsync();

            var tenantIds = tenants.Select(t => t.TenantId).ToList();

            // Đếm số bàn và số đơn hàng theo từng tenant
            var tablesPerTenant = await _db.Tables
                .Include(tb => tb.Store)
                .Where(tb => tb.Store != null && tenantIds.Contains(tb.Store.TenantId))
                .GroupBy(tb => tb.Store!.TenantId)
                .Select(g => new { TenantId = g.Key, Count = g.Count() })
                .ToDictionaryAsync(x => x.TenantId, x => x.Count);

            var ordersPerTenant = await _db.Orders
                .Where(o => tenantIds.Contains(o.TenantId))
                .GroupBy(o => o.TenantId)
                .Select(g => new 
                { 
                    TenantId = g.Key, 
                    Count = g.Count(), 
                    Gmv = g.Where(x => x.Status != "cancelled").Sum(x => (decimal?)x.TotalAmount) ?? 0m 
                })
                .ToDictionaryAsync(x => x.TenantId, x => new { x.Count, x.Gmv });

            var result = tenants.Select(t =>
            {
                var tableCount = tablesPerTenant.ContainsKey(t.TenantId) ? tablesPerTenant[t.TenantId] : 0;
                var orderData = ordersPerTenant.ContainsKey(t.TenantId) ? ordersPerTenant[t.TenantId] : new { Count = 0, Gmv = 0m };

                return new TenantDetailDto
                {
                    TenantId = t.TenantId,
                    Name = t.Name,
                    Slug = t.Slug,
                    OwnerName = t.OwnerName,
                    OwnerEmail = t.OwnerEmail,
                    OwnerPhone = t.OwnerPhone,
                    LogoUrl = t.LogoUrl,
                    Plan = t.Plan,
                    MaxStores = t.MaxStores,
                    IsActive = t.IsActive,
                    CreatedAt = t.CreatedAt,
                    StoreCount = t.Stores?.Count ?? 0,
                    TableCount = tableCount,
                    OrderCount = orderData.Count,
                    TotalGmv = orderData.Gmv
                };
            }).ToList();

            return Ok(ApiResponse<List<TenantDetailDto>>.Ok(result, "Lấy danh sách quán đối tác thành công."));
        }

        /// <summary>
        /// Tạo một quán cafe đối tác mới kèm tài khoản Chủ quán (Owner)
        /// </summary>
        [HttpPost("tenants")]
        public async Task<ActionResult<ApiResponse<TenantDetailDto>>> CreateTenant([FromBody] CreateTenantRequest request)
        {
            // 1. Kiểm tra trùng email
            var existingTenant = await _db.Tenants
                .FirstOrDefaultAsync(t => t.OwnerEmail.ToLower() == request.OwnerEmail.Trim().ToLower());
            if (existingTenant != null)
            {
                return BadRequest(ApiResponse<TenantDetailDto>.Fail("Email chủ quán này đã tồn tại trong hệ thống."));
            }

            var planCode = (request.Plan ?? "basic").Trim().ToLowerInvariant();
            var selectedPlan = await _db.SubscriptionPlans.FirstOrDefaultAsync(p => p.Code == planCode && p.IsActive);
            if (selectedPlan == null) return BadRequest(ApiResponse<TenantDetailDto>.Fail("Gói dịch vụ không tồn tại hoặc đang tạm ngưng."));

            var slug = string.IsNullOrWhiteSpace(request.Slug)
                ? request.Name.ToLower().Replace(" ", "-").Replace("/", "-")
                : request.Slug.Trim().ToLower();

            // 2. Tạo Tenant mới
            var tenant = new Tenant
            {
                Name = request.Name.Trim(),
                Slug = slug,
                OwnerName = request.OwnerName.Trim(),
                OwnerEmail = request.OwnerEmail.Trim().ToLower(),
                OwnerPhone = request.OwnerPhone.Trim(),
                OwnerPasswordHash = SecurityHelper.HashPassword(request.OwnerPassword.Trim()),
                LogoUrl = request.LogoUrl ?? "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=300&q=80",
                Plan = selectedPlan.Code,
                MaxStores = selectedPlan.MaxStores,
                PointsPerAmount = 10000,
                PointsToMoney = 200,
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            };

            _db.Tenants.Add(tenant);
            await _db.SaveChangesAsync();

            _db.TenantSubscriptions.Add(new TenantSubscription
            {
                TenantId = tenant.TenantId,
                PlanId = selectedPlan.PlanId,
                Status = "active",
                StartsAt = DateTime.UtcNow,
                CreatedAt = DateTime.UtcNow
            });
            await _db.SaveChangesAsync();

            // 3. Tạo chi nhánh đầu tiên mặc định cho quán
            var store = new Store
            {
                TenantId = tenant.TenantId,
                Name = request.InitialStoreName ?? $"{tenant.Name} - Chi Nhánh 1",
                Address = request.InitialStoreAddress ?? "Địa chỉ chính",
                Phone = request.InitialStorePhone ?? tenant.OwnerPhone,
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            };

            _db.Stores.Add(store);
            await _db.SaveChangesAsync();

            // 4. Tạo sẵn các bàn mẫu (T01 - T06) cho chi nhánh mới
            for (int i = 1; i <= 6; i++)
            {
                _db.Tables.Add(new Table
                {
                    StoreId = store.StoreId,
                    TableNumber = $"T0{i}",
                    Capacity = 4,
                    Status = "Available",
                    QRCodeUrl = $"/qr?store={store.StoreId}&table=T0{i}",
                    IsActive = true
                });
            }
            await _db.SaveChangesAsync();

            _logger.LogInformation("SuperAdmin đã tạo thành công quán đối tác mới: {Name} (ID: {Id})", tenant.Name, tenant.TenantId);

            var detailDto = new TenantDetailDto
            {
                TenantId = tenant.TenantId,
                Name = tenant.Name,
                Slug = tenant.Slug,
                OwnerName = tenant.OwnerName,
                OwnerEmail = tenant.OwnerEmail,
                OwnerPhone = tenant.OwnerPhone,
                LogoUrl = tenant.LogoUrl,
                Plan = tenant.Plan,
                MaxStores = tenant.MaxStores,
                IsActive = tenant.IsActive,
                CreatedAt = tenant.CreatedAt,
                StoreCount = 1,
                TableCount = 6,
                OrderCount = 0,
                TotalGmv = 0
            };

            return Ok(ApiResponse<TenantDetailDto>.Ok(detailDto, "Tạo quán cafe đối tác mới thành công."));
        }

        /// <summary>
        /// Bật hoặc Tắt trạng thái hoạt động (Khóa / Mở khóa) của quán đối tác
        /// </summary>
        [HttpPut("tenants/{id}/toggle-status")]
        public async Task<ActionResult<ApiResponse<object>>> ToggleTenantStatus(int id)
        {
            var tenant = await _db.Tenants.FindAsync(id);
            if (tenant == null)
            {
                return NotFound(ApiResponse<object>.Fail("Không tìm thấy quán cafe với mã đã cung cấp."));
            }

            tenant.IsActive = !tenant.IsActive;
            await _db.SaveChangesAsync();

            var statusStr = tenant.IsActive ? "kích hoạt mở lại" : "tạm ngưng dịch vụ";
            _logger.LogInformation("SuperAdmin đã {Status} quán {Name} (ID: {Id})", statusStr, tenant.Name, tenant.TenantId);

            return Ok(ApiResponse<object>.Ok(new { tenant.TenantId, tenant.IsActive }, $"Đã {statusStr} quán '{tenant.Name}'."));
        }

        [HttpDelete("tenants/{id}")]
        public async Task<ActionResult<ApiResponse<object>>> DeleteTrialTenant(int id)
        {
            var tenant = await _db.Tenants.FirstOrDefaultAsync(t => t.TenantId == id);
            if (tenant == null) return NotFound(ApiResponse<object>.Fail("Không tìm thấy quán cần xóa."));
            if (tenant.Slug == "aismartserve-demo") return BadRequest(ApiResponse<object>.Fail("Không thể xóa khu demo công khai."));
            var isTrial = await _db.TenantSubscriptions.AnyAsync(s => s.TenantId == id && s.Status == "trialing") || !tenant.OwnerEmailVerified;
            if (!isTrial) return BadRequest(ApiResponse<object>.Fail("Chỉ được xóa quán đang dùng thử 14 ngày."));

            await using var transaction = await _db.Database.BeginTransactionAsync();
            var storeIds = await _db.Stores.Where(s => s.TenantId == id).Select(s => s.StoreId).ToListAsync();
            var menuIds = await _db.MenuItems.Where(m => m.TenantId == id).Select(m => m.MenuItemId).ToListAsync();
            var orderIds = await _db.Orders.Where(o => o.TenantId == id).Select(o => o.OrderId).ToListAsync();
            var orderItemIds = await _db.OrderItems.Where(i => orderIds.Contains(i.OrderId)).Select(i => i.OrderItemId).ToListAsync();
            var customerIds = await _db.Customers.Where(c => c.TenantId == id).Select(c => c.CustomerId).ToListAsync();
            var ingredientIds = await _db.Ingredients.Where(i => i.TenantId == id).Select(i => i.IngredientId).ToListAsync();
            var stockIds = await _db.InventoryStocks.Where(s => storeIds.Contains(s.StoreId) || ingredientIds.Contains(s.IngredientId)).Select(s => s.StockId).ToListAsync();
            var staffIds = await _db.Staff.Where(s => storeIds.Contains(s.StoreId)).Select(s => s.StaffId).ToListAsync();
            var shiftIds = await _db.Shifts.Where(s => storeIds.Contains(s.StoreId)).Select(s => s.ShiftId).ToListAsync();

            await _db.OrderItemToppings.Where(x => orderItemIds.Contains(x.OrderItemId)).ExecuteDeleteAsync();
            await _db.Payments.Where(x => orderIds.Contains(x.OrderId)).ExecuteDeleteAsync();
            await _db.LoyaltyPoints.Where(x => customerIds.Contains(x.CustomerId) || (x.OrderId.HasValue && orderIds.Contains(x.OrderId.Value))).ExecuteDeleteAsync();
            await _db.VoucherUsages.Where(x => (x.CustomerId.HasValue && customerIds.Contains(x.CustomerId.Value)) || orderIds.Contains(x.OrderId)).ExecuteDeleteAsync();
            await _db.OrderItems.Where(x => orderIds.Contains(x.OrderId)).ExecuteDeleteAsync();
            await _db.Orders.Where(x => orderIds.Contains(x.OrderId)).ExecuteDeleteAsync();
            // Inventory transactions can reference stock, order or staff; remove all of them before parents.
            await _db.InventoryTransactions.Where(x => stockIds.Contains(x.StockId) || (x.OrderId.HasValue && orderIds.Contains(x.OrderId.Value)) || (x.StaffId.HasValue && staffIds.Contains(x.StaffId.Value))).ExecuteDeleteAsync();
            await _db.InventoryStocks.Where(x => stockIds.Contains(x.StockId)).ExecuteDeleteAsync();
            await _db.MenuItemRecipes.Where(x => menuIds.Contains(x.MenuItemId)).ExecuteDeleteAsync();
            await _db.ToppingRecipes.Where(x => ingredientIds.Contains(x.IngredientId)).ExecuteDeleteAsync();
            await _db.MenuItemSizes.Where(x => menuIds.Contains(x.MenuItemId)).ExecuteDeleteAsync();
            await _db.MenuItemToppings.Where(x => menuIds.Contains(x.MenuItemId)).ExecuteDeleteAsync();
            await _db.StaffShifts.Where(x => staffIds.Contains(x.StaffId) || shiftIds.Contains(x.ShiftId)).ExecuteDeleteAsync();
            await _db.Shifts.Where(x => shiftIds.Contains(x.ShiftId)).ExecuteDeleteAsync();
            await _db.Staff.Where(x => staffIds.Contains(x.StaffId)).ExecuteDeleteAsync();
            await _db.Tables.Where(x => storeIds.Contains(x.StoreId)).ExecuteDeleteAsync();
            await _db.Vouchers.Where(x => x.TenantId == id).ExecuteDeleteAsync();
            await _db.Customers.Where(x => customerIds.Contains(x.CustomerId)).ExecuteDeleteAsync();
            await _db.RolePermissions.Where(x => _db.Roles.Where(r => r.TenantId == id).Select(r => r.RoleId).Contains(x.RoleId)).ExecuteDeleteAsync();
            await _db.MenuItems.Where(x => menuIds.Contains(x.MenuItemId)).ExecuteDeleteAsync();
            await _db.Categories.Where(x => x.TenantId == id).ExecuteDeleteAsync();
            await _db.Sizes.Where(x => x.TenantId == id).ExecuteDeleteAsync();
            await _db.MenuItemToppings.Where(x => x.Topping != null && x.Topping.TenantId == id).ExecuteDeleteAsync();
            await _db.Toppings.Where(x => x.TenantId == id).ExecuteDeleteAsync();
            await _db.Ingredients.Where(x => x.TenantId == id).ExecuteDeleteAsync();
            await _db.Roles.Where(x => x.TenantId == id).ExecuteDeleteAsync();
            var subIds = await _db.TenantSubscriptions.Where(x => x.TenantId == id).Select(x => x.SubscriptionId).ToListAsync();
            await _db.SubscriptionBillingRecords.Where(x => x.TenantId == id || subIds.Contains(x.SubscriptionId)).ExecuteDeleteAsync();
            await _db.TenantSubscriptions.Where(x => x.TenantId == id).ExecuteDeleteAsync();
            await _db.Stores.Where(x => storeIds.Contains(x.StoreId)).ExecuteDeleteAsync();
            await _db.Tenants.Where(x => x.TenantId == id).ExecuteDeleteAsync();
            await transaction.CommitAsync();
            return Ok(ApiResponse<object>.Ok(new { tenantId = id }, "Đã xóa vĩnh viễn quán dùng thử."));
        }

        /// <summary>
        /// Cập nhật gói cước dịch vụ và số chi nhánh tối đa
        /// </summary>
        [HttpPut("tenants/{id}/plan")]
        public async Task<ActionResult<ApiResponse<object>>> UpdateTenantPlan(int id, [FromBody] UpdateTenantPlanRequest request)
        {
            var tenant = await _db.Tenants.FindAsync(id);
            if (tenant == null)
            {
                return NotFound(ApiResponse<object>.Fail("Không tìm thấy quán cafe với mã đã cung cấp."));
            }

            var planCode = request.Plan.ToLowerInvariant();
            var plan = await _db.SubscriptionPlans.FirstOrDefaultAsync(p => p.Code == planCode && p.IsActive);
            if (plan == null) return BadRequest(ApiResponse<object>.Fail("Gói dịch vụ không tồn tại hoặc đang tạm ngưng."));
            tenant.Plan = plan.Code;
            tenant.MaxStores = plan.MaxStores;
            var subscription = await _db.TenantSubscriptions.Where(s => s.TenantId == id && s.Status != "cancelled").OrderByDescending(s => s.CreatedAt).FirstOrDefaultAsync();
            if (subscription == null)
            {
                subscription = new TenantSubscription { TenantId = id, PlanId = plan.PlanId, Status = "active", StartsAt = DateTime.UtcNow, CreatedAt = DateTime.UtcNow };
                _db.TenantSubscriptions.Add(subscription);
            }
            else
            {
                subscription.PlanId = plan.PlanId;
                if (subscription.Status == "suspended" || subscription.Status == "grace") subscription.Status = "active";
                subscription.CurrentPeriodStart = DateTime.UtcNow;
            }
            await _db.SaveChangesAsync();

            return Ok(ApiResponse<object>.Ok(new { tenant.TenantId, tenant.Plan, tenant.MaxStores, maxStaff = plan.MaxStaff, maxTablesPerStore = plan.MaxTablesPerStore }, $"Cập nhật gói dịch vụ quán '{tenant.Name}' thành công."));
        }
    }
}
