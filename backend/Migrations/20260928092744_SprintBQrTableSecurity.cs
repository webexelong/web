using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace WebCafe.Backend.Migrations
{
    /// <inheritdoc />
    public partial class SprintBQrTableSecurity : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "QrToken",
                table: "Tables",
                type: "nvarchar(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.Sql("UPDATE [Tables] SET [QrToken] = REPLACE(CONVERT(varchar(36), NEWID()), '-', '') WHERE [QrToken] IS NULL");

            migrationBuilder.AlterColumn<string>(
                name: "QrToken",
                table: "Tables",
                type: "nvarchar(64)",
                maxLength: 64,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(64)",
                oldMaxLength: 64,
                oldNullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Tables_QrToken",
                table: "Tables",
                column: "QrToken",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Tables_QrToken",
                table: "Tables");

            migrationBuilder.DropColumn(
                name: "QrToken",
                table: "Tables");
        }
    }
}
