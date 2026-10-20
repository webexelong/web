using System.Collections.Concurrent;
using Microsoft.Extensions.Configuration;
using Microsoft.EntityFrameworkCore;
using PayOS;
using PayOS.Models.V2.PaymentRequests;
using PayOS.Models.Webhooks;
using WebCafe.Backend.Common.Constants;
using WebCafe.Backend.Common.Exceptions;
using WebCafe.Backend.Hubs;
using WebCafe.Backend.Infrastructure.Data;
using WebCafe.Backend.Models.DTOs.Order;
using WebCafe.Backend.Models.DTOs.Payment;
using WebCafe.Backend.Models.Entities;
using WebCafe.Backend.Services.Abstraction;

namespace WebCafe.Backend.Services.Implementation
{
    public class PayOSService : IPayOSService
    {
        private static readonly ConcurrentDictionary<int, SemaphoreSlim> _paymentLinkLocks = new();
        private readonly WebCafeDbContext _db;
        private readonly PayOSClient _defaultPayOS;
        private readonly IOrderNotificationService _notificationService;
        private readonly IInventoryService _inventoryService;
        private readonly IOrderService _orderService;
        private readonly ILogger<PayOSService> _logger;
        private readonly IConfiguration _configuration;

        public PayOSService(
            WebCafeDbContext db,
            PayOSClient defaultPayOS,
            IOrderNotificationService notificationService,
            IInventoryService inventoryService,
            IOrderService orderService,
            ILogger<PayOSService> logger,
            IConfiguration configuration)
        {
            _db = db;
            _defaultPayOS = defaultPayOS;
            _notificationService = notificationService;
            _inventoryService = inventoryService;
            _orderService = orderService;
            _logger = logger;
            _configuration = configuration;
        }

        public async Task<PayOSPaymentDto> CreatePaymentLinkAsync(int orderId, string? orderCode = null, string? returnUrl = null, string? cancelUrl = null)
        {
            if (orderId <= 0 && !string.IsNullOrWhiteSpace(orderCode))
                orderId = await _db.Orders.Where(o => o.OrderCode == orderCode).Select(o => o.OrderId).FirstOrDefaultAsync();
            if (orderId <= 0) throw new NotFoundException("Không tìm thấy đơn hàng.");

            var gate = _paymentLinkLocks.GetOrAdd(orderId, static _ => new SemaphoreSlim(1, 1));
            await gate.WaitAsync();
            try
            {
                return await CreatePaymentLinkCoreAsync(orderId, orderCode, returnUrl, cancelUrl);
            }
            finally
            {
                gate.Release();
            }
        }

        private async Task<PayOSPaymentDto> CreatePaymentLinkCoreAsync(int orderId, string? orderCode, string? returnUrl, string? cancelUrl)
        {
            var order = await _db.Orders
                .Include(o => o.Store)
                .Include(o => o.OrderItems)
                    .ThenInclude(oi => oi.MenuItem)
                .FirstOrDefaultAsync(o => (orderId > 0 && o.OrderId == orderId) || (!string.IsNullOrEmpty(orderCode) && o.OrderCode == orderCode));

            if (order == null)
            {
                throw new NotFoundException("Không tìm thấy đơn hàng.");
            }

            orderId = order.OrderId;

            var completedPayment = await _db.Payments
                .FirstOrDefaultAsync(p => p.OrderId == orderId && p.Status == PaymentStatuses.Completed);
            if (completedPayment != null)
            {
                if (completedPayment.Method == PaymentMethods.PayOS
                    && long.TryParse(completedPayment.TransactionRef, out var completedOrderCode))
                {
                    return MapStoredPayment(completedPayment, order, completedOrderCode, "PAID");
                }
                return new PayOSPaymentDto
                {
                    PaymentId = completedPayment.PaymentId,
                    OrderId = order.OrderId,
                    OrderCode = order.OrderCode,
                    PayOSOrderCode = 0,
                    Amount = order.TotalAmount,
                    Status = "PAID",
                    AccountNumber = order.Store?.BankAccount,
                    AccountName = order.Store?.BankAccountName ?? "WebCafe",
                    Description = $"WC {order.OrderCode.Replace("-", "")}",
                    CreatedAt = order.CreatedAt
                };
            }
            if (order.Status == OrderStatus.Paid || order.Status == OrderStatus.Completed)
                throw new AppException("Trạng thái đơn đã thanh toán nhưng không tìm thấy payment hoàn tất. Cần đối soát trước khi tạo link mới.");

            var payOsClient = GetPayOSClientForStore(order.Store);
            var pendingPayment = await _db.Payments
                .Where(p => p.OrderId == orderId && p.Method == PaymentMethods.PayOS && p.Status == PaymentStatuses.Pending)
                .OrderByDescending(p => p.CreatedAt)
                .FirstOrDefaultAsync();

            // A process restart must not silently replace a still-live provider link.
            if (pendingPayment != null)
            {
                if (!long.TryParse(pendingPayment.TransactionRef, out var oldOrderCode))
                    throw new AppException("Payment đang chờ có mã PayOS không hợp lệ; hệ thống từ chối tạo link khác để tránh thu tiền trùng.");
                PaymentLink oldLink;
                try
                {
                    oldLink = await payOsClient.PaymentRequests.GetAsync(oldOrderCode);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Unable to verify existing PayOS link {PayOSCode} for order {OrderId}; refusing to create a second link", oldOrderCode, orderId);
                    throw new AppException("Không thể xác minh link thanh toán hiện tại. Vui lòng thử lại sau; hệ thống chưa tạo link mới.");
                }

                var oldStatus = oldLink.Status.ToString();
                if (string.Equals(oldStatus, "PAID", StringComparison.OrdinalIgnoreCase))
                {
                    var paidStatus = await GetPaymentStatusAsync(oldOrderCode);
                    if (!paidStatus.IsSuccess)
                        throw new AppException("PayOS đã báo link được thanh toán nhưng hệ thống chưa đồng bộ được trạng thái. Vui lòng liên hệ cửa hàng.");
                    return MapStoredPayment(pendingPayment, order, oldOrderCode, PaymentStatuses.Completed);
                }

                if (string.Equals(oldStatus, "PENDING", StringComparison.OrdinalIgnoreCase))
                {
                    if (!string.IsNullOrWhiteSpace(pendingPayment.CheckoutUrl))
                        return MapStoredPayment(pendingPayment, order, oldOrderCode, PaymentStatuses.Pending);

                    // Legacy row created before link details were persisted. Cancel it before
                    // issuing a replacement, otherwise the old URL could still collect money.
                    await payOsClient.PaymentRequests.CancelAsync(oldOrderCode, "Rotate legacy link without a stored checkout URL");
                }
                else if (!new[] { "CANCELLED", "CANCELED", "EXPIRED", "FAILED" }
                    .Contains(oldStatus, StringComparer.OrdinalIgnoreCase))
                {
                    throw new AppException($"Link thanh toán cũ đang ở trạng thái '{oldStatus}'. Hệ thống chưa tạo link khác để tránh thu tiền trùng; cần đối soát trước.");
                }

                if (pendingPayment.Status == PaymentStatuses.Pending)
                {
                    pendingPayment.Status = PaymentStatuses.Failed;
                    await _db.SaveChangesAsync();
                }
            }

            // Tạo orderCode dạng số duy nhất cho PayOS
            long payOsOrderCode = GeneratePayOSOrderCode(order.OrderId);

            // Ràng buộc PayOS: Description tối đa 20 ký tự
            string cleanCode = order.OrderCode.Replace("-", "");
            string description = $"WC {cleanCode}";
            if (description.Length > 20)
            {
                description = description.Substring(0, 20);
            }

            var items = order.OrderItems.Select(oi => new PaymentLinkItem
            {
                Name = oi.MenuItem?.Name ?? "Món",
                Quantity = oi.Quantity,
                Price = (int)oi.UnitPrice
            }).ToList();

            if (!items.Any())
            {
                items.Add(new PaymentLinkItem { Name = "WebCafe Order", Quantity = 1, Price = (int)order.TotalAmount });
            }

            // Default URLs
            string effectiveReturnUrl = !string.IsNullOrWhiteSpace(returnUrl) 
                ? returnUrl 
                : $"{GetFrontendPublicUrl()}/order-success?orderId={order.OrderId}&orderCode={order.OrderCode}&status=PAID";
            string effectiveCancelUrl = !string.IsNullOrWhiteSpace(cancelUrl) 
                ? cancelUrl 
                : $"{GetFrontendPublicUrl()}/cart?orderId={order.OrderId}&status=CANCELLED";

            EnsureSafeCallbackUrl(effectiveReturnUrl);
            EnsureSafeCallbackUrl(effectiveCancelUrl);

            var paymentData = new CreatePaymentLinkRequest
            {
                OrderCode = payOsOrderCode,
                Amount = (int)order.TotalAmount,
                Description = description,
                Items = items,
                CancelUrl = effectiveCancelUrl,
                ReturnUrl = effectiveReturnUrl
            };

            _logger.LogInformation("Creating PayOS payment link for OrderId {OrderId}, PayOSOrderCode {PayOSCode}, Store {StoreId}, Amount {Amount}", 
                order.OrderId, payOsOrderCode, order.StoreId, order.TotalAmount);

            CreatePaymentLinkResponse result = null!;
            int maxRetries = 3;
            for (int attempt = 1; attempt <= maxRetries; attempt++)
            {
                try
                {
                    result = await payOsClient.PaymentRequests.CreateAsync(paymentData);
                    break;
                }
                catch (PayOS.Exceptions.ApiException ex) when (attempt < maxRetries && (ex.Message.Contains("tồn tại") || ex.Message.Contains("exists") || ex.Message.Contains("already")))
                {
                    _logger.LogWarning("PayOS order code {Code} collision on attempt {Attempt}. Generating fresh code and retrying...", payOsOrderCode, attempt);
                    payOsOrderCode = GeneratePayOSOrderCode(order.OrderId);
                    paymentData.OrderCode = payOsOrderCode;
                }
            }

            // Lưu hoặc cập nhật Payment record trong cơ sở dữ liệu
            var existingPayment = new Payment
            {
                OrderId = order.OrderId,
                Method = PaymentMethods.PayOS,
                Amount = order.TotalAmount,
                TransactionRef = payOsOrderCode.ToString(),
                CheckoutUrl = result.CheckoutUrl,
                QrCode = result.QrCode,
                ExternalPaymentLinkId = result.PaymentLinkId,
                ExternalBankBin = result.Bin,
                Status = PaymentStatuses.Pending,
                CreatedAt = DateTime.UtcNow
            };
            _db.Payments.Add(existingPayment);
            await _db.SaveChangesAsync();

            var dto = new PayOSPaymentDto
            {
                PaymentId = existingPayment.PaymentId,
                OrderId = order.OrderId,
                OrderCode = order.OrderCode,
                PayOSOrderCode = payOsOrderCode,
                Amount = order.TotalAmount,
                Status = PaymentStatuses.Pending,
                CheckoutUrl = result.CheckoutUrl,
                QrCode = result.QrCode,
                PaymentLinkId = result.PaymentLinkId,
                AccountNumber = result.AccountNumber,
                AccountName = result.AccountName,
                Bin = result.Bin,
                Description = description,
                StoreBankAccount = order.Store?.BankAccount,
                StoreBankName = order.Store?.BankName,
                CreatedAt = existingPayment.CreatedAt
            };

            return dto;
        }

        private static PayOSPaymentDto MapStoredPayment(Payment payment, Order order, long orderCode, string status) => new()
        {
            PaymentId = payment.PaymentId,
            OrderId = order.OrderId,
            OrderCode = order.OrderCode,
            PayOSOrderCode = orderCode,
            Amount = payment.Amount,
            Status = status,
            CheckoutUrl = payment.CheckoutUrl,
            QrCode = payment.QrCode,
            PaymentLinkId = payment.ExternalPaymentLinkId,
            AccountNumber = order.Store?.BankAccount,
            AccountName = order.Store?.BankAccountName ?? "WebCafe",
            Bin = payment.ExternalBankBin,
            Description = $"WC {order.OrderCode.Replace("-", string.Empty)}",
            StoreBankAccount = order.Store?.BankAccount,
            StoreBankName = order.Store?.BankName,
            CreatedAt = payment.CreatedAt
        };

        public async Task<PayOSStatusCheckDto> GetPaymentStatusAsync(long orderCode)
        {
            try
            {
                var payment = await _db.Payments
                    .Include(p => p.Order)
                        .ThenInclude(o => o!.Store)
                    .FirstOrDefaultAsync(p => p.TransactionRef == orderCode.ToString());

                // Sử dụng client của quán hoặc fallback
                PayOSClient payOsClient = GetPayOSClientForStore(payment?.Order?.Store);

                PaymentLink info = await payOsClient.PaymentRequests.GetAsync(orderCode);

                bool isPaid = info.Status == PaymentLinkStatus.Paid || info.Status.ToString().Equals("PAID", StringComparison.OrdinalIgnoreCase);
                bool isCancelled = info.Status.ToString().Equals("CANCELLED", StringComparison.OrdinalIgnoreCase)
                    || info.Status.ToString().Equals("CANCELED", StringComparison.OrdinalIgnoreCase);

                if (isPaid && (payment == null || info.Amount != (long)payment.Amount
                    || info.AmountPaid != (long)payment.Amount || info.AmountRemaining != 0))
                    throw new AppException("PayOS báo thanh toán nhưng số tiền thực nhận không khớp payment đã lưu.");

                if (isPaid && payment != null && payment.Status != PaymentStatuses.Completed)
                {
                    // Tự động sync trạng thái nếu PayOS đã thanh toán nhưng DB chưa update (xử lý khi Webhook không vào được localhost)
                    payment.Status = PaymentStatuses.Completed;
                    payment.PaidAt = DateTime.UtcNow;

                    if (payment.Order != null)
                    {
                        // Kích hoạt đơn hàng, trừ kho, báo chuông cho Bếp và chuyển bàn sang bận
                        await ActivateOrderAfterPaymentAsync(payment.Order);
                        await _orderService.ApplyPostPaymentBenefitsAsync(payment.Order.OrderId);
                    }

                    await _db.SaveChangesAsync();
                    _logger.LogInformation("Synced PAID status -> CONFIRMED order status for PayOS OrderCode {OrderCode} via Polling", orderCode);
                }
                else if (isCancelled && payment?.Status == PaymentStatuses.Pending)
                {
                    payment.Status = PaymentStatuses.Failed;
                    await _db.SaveChangesAsync();
                }

                return new PayOSStatusCheckDto
                {
                    OrderCode = orderCode,
                    OrderId = payment?.OrderId ?? 0,
                    Status = info.Status.ToString(),
                    Amount = info.Amount,
                    AmountPaid = info.AmountPaid,
                    AmountRemaining = info.AmountRemaining,
                    IsSuccess = isPaid,
                    Message = isPaid ? "Thanh toán thành công" : $"Trạng thái giao dịch: {info.Status}"
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error checking PayOS status for code {OrderCode}", orderCode);
                return new PayOSStatusCheckDto
                {
                    OrderCode = orderCode,
                    Status = "ERROR",
                    IsSuccess = false,
                    Message = ex.Message
                };
            }
        }

        public async Task<PaymentResultDto> ProcessWebhookAsync(Webhook webhook)
        {
            _logger.LogInformation("Processing PayOS webhook...");

            WebhookData? data = null;

            // Thử xác thực với default client trước
            try
            {
                data = await _defaultPayOS.Webhooks.VerifyAsync(webhook);
            }
            catch
            {
                // Nếu default client verify không khớp, thử tìm payment theo orderCode để lấy Store client tương ứng
                if (webhook.Data != null && webhook.Data.OrderCode > 0)
                {
                    var p = await _db.Payments
                        .Include(x => x.Order)
                            .ThenInclude(o => o!.Store)
                        .FirstOrDefaultAsync(x => x.TransactionRef == webhook.Data.OrderCode.ToString());

                    if (p?.Order?.Store != null)
                    {
                        var storeClient = GetPayOSClientForStore(p.Order.Store);
                        data = await storeClient.Webhooks.VerifyAsync(webhook);
                    }
                }
            }

            if (data == null)
            {
                _logger.LogWarning("Invalid PayOS webhook signature");
                throw new AppException("Dữ liệu Webhook không hợp lệ hoặc chữ ký sai.");
            }

            if (!webhook.Success || !string.Equals(webhook.Code, "00", StringComparison.Ordinal)
                || !string.Equals(data.Code, "00", StringComparison.Ordinal))
                throw new AppException("Webhook PayOS chưa xác nhận giao dịch thành công.");
            if (!string.Equals(data.Currency, "VND", StringComparison.OrdinalIgnoreCase))
                throw new AppException("Đơn vị tiền tệ webhook không hợp lệ.");

            _logger.LogInformation("Valid PayOS Webhook received for OrderCode {OrderCode}, Amount {Amount}, Ref {Ref}",
                data.OrderCode, data.Amount, data.Reference);

            var payment = await _db.Payments
                .Include(p => p.Order)
                .FirstOrDefaultAsync(p => p.TransactionRef == data.OrderCode.ToString());

            if (payment == null)
            {
                _logger.LogWarning("Payment record not found for PayOS orderCode {OrderCode}", data.OrderCode);
                return new PaymentResultDto
                {
                    Status = PaymentStatuses.Pending,
                    Message = "Không tìm thấy Payment tương ứng nhưng Webhook đã xác thực."
                };
            }

            if (data.Amount != (long)payment.Amount)
            {
                _logger.LogWarning("PayOS amount mismatch for OrderCode {OrderCode}: received {Received}, expected {Expected}",
                    data.OrderCode, data.Amount, payment.Amount);
                throw new AppException("Số tiền thanh toán không khớp với đơn hàng.");
            }
            if (!string.IsNullOrWhiteSpace(payment.ExternalPaymentLinkId)
                && !string.Equals(payment.ExternalPaymentLinkId, data.PaymentLinkId, StringComparison.Ordinal))
                throw new AppException("PaymentLinkId webhook không khớp giao dịch đã lưu.");

            if (payment.Status == PaymentStatuses.Completed)
            {
                _logger.LogInformation("Payment for OrderCode {OrderCode} already processed.", data.OrderCode);
                return new PaymentResultDto
                {
                    PaymentId = payment.PaymentId,
                    OrderId = payment.OrderId,
                    Method = PaymentMethods.PayOS,
                    Amount = payment.Amount,
                    Status = PaymentStatuses.Completed,
                    Message = "Giao dịch đã được xử lý trước đó."
                };
            }

            var otherCompletedPayment = await _db.Payments.AnyAsync(p => p.OrderId == payment.OrderId
                && p.PaymentId != payment.PaymentId && p.Status == PaymentStatuses.Completed);
            if (otherCompletedPayment)
                throw new AppException("Đơn hàng đã có giao dịch thanh toán thành công khác; cần đối soát giao dịch PayOS này.");

            // Cập nhật trạng thái Payment và kích hoạt đơn hàng chính thức sang Bếp
            payment.Status = PaymentStatuses.Completed;
            payment.PaidAt = DateTime.UtcNow;

            if (payment.Order != null)
            {
                await ActivateOrderAfterPaymentAsync(payment.Order);
                await _orderService.ApplyPostPaymentBenefitsAsync(payment.Order.OrderId);
            }

            await _db.SaveChangesAsync();

            return new PaymentResultDto
            {
                PaymentId = payment.PaymentId,
                OrderId = payment.OrderId,
                Method = PaymentMethods.PayOS,
                Amount = payment.Amount,
                Status = PaymentStatuses.Completed,
                Message = "Thanh toán PayOS thành công."
            };
        }

        public async Task<PaymentLink> CancelPaymentLinkAsync(long orderCode, string? reason = null)
        {
            _logger.LogInformation("Cancelling PayOS payment link for {OrderCode}", orderCode);

            var payment = await _db.Payments
                .Include(p => p.Order)
                    .ThenInclude(o => o!.Store)
                .FirstOrDefaultAsync(p => p.TransactionRef == orderCode.ToString());

            PayOSClient client = GetPayOSClientForStore(payment?.Order?.Store);
            var result = await client.PaymentRequests.CancelAsync(orderCode, reason ?? "Khách hủy đơn hàng");

            if (payment != null && payment.Status == PaymentStatuses.Pending)
            {
                payment.Status = PaymentStatuses.Failed;
                await _db.SaveChangesAsync();
            }

            return result;
        }

        public async Task<StorePaymentConfigDto> GetStorePaymentConfigAsync(int storeId)
        {
            var store = await _db.Stores.FirstOrDefaultAsync(s => s.StoreId == storeId);
            if (store == null)
            {
                throw new NotFoundException("Không tìm thấy cửa hàng.");
            }

            bool hasCustom = !string.IsNullOrWhiteSpace(store.PayOSClientId) &&
                             !string.IsNullOrWhiteSpace(store.PayOSApiKey) &&
                             !string.IsNullOrWhiteSpace(store.PayOSChecksumKey);

            return new StorePaymentConfigDto
            {
                StoreId = store.StoreId,
                StoreName = store.Name,
                HasCustomPayOS = hasCustom,
                PayOSClientId = store.PayOSClientId,
                MaskedApiKey = MaskSecretKey(store.PayOSApiKey),
                MaskedChecksumKey = MaskSecretKey(store.PayOSChecksumKey),
                BankAccount = store.BankAccount,
                BankName = store.BankName,
                BankAccountName = store.BankAccountName
            };
        }

        public async Task<StorePaymentConfigDto> UpdateStorePaymentConfigAsync(int storeId, UpdateStorePaymentConfigDto dto)
        {
            var store = await _db.Stores.FirstOrDefaultAsync(s => s.StoreId == storeId);
            if (store == null)
            {
                throw new NotFoundException("Không tìm thấy cửa hàng.");
            }

            // Nếu người dùng nhập ClientId mới
            if (!string.IsNullOrWhiteSpace(dto.PayOSClientId))
            {
                store.PayOSClientId = dto.PayOSClientId.Trim();
            }

            // Nếu người dùng nhập ApiKey mới (không phải chuỗi mask đã có)
            if (!string.IsNullOrWhiteSpace(dto.PayOSApiKey) && !dto.PayOSApiKey.StartsWith("***"))
            {
                store.PayOSApiKey = dto.PayOSApiKey.Trim();
            }

            // Nếu người dùng nhập ChecksumKey mới
            if (!string.IsNullOrWhiteSpace(dto.PayOSChecksumKey) && !dto.PayOSChecksumKey.StartsWith("***"))
            {
                store.PayOSChecksumKey = dto.PayOSChecksumKey.Trim();
            }

            if (dto.BankAccount != null) store.BankAccount = dto.BankAccount.Trim();
            if (dto.BankName != null) store.BankName = dto.BankName.Trim();
            if (dto.BankAccountName != null) store.BankAccountName = dto.BankAccountName.Trim();

            await _db.SaveChangesAsync();
            _logger.LogInformation("Updated payment config for Store {StoreId}", storeId);

            return await GetStorePaymentConfigAsync(storeId);
        }

        public async Task<TestPaymentConfigResultDto> TestStorePaymentConfigAsync(TestStorePaymentConfigRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.ClientId) ||
                string.IsNullOrWhiteSpace(request.ApiKey) ||
                string.IsNullOrWhiteSpace(request.ChecksumKey))
            {
                return new TestPaymentConfigResultDto
                {
                    IsValid = false,
                    Message = "Vui lòng nhập đầy đủ Client ID, API Key và Checksum Key."
                };
            }

            try
            {
                var testClient = new PayOSClient(request.ClientId.Trim(), request.ApiKey.Trim(), request.ChecksumKey.Trim());

                // Thử tạo một link thanh toán test ngẫu nhiên hoặc kiểm tra tính hợp lệ
                long testCode = GeneratePayOSOrderCode(999);
                var testData = new CreatePaymentLinkRequest
                {
                    OrderCode = testCode,
                    Amount = 2000,
                    Description = "Test Connection",
                    Items = new List<PaymentLinkItem>
                    {
                        new PaymentLinkItem { Name = "Test Connection", Quantity = 1, Price = 2000 }
                    },
                    CancelUrl = $"{GetFrontendPublicUrl()}/cancel",
                    ReturnUrl = $"{GetFrontendPublicUrl()}/success"
                };

                CreatePaymentLinkResponse res = await testClient.PaymentRequests.CreateAsync(testData);

                // Sau khi tạo test thành công, hủy ngay link test để không tồn tại
                try
                {
                    await testClient.PaymentRequests.CancelAsync(testCode, "Hủy đơn test kết nối");
                }
                catch
                {
                    // Ignore cancel error for test
                }

                return new TestPaymentConfigResultDto
                {
                    IsValid = true,
                    Message = "Kết nối PayOS thành công! Cổng thanh toán hoạt động hoàn hảo.",
                    AccountName = res.AccountName,
                    AccountNumber = res.AccountNumber
                };
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "PayOS Test Connection Failed");
                return new TestPaymentConfigResultDto
                {
                    IsValid = false,
                    Message = $"Kết nối PayOS thất bại: {ex.Message}"
                };
            }
        }

        private PayOSClient GetPayOSClientForStore(Store? store)
        {
            if (store != null &&
                !string.IsNullOrWhiteSpace(store.PayOSClientId) &&
                !string.IsNullOrWhiteSpace(store.PayOSApiKey) &&
                !string.IsNullOrWhiteSpace(store.PayOSChecksumKey))
            {
                _logger.LogInformation("Using Store-specific PayOS credentials for Store {StoreId}", store.StoreId);
                return new PayOSClient(store.PayOSClientId.Trim(), store.PayOSApiKey.Trim(), store.PayOSChecksumKey.Trim());
            }

            _logger.LogInformation("Using default system PayOS credentials");
            return _defaultPayOS;
        }

        private string GetFrontendPublicUrl()
        {
            var url = _configuration["Frontend:PublicUrl"]?.TrimEnd('/');
            if (string.IsNullOrWhiteSpace(url))
            {
                throw new InvalidOperationException("Frontend:PublicUrl chưa được cấu hình.");
            }
            return url;
        }

        private void EnsureSafeCallbackUrl(string callbackUrl)
        {
            if (!Uri.TryCreate(callbackUrl, UriKind.Absolute, out var callback) ||
                callback.Scheme != Uri.UriSchemeHttps && callback.Scheme != Uri.UriSchemeHttp)
                throw new AppException("Callback URL thanh toán không hợp lệ.");

            var configuredBase = new Uri(GetFrontendPublicUrl());
            var allowed = string.Equals(callback.Host, configuredBase.Host, StringComparison.OrdinalIgnoreCase);
            var isDevelopment = string.Equals(Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT"), "Development", StringComparison.OrdinalIgnoreCase);
            if (!isDevelopment && callback.Scheme != Uri.UriSchemeHttps)
                throw new AppException("Production callback phải sử dụng HTTPS.");
            if (!allowed && !isDevelopment)
                throw new AppException("Callback URL phải thuộc frontend đã cấu hình.");
        }

        private static string? MaskSecretKey(string? secret)
        {
            if (string.IsNullOrWhiteSpace(secret)) return null;
            if (secret.Length <= 8) return "********";
            return $"***{secret.Substring(secret.Length - 4)}";
        }

        private static long GeneratePayOSOrderCode(int orderId)
        {
            // Sử dụng mili-giây và random jitter để không bao giờ bị trùng orderCode trên PayOS
            long ms = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() % 1000000000;
            int rand = Random.Shared.Next(10, 99);
            return (ms * 100) + rand;
        }

        /// <summary>
        /// Mô hình 1 (Anti-Spam & Pay-First):
        /// Chỉ khi khách thanh toán PayOS thành công:
        /// 1. Chuyển trạng thái đơn sang 'confirmed'
        /// 2. Tự động trừ kho nguyên vật liệu
        /// 3. Bắn SignalR chính thức thông báo đơn mới tới Bếp kèm chuông reo
        /// 4. Đổi trạng thái bàn sang bận (Occupied)
        /// 5. Báo khách hàng biết đơn đã được tiếp nhận
        /// </summary>
        private async Task ActivateOrderAfterPaymentAsync(Order order)
        {
            order.Status = OrderStatus.Confirmed;
            order.UpdatedAt = DateTime.UtcNow;

            // Xóa cache payment link khi đã thanh toán thành công

            // 1. Tự động trừ kho nguyên liệu
            try
            {
                await _inventoryService.DeductInventoryForOrderAsync(order.OrderId, null);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to deduct inventory for order {OrderId}", order.OrderId);
            }

            // 2. Tải chi tiết đơn để kích hoạt gửi sang Bếp chính thức (Mô hình 1: Pay-first)
            var fullOrder = await _db.Orders
                .Include(o => o.Store)
                .Include(o => o.Table)
                .Include(o => o.Customer)
                .Include(o => o.OrderItems).ThenInclude(oi => oi.MenuItem)
                .Include(o => o.OrderItems).ThenInclude(oi => oi.Size)
                .Include(o => o.OrderItems).ThenInclude(oi => oi.OrderItemToppings).ThenInclude(oit => oit.Topping)
                .FirstOrDefaultAsync(o => o.OrderId == order.OrderId);

            if (fullOrder != null)
            {
                var orderDto = new OrderDto
                {
                    OrderId = fullOrder.OrderId,
                    TenantId = fullOrder.TenantId,
                    StoreId = fullOrder.StoreId,
                    StoreName = fullOrder.Store?.Name ?? string.Empty,
                    OrderCode = fullOrder.OrderCode,
                    TableId = fullOrder.TableId,
                    TableNumber = fullOrder.Table?.TableNumber,
                    CustomerId = fullOrder.CustomerId,
                    CustomerName = fullOrder.Customer?.Name ?? fullOrder.GuestName,
                    CustomerPhone = fullOrder.Customer?.Phone ?? fullOrder.GuestPhone,
                    GuestId = fullOrder.GuestId,
                    GuestName = fullOrder.GuestName,
                    GuestPhone = fullOrder.GuestPhone,
                    Status = fullOrder.Status,
                    SubTotal = fullOrder.SubTotal,
                    DiscountAmount = fullOrder.DiscountAmount,
                    PointsUsed = fullOrder.PointsUsed,
                    PointsEarned = fullOrder.PointsEarned,
                    TotalAmount = fullOrder.TotalAmount,
                    Note = fullOrder.Note,
                    CreatedAt = DateTime.SpecifyKind(fullOrder.CreatedAt, DateTimeKind.Utc),
                    Items = fullOrder.OrderItems.Select(i => new OrderItemDto
                    {
                        OrderItemId = i.OrderItemId,
                        MenuItemId = i.MenuItemId,
                        MenuItemName = i.MenuItem?.Name ?? string.Empty,
                        ImageUrl = i.MenuItem?.ImageUrl,
                        SizeId = i.SizeId,
                        SizeName = i.Size?.Name,
                        Quantity = i.Quantity,
                        UnitPrice = i.UnitPrice,
                        ToppingTotal = i.ToppingTotal,
                        SubTotal = i.SubTotal,
                        SugarLevel = i.SugarLevel,
                        IceLevel = i.IceLevel,
                        Note = i.Note,
                        Toppings = i.OrderItemToppings.Select(t => new OrderItemToppingDto
                        {
                            OrderItemToppingId = t.OrderItemToppingId,
                            ToppingId = t.ToppingId,
                            ToppingName = t.Topping?.Name ?? string.Empty,
                            Price = t.Price
                        }).ToList()
                    }).ToList()
                };

                // Gửi SignalR thông báo đơn mới tới Bếp kèm chuông
                await _notificationService.NotifyNewOrderAsync(fullOrder.StoreId, orderDto);

                // Chuyển trạng thái bàn sang Occupied
                if (fullOrder.Table != null)
                {
                    fullOrder.Table.Status = TableStatuses.Occupied;
                    await _notificationService.NotifyTableStatusChangedAsync(fullOrder.StoreId, fullOrder.Table.TableId, TableStatuses.Occupied);
                }
            }

            // 3. Bắn SignalR realtime cho khách cập nhật trạng thái đã thanh toán
            await _notificationService.NotifyOrderStatusChangedAsync(
                order.StoreId,
                order.TableId,
                order.OrderId,
                OrderStatus.Confirmed,
                order.OrderCode
            );
        }
    }
}
