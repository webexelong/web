using System.ComponentModel.DataAnnotations;

namespace WebCafe.Backend.Models.DTOs.Payment
{
    public class CreatePayOSPaymentRequest
    {
        public int OrderId { get; set; }
        public string? PaymentAccessToken { get; set; }
        public string? OrderCode { get; set; }
        public string? ReturnUrl { get; set; }
        public string? CancelUrl { get; set; }
    }

    public class PayOSPaymentDto
    {
        public int PaymentId { get; set; }
        public int OrderId { get; set; }
        public string OrderCode { get; set; } = string.Empty;
        public long PayOSOrderCode { get; set; }
        public decimal Amount { get; set; }
        public string Status { get; set; } = string.Empty;
        public string? CheckoutUrl { get; set; }
        public string? QrCode { get; set; }
        public string? PaymentLinkId { get; set; }
        public string? AccountNumber { get; set; }
        public string? AccountName { get; set; }
        public string? Bin { get; set; }
        public string? Description { get; set; }
        public string? StoreBankAccount { get; set; }
        public string? StoreBankName { get; set; }
        public DateTime CreatedAt { get; set; }
    }

    public class PayOSStatusCheckDto
    {
        public long OrderCode { get; set; }
        public int OrderId { get; set; }
        public string Status { get; set; } = string.Empty; // PENDING, PAID, CANCELLED
        public decimal Amount { get; set; }
        public decimal AmountPaid { get; set; }
        public decimal AmountRemaining { get; set; }
        public bool IsSuccess { get; set; }
        public string? Message { get; set; }
    }

    public class StorePaymentConfigDto
    {
        public int StoreId { get; set; }
        public string StoreName { get; set; } = string.Empty;
        public bool HasCustomPayOS { get; set; }
        public string? PayOSClientId { get; set; }
        public string? MaskedApiKey { get; set; }
        public string? MaskedChecksumKey { get; set; }
        public string? BankAccount { get; set; }
        public string? BankName { get; set; }
        public string? BankAccountName { get; set; }
    }

    public class UpdateStorePaymentConfigDto
    {
        [MaxLength(100)]
        public string? PayOSClientId { get; set; }

        [MaxLength(100)]
        public string? PayOSApiKey { get; set; }

        [MaxLength(100)]
        public string? PayOSChecksumKey { get; set; }

        [MaxLength(30)]
        public string? BankAccount { get; set; }

        [MaxLength(50)]
        public string? BankName { get; set; }

        [MaxLength(100)]
        public string? BankAccountName { get; set; }
    }

    public class TestStorePaymentConfigRequest
    {
        [Required(ErrorMessage = "Client ID là bắt buộc.")]
        public string ClientId { get; set; } = string.Empty;

        [Required(ErrorMessage = "API Key là bắt buộc.")]
        public string ApiKey { get; set; } = string.Empty;

        [Required(ErrorMessage = "Checksum Key là bắt buộc.")]
        public string ChecksumKey { get; set; } = string.Empty;
    }

    public class TestPaymentConfigResultDto
    {
        public bool IsValid { get; set; }
        public string Message { get; set; } = string.Empty;
        public string? AccountName { get; set; }
        public string? AccountNumber { get; set; }
    }
}
