using Microsoft.Extensions.DependencyInjection;
using System.Net.Http.Json;
using WebCafe.Backend.Infrastructure.Data;
using WebCafe.Backend.Models.Entities;
using WebCafe.Backend.Tests.Fixtures;

namespace WebCafe.Backend.Tests.Integration;

public sealed class QrResolutionTests : IClassFixture<CustomWebApplicationFactory>
{
    private readonly CustomWebApplicationFactory _factory;
    public QrResolutionTests(CustomWebApplicationFactory factory) => _factory = factory;

    [Fact]
    public async Task ValidQrToken_ResolvesCorrectStoreAndTable()
    {
        string token;
        int storeId;
        int tableId;
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<WebCafeDbContext>();
            var data = await TestDataSeeder.SeedTenantsAsync(db);
            var table = new Table { StoreId = data.StoreA.StoreId, TableNumber = "A01", Capacity = 4, QrToken = Guid.NewGuid().ToString("N") };
            db.Tables.Add(table);
            await db.SaveChangesAsync();
            token = table.QrToken;
            storeId = table.StoreId;
            tableId = table.TableId;
        }

        using var client = _factory.CreateClient();
        var response = await client.GetFromJsonAsync<ApiResponse<TableQrResolution>>($"/api/tables/qr/{token}");

        response.Should().NotBeNull();
        response!.Success.Should().BeTrue();
        response.Data!.StoreId.Should().Be(storeId);
        response.Data.TableId.Should().Be(tableId);
        response.Data.TableNumber.Should().Be("A01");
    }

    [Fact]
    public async Task InactiveTableQr_ReturnsNotFound()
    {
        string token;
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<WebCafeDbContext>();
            var data = await TestDataSeeder.SeedTenantsAsync(db);
            var table = new Table { StoreId = data.StoreA.StoreId, TableNumber = "A02", IsActive = false, QrToken = Guid.NewGuid().ToString("N") };
            db.Tables.Add(table);
            await db.SaveChangesAsync();
            token = table.QrToken;
        }

        using var client = _factory.CreateClient();
        var response = await client.GetAsync($"/api/tables/qr/{token}");
        response.StatusCode.Should().Be(System.Net.HttpStatusCode.NotFound);
    }

    private sealed class ApiResponse<T>
    {
        public bool Success { get; set; }
        public T? Data { get; set; }
    }

    private sealed class TableQrResolution
    {
        public int StoreId { get; set; }
        public int TableId { get; set; }
        public string TableNumber { get; set; } = string.Empty;
    }
}
