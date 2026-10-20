using System.Security.Claims;
using WebCafe.Backend.Common.Constants;
using WebCafe.Backend.Services.Abstraction;

namespace WebCafe.Backend.Services.Implementation
{
    public sealed class CurrentUserService : ICurrentUserService
    {
        private readonly IHttpContextAccessor _httpContextAccessor;

        public CurrentUserService(IHttpContextAccessor httpContextAccessor)
        {
            _httpContextAccessor = httpContextAccessor;
        }

        private ClaimsPrincipal? User => _httpContextAccessor.HttpContext?.User;

        public bool IsAuthenticated => User?.Identity?.IsAuthenticated == true;

        public int? UserId => ReadIntClaim(ClaimTypes.NameIdentifier);

        public int? TenantId => ReadIntClaim(AppClaimTypes.TenantId);

        public int? StoreId => ReadIntClaim(AppClaimTypes.StoreId);

        public int? CustomerId => ReadIntClaim(AppClaimTypes.CustomerId);

        public string? Role => User?.FindFirstValue(ClaimTypes.Role);

        public bool IsSystemAdmin => string.Equals(
            Role,
            AppRoles.SystemAdmin,
            StringComparison.OrdinalIgnoreCase);

        private int? ReadIntClaim(string claimType)
        {
            var value = User?.FindFirstValue(claimType);
            return int.TryParse(value, out var parsed) ? parsed : null;
        }
    }
}
