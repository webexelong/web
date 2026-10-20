using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace WebCafe.Backend.Models.Entities
{
    public class Table
    {
        [Key]
        public int TableId { get; set; }

        public int StoreId { get; set; }

        [Required, MaxLength(10)]
        public string TableNumber { get; set; } = string.Empty;

        public int Capacity { get; set; } = 4;

        [MaxLength(50)]
        public string? Location { get; set; }

        [MaxLength(500)]
        public string? QRCodeUrl { get; set; }

        [Required, MaxLength(64)]
        public string QrToken { get; set; } = Guid.NewGuid().ToString("N");

        [Required, MaxLength(20)]
        public string Status { get; set; } = "Available"; // Available, Occupied, Reserved

        public bool IsActive { get; set; } = true;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [ForeignKey(nameof(StoreId))]
        public Store? Store { get; set; }

        public ICollection<Order> Orders { get; set; } = new List<Order>();
    }

    public class Staff
    {
        [Key]
        public int StaffId { get; set; }

        public int StoreId { get; set; }
        public int RoleId { get; set; }

        [Required, MaxLength(50)]
        public string Username { get; set; } = string.Empty;

        [Required, MaxLength(256)]
        public string PasswordHash { get; set; } = string.Empty;

        [Required, MaxLength(100)]
        public string FullName { get; set; } = string.Empty;

        [MaxLength(15)]
        public string? Phone { get; set; }

        [MaxLength(150), EmailAddress]
        public string? Email { get; set; }

        public bool IsActive { get; set; } = true;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [ForeignKey(nameof(StoreId))]
        public Store? Store { get; set; }

        [ForeignKey(nameof(RoleId))]
        public Role? Role { get; set; }

        public ICollection<StaffShift> StaffShifts { get; set; } = new List<StaffShift>();
        public ICollection<Order> HandledOrders { get; set; } = new List<Order>();
    }

    public class Shift
    {
        [Key]
        public int ShiftId { get; set; }

        public int StoreId { get; set; }

        [Required, MaxLength(50)]
        public string Name { get; set; } = string.Empty;

        public TimeSpan StartTime { get; set; }
        public TimeSpan EndTime { get; set; }

        [ForeignKey(nameof(StoreId))]
        public Store? Store { get; set; }

        public ICollection<StaffShift> StaffShifts { get; set; } = new List<StaffShift>();
    }

    public class StaffShift
    {
        [Key]
        public int StaffShiftId { get; set; }

        public int StaffId { get; set; }
        public int ShiftId { get; set; }
        public DateTime WorkDate { get; set; }

        [MaxLength(20)]
        public string Status { get; set; } = "scheduled"; // scheduled, checked_in, checked_out, absent

        public DateTime? CheckInTime { get; set; }
        public DateTime? CheckOutTime { get; set; }

        [ForeignKey(nameof(StaffId))]
        public Staff? Staff { get; set; }

        [ForeignKey(nameof(ShiftId))]
        public Shift? Shift { get; set; }
    }

    public class Customer
    {
        [Key]
        public int CustomerId { get; set; }

        public int TenantId { get; set; }

        [Required, MaxLength(15)]
        public string Phone { get; set; } = string.Empty;

        [MaxLength(256)]
        public string? PasswordHash { get; set; }

        [MaxLength(100)]
        public string? Name { get; set; }

        public int TotalPoints { get; set; } = 0;

        [Column(TypeName = "decimal(15,0)")]
        public decimal TotalSpent { get; set; } = 0;

        public int VisitCount { get; set; } = 0;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? LastVisitAt { get; set; }

        [ForeignKey(nameof(TenantId))]
        public Tenant? Tenant { get; set; }

        public ICollection<Order> Orders { get; set; } = new List<Order>();
        public ICollection<LoyaltyPoint> LoyaltyPoints { get; set; } = new List<LoyaltyPoint>();
        public ICollection<VoucherUsage> VoucherUsages { get; set; } = new List<VoucherUsage>();
    }

    public class Voucher
    {
        [Key]
        public int VoucherId { get; set; }

        public int TenantId { get; set; }
        public int? StoreId { get; set; }

        [Required, MaxLength(30)]
        public string Code { get; set; } = string.Empty;

        [Required, MaxLength(150)]
        public string Title { get; set; } = string.Empty;

        [MaxLength(300)]
        public string? Description { get; set; }

        [Required, MaxLength(10)]
        public string DiscountType { get; set; } = "percent"; // percent, fixed

        [Column(TypeName = "decimal(12,0)")]
        public decimal DiscountValue { get; set; }

        [Column(TypeName = "decimal(12,0)")]
        public decimal? MaxDiscount { get; set; }

        [Column(TypeName = "decimal(12,0)")]
        public decimal MinOrderAmount { get; set; } = 0;

        [Required, MaxLength(20)]
        public string Scope { get; set; } = "public"; // public, personal

        public int? AssignedCustomerId { get; set; }
        public int? MaxUsageTotal { get; set; }
        public int MaxUsagePerCustomer { get; set; } = 1;
        public int UsedCount { get; set; } = 0;
        public DateTime StartDate { get; set; }
        public DateTime EndDate { get; set; }
        public bool IsActive { get; set; } = true;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [ForeignKey(nameof(TenantId))]
        public Tenant? Tenant { get; set; }

        [ForeignKey(nameof(StoreId))]
        public Store? Store { get; set; }

        [ForeignKey(nameof(AssignedCustomerId))]
        public Customer? AssignedCustomer { get; set; }

        public ICollection<VoucherUsage> VoucherUsages { get; set; } = new List<VoucherUsage>();
    }

    public class Order
    {
        [Key]
        public int OrderId { get; set; }

        public int TenantId { get; set; }
        public int StoreId { get; set; }

        [Required, MaxLength(20)]
        public string OrderCode { get; set; } = string.Empty;

        public int? TableId { get; set; }
        public int? CustomerId { get; set; }
        public int? StaffId { get; set; }

        // Guest Order Fields (for customers without account)
        [MaxLength(100)]
        public string? GuestId { get; set; }

        // Opaque capability used by unauthenticated guests to pay their own order.
        [Required, MaxLength(64)]
        public string PaymentAccessToken { get; set; } = Guid.NewGuid().ToString("N");

        [MaxLength(100)]
        public string? GuestName { get; set; }

        [MaxLength(15)]
        public string? GuestPhone { get; set; }

        [Required, MaxLength(20)]
        public string Status { get; set; } = "pending"; // pending, confirmed, preparing, ready, served, paid, cancelled

        [Column(TypeName = "decimal(15,0)")]
        public decimal SubTotal { get; set; }

        [Column(TypeName = "decimal(15,0)")]
        public decimal DiscountAmount { get; set; } = 0;

        public int PointsUsed { get; set; } = 0;
        public int PointsEarned { get; set; } = 0;

        [Column(TypeName = "decimal(12,0)")]
        public decimal ServiceFee { get; set; } = 0;

        [Column(TypeName = "decimal(15,0)")]
        public decimal TotalAmount { get; set; }

        [MaxLength(500)]
        public string? Note { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? UpdatedAt { get; set; }

        // Set once when payment-side effects (loyalty, voucher, inventory) are finalized.
        public DateTime? PaymentActivatedAt { get; set; }
        public int? AppliedVoucherId { get; set; }

        [ForeignKey(nameof(TenantId))]
        public Tenant? Tenant { get; set; }

        [ForeignKey(nameof(StoreId))]
        public Store? Store { get; set; }

        [ForeignKey(nameof(TableId))]
        public Table? Table { get; set; }

        [ForeignKey(nameof(CustomerId))]
        public Customer? Customer { get; set; }

        [ForeignKey(nameof(StaffId))]
        public Staff? Staff { get; set; }

        public ICollection<OrderItem> OrderItems { get; set; } = new List<OrderItem>();
        public ICollection<Payment> Payments { get; set; } = new List<Payment>();
        public ICollection<VoucherUsage> VoucherUsages { get; set; } = new List<VoucherUsage>();
    }

    public class OrderItem
    {
        [Key]
        public int OrderItemId { get; set; }

        public int OrderId { get; set; }
        public int MenuItemId { get; set; }
        public int? SizeId { get; set; }

        public int Quantity { get; set; } = 1;

        [Column(TypeName = "decimal(12,0)")]
        public decimal UnitPrice { get; set; }

        [Column(TypeName = "decimal(12,0)")]
        public decimal ToppingTotal { get; set; } = 0;

        [Column(TypeName = "decimal(12,0)")]
        public decimal SubTotal { get; set; }

        [Required, MaxLength(10)]
        public string SugarLevel { get; set; } = "100%";

        [Required, MaxLength(10)]
        public string IceLevel { get; set; } = "100%";

        [MaxLength(200)]
        public string? Note { get; set; }

        [ForeignKey(nameof(OrderId))]
        public Order? Order { get; set; }

        [ForeignKey(nameof(MenuItemId))]
        public MenuItem? MenuItem { get; set; }

        [ForeignKey(nameof(SizeId))]
        public Size? Size { get; set; }

        public ICollection<OrderItemTopping> OrderItemToppings { get; set; } = new List<OrderItemTopping>();
    }

    public class OrderItemTopping
    {
        [Key]
        public int OrderItemToppingId { get; set; }

        public int OrderItemId { get; set; }
        public int ToppingId { get; set; }

        [Column(TypeName = "decimal(12,0)")]
        public decimal Price { get; set; }

        [ForeignKey(nameof(OrderItemId))]
        public OrderItem? OrderItem { get; set; }

        [ForeignKey(nameof(ToppingId))]
        public Topping? Topping { get; set; }
    }

    public class Payment
    {
        [Key]
        public int PaymentId { get; set; }

        public int OrderId { get; set; }

        [Required, MaxLength(20)]
        public string Method { get; set; } = "cash"; // cash, vietqr, momo, bank_transfer

        [Column(TypeName = "decimal(15,0)")]
        public decimal Amount { get; set; }

        [MaxLength(100)]
        public string? TransactionRef { get; set; }

        [MaxLength(2048)]
        public string? CheckoutUrl { get; set; }

        [MaxLength(4000)]
        public string? QrCode { get; set; }

        [MaxLength(100)]
        public string? ExternalPaymentLinkId { get; set; }

        [MaxLength(20)]
        public string? ExternalBankBin { get; set; }

        [Required, MaxLength(20)]
        public string Status { get; set; } = "pending"; // pending, completed, failed

        public DateTime? PaidAt { get; set; }
        public int? ProcessedByStaffId { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [ForeignKey(nameof(OrderId))]
        public Order? Order { get; set; }

        [ForeignKey(nameof(ProcessedByStaffId))]
        public Staff? ProcessedByStaff { get; set; }
    }

    public class LoyaltyPoint
    {
        [Key]
        public int PointId { get; set; }

        public int CustomerId { get; set; }
        public int? OrderId { get; set; }
        public int Points { get; set; }

        [Required, MaxLength(20)]
        public string Type { get; set; } = "earn"; // earn, redeem, bonus, expire

        [MaxLength(200)]
        public string? Description { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [ForeignKey(nameof(CustomerId))]
        public Customer? Customer { get; set; }

        [ForeignKey(nameof(OrderId))]
        public Order? Order { get; set; }
    }

    public class VoucherUsage
    {
        [Key]
        public int UsageId { get; set; }

        public int VoucherId { get; set; }
        public int? CustomerId { get; set; }
        public int OrderId { get; set; }

        [Column(TypeName = "decimal(12,0)")]
        public decimal DiscountAmount { get; set; }
        public DateTime UsedAt { get; set; } = DateTime.UtcNow;

        [ForeignKey(nameof(VoucherId))]
        public Voucher? Voucher { get; set; }

        [ForeignKey(nameof(CustomerId))]
        public Customer? Customer { get; set; }

        [ForeignKey(nameof(OrderId))]
        public Order? Order { get; set; }
    }
}
