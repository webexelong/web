using Microsoft.EntityFrameworkCore;
using System.Security.Cryptography;
using System.Text;
using WebCafe.Backend.Common.Constants;
using WebCafe.Backend.Common.Exceptions;
using WebCafe.Backend.Common.Helper;
using WebCafe.Backend.Infrastructure.Data;
using WebCafe.Backend.Models.DTOs.Auth;
using WebCafe.Backend.Models.Entities;
using WebCafe.Backend.Services.Abstraction;

namespace WebCafe.Backend.Services.Implementation
{
    public class AuthService : IAuthService
    {
        private readonly WebCafeDbContext _db;
        private readonly IConfiguration _config;
        private readonly IEmailService _emailService;

        public AuthService(WebCafeDbContext db, IConfiguration config, IEmailService emailService)
        {
            _db = db;
            _config = config;
            _emailService = emailService;
        }

        public async Task<LoginResponse> LoginStaffAsync(LoginRequest request)
        {
            var username = request.Username.Trim().ToLowerInvariant();
            var staff = await _db.Staff
                .Include(s => s.Store)
                    .ThenInclude(st => st!.Tenant)
                .Include(s => s.Role)
                .FirstOrDefaultAsync(s => s.Username == username && s.IsActive && s.Store != null && s.Store.IsActive && s.Store.Tenant != null && s.Store.Tenant.IsActive);

            if (staff == null || !SecurityHelper.VerifyPassword(request.Password, staff.PasswordHash))
            {
                throw new AppException("Tên đăng nhập hoặc mật khẩu không chính xác.");
            }

            // Các role cũ trong database đều được xem như Staff trong mô hình mới.
            var roleName = AppRoles.Staff;
            var tenantId = staff.Store?.TenantId ?? 0;
            var storeId = staff.StoreId;

            var jwtKey = GetRequiredJwtSetting("SecretKey");
            var jwtIssuer = _config["Jwt:Issuer"] ?? "WebCafeBackend";
            var jwtAudience = _config["Jwt:Audience"] ?? "WebCafeClients";

            var token = JwtHelper.GenerateToken(
                staff.StaffId.ToString(),
                staff.Username,
                roleName,
                tenantId,
                storeId,
                jwtKey,
                jwtIssuer,
                jwtAudience
            );

            return new LoginResponse
            {
                Token = token,
                Username = staff.Username,
                FullName = staff.FullName,
                Role = roleName,
                TenantId = tenantId,
                StoreId = storeId,
                StoreName = staff.Store?.Name,
                BrandName = staff.Store?.Tenant?.Name
            };
        }

        public async Task<LoginResponse> LoginTenantOwnerAsync(LoginRequest request)
        {
            var tenant = await _db.Tenants
                .Include(t => t.Stores)
                .FirstOrDefaultAsync(t => (t.OwnerEmail == request.Username || t.OwnerPhone == request.Username) && t.IsActive);

            if (tenant == null || !SecurityHelper.VerifyPassword(request.Password, tenant.OwnerPasswordHash))
            {
                throw new AppException("Tên đăng nhập hoặc mật khẩu chủ quán không chính xác.");
            }
            if (!tenant.OwnerEmailVerified)
                throw new AppException("Email chủ quán chưa được xác minh. Vui lòng kiểm tra email.");

            var jwtKey = GetRequiredJwtSetting("SecretKey");
            var jwtIssuer = _config["Jwt:Issuer"] ?? "WebCafeBackend";
            var jwtAudience = _config["Jwt:Audience"] ?? "WebCafeClients";

            var defaultStore = tenant.Stores.FirstOrDefault(s => s.IsActive);

            var token = JwtHelper.GenerateToken(
                tenant.TenantId.ToString(),
                tenant.OwnerEmail,
                AppRoles.TenantOwner,
                tenant.TenantId,
                defaultStore?.StoreId,
                jwtKey,
                jwtIssuer,
                jwtAudience
            );

            return new LoginResponse
            {
                Token = token,
                Username = tenant.OwnerEmail,
                FullName = tenant.OwnerName,
                Role = AppRoles.TenantOwner,
                TenantId = tenant.TenantId,
                StoreId = defaultStore?.StoreId,
                StoreName = defaultStore?.Name,
                BrandName = tenant.Name
            };
        }

        public async Task<LoginResponse> LoginSystemAdminAsync(LoginRequest request)
        {
            var admin = await _db.SystemAdmins
                .FirstOrDefaultAsync(a => a.Username == request.Username && a.IsActive);

            if (admin == null || !SecurityHelper.VerifyPassword(request.Password, admin.PasswordHash))
            {
                throw new AppException("Tên đăng nhập hoặc mật khẩu quản trị viên không chính xác.");
            }

            var jwtKey = GetRequiredJwtSetting("SecretKey");
            var jwtIssuer = _config["Jwt:Issuer"] ?? "WebCafeBackend";
            var jwtAudience = _config["Jwt:Audience"] ?? "WebCafeClients";

            var token = JwtHelper.GenerateToken(
                admin.AdminId.ToString(),
                admin.Username,
                AppRoles.SystemAdmin,
                null, // SystemAdmin không thuộc tenant nào
                null,
                jwtKey,
                jwtIssuer,
                jwtAudience,
                48 // SystemAdmin có token tồn tại lâu hơn
            );

            return new LoginResponse
            {
                Token = token,
                Username = admin.Username,
                FullName = admin.FullName,
                Role = AppRoles.SystemAdmin,
                TenantId = 0,
                StoreId = null,
                StoreName = null,
                BrandName = "WebCafe System"
            };
        }

        public async Task<LoginResponse> LoginCustomerAsync(LoginRequest request)
        {
            var phone = request.Username.Trim().Replace(" ", "");
            Store? store = null;
            if (request.StoreId.HasValue && request.StoreId.Value > 0)
            {
                store = await _db.Stores.AsNoTracking().FirstOrDefaultAsync(s => s.StoreId == request.StoreId && s.IsActive);
            }

            Customer? customer = null;
            if (store != null)
            {
                customer = await _db.Customers
                    .Include(c => c.Tenant)
                    .FirstOrDefaultAsync(c => c.Phone == phone && c.TenantId == store.TenantId);
            }
            else
            {
                customer = await _db.Customers
                    .Include(c => c.Tenant)
                    .FirstOrDefaultAsync(c => c.Phone == phone);
            }

            var validPassword = false;
            if (!string.IsNullOrWhiteSpace(customer?.PasswordHash))
            {
                try { validPassword = BCrypt.Net.BCrypt.Verify(request.Password, customer.PasswordHash); }
                catch (BCrypt.Net.SaltParseException) { validPassword = false; }
            }
            if (customer == null || !validPassword)
            {
                throw new AppException("Số điện thoại hoặc mật khẩu không đúng.");
            }

            customer.VisitCount += 1;
            customer.LastVisitAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();

            var jwtKey = GetRequiredJwtSetting("SecretKey");
            var jwtIssuer = _config["Jwt:Issuer"] ?? "WebCafeBackend";
            var jwtAudience = _config["Jwt:Audience"] ?? "WebCafeClients";

            var token = JwtHelper.GenerateToken(
                customer.CustomerId.ToString(),
                customer.Phone,
                AppRoles.Customer,
                customer.TenantId,
                null,
                jwtKey,
                jwtIssuer,
                jwtAudience,
                customerId: customer.CustomerId
            );

            return new LoginResponse
            {
                Token = token,
                Username = customer.Phone,
                FullName = customer.Name ?? "Khách hàng",
                Role = AppRoles.Customer,
                TenantId = customer.TenantId,
                StoreId = null,
                StoreName = null,
                BrandName = customer.Tenant?.Name ?? "WebCafe"
            };
        }

        public async Task<RegisterResponse> RegisterCustomerAsync(RegisterRequest request)
        {
            var phone = request.Phone.Trim().Replace(" ", "");

            Store? store = null;
            if (request.StoreId.HasValue && request.StoreId.Value > 0)
            {
                store = await _db.Stores.Include(s => s.Tenant)
                    .FirstOrDefaultAsync(s => s.StoreId == request.StoreId.Value && s.IsActive && s.Tenant != null && s.Tenant.IsActive);
            }

            if (store == null)
            {
                store = await _db.Stores.Include(s => s.Tenant)
                    .FirstOrDefaultAsync(s => s.IsActive && s.Tenant != null && s.Tenant.IsActive);
            }

            if (store == null) throw new AppException("Hệ thống hiện chưa có cửa hàng nào hoạt động.");

            var existingByPhone = await _db.Customers
                .FirstOrDefaultAsync(c => c.Phone == phone && c.TenantId == store.TenantId);

            if (existingByPhone != null)
            {
                throw new AppException("Số điện thoại này đã được đăng ký tài khoản. Vui lòng đăng nhập.");
            }

            var customer = new Customer
            {
                TenantId = store.TenantId,
                Phone = phone,
                PasswordHash = Common.Helper.SecurityHelper.HashPassword(request.Password),
                Name = request.FullName.Trim(),
                TotalPoints = 0,
                TotalSpent = 0,
                VisitCount = 1,
                CreatedAt = DateTime.UtcNow,
                LastVisitAt = DateTime.UtcNow
            };

            _db.Customers.Add(customer);
            await _db.SaveChangesAsync();

            // Tự động tạo Token để đăng nhập ngay lập tức (Auto-login)
            var jwtKey = GetRequiredJwtSetting("SecretKey");
            var jwtIssuer = _config["Jwt:Issuer"] ?? "WebCafeBackend";
            var jwtAudience = _config["Jwt:Audience"] ?? "WebCafeClients";

            var token = JwtHelper.GenerateToken(
                customer.CustomerId.ToString(),
                customer.Phone,
                AppRoles.Customer,
                customer.TenantId,
                null,
                jwtKey,
                jwtIssuer,
                jwtAudience,
                customerId: customer.CustomerId
            );

            return new RegisterResponse
            {
                CustomerId = customer.CustomerId,
                Email = request.Email,
                Phone = customer.Phone,
                FullName = customer.Name ?? string.Empty,
                Message = "Đăng ký thành công!",
                Token = token,
                Role = AppRoles.Customer,
                TenantId = customer.TenantId
            };
        }

        public async Task<OwnerSignupResponse> SignupOwnerAsync(OwnerSignupRequest request)
        {
            var email = request.Email.Trim().ToLowerInvariant();
            var planCode = request.Plan.Trim().ToLowerInvariant();
            if (planCode is not ("basic" or "premium" or "pro"))
                throw new AppException("Gói dùng thử không hợp lệ.");
            var existingTenant = await _db.Tenants.Include(t => t.Stores)
                .FirstOrDefaultAsync(t => t.OwnerEmail == email);
            if (existingTenant != null)
            {
                if (existingTenant.OwnerEmailVerified || !SecurityHelper.VerifyPassword(request.Password, existingTenant.OwnerPasswordHash))
                    throw new AppException("Email này đã được đăng ký. Vui lòng đăng nhập hoặc dùng email khác.");

                await using var retryTransaction = await _db.Database.BeginTransactionAsync();
                var retryNow = DateTime.UtcNow;
                var retryToken = CreateVerificationToken();
                existingTenant.EmailVerificationTokenHash = HashToken(retryToken);
                existingTenant.EmailVerificationExpiresAt = retryNow.AddHours(24);
                var retryUrl = BuildVerificationUrl(retryToken);
                await _db.SaveChangesAsync();
                await _emailService.SendVerificationEmailAsync(email, retryUrl);
                await retryTransaction.CommitAsync();
                var existingStore = existingTenant.Stores.FirstOrDefault(s => s.IsActive);
                var trialSubscription = await _db.TenantSubscriptions.Where(s => s.TenantId == existingTenant.TenantId)
                    .OrderByDescending(s => s.CreatedAt).FirstOrDefaultAsync();
                return new OwnerSignupResponse
                {
                    TenantId = existingTenant.TenantId,
                    StoreId = existingStore?.StoreId ?? 0,
                    Email = email,
                    Plan = existingTenant.Plan,
                    TrialEndsAt = trialSubscription?.TrialEndsAt ?? retryNow,
                    EmailSent = true,
                    VerificationUrl = _config.GetValue<bool>("Email:ExposeVerificationUrl") ? retryUrl : null
                };
            }

            var now = DateTime.UtcNow;
            var trialEnds = now.AddDays(14);
            await using var transaction = await _db.Database.BeginTransactionAsync();
            var rawToken = CreateVerificationToken();
            var tenant = new Tenant
            {
                Name = request.StoreName.Trim(),
                Slug = await CreateUniqueSlugAsync(request.StoreName),
                OwnerName = request.StoreName.Trim(),
                OwnerPhone = request.Phone?.Trim() ?? string.Empty,
                OwnerEmail = email,
                OwnerPasswordHash = SecurityHelper.HashPassword(request.Password),
                OwnerEmailVerified = false,
                EmailVerificationTokenHash = HashToken(rawToken),
                EmailVerificationExpiresAt = now.AddHours(24),
                Plan = planCode,
                MaxStores = planCode == "pro" ? 10 : planCode == "premium" ? 5 : 1,
                IsActive = true,
                CreatedAt = now
            };
            _db.Tenants.Add(tenant);
            await _db.SaveChangesAsync();

            var plan = await _db.SubscriptionPlans.FirstOrDefaultAsync(p => p.Code == planCode);
            if (plan == null)
            {
                plan = new SubscriptionPlan
                {
                    Code = planCode,
                    Name = planCode.ToUpperInvariant(),
                    MonthlyPrice = planCode == "pro" ? 1999000 : planCode == "premium" ? 1299000 : 239000,
                    MaxStores = planCode == "pro" ? 10 : planCode == "premium" ? 5 : 1,
                    MaxStaff = planCode == "pro" ? 50 : planCode == "premium" ? 20 : 5,
                    MaxTablesPerStore = planCode == "pro" ? 100 : planCode == "premium" ? 50 : 20,
                    IsActive = true
                };
                _db.SubscriptionPlans.Add(plan);
                await _db.SaveChangesAsync();
            }

            var store = new Store { TenantId = tenant.TenantId, Name = request.StoreName.Trim(), Phone = request.Phone?.Trim(), IsActive = true };
            _db.Stores.Add(store);
            await _db.SaveChangesAsync();
            var subscription = new TenantSubscription { TenantId = tenant.TenantId, PlanId = plan.PlanId, Status = "trialing", StartsAt = now, TrialEndsAt = trialEnds, CreatedAt = now };
            _db.TenantSubscriptions.Add(subscription);
            await _db.SaveChangesAsync();
            _db.SubscriptionBillingRecords.Add(new SubscriptionBillingRecord { TenantId = tenant.TenantId, SubscriptionId = subscription.SubscriptionId, Status = "trial", Amount = 0, BillingPeriodStart = now, BillingPeriodEnd = trialEnds, CreatedAt = now });

            var coffeeCategory = new Category { TenantId = tenant.TenantId, Name = "Cà Phê Pha Máy", Icon = "coffee", SortOrder = 1, IsActive = true };
            var teaCategory = new Category { TenantId = tenant.TenantId, Name = "Trà & Trái Cây", Icon = "energy_savings_leaf", SortOrder = 2, IsActive = true };
            var smoothieCategory = new Category { TenantId = tenant.TenantId, Name = "Sinh Tố & Trà Sữa", Icon = "bubble_chart", SortOrder = 3, IsActive = true };
            var cakeCategory = new Category { TenantId = tenant.TenantId, Name = "Bánh Ngọt", Icon = "bakery_dining", SortOrder = 4, IsActive = true };
            var giftCategory = new Category { TenantId = tenant.TenantId, Name = "Quà Lưu Niệm", Icon = "local_mall", SortOrder = 5, IsActive = true };
            _db.Categories.AddRange(coffeeCategory, teaCategory, smoothieCategory, cakeCategory, giftCategory);
            _db.MenuItems.AddRange(
                new MenuItem { TenantId = tenant.TenantId, Category = coffeeCategory, Name = "Cà phê sữa", BasePrice = 35000, Description = "Món mẫu để bắt đầu dùng thử.", IsAvailable = true, IsFeatured = true, SortOrder = 1 },
                new MenuItem { TenantId = tenant.TenantId, Category = teaCategory, Name = "Trà đào", BasePrice = 40000, Description = "Món mẫu để bắt đầu dùng thử.", IsAvailable = true, SortOrder = 2 });
            _db.Tables.AddRange(new Table { StoreId = store.StoreId, TableNumber = "T01", Capacity = 4, Status = "Available", IsActive = true }, new Table { StoreId = store.StoreId, TableNumber = "T02", Capacity = 4, Status = "Available", IsActive = true });
            var verificationUrl = BuildVerificationUrl(rawToken);
            await _emailService.SendVerificationEmailAsync(email, verificationUrl);
            await transaction.CommitAsync();
            return new OwnerSignupResponse { TenantId = tenant.TenantId, StoreId = store.StoreId, Email = email, Plan = planCode, TrialEndsAt = trialEnds, EmailSent = true, VerificationUrl = _config.GetValue<bool>("Email:ExposeVerificationUrl") ? verificationUrl : null };
        }

        private static string CreateVerificationToken() => Convert.ToBase64String(RandomNumberGenerator.GetBytes(32))
            .Replace("+", "-").Replace("/", "_").TrimEnd('=');

        private string BuildVerificationUrl(string token)
        {
            var verificationBase = _config["Frontend:PublicUrl"]?.TrimEnd('/') ?? "http://localhost:5173";
            return $"{verificationBase}/verify-email?token={Uri.EscapeDataString(token)}";
        }

        public async Task<LoginResponse> VerifyOwnerEmailAsync(string token)
        {
            if (string.IsNullOrWhiteSpace(token)) throw new AppException("Mã xác minh không hợp lệ.");
            var tenant = await _db.Tenants.Include(t => t.Stores).FirstOrDefaultAsync(t => t.EmailVerificationTokenHash == HashToken(token));
            if (tenant == null || tenant.EmailVerificationExpiresAt < DateTime.UtcNow)
                throw new AppException("Liên kết xác minh không hợp lệ hoặc đã hết hạn.");
            tenant.OwnerEmailVerified = true;
            tenant.EmailVerificationTokenHash = null;
            tenant.EmailVerificationExpiresAt = null;
            await _db.SaveChangesAsync();
            var store = tenant.Stores.FirstOrDefault(s => s.IsActive);
            var tokenValue = JwtHelper.GenerateToken(tenant.TenantId.ToString(), tenant.OwnerEmail, AppRoles.TenantOwner, tenant.TenantId, store?.StoreId, GetRequiredJwtSetting("SecretKey"), _config["Jwt:Issuer"] ?? "WebCafeBackend", _config["Jwt:Audience"] ?? "WebCafeClients");
            return new LoginResponse { Token = tokenValue, Username = tenant.OwnerEmail, FullName = tenant.OwnerName, Role = AppRoles.TenantOwner, TenantId = tenant.TenantId, StoreId = store?.StoreId, StoreName = store?.Name, BrandName = tenant.Name };
        }

        private async Task<string> CreateUniqueSlugAsync(string value)
        {
            var slug = new string(value.Trim().ToLowerInvariant().Select(c => char.IsLetterOrDigit(c) ? c : '-').ToArray());
            while (slug.Contains("--")) slug = slug.Replace("--", "-");
            slug = slug.Trim('-');
            if (string.IsNullOrWhiteSpace(slug)) slug = "store";
            if (slug.Length > 50) slug = slug[..50].TrimEnd('-');
            var candidate = slug;
            var suffix = 2;
            while (await _db.Tenants.AnyAsync(t => t.Slug == candidate))
            {
                var suffixText = $"-{suffix++}";
                var baseLength = Math.Max(1, 50 - suffixText.Length);
                candidate = $"{slug[..Math.Min(slug.Length, baseLength)].TrimEnd('-')}{suffixText}";
            }
            return candidate;
        }

        private static string HashToken(string token) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token))).ToLowerInvariant();

        private string GetRequiredJwtSetting(string key)
        {
            return _config[$"Jwt:{key}"]
                ?? throw new InvalidOperationException($"Jwt:{key} chưa được cấu hình.");
        }
    }
}
