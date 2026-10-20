using WebCafe.Backend.Infrastructure.Data;
using WebCafe.Backend.Models.Entities;

namespace WebCafe.Backend.Tests.Fixtures;

public static class TestDataSeeder
{
    public static async Task<(Tenant TenantA, Tenant TenantB, Store StoreA, Store StoreB)> SeedTenantsAsync(WebCafeDbContext db)
    {
        var tenantA = new Tenant { Name = "Test Tenant A", Slug = $"test-a-{Guid.NewGuid():N}", OwnerName = "Owner A", OwnerEmail = $"a-{Guid.NewGuid():N}@test.local", OwnerPhone = "0900000001", OwnerPasswordHash = "test" };
        var tenantB = new Tenant { Name = "Test Tenant B", Slug = $"test-b-{Guid.NewGuid():N}", OwnerName = "Owner B", OwnerEmail = $"b-{Guid.NewGuid():N}@test.local", OwnerPhone = "0900000002", OwnerPasswordHash = "test" };
        db.Tenants.AddRange(tenantA, tenantB);
        await db.SaveChangesAsync();
        var storeA = new Store { TenantId = tenantA.TenantId, Name = "Test Store A" };
        var storeB = new Store { TenantId = tenantB.TenantId, Name = "Test Store B" };
        db.Stores.AddRange(storeA, storeB);
        await db.SaveChangesAsync();
        return (tenantA, tenantB, storeA, storeB);
    }
}
