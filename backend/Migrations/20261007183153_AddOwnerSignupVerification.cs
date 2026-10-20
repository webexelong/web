using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace WebCafe.Backend.Migrations
{
    /// <inheritdoc />
    public partial class AddOwnerSignupVerification : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "EmailVerificationExpiresAt",
                table: "Tenants",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "EmailVerificationTokenHash",
                table: "Tenants",
                type: "nvarchar(128)",
                maxLength: 128,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "OwnerEmailVerified",
                table: "Tenants",
                type: "bit",
                nullable: false,
                defaultValue: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "EmailVerificationExpiresAt",
                table: "Tenants");

            migrationBuilder.DropColumn(
                name: "EmailVerificationTokenHash",
                table: "Tenants");

            migrationBuilder.DropColumn(
                name: "OwnerEmailVerified",
                table: "Tenants");
        }
    }
}
