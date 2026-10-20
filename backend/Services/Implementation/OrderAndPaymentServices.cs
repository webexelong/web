using System.Data;
using System.Security.Cryptography;
using Microsoft.EntityFrameworkCore;
using WebCafe.Backend.Common.Constants;
using WebCafe.Backend.Common.Exceptions;
using WebCafe.Backend.Common.Models;
using WebCafe.Backend.Hubs;
using WebCafe.Backend.Infrastructure.Data;
using WebCafe.Backend.Models.DTOs.Analytics;
using WebCafe.Backend.Models.DTOs.Order;
using WebCafe.Backend.Models.DTOs.Payment;
using WebCafe.Backend.Models.DTOs.Voucher;
using WebCafe.Backend.Models.Entities;
using WebCafe.Backend.Services.Abstraction;

namespace WebCafe.Backend.Services.Implementation
{
    public class VoucherService : IVoucherService
    {
        private readonly WebCafeDbContext _db;

        public VoucherService(WebCafeDbContext db)
        {
            _db = db;
        }

        public async Task<VoucherValidationResult> ValidateVoucherAsync(CheckVoucherRequest request)
        {
            var code = request.Code.Trim().ToUpper();
            var store = await _db.Stores.FindAsync(request.StoreId);
            if (store == null) return new VoucherValidationResult { IsValid = false, Message = "Chi nhánh không hợp lệ." };

            var voucher = await _db.Vouchers
                .FirstOrDefaultAsync(v => v.TenantId == store.TenantId && v.Code == code && v.IsActive);

            if (voucher == null)
            {
                return new VoucherValidationResult { IsValid = false, Message = "Mã voucher không tồn tại." };
            }

            var now = DateTime.UtcNow;
            if (now < voucher.StartDate || now > voucher.EndDate)
            {
                return new VoucherValidationResult { IsValid = false, Message = "Mã voucher đã hết hạn hoặc chưa đến ngày áp dụng." };
            }

            if (voucher.StoreId.HasValue && voucher.StoreId.Value != request.StoreId)
            {
                return new VoucherValidationResult { IsValid = false, Message = "Voucher không áp dụng cho chi nhánh này." };
            }

            if (voucher.MaxUsageTotal.HasValue && voucher.UsedCount >= voucher.MaxUsageTotal.Value)
            {
                return new VoucherValidationResult { IsValid = false, Message = "Mã voucher đã hết lượt sử dụng." };
            }

            if (request.OrderAmount < voucher.MinOrderAmount)
            {
                return new VoucherValidationResult
                {
                    IsValid = false,
                    Message = $"Đơn hàng tối thiểu phải từ {voucher.MinOrderAmount:N0}đ để áp dụng voucher này."
                };
            }

            decimal discount = 0;
            if (voucher.DiscountType == DiscountTypes.Percent)
            {
                discount = (request.OrderAmount * voucher.DiscountValue) / 100m;
                if (voucher.MaxDiscount.HasValue && discount > voucher.MaxDiscount.Value)
                {
                    discount = voucher.MaxDiscount.Value;
                }
            }
            else
            {
                discount = voucher.DiscountValue;
            }

            if (discount > request.OrderAmount) discount = request.OrderAmount;

            return new VoucherValidationResult
            {
                IsValid = true,
                Message = "Áp dụng voucher thành công!",
                VoucherId = voucher.VoucherId,
                Code = voucher.Code,
                Title = voucher.Title,
                DiscountType = voucher.DiscountType,
                DiscountAmount = discount,
                FinalAmount = request.OrderAmount - discount
            };
        }

        public async Task<List<VoucherDto>> GetActiveVouchersAsync(int tenantId, int? storeId)
        {
            var now = DateTime.UtcNow;
            return await _db.Vouchers
                .Where(v => v.TenantId == tenantId && v.IsActive && v.StartDate <= now && v.EndDate >= now
                            && (!v.StoreId.HasValue || (storeId.HasValue && v.StoreId == storeId.Value)))
                .Select(v => new VoucherDto
                {
                    VoucherId = v.VoucherId,
                    Code = v.Code,
                    Title = v.Title,
                    Description = v.Description,
                    DiscountType = v.DiscountType,
                    DiscountValue = v.DiscountValue,
                    MaxDiscount = v.MaxDiscount,
                    MinOrderAmount = v.MinOrderAmount,
                    EndDate = v.EndDate
                })
                .ToListAsync();
        }
    }

    public class OrderService : IOrderService
    {
        private readonly WebCafeDbContext _db;
        private readonly IVoucherService _voucherService;
        private readonly IOrderNotificationService _notificationService;
        private readonly IInventoryService _inventoryService;

        public OrderService(
            WebCafeDbContext db, 
            IVoucherService voucherService, 
            IOrderNotificationService notificationService,
            IInventoryService inventoryService)
        {
            _db = db;
            _voucherService = voucherService;
            _notificationService = notificationService;
            _inventoryService = inventoryService;
        }

        public async Task<OrderDto> CreateOrderAsync(CreateOrderDto dto, int? authenticatedCustomerId = null)
        {
            if (dto.Items == null || !dto.Items.Any())
            {
                throw new ModelValidationException("Items", "Đơn hàng phải có ít nhất 1 món.");
            }

            var store = await _db.Stores
                .Include(s => s.Tenant)
                .FirstOrDefaultAsync(s => s.StoreId == dto.StoreId && s.IsActive);

            if (store == null || store.Tenant == null)
            {
                throw new NotFoundException("Chi nhánh không tồn tại.");
            }

            // 1. Kiểm tra Bàn
            Table? table = null;
            bool isQrOrder = string.Equals(dto.Source, "qr_table", StringComparison.OrdinalIgnoreCase);

            if (isQrOrder && (!dto.TableId.HasValue || dto.TableId.Value <= 0))
            {
                throw new ModelValidationException("TableId", "Đơn hàng gọi món tại bàn (QR) bắt buộc phải có thông tin bàn hợp lệ.");
            }

            if (dto.TableId.HasValue && dto.TableId.Value > 0)
            {
                table = await _db.Tables.FirstOrDefaultAsync(t => t.TableId == dto.TableId.Value && t.StoreId == dto.StoreId && t.IsActive);
                if (table == null)
                {
                    throw new NotFoundException("Bàn không tồn tại, đã ngưng hoạt động hoặc không thuộc chi nhánh này.");
                }
            }

            if (isQrOrder)
            {
                if (table == null || string.IsNullOrWhiteSpace(dto.TableToken) ||
                    !string.Equals(table.QrToken, dto.TableToken, StringComparison.Ordinal))
                    throw new AppException("Mã QR bàn không hợp lệ hoặc đã hết hiệu lực. Vui lòng quét lại mã QR.");
            }

            var isCustomerCashOrder = isQrOrder && string.Equals(dto.PaymentMethod, PaymentMethods.Cash, StringComparison.OrdinalIgnoreCase);
            if (isCustomerCashOrder && table != null)
            {
                var expireBefore = DateTime.UtcNow.AddMinutes(-10);
                var staleOrders = await _db.Orders.Where(o => o.StoreId == store.StoreId &&
                    o.Status == OrderStatus.Pending && o.CreatedAt < expireBefore).ToListAsync();
                foreach (var stale in staleOrders) stale.Status = OrderStatus.Expired;

                var pendingCashCount = await _db.Orders.CountAsync(o => o.StoreId == store.StoreId &&
                    o.TableId == table.TableId && o.Status == OrderStatus.Pending && o.CreatedAt >= expireBefore);
                if (pendingCashCount >= 3)
                    throw new AppException("Bàn đã có 3 đơn tiền mặt đang chờ xác nhận. Vui lòng chờ nhân viên xử lý.");
            }

            if (dto.Items.Sum(i => i.Quantity) > 30)
                throw new ModelValidationException("Items", "Mỗi đơn chỉ được tối đa 30 phần.");

            // 2. Xử lý Khách hàng & Điểm thưởng (Multi-Tenant SaaS Customer Support)
            Customer? customer = null;
            string? lookupPhone = null;

            if (authenticatedCustomerId.HasValue)
            {
                var authCustomer = await _db.Customers.FirstOrDefaultAsync(c => c.CustomerId == authenticatedCustomerId.Value);
                lookupPhone = authCustomer?.Phone ?? dto.CustomerPhone;
            }
            else if (!string.IsNullOrWhiteSpace(dto.CustomerPhone))
            {
                lookupPhone = dto.CustomerPhone.Trim().Replace(" ", "");
            }

            if (!string.IsNullOrWhiteSpace(lookupPhone))
            {
                customer = await _db.Customers.FirstOrDefaultAsync(c => c.Phone == lookupPhone && c.TenantId == store.TenantId);
                if (customer == null)
                {
                    // Tự động kích hoạt hồ sơ hội viên cho quán mới mà không cần tạo tài khoản riêng
                    customer = new Customer
                    {
                        TenantId = store.TenantId,
                        Phone = lookupPhone,
                        Name = !string.IsNullOrWhiteSpace(dto.CustomerName) ? dto.CustomerName.Trim() : (dto.GuestName ?? "Khách hàng"),
                        TotalPoints = 0,
                        TotalSpent = 0,
                        VisitCount = 1,
                        CreatedAt = DateTime.UtcNow,
                        LastVisitAt = DateTime.UtcNow
                    };
                    _db.Customers.Add(customer);
                    await _db.SaveChangesAsync();
                }
                else
                {
                    if (!string.IsNullOrWhiteSpace(dto.CustomerName))
                    {
                        customer.Name = dto.CustomerName.Trim();
                    }
                    customer.VisitCount += 1;
                    customer.LastVisitAt = DateTime.UtcNow;
                }
            }

            if (dto.PointsToUse > 0 && customer == null)
                throw new ForbiddenException("Đăng nhập tài khoản khách hàng để sử dụng điểm.");

            // 3. Tính toán tiền các Items
            decimal subTotal = 0;
            var orderItems = new List<OrderItem>();

            foreach (var itemDto in dto.Items)
            {
                var menuItem = await _db.MenuItems
                    .Include(m => m.MenuItemSizes)
                    .Include(m => m.MenuItemToppings).ThenInclude(mt => mt.Topping)
                    .FirstOrDefaultAsync(m => m.MenuItemId == itemDto.MenuItemId && m.TenantId == store.TenantId);

                if (menuItem == null) throw new NotFoundException($"Không tìm thấy món với ID {itemDto.MenuItemId}.");

                decimal unitPrice = menuItem.BasePrice;
                if (itemDto.SizeId.HasValue)
                {
                    var sizeOption = menuItem.MenuItemSizes.FirstOrDefault(s => s.SizeId == itemDto.SizeId.Value);
                    if (sizeOption != null)
                    {
                        unitPrice += sizeOption.ExtraPrice;
                    }
                }

                decimal toppingTotal = 0;
                var itemToppings = new List<OrderItemTopping>();
                if (itemDto.Toppings != null && itemDto.Toppings.Any())
                {
                    foreach (var t in itemDto.Toppings)
                    {
                        var topping = await _db.Toppings.FirstOrDefaultAsync(x => x.ToppingId == t.ToppingId && x.TenantId == store.TenantId);
                        if (topping != null && topping.IsAvailable)
                        {
                            toppingTotal += topping.Price;
                            itemToppings.Add(new OrderItemTopping
                            {
                                ToppingId = topping.ToppingId,
                                Price = topping.Price
                            });
                        }
                    }
                }

                decimal itemSubTotal = (unitPrice + toppingTotal) * itemDto.Quantity;
                subTotal += itemSubTotal;

                orderItems.Add(new OrderItem
                {
                    MenuItemId = menuItem.MenuItemId,
                    SizeId = itemDto.SizeId,
                    Quantity = itemDto.Quantity,
                    UnitPrice = unitPrice,
                    ToppingTotal = toppingTotal,
                    SubTotal = itemSubTotal,
                    SugarLevel = itemDto.SugarLevel,
                    IceLevel = itemDto.IceLevel,
                    Note = itemDto.Note,
                    OrderItemToppings = itemToppings
                });
            }

            // 4. Áp dụng Voucher
            decimal discountAmount = 0;
            Voucher? appliedVoucher = null;
            if (!string.IsNullOrWhiteSpace(dto.VoucherCode))
            {
                var vResult = await _voucherService.ValidateVoucherAsync(new CheckVoucherRequest
                {
                    Code = dto.VoucherCode,
                    StoreId = dto.StoreId,
                    OrderAmount = subTotal,
                    CustomerPhone = dto.CustomerPhone
                });

                if (vResult.IsValid && vResult.VoucherId.HasValue)
                {
                    discountAmount = vResult.DiscountAmount;
                    appliedVoucher = await _db.Vouchers.FindAsync(vResult.VoucherId.Value);
                }
            }

            // 5. Tính giảm giá theo điểm tích lũy
            int pointsUsed = 0;
            decimal pointsDiscount = 0;
            if (customer != null && dto.PointsToUse > 0 && customer.TotalPoints >= dto.PointsToUse)
            {
                pointsUsed = dto.PointsToUse;
                pointsDiscount = pointsUsed * store.Tenant.PointsToMoney;
            }

            decimal totalDiscount = discountAmount + pointsDiscount;
            if (totalDiscount > subTotal) totalDiscount = subTotal;
            decimal totalAmount = subTotal - totalDiscount;

            if (isCustomerCashOrder && !string.IsNullOrWhiteSpace(dto.GuestId))
            {
                var recentGuestOrder = await _db.Orders.AnyAsync(o => o.StoreId == store.StoreId &&
                    o.GuestId == dto.GuestId && o.CreatedAt >= DateTime.UtcNow.AddSeconds(-30) &&
                    o.Status != OrderStatus.Cancelled && o.Status != OrderStatus.Expired);
                if (recentGuestOrder)
                    throw new AppException("Bạn vừa gửi một đơn. Vui lòng chờ 30 giây trước khi gửi tiếp.");
            }
            if (isCustomerCashOrder && totalAmount > 2000000m)
                throw new AppException("Đơn tiền mặt chưa xác nhận không được vượt quá 2.000.000đ.");

            // 6. Tính điểm tích lũy sau đơn
            int pointsEarned = 0;
            if (store.Tenant.PointsPerAmount > 0)
            {
                pointsEarned = (int)(totalAmount / store.Tenant.PointsPerAmount);
            }

            var orderCode = $"OD-{DateTime.UtcNow:yyMMdd}-{Random.Shared.Next(1000, 9999)}";

            bool isPosStaffOrder = dto.Source == "pos_staff";
            if (isPosStaffOrder && dto.PaymentMethod != "cash" && dto.PaymentMethod != PaymentMethods.Cash &&
                dto.PaymentMethod != "payos" && dto.PaymentMethod != PaymentMethods.PayOS)
                throw new AppException("Phương thức thanh toán tại quầy không hợp lệ.");
            bool isCashPos = isPosStaffOrder && (dto.PaymentMethod == "cash" || dto.PaymentMethod == PaymentMethods.Cash);
            bool isPayOSPos = isPosStaffOrder && (dto.PaymentMethod == "payos" || dto.PaymentMethod == PaymentMethods.PayOS);

            string initialStatus = isCashPos 
                ? OrderStatus.Paid 
                : (isPayOSPos ? OrderStatus.AwaitingPayment : (isCustomerCashOrder ? OrderStatus.Pending : (!isPosStaffOrder ? OrderStatus.AwaitingPayment : OrderStatus.Pending)));

            var order = new Order
            {
                TenantId = store.TenantId,
                StoreId = store.StoreId,
                OrderCode = orderCode,
                TableId = table?.TableId,
                CustomerId = customer?.CustomerId,
                
                // Guest Order Support
                GuestId = dto.GuestId,
                PaymentAccessToken = Convert.ToHexString(RandomNumberGenerator.GetBytes(32)).ToLowerInvariant(),
                GuestName = dto.GuestName ?? dto.CustomerName,
                GuestPhone = dto.GuestPhone ?? dto.CustomerPhone,
                
                Status = initialStatus,
                SubTotal = subTotal,
                DiscountAmount = totalDiscount,
                PointsUsed = pointsUsed,
                PointsEarned = pointsEarned,
                AppliedVoucherId = appliedVoucher?.VoucherId,
                TotalAmount = totalAmount,
                Note = dto.Note,
                CreatedAt = DateTime.UtcNow,
                OrderItems = orderItems
            };

            _db.Orders.Add(order);
            await _db.SaveChangesAsync();

            // Nếu là đơn tiền mặt tại quầy (isCashPos): tạo Payment Cash + trừ kho
            if (isCashPos)
            {
                var payment = new Payment
                {
                    OrderId = order.OrderId,
                    Method = PaymentMethods.Cash,
                    Amount = order.TotalAmount,
                    Status = PaymentStatuses.Completed,
                    PaidAt = DateTime.UtcNow,
                    CreatedAt = DateTime.UtcNow
                };
                _db.Payments.Add(payment);
                await _db.SaveChangesAsync();

                try
                {
                    await _inventoryService.DeductInventoryForOrderAsync(order.OrderId, null);
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"Warning: Deduct inventory failed for cash POS order {order.OrderCode}: {ex.Message}");
                }
                await ApplyPostPaymentBenefitsAsync(order.OrderId);
            }

            var resultDto = (await GetByIdAsync(order.OrderId))!;

            // Mô hình A tại quầy:
            // 1. Đơn tiền mặt (isCashPos) hoặc đơn POS thông thường: Báo Bếp ngay và chiếm bàn
            // 2. Đơn PayOS (isPayOSPos hoặc qr_table): Đơn ở awaiting_payment, chỉ kích hoạt sang Bếp khi khách quét PayOS xong
            if (isCashPos || isCustomerCashOrder || (isPosStaffOrder && !isPayOSPos))
            {
                await _notificationService.NotifyNewOrderAsync(store.StoreId, resultDto);
                if (table != null && !isCustomerCashOrder)
                {
                    table.Status = TableStatuses.Occupied;
                    await _notificationService.NotifyTableStatusChangedAsync(store.StoreId, table.TableId, TableStatuses.Occupied);
                }
            }

            // This capability is returned only by the create-order endpoint.
            resultDto.PaymentAccessToken = order.PaymentAccessToken;

            return resultDto;
        }

        public async Task ApplyPostPaymentBenefitsAsync(int orderId)
        {
            await using var transaction = await _db.Database.BeginTransactionAsync(IsolationLevel.Serializable);
            var order = await _db.Orders
                .Include(o => o.Customer)
                .Include(o => o.Tenant)
                .FirstOrDefaultAsync(o => o.OrderId == orderId);

            if (order == null) throw new NotFoundException("Không tìm thấy đơn hàng.");

            // Idempotency: post-payment effects must only be applied once.
            if (order.PaymentActivatedAt.HasValue)
            {
                return;
            }

            if (order.Customer != null && order.PointsUsed > 0)
            {
                if (order.Customer.TotalPoints < order.PointsUsed)
                    throw new AppException("Số điểm hiện tại không đủ để hoàn tất đơn hàng.");

                order.Customer.TotalPoints -= order.PointsUsed;
                _db.LoyaltyPoints.Add(new LoyaltyPoint
                {
                    CustomerId = order.Customer.CustomerId,
                    OrderId = order.OrderId,
                    Points = -order.PointsUsed,
                    Type = "redeem",
                    Description = "Sử dụng điểm giảm giá đơn hàng"
                });
            }

            if (order.Customer != null)
            {
                order.Customer.TotalSpent += order.TotalAmount;
                order.Customer.VisitCount += 1;
                order.Customer.LastVisitAt = DateTime.UtcNow;
                if (order.PointsEarned > 0)
                {
                    order.Customer.TotalPoints += order.PointsEarned;
                    _db.LoyaltyPoints.Add(new LoyaltyPoint
                    {
                        CustomerId = order.Customer.CustomerId,
                        OrderId = order.OrderId,
                        Points = order.PointsEarned,
                        Type = "earn",
                        Description = "Tích điểm từ đơn hàng đã thanh toán"
                    });
                }
            }

            if (order.AppliedVoucherId.HasValue)
            {
                var voucher = await _db.Vouchers.FirstOrDefaultAsync(v => v.VoucherId == order.AppliedVoucherId.Value);
                var alreadyUsed = await _db.VoucherUsages.AnyAsync(vu => vu.OrderId == order.OrderId);
                if (voucher != null && !alreadyUsed)
                {
                    voucher.UsedCount += 1;
                    _db.VoucherUsages.Add(new VoucherUsage
                    {
                        VoucherId = voucher.VoucherId,
                        CustomerId = order.CustomerId,
                        OrderId = order.OrderId,
                        DiscountAmount = Math.Max(0, order.DiscountAmount - (order.PointsUsed * (order.Tenant?.PointsToMoney ?? 0))),
                        UsedAt = DateTime.UtcNow
                    });
                }
            }

            order.PaymentActivatedAt = DateTime.UtcNow;

            await _db.SaveChangesAsync();
            await transaction.CommitAsync();
        }

        public async Task<OrderDto?> GetByIdAsync(int orderId)
        {
            var o = await _db.Orders
                .Include(o => o.Store)
                .Include(o => o.Table)
                .Include(o => o.Customer)
                .Include(o => o.OrderItems).ThenInclude(oi => oi.MenuItem)
                .Include(o => o.OrderItems).ThenInclude(oi => oi.Size)
                .Include(o => o.OrderItems).ThenInclude(oi => oi.OrderItemToppings).ThenInclude(oit => oit.Topping)
                .FirstOrDefaultAsync(o => o.OrderId == orderId);

            if (o == null) return null;
            return MapToDto(o);
        }

        public async Task<OrderDto?> GetByCodeAsync(string orderCode)
        {
            var o = await _db.Orders
                .Include(o => o.Store)
                .Include(o => o.Table)
                .Include(o => o.Customer)
                .Include(o => o.OrderItems).ThenInclude(oi => oi.MenuItem)
                .Include(o => o.OrderItems).ThenInclude(oi => oi.Size)
                .Include(o => o.OrderItems).ThenInclude(oi => oi.OrderItemToppings).ThenInclude(oit => oit.Topping)
                .FirstOrDefaultAsync(o => o.OrderCode == orderCode);

            if (o == null) return null;
            return MapToDto(o);
        }

        public async Task<List<OrderDto>> GetActiveOrdersByStoreAsync(int storeId)
        {
            var expireBefore = DateTime.UtcNow.AddMinutes(-10);
            var staleOrders = await _db.Orders
                .Where(o => o.StoreId == storeId && o.Status == OrderStatus.Pending && o.CreatedAt < expireBefore)
                .ToListAsync();
            if (staleOrders.Count > 0)
            {
                foreach (var stale in staleOrders) stale.Status = OrderStatus.Expired;
                await _db.SaveChangesAsync();
            }
            var today = DateTime.UtcNow.Date;
            var activeStatuses = new[] { OrderStatus.Pending, OrderStatus.Confirmed, OrderStatus.Preparing, OrderStatus.Ready, OrderStatus.Served };
            var orders = await _db.Orders
                .AsSplitQuery()
                .Where(o => o.StoreId == storeId && (activeStatuses.Contains(o.Status) || ((o.Status == OrderStatus.Paid || o.Status == OrderStatus.Completed) && o.CreatedAt >= today)))
                .Include(o => o.Store)
                .Include(o => o.Table)
                .Include(o => o.Customer)
                .Include(o => o.OrderItems).ThenInclude(oi => oi.MenuItem)
                .Include(o => o.OrderItems).ThenInclude(oi => oi.Size)
                .Include(o => o.OrderItems).ThenInclude(oi => oi.OrderItemToppings).ThenInclude(oit => oit.Topping)
                .OrderByDescending(o => o.CreatedAt)
                .ToListAsync();

            return orders.DistinctBy(o => o.OrderId).Select(MapToDto).ToList();
        }

        public async Task<PaginationRes<OrderDto>> SearchOrdersAsync(int storeId, PagedReq req, string? status = null)
        {
            var query = _db.Orders
                .Where(o => o.StoreId == storeId)
                .Include(o => o.Store)
                .Include(o => o.Table)
                .Include(o => o.Customer)
                .Include(o => o.OrderItems).ThenInclude(oi => oi.MenuItem)
                .Include(o => o.OrderItems).ThenInclude(oi => oi.Size)
                .Include(o => o.OrderItems).ThenInclude(oi => oi.OrderItemToppings).ThenInclude(oit => oit.Topping)
                .AsQueryable();

            if (!string.IsNullOrWhiteSpace(status))
            {
                query = query.Where(o => o.Status == status);
            }

            if (!string.IsNullOrWhiteSpace(req.Search))
            {
                var s = req.Search.Trim();
                query = query.Where(o => o.OrderCode.Contains(s) || (o.Customer != null && o.Customer.Phone.Contains(s)));
            }

            var total = await query.CountAsync();
            var items = await query
                .OrderByDescending(o => o.CreatedAt)
                .Skip((req.PageNumber - 1) * req.PageSize)
                .Take(req.PageSize)
                .ToListAsync();

            return new PaginationRes<OrderDto>(items.Select(MapToDto).ToList(), req.PageNumber, req.PageSize, total);
        }

        public async Task<OrderDto> UpdateStatusAsync(int orderId, string newStatus, int? staffId = null)
        {
            var order = await _db.Orders.Include(o => o.Table).FirstOrDefaultAsync(o => o.OrderId == orderId);
            if (order == null) throw new NotFoundException("Không tìm thấy đơn hàng.");

            if (!IsAllowedTransition(order.Status, newStatus))
            {
                throw new AppException($"Không thể chuyển trạng thái đơn từ '{order.Status}' sang '{newStatus}'.");
            }

            if (newStatus == OrderStatus.Confirmed && order.Status == OrderStatus.AwaitingPayment)
            {
                var hasCompletedPayment = await _db.Payments.AnyAsync(p => p.OrderId == orderId && p.Status == PaymentStatuses.Completed);
                if (!hasCompletedPayment)
                    throw new AppException("Không thể xác nhận đơn chuyển khoản khi chưa có giao dịch thành công.");
            }

            // Staff may mark a cash order as paid after serving it. PayOS orders
            // already have a completed payment and will not create a duplicate.
            if (newStatus == OrderStatus.Paid)
            {
                var hasCompletedPayment = await _db.Payments.AnyAsync(p => p.OrderId == orderId && p.Status == PaymentStatuses.Completed);
                if (!hasCompletedPayment)
                {
                    _db.Payments.Add(new Payment
                    {
                        OrderId = orderId,
                        Method = PaymentMethods.Cash,
                        Amount = order.TotalAmount,
                        Status = PaymentStatuses.Completed,
                        PaidAt = DateTime.UtcNow,
                        ProcessedByStaffId = staffId,
                        CreatedAt = DateTime.UtcNow
                    });
                }
            }

            order.Status = newStatus;
            order.UpdatedAt = DateTime.UtcNow;
            if (staffId.HasValue) order.StaffId = staffId.Value;

            if ((newStatus == OrderStatus.Confirmed || newStatus == OrderStatus.Preparing) && order.Table != null)
            {
                order.Table.Status = TableStatuses.Occupied;
                await _notificationService.NotifyTableStatusChangedAsync(order.StoreId, order.Table.TableId, TableStatuses.Occupied);
            }

            // Nếu đơn đã phục vụ, thanh toán, hoàn thành hoặc hủy: giải phóng bàn
            if (newStatus == OrderStatus.Paid || newStatus == OrderStatus.Served || newStatus == "completed" || newStatus == OrderStatus.Cancelled)
            {
                if (order.Table != null)
                {
                    order.Table.Status = TableStatuses.Available;
                    await _notificationService.NotifyTableStatusChangedAsync(order.StoreId, order.Table.TableId, TableStatuses.Available);
                }

            }

            // Tự động trừ kho theo BOM khi hoàn thành pha chế (ready), phục vụ (served) hoặc thanh toán (paid/completed)
            // (hàm DeductInventoryForOrderAsync đã có kiểm tra idempotent, không trừ trùng lặp)
            if (newStatus == OrderStatus.Ready || newStatus == OrderStatus.Served || newStatus == OrderStatus.Paid || newStatus == "completed")
            {
                try
                {
                    await _inventoryService.DeductInventoryForOrderAsync(order.OrderId, staffId);
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"[Inventory Error] Không thể tự động trừ kho cho đơn hàng {order.OrderCode}: {ex.Message}");
                }
            }

            await _db.SaveChangesAsync();

            await _notificationService.NotifyOrderStatusChangedAsync(order.StoreId, order.TableId, order.OrderId, newStatus, order.OrderCode);

            return (await GetByIdAsync(order.OrderId))!;
        }

        private static bool IsAllowedTransition(string current, string next)
        {
            if (string.Equals(current, next, StringComparison.OrdinalIgnoreCase)) return true;
            return current switch
            {
                OrderStatus.AwaitingPayment => next is OrderStatus.Confirmed or OrderStatus.Paid or OrderStatus.Cancelled,
                OrderStatus.Pending => next is OrderStatus.Confirmed or OrderStatus.Cancelled or OrderStatus.Paid,
                OrderStatus.Confirmed => next is OrderStatus.Preparing or OrderStatus.Cancelled or OrderStatus.Paid,
                OrderStatus.Preparing => next is OrderStatus.Ready or OrderStatus.Cancelled,
                OrderStatus.Ready => next is OrderStatus.Served or OrderStatus.Cancelled,
                OrderStatus.Served => next is OrderStatus.Paid or OrderStatus.Completed,
                OrderStatus.Paid => next == OrderStatus.Completed,
                _ => false
            };
        }

        private static OrderDto MapToDto(Order o)
        {
            return new OrderDto
            {
                OrderId = o.OrderId,
                TenantId = o.TenantId,
                TenantName = o.Tenant?.Name ?? o.Store?.Tenant?.Name ?? string.Empty,
                StoreId = o.StoreId,
                StoreName = o.Store?.Name ?? string.Empty,
                OrderCode = o.OrderCode,
                TableId = o.TableId,
                TableNumber = o.Table?.TableNumber,
                CustomerId = o.CustomerId,
                CustomerName = o.Customer?.Name,
                CustomerPhone = o.Customer?.Phone,
                
                // Guest Order Fields
                GuestId = o.GuestId,
                PaymentAccessToken = null,
                GuestName = o.GuestName,
                GuestPhone = o.GuestPhone,
                
                Status = o.Status,
                SubTotal = o.SubTotal,
                DiscountAmount = o.DiscountAmount,
                PointsUsed = o.PointsUsed,
                PointsEarned = o.PointsEarned,
                TotalAmount = o.TotalAmount,
                Note = o.Note,
                CreatedAt = DateTime.SpecifyKind(o.CreatedAt, DateTimeKind.Utc),
                Items = o.OrderItems.Select(i => new OrderItemDto
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
        }
    }

    public class PaymentService : IPaymentService
    {
        private readonly WebCafeDbContext _db;
        private readonly IOrderService _orderService;
        private readonly IInventoryService _inventoryService;

        public PaymentService(WebCafeDbContext db, IOrderService orderService, IInventoryService inventoryService)
        {
            _db = db;
            _orderService = orderService;
            _inventoryService = inventoryService;
        }

        public async Task<PaymentResultDto> ProcessPaymentAsync(CreatePaymentDto dto, int? staffId = null)
        {
            if (!string.Equals(dto.Method, PaymentMethods.Cash, StringComparison.OrdinalIgnoreCase))
                throw new AppException("Thanh toán thủ công chỉ hỗ trợ tiền mặt; PayOS/VietQR phải được xác nhận qua webhook.");

            var order = await _db.Orders
                .Include(o => o.Store)
                .FirstOrDefaultAsync(o => o.OrderId == dto.OrderId);

            if (order == null) throw new NotFoundException("Không tìm thấy đơn hàng.");

            if (dto.Amount != order.TotalAmount)
                throw new AppException("Số tiền thanh toán không khớp với đơn hàng.");

            var transactionRef = dto.TransactionRef ?? $"TXN-{DateTime.UtcNow:yyMMddHHmmss}-{Guid.NewGuid():N}";
            var existingPayment = await _db.Payments.FirstOrDefaultAsync(p => p.TransactionRef == transactionRef);
            if (existingPayment != null)
            {
                if (existingPayment.OrderId != order.OrderId)
                    throw new AppException("Mã giao dịch đã được sử dụng cho đơn hàng khác.");
                if (existingPayment.Status != PaymentStatuses.Completed || existingPayment.Method != PaymentMethods.Cash)
                    throw new AppException("Mã giao dịch đã được sử dụng cho một giao dịch khác.");
                return new PaymentResultDto
                {
                    PaymentId = existingPayment.PaymentId,
                    OrderId = existingPayment.OrderId,
                    Method = existingPayment.Method,
                    Amount = existingPayment.Amount,
                    Status = existingPayment.Status,
                    QrCodeUrl = null
                };
            }

            if (await _db.Payments.AnyAsync(p => p.OrderId == order.OrderId && p.Status == PaymentStatuses.Completed))
                throw new AppException("Đơn hàng đã có giao dịch thanh toán thành công.");
            if (order.Status is not (OrderStatus.AwaitingPayment or OrderStatus.Pending or OrderStatus.Confirmed or OrderStatus.Served))
                throw new AppException($"Không thể thu tiền mặt cho đơn ở trạng thái '{order.Status}'.");

            var payment = new Payment
            {
                OrderId = order.OrderId,
                Method = dto.Method,
                Amount = order.TotalAmount,
                TransactionRef = transactionRef,
                Status = PaymentStatuses.Completed,
                PaidAt = DateTime.UtcNow,
                ProcessedByStaffId = staffId,
                CreatedAt = DateTime.UtcNow
            };

            _db.Payments.Add(payment);
            await _db.SaveChangesAsync();

            // Cập nhật trạng thái đơn sang Paid
            await _orderService.UpdateStatusAsync(order.OrderId, OrderStatus.Paid, staffId);

            // TỰ ĐỘNG TRỪ KHO KHI THANH TOÁN THÀNH CÔNG
            try
            {
                await _inventoryService.DeductInventoryForOrderAsync(order.OrderId, staffId);
            }
            catch (Exception ex)
            {
                // Log lỗi nhưng không block thanh toán
                // Có thể gửi notification để staff xử lý thủ công
                Console.WriteLine($"Warning: Failed to deduct inventory for order {order.OrderCode}: {ex.Message}");
            }

            await _orderService.ApplyPostPaymentBenefitsAsync(order.OrderId);

            string? qrUrl = null;
            if (dto.Method == PaymentMethods.VietQR && order.Store != null)
            {
                qrUrl = $"https://img.vietqr.io/image/{order.Store.BankName}-{order.Store.BankAccount}-compact2.png?amount={order.TotalAmount}&addInfo={order.OrderCode}&accountName={Uri.EscapeDataString(order.Store.BankAccountName ?? "WebCafe")}";
            }

            return new PaymentResultDto
            {
                PaymentId = payment.PaymentId,
                OrderId = order.OrderId,
                Method = payment.Method,
                Amount = payment.Amount,
                Status = payment.Status,
                QrCodeUrl = qrUrl
            };
        }
    }

    public class AnalyticsService : IAnalyticsService
    {
        private readonly WebCafeDbContext _db;

        public AnalyticsService(WebCafeDbContext db)
        {
            _db = db;
        }

        public async Task<ShiftOperationsDto> GetShiftOperationsAsync(int storeId)
        {
            var store = await _db.Stores.FirstOrDefaultAsync(s => s.StoreId == storeId);
            var storeName = store?.Name ?? "Chi Nhánh";
            var now = DateTime.UtcNow;
            var today = now.Date;
            var yesterday = today.AddDays(-1);

            // Today's orders
            var todayAllOrders = await _db.Orders
                .Include(o => o.Table)
                .Include(o => o.Payments)
                .Include(o => o.OrderItems)
                    .ThenInclude(oi => oi.MenuItem)
                .Where(o => o.StoreId == storeId && o.CreatedAt >= today)
                .ToListAsync();

            var todayPaidOrders = todayAllOrders
                .Where(o => o.Status == OrderStatus.Paid || o.Payments.Any(p => p.Status == PaymentStatuses.Completed))
                .ToList();
            var todayRevenue = todayPaidOrders.Sum(o => o.TotalAmount);

            // Yesterday revenue until the same time of day
            var yesterdayTimeLimit = yesterday.Add(now.TimeOfDay);
            var yesterdayPaidOrders = await _db.Orders
                .Include(o => o.Payments)
                .Where(o => o.StoreId == storeId && o.CreatedAt >= yesterday && o.CreatedAt <= yesterdayTimeLimit && 
                    (o.Status == OrderStatus.Paid || o.Payments.Any(p => p.Status == PaymentStatuses.Completed)))
                .ToListAsync();
            var yesterdayRevenue = yesterdayPaidOrders.Sum(o => o.TotalAmount);

            double revenueGrowth = 0;
            if (yesterdayRevenue > 0)
            {
                revenueGrowth = Math.Round((double)((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100, 1);
            }
            else if (todayRevenue > 0)
            {
                revenueGrowth = 100;
            }

            // Payment method breakdown in shift
            var todayPaidOrderIds = todayPaidOrders.Select(o => o.OrderId).ToList();
            var todayPayments = await _db.Payments
                .Where(p => todayPaidOrderIds.Contains(p.OrderId) && p.Status == PaymentStatuses.Completed)
                .ToListAsync();

            var cashRevenue = todayPayments.Where(p => p.Method == PaymentMethods.Cash).Sum(p => p.Amount);
            var bankTransferRevenue = todayPayments.Where(p => p.Method != PaymentMethods.Cash).Sum(p => p.Amount);
            // Queue stats
            var pendingCount = todayAllOrders.Count(o => o.Status == OrderStatus.Pending || o.Status == OrderStatus.Confirmed);
            var preparingCount = todayAllOrders.Count(o => o.Status == OrderStatus.Preparing);
            var readyCount = todayAllOrders.Count(o => o.Status == OrderStatus.Ready);
            var servedCount = todayAllOrders.Count(o => o.Status == OrderStatus.Served || o.Status == OrderStatus.Paid);

            // Table status & Live floor map
            var tables = await _db.Tables.Where(t => t.StoreId == storeId && t.IsActive).OrderBy(t => t.TableNumber).ToListAsync();
            var totalTables = tables.Count;
            var activeTablesList = new List<ActiveTableStatusDto>();

            // Active orders that are occupying tables
            var activeOrders = todayAllOrders.Where(o => o.Status != OrderStatus.Paid && o.Status != OrderStatus.Cancelled).ToList();

            foreach (var t in tables)
            {
                var tableOrder = activeOrders.FirstOrDefault(o => o.TableId == t.TableId || (o.Table != null && o.Table.TableNumber == t.TableNumber));
                // A table is occupied on the dashboard only while it has an active
                // order. This prevents a stale Table.Status value from showing a
                // new store as occupied before it has served anyone.
                var isOccupied = tableOrder != null;
                var minutes = 0;
                if (tableOrder != null)
                {
                    minutes = (int)(now - tableOrder.CreatedAt).TotalMinutes;
                }

                activeTablesList.Add(new ActiveTableStatusDto
                {
                    TableId = t.TableId,
                    TableNumber = t.TableNumber,
                    Capacity = t.Capacity,
                    Status = isOccupied ? "Occupied" : (t.Status == TableStatuses.Reserved ? "Reserved" : "Available"),
                    ActiveOrderId = tableOrder?.OrderId,
                    ActiveOrderCode = tableOrder?.OrderCode,
                    ItemCount = tableOrder?.OrderItems?.Sum(i => i.Quantity) ?? 0,
                    TotalAmount = tableOrder?.TotalAmount ?? 0,
                    OccupiedMinutes = minutes,
                    IsLongStaying = minutes > 90
                });
            }

            var occupiedTables = activeTablesList.Count(t => t.Status == "Occupied");
            var availableTables = totalTables - occupiedTables;
            var occupancyPercent = totalTables > 0 ? Math.Round((double)occupiedTables / totalTables * 100, 1) : 0;

            // Average fulfillment time for completed orders today. Do not invent a
            // value for a new store that has no completed orders yet.
            var fulfillmentDurations = todayAllOrders
                .Where(o => (o.Status == OrderStatus.Served || o.Status == OrderStatus.Paid || o.Status == OrderStatus.Completed)
                    && o.UpdatedAt.HasValue
                    && o.UpdatedAt.Value >= o.CreatedAt)
                .Select(o => (o.UpdatedAt!.Value - o.CreatedAt).TotalMinutes)
                .Where(minutes => minutes >= 0)
                .ToList();
            var avgFulfillmentMinutes = fulfillmentDurations.Count > 0
                ? Math.Round(fulfillmentDurations.Average(), 1)
                : 0;

            // Low stock alerts
            var stocks = await _db.InventoryStocks
                .Include(s => s.Ingredient)
                .Where(s => s.StoreId == storeId)
                .ToListAsync();

            var lowStockAlerts = stocks
                .Where(s => s.CurrentQuantity <= (s.Ingredient?.MinimumStock ?? 10))
                .Select(s => new ShiftStockAlertDto
                {
                    IngredientId = s.IngredientId,
                    IngredientName = s.Ingredient?.Name ?? "Nguyên liệu",
                    CurrentQuantity = s.CurrentQuantity,
                    MinThreshold = s.Ingredient?.MinimumStock ?? 10,
                    Unit = s.Ingredient?.Unit ?? "đv",
                    Severity = s.CurrentQuantity <= (s.Ingredient?.MinimumStock ?? 10) * 0.3m ? "Critical" : "Warning"
                })
                .OrderBy(a => a.CurrentQuantity)
                .Take(6)
                .ToList();

            // Hourly Traffic (7h -> 22h)
            var hourlyTraffic = new List<HourlyTrafficDto>();
            for (int h = 7; h <= 22; h++)
            {
                var hOrders = todayPaidOrders.Where(o => o.CreatedAt.Hour == h).ToList();
                var hRev = hOrders.Sum(o => o.TotalAmount);
                var hCount = hOrders.Count;
                hourlyTraffic.Add(new HourlyTrafficDto
                {
                    Hour = h,
                    TimeLabel = $"{h:D2}:00",
                    Revenue = hRev,
                    OrderCount = hCount,
                    IsPeakHour = (h >= 8 && h <= 10) || (h >= 12 && h <= 13) || (h >= 19 && h <= 21)
                });
            }

            // Top Products today
            var topProductsToday = todayPaidOrders
                .SelectMany(o => o.OrderItems)
                .GroupBy(i => new { i.MenuItemId, Name = i.MenuItem != null ? i.MenuItem.Name : "Món ăn" })
                .Select(g => new TopProductDto
                {
                    MenuItemId = g.Key.MenuItemId,
                    Name = g.Key.Name,
                    SoldCount = g.Sum(x => x.Quantity),
                    TotalRevenue = g.Sum(x => x.SubTotal)
                })
                .OrderByDescending(p => p.SoldCount)
                .Take(5)
                .ToList();

            return new ShiftOperationsDto
            {
                StoreId = storeId,
                StoreName = storeName,
                ShiftDate = today,
                TodayRevenue = todayRevenue,
                YesterdayRevenueSameTime = yesterdayRevenue,
                RevenueGrowthPercent = revenueGrowth,
                CashRevenue = cashRevenue,
                BankTransferRevenue = bankTransferRevenue,
                TodayOrdersCount = todayAllOrders.Count,
                PendingOrdersCount = pendingCount,
                PreparingOrdersCount = preparingCount,
                ReadyOrdersCount = readyCount,
                ServedOrdersCount = servedCount,
                AvgFulfillmentMinutes = avgFulfillmentMinutes,
                TotalTables = totalTables,
                OccupiedTables = occupiedTables,
                AvailableTables = availableTables,
                TableOccupancyPercent = occupancyPercent,
                ActiveTablesList = activeTablesList,
                LowStockAlerts = lowStockAlerts,
                HourlyTraffic = hourlyTraffic,
                TopProductsToday = topProductsToday
            };
        }

        public async Task<BusinessAnalyticsReportDto> GetBusinessAnalyticsReportAsync(int storeId, DateTime fromDate, DateTime toDate)
        {
            var store = await _db.Stores.FirstOrDefaultAsync(s => s.StoreId == storeId);
            var tenantId = store?.TenantId ?? 0;
            var toDateExclusive = toDate.Date.AddDays(1);
            var completedStatuses = new[] { OrderStatus.Paid, OrderStatus.Completed };

            var orders = await _db.Orders
                .Include(o => o.OrderItems)
                    .ThenInclude(i => i.MenuItem)
                        .ThenInclude(m => m!.Category)
                .Where(o => o.StoreId == storeId && 
                            completedStatuses.Contains(o.Status) &&
                            o.CreatedAt >= fromDate && 
                            o.CreatedAt < toDateExclusive)
                .ToListAsync();

            var grossRevenue = orders.Sum(o => o.SubTotal > 0 ? o.SubTotal : o.TotalAmount);
            var totalDiscount = orders.Sum(o => o.DiscountAmount);
            var netRevenue = orders.Sum(o => o.TotalAmount);
            var totalOrders = orders.Count;
            var avgOrderValue = totalOrders > 0 ? netRevenue / totalOrders : 0;

            // There is no ingredient purchase-price field in the current schema,
            // so never invent a percentage. COGS remains zero until recipe costs
            // are configured with real unit prices.
            var estimatedCOGS = 0m;
            var grossProfit = estimatedCOGS > 0 ? netRevenue - estimatedCOGS : 0;
            var grossMarginPercent = netRevenue > 0 ? Math.Round((double)(grossProfit / netRevenue) * 100, 1) : 0;

            // Daily Trend
            var dailyTrend = orders
                .GroupBy(o => o.CreatedAt.Date)
                .Select(g => new DailyRevenueDto
                {
                    Date = g.Key.ToString("dd/MM"),
                    Revenue = g.Sum(o => o.TotalAmount),
                    OrdersCount = g.Count(),
                    EstimatedProfit = 0
                })
                .OrderBy(x => x.Date)
                .ToList();

            // If empty or few days, fill remaining dates in range
            if (dailyTrend.Count == 0)
            {
                var days = (int)(toDate.Date - fromDate.Date).TotalDays + 1;
                for (int i = 0; i < Math.Min(days, 14); i++)
                {
                    var d = fromDate.Date.AddDays(i);
                    dailyTrend.Add(new DailyRevenueDto
                    {
                        Date = d.ToString("dd/MM"),
                        Revenue = 0,
                        OrdersCount = 0,
                        EstimatedProfit = 0
                    });
                }
            }

            // Category Breakdown
            var categoryItems = orders.SelectMany(o => o.OrderItems).ToList();
            var totalSoldAll = categoryItems.Sum(x => x.Quantity);

            var categoryBreakdown = categoryItems
                .GroupBy(i => new { 
                    CategoryId = i.MenuItem?.CategoryId ?? 1, 
                    CategoryName = i.MenuItem?.Category?.Name ?? "Đồ Uống" 
                })
                .Select(g => new CategoryPerformanceDto
                {
                    CategoryId = g.Key.CategoryId,
                    CategoryName = g.Key.CategoryName,
                    TotalSold = g.Sum(x => x.Quantity),
                    TotalRevenue = g.Sum(x => x.SubTotal),
                    OrderCount = g.Select(x => x.OrderId).Distinct().Count(),
                    Percentage = netRevenue > 0 ? Math.Round((double)(g.Sum(x => x.SubTotal) / netRevenue) * 100, 1) : 0
                })
                .OrderByDescending(c => c.TotalRevenue)
                .ToList();

            // Payment Methods
            var orderIds = orders.Select(o => o.OrderId).ToList();
            var payments = await _db.Payments
                .Where(p => orderIds.Contains(p.OrderId) && p.Status == PaymentStatuses.Completed)
                .ToListAsync();

            var paymentMethodBreakdown = payments
                .GroupBy(p => p.Method)
                .Select(g => new PaymentMethodStatsDto
                {
                    Method = g.Key,
                    Count = g.Count(),
                    TotalAmount = g.Sum(p => p.Amount),
                    Percentage = netRevenue > 0 ? Math.Round((double)(g.Sum(p => p.Amount) / netRevenue) * 100, 1) : 0
                })
                .ToList();

            // Channel Breakdown (Dine-in vs Takeaway)
            var dineInOrders = orders.Where(o => o.TableId.HasValue).ToList();
            var takeawayOrders = orders.Where(o => !o.TableId.HasValue).ToList();
            var dineInRev = dineInOrders.Sum(o => o.TotalAmount);
            var takeawayRev = takeawayOrders.Sum(o => o.TotalAmount);

            var channelBreakdown = new List<ChannelSalesDto>
            {
                new ChannelSalesDto
                {
                    Channel = "Tại Quán (Dine-in)",
                    OrderCount = dineInOrders.Count,
                    Revenue = dineInRev,
                    Percentage = netRevenue > 0 ? Math.Round((double)(dineInRev / netRevenue) * 100, 1) : 0
                },
                new ChannelSalesDto
                {
                    Channel = "Mang Đi (Takeaway)",
                    OrderCount = takeawayOrders.Count,
                    Revenue = takeawayRev,
                    Percentage = netRevenue > 0 ? Math.Round((double)(takeawayRev / netRevenue) * 100, 1) : 0
                }
            };

            // Menu Engineering Matrix
            var menuEngineering = await GetMenuEngineeringMatrixAsync(storeId, fromDate, toDate);

            // Customer analytics
            var customerAnalytics = await GetCustomerAnalyticsAsync(tenantId, fromDate, toDate);

            return new BusinessAnalyticsReportDto
            {
                FromDate = fromDate,
                ToDate = toDate,
                StoreId = storeId,
                GrossRevenue = grossRevenue,
                TotalDiscount = totalDiscount,
                NetRevenue = netRevenue,
                EstimatedCOGS = estimatedCOGS,
                GrossProfit = grossProfit,
                GrossMarginPercent = grossMarginPercent,
                TotalOrders = totalOrders,
                AverageOrderValue = avgOrderValue,
                AverageSpendPerCustomer = avgOrderValue,
                DailyTrend = dailyTrend,
                CategoryBreakdown = categoryBreakdown,
                PaymentMethodBreakdown = paymentMethodBreakdown,
                ChannelBreakdown = channelBreakdown,
                MenuEngineering = menuEngineering,
                CustomerAnalytics = customerAnalytics
            };
        }

        public async Task<MenuEngineeringSummaryDto> GetMenuEngineeringMatrixAsync(int storeId, DateTime fromDate, DateTime toDate)
        {
            var orderItems = await _db.OrderItems
                .Include(oi => oi.Order)
                .Include(oi => oi.MenuItem)
                    .ThenInclude(m => m!.Category)
                .Where(oi => oi.Order != null &&
                            oi.Order.StoreId == storeId &&
                            (oi.Order.Status == OrderStatus.Paid || oi.Order.Status == OrderStatus.Completed) &&
                            oi.Order.CreatedAt >= fromDate &&
                            oi.Order.CreatedAt < toDate.Date.AddDays(1))
                .ToListAsync();

            var menuItemsSold = orderItems
                .GroupBy(oi => new
                {
                    MenuItemId = oi.MenuItemId,
                    Name = oi.MenuItem != null ? oi.MenuItem.Name : "Món ăn",
                    CategoryName = oi.MenuItem?.Category?.Name ?? "Đồ Uống",
                    ImageUrl = oi.MenuItem?.ImageUrl,
                    BasePrice = oi.UnitPrice
                })
                .Select(g =>
                {
                    var price = g.Key.BasePrice;
                    var cost = 0m; // No unit ingredient cost is stored yet.
                    var margin = price - cost;
                    var soldCount = g.Sum(x => x.Quantity);
                    var totalRev = g.Sum(x => x.SubTotal);
                    var totalProfit = soldCount * margin;

                    return new MenuEngineeringItemDto
                    {
                        MenuItemId = g.Key.MenuItemId,
                        Name = g.Key.Name,
                        CategoryName = g.Key.CategoryName,
                        ImageUrl = g.Key.ImageUrl,
                        BasePrice = price,
                        EstimatedCost = cost,
                        MarginPerUnit = margin,
                        MarginPercent = price > 0 ? Math.Round((double)(margin / price) * 100, 1) : 0,
                        SoldCount = soldCount,
                        TotalRevenue = totalRev,
                        TotalProfit = totalProfit
                    };
                })
                .ToList();

            var avgSold = menuItemsSold.Count > 0 ? menuItemsSold.Average(x => x.SoldCount) : 0;
            var avgMargin = menuItemsSold.Count > 0 ? menuItemsSold.Average(x => x.MarginPerUnit) : 0;

            var summary = new MenuEngineeringSummaryDto();

            foreach (var item in menuItemsSold)
            {
                bool isHighVolume = item.SoldCount >= avgSold;
                bool isHighMargin = item.MarginPerUnit >= avgMargin;

                if (isHighVolume && isHighMargin)
                {
                    item.Classification = "Star";
                    item.StrategicRecommendation = "Món Ngôi Sao: Giữ vững chất lượng, đặt ở vị trí trung tâm menu và ưu tiên gợi ý AI.";
                    summary.Stars.Add(item);
                }
                else if (isHighVolume && !isHighMargin)
                {
                    item.Classification = "Plowhorse";
                    item.StrategicRecommendation = "Món Bò Sữa: Tối ưu chi phí nhập nguyên liệu hoặc tăng giá nhẹ 2.000đ - 3.000đ để cải thiện biên lãi.";
                    summary.Plowhorses.Add(item);
                }
                else if (!isHighVolume && isHighMargin)
                {
                    item.Classification = "Puzzle";
                    item.StrategicRecommendation = "Món Câu Đố: Đẩy mạnh quảng bá, đưa vào Combo ưu đãi hoặc cho Barista mời khách thử vị.";
                    summary.Puzzles.Add(item);
                }
                else
                {
                    item.Classification = "Dog";
                    item.StrategicRecommendation = "Món Chó Mực: Xem xét tinh giản khỏi thực đơn để giảm tồn kho nguyên liệu khó bảo quản.";
                    summary.Dogs.Add(item);
                }
            }

            summary.Stars = summary.Stars.OrderByDescending(x => x.TotalRevenue).ToList();
            summary.Plowhorses = summary.Plowhorses.OrderByDescending(x => x.TotalRevenue).ToList();
            summary.Puzzles = summary.Puzzles.OrderByDescending(x => x.MarginPerUnit).ToList();
            summary.Dogs = summary.Dogs.OrderBy(x => x.SoldCount).ToList();

            return summary;
        }

        public async Task<DashboardStatsDto> GetDashboardStatsAsync(int storeId)
        {
            var shift = await GetShiftOperationsAsync(storeId);
            return new DashboardStatsDto
            {
                TodayRevenue = shift.TodayRevenue,
                TodayOrders = shift.TodayOrdersCount,
                TotalCustomers = await _db.Customers.CountAsync(),
                AvailableTables = shift.AvailableTables,
                OccupiedTables = shift.OccupiedTables,
                TopProducts = shift.TopProductsToday,
                RevenueChart = shift.HourlyTraffic.Select(h => new DailyRevenueDto
                {
                    Date = h.TimeLabel,
                    Revenue = h.Revenue,
                    OrdersCount = h.OrderCount
                }).ToList()
            };
        }

        public async Task<RevenueReportDto> GetRevenueReportAsync(int storeId, DateTime fromDate, DateTime toDate)
        {
            var report = await GetBusinessAnalyticsReportAsync(storeId, fromDate, toDate);
            return new RevenueReportDto
            {
                FromDate = fromDate,
                ToDate = toDate,
                TotalRevenue = report.NetRevenue,
                TotalOrders = report.TotalOrders,
                TotalDiscount = report.TotalDiscount,
                AverageOrderValue = report.AverageOrderValue,
                DailyRevenue = report.DailyTrend,
                PaymentMethodStats = report.PaymentMethodBreakdown
            };
        }

        public async Task<CustomerAnalyticsDto> GetCustomerAnalyticsAsync(int tenantId, DateTime fromDate, DateTime toDate)
        {
            var customers = await _db.Customers
                .Where(c => c.TenantId == tenantId)
                .ToListAsync();

            var toDateExclusive = toDate.Date.AddDays(1);
            var newCustomers = customers.Count(c => c.CreatedAt >= fromDate && c.CreatedAt < toDateExclusive);
            var activeCustomers = customers.Count(c => c.LastVisitAt >= fromDate && c.LastVisitAt < toDateExclusive);

            // Top customers by spending
            var topCustomers = customers
                .Where(c => c.TotalSpent > 0)
                .OrderByDescending(c => c.TotalSpent)
                .Take(10)
                .Select(c => new TopCustomerDto
                {
                    CustomerId = c.CustomerId,
                    Name = c.Name ?? "Khách hàng",
                    Phone = c.Phone,
                    TotalSpent = c.TotalSpent,
                    VisitCount = c.VisitCount,
                    TotalPoints = c.TotalPoints
                })
                .ToList();

            // Customer retention rate
            var totalCustomers = customers.Count;
            var retentionRate = totalCustomers > 0 ? (double)activeCustomers / totalCustomers * 100 : 0;

            return new CustomerAnalyticsDto
            {
                TotalCustomers = totalCustomers,
                NewCustomers = newCustomers,
                ActiveCustomers = activeCustomers,
                RetentionRate = Math.Round(retentionRate, 2),
                TopCustomers = topCustomers
            };
        }

        public async Task<List<CategoryPerformanceDto>> GetCategoryPerformanceAsync(int tenantId, DateTime fromDate, DateTime toDate)
        {
            var categoryPerformance = await _db.OrderItems
                .Include(oi => oi.Order)
                .Include(oi => oi.MenuItem)
                    .ThenInclude(mi => mi!.Category)
                .Where(oi => oi.Order!.TenantId == tenantId &&
                            oi.Order.Status == OrderStatus.Paid &&
                            oi.Order.CreatedAt >= fromDate &&
                            oi.Order.CreatedAt < toDate.Date.AddDays(1))
                .GroupBy(oi => new 
                { 
                    CategoryId = oi.MenuItem!.CategoryId, 
                    CategoryName = oi.MenuItem.Category!.Name 
                })
                .Select(g => new CategoryPerformanceDto
                {
                    CategoryId = g.Key.CategoryId,
                    CategoryName = g.Key.CategoryName,
                    TotalSold = g.Sum(x => x.Quantity),
                    TotalRevenue = g.Sum(x => x.SubTotal),
                    OrderCount = g.Select(x => x.OrderId).Distinct().Count()
                })
                .OrderByDescending(x => x.TotalRevenue)
                .ToListAsync();

            return categoryPerformance;
        }
    }
}

