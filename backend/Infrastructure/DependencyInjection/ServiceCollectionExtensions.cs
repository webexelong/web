using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using System.Threading.RateLimiting;
using PayOS;
using WebCafe.Backend.Hubs;
using WebCafe.Backend.Common.Constants;
using WebCafe.Backend.Infrastructure.Data;
using WebCafe.Backend.Infrastructure.Storage;
using WebCafe.Backend.Services.Abstraction;
using WebCafe.Backend.Services.Implementation;

namespace WebCafe.Backend.Infrastructure.DependencyInjection
{
    public static class ServiceCollectionExtensions
    {
        public static IServiceCollection RegisterApplicationServices(this IServiceCollection services, IConfiguration configuration)
        {
            // 1. DbContext
            var connectionString = configuration.GetConnectionString("DefaultConnection")
                ?? throw new InvalidOperationException("ConnectionStrings:DefaultConnection chưa được cấu hình.");

            services.AddDbContext<WebCafeDbContext>(options =>
                options.UseSqlServer(connectionString));
            services.AddHostedService<DemoMaintenanceService>();
            services.AddRateLimiter(options =>
            {
                options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
                options.AddPolicy("auth", context => RateLimitPartition.GetFixedWindowLimiter(
                    context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
                    _ => new FixedWindowRateLimiterOptions { PermitLimit = 10, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 }));
                options.AddPolicy("webhook", context => RateLimitPartition.GetFixedWindowLimiter(
                    context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
                    _ => new FixedWindowRateLimiterOptions { PermitLimit = 60, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 }));
            });

            // 2. CORS - Chỉ cho phép các frontend origin đã cấu hình.
            var configuredOrigins = configuration.GetSection("Cors:AllowedOrigins").Get<string[]>();
            if (string.Equals(configuration["ASPNETCORE_ENVIRONMENT"], "Production", StringComparison.OrdinalIgnoreCase) &&
                (configuredOrigins == null || configuredOrigins.Length == 0))
                throw new InvalidOperationException("Cors:AllowedOrigins phải được cấu hình ở Production.");
            var allowedOrigins = configuredOrigins ?? new[] { "http://localhost:5173", "https://localhost:5173" };
            services.AddCors(options =>
            {
                options.AddPolicy("AllowAll", policy =>
                {
                    policy.WithOrigins(allowedOrigins)
                          .AllowAnyHeader()
                          .AllowAnyMethod()
                          .AllowCredentials();
                });
            });

            // 3. JWT Authentication
            var jwtKey = configuration["Jwt:SecretKey"]
                ?? throw new InvalidOperationException("Jwt:SecretKey chưa được cấu hình.");
            if (string.Equals(configuration["ASPNETCORE_ENVIRONMENT"], "Production", StringComparison.OrdinalIgnoreCase) &&
                (jwtKey.Contains("SuperSecret", StringComparison.OrdinalIgnoreCase) || jwtKey.Length < 64))
                throw new InvalidOperationException("Jwt:SecretKey Production phải là secret riêng dài tối thiểu 64 ký tự.");
            if (jwtKey.Length < 32)
            {
                throw new InvalidOperationException("Jwt:SecretKey phải có ít nhất 32 ký tự.");
            }
            var jwtIssuer = configuration["Jwt:Issuer"] ?? "WebCafeBackend";
            var jwtAudience = configuration["Jwt:Audience"] ?? "WebCafeClients";

            services.AddAuthentication(options =>
            {
                options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
                options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
            })
            .AddJwtBearer(options =>
            {
                options.RequireHttpsMetadata = false;
                options.SaveToken = true;
                options.TokenValidationParameters = new TokenValidationParameters
                {
                    ValidateIssuerSigningKey = true,
                    IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
                    ValidateIssuer = true,
                    ValidIssuer = jwtIssuer,
                    ValidateAudience = true,
                    ValidAudience = jwtAudience,
                    ClockSkew = TimeSpan.Zero
                };

                // SignalR Token Support from Query String
                options.Events = new JwtBearerEvents
                {
                    OnMessageReceived = context =>
                    {
                        var accessToken = context.Request.Query["access_token"];
                        var path = context.HttpContext.Request.Path;
                        if (!string.IsNullOrEmpty(accessToken) && path.StartsWithSegments("/hubs"))
                        {
                            context.Token = accessToken;
                        }
                        return Task.CompletedTask;
                    }
                };
            });

            services.AddAuthorization(options =>
            {
                // Policy cho SystemAdmin - có quyền truy cập toàn bộ hệ thống
                options.AddPolicy(AppPolicies.SystemAdminOnly, policy =>
                    policy.RequireRole(AppRoles.SystemAdmin));

                // Policy cho TenantOwner - quản lý toàn bộ tenant của mình
                options.AddPolicy("TenantOwnerOnly", policy =>
                    policy.RequireRole(AppRoles.TenantOwner, AppRoles.SystemAdmin));

                options.AddPolicy(AppPolicies.TenantAdminAccess, policy =>
                    policy.RequireRole(AppRoles.TenantOwner, AppRoles.SystemAdmin));

                // Policy cho các chức năng quản trị của chủ quán
                options.AddPolicy(AppPolicies.ManagerAccess, policy =>
                    policy.RequireRole(AppRoles.TenantOwner, AppRoles.SystemAdmin));

                // Policy cho Staff - nhân viên thông thường
                options.AddPolicy(AppPolicies.StaffAccess, policy =>
                    policy.RequireRole(AppRoles.Staff, AppRoles.TenantOwner, AppRoles.SystemAdmin));

                options.AddPolicy(AppPolicies.OrderStatusAccess, policy =>
                    policy.RequireRole(AppRoles.Staff, AppRoles.TenantOwner, AppRoles.SystemAdmin));

                options.AddPolicy(AppPolicies.CustomerOnly, policy =>
                    policy.RequireRole(AppRoles.Customer));

                // Hệ thống chỉ phát hành hai vai trò nghiệp vụ: Owner và Staff.

                // Policy cho tất cả authenticated users
                options.AddPolicy(AppPolicies.RequireAuthenticated, policy =>
                    policy.RequireAuthenticatedUser());
            });

            // 4. SignalR
            services.AddSignalR();
            services.AddScoped<IOrderNotificationService, OrderNotificationService>();
            services.AddScoped<ISubscriptionService, SubscriptionService>();

            // 5. Storage & Business Services
            services.AddMemoryCache();
            services.AddHttpClient();
            services.AddHttpContextAccessor();
            services.AddScoped<ICurrentUserService, CurrentUserService>();
            services.AddScoped<ITenantAccessService, TenantAccessService>();
            services.AddScoped<IFileStorageService, LocalFileSystemStorage>();
            services.AddScoped<IAuthService, AuthService>();
            services.AddScoped<IEmailService, SmtpEmailService>();
            services.AddScoped<ICategoryService, CategoryService>();
            services.AddScoped<IMenuItemService, MenuItemService>();
            services.AddScoped<ITableService, TableService>();
            services.AddScoped<IOrderService, OrderService>();
            services.AddScoped<IPaymentService, PaymentService>();
            services.AddScoped<IVoucherService, VoucherService>();
            services.AddScoped<IAnalyticsService, AnalyticsService>();
            services.AddScoped<IInventoryService, InventoryService>();
            services.AddScoped<IVietQRPaymentService, VietQRPaymentService>();
            services.AddScoped<IPayOSService, PayOSService>();
            services.AddScoped<IRecommendationService, RecommendationService>();
            services.AddScoped<IGeminiService, GeminiService>();

            // 5.1. PayOS Gateway Client Registration
            services.AddSingleton(sp =>
            {
                var config = sp.GetRequiredService<IConfiguration>();
                var clientId = config["PayOS:ClientId"] ?? "";
                var apiKey = config["PayOS:ApiKey"] ?? "";
                var checksumKey = config["PayOS:ChecksumKey"] ?? "";
                return new PayOSClient(clientId, apiKey, checksumKey);
            });

            // 6. Swagger with Bearer Support
            services.AddEndpointsApiExplorer();
            services.AddSwaggerGen(c =>
            {
                c.SwaggerDoc("v1", new OpenApiInfo { Title = "WebCafe SaaS QR Ordering API", Version = "v1" });
                c.CustomSchemaIds(type => type.FullName?.Replace("+", ".") ?? type.Name);
                c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
                {
                    Description = "Nhập token theo định dạng: Bearer {token}",
                    Name = "Authorization",
                    In = ParameterLocation.Header,
                    Type = SecuritySchemeType.ApiKey,
                    Scheme = "Bearer"
                });
                c.AddSecurityRequirement(new OpenApiSecurityRequirement
                {
                    {
                        new OpenApiSecurityScheme
                        {
                            Reference = new OpenApiReference
                            {
                                Type = ReferenceType.SecurityScheme,
                                Id = "Bearer"
                            }
                        },
                        Array.Empty<string>()
                    }
                });
            });

            return services;
        }
    }
}
