using Microsoft.EntityFrameworkCore;
using WebCafe.Backend.Common.Exceptions;
using WebCafe.Backend.Infrastructure.Data;
using WebCafe.Backend.Models.DTOs.Menu;
using WebCafe.Backend.Models.DTOs.Table;
using WebCafe.Backend.Models.Entities;
using WebCafe.Backend.Services.Abstraction;

namespace WebCafe.Backend.Services.Implementation
{
    public class CategoryService : ICategoryService
    {
        private readonly WebCafeDbContext _db;

        public CategoryService(WebCafeDbContext db)
        {
            _db = db;
        }

        public async Task<List<CategoryDto>> GetCategoriesByTenantAsync(int tenantId)
        {
            return await _db.Categories
                .Where(c => c.TenantId == tenantId && c.IsActive && !c.IsDeleted)
                .OrderBy(c => c.SortOrder)
                .Select(c => new CategoryDto
                {
                    CategoryId = c.CategoryId,
                    TenantId = c.TenantId,
                    Name = c.Name,
                    Icon = c.Icon,
                    SortOrder = c.SortOrder,
                    IsActive = c.IsActive
                })
                .ToListAsync();
        }

        public async Task<CategoryDto> CreateCategoryAsync(int tenantId, CreateCategoryDto dto)
        {
            var category = new Category
            {
                TenantId = tenantId,
                Name = dto.Name.Trim(),
                Icon = dto.Icon,
                SortOrder = dto.SortOrder,
                IsActive = true
            };
            _db.Categories.Add(category);
            await _db.SaveChangesAsync();

            return new CategoryDto
            {
                CategoryId = category.CategoryId,
                TenantId = category.TenantId,
                Name = category.Name,
                Icon = category.Icon,
                SortOrder = category.SortOrder,
                IsActive = category.IsActive
            };
        }

        public async Task DeleteCategoryAsync(int tenantId, int categoryId)
        {
            var category = await _db.Categories.FirstOrDefaultAsync(c => c.TenantId == tenantId && c.CategoryId == categoryId);
            if (category == null) throw new NotFoundException("Không tìm thấy danh mục.");

            // Soft delete
            category.IsDeleted = true;
            category.DeletedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();
        }
    }

    public class MenuItemService : IMenuItemService
    {
        private readonly WebCafeDbContext _db;

        public MenuItemService(WebCafeDbContext db)
        {
            _db = db;
        }

        public async Task<StoreMenuResponse> GetMenuByStoreAsync(int storeId)
        {
            var store = await _db.Stores
                .AsNoTracking()
                .Include(s => s.Tenant)
                .FirstOrDefaultAsync(s => s.StoreId == storeId && s.IsActive);

            if (store == null || store.Tenant == null)
            {
                throw new NotFoundException("Chi nhánh không tồn tại hoặc đã ngưng hoạt động.");
            }

            var tenantId = store.TenantId;

            var categories = await _db.Categories
                .AsNoTracking()
                .Where(c => c.TenantId == tenantId && c.IsActive && !c.IsDeleted)
                .OrderBy(c => c.SortOrder)
                .Select(c => new CategoryDto
                {
                    CategoryId = c.CategoryId,
                    TenantId = c.TenantId,
                    Name = c.Name,
                    Icon = c.Icon,
                    SortOrder = c.SortOrder,
                    IsActive = c.IsActive
                })
                .ToListAsync();

            var items = await _db.MenuItems
                .AsNoTracking()
                .Where(m => m.TenantId == tenantId && m.IsAvailable && !m.IsDeleted)
                .Include(m => m.Category)
                .Include(m => m.MenuItemSizes)
                    .ThenInclude(ms => ms.Size)
                .Include(m => m.MenuItemToppings)
                    .ThenInclude(mt => mt.Topping)
                .OrderBy(m => m.SortOrder)
                .ToListAsync();

            var itemDtos = items.Select(m => new MenuItemDto
            {
                MenuItemId = m.MenuItemId,
                TenantId = m.TenantId,
                CategoryId = m.CategoryId,
                CategoryName = m.Category?.Name ?? string.Empty,
                Name = m.Name,
                Description = m.Description,
                BasePrice = m.BasePrice,
                ImageUrl = m.ImageUrl,
                Rating = m.Rating,
                IsFeatured = m.IsFeatured,
                IsAvailable = m.IsAvailable,
                SortOrder = m.SortOrder,
                Sizes = m.MenuItemSizes.Select(s => new SizeDto
                {
                    SizeId = s.SizeId,
                    Name = s.Size?.Name ?? string.Empty,
                    ExtraPrice = s.ExtraPrice
                }).ToList(),
                Toppings = m.MenuItemToppings.Where(t => t.Topping?.IsAvailable == true).Select(t => new ToppingDto
                {
                    ToppingId = t.ToppingId,
                    Name = t.Topping?.Name ?? string.Empty,
                    Price = t.Topping?.Price ?? 0,
                    IsAvailable = t.Topping?.IsAvailable ?? false
                }).ToList()
            }).ToList();

            return new StoreMenuResponse
            {
                StoreId = store.StoreId,
                TenantId = tenantId,
                StoreName = store.Name,
                Address = store.Address,
                Phone = store.Phone,
                BankAccount = store.BankAccount,
                BankName = store.BankName,
                BankAccountName = store.BankAccountName,
                BrandName = store.Tenant.Name,
                LogoUrl = store.Tenant.LogoUrl,
                Categories = categories,
                MenuItems = itemDtos
            };
        }

        public async Task<List<MenuItemDto>> GetMenuItemsByTenantAsync(int tenantId, int? categoryId = null)
        {
            var query = _db.MenuItems
                .Where(m => m.TenantId == tenantId && !m.IsDeleted)
                .Include(m => m.Category)
                .Include(m => m.MenuItemSizes).ThenInclude(ms => ms.Size)
                .Include(m => m.MenuItemToppings).ThenInclude(mt => mt.Topping)
                .AsQueryable();

            if (categoryId.HasValue)
            {
                query = query.Where(m => m.CategoryId == categoryId.Value);
            }

            var items = await query.OrderBy(m => m.SortOrder).ToListAsync();

            return items.Select(m => new MenuItemDto
            {
                MenuItemId = m.MenuItemId,
                TenantId = m.TenantId,
                CategoryId = m.CategoryId,
                CategoryName = m.Category?.Name ?? string.Empty,
                Name = m.Name,
                Description = m.Description,
                BasePrice = m.BasePrice,
                ImageUrl = m.ImageUrl,
                Rating = m.Rating,
                IsFeatured = m.IsFeatured,
                IsAvailable = m.IsAvailable,
                SortOrder = m.SortOrder,
                Sizes = m.MenuItemSizes.Select(s => new SizeDto { SizeId = s.SizeId, Name = s.Size?.Name ?? "", ExtraPrice = s.ExtraPrice }).ToList(),
                Toppings = m.MenuItemToppings.Select(t => new ToppingDto { ToppingId = t.ToppingId, Name = t.Topping?.Name ?? "", Price = t.Topping?.Price ?? 0, IsAvailable = t.Topping?.IsAvailable ?? true }).ToList()
            }).ToList();
        }

        public async Task<MenuItemDto?> GetByIdAsync(int menuItemId)
        {
            var m = await _db.MenuItems
                .Include(m => m.Category)
                .Include(m => m.MenuItemSizes).ThenInclude(ms => ms.Size)
                .Include(m => m.MenuItemToppings).ThenInclude(mt => mt.Topping)
                .FirstOrDefaultAsync(m => m.MenuItemId == menuItemId);

            if (m == null) return null;

            return new MenuItemDto
            {
                MenuItemId = m.MenuItemId,
                TenantId = m.TenantId,
                CategoryId = m.CategoryId,
                CategoryName = m.Category?.Name ?? string.Empty,
                Name = m.Name,
                Description = m.Description,
                BasePrice = m.BasePrice,
                ImageUrl = m.ImageUrl,
                Rating = m.Rating,
                IsFeatured = m.IsFeatured,
                IsAvailable = m.IsAvailable,
                SortOrder = m.SortOrder,
                Sizes = m.MenuItemSizes.Select(s => new SizeDto { SizeId = s.SizeId, Name = s.Size?.Name ?? "", ExtraPrice = s.ExtraPrice }).ToList(),
                Toppings = m.MenuItemToppings.Select(t => new ToppingDto { ToppingId = t.ToppingId, Name = t.Topping?.Name ?? "", Price = t.Topping?.Price ?? 0, IsAvailable = t.Topping?.IsAvailable ?? true }).ToList()
            };
        }

        public async Task<MenuItemDto> CreateAsync(int tenantId, CreateMenuItemDto dto)
        {
            var item = new MenuItem
            {
                TenantId = tenantId,
                CategoryId = dto.CategoryId,
                Name = dto.Name.Trim(),
                Description = dto.Description,
                BasePrice = dto.BasePrice,
                ImageUrl = dto.ImageUrl,
                IsFeatured = dto.IsFeatured,
                IsAvailable = dto.IsAvailable,
                SortOrder = dto.SortOrder,
                CreatedAt = DateTime.UtcNow
            };
            _db.MenuItems.Add(item);
            await _db.SaveChangesAsync();

            if (dto.SizeIds != null && dto.SizeIds.Any())
            {
                foreach (var sId in dto.SizeIds)
                {
                    _db.MenuItemSizes.Add(new MenuItemSize { MenuItemId = item.MenuItemId, SizeId = sId });
                }
            }

            if (dto.ToppingIds != null && dto.ToppingIds.Any())
            {
                foreach (var tId in dto.ToppingIds)
                {
                    _db.MenuItemToppings.Add(new MenuItemTopping { MenuItemId = item.MenuItemId, ToppingId = tId });
                }
            }
            await _db.SaveChangesAsync();

            return (await GetByIdAsync(item.MenuItemId))!;
        }

        public async Task<MenuItemDto> UpdateAsync(int tenantId, int menuItemId, CreateMenuItemDto dto)
        {
            var item = await _db.MenuItems.FirstOrDefaultAsync(m => m.TenantId == tenantId && m.MenuItemId == menuItemId);
            if (item == null) throw new NotFoundException("Không tìm thấy món ăn.");

            item.CategoryId = dto.CategoryId;
            item.Name = dto.Name.Trim();
            item.Description = dto.Description;
            item.BasePrice = dto.BasePrice;
            item.ImageUrl = dto.ImageUrl;
            item.IsFeatured = dto.IsFeatured;
            item.IsAvailable = dto.IsAvailable;
            item.SortOrder = dto.SortOrder;
            item.UpdatedAt = DateTime.UtcNow;

            await _db.SaveChangesAsync();
            return (await GetByIdAsync(item.MenuItemId))!;
        }

        public async Task DeleteAsync(int tenantId, int menuItemId)
        {
            var item = await _db.MenuItems.FirstOrDefaultAsync(m => m.TenantId == tenantId && m.MenuItemId == menuItemId && !m.IsDeleted);
            if (item == null) throw new NotFoundException("Không tìm thấy món ăn.");

            // Soft delete
            item.IsDeleted = true;
            item.DeletedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();
        }
    }

    public class TableService : ITableService
    {
        private readonly WebCafeDbContext _db;
        private readonly IConfiguration _configuration;

        public TableService(WebCafeDbContext db, IConfiguration configuration)
        {
            _db = db;
            _configuration = configuration;
        }

        public async Task<List<TableDto>> GetTablesByStoreAsync(int storeId)
        {
            var tables = await _db.Tables
                .Where(t => t.StoreId == storeId && t.IsActive)
                .Include(t => t.Orders)
                .ToListAsync();

            return tables.Select(t =>
            {
                var activeOrder = t.Orders
                    .Where(o => o.Status != "paid" && o.Status != "cancelled")
                    .OrderByDescending(o => o.CreatedAt)
                    .FirstOrDefault();
                return new TableDto
                {
                    TableId = t.TableId,
                    StoreId = t.StoreId,
                    TableNumber = t.TableNumber,
                    Capacity = t.Capacity,
                    Location = t.Location,
                    QRCodeUrl = t.QRCodeUrl,
                    QrToken = t.QrToken,
                    Status = activeOrder != null ? "Occupied" : t.Status,
                    IsActive = t.IsActive,
                    ActiveOrderId = activeOrder?.OrderId,
                    ActiveOrderCode = activeOrder?.OrderCode
                };
            }).ToList();
        }

        public async Task<TableDto> CreateTableAsync(CreateTableDto dto)
        {
            var tableNum = dto.TableNumber.Trim();
            var table = new Table
            {
                StoreId = dto.StoreId,
                TableNumber = tableNum,
                Capacity = dto.Capacity,
                Location = dto.Location,
                Status = "Available",
                IsActive = true
            };
            _db.Tables.Add(table);
            await _db.SaveChangesAsync();
            table.QRCodeUrl = BuildQrUrl(table);
            await _db.SaveChangesAsync();

            return new TableDto
            {
                TableId = table.TableId,
                StoreId = table.StoreId,
                TableNumber = table.TableNumber,
                Capacity = table.Capacity,
                Location = table.Location,
                QRCodeUrl = table.QRCodeUrl,
                QrToken = table.QrToken,
                Status = table.Status,
                IsActive = table.IsActive
            };
        }

        public async Task<TableDto> UpdateStatusAsync(int tableId, string status)
        {
            var table = await _db.Tables.FindAsync(tableId);
            if (table == null) throw new NotFoundException("Không tìm thấy bàn.");

            table.Status = status;
            await _db.SaveChangesAsync();

            return new TableDto
            {
                TableId = table.TableId,
                StoreId = table.StoreId,
                TableNumber = table.TableNumber,
                Capacity = table.Capacity,
                Location = table.Location,
                QRCodeUrl = table.QRCodeUrl,
                QrToken = table.QrToken,
                Status = table.Status,
                IsActive = table.IsActive
            };
        }

        public async Task DeleteTableAsync(int tableId)
        {
            var table = await _db.Tables.FindAsync(tableId);
            if (table == null) throw new NotFoundException("Không tìm thấy bàn.");

            table.IsActive = false;
            await _db.SaveChangesAsync();
        }

        public async Task<TableDto> RegenerateQrAsync(int tableId)
        {
            var table = await _db.Tables.FirstOrDefaultAsync(t => t.TableId == tableId);
            if (table == null) throw new NotFoundException("Không tìm thấy bàn.");
            table.QrToken = Guid.NewGuid().ToString("N");
            table.QRCodeUrl = BuildQrUrl(table);
            await _db.SaveChangesAsync();
            return (await GetTablesByStoreAsync(table.StoreId)).First(t => t.TableId == tableId);
        }

        public async Task<TableQrResolutionDto?> ResolveQrAsync(string qrToken)
        {
            return await _db.Tables
                .Where(t => t.QrToken == qrToken && t.IsActive && t.Store != null && t.Store.IsActive && t.Store.Tenant != null && t.Store.Tenant.IsActive)
                .Select(t => new TableQrResolutionDto
                {
                    StoreId = t.StoreId,
                    TableId = t.TableId,
                    TableNumber = t.TableNumber,
                    StoreName = t.Store!.Name,
                    TenantName = t.Store.Tenant!.Name
                })
                .SingleOrDefaultAsync();
        }

        public async Task<TableQrResolutionDto?> ResolveQrAsyncByIds(int storeId, int tableId)
        {
            return await _db.Tables
                .Where(t => t.StoreId == storeId && t.TableId == tableId && t.IsActive && t.Store != null && t.Store.IsActive && t.Store.Tenant != null && t.Store.Tenant.IsActive)
                .Select(t => new TableQrResolutionDto
                {
                    StoreId = t.StoreId,
                    TableId = t.TableId,
                    TableNumber = t.TableNumber,
                    StoreName = t.Store!.Name,
                    TenantName = t.Store.Tenant!.Name
                })
                .SingleOrDefaultAsync();
        }

        public async Task<TableQrResolutionDto?> ResolveQrAsyncByNumber(int storeId, string tableNumber)
        {
            if (string.IsNullOrWhiteSpace(tableNumber)) return null;
            return await _db.Tables
                .Where(t => t.StoreId == storeId && t.TableNumber == tableNumber && t.IsActive && t.Store != null && t.Store.IsActive && t.Store.Tenant != null && t.Store.Tenant.IsActive)
                .Select(t => new TableQrResolutionDto
                {
                    StoreId = t.StoreId,
                    TableId = t.TableId,
                    TableNumber = t.TableNumber,
                    StoreName = t.Store!.Name,
                    TenantName = t.Store.Tenant!.Name
                })
                .SingleOrDefaultAsync();
        }

        private string BuildQrUrl(Table table)
        {
            var publicUrl = (_configuration["Frontend:PublicUrl"] ?? "http://localhost:5173").TrimEnd('/');
            return $"{publicUrl}/qr/{table.QrToken}";
        }
    }
}
