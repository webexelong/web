namespace WebCafe.Backend.Services.Abstraction
{
    public interface ICurrentUserService
    {
        bool IsAuthenticated { get; }
        int? UserId { get; }
        int? TenantId { get; }
        int? StoreId { get; }
        int? CustomerId { get; }
        string? Role { get; }
        bool IsSystemAdmin { get; }
    }
}
