using System.Security.Claims;
using System.Text.Encodings.Web;
using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Options;
using Microsoft.Extensions.Logging;

namespace WebCafe.Backend.Tests.Fixtures;

public sealed class TestAuthHandler : AuthenticationHandler<AuthenticationSchemeOptions>
{
    public new const string Scheme = "TestScheme";

    public TestAuthHandler(IOptionsMonitor<AuthenticationSchemeOptions> options, ILoggerFactory logger, UrlEncoder encoder)
        : base(options, logger, encoder) { }

    protected override Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        var roleHeader = Request.Headers["X-Test-Role"].FirstOrDefault();
        var tenantHeader = Request.Headers["X-Test-TenantId"].FirstOrDefault();
        if (string.IsNullOrWhiteSpace(roleHeader) && string.IsNullOrWhiteSpace(tenantHeader))
            return Task.FromResult(AuthenticateResult.NoResult());

        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, "test-user"),
            new(ClaimTypes.Role, roleHeader ?? "Staff")
        };
        AddClaim(claims, "TenantId", "X-Test-TenantId");
        AddClaim(claims, "StoreId", "X-Test-StoreId");
        AddClaim(claims, "CustomerId", "X-Test-CustomerId");
        var identity = new ClaimsIdentity(claims, Scheme);
        return Task.FromResult(AuthenticateResult.Success(new AuthenticationTicket(new ClaimsPrincipal(identity), Scheme)));
    }

    private void AddClaim(List<Claim> claims, string claimType, string header)
    {
        var value = Request.Headers[header].FirstOrDefault();
        if (!string.IsNullOrWhiteSpace(value)) claims.Add(new Claim(claimType, value));
    }
}
