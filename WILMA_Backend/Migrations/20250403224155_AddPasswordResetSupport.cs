using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace WILMA_Backend.Migrations
{
    /// <inheritdoc />
    public partial class AddPasswordResetSupport : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "RefreshToken",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "RefreshTokenExpires",
                table: "Users");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "RefreshToken",
                table: "Users",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "RefreshTokenExpires",
                table: "Users",
                type: "TEXT",
                nullable: true);
        }
    }
}
