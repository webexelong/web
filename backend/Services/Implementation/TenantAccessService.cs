using Microsoft.EntityFrameworkCore;
using WebCafe.Backend.Common.Constants;
using WebCafe.Backend.Common.Exceptions;
using WebCafe.Backend.Infrastructure.Data;
using WebCafe.Backend.Services.Abstraction;

namespace WebCafe.Backend.Services.Implementation
{
    public sealed class TenantAccessService : ITenantAccessService
    {
        private readonly WebCafeDbContext _db;
        private readonly ICurrentUserService _currentUser;

        public TenantAccessService(WebCafeDbContext db, ICurrentUserService currentUser)
        {
            _db = db;
            _currentUser = currentUser;
        }

        public void EnsureTenantAccess(int tenantId)
        {
            if (_currentUser.IsSystemAdmin) return;
            if (_currentUser.TenantId != tenantId) throw new ForbiddenException();
        }

        public async Task EnsureStoreAccessAsync(int storeId)
        {
            var store = await _db.Stores
                .AsNoTracking()
                .Where(s => s.StoreId == storeId)
                .Select(s => new { s.TenantId })
                .SingleOrDefaultAsync();

            if (store == null)
            {
                throw new NotFoundException("Không tìm thấy cửa hàng.");
            }

            EnsureScope(store.TenantId, storeId);
        }

        public async Task EnsureTableAccessAsync(int tableId)
        {
            var table = await _db.Tables
                .AsNoTracking()
                .Where(t => t.TableId == tableId)
                .Select(t => new { t.StoreId, TenantId = t.Store!.TenantId })
                .SingleOrDefaultAsync();

            if (table == null)
            {
                throw new NotFoundException("Không tìm thấy bàn.");
            }

            EnsureScope(table.TenantId, table.StoreId);
        }

        public async Task EnsureOrderAccessAsync(int orderId)
        {
            var order = await _db.Orders
                .AsNoTracking()
                .Where(o => o.OrderId == orderId)
                .Select(o => new { o.TenantId, o.StoreId })
                .SingleOrDefaultAsync();

            if (order == null)
            {
                throw new NotFoundException("Không tìm thấy đơn hàng.");
            }

            EnsureScope(order.TenantId, order.StoreId);
        }

        private void EnsureScope(int tenantId, int storeId)
        {
            if (_currentUser.IsSystemAdmin)
            {
                return;
            }

            EnsureTenantAccess(tenantId);

            var isOwner = string.Equals(_currentUser.Role, AppRoles.TenantOwner, StringComparison.OrdinalIgnoreCase);
            if (!isOwner && _currentUser.StoreId.HasValue && _currentUser.StoreId.Value != storeId)
            {
                throw new ForbiddenException();
            }
        }
    }
}
