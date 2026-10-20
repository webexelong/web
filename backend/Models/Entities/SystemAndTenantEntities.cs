using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using WebCafe.Backend.Models.Common;

namespace WebCafe.Backend.Models.Entities
{
    public class SystemAdmin
    {
        [Key]
        public int AdminId { get; set; }

        [Required, MaxLength(50)]
        public string Username { get; set; } = string.Empty;

        [Required, MaxLength(150), EmailAddress]
        public string Email { get; set; } = string.Empty;

        [Required, MaxLength(256)]
        public string PasswordHash { get; set; } = string.Empty;

        [Required, MaxLength(100)]
        public string FullName { get; set; } = string.Empty;

        public bool IsActive { get; set; } = true;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }

    public class Tenant
    {
        [Key]
        public int TenantId { get; set; }

        [Required, MaxLength(150)]
        public string Name { get; set; } = string.Empty;

        [Required, MaxLength(50)]
        public string Slug { get; set; } = string.Empty;

        [Required, MaxLength(100)]
        public string OwnerName { get; set; } = string.Empty;

        [Required, MaxLength(15)]
        public string OwnerPhone { get; set; } = string.Empty;

        [Required, MaxLength(150), EmailAddress]
        public string OwnerEmail { get; set; } = string.Empty;

        [Required, MaxLength(256)]
        public string OwnerPasswordHash { get; set; } = string.Empty;

        public bool OwnerEmailVerified { get; set; } = true;

        [MaxLength(128)]
        public string? EmailVerificationTokenHash { get; set; }

        public DateTime? EmailVerificationExpiresAt { get; set; }

        [MaxLength(500)]
        public string? LogoUrl { get; set; }

        [MaxLength(20)]
        public string Plan { get; set; } = "free";

        public int MaxStores { get; set; } = 1;
        public int PointsPerAmount { get; set; } = 10000;

        [Column(TypeName = "decimal(12,0)")]
        public decimal PointsToMoney { get; set; } = 200;

        public bool IsActive { get; set; } = true;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        // Navigation
        public ICollection<Store> Stores { get; set; } = new List<Store>();
        public ICollection<Category> Categories { get; set; } = new List<Category>();
        public ICollection<MenuItem> MenuItems { get; set; } = new List<MenuItem>();
        public ICollection<Size> Sizes { get; set; } = new List<Size>();
        public ICollection<Topping> Toppings { get; set; } = new List<Topping>();
        public ICollection<Role> Roles { get; set; } = new List<Role>();
        public ICollection<Customer> Customers { get; set; } = new List<Customer>();
        public ICollection<Voucher> Vouchers { get; set; } = new List<Voucher>();
    }

    public class SubscriptionPlan
    {
        [Key] public int PlanId { get; set; }
        [Required, MaxLength(50)] public string Code { get; set; } = string.Empty;
        [Required, MaxLength(100)] public string Name { get; set; } = string.Empty;
        [Column(TypeName = "decimal(12,0)")] public decimal MonthlyPrice { get; set; }
        public int MaxStores { get; set; } = 1;
        public int MaxStaff { get; set; } = 5;
        public int MaxTablesPerStore { get; set; } = 20;
        public bool IsActive { get; set; } = true;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public ICollection<SubscriptionPlanFeature> Features { get; set; } = new List<SubscriptionPlanFeature>();
    }

    public class SubscriptionPlanFeature
    {
        [Key] public int PlanFeatureId { get; set; }
        public int PlanId { get; set; }
        [Required, MaxLength(80)] public string FeatureCode { get; set; } = string.Empty;
        public bool IsEnabled { get; set; } = true;
        public SubscriptionPlan? Plan { get; set; }
    }

    public class TenantSubscription
    {
        [Key] public int SubscriptionId { get; set; }
        public int TenantId { get; set; }
        public int PlanId { get; set; }
        [Required, MaxLength(30)] public string Status { get; set; } = "trialing";
        public DateTime StartsAt { get; set; } = DateTime.UtcNow;
        public DateTime? TrialEndsAt { get; set; }
        public DateTime? CurrentPeriodStart { get; set; }
        public DateTime? CurrentPeriodEnd { get; set; }
        public DateTime? GraceEndsAt { get; set; }
        public DateTime? CancelledAt { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public Tenant? Tenant { get; set; }
        public SubscriptionPlan? Plan { get; set; }
    }

    public class SubscriptionBillingRecord
    {
        [Key] public int BillingRecordId { get; set; }
        public int TenantId { get; set; }
        public int SubscriptionId { get; set; }
        [Required, MaxLength(30)] public string Status { get; set; } = "pending";
        [Column(TypeName = "decimal(12,0)")] public decimal Amount { get; set; }
        [MaxLength(50)] public string? ExternalReference { get; set; }
        public DateTime BillingPeriodStart { get; set; }
        public DateTime BillingPeriodEnd { get; set; }
        public DateTime? PaidAt { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public Tenant? Tenant { get; set; }
        public TenantSubscription? Subscription { get; set; }
    }

    public class Store
    {
        [Key]
        public int StoreId { get; set; }

        public int TenantId { get; set; }

        [Required, MaxLength(150)]
        public string Name { get; set; } = string.Empty;

        [MaxLength(300)]
        public string? Address { get; set; }

        [MaxLength(15)]
        public string? Phone { get; set; }

        [MaxLength(30)]
        public string? BankAccount { get; set; }

        [MaxLength(50)]
        public string? BankName { get; set; }

        [MaxLength(100)]
        public string? BankAccountName { get; set; }

        [MaxLength(100)]
        public string? PayOSClientId { get; set; }

        [MaxLength(100)]
        public string? PayOSApiKey { get; set; }

        [MaxLength(100)]
        public string? PayOSChecksumKey { get; set; }

        public bool IsActive { get; set; } = true;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        // Navigation
        [ForeignKey(nameof(TenantId))]
        public Tenant? Tenant { get; set; }

        public ICollection<Table> Tables { get; set; } = new List<Table>();
        public ICollection<Staff> StaffList { get; set; } = new List<Staff>();
        public ICollection<Order> Orders { get; set; } = new List<Order>();
    }

    public class Permission
    {
        [Key]
        public int PermissionId { get; set; }

        [Required, MaxLength(50)]
        public string Code { get; set; } = string.Empty;

        [Required, MaxLength(100)]
        public string Name { get; set; } = string.Empty;

        [Required, MaxLength(30)]
        public string Module { get; set; } = string.Empty;

        public ICollection<RolePermission> RolePermissions { get; set; } = new List<RolePermission>();
    }

    public class Role
    {
        [Key]
        public int RoleId { get; set; }

        public int TenantId { get; set; }

        [Required, MaxLength(50)]
        public string Name { get; set; } = string.Empty;

        [MaxLength(200)]
        public string? Description { get; set; }

        [ForeignKey(nameof(TenantId))]
        public Tenant? Tenant { get; set; }

        public ICollection<RolePermission> RolePermissions { get; set; } = new List<RolePermission>();
        public ICollection<Staff> StaffList { get; set; } = new List<Staff>();
    }

    public class RolePermission
    {
        [Key]
        public int RolePermissionId { get; set; }

        public int RoleId { get; set; }
        public int PermissionId { get; set; }

        [ForeignKey(nameof(RoleId))]
        public Role? Role { get; set; }

        [ForeignKey(nameof(PermissionId))]
        public Permission? Permission { get; set; }
    }
}
