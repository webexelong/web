using Microsoft.EntityFrameworkCore;
using WebCafe.Backend.Models.Entities;

namespace WebCafe.Backend.Infrastructure.Data
{
    public class WebCafeDbContext : DbContext
    {
        public WebCafeDbContext(DbContextOptions<WebCafeDbContext> options) : base(options)
        {
        }

        public DbSet<SystemAdmin> SystemAdmins => Set<SystemAdmin>();
        public DbSet<Tenant> Tenants => Set<Tenant>();
        public DbSet<Store> Stores => Set<Store>();
        public DbSet<SubscriptionPlan> SubscriptionPlans => Set<SubscriptionPlan>();
        public DbSet<SubscriptionPlanFeature> SubscriptionPlanFeatures => Set<SubscriptionPlanFeature>();
        public DbSet<TenantSubscription> TenantSubscriptions => Set<TenantSubscription>();
        public DbSet<SubscriptionBillingRecord> SubscriptionBillingRecords => Set<SubscriptionBillingRecord>();
        public DbSet<Permission> Permissions => Set<Permission>();
        public DbSet<Role> Roles => Set<Role>();
        public DbSet<RolePermission> RolePermissions => Set<RolePermission>();
        public DbSet<Category> Categories => Set<Category>();
        public DbSet<MenuItem> MenuItems => Set<MenuItem>();
        public DbSet<Size> Sizes => Set<Size>();
        public DbSet<MenuItemSize> MenuItemSizes => Set<MenuItemSize>();
        public DbSet<Topping> Toppings => Set<Topping>();
        public DbSet<MenuItemTopping> MenuItemToppings => Set<MenuItemTopping>();
        public DbSet<Table> Tables => Set<Table>();
        public DbSet<Staff> Staff => Set<Staff>();
        public DbSet<Shift> Shifts => Set<Shift>();
        public DbSet<StaffShift> StaffShifts => Set<StaffShift>();
        public DbSet<Customer> Customers => Set<Customer>();
        public DbSet<Voucher> Vouchers => Set<Voucher>();
        public DbSet<VoucherUsage> VoucherUsages => Set<VoucherUsage>();
        public DbSet<Order> Orders => Set<Order>();
        public DbSet<OrderItem> OrderItems => Set<OrderItem>();
        public DbSet<OrderItemTopping> OrderItemToppings => Set<OrderItemTopping>();
        public DbSet<Payment> Payments => Set<Payment>();
        public DbSet<LoyaltyPoint> LoyaltyPoints => Set<LoyaltyPoint>();

        // Inventory Management
        public DbSet<Ingredient> Ingredients => Set<Ingredient>();
        public DbSet<InventoryStock> InventoryStocks => Set<InventoryStock>();
        public DbSet<InventoryTransaction> InventoryTransactions => Set<InventoryTransaction>();
        public DbSet<MenuItemRecipe> MenuItemRecipes => Set<MenuItemRecipe>();
        public DbSet<ToppingRecipe> ToppingRecipes => Set<ToppingRecipe>();

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            // Unique constraints
            modelBuilder.Entity<Tenant>().HasIndex(t => t.Slug).IsUnique();
            modelBuilder.Entity<Tenant>().HasIndex(t => t.OwnerEmail).IsUnique();
            modelBuilder.Entity<Tenant>().Property(t => t.OwnerEmailVerified).HasDefaultValue(true);
            modelBuilder.Entity<SubscriptionPlan>().HasIndex(p => p.Code).IsUnique();
            modelBuilder.Entity<SubscriptionPlanFeature>().HasIndex(p => new { p.PlanId, p.FeatureCode }).IsUnique();
            modelBuilder.Entity<SubscriptionPlanFeature>().HasOne(p => p.Plan).WithMany(p => p.Features).HasForeignKey(p => p.PlanId).OnDelete(DeleteBehavior.Cascade);
            modelBuilder.Entity<TenantSubscription>().HasIndex(s => new { s.TenantId, s.Status });
            modelBuilder.Entity<SystemAdmin>().HasIndex(a => a.Username).IsUnique();
            modelBuilder.Entity<Permission>().HasIndex(p => p.Code).IsUnique();
            modelBuilder.Entity<Role>().HasIndex(r => new { r.TenantId, r.Name }).IsUnique();
            modelBuilder.Entity<RolePermission>().HasIndex(rp => new { rp.RoleId, rp.PermissionId }).IsUnique();
            modelBuilder.Entity<Category>().HasIndex(c => new { c.TenantId, c.Name }).IsUnique();
            modelBuilder.Entity<Size>().HasIndex(s => new { s.TenantId, s.Name }).IsUnique();
            modelBuilder.Entity<MenuItemSize>().HasIndex(ms => new { ms.MenuItemId, ms.SizeId }).IsUnique();
            modelBuilder.Entity<MenuItemTopping>().HasIndex(mt => new { mt.MenuItemId, mt.ToppingId }).IsUnique();
            modelBuilder.Entity<Table>().HasIndex(t => new { t.StoreId, t.TableNumber }).IsUnique();
            modelBuilder.Entity<Table>().HasIndex(t => t.QrToken).IsUnique();
            modelBuilder.Entity<Customer>().HasIndex(c => new { c.TenantId, c.Phone }).IsUnique();
            modelBuilder.Entity<Voucher>().HasIndex(v => new { v.TenantId, v.Code }).IsUnique();
            modelBuilder.Entity<Order>().HasIndex(o => new { o.TenantId, o.OrderCode }).IsUnique();
            // Database constraints are the final guard against concurrent/replayed payment webhooks.
            modelBuilder.Entity<Payment>().HasIndex(p => p.TransactionRef)
                .IsUnique()
                .HasFilter("[TransactionRef] IS NOT NULL");
            modelBuilder.Entity<Payment>().HasIndex(p => p.OrderId, "IX_Payments_OrderId_Pending")
                .IsUnique()
                .HasFilter("[Status] = N'pending'");
            modelBuilder.Entity<Payment>().HasIndex(p => p.OrderId)
                .IsUnique()
                .HasFilter("[Status] = N'completed'");

            // Inventory constraints
            modelBuilder.Entity<Ingredient>().HasIndex(i => new { i.TenantId, i.Name }).IsUnique();
            modelBuilder.Entity<InventoryStock>().HasIndex(s => new { s.StoreId, s.IngredientId }).IsUnique();
            modelBuilder.Entity<MenuItemRecipe>().HasIndex(r => new { r.MenuItemId, r.IngredientId, r.SizeId }).IsUnique();
            modelBuilder.Entity<ToppingRecipe>().HasIndex(tr => new { tr.ToppingId, tr.IngredientId }).IsUnique();

            // Disable cascade delete globally or specifically to eliminate SQL Server cycle errors (1785)
            foreach (var relationship in modelBuilder.Model.GetEntityTypes().SelectMany(e => e.GetForeignKeys()))
            {
                relationship.DeleteBehavior = DeleteBehavior.Restrict;
            }

            // Specific relationships configuration
            modelBuilder.Entity<Order>()
                .HasOne(o => o.Table)
                .WithMany(t => t.Orders)
                .HasForeignKey(o => o.TableId)
                .OnDelete(DeleteBehavior.SetNull);

            modelBuilder.Entity<Order>()
                .HasOne(o => o.Customer)
                .WithMany(c => c.Orders)
                .HasForeignKey(o => o.CustomerId)
                .OnDelete(DeleteBehavior.SetNull);

            modelBuilder.Entity<Order>()
                .HasOne(o => o.Staff)
                .WithMany(s => s.HandledOrders)
                .HasForeignKey(o => o.StaffId)
                .OnDelete(DeleteBehavior.SetNull);
        }
    }
}
