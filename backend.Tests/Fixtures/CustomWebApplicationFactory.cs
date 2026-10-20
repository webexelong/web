using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using WebCafe.Backend.Infrastructure.Data;

namespace WebCafe.Backend.Tests.Fixtures;

public sealed class CustomWebApplicationFactory : WebApplicationFactory<Program>
{
    public string DatabaseName { get; } = $"WebCafeTestDB_{Guid.NewGuid():N}";

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.ConfigureAppConfiguration((_, config) =>
        {
            var testingSettings = Path.Combine(AppContext.BaseDirectory, "appsettings.Testing.json");
            config.AddJsonFile(testingSettings, optional: false);
            config.AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["ConnectionStrings:DefaultConnection"] = GetTestConnection()
            });
        });
        builder.ConfigureServices(services =>
        {
            services.AddAuthentication(options =>
            {
                options.DefaultAuthenticateScheme = TestAuthHandler.Scheme;
                options.DefaultChallengeScheme = TestAuthHandler.Scheme;
            }).AddScheme<AuthenticationSchemeOptions, TestAuthHandler>(TestAuthHandler.Scheme, _ => { });

            var dbDescriptor = services.SingleOrDefault(d => d.ServiceType == typeof(DbContextOptions<WebCafeDbContext>));
            if (dbDescriptor != null) services.Remove(dbDescriptor);
            services.AddDbContext<WebCafeDbContext>(options => options.UseSqlServer(GetTestConnection()));

            using var provider = services.BuildServiceProvider();
            using var scope = provider.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<WebCafeDbContext>();
            db.Database.Migrate();
        });
    }

    private string GetTestConnection()
    {
        var password = Environment.GetEnvironmentVariable("TEST_DB_PASSWORD");
        if (string.IsNullOrWhiteSpace(password))
            throw new InvalidOperationException("Thiếu biến môi trường TEST_DB_PASSWORD cho SQL Server test.");

        var baseConnection = "Server=DESKTOP-TCNCP19;Database=" + DatabaseName + ";User Id=sa;Password=" + password + ";MultipleActiveResultSets=true;TrustServerCertificate=True;Encrypt=True";
        return baseConnection;
    }

}
