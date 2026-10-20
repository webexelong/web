using Microsoft.EntityFrameworkCore;
using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using WebCafe.Backend.Common.Constants;
using WebCafe.Backend.Common.Exceptions;
using WebCafe.Backend.Infrastructure.Data;
using WebCafe.Backend.Hubs;
using WebCafe.Backend.Models.DTOs.Payment;
using WebCafe.Backend.Models.Entities;
using WebCafe.Backend.Services.Abstraction;

namespace WebCafe.Backend.Services.Implementation
{
    public interface IVietQRPaymentService
    {
        Task<VietQRPaymentDto> CreateVietQRPaymentAsync(int orderId);
        Task<PaymentResultDto> ProcessWebhookAsync(VietQRWebhookDto webhook);
        Task<VietQRPaymentDto?> GetPendingPaymentByOrderIdAsync(int orderId);
        Task<bool> VerifyWebhookSignatureAsync(VietQRWebhookDto webhook, string signature);
    }

    public class VietQRPaymentService : IVietQRPaymentService
    {
        private readonly WebCafeDbContext _db;
        private readonly IOrderService _orderService;
        private readonly IInventoryService _inventoryService;
        private readonly IOrderNotificationService _notificationService;
        private readonly ILogger<VietQRPaymentService> _logger;
        private readonly IConfiguration _configuration;

        public VietQRPaymentService(
            WebCafeDbContext db, 
            IOrderService orderService,
            IInventoryService inventoryService,
            IOrderNotificationService notificationService,
            ILogger<VietQRPaymentService> logger,
            IConfiguration configuration)
        {
            _db = db;
            _orderService = orderService;
            _inventoryService = inventoryService;
            _notificationService = notificationService;
            _logger = logger;
            _configuration = configuration;
        }

        /// <summary>
        /// Tạo VietQR payment request cho đơn hàng
        /// </summary>
        public async Task<VietQRPaymentDto> CreateVietQRPaymentAsync(int orderId)
        {
            var order = await _db.Orders
                .Include(o => o.Store)
                    .ThenInclude(s => s!.Tenant)
                .FirstOrDefaultAsync(o => o.OrderId == orderId);

            if (order == null)
            {
                throw new NotFoundException("Không tìm thấy đơn hàng.");
            }

            if (order.Status == OrderStatus.Paid || order.Status == OrderStatus.Confirmed || order.Status == OrderStatus.Completed)
            {
                throw new AppException("Đơn hàng đã được thanh toán.");
            }

            if (order.Store == null || string.IsNullOrEmpty(order.Store.BankAccount))
            {
                throw new AppException("Cửa hàng chưa cấu hình thông tin ngân hàng.");
            }

            // Kiểm tra xem đã có payment pending chưa
            var existingPayment = await _db.Payments
                .FirstOrDefaultAsync(p => p.OrderId == orderId && p.Status == PaymentStatuses.Pending);

            if (existingPayment != null)
            {
                // Trả về payment hiện tại
                return MapToVietQRDto(existingPayment, order);
            }

            // Tạo payment record mới với status pending
            var payment = new Payment
            {
                OrderId = order.OrderId,
                Method = PaymentMethods.VietQR,
                Amount = order.TotalAmount,
                TransactionRef = $"VIETQR-{order.OrderCode}-{DateTime.UtcNow:yyMMddHHmmss}",
                Status = PaymentStatuses.Pending,
                CreatedAt = DateTime.UtcNow
            };

            _db.Payments.Add(payment);
            await _db.SaveChangesAsync();

            return MapToVietQRDto(payment, order);
        }

        /// <summary>
        /// Xử lý webhook từ ngân hàng khi khách hàng chuyển khoản thành công
        /// </summary>
        public async Task<PaymentResultDto> ProcessWebhookAsync(VietQRWebhookDto webhook)
        {
            _logger.LogInformation($"Received VietQR webhook: {webhook.TransactionId}");

            // Parse order code từ description/addInfo
            var orderCode = ExtractOrderCodeFromDescription(webhook.Description);
            if (string.IsNullOrEmpty(orderCode))
            {
                throw new AppException("Không tìm thấy mã đơn hàng trong giao dịch.");
            }

            var order = await _db.Orders
                .Include(o => o.Store)
                .FirstOrDefaultAsync(o => o.OrderCode == orderCode);

            if (order == null)
            {
                throw new NotFoundException($"Không tìm thấy đơn hàng {orderCode}.");
            }

            if (string.IsNullOrWhiteSpace(webhook.TransactionId))
                throw new AppException("Mã giao dịch ngân hàng bị thiếu.");
            if (webhook.Amount != order.TotalAmount)
                throw new AppException($"Số tiền chuyển khoản ({webhook.Amount:N0}đ) không khớp số tiền đơn hàng ({order.TotalAmount:N0}đ).");
            if (order.Store == null || string.IsNullOrWhiteSpace(order.Store.BankAccount)
                || !string.Equals(webhook.BankAccount.Trim(), order.Store.BankAccount.Trim(), StringComparison.Ordinal))
                throw new AppException("Tài khoản nhận tiền trong webhook không khớp cửa hàng.");

            // Repeated delivery of the same bank transaction is idempotent.
            var sameTransaction = await _db.Payments
                .FirstOrDefaultAsync(p => p.TransactionRef == webhook.TransactionId);
            if (sameTransaction != null)
            {
                if (sameTransaction.OrderId != order.OrderId || sameTransaction.Method != PaymentMethods.VietQR)
                    throw new AppException("Mã giao dịch đã được sử dụng cho đơn hàng khác.");

                if (sameTransaction.Status == PaymentStatuses.Completed)
                {
                    await ActivateOrderAfterPaymentAsync(order);
                    return ToPaymentResult(sameTransaction, order.OrderId, "Webhook đã được xử lý trước đó.");
                }
            }

            var completedPayment = await _db.Payments
                .FirstOrDefaultAsync(p => p.OrderId == order.OrderId && p.Status == PaymentStatuses.Completed);
            if (completedPayment != null)
            {
                throw new AppException("Đơn hàng đã có giao dịch thanh toán thành công.");
            }

            if (!string.Equals(order.Status, OrderStatus.AwaitingPayment, StringComparison.OrdinalIgnoreCase)
                && !string.Equals(order.Status, OrderStatus.Pending, StringComparison.OrdinalIgnoreCase))
            {
                throw new AppException($"Đơn hàng không ở trạng thái chờ thanh toán (trạng thái hiện tại: {order.Status}).");
            }

            // Tìm và cập nhật payment record
            var payment = sameTransaction ?? await _db.Payments
                .FirstOrDefaultAsync(p => p.OrderId == order.OrderId && p.Method == PaymentMethods.VietQR && p.Status == PaymentStatuses.Pending);

            if (payment == null)
            {
                // Tạo mới nếu chưa có
                payment = new Payment
                {
                    OrderId = order.OrderId,
                    Method = PaymentMethods.VietQR,
                    Amount = webhook.Amount,
                    TransactionRef = webhook.TransactionId,
                    Status = PaymentStatuses.Completed,
                    PaidAt = webhook.TransactionTime,
                    CreatedAt = DateTime.UtcNow
                };
                _db.Payments.Add(payment);
            }
            else
            {
                payment.Amount = webhook.Amount;
                payment.TransactionRef = webhook.TransactionId;
                payment.Status = PaymentStatuses.Completed;
                payment.PaidAt = webhook.TransactionTime;
            }

            await _db.SaveChangesAsync();

            await ActivateOrderAfterPaymentAsync(order);

            _logger.LogInformation($"Successfully processed VietQR payment for order {orderCode}");

            return ToPaymentResult(payment, order.OrderId, "Thanh toán thành công qua VietQR.");
        }

        private static PaymentResultDto ToPaymentResult(Payment payment, int orderId, string message) => new()
        {
            PaymentId = payment.PaymentId,
            OrderId = orderId,
            Method = payment.Method,
            Amount = payment.Amount,
            Status = payment.Status,
            Message = message
        };

        private async Task ActivateOrderAfterPaymentAsync(Order order)
        {
            var isNewlyActivated = string.Equals(order.Status, OrderStatus.AwaitingPayment, StringComparison.OrdinalIgnoreCase)
                || string.Equals(order.Status, OrderStatus.Pending, StringComparison.OrdinalIgnoreCase);
            if (isNewlyActivated)
                await _orderService.UpdateStatusAsync(order.OrderId, OrderStatus.Confirmed, null);
            else if (!string.Equals(order.Status, OrderStatus.Confirmed, StringComparison.OrdinalIgnoreCase)
                && !string.Equals(order.Status, OrderStatus.Paid, StringComparison.OrdinalIgnoreCase)
                && !string.Equals(order.Status, OrderStatus.Completed, StringComparison.OrdinalIgnoreCase))
                throw new AppException($"Không thể kích hoạt đơn ở trạng thái '{order.Status}'.");

            try
            {
                await _inventoryService.DeductInventoryForOrderAsync(order.OrderId, null);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to deduct inventory for VietQR order {OrderCode}", order.OrderCode);
            }
            await _orderService.ApplyPostPaymentBenefitsAsync(order.OrderId);

            if (order.TableId.HasValue)
            {
                var table = await _db.Tables.FirstOrDefaultAsync(t => t.TableId == order.TableId.Value);
                if (table != null && table.Status != TableStatuses.Occupied)
                {
                    table.Status = TableStatuses.Occupied;
                    await _db.SaveChangesAsync();
                    await _notificationService.NotifyTableStatusChangedAsync(order.StoreId, table.TableId, TableStatuses.Occupied);
                }
            }
            if (isNewlyActivated)
            {
                var activatedOrder = await _orderService.GetByIdAsync(order.OrderId);
                if (activatedOrder != null)
                    await _notificationService.NotifyNewOrderAsync(order.StoreId, activatedOrder);
            }
        }

        /// <summary>
        /// Lấy thông tin payment đang chờ cho order
        /// </summary>
        public async Task<VietQRPaymentDto?> GetPendingPaymentByOrderIdAsync(int orderId)
        {
            var payment = await _db.Payments
                .Include(p => p.Order)
                    .ThenInclude(o => o!.Store)
                .FirstOrDefaultAsync(p => p.OrderId == orderId && p.Status == PaymentStatuses.Pending);

            if (payment?.Order == null) return null;

            return MapToVietQRDto(payment, payment.Order);
        }

        /// <summary>
        /// Verify webhook signature using the configured shared HMAC secret.
        /// </summary>
        public Task<bool> VerifyWebhookSignatureAsync(VietQRWebhookDto webhook, string signature)
        {
            var secret = _configuration["VietQR:WebhookSecret"];
            if (string.IsNullOrWhiteSpace(secret) || string.IsNullOrWhiteSpace(signature))
                return Task.FromResult(false);

            var canonical = string.Join("|", webhook.TransactionId.Trim(),
                webhook.Amount.ToString("0.##", CultureInfo.InvariantCulture),
                webhook.Description.Trim(), webhook.TransactionTime.ToUniversalTime().ToString("O", CultureInfo.InvariantCulture),
                webhook.BankAccount.Trim(), (webhook.ReferenceNumber ?? string.Empty).Trim());
            using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(secret));
            var expected = hmac.ComputeHash(Encoding.UTF8.GetBytes(canonical));
            var normalized = signature.Trim();
            byte[] provided;
            try { provided = Convert.FromHexString(normalized); }
            catch { try { provided = Convert.FromBase64String(normalized); } catch { return Task.FromResult(false); } }
            return Task.FromResult(provided.Length == expected.Length && CryptographicOperations.FixedTimeEquals(provided, expected));
        }

        private static VietQRPaymentDto MapToVietQRDto(Payment payment, Order order)
        {
            var store = order.Store;
            
            // Generate VietQR URL
            // Format: https://img.vietqr.io/image/{BANK_ID}-{ACCOUNT_NUMBER}-{TEMPLATE}.png?amount={AMOUNT}&addInfo={INFO}&accountName={NAME}
            var qrUrl = $"https://img.vietqr.io/image/{store?.BankName ?? "970415"}-{store?.BankAccount}-compact2.png" +
                       $"?amount={order.TotalAmount}" +
                       $"&addInfo={Uri.EscapeDataString(order.OrderCode)}" +
                       $"&accountName={Uri.EscapeDataString(store?.BankAccountName ?? "WebCafe")}";

            return new VietQRPaymentDto
            {
                PaymentId = payment.PaymentId,
                OrderId = order.OrderId,
                OrderCode = order.OrderCode,
                Amount = order.TotalAmount,
                BankAccount = store?.BankAccount ?? string.Empty,
                BankName = store?.BankName ?? string.Empty,
                AccountName = store?.BankAccountName ?? string.Empty,
                TransferContent = order.OrderCode,
                QrCodeUrl = qrUrl,
                Status = payment.Status,
                CreatedAt = payment.CreatedAt,
                ExpiresAt = payment.CreatedAt.AddMinutes(15) // QR hết hạn sau 15 phút
            };
        }

        private static string ExtractOrderCodeFromDescription(string description)
        {
            // VietQR thường gửi description dạng: "OD-260913-1234" hoặc "Thanh toan OD-260913-1234"
            // Extract order code pattern: OD-YYMMDD-XXXX
            var match = System.Text.RegularExpressions.Regex.Match(description, @"OD-\d{6}-\d{4}");
            return match.Success ? match.Value : string.Empty;
        }
    }

    // DTOs
    public class VietQRPaymentDto
    {
        public int PaymentId { get; set; }
        public int OrderId { get; set; }
        public string OrderCode { get; set; } = string.Empty;
        public decimal Amount { get; set; }
        public string BankAccount { get; set; } = string.Empty;
        public string BankName { get; set; } = string.Empty;
        public string AccountName { get; set; } = string.Empty;
        public string TransferContent { get; set; } = string.Empty;
        public string QrCodeUrl { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
        public DateTime ExpiresAt { get; set; }
    }

    public class VietQRWebhookDto
    {
        public string TransactionId { get; set; } = string.Empty;
        public decimal Amount { get; set; }
        public string Description { get; set; } = string.Empty;
        public DateTime TransactionTime { get; set; }
        public string BankAccount { get; set; } = string.Empty;
        public string? ReferenceNumber { get; set; }
    }
}
