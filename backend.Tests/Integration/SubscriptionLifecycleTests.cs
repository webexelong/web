using Microsoft.Extensions.DependencyInjection;
using WebCafe.Backend.Infrastructure.Data;
using WebCafe.Backend.Models.Entities;
using WebCafe.Backend.Services.Abstraction;
using WebCafe.Backend.Tests.Fixtures;

namespace WebCafe.Backend.Tests.Integration;

public sealed class SubscriptionLifecycleTests : IClassFixture<CustomWebApplicationFactory>
{
    private readonly CustomWebApplicationFactory _factory;
    public SubscriptionLifecycleTests(CustomWebApplicationFactory factory) => _factory = factory;

    [Fact]
    public async Task ExpiredTrial_MovesToGracePeriod()
    {
        int tenantId;
        int subscriptionId;
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<WebCafeDbContext>();
            var data = await TestDataSeeder.SeedTenantsAsync(db);
            tenantId = data.TenantA.TenantId;
            var plan = new SubscriptionPlan { Code = $"life-{Guid.NewGuid():N}", Name = "Lifecycle Plan", MaxTablesPerStore = 10 };
            db.SubscriptionPlans.Add(plan);
            await db.SaveChangesAsync();
            var subscription = new TenantSubscription { TenantId = tenantId, PlanId = plan.PlanId, Status = "trialing", TrialEndsAt = DateTime.UtcNow.AddMinutes(-1) };
            db.TenantSubscriptions.Add(subscription);
            await db.SaveChangesAsync();
            subscriptionId = subscription.SubscriptionId;
        }

        using (var scope = _factory.Services.CreateScope())
        {
            var service = scope.ServiceProvider.GetRequiredService<ISubscriptionService>();
            await service.RefreshLifecycleAsync(tenantId);
        }

        using var verifyScope = _factory.Services.CreateScope();
        var verifyDb = verifyScope.ServiceProvider.GetRequiredService<WebCafeDbContext>();
        var result = await verifyDb.TenantSubscriptions.FindAsync(subscriptionId);
        result!.Status.Should().Be("grace");
        result.GraceEndsAt.Should().NotBeNull();
    }

    [Fact]
    public async Task ExpiredGracePeriod_MovesToSuspended()
    {
        int tenantId;
        int subscriptionId;
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<WebCafeDbContext>();
            var data = await TestDataSeeder.SeedTenantsAsync(db);
            tenantId = data.TenantA.TenantId;
            var plan = new SubscriptionPlan { Code = $"life-{Guid.NewGuid():N}", Name = "Grace Plan", MaxTablesPerStore = 10 };
            db.SubscriptionPlans.Add(plan);
            await db.SaveChangesAsync();
            var subscription = new TenantSubscription { TenantId = tenantId, PlanId = plan.PlanId, Status = "grace", GraceEndsAt = DateTime.UtcNow.AddMinutes(-1) };
            db.TenantSubscriptions.Add(subscription);
            await db.SaveChangesAsync();
            subscriptionId = subscription.SubscriptionId;
        }

        using (var scope = _factory.Services.CreateScope())
        {
            var service = scope.ServiceProvider.GetRequiredService<ISubscriptionService>();
            await service.RefreshLifecycleAsync(tenantId);
        }

        using var verifyScope = _factory.Services.CreateScope();
        var verifyDb = verifyScope.ServiceProvider.GetRequiredService<WebCafeDbContext>();
        var result = await verifyDb.TenantSubscriptions.FindAsync(subscriptionId);
        result!.Status.Should().Be("suspended");
    }
}
