using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WebCafe.Backend.Common.Constants;
using WebCafe.Backend.Common.Exceptions;
using WebCafe.Backend.Common.Helper;
using WebCafe.Backend.Common.Models;
using WebCafe.Backend.Infrastructure.Data;
using WebCafe.Backend.Models.DTOs.Staff;
using WebCafe.Backend.Models.Entities;
using WebCafe.Backend.Services.Abstraction;

namespace WebCafe.Backend.Controllers;

[ApiController]
[Route("api/staff")]
[Authorize(Policy = AppPolicies.TenantAdminAccess)]
public sealed class StaffController : ControllerBase
{
    private readonly WebCafeDbContext _db;
    private readonly ICurrentUserService _currentUser;
    private readonly ITenantAccessService _tenantAccess;
    private readonly ISubscriptionService _subscription;

    public StaffController(
        WebCafeDbContext db,
        ICurrentUserService currentUser,
        ITenantAccessService tenantAccess,
        ISubscriptionService subscription)
    {
        _db = db;
        _currentUser = currentUser;
        _tenantAccess = tenantAccess;
        _subscription = subscription;
    }

    [HttpGet]
    public async Task<ActionResult<ApiResponse<List<StaffDto>>>> GetStaff([FromQuery] int? storeId)
    {
        var resolvedStoreId = storeId ?? _currentUser.StoreId;
        if (!resolvedStoreId.HasValue || resolvedStoreId.Value <= 0)
            throw new ModelValidationException("storeId", "Vui lòng chọn cửa hàng để xem nhân viên.");

        await _tenantAccess.EnsureStoreAccessAsync(resolvedStoreId.Value);
        var staff = await _db.Staff.AsNoTracking()
            .Where(s => s.StoreId == resolvedStoreId.Value)
            .OrderByDescending(s => s.IsActive).ThenBy(s => s.FullName)
            .Select(s => new StaffDto
            {
                StaffId = s.StaffId,
                StoreId = s.StoreId,
                StoreName = s.Store!.Name,
                Username = s.Username,
                FullName = s.FullName,
                Email = s.Email,
                Phone = s.Phone,
                Role = AppRoles.Staff,
                IsActive = s.IsActive,
                CreatedAt = s.CreatedAt
            })
            .ToListAsync();

        return Ok(ApiResponse<List<StaffDto>>.Ok(staff));
    }

    [HttpPost]
    public async Task<ActionResult<ApiResponse<StaffDto>>> CreateStaff([FromBody] CreateStaffRequest request)
    {
        var store = await GetAccessibleStoreAsync(request.StoreId);
        await _subscription.EnsureCanCreateStaffAsync(store.TenantId);

        var username = request.Username.Trim().ToLowerInvariant();
        if (await _db.Staff.AnyAsync(s => s.Username == username))
            throw new AppException("Tên đăng nhập này đã tồn tại. Vui lòng chọn tên khác.", System.Net.HttpStatusCode.Conflict);

        var role = await GetStaffRoleAsync(store.TenantId);
        var staff = new Staff
        {
            StoreId = store.StoreId,
            RoleId = role.RoleId,
            Username = username,
            FullName = request.FullName.Trim(),
            Email = NormalizeOptional(request.Email),
            Phone = NormalizeOptional(request.Phone),
            PasswordHash = SecurityHelper.HashPassword(request.Password),
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };

        _db.Staff.Add(staff);
        await _db.SaveChangesAsync();
        return Ok(ApiResponse<StaffDto>.Ok(ToDto(staff, store.Name), "Tạo tài khoản nhân viên thành công."));
    }

    [HttpPut("{staffId:int}")]
    public async Task<ActionResult<ApiResponse<StaffDto>>> UpdateStaff(int staffId, [FromBody] UpdateStaffRequest request)
    {
        var staff = await _db.Staff.Include(s => s.Store).FirstOrDefaultAsync(s => s.StaffId == staffId);
        if (staff?.Store == null) throw new NotFoundException("Không tìm thấy nhân viên.");

        _tenantAccess.EnsureTenantAccess(staff.Store.TenantId);
        await _tenantAccess.EnsureStoreAccessAsync(request.StoreId);
        var destinationStore = await GetAccessibleStoreAsync(request.StoreId);
        if (destinationStore.TenantId != staff.Store.TenantId)
            throw new ForbiddenException("Không thể chuyển nhân viên sang tenant khác.");

        if (staff.StoreId != request.StoreId)
        {
            await _subscription.EnsureCanCreateStaffAsync(destinationStore.TenantId);
            staff.StoreId = request.StoreId;
        }

        staff.FullName = request.FullName.Trim();
        staff.Email = NormalizeOptional(request.Email);
        staff.Phone = NormalizeOptional(request.Phone);
        if (!string.IsNullOrWhiteSpace(request.Password))
            staff.PasswordHash = SecurityHelper.HashPassword(request.Password);

        await _db.SaveChangesAsync();
        return Ok(ApiResponse<StaffDto>.Ok(ToDto(staff, destinationStore.Name), "Cập nhật nhân viên thành công."));
    }

    [HttpPatch("{staffId:int}/status")]
    public async Task<ActionResult<ApiResponse<StaffDto>>> UpdateStatus(int staffId, [FromBody] UpdateStaffStatusRequest request)
    {
        var staff = await _db.Staff.Include(s => s.Store).FirstOrDefaultAsync(s => s.StaffId == staffId);
        if (staff?.Store == null) throw new NotFoundException("Không tìm thấy nhân viên.");
        _tenantAccess.EnsureTenantAccess(staff.Store.TenantId);
        await _tenantAccess.EnsureStoreAccessAsync(staff.StoreId);

        if (_currentUser.UserId == staff.StaffId && !request.IsActive)
            throw new ForbiddenException("Bạn không thể tự khóa tài khoản đang đăng nhập.");
        if (request.IsActive && !staff.IsActive)
            await _subscription.EnsureCanCreateStaffAsync(staff.Store.TenantId);

        staff.IsActive = request.IsActive;
        await _db.SaveChangesAsync();
        return Ok(ApiResponse<StaffDto>.Ok(ToDto(staff, staff.Store.Name), request.IsActive ? "Đã mở khóa nhân viên." : "Đã khóa nhân viên."));
    }

    [HttpDelete("{staffId:int}")]
    public async Task<ActionResult<ApiResponse<object>>> DeleteStaff(int staffId)
    {
        var staff = await _db.Staff.Include(s => s.Store).FirstOrDefaultAsync(s => s.StaffId == staffId);
        if (staff?.Store == null) throw new NotFoundException("Không tìm thấy nhân viên.");
        _tenantAccess.EnsureTenantAccess(staff.Store.TenantId);
        await _tenantAccess.EnsureStoreAccessAsync(staff.StoreId);
        if (_currentUser.UserId == staff.StaffId)
            throw new ForbiddenException("Bạn không thể xóa tài khoản đang đăng nhập.");

        staff.IsActive = false;
        await _db.SaveChangesAsync();
        return Ok(ApiResponse<object>.Ok(new { }, "Đã vô hiệu hóa nhân viên."));
    }

    private async Task<Store> GetAccessibleStoreAsync(int storeId)
    {
        await _tenantAccess.EnsureStoreAccessAsync(storeId);
        var store = await _db.Stores.FirstOrDefaultAsync(s => s.StoreId == storeId && s.IsActive);
        if (store == null) throw new NotFoundException("Không tìm thấy cửa hàng đang hoạt động.");
        return store;
    }

    private async Task<Role> GetStaffRoleAsync(int tenantId)
    {
        var role = await _db.Roles.FirstOrDefaultAsync(r => r.TenantId == tenantId && r.Name == AppRoles.Staff);
        if (role != null) return role;
        role = new Role { TenantId = tenantId, Name = AppRoles.Staff, Description = "Nhân viên quầy và thanh toán" };
        _db.Roles.Add(role);
        await _db.SaveChangesAsync();
        return role;
    }

    private static string? NormalizeOptional(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private static StaffDto ToDto(Staff staff, string storeName) => new()
    {
        StaffId = staff.StaffId,
        StoreId = staff.StoreId,
        StoreName = storeName,
        Username = staff.Username,
        FullName = staff.FullName,
        Email = staff.Email,
        Phone = staff.Phone,
        Role = AppRoles.Staff,
        IsActive = staff.IsActive,
        CreatedAt = staff.CreatedAt
    };
}
