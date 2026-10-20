using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WebCafe.Backend.Common.Constants;
using WebCafe.Backend.Common.Models;
using WebCafe.Backend.Infrastructure.Data;
using WebCafe.Backend.Models.DTOs.Order;
using WebCafe.Backend.Models.Entities;
using WebCafe.Backend.Services.Abstraction;

namespace WebCafe.Backend.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Policy = AppPolicies.CustomerOnly)]
    public class CustomerController : ControllerBase
    {
        private readonly WebCafeDbContext _db;
        private readonly ICurrentUserService _currentUser;

        public CustomerController(WebCafeDbContext db, ICurrentUserService currentUser)
        {
            _db = db;
            _currentUser = currentUser;
        }

        // GET api/customer/profile?storeId=1
        [HttpGet("profile")]
        public async Task<ActionResult<ApiResponse<CustomerProfileDto>>> GetProfile([FromQuery] int? storeId = null)
        {
            var authCustomer = await _db.Customers
                .Include(c => c.Tenant)
                .FirstOrDefaultAsync(c => c.CustomerId == _currentUser.CustomerId);

            if (authCustomer == null)
            {
                return NotFound(ApiResponse<CustomerProfileDto>.Fail("Không tìm thấy thông tin khách hàng."));
            }

            var phone = authCustomer.Phone;
            int targetTenantId = authCustomer.TenantId;

            // Nếu client truyền storeId (quán đang ghé), tìm Tenant tương ứng của quán đó
            if (storeId.HasValue && storeId.Value > 0)
            {
                var store = await _db.Stores.FirstOrDefaultAsync(s => s.StoreId == storeId.Value);
                if (store != null)
                {
                    targetTenantId = store.TenantId;
                }
            }

            // Lấy profile tương ứng với tenant hiện tại (nếu chưa có thì tự động tạo hội viên cho quán này)
            var currentCustomer = await _db.Customers
                .Include(c => c.Tenant)
                .FirstOrDefaultAsync(c => c.Phone == phone && c.TenantId == targetTenantId);

            if (currentCustomer == null)
            {
                var targetTenant = await _db.Tenants.FirstOrDefaultAsync(t => t.TenantId == targetTenantId);
                currentCustomer = new Customer
                {
                    TenantId = targetTenantId,
                    Phone = phone,
                    Name = authCustomer.Name,
                    TotalPoints = 0,
                    TotalSpent = 0,
                    VisitCount = 1,
                    CreatedAt = DateTime.UtcNow,
                    LastVisitAt = DateTime.UtcNow
                };
                _db.Customers.Add(currentCustomer);
                await _db.SaveChangesAsync();
                currentCustomer.Tenant = targetTenant;
            }

            var pointsToMoney = currentCustomer.Tenant?.PointsToMoney ?? 200;
            var pointsPerAmount = currentCustomer.Tenant?.PointsPerAmount ?? 10000;

            // Lấy danh sách điểm của khách hàng tại TẤT CẢ các quán trên hệ thống SaaS
            var allTenantPoints = await _db.Customers
                .Include(c => c.Tenant)
                .Where(c => c.Phone == phone)
                .Select(c => new TenantLoyaltyDto
                {
                    TenantId = c.TenantId,
                    TenantName = c.Tenant != null ? c.Tenant.Name : "Quán",
                    TotalPoints = c.TotalPoints,
                    TotalSpent = c.TotalSpent,
                    PointsToMoney = c.Tenant != null ? c.Tenant.PointsToMoney : 200
                })
                .ToListAsync();

            var dto = new CustomerProfileDto
            {
                CustomerId = currentCustomer.CustomerId,
                TenantId = currentCustomer.TenantId,
                TenantName = currentCustomer.Tenant?.Name ?? "WebCafe",
                Phone = currentCustomer.Phone,
                Name = currentCustomer.Name ?? "Khách hàng",
                TotalPoints = currentCustomer.TotalPoints,
                TotalSpent = currentCustomer.TotalSpent,
                VisitCount = currentCustomer.VisitCount,
                PointsToMoney = pointsToMoney,
                PointsPerAmount = pointsPerAmount,
                CreatedAt = currentCustomer.CreatedAt,
                LastVisitAt = currentCustomer.LastVisitAt,
                TenantPoints = allTenantPoints
            };

            return Ok(ApiResponse<CustomerProfileDto>.Ok(dto));
        }

        // PUT api/customer/profile
        [HttpPut("profile")]
        public async Task<ActionResult<ApiResponse<CustomerProfileDto>>> UpdateProfile([FromBody] UpdateCustomerProfileDto dto)
        {
            var customer = await _db.Customers
                .Include(c => c.Tenant)
                .FirstOrDefaultAsync(c => c.CustomerId == _currentUser.CustomerId && c.TenantId == _currentUser.TenantId);

            if (customer == null)
            {
                return NotFound(ApiResponse<CustomerProfileDto>.Fail("Không tìm thấy khách hàng để cập nhật."));
            }

            // Chặn không cho đổi số điện thoại
            if (!string.IsNullOrWhiteSpace(dto.NewPhone) && dto.NewPhone != customer.Phone)
            {
                return BadRequest(ApiResponse<CustomerProfileDto>.Fail("Không được phép thay đổi số điện thoại tích điểm để bảo toàn quyền lợi của bạn."));
            }

            if (!string.IsNullOrWhiteSpace(dto.Name))
            {
                customer.Name = dto.Name.Trim();
            }

            await _db.SaveChangesAsync();

            var pointsToMoney = customer.Tenant?.PointsToMoney ?? 200;
            var pointsPerAmount = customer.Tenant?.PointsPerAmount ?? 10000;

            var res = new CustomerProfileDto
            {
                CustomerId = customer.CustomerId,
                TenantId = customer.TenantId,
                Phone = customer.Phone,
                Name = customer.Name ?? "Khách hàng",
                TotalPoints = customer.TotalPoints,
                TotalSpent = customer.TotalSpent,
                VisitCount = customer.VisitCount,
                PointsToMoney = pointsToMoney,
                PointsPerAmount = pointsPerAmount,
                CreatedAt = customer.CreatedAt,
                LastVisitAt = customer.LastVisitAt
            };

            return Ok(ApiResponse<CustomerProfileDto>.Ok(res, "Cập nhật thông tin thành công!"));
        }

        // GET api/customer/orders?pageNumber=1&pageSize=10&status=all&storeId=1
        [HttpGet("orders")]
        public async Task<ActionResult<ApiResponse<PaginationRes<OrderDto>>>> GetOrders(
            [FromQuery] int pageNumber = 1,
            [FromQuery] int pageSize = 10,
            [FromQuery] string? status = null,
            [FromQuery] int? storeId = null,
            [FromQuery] int? tenantId = null)
        {
            var authCustomer = await _db.Customers.FirstOrDefaultAsync(c => c.CustomerId == _currentUser.CustomerId);
            var phone = authCustomer?.Phone;

            var query = _db.Orders
                .Include(o => o.Store).ThenInclude(s => s.Tenant)
                .Include(o => o.Tenant)
                .Include(o => o.Table)
                .Include(o => o.Customer)
                .Include(o => o.OrderItems)
                    .ThenInclude(oi => oi.MenuItem)
                .Include(o => o.OrderItems)
                    .ThenInclude(oi => oi.Size)
                .Include(o => o.OrderItems)
                    .ThenInclude(oi => oi.OrderItemToppings)
                        .ThenInclude(oit => oit.Topping)
                .Where(o => o.CustomerId == _currentUser.CustomerId || (phone != null && (o.Customer != null && o.Customer.Phone == phone || o.GuestPhone == phone)))
                .AsQueryable();

            if (storeId.HasValue && storeId.Value > 0)
            {
                query = query.Where(o => o.StoreId == storeId.Value);
            }
            else if (tenantId.HasValue && tenantId.Value > 0)
            {
                query = query.Where(o => o.TenantId == tenantId.Value);
            }

            if (!string.IsNullOrWhiteSpace(status) && status.ToLower() != "all")
            {
                query = query.Where(o => o.Status.ToLower() == status.ToLower());
            }

            var totalRecords = await query.CountAsync();

            var orders = await query
                .OrderByDescending(o => o.CreatedAt)
                .Skip((pageNumber - 1) * pageSize)
                .Take(pageSize)
                .Select(o => new OrderDto
                {
                    OrderId = o.OrderId,
                    TenantId = o.TenantId,
                    TenantName = o.Store != null && o.Store.Tenant != null ? o.Store.Tenant.Name : (o.Tenant != null ? o.Tenant.Name : string.Empty),
                    StoreId = o.StoreId,
                    StoreName = o.Store != null ? o.Store.Name : string.Empty,
                    OrderCode = o.OrderCode,
                    TableId = o.TableId,
                    TableNumber = o.Table != null ? o.Table.TableNumber : null,
                    CustomerId = o.CustomerId,
                    CustomerName = o.Customer != null ? o.Customer.Name : o.GuestName,
                    CustomerPhone = o.Customer != null ? o.Customer.Phone : o.GuestPhone,
                    GuestId = o.GuestId,
                    GuestName = o.GuestName,
                    GuestPhone = o.GuestPhone,
                    Status = o.Status,
                    SubTotal = o.SubTotal,
                    DiscountAmount = o.DiscountAmount,
                    PointsUsed = o.PointsUsed,
                    PointsEarned = o.PointsEarned,
                    TotalAmount = o.TotalAmount,
                    Note = o.Note,
                    CreatedAt = o.CreatedAt,
                    Items = o.OrderItems.Select(oi => new OrderItemDto
                    {
                        OrderItemId = oi.OrderItemId,
                        MenuItemId = oi.MenuItemId,
                        MenuItemName = oi.MenuItem != null ? oi.MenuItem.Name : "Món",
                        ImageUrl = oi.MenuItem != null ? oi.MenuItem.ImageUrl : null,
                        SizeId = oi.SizeId,
                        SizeName = oi.Size != null ? oi.Size.Name : null,
                        Quantity = oi.Quantity,
                        UnitPrice = oi.UnitPrice,
                        ToppingTotal = oi.ToppingTotal,
                        SubTotal = oi.SubTotal,
                        SugarLevel = oi.SugarLevel,
                        IceLevel = oi.IceLevel,
                        Note = oi.Note,
                        Toppings = oi.OrderItemToppings.Select(oit => new OrderItemToppingDto
                        {
                            OrderItemToppingId = oit.OrderItemToppingId,
                            ToppingId = oit.ToppingId,
                            ToppingName = oit.Topping != null ? oit.Topping.Name : "Topping",
                            Price = oit.Price
                        }).ToList()
                    }).ToList()
                })
                .ToListAsync();

            var result = new PaginationRes<OrderDto>(orders, pageNumber, pageSize, totalRecords);
            return Ok(ApiResponse<PaginationRes<OrderDto>>.Ok(result));
        }

        // GET api/customer/loyalty-history
        [HttpGet("loyalty-history")]
        public async Task<ActionResult<ApiResponse<PaginationRes<CustomerLoyaltyHistoryDto>>>> GetLoyaltyHistory(
            [FromQuery] int pageNumber = 1,
            [FromQuery] int pageSize = 10)
        {
            var customer = await _db.Customers.FirstOrDefaultAsync(c =>
                c.CustomerId == _currentUser.CustomerId);
            if (customer == null)
            {
                return NotFound(ApiResponse<PaginationRes<CustomerLoyaltyHistoryDto>>.Fail("Không tìm thấy khách hàng."));
            }

            var query = _db.LoyaltyPoints
                .Where(lp => lp.CustomerId == customer.CustomerId)
                .OrderByDescending(lp => lp.CreatedAt);

            var totalRecords = await query.CountAsync();
            var items = await query
                .Skip((pageNumber - 1) * pageSize)
                .Take(pageSize)
                .Select(lp => new CustomerLoyaltyHistoryDto
                {
                    PointId = lp.PointId,
                    CustomerId = lp.CustomerId,
                    OrderId = lp.OrderId,
                    Points = lp.Points,
                    Type = lp.Type,
                    Description = lp.Description,
                    CreatedAt = lp.CreatedAt
                })
                .ToListAsync();

            var result = new PaginationRes<CustomerLoyaltyHistoryDto>(items, pageNumber, pageSize, totalRecords);
            return Ok(ApiResponse<PaginationRes<CustomerLoyaltyHistoryDto>>.Ok(result));
        }
    }

    public class TenantLoyaltyDto
    {
        public int TenantId { get; set; }
        public string TenantName { get; set; } = string.Empty;
        public int TotalPoints { get; set; }
        public decimal TotalSpent { get; set; }
        public decimal PointsToMoney { get; set; } = 200;
    }

    public class CustomerProfileDto
    {
        public int CustomerId { get; set; }
        public int TenantId { get; set; }
        public string TenantName { get; set; } = string.Empty;
        public string Phone { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public int TotalPoints { get; set; }
        public decimal TotalSpent { get; set; }
        public int VisitCount { get; set; }
        public decimal PointsToMoney { get; set; } = 200;
        public int PointsPerAmount { get; set; } = 10000;
        public DateTime CreatedAt { get; set; }
        public DateTime? LastVisitAt { get; set; }
        public List<TenantLoyaltyDto> TenantPoints { get; set; } = new();
    }

    public class UpdateCustomerProfileDto
    {
        public string? Phone { get; set; }
        public string? NewPhone { get; set; }
        public string? Name { get; set; }
    }

    public class CustomerLoyaltyHistoryDto
    {
        public int PointId { get; set; }
        public int CustomerId { get; set; }
        public int? OrderId { get; set; }
        public int Points { get; set; }
        public string Type { get; set; } = string.Empty;
        public string? Description { get; set; }
        public DateTime CreatedAt { get; set; }
    }
}
