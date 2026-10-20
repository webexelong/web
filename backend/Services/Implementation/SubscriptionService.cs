using Microsoft.EntityFrameworkCore;
using WebCafe.Backend.Common.Exceptions;
using WebCafe.Backend.Infrastructure.Data;
using WebCafe.Backend.Services.Abstraction;

namespace WebCafe.Backend.Services.Implementation;

public sealed class SubscriptionService : ISubscriptionService
{
    private readonly WebCafeDbContext _db;
    public SubscriptionService(WebCafeDbContext db) => _db = db;

    public async Task RefreshLifecycleAsync(int tenantId)
    {
        var subscription = await _db.TenantSubscriptions.Include(s => s.Plan)
            .Where(s => s.TenantId == tenantId && s.Status != "cancelled" && s.Status != "suspended")
            .OrderByDescending(s => s.CreatedAt).FirstOrDefaultAsync();
        if (subscription == null) return;
        var now = DateTime.UtcNow;
        if (subscription.Status == "trialing" && subscription.TrialEndsAt.HasValue && subscription.TrialEndsAt <= now)
        {
            subscription.Status = "grace";
            subscription.GraceEndsAt = now.AddDays(7);
        }
        else if (subscription.Status == "active" && subscription.CurrentPeriodEnd.HasValue && subscription.CurrentPeriodEnd <= now)
        {
            subscription.Status = "grace";
            subscription.GraceEndsAt = now.AddDays(7);
        }
        else if (subscription.Status == "grace" && subscription.GraceEndsAt.HasValue && subscription.GraceEndsAt <= now)
        {
            subscription.Status = "suspended";
        }
        await _db.SaveChangesAsync();
    }

    public async Task EnsureCanCreateStoreAsync(int tenantId)
    {
        var plan = await GetPlanAsync(tenantId);
        var count = await _db.Stores.CountAsync(s => s.TenantId == tenantId && s.IsActive);
        EnsureActive(plan, count < plan.MaxStores, "Đã đạt giới hạn số cửa hàng của gói dịch vụ.");
    }

    public async Task EnsureCanCreateStaffAsync(int tenantId)
    {
        var plan = await GetPlanAsync(tenantId);
        var count = await _db.Staff.CountAsync(s => s.Store != null && s.Store.TenantId == tenantId && s.IsActive);
        EnsureActive(plan, count < plan.MaxStaff, "Đã đạt giới hạn số nhân viên của gói dịch vụ.");
    }

    public async Task EnsureCanCreateTableAsync(int tenantId, int storeId)
    {
        var plan = await GetPlanAsync(tenantId);
        var count = await _db.Tables.CountAsync(t => t.StoreId == storeId && t.IsActive);
        EnsureActive(plan, count < plan.MaxTablesPerStore, "Đã đạt giới hạn số bàn của gói dịch vụ.");
    }

    public async Task EnsureFeatureAccessAsync(int tenantId, string featureCode, string requiredPlan = "premium")
    {
        var access = await GetAccessAsync(tenantId);
        if (!string.Equals(access.Status, "active", StringComparison.OrdinalIgnoreCase) &&
            !string.Equals(access.Status, "trialing", StringComparison.OrdinalIgnoreCase) &&
            !string.Equals(access.Status, "grace", StringComparison.OrdinalIgnoreCase))
            throw new ForbiddenException("Gói dịch vụ đã hết hạn hoặc đang tạm ngưng. Vui lòng gia hạn để tiếp tục.");
        if (!access.Features.TryGetValue(featureCode, out var enabled) || !enabled)
            throw new ForbiddenException($"Tính năng này chưa có trong gói {access.Plan}. Vui lòng nâng cấp lên gói {requiredPlan} trở lên để sử dụng.");
    }

    public async Task<SubscriptionAccessDto> GetAccessAsync(int tenantId)
    {
        await RefreshLifecycleAsync(tenantId);
        var subscription = await _db.TenantSubscriptions.Include(s => s.Plan).ThenInclude(p => p!.Features)
            .Where(s => s.TenantId == tenantId)
            .OrderByDescending(s => s.CreatedAt).FirstOrDefaultAsync();
        if (subscription?.Plan == null) throw new ForbiddenException("Tenant chưa có gói dịch vụ hợp lệ.");
        var features = subscription.Plan.Features.ToDictionary(f => f.FeatureCode, f => f.IsEnabled, StringComparer.OrdinalIgnoreCase);
        var days = subscription.TrialEndsAt.HasValue ? Math.Max(0, (int)Math.Ceiling((subscription.TrialEndsAt.Value - DateTime.UtcNow).TotalDays)) : (int?)null;
        var storesUsed = await _db.Stores.CountAsync(s => s.TenantId == tenantId && s.IsActive);
        var staffUsed = await _db.Staff.CountAsync(s => s.Store != null && s.Store.TenantId == tenantId && s.IsActive);
        var tablesUsed = await _db.Tables.CountAsync(t => t.Store != null && t.Store.TenantId == tenantId && t.IsActive);
        return new SubscriptionAccessDto { Plan = subscription.Plan.Code, Status = subscription.Status, DaysRemaining = days, MaxStores = subscription.Plan.MaxStores, MaxStaff = subscription.Plan.MaxStaff, MaxTablesPerStore = subscription.Plan.MaxTablesPerStore, StoresUsed = storesUsed, StaffUsed = staffUsed, TablesUsed = tablesUsed, Features = features };
    }

    private async Task<Models.Entities.SubscriptionPlan> GetPlanAsync(int tenantId)
    {
        await RefreshLifecycleAsync(tenantId);
        var subscription = await _db.TenantSubscriptions.Include(s => s.Plan)
            .Where(s => s.TenantId == tenantId && (s.Status == "active" || s.Status == "trialing" || s.Status == "grace"))
            .OrderByDescending(s => s.CreatedAt).FirstOrDefaultAsync();
        if (subscription?.Plan == null) throw new ForbiddenException("Tenant chưa có gói dịch vụ hợp lệ.");
        return subscription.Plan;
    }

    private static void EnsureActive(Models.Entities.SubscriptionPlan plan, bool withinLimit, string message)
    {
        if (!plan.IsActive || !withinLimit) throw new ForbiddenException(message);
    }
}
