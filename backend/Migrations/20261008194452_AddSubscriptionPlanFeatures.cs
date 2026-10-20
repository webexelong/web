using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace WebCafe.Backend.Migrations
{
    /// <inheritdoc />
    public partial class AddSubscriptionPlanFeatures : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "SubscriptionPlanFeatures",
                columns: table => new
                {
                    PlanFeatureId = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    PlanId = table.Column<int>(type: "int", nullable: false),
                    FeatureCode = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: false),
                    IsEnabled = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SubscriptionPlanFeatures", x => x.PlanFeatureId);
                    table.ForeignKey(
                        name: "FK_SubscriptionPlanFeatures_SubscriptionPlans_PlanId",
                        column: x => x.PlanId,
                        principalTable: "SubscriptionPlans",
                        principalColumn: "PlanId",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_SubscriptionPlanFeatures_PlanId_FeatureCode",
                table: "SubscriptionPlanFeatures",
                columns: new[] { "PlanId", "FeatureCode" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "SubscriptionPlanFeatures");
        }
    }
}
