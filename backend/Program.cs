using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using WebCafe.Backend.Common.Middleware;
using WebCafe.Backend.Common.Models;
using WebCafe.Backend.Hubs;
using WebCafe.Backend.Infrastructure.Data;
using WebCafe.Backend.Infrastructure.DependencyInjection;
using WebCafe.Backend.Infrastructure.Seeder;

var builder = WebApplication.CreateBuilder(args);
builder.Configuration.AddJsonFile("appsettings.Local.json", optional: true, reloadOnChange: true);

// Register Controllers & Custom Services through Extension
builder.Services.AddControllers()
    .ConfigureApiBehaviorOptions(options =>
    {
        // Custom Model Validation Error Response để format nhất quán với ApiResponse
        options.InvalidModelStateResponseFactory = context =>
        {
            var errors = context.ModelState
                .Where(e => e.Value?.Errors.Count > 0)
                .ToDictionary(
                    kvp => kvp.Key,
                    kvp => kvp.Value!.Errors.Select(e => e.ErrorMessage).ToArray()
                );

            var response = new ApiResponse<object>
            {
                Success = false,
                Message = "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin đã nhập.",
                Data = null,
                Errors = errors
            };

            return new BadRequestObjectResult(response);
        };
    });

builder.Services.RegisterApplicationServices(builder.Configuration);

var app = builder.Build();

app.UseForwardedHeaders(new ForwardedHeadersOptions
{
    ForwardedHeaders = Microsoft.AspNetCore.HttpOverrides.ForwardedHeaders.XForwardedFor | Microsoft.AspNetCore.HttpOverrides.ForwardedHeaders.XForwardedProto
});

if (!app.Environment.IsDevelopment())
{
    app.UseHsts();
}

// Auto-migrate on Development or when Database:AutoMigrate=true in container deployment
var shouldAutoMigrate = app.Environment.IsDevelopment() || 
    string.Equals(builder.Configuration["Database:AutoMigrate"], "true", StringComparison.OrdinalIgnoreCase);

if (shouldAutoMigrate)
{
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<WebCafeDbContext>();
    try
    {
        // Tự động cập nhật Database theo Model & Migrations (Code First)
        await db.Database.MigrateAsync();
        await DatabaseSeeder.SeedAsync(db);
    }
    catch (Exception ex)
    {
        var logger = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();
        logger.LogError(ex, "Lỗi khi migrate hoặc seed data.");
    }
}

// === 🔐 RESET PASSWORD TOOL: UNCOMMENT DƯỚI ĐÂY ĐỂ RESET PASSWORD ===
// using (var scope = app.Services.CreateScope())
// {
//     var db = scope.ServiceProvider.GetRequiredService<WebCafeDbContext>();
//     
//     Console.WriteLine("\n" + "".PadRight(80, '='));
//     Console.WriteLine("🔐 WEBCAFE PASSWORD RESET TOOL");
//     Console.WriteLine("".PadRight(80, '='));
//     
//     // List all users
//     var admins = await db.SystemAdmins.ToListAsync();
//     var owners = await db.Tenants.ToListAsync();
//     var staff = await db.Staff.Include(s => s.Store).ToListAsync();
//     
//     Console.WriteLine("\n DANH SÁCH TẤT CẢ USER:");
//     if (admins.Any())
//     {
//         Console.WriteLine("\n SYSTEM ADMINS:");
//         foreach (var a in admins)
//             Console.WriteLine($"  • Username: {a.Username} | Email: {a.Email} | Name: {a.FullName}");
//     }
//     if (owners.Any())
//     {
//         Console.WriteLine("\n OWNERS:");
//         foreach (var o in owners)
//             Console.WriteLine($"  • Email: {o.OwnerEmail} | Name: {o.OwnerName} | Brand: {o.Name}");
//     }
//     if (staff.Any())
//     {
//         Console.WriteLine("\n STAFF:");
//         foreach (var s in staff)
//             Console.WriteLine($"  • Username: {s.Username} | Email: {s.Email} | Name: {s.FullName}");
//     }
//     
//     Console.WriteLine("\n" + "".PadRight(80, '='));
//     Console.Write("\n📝 Nhập username hoặc email cần reset: ");
//     var usernameOrEmail = Console.ReadLine()?.Trim();
//     
//     if (string.IsNullOrEmpty(usernameOrEmail))
//     {
//         Console.WriteLine(" Vui lòng nhập username/email!");
//         return;
//     }
//     
//     Console.Write(" Nhập password mới (Enter = 'Password@123'): ");
//     var newPassword = Console.ReadLine()?.Trim();
//     if (string.IsNullOrEmpty(newPassword)) newPassword = "Password@123";
//     
//     Console.WriteLine($"\n🔍 Đang tìm user: {usernameOrEmail}...");
//     
//     // Find and reset
//     var staffUser = await db.Staff.FirstOrDefaultAsync(s => s.Username == usernameOrEmail || s.Email == usernameOrEmail);
//     if (staffUser != null)
//     {
//         staffUser.PasswordHash = WebCafe.Backend.Common.Helper.SecurityHelper.HashPassword(newPassword);
//         await db.SaveChangesAsync();
//         Console.WriteLine($"✅ Reset password cho Staff '{staffUser.Username}' thành công!");
//         Console.WriteLine($"   Username: {staffUser.Username}");
//         Console.WriteLine($"   Password mới: {newPassword}\n");
//         return;
//     }
//     
//     var ownerUser = await db.Tenants.FirstOrDefaultAsync(t => t.OwnerEmail == usernameOrEmail);
//     if (ownerUser != null)
//     {
//         ownerUser.OwnerPasswordHash = WebCafe.Backend.Common.Helper.SecurityHelper.HashPassword(newPassword);
//         await db.SaveChangesAsync();
//         Console.WriteLine($"✅ Reset password cho Owner '{ownerUser.OwnerName}' thành công!");
//         Console.WriteLine($"   Email: {ownerUser.OwnerEmail}");
//         Console.WriteLine($"   Password mới: {newPassword}\n");
//         return;
//     }
//     
//     var adminUser = await db.SystemAdmins.FirstOrDefaultAsync(a => a.Username == usernameOrEmail || a.Email == usernameOrEmail);
//     if (adminUser != null)
//     {
//         adminUser.PasswordHash = WebCafe.Backend.Common.Helper.SecurityHelper.HashPassword(newPassword);
//         await db.SaveChangesAsync();
//         Console.WriteLine($"✅ Reset password cho Admin '{adminUser.Username}' thành công!");
//         Console.WriteLine($"   Username: {adminUser.Username}");
//         Console.WriteLine($"   Password mới: {newPassword}\n");
//         return;
//     }
//     
//     Console.WriteLine($"❌ Không tìm thấy user: {usernameOrEmail}\n");
// }
// === KẾT THÚC RESET PASSWORD CODE ===

// HTTP Pipeline Middleware
app.UseMiddleware<GlobalExceptionHandlingMiddleware>();

// Swagger is not exposed in production.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(c =>
    {
        c.SwaggerEndpoint("/swagger/v1/swagger.json", "WebCafe API v1");
        c.RoutePrefix = "swagger";
    });
    app.MapGet("/", () => Results.Redirect("/swagger"));
}

app.UseStaticFiles();

// CORS phải đặt trước Authentication & Authorization
app.UseCors("AllowAll");
app.UseRateLimiter();

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
app.MapGet("/health", async (WebCafeDbContext db) =>
{
    try
    {
        var ready = await db.Database.CanConnectAsync();
        return ready ? Results.Ok(new { status = "Healthy" }) : Results.Json(new { status = "Unhealthy" }, statusCode: StatusCodes.Status503ServiceUnavailable);
    }
    catch
    {
        return Results.Json(new { status = "Unhealthy" }, statusCode: StatusCodes.Status503ServiceUnavailable);
    }
});
app.MapGet("/health/ready", async (WebCafeDbContext db) =>
{
    try
    {
        var ready = await db.Database.CanConnectAsync();
        return ready ? Results.Ok(new { status = "ready" }) : Results.Json(new { status = "not_ready" }, statusCode: StatusCodes.Status503ServiceUnavailable);
    }
    catch
    {
        return Results.Json(new { status = "not_ready" }, statusCode: StatusCodes.Status503ServiceUnavailable);
    }
});
app.MapHub<OrderHub>("/hubs/orders");

app.Run();

public partial class Program { }
