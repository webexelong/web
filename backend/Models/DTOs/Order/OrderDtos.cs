using System.ComponentModel.DataAnnotations;

namespace WebCafe.Backend.Models.DTOs.Order
{
    public class CreateOrderItemToppingDto
    {
        public int ToppingId { get; set; }
    }

    public class CreateOrderItemDto
    {
        [Required(ErrorMessage = "Món ăn là bắt buộc.")]
        public int MenuItemId { get; set; }
        
        public int? SizeId { get; set; }
        
        [Range(1, 100, ErrorMessage = "Số lượng phải từ 1 đến 100.")]
        public int Quantity { get; set; } = 1;
        
        [RegularExpression(@"^(0%|25%|50%|75%|100%)$", ErrorMessage = "Độ ngọt phải là 0%, 25%, 50%, 75% hoặc 100%.")]
        public string SugarLevel { get; set; } = "100%";
        
        [RegularExpression(@"^(0%|25%|50%|75%|100%)$", ErrorMessage = "Độ đá phải là 0%, 25%, 50%, 75% hoặc 100%.")]
        public string IceLevel { get; set; } = "100%";
        
        [MaxLength(500, ErrorMessage = "Ghi chú không được vượt quá 500 ký tự.")]
        public string? Note { get; set; }
        
        public List<CreateOrderItemToppingDto>? Toppings { get; set; }
    }

    public class CreateOrderDto
    {
        [Required(ErrorMessage = "Cửa hàng là bắt buộc.")]
        public int StoreId { get; set; }
        
        public int? TableId { get; set; }
        public string? TableToken { get; set; }
        
        [Phone(ErrorMessage = "Số điện thoại khách hàng không đúng định dạng.")]
        public string? CustomerPhone { get; set; }
        
        [MaxLength(100, ErrorMessage = "Tên khách hàng không được vượt quá 100 ký tự.")]
        public string? CustomerName { get; set; }
        
        // Guest Order Support
        public string? GuestId { get; set; }
        
        [MaxLength(100, ErrorMessage = "Tên khách không được vượt quá 100 ký tự.")]
        public string? GuestName { get; set; }
        
        [Phone(ErrorMessage = "Số điện thoại khách không đúng định dạng.")]
        public string? GuestPhone { get; set; }
        
        [MaxLength(50, ErrorMessage = "Mã voucher không được vượt quá 50 ký tự.")]
        public string? VoucherCode { get; set; }
        
        [Range(0, int.MaxValue, ErrorMessage = "Điểm sử dụng không hợp lệ.")]
        public int PointsToUse { get; set; } = 0;
        
        // Order Source (qr_table vs pos_staff)
        public string? Source { get; set; } = "qr_table";

        // Payment Method for POS Orders (cash, payos)
        public string? PaymentMethod { get; set; }

        [MaxLength(500, ErrorMessage = "Ghi chú không được vượt quá 500 ký tự.")]
        public string? Note { get; set; }
        
        [Required(ErrorMessage = "Đơn hàng phải có ít nhất 1 món.")]
        [MinLength(1, ErrorMessage = "Đơn hàng phải có ít nhất 1 món.")]
        public List<CreateOrderItemDto> Items { get; set; } = new();
    }

    public class OrderItemToppingDto
    {
        public int OrderItemToppingId { get; set; }
        public int ToppingId { get; set; }
        public string ToppingName { get; set; } = string.Empty;
        public decimal Price { get; set; }
    }

    public class OrderItemDto
    {
        public int OrderItemId { get; set; }
        public int MenuItemId { get; set; }
        public string MenuItemName { get; set; } = string.Empty;
        public string? ImageUrl { get; set; }
        public int? SizeId { get; set; }
        public string? SizeName { get; set; }
        public int Quantity { get; set; }
        public decimal UnitPrice { get; set; }
        public decimal ToppingTotal { get; set; }
        public decimal SubTotal { get; set; }
        public string SugarLevel { get; set; } = "100%";
        public string IceLevel { get; set; } = "100%";
        public string? Note { get; set; }
        public List<OrderItemToppingDto> Toppings { get; set; } = new();
    }

    public class OrderDto
    {
        public int OrderId { get; set; }
        public int TenantId { get; set; }
        public string TenantName { get; set; } = string.Empty;
        public int StoreId { get; set; }
        public string StoreName { get; set; } = string.Empty;
        public string OrderCode { get; set; } = string.Empty;
        public int? TableId { get; set; }
        public string? TableNumber { get; set; }
        public int? CustomerId { get; set; }
        public string? CustomerName { get; set; }
        public string? CustomerPhone { get; set; }
        
        // Guest Order Fields
        public string? GuestId { get; set; }
        public string? GuestName { get; set; }
        public string? GuestPhone { get; set; }
        public string? PaymentAccessToken { get; set; }
        
        public string Status { get; set; } = "pending";
        public decimal SubTotal { get; set; }
        public decimal DiscountAmount { get; set; }
        public int PointsUsed { get; set; }
        public int PointsEarned { get; set; }
        public decimal TotalAmount { get; set; }
        public string? Note { get; set; }
        public DateTime CreatedAt { get; set; }
        public List<OrderItemDto> Items { get; set; } = new();
    }

    public class UpdateOrderStatusDto
    {
        [Required(ErrorMessage = "Trạng thái đơn hàng là bắt buộc.")]
        [RegularExpression(@"^(pending|confirmed|preparing|ready|served|paid|completed|cancelled|awaiting_payment)$", 
            ErrorMessage = "Trạng thái phải là: pending, confirmed, preparing, ready, served, paid, completed, cancelled hoặc awaiting_payment.")]
        public string Status { get; set; } = "confirmed";
    }
}
