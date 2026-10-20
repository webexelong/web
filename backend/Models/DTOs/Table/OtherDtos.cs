using System.ComponentModel.DataAnnotations;

namespace WebCafe.Backend.Models.DTOs.Table
{
    public class TableDto
    {
        public int TableId { get; set; }
        public int StoreId { get; set; }
        public string TableNumber { get; set; } = string.Empty;
        public int Capacity { get; set; }
        public string? Location { get; set; }
        public string? QRCodeUrl { get; set; }
        public string QrToken { get; set; } = string.Empty;
        public string Status { get; set; } = "Available";
        public bool IsActive { get; set; }
        public int? ActiveOrderId { get; set; }
        public string? ActiveOrderCode { get; set; }
    }

    public class CreateTableDto
    {
        [Required(ErrorMessage = "Cửa hàng là bắt buộc.")]
        public int StoreId { get; set; }
        
        [Required(ErrorMessage = "Số bàn là bắt buộc.")]
        [MaxLength(10, ErrorMessage = "Số bàn không được vượt quá 10 ký tự.")]
        public string TableNumber { get; set; } = string.Empty;
        
        [Range(1, 50, ErrorMessage = "Sức chứa phải từ 1 đến 50 người.")]
        public int Capacity { get; set; } = 4;
        
        [MaxLength(100, ErrorMessage = "Vị trí không được vượt quá 100 ký tự.")]
        public string? Location { get; set; }
    }

    public class UpdateTableStatusDto
    {
        [Required(ErrorMessage = "Trạng thái bàn là bắt buộc.")]
        [RegularExpression(@"^(Available|Occupied|Reserved)$", 
            ErrorMessage = "Trạng thái phải là: Available, Occupied hoặc Reserved.")]
        public string Status { get; set; } = "Available"; // Available, Occupied, Reserved
    }

    public class TableQrResolutionDto
    {
        public int StoreId { get; set; }
        public int TableId { get; set; }
        public string TableNumber { get; set; } = string.Empty;
        public string StoreName { get; set; } = string.Empty;
        public string TenantName { get; set; } = string.Empty;
    }
}

namespace WebCafe.Backend.Models.DTOs.Voucher
{
    public class CheckVoucherRequest
    {
        [Required(ErrorMessage = "Mã voucher là bắt buộc.")]
        [MaxLength(50, ErrorMessage = "Mã voucher không được vượt quá 50 ký tự.")]
        public string Code { get; set; } = string.Empty;
        
        [Required(ErrorMessage = "Cửa hàng là bắt buộc.")]
        public int StoreId { get; set; }
        
        [Required(ErrorMessage = "Số tiền đơn hàng là bắt buộc.")]
        [Range(0.01, double.MaxValue, ErrorMessage = "Số tiền đơn hàng phải lớn hơn 0.")]
        public decimal OrderAmount { get; set; }
        
        [Phone(ErrorMessage = "Số điện thoại không đúng định dạng.")]
        public string? CustomerPhone { get; set; }
    }

    public class VoucherValidationResult
    {
        public bool IsValid { get; set; }
        public string Message { get; set; } = string.Empty;
        public int? VoucherId { get; set; }
        public string Code { get; set; } = string.Empty;
        public string Title { get; set; } = string.Empty;
        public string DiscountType { get; set; } = "percent";
        public decimal DiscountAmount { get; set; }
        public decimal FinalAmount { get; set; }
    }
}

namespace WebCafe.Backend.Models.DTOs.Payment
{
    // Moved to Models/DTOs/Payment/PaymentDtos.cs
}

namespace WebCafe.Backend.Models.DTOs.Analytics
{
    // Moved to Models/DTOs/Analytics/AnalyticsDtos.cs
}
