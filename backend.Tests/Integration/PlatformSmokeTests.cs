using System.Net;
using WebCafe.Backend.Tests.Fixtures;

namespace WebCafe.Backend.Tests.Integration;

public sealed class PlatformSmokeTests : IClassFixture<CustomWebApplicationFactory>
{
    private readonly CustomWebApplicationFactory _factory;

    public PlatformSmokeTests(CustomWebApplicationFactory factory) => _factory = factory;

    [Fact]
    public async Task HealthEndpoint_ReturnsHealthy()
    {
        using var client = _factory.CreateClient();

        var response = await client.GetAsync("/health");
        var body = await response.Content.ReadAsStringAsync();

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        body.Should().Contain("Healthy");
    }

    [Fact]
    public async Task ReadinessEndpoint_ReturnsReadyWhenDatabaseIsAvailable()
    {
        using var client = _factory.CreateClient();

        var response = await client.GetAsync("/health/ready");
        var body = await response.Content.ReadAsStringAsync();

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        body.Should().Contain("ready");
    }

    [Fact]
    public async Task AnonymousCannotReadOwnStoreList()
    {
        using var client = _factory.CreateClient();

        var response = await client.GetAsync("/api/me/stores");

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task AnonymousCannotReadSystemSubscriptionReport()
    {
        using var client = _factory.CreateClient();

        var response = await client.GetAsync("/api/system/subscriptions/report");

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }
}
