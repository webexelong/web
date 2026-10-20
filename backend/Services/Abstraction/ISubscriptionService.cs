namespace WebCafe.Backend.Services.Abstraction;

public interface ISubscriptionService
{
    Task EnsureCanCreateStoreAsync(int tenantId);
    Task EnsureCanCreateStaffAsync(int tenantId);
    Task EnsureCanCreateTableAsync(int tenantId, int storeId);
    Task EnsureFeatureAccessAsync(int tenantId, string featureCode, string requiredPlan = "premium");
    Task<SubscriptionAccessDto> GetAccessAsync(int tenantId);
    Task RefreshLifecycleAsync(int tenantId);
}

public sealed class SubscriptionAccessDto
{
    public string Plan { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public int? DaysRemaining { get; set; }
    public int MaxStores { get; set; }
    public int MaxStaff { get; set; }
    public int MaxTablesPerStore { get; set; }
    public int StoresUsed { get; set; }
    public int StaffUsed { get; set; }
    public int TablesUsed { get; set; }
    public Dictionary<string, bool> Features { get; set; } = new(StringComparer.OrdinalIgnoreCase);
}
