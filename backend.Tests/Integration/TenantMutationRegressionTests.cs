using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using WebCafe.Backend.Infrastructure.Data;
using WebCafe.Backend.Models.Entities;
using WebCafe.Backend.Tests.Fixtures;

namespace WebCafe.Backend.Tests.Integration;

public sealed class TenantMutationRegressionTests : IClassFixture<CustomWebApplicationFactory>
{
    private readonly CustomWebApplicationFactory _factory;

    public TenantMutationRegressionTests(CustomWebApplicationFactory factory) => _factory = factory;

    [Fact]
    public async Task TenantA_CannotDeleteTenantBTable()
    {
        int tenantAId;
        int tableBId;
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<WebCafeDbContext>();
            var data = await TestDataSeeder.SeedTenantsAsync(db);
            tenantAId = data.TenantA.TenantId;
            var table = new Table
            {
                StoreId = data.StoreB.StoreId,
                TableNumber = $"B-{Guid.NewGuid():N}"[..8],
                Capacity = 4,
                QrToken = Guid.NewGuid().ToString("N")
            };
            db.Tables.Add(table);
            await db.SaveChangesAsync();
            tableBId = table.TableId;
        }

        using var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Add("X-Test-TenantId", tenantAId.ToString());
        client.DefaultRequestHeaders.Add("X-Test-Role", "Manager");

        var response = await client.DeleteAsync($"/api/tables/{tableBId}");

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task TenantA_CannotRegenerateTenantBQr()
    {
        int tenantAId;
        int tableBId;
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<WebCafeDbContext>();
            var data = await TestDataSeeder.SeedTenantsAsync(db);
            tenantAId = data.TenantA.TenantId;
            var table = new Table
            {
                StoreId = data.StoreB.StoreId,
                TableNumber = $"B-{Guid.NewGuid():N}"[..8],
                Capacity = 4,
                QrToken = Guid.NewGuid().ToString("N")
            };
            db.Tables.Add(table);
            await db.SaveChangesAsync();
            tableBId = table.TableId;
        }

        using var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Add("X-Test-TenantId", tenantAId.ToString());
        client.DefaultRequestHeaders.Add("X-Test-Role", "Manager");

        var response = await client.PostAsync($"/api/tables/{tableBId}/qr/regenerate", null);

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }
}
