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
    public async Task<ActionResult<ApiResponse<object>>> UpgradeSubscription([FromBody] UpgradeSubscriptionRequest request)
    {
        if (!_currentUser.TenantId.HasValue) return Forbid();
        var tenantId = _currentUser.TenantId.Value;
        var tenant = await _db.Tenants.FirstOrDefaultAsync(t => t.TenantId == tenantId && t.IsActive);
        if (tenant == null) return NotFound(ApiResponse<object>.Fail("Không tìm thấy quán đang hoạt động."));

        var targetCode = request.PlanCode?.Trim().ToLowerInvariant();
        var targetPlan = await _db.SubscriptionPlans.Include(p => p.Features)
            .FirstOrDefaultAsync(p => p.Code == targetCode && p.IsActive);
        if (targetPlan == null) return BadRequest(ApiResponse<object>.Fail("Gói dịch vụ không tồn tại hoặc đang tạm ngưng."));

        var subscription = await _db.TenantSubscriptions.Include(s => s.Plan)
            .Where(s => s.TenantId == tenantId && s.Status != "cancelled")
            .OrderByDescending(s => s.CreatedAt)
            .FirstOrDefaultAsync();
        if (subscription?.Plan == null)
            return BadRequest(ApiResponse<object>.Fail("Quán chưa có gói dịch vụ hiện tại hợp lệ."));

        if (string.Equals(subscription.Plan.Code, targetPlan.Code, StringComparison.OrdinalIgnoreCase))
        {
            return BadRequest(ApiResponse<object>.Fail("Quán đang sử dụng gói này rồi."));
        }

        var now = DateTime.UtcNow;
        var contactPhone = !string.IsNullOrWhiteSpace(request.Phone) ? request.Phone.Trim() : tenant.OwnerPhone;

        var existingRequest = await _db.SubscriptionUpgradeRequests
            .FirstOrDefaultAsync(r => r.TenantId == tenantId && r.Status == "pending");

        if (existingRequest != null)
        {
            existingRequest.RequestedPlanCode = targetPlan.Code;
            existingRequest.MonthlyPrice = targetPlan.MonthlyPrice;
            existingRequest.OwnerPhone = contactPhone;
            existingRequest.Note = request.Note;
            existingRequest.CreatedAt = now;
        }
        else
        {
            var newReq = new SubscriptionUpgradeRequest
            {
                TenantId = tenantId,
                TenantName = tenant.Name,
                OwnerName = tenant.OwnerName,
                OwnerPhone = contactPhone,
                OwnerEmail = tenant.OwnerEmail,
                CurrentPlanCode = subscription.Plan.Code,
                RequestedPlanCode = targetPlan.Code,
                MonthlyPrice = targetPlan.MonthlyPrice,
                Status = "pending",
                Note = request.Note,
                CreatedAt = now
            };
            _db.SubscriptionUpgradeRequests.Add(newReq);
        }

        _db.SystemNotifications.Add(new SystemNotification
        {
            Type = "tenant_plan_upgrade_request",
            Title = "Yêu cầu đổi gói dịch vụ",
            Message = $"{tenant.Name} vừa gửi yêu cầu chuyển sang gói {targetPlan.Name} ({targetPlan.MonthlyPrice:N0}đ/tháng). SĐT/Zalo: {contactPhone}. Gói hiện tại: {subscription.Plan.Name}.",
            TenantId = tenant.TenantId,
            TenantName = tenant.Name,
            OwnerEmail = tenant.OwnerEmail,
            PreviousPlanCode = subscription.Plan.Code,
            NewPlanCode = targetPlan.Code,
            StandardMonthlyPrice = targetPlan.MonthlyPrice,
            CreatedAt = now
        });

        await _db.SaveChangesAsync();

        return Ok(ApiResponse<object>.Ok(new 
        { 
            requestedPlan = targetPlan.Code, 
            status = "pending" 
        }, $"Yêu cầu chuyển sang gói {targetPlan.Name} đã được gửi thành công. Quản trị viên sẽ liên hệ với bạn qua Zalo/SĐT để xác nhận và kích hoạt gói."));
    }

    [HttpGet("subscription/my-request")]
    [Authorize(Policy = AppPolicies.TenantAdminAccess)]
    public async Task<ActionResult<ApiResponse<object?>>> GetMyPendingRequest()
    {
        if (!_currentUser.TenantId.HasValue) return Forbid();
        var tenantId = _currentUser.TenantId.Value;
        var req = await _db.SubscriptionUpgradeRequests
            .Where(r => r.TenantId == tenantId && r.Status == "pending")
            .OrderByDescending(r => r.CreatedAt)
            .FirstOrDefaultAsync();
        if (req == null) return Ok(ApiResponse<object?>.Ok(null));
        return Ok(ApiResponse<object?>.Ok(new
        {
            req.RequestId,
            req.RequestedPlanCode,
            req.MonthlyPrice,
            req.Status,
            req.Note,
            req.OwnerPhone,
            req.CreatedAt
        }));
    }

    [HttpDelete("subscription/my-request")]
    [Authorize(Policy = AppPolicies.TenantAdminAccess)]
    public async Task<ActionResult<ApiResponse<object>>> CancelMyPendingRequest()
    {
        if (!_currentUser.TenantId.HasValue) return Forbid();
        var tenantId = _currentUser.TenantId.Value;
        var req = await _db.SubscriptionUpgradeRequests
            .Where(r => r.TenantId == tenantId && r.Status == "pending")
            .OrderByDescending(r => r.CreatedAt)
            .FirstOrDefaultAsync();
        if (req != null)
        {
            req.Status = "cancelled";
            await _db.SaveChangesAsync();
        }
        return Ok(ApiResponse<object>.Ok(new { }, "Đã hủy yêu cầu chuyển gói."));
    }
}

public sealed class UpgradeSubscriptionRequest
{
    public string PlanCode { get; set; } = string.Empty;
    public string? Phone { get; set; }
    public string? Note { get; set; }
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
