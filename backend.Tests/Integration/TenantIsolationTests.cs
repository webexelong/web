using Microsoft.Extensions.DependencyInjection;
using WebCafe.Backend.Infrastructure.Data;
using WebCafe.Backend.Models.Entities;
using WebCafe.Backend.Tests.Fixtures;

namespace WebCafe.Backend.Tests.Integration;

public sealed class TenantIsolationTests : IClassFixture<CustomWebApplicationFactory>
{
    private readonly CustomWebApplicationFactory _factory;

    public TenantIsolationTests(CustomWebApplicationFactory factory) => _factory = factory;

    [Fact]
    public async Task StaffFromTenantA_CannotReadStoreBTables()
    {
        int tenantAId;
        int storeBId;
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<WebCafeDbContext>();
            var data = await TestDataSeeder.SeedTenantsAsync(db);
            tenantAId = data.TenantA.TenantId;
            storeBId = data.StoreB.StoreId;
        }

        using var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Add("X-Test-TenantId", tenantAId.ToString());
        client.DefaultRequestHeaders.Add("X-Test-StoreId", "1");
        client.DefaultRequestHeaders.Add("X-Test-Role", "Staff");

        var response = await client.GetAsync($"/api/tables/store/{storeBId}");

        response.StatusCode.Should().Be(System.Net.HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task AnonymousCannotReadProtectedTableList()
    {
        using var client = _factory.CreateClient();
        var response = await client.GetAsync("/api/tables/store/1");
        response.StatusCode.Should().Be(System.Net.HttpStatusCode.Unauthorized);
    }
}
