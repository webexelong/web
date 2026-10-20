using System.ComponentModel.DataAnnotations;

namespace WebCafe.Backend.Models.DTOs.Auth
{
    public class LoginRequest
    {
        [Required(ErrorMessage = "Tên đăng nhập là bắt buộc.")]
        public string Username { get; set; } = string.Empty;

        [Required(ErrorMessage = "Mật khẩu là bắt buộc.")]
        public string Password { get; set; } = string.Empty;

        public int? StoreId { get; set; }
    }

    public class LoginResponse
    {
        public string Token { get; set; } = string.Empty;
        public string Username { get; set; } = string.Empty;
        public string FullName { get; set; } = string.Empty;
        public string Role { get; set; } = string.Empty;
        public int TenantId { get; set; }
        public int? StoreId { get; set; }
        public string? StoreName { get; set; }
        public string? BrandName { get; set; }
    }

    public class RegisterRequest
    {
        [EmailAddress(ErrorMessage = "Email không đúng định dạng. Vui lòng nhập email hợp lệ (vd: example@email.com).")]
        public string? Email { get; set; }

        [Required(ErrorMessage = "Số điện thoại là bắt buộc.")]
        [Phone(ErrorMessage = "Số điện thoại không đúng định dạng.")]
        [RegularExpression(@"^(0|\+84)[0-9]{9,10}$", ErrorMessage = "Số điện thoại phải bắt đầu bằng 0 hoặc +84 và có 10-11 số (vd: 0912345678).")]
        public string Phone { get; set; } = string.Empty;

        public int? StoreId { get; set; }

        [Required(ErrorMessage = "Mật khẩu là bắt buộc.")]
        [MinLength(8, ErrorMessage = "Mật khẩu phải có ít nhất 8 ký tự.")]
        [RegularExpression(@"^(?=.*[0-9])(?=.*[!@#$%^&*(),.?""':{}|<>]).{8,}$", ErrorMessage = "Mật khẩu phải có ít nhất 8 ký tự, bao gồm cả chữ số và ký tự đặc biệt (!@#$%^&*...).")]
        public string Password { get; set; } = string.Empty;

        [Required(ErrorMessage = "Họ và tên là bắt buộc.")]
        [MinLength(2, ErrorMessage = "Họ và tên phải có ít nhất 2 ký tự.")]
        [RegularExpression(@"^[^\s].*[^\s]$", ErrorMessage = "Họ và tên không được chỉ chứa khoảng trắng.")]
        public string FullName { get; set; } = string.Empty;
    }

    public class RegisterResponse
    {
        public int CustomerId { get; set; }
        public string? Email { get; set; }
        public string Phone { get; set; } = string.Empty;
        public string FullName { get; set; } = string.Empty;
        public string Message { get; set; } = string.Empty;
        public string? Token { get; set; }
        public string Role { get; set; } = "Customer";
        public int TenantId { get; set; } = 1;
    }

    public class OwnerSignupRequest
    {
        [Required(ErrorMessage = "Vui lòng nhập Email của bạn.")]
        [EmailAddress(ErrorMessage = "Email không đúng định dạng. Vui lòng nhập email hợp lệ (vd: tenquan@gmail.com).")]
        public string Email { get; set; } = string.Empty;

        [Required(ErrorMessage = "Vui lòng nhập mật khẩu.")]
        [MinLength(8, ErrorMessage = "Mật khẩu phải có tối thiểu 8 ký tự.")]
        [RegularExpression(@"^(?=.*[0-9])(?=.*[!@#$%^&*(),.?""':{}|<>]).{8,}$", ErrorMessage = "Mật khẩu phải có ít nhất 8 ký tự, bao gồm cả chữ số và ký tự đặc biệt.")]
        public string Password { get; set; } = string.Empty;

        [Required(ErrorMessage = "Vui lòng nhập tên quán.")]
        [MinLength(2, ErrorMessage = "Tên quán phải có ít nhất 2 ký tự.")]
        [MaxLength(100, ErrorMessage = "Tên quán không được vượt quá 100 ký tự.")]
        public string StoreName { get; set; } = string.Empty;

        private string? _phone;

        [MaxLength(15, ErrorMessage = "Số điện thoại không được vượt quá 15 ký tự.")]
        [RegularExpression(@"^(0|\+84)[0-9]{8,11}$", ErrorMessage = "Số điện thoại không hợp lệ (ví dụ: 0912345678).")]
        public string? Phone
        {
            get => _phone;
            set => _phone = string.IsNullOrWhiteSpace(value) ? null : value.Trim();
        }

        [MaxLength(20)]
        public string Plan { get; set; } = "basic";
    }

    public class OwnerSignupResponse
    {
        public int TenantId { get; set; }
        public int StoreId { get; set; }
        public string Email { get; set; } = string.Empty;
        public string Plan { get; set; } = "basic";
        public DateTime TrialEndsAt { get; set; }
        public bool EmailVerificationRequired { get; set; } = true;
        public bool EmailSent { get; set; }
        public string? VerificationUrl { get; set; }
    }
}
