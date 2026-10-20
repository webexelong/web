using System.ComponentModel.DataAnnotations;

namespace WebCafe.Backend.Models.DTOs.Staff;

public sealed class CreateStaffRequest
{
    [Range(1, int.MaxValue, ErrorMessage = "Vui lòng chọn cửa hàng.")]
    public int StoreId { get; set; }

    [Required(ErrorMessage = "Vui lòng nhập tên đăng nhập.")]
    [MinLength(3, ErrorMessage = "Tên đăng nhập phải có ít nhất 3 ký tự.")]
    [MaxLength(50, ErrorMessage = "Tên đăng nhập không được vượt quá 50 ký tự.")]
    [RegularExpression("^[A-Za-z0-9_.-]+$", ErrorMessage = "Tên đăng nhập chỉ được chứa chữ, số, dấu chấm, gạch ngang hoặc gạch dưới.")]
    public string Username { get; set; } = string.Empty;

    [Required(ErrorMessage = "Vui lòng nhập họ tên nhân viên.")]
    [MinLength(2, ErrorMessage = "Họ tên phải có ít nhất 2 ký tự.")]
    [MaxLength(100, ErrorMessage = "Họ tên không được vượt quá 100 ký tự.")]
    public string FullName { get; set; } = string.Empty;

    [EmailAddress(ErrorMessage = "Email không đúng định dạng.")]
    [MaxLength(150, ErrorMessage = "Email không được vượt quá 150 ký tự.")]
    public string? Email { get; set; }

    [RegularExpression("^(0|\\+84)[0-9]{8,11}$", ErrorMessage = "Số điện thoại không hợp lệ.")]
    [MaxLength(15, ErrorMessage = "Số điện thoại không được vượt quá 15 ký tự.")]
    public string? Phone { get; set; }

    [Required(ErrorMessage = "Vui lòng nhập mật khẩu.")]
    [MinLength(8, ErrorMessage = "Mật khẩu phải có ít nhất 8 ký tự.")]
    [RegularExpression(@"^(?=.*[0-9])(?=.*[!@#$%^&*(),.?""':{}|<>]).{8,}$", ErrorMessage = "Mật khẩu phải gồm ít nhất một chữ số và một ký tự đặc biệt.")]
    public string Password { get; set; } = string.Empty;
}

public sealed class UpdateStaffRequest
{
    [Range(1, int.MaxValue, ErrorMessage = "Vui lòng chọn cửa hàng.")]
    public int StoreId { get; set; }

    [Required(ErrorMessage = "Vui lòng nhập họ tên nhân viên.")]
    [MinLength(2, ErrorMessage = "Họ tên phải có ít nhất 2 ký tự.")]
    [MaxLength(100, ErrorMessage = "Họ tên không được vượt quá 100 ký tự.")]
    public string FullName { get; set; } = string.Empty;

    [EmailAddress(ErrorMessage = "Email không đúng định dạng.")]
    [MaxLength(150, ErrorMessage = "Email không được vượt quá 150 ký tự.")]
    public string? Email { get; set; }

    [RegularExpression("^(0|\\+84)[0-9]{8,11}$", ErrorMessage = "Số điện thoại không hợp lệ.")]
    [MaxLength(15, ErrorMessage = "Số điện thoại không được vượt quá 15 ký tự.")]
    public string? Phone { get; set; }

    [MinLength(8, ErrorMessage = "Mật khẩu phải có ít nhất 8 ký tự.")]
    [RegularExpression(@"^(?=.*[0-9])(?=.*[!@#$%^&*(),.?""':{}|<>]).{8,}$", ErrorMessage = "Mật khẩu phải gồm ít nhất một chữ số và một ký tự đặc biệt.")]
    public string? Password { get; set; }
}

public sealed class UpdateStaffStatusRequest
{
    public bool IsActive { get; set; }
}

public sealed class StaffDto
{
    public int StaffId { get; set; }
    public int StoreId { get; set; }
    public string StoreName { get; set; } = string.Empty;
    public string Username { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string? Email { get; set; }
    public string? Phone { get; set; }
    public string Role { get; set; } = "Staff";
    public bool IsActive { get; set; }
    public DateTime CreatedAt { get; set; }
}
