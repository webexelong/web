using Microsoft.Extensions.DependencyInjection;
using WebCafe.Backend.Infrastructure.Data;
using WebCafe.Backend.Tests.Fixtures;

namespace WebCafe.Backend.Tests.Integration;

public sealed class MigrationSmokeTests : IClassFixture<CustomWebApplicationFactory>
{
    private readonly CustomWebApplicationFactory _factory;

    public MigrationSmokeTests(CustomWebApplicationFactory factory) => _factory = factory;

    [Fact]
    public void Database_IsReachable_AfterMigrations()
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<WebCafeDbContext>();
        db.Database.CanConnect().Should().BeTrue();
        db.Tenants.Should().NotBeNull();
    }
}
