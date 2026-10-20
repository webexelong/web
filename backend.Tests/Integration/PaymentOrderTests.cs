using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using WebCafe.Backend.Tests.Fixtures;
using Microsoft.Extensions.DependencyInjection;
using WebCafe.Backend.Infrastructure.Data;
using WebCafe.Backend.Models.Entities;

namespace WebCafe.Backend.Tests.Integration;

public sealed class PaymentOrderTests : IClassFixture<CustomWebApplicationFactory>
{
    private readonly CustomWebApplicationFactory _factory;
    public PaymentOrderTests(CustomWebApplicationFactory factory) => _factory = factory;

    private static object ValidWebhook() => new
    {
        transactionId = "TEST-TX-001",
        amount = 100000,
        description = "OD-260913-1234",
        transactionTime = DateTime.UtcNow,
        bankAccount = "0123456789",
        referenceNumber = "REF-001"
    };

    [Fact]
    public async Task VietQrWebhook_WithoutSignature_ReturnsUnauthorized()
    {
        using var client = _factory.CreateClient();
        var response = await client.PostAsJsonAsync("/api/payments/vietqr/webhook", ValidWebhook());
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task VietQrWebhook_WithInvalidSignature_ReturnsUnauthorized()
    {
        using var client = _factory.CreateClient();
        using var request = new HttpRequestMessage(HttpMethod.Post, "/api/payments/vietqr/webhook")
        {
            Content = JsonContent.Create(ValidWebhook())
        };
        request.Headers.Add("X-Signature", "invalid-signature");

        var response = await client.SendAsync(request);
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task VietQrWebhook_WithEmptyPayload_ReturnsUnauthorizedOrBadRequest()
    {
        using var client = _factory.CreateClient();
        using var request = new HttpRequestMessage(HttpMethod.Post, "/api/payments/vietqr/webhook")
        {
            Content = new StringContent("{}", System.Text.Encoding.UTF8, "application/json")
        };
        request.Headers.Add("X-Signature", "invalid-signature");

        var response = await client.SendAsync(request);
        ((int)response.StatusCode).Should().BeOneOf((int)HttpStatusCode.Unauthorized, (int)HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Anonymous_CannotProcessStaffPayment()
    {
        using var client = _factory.CreateClient();
        var response = await client.PostAsJsonAsync("/api/payments", new { orderId = 999999, amount = 100000, method = "cash" });
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task StaffFromTenantA_CannotUpdateTenantBOrder()
    {
        int tenantAId;
        int storeBId;
        int orderBId;
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<WebCafeDbContext>();
            var data = await TestDataSeeder.SeedTenantsAsync(db);
            tenantAId = data.TenantA.TenantId;
            storeBId = data.StoreB.StoreId;
            var order = new Order
            {
                TenantId = data.TenantB.TenantId,
                StoreId = storeBId,
                OrderCode = $"TEST-{Guid.NewGuid():N}"[..18],
                Status = "awaiting_payment",
                TotalAmount = 100000
            };
            db.Orders.Add(order);
            await db.SaveChangesAsync();
            orderBId = order.OrderId;
        }

        using var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Add("X-Test-TenantId", tenantAId.ToString());
        client.DefaultRequestHeaders.Add("X-Test-StoreId", "1");
        client.DefaultRequestHeaders.Add("X-Test-Role", "Staff");
        var response = await client.PutAsJsonAsync($"/api/orders/{orderBId}/status", new { status = "confirmed" });
        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }
}
