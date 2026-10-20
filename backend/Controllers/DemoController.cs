using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WebCafe.Backend.Common.Models;
using WebCafe.Backend.Infrastructure.Data;

namespace WebCafe.Backend.Controllers;

/// <summary>
/// Public entry point for the isolated product demo. It exposes only the
/// demo tenant's public table identity; it never exposes an owner account or
/// a real tenant's data.
/// </summary>
[ApiController]
[Route("api/demo")]
[AllowAnonymous]
public sealed class DemoController : ControllerBase
{
    private const string DemoSlug = "aismartserve-demo";
    private readonly WebCafeDbContext _db;

    public DemoController(WebCafeDbContext db)
    {
        _db = db;
    }

    [HttpGet("info")]
    public async Task<ActionResult<ApiResponse<DemoInfoDto>>> GetInfo(CancellationToken cancellationToken)
    {
        var info = await _db.Tables
            .AsNoTracking()
            .Where(t => t.IsActive && t.Store != null && t.Store.IsActive &&
                        t.Store.Tenant != null && t.Store.Tenant.IsActive &&
                        t.Store.Tenant.Slug == DemoSlug)
            .OrderBy(t => t.TableId)
            .Select(t => new DemoInfoDto
            {
                TenantId = t.Store!.TenantId,
                StoreId = t.StoreId,
                StoreName = t.Store.Name,
                TableId = t.TableId,
                TableNumber = t.TableNumber,
                QrToken = t.QrToken
            })
            .FirstOrDefaultAsync(cancellationToken);

        if (info == null)
        {
            return NotFound(ApiResponse<DemoInfoDto>.Fail(
                "Khu demo chưa sẵn sàng. Vui lòng thử lại sau ít phút."));
        }

        return Ok(ApiResponse<DemoInfoDto>.Ok(info));
    }

    [HttpGet("backoffice")]
    public async Task<ActionResult<ApiResponse<object>>> GetBackoffice(CancellationToken cancellationToken)
    {
        var store = await _db.Stores.AsNoTracking()
            .Where(s => s.IsActive && s.Tenant != null && s.Tenant.IsActive && s.Tenant.Slug == DemoSlug)
            .Select(s => new { s.StoreId, s.TenantId, s.Name })
            .FirstOrDefaultAsync(cancellationToken);
        if (store == null)
            return NotFound(ApiResponse<object>.Fail("Khu demo chưa sẵn sàng. Vui lòng thử lại sau."));

        var categories = await _db.Categories.AsNoTracking()
            .Where(c => c.TenantId == store.TenantId && c.IsActive && !c.IsDeleted)
            .OrderBy(c => c.SortOrder)
            .Select(c => new { c.CategoryId, c.Name })
            .ToListAsync(cancellationToken);
        var menu = await _db.MenuItems.AsNoTracking()
            .Where(m => m.TenantId == store.TenantId && !m.IsDeleted)
            .OrderBy(m => m.CategoryId).ThenBy(m => m.SortOrder)
            .Select(m => new { m.MenuItemId, m.Name, m.BasePrice, m.IsAvailable, m.IsFeatured, m.CategoryId, CategoryName = m.Category != null ? m.Category.Name : "", m.ImageUrl })
            .ToListAsync(cancellationToken);
        var tables = await _db.Tables.AsNoTracking()
            .Where(t => t.StoreId == store.StoreId && t.IsActive)
            .OrderBy(t => t.TableNumber)
            .Select(t => new { t.TableId, t.TableNumber, t.Capacity, t.Status })
            .ToListAsync(cancellationToken);
        var inventory = await _db.InventoryStocks.AsNoTracking()
            .Where(s => s.StoreId == store.StoreId && s.Ingredient != null && s.Ingredient.IsActive)
            .OrderBy(s => s.Ingredient!.Name)
            .Select(s => new { s.IngredientId, Name = s.Ingredient!.Name, Unit = s.Ingredient.Unit, MinimumStock = s.Ingredient.MinimumStock, CurrentQuantity = s.CurrentQuantity })
            .ToListAsync(cancellationToken);

        // These example orders and employees are presentation data only. No
        // credentials, payment records or mutable production entities are exposed.
        var sampleOrders = new[]
        {
            new { OrderCode = "DEMO-101", TableNumber = "D01", GuestName = "Khách bàn D01", Status = "pending", TotalAmount = 92000, MinutesAgo = 3, Items = new[] { new { Name = "Cà phê sữa", Quantity = 1 }, new { Name = "Caramel Cloud Macchiato", Quantity = 1 } } },
            new { OrderCode = "DEMO-102", TableNumber = "D03", GuestName = "Khách bàn D03", Status = "preparing", TotalAmount = 87000, MinutesAgo = 9, Items = new[] { new { Name = "Trà đào cam sả", Quantity = 1 }, new { Name = "Trà vải lài", Quantity = 1 } } },
            new { OrderCode = "DEMO-103", TableNumber = "D05", GuestName = "Khách bàn D05", Status = "ready", TotalAmount = 101000, MinutesAgo = 16, Items = new[] { new { Name = "Matcha Latte", Quantity = 1 }, new { Name = "Trà sữa trân châu", Quantity = 1 } } },
            new { OrderCode = "DEMO-104", TableNumber = "D02", GuestName = "Khách bàn D02", Status = "paid", TotalAmount = 80000, MinutesAgo = 36, Items = new[] { new { Name = "Espresso", Quantity = 1 }, new { Name = "Trà đào cam sả", Quantity = 1 } } }
        };
        var sampleStaff = new[]
        {
            new { Name = "Minh Anh", Role = "Staff", Shift = "07:00 - 15:00", Status = "Đang làm việc" },
            new { Name = "Quang Huy", Role = "Staff", Shift = "15:00 - 22:00", Status = "Sắp vào ca" }
        };
        var sampleRevenue = new[] { 420000, 680000, 540000, 790000, 620000, 910000, 835000 };
        var snapshot = new
        {
            storeName = store.Name,
            categories,
            menu,
            tables,
            inventory,
            sampleOrders,
            sampleStaff,
            sampleRevenue,
            sampleLabel = "Dữ liệu mô phỏng phục vụ giới thiệu sản phẩm"
        };
        return Ok(ApiResponse<object>.Ok(snapshot));
    }
}

public sealed class DemoInfoDto
{
    public int TenantId { get; set; }
    public int StoreId { get; set; }
    public string StoreName { get; set; } = string.Empty;
    public int TableId { get; set; }
    public string TableNumber { get; set; } = string.Empty;
    public string QrToken { get; set; } = string.Empty;
}
