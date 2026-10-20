using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace WebCafe.Backend.Migrations
{
    /// <inheritdoc />
    public partial class SprintAOrderPaymentState : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "AppliedVoucherId",
                table: "Orders",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "PaymentActivatedAt",
                table: "Orders",
                type: "datetime2",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AppliedVoucherId",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "PaymentActivatedAt",
                table: "Orders");
        }
    }
}
