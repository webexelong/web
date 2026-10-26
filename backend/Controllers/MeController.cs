using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WebCafe.Backend.Common.Constants;
using WebCafe.Backend.Common.Models;
using WebCafe.Backend.Infrastructure.Data;
using WebCafe.Backend.Services.Abstraction;
using WebCafe.Backend.Models.DTOs.SystemAdmin;
using WebCafe.Backend.Models.Entities;

namespace WebCafe.Backend.Controllers;

[ApiController]
[Route("api/me")]
[Authorize(Policy = AppPolicies.RequireAuthenticated)]
public class MeController : ControllerBase
{
    private readonly WebCafeDbContext _db;
    private readonly ICurrentUserService _currentUser;
    private readonly ISubscriptionService _subscriptionService;

    public MeController(WebCafeDbContext db, ICurrentUserService currentUser, ISubscriptionService subscriptionService)
    {
        _db = db;
        _currentUser = currentUser;
        _subscriptionService = subscriptionService;
    }

    [HttpGet("stores")]
    public async Task<ActionResult<ApiResponse<List<MyStoreDto>>>> GetStores()
    {
        if (!_currentUser.TenantId.HasValue) return Ok(ApiResponse<List<MyStoreDto>>.Ok(new()));
        var stores = await _db.Stores.AsNoTracking()
            .Where(s => s.TenantId == _currentUser.TenantId.Value && s.IsActive)
            .OrderBy(s => s.StoreId)
            .Select(s => new MyStoreDto { StoreId = s.StoreId, Name = s.Name, IsActive = s.IsActive })
            .ToListAsync();
        return Ok(ApiResponse<List<MyStoreDto>>.Ok(stores));
    }

    [HttpGet("subscription")]
    public async Task<ActionResult<ApiResponse<SubscriptionAccessDto>>> GetSubscription()
    {
        if (!_currentUser.TenantId.HasValue) return Ok(ApiResponse<MySubscriptionDto>.Ok(new()));
        var access = await _subscriptionService.GetAccessAsync(_currentUser.TenantId.Value);
        return Ok(ApiResponse<SubscriptionAccessDto>.Ok(access));
    }

    [HttpGet("subscription/plans")]
    public async Task<ActionResult<ApiResponse<List<SubscriptionPlanConfigDto>>>> GetPlans()
    {
        var plans = await _db.SubscriptionPlans.AsNoTracking().Include(p => p.Features).Where(p => p.IsActive).OrderBy(p => p.MonthlyPrice).ToListAsync();
        return Ok(ApiResponse<List<SubscriptionPlanConfigDto>>.Ok(plans.Select(p => new SubscriptionPlanConfigDto
        {
            Code = p.Code, Name = p.Name, MonthlyPrice = p.MonthlyPrice, MaxStores = p.MaxStores, MaxStaff = p.MaxStaff, MaxTablesPerStore = p.MaxTablesPerStore, IsActive = p.IsActive,
            Features = p.Features.ToDictionary(f => f.FeatureCode, f => f.IsEnabled, StringComparer.OrdinalIgnoreCase)
        }).ToList()));
    }

    [HttpPost("subscription/upgrade")]
    [Authorize(Policy = AppPolicies.TenantAdminAccess)]
    public async Task<ActionResult<ApiResponse<SubscriptionAccessDto>>> UpgradeSubscription([FromBody] UpgradeSubscriptionRequest request)
    {
        if (!_currentUser.TenantId.HasValue) return Forbid();
        var tenantId = _currentUser.TenantId.Value;
        var tenant = await _db.Tenants.FirstOrDefaultAsync(t => t.TenantId == tenantId && t.IsActive);
        if (tenant == null) return NotFound(ApiResponse<SubscriptionAccessDto>.Fail("Không tìm thấy quán đang hoạt động."));

        var targetCode = request.PlanCode?.Trim().ToLowerInvariant();
        var targetPlan = await _db.SubscriptionPlans.Include(p => p.Features)
            .FirstOrDefaultAsync(p => p.Code == targetCode && p.IsActive);
        if (targetPlan == null) return BadRequest(ApiResponse<SubscriptionAccessDto>.Fail("Gói nâng cấp không tồn tại hoặc đang tạm ngưng."));

        var subscription = await _db.TenantSubscriptions.Include(s => s.Plan)
            .Where(s => s.TenantId == tenantId && s.Status != "cancelled")
            .OrderByDescending(s => s.CreatedAt)
            .FirstOrDefaultAsync();
        if (subscription?.Plan == null)
            return BadRequest(ApiResponse<SubscriptionAccessDto>.Fail("Quán chưa có gói dịch vụ hiện tại hợp lệ."));

        if (string.Equals(subscription.Plan.Code, targetPlan.Code, StringComparison.OrdinalIgnoreCase))
        {
            var currentAccess = await _subscriptionService.GetAccessAsync(tenantId);
            return Ok(ApiResponse<SubscriptionAccessDto>.Ok(currentAccess, "Quán đang sử dụng gói này."));
        }

        var planRanks = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase)
        {
            ["basic"] = 1,
            ["premium"] = 2,
            ["pro"] = 3
        };
        if (!planRanks.TryGetValue(subscription.Plan.Code, out var currentRank) ||
            !planRanks.TryGetValue(targetPlan.Code, out var targetRank) || targetRank <= currentRank)
            return BadRequest(ApiResponse<SubscriptionAccessDto>.Fail("Chỉ có thể tự nâng cấp lên gói cao hơn. Gói hiện tại không bị thay đổi."));

        var previousPlan = subscription.Plan;
        var now = DateTime.UtcNow;
        await using var transaction = await _db.Database.BeginTransactionAsync();

        tenant.Plan = targetPlan.Code;
        tenant.MaxStores = targetPlan.MaxStores;
        subscription.PlanId = targetPlan.PlanId;
        if (subscription.Status == "suspended" || subscription.Status == "grace")
        {
            subscription.Status = "active";
            subscription.CurrentPeriodStart = now;
            subscription.CurrentPeriodEnd = null;
            subscription.GraceEndsAt = null;
        }

        _db.SystemNotifications.Add(new SystemNotification
        {
            Type = "tenant_plan_upgraded",
            Title = "Quán vừa tự nâng cấp gói",
            Message = $"{tenant.Name} đã nâng cấp từ {previousPlan.Name} lên {targetPlan.Name}. Giá niêm yết {targetPlan.MonthlyPrice:N0}đ/tháng. Chủ quán: {tenant.OwnerName} ({tenant.OwnerEmail}). Gói được áp dụng ngay; phí/ưu đãi trao đổi riêng.",
            TenantId = tenant.TenantId,
            TenantName = tenant.Name,
            OwnerEmail = tenant.OwnerEmail,
            PreviousPlanCode = previousPlan.Code,
            NewPlanCode = targetPlan.Code,
            StandardMonthlyPrice = targetPlan.MonthlyPrice,
            CreatedAt = now
        });

        await _db.SaveChangesAsync();
        await transaction.CommitAsync();

        var access = await _subscriptionService.GetAccessAsync(tenantId);
        return Ok(ApiResponse<SubscriptionAccessDto>.Ok(access, $"Đã chuyển quán sang gói {targetPlan.Name}. Bộ phận quản trị sẽ liên hệ riêng về phí và ưu đãi."));
    }
}

public sealed class UpgradeSubscriptionRequest
{
    public string PlanCode { get; set; } = string.Empty;
}

public sealed class MyStoreDto
{
    public int StoreId { get; set; }
    public string Name { get; set; } = string.Empty;
    public bool IsActive { get; set; }
}

public sealed class MySubscriptionDto
{
    public string Plan { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public DateTime? TrialEndsAt { get; set; }
    public int? DaysRemaining { get; set; }
}
