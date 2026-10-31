using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using WebCafe.Backend.Common.Constants;
using WebCafe.Backend.Common.Models;
using WebCafe.Backend.Infrastructure.Storage;
using WebCafe.Backend.Services.Abstraction;

namespace WebCafe.Backend.Controllers
{
    public class UploadImageRequest
    {
        public IFormFile? File { get; set; }
        public string SubType { get; set; } = "menu";
        public int? TenantId { get; set; }
    }

    public class UploadImageResponse
    {
        public string ImageUrl { get; set; } = string.Empty;
    }

    [ApiController]
    [Route("api/[controller]")]
    public class UploadController : ControllerBase
    {
        private readonly IFileStorageService _fileStorage;
        private readonly ICurrentUserService _currentUser;

        public UploadController(IFileStorageService fileStorage, ICurrentUserService currentUser)
        {
            _fileStorage = fileStorage;
            _currentUser = currentUser;
        }

        [HttpPost("image")]
        [Consumes("multipart/form-data")]
        [Authorize(Roles = $"{AppRoles.TenantOwner},{AppRoles.SystemAdmin},{AppRoles.Staff}")]
        [RequestSizeLimit(5 * 1024 * 1024)] // 5MB
        public async Task<ActionResult<ApiResponse<UploadImageResponse>>> UploadImage([FromForm] UploadImageRequest request)
        {
            var file = request?.File;
            if (file == null || file.Length == 0)
            {
                return BadRequest(ApiResponse<UploadImageResponse>.Fail("Vui lòng chọn tệp hình ảnh để tải lên."));
            }

            if (file.Length > 5 * 1024 * 1024)
            {
                return BadRequest(ApiResponse<UploadImageResponse>.Fail("Dung lượng ảnh vượt quá 5MB. Vui lòng chọn ảnh nhẹ hơn."));
            }

            var allowedExts = new[] { ".jpg", ".jpeg", ".png", ".webp" };
            var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
            if (!allowedExts.Contains(ext))
            {
                return BadRequest(ApiResponse<UploadImageResponse>.Fail("Định dạng ảnh không hợp lệ. Chỉ chấp nhận JPG, PNG hoặc WEBP."));
            }

            // Tenant resolution: từ JWT claims, request body, hoặc fallback an toàn
            var resolvedTenantId = _currentUser.TenantId ?? request?.TenantId;
            var subType = request?.SubType;
            var safeSubType = subType?.ToLowerInvariant() == "avatar" ? "avatar" : "menu";
            var folder = resolvedTenantId.HasValue && resolvedTenantId.Value > 0
                ? $"uploads/tenants/{resolvedTenantId.Value}/{safeSubType}"
                : $"uploads/common/{safeSubType}";

            var relativeUrl = await _fileStorage.SaveFileAsync(file, folder);

            return Ok(ApiResponse<UploadImageResponse>.Ok(
                new UploadImageResponse { ImageUrl = relativeUrl },
                "Tải ảnh lên máy chủ thành công."
            ));
        }
    }
}
