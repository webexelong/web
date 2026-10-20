using Microsoft.EntityFrameworkCore;
using WebCafe.Backend.Infrastructure.Data;

namespace WebCafe.Backend.Services.Implementation;

/// <summary>
/// Keeps the public demo isolated and tidy. Only records belonging to the
/// dedicated demo tenant are removed, and only after they are older than the
/// current UTC day.
/// </summary>
public sealed class DemoMaintenanceService : BackgroundService
{
    private const string DemoSlug = "aismartserve-demo";
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<DemoMaintenanceService> _logger;

    public DemoMaintenanceService(IServiceScopeFactory scopeFactory, ILogger<DemoMaintenanceService> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await ResetPreviousDaysAsync(stoppingToken);

        while (!stoppingToken.IsCancellationRequested)
        {
            var now = DateTime.UtcNow;
            var nextUtcDay = now.Date.AddDays(1).AddMinutes(1);
            var delay = nextUtcDay - now;
            if (delay < TimeSpan.FromMinutes(1)) delay = TimeSpan.FromMinutes(1);

            await Task.Delay(delay, stoppingToken);
            await ResetPreviousDaysAsync(stoppingToken);
        }
    }

    private async Task ResetPreviousDaysAsync(CancellationToken cancellationToken)
    {
        try
        {
            using var scope = _scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<WebCafeDbContext>();
            var demoTenantId = await db.Tenants
                .Where(t => t.Slug == DemoSlug)
                .Select(t => (int?)t.TenantId)
                .FirstOrDefaultAsync(cancellationToken);

            if (!demoTenantId.HasValue) return;

            var cutoff = DateTime.UtcNow.Date;
            var oldOrders = await db.Orders
                .Where(o => o.TenantId == demoTenantId.Value && o.CreatedAt < cutoff)
                .Select(o => o.OrderId)
                .ToListAsync(cancellationToken);

            if (oldOrders.Count > 0)
            {
                var oldOrderItems = await db.OrderItems.Where(i => oldOrders.Contains(i.OrderId)).Select(i => i.OrderItemId).ToListAsync(cancellationToken);
                db.OrderItemToppings.RemoveRange(db.OrderItemToppings.Where(t => oldOrderItems.Contains(t.OrderItemId)));
                db.OrderItems.RemoveRange(db.OrderItems.Where(i => oldOrders.Contains(i.OrderId)));
                db.Payments.RemoveRange(db.Payments.Where(p => oldOrders.Contains(p.OrderId)));
                db.VoucherUsages.RemoveRange(db.VoucherUsages.Where(v => oldOrders.Contains(v.OrderId)));
                db.Orders.RemoveRange(db.Orders.Where(o => oldOrders.Contains(o.OrderId)));
            }

            var demoStoreIds = await db.Stores.Where(s => s.TenantId == demoTenantId.Value).Select(s => s.StoreId).ToListAsync(cancellationToken);
            if (demoStoreIds.Count > 0)
            {
                var tables = await db.Tables.Where(t => demoStoreIds.Contains(t.StoreId) && t.IsActive).ToListAsync(cancellationToken);
                foreach (var table in tables) table.Status = "Available";
            }

            if (oldOrders.Count > 0 || demoStoreIds.Count > 0)
                await db.SaveChangesAsync(cancellationToken);
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Không thể làm mới dữ liệu khu demo.");
        }
    }
}
