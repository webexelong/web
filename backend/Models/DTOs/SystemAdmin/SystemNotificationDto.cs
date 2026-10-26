namespace WebCafe.Backend.Models.DTOs.SystemAdmin;

public sealed class SystemNotificationDto
{
    public int NotificationId { get; set; }
    public string Type { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public int TenantId { get; set; }
    public string TenantName { get; set; } = string.Empty;
    public string OwnerEmail { get; set; } = string.Empty;
    public string PreviousPlanCode { get; set; } = string.Empty;
    public string NewPlanCode { get; set; } = string.Empty;
    public decimal StandardMonthlyPrice { get; set; }
    public DateTime CreatedAt { get; set; }
    public bool IsRead { get; set; }
}
