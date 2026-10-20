using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace WebCafe.Backend.Migrations
{
    /// <inheritdoc />
    public partial class PersistPayOSPaymentLinks : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "CheckoutUrl",
                table: "Payments",
                type: "nvarchar(2048)",
                maxLength: 2048,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ExternalBankBin",
                table: "Payments",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ExternalPaymentLinkId",
                table: "Payments",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "QrCode",
                table: "Payments",
                type: "nvarchar(4000)",
                maxLength: 4000,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CheckoutUrl",
                table: "Payments");

            migrationBuilder.DropColumn(
                name: "ExternalBankBin",
                table: "Payments");

            migrationBuilder.DropColumn(
                name: "ExternalPaymentLinkId",
                table: "Payments");

            migrationBuilder.DropColumn(
                name: "QrCode",
                table: "Payments");
        }
    }
}
