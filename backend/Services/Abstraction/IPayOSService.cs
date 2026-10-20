using PayOS.Models.V2.PaymentRequests;
using PayOS.Models.Webhooks;
using WebCafe.Backend.Models.DTOs.Payment;

namespace WebCafe.Backend.Services.Abstraction
{
    public interface IPayOSService
    {
        Task<PayOSPaymentDto> CreatePaymentLinkAsync(int orderId, string? orderCode = null, string? returnUrl = null, string? cancelUrl = null);
        Task<PayOSStatusCheckDto> GetPaymentStatusAsync(long orderCode);
        Task<PaymentResultDto> ProcessWebhookAsync(Webhook webhook);
        Task<PaymentLink> CancelPaymentLinkAsync(long orderCode, string? reason = null);

        // Store-specific multi-tenant management
        Task<StorePaymentConfigDto> GetStorePaymentConfigAsync(int storeId);
        Task<StorePaymentConfigDto> UpdateStorePaymentConfigAsync(int storeId, UpdateStorePaymentConfigDto dto);
        Task<TestPaymentConfigResultDto> TestStorePaymentConfigAsync(TestStorePaymentConfigRequest request);
    }
}
