namespace WebCafe.Backend.Services.Abstraction
{
    public interface ITenantAccessService
    {
        void EnsureTenantAccess(int tenantId);
        Task EnsureStoreAccessAsync(int storeId);
        Task EnsureTableAccessAsync(int tableId);
        Task EnsureOrderAccessAsync(int orderId);
    }
}
