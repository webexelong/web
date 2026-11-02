using System.ComponentModel.DataAnnotations;

namespace WebCafe.Backend.Models.DTOs.SystemAdmin
{
    public class SubscriptionReportDto
    {
        public int ActiveSubscriptions { get; set; }
        public int TrialingSubscriptions { get; set; }
        public int GracePeriodSubscriptions { get; set; }
        public int SuspendedSubscriptions { get; set; }
        public decimal MonthlyRecurringRevenue { get; set; }
        public decimal PaidRevenue { get; set; }
        public List<SubscriptionPlanReportDto> Plans { get; set; } = new();
    }

    public class SubscriptionPlanReportDto
    {
        public string Code { get; set; } = string.Empty;
        public string PlanCode { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public decimal MonthlyPrice { get; set; }
        public int TenantCount { get; set; }
        public decimal MonthlyRevenue { get; set; }
    }

    /// <summary>
    /// Doanh thu theo tá»«ng ngÃ y trong tuáº§n gáº§n nháº¥t
    /// </summary>
    public class DailyRevenueDto
    {
        public string Date { get; set; } = string.Empty; // yyyy-MM-dd
        public string DayLabel { get; set; } = string.Empty; // T2, T3... HÃ´m nay
        public decimal Revenue { get; set; }
        public int OrderCount { get; set; }
    }

    /// <summary>
    /// Thá»‘ng kÃª tá»•ng quan toÃ n sÃ n SaaS dÃ nh cho Super Admin
    /// </summary>
    public class PlatformStatsDto
    {
        public int TotalTenants { get; set; }
        public int ActiveTenants { get; set; }
        public int TotalStores { get; set; }
        public int TotalTables { get; set; }
        public int TotalOrders { get; set; }
        public decimal TotalGmv { get; set; }
        public decimal MonthlySubscriptionRevenue { get; set; }
        public List<DailyRevenueDto> DailyRevenue { get; set; } = new();
    }

    /// <summary>
    /// ThÃ´ng tin chi tiáº¿t cá»§a má»™t quÃ¡n cafe Ä‘á»‘i tÃ¡c
    /// </summary>
    public class TenantDetailDto
    {
        public int TenantId { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Slug { get; set; } = string.Empty;
        public string OwnerName { get; set; } = string.Empty;
        public string OwnerEmail { get; set; } = string.Empty;
        public string OwnerPhone { get; set; } = string.Empty;
        public string? LogoUrl { get; set; }
        public string Plan { get; set; } = "basic";
        public int MaxStores { get; set; }
        public bool IsActive { get; set; }
        public DateTime CreatedAt { get; set; }
        public int StoreCount { get; set; }
        public int TableCount { get; set; }
        public int OrderCount { get; set; }
        public decimal TotalGmv { get; set; }
        public int CustomerCount { get; set; }
        public bool IsTrial { get; set; }
        public DateTime? TrialEndsAt { get; set; }
        public string? SubscriptionStatus { get; set; }
    }

    public class CustomerListItemDto
    {
        public int CustomerId { get; set; }
        public int TenantId { get; set; }
        public string TenantName { get; set; } = string.Empty;
        public string Phone { get; set; } = string.Empty;
        public string? Name { get; set; }
        public int TotalPoints { get; set; }
        public decimal TotalSpent { get; set; }
        public int VisitCount { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime? LastVisitAt { get; set; }
    }

    public class CustomerListResponseDto
    {
        public List<CustomerListItemDto> Items { get; set; } = new();
        public int TotalCount { get; set; }
        public int Page { get; set; }
        public int PageSize { get; set; }
        public int TotalPages => (int)Math.Ceiling((double)TotalCount / (PageSize > 0 ? PageSize : 10));
    }

    /// <summary>
    /// DTO táº¡o má»™t quÃ¡n cafe / Ä‘á»‘i tÃ¡c má»›i
    /// </summary>
    public class CreateTenantRequest
    {
        [Required(ErrorMessage = "TÃªn quÃ¡n / thÆ°Æ¡ng hiá»‡u lÃ  báº¯t buá»™c.")]
        public string Name { get; set; } = string.Empty;

        public string? Slug { get; set; }

        [Required(ErrorMessage = "Há» tÃªn chá»§ quÃ¡n lÃ  báº¯t buá»™c.")]
        public string OwnerName { get; set; } = string.Empty;

        [Required(ErrorMessage = "Email chá»§ quÃ¡n lÃ  báº¯t buá»™c.")]
        [EmailAddress(ErrorMessage = "Email khÃ´ng Ä‘Ãºng Ä‘á»‹nh dáº¡ng.")]
        public string OwnerEmail { get; set; } = string.Empty;

        [Required(ErrorMessage = "Sá»‘ Ä‘iá»‡n thoáº¡i chá»§ quÃ¡n lÃ  báº¯t buá»™c.")]
        public string OwnerPhone { get; set; } = string.Empty;

        [Required(ErrorMessage = "Máº­t kháº©u khá»Ÿi táº¡o lÃ  báº¯t buá»™c.")]
        [MinLength(6, ErrorMessage = "Máº­t kháº©u tá»‘i thiá»ƒu 6 kÃ½ tá»±.")]
        public string OwnerPassword { get; set; } = string.Empty;

        public string? LogoUrl { get; set; }
        public string Plan { get; set; } = "basic";
        public int MaxStores { get; set; } = 1;

        // ThÃ´ng tin chi nhÃ¡nh Ä‘áº§u tiÃªn
        public string? InitialStoreName { get; set; }
        public string? InitialStoreAddress { get; set; }
        public string? InitialStorePhone { get; set; }
    }

    /// <summary>
    /// DTO cáº­p nháº­t gÃ³i dá»‹ch vá»¥ cá»§a quÃ¡n
    /// </summary>
    public class UpdateTenantPlanRequest
    {
        [Required(ErrorMessage = "GÃ³i dá»‹ch vá»¥ lÃ  báº¯t buá»™c.")]
        public string Plan { get; set; } = "basic";

        [Range(1, 100, ErrorMessage = "Sá»‘ chi nhÃ¡nh tá»‘i Ä‘a pháº£i tá»« 1 Ä‘áº¿n 100.")]
        public int MaxStores { get; set; } = 1;
    }

    public class SubscriptionPlanConfigDto
    {
        public string Code { get; set; } = string.Empty;
        public string PlanCode { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public decimal MonthlyPrice { get; set; }
        public int MaxStores { get; set; }
        public int MaxStaff { get; set; }
        public int MaxTablesPerStore { get; set; }
        public bool IsActive { get; set; }
        public Dictionary<string, bool> Features { get; set; } = new(StringComparer.OrdinalIgnoreCase);
    }

    public class UpdateSubscriptionPlanRequest
    {
        [Range(0, 1000000000)] public decimal MonthlyPrice { get; set; }
        [Range(1, 1000)] public int MaxStores { get; set; }
        [Range(1, 10000)] public int MaxStaff { get; set; }
        [Range(1, 100000)] public int MaxTablesPerStore { get; set; }
        public bool IsActive { get; set; } = true;
        public Dictionary<string, bool>? Features { get; set; }
    }
}
