using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WebCafe.Backend.Common.Constants;
using WebCafe.Backend.Common.Models;
using WebCafe.Backend.Infrastructure.Data;
using WebCafe.Backend.Services.Abstraction;
using WebCafe.Backend.Models.DTOs.SystemAdmin;

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
