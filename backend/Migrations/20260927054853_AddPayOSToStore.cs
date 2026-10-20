using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace WebCafe.Backend.Migrations
{
    /// <inheritdoc />
    public partial class AddPayOSToStore : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "PayOSApiKey",
                table: "Stores",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PayOSChecksumKey",
                table: "Stores",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PayOSClientId",
                table: "Stores",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "PayOSApiKey",
                table: "Stores");

            migrationBuilder.DropColumn(
                name: "PayOSChecksumKey",
                table: "Stores");

            migrationBuilder.DropColumn(
                name: "PayOSClientId",
                table: "Stores");
        }
    }
}
