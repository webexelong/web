using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace WebCafe.Backend.Migrations
{
    /// <inheritdoc />
    public partial class AddGuestPaymentAccessToken : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "PaymentAccessToken",
                table: "Orders",
                type: "nvarchar(64)",
                maxLength: 64,
                nullable: false,
                defaultValueSql: "LOWER(REPLACE(CONVERT(varchar(36), NEWID()), '-', ''))");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "PaymentAccessToken",
                table: "Orders");
        }
    }
}
