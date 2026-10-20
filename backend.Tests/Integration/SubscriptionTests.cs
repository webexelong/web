using System.Net;
using System.Net.Http.Json;
using Microsoft.Extensions.DependencyInjection;
using WebCafe.Backend.Infrastructure.Data;
using WebCafe.Backend.Models.Entities;
using WebCafe.Backend.Tests.Fixtures;

namespace WebCafe.Backend.Tests.Integration;

public sealed class SubscriptionTests : IClassFixture<CustomWebApplicationFactory>
{
    private readonly CustomWebApplicationFactory _factory;
    public SubscriptionTests(CustomWebApplicationFactory factory) => _factory = factory;

    [Fact]
    public async Task TenantWithinTableLimit_CanCreateTable()
    {
        int tenantId;
        int storeId;
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<WebCafeDbContext>();
            var data = await TestDataSeeder.SeedTenantsAsync(db);
            tenantId = data.TenantA.TenantId;
            storeId = data.StoreA.StoreId;
            var plan = new SubscriptionPlan { Code = $"test-{Guid.NewGuid():N}", Name = "Test Plan", MaxTablesPerStore = 2, MaxStores = 1, MaxStaff = 1 };
            db.SubscriptionPlans.Add(plan);
            await db.SaveChangesAsync();
            db.TenantSubscriptions.Add(new TenantSubscription { TenantId = tenantId, PlanId = plan.PlanId, Status = "active", CurrentPeriodEnd = DateTime.UtcNow.AddDays(30) });
            await db.SaveChangesAsync();
        }

        using var client = CreateOwnerClient(tenantId, storeId);
        var response = await client.PostAsJsonAsync("/api/tables", new { storeId, tableNumber = $"T-{Guid.NewGuid():N}"[..8], capacity = 4 });
        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task TenantAtTableLimit_CannotCreateAnotherTable()
    {
        int tenantId;
        int storeId;
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<WebCafeDbContext>();
            var data = await TestDataSeeder.SeedTenantsAsync(db);
            tenantId = data.TenantA.TenantId;
            storeId = data.StoreA.StoreId;
            var plan = new SubscriptionPlan { Code = $"test-{Guid.NewGuid():N}", Name = "Limited Plan", MaxTablesPerStore = 1, MaxStores = 1, MaxStaff = 1 };
            db.SubscriptionPlans.Add(plan);
            await db.SaveChangesAsync();
            db.TenantSubscriptions.Add(new TenantSubscription { TenantId = tenantId, PlanId = plan.PlanId, Status = "active", CurrentPeriodEnd = DateTime.UtcNow.AddDays(30) });
            db.Tables.Add(new Table { StoreId = storeId, TableNumber = "LIMIT-1", Capacity = 2 });
            await db.SaveChangesAsync();
        }

        using var client = CreateOwnerClient(tenantId, storeId);
        var response = await client.PostAsJsonAsync("/api/tables", new { storeId, tableNumber = "LIMIT-2", capacity = 4 });
        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    private HttpClient CreateOwnerClient(int tenantId, int storeId)
    {
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Add("X-Test-TenantId", tenantId.ToString());
        client.DefaultRequestHeaders.Add("X-Test-StoreId", storeId.ToString());
        client.DefaultRequestHeaders.Add("X-Test-Role", "Owner");
        return client;
    }
}
