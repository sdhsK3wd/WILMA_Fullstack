using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace WILMA_Backend.Migrations
{
    /// <inheritdoc />
    public partial class AddPollSupport : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Votes",
                table: "PollOptions");

            migrationBuilder.AddColumn<DateTime>(
                name: "CreatedAt",
                table: "Polls",
                type: "TEXT",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.AddColumn<DateTime>(
                name: "EndDate",
                table: "Polls",
                type: "TEXT",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.CreateTable(
                name: "Votes",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    UserId = table.Column<string>(type: "TEXT", nullable: false),
                    PollId = table.Column<int>(type: "INTEGER", nullable: false),
                    PollOptionId = table.Column<int>(type: "INTEGER", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Votes", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Votes_PollOptions_PollOptionId",
                        column: x => x.PollOptionId,
                        principalTable: "PollOptions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_Votes_Polls_PollId",
                        column: x => x.PollId,
                        principalTable: "Polls",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Votes_PollId",
                table: "Votes",
                column: "PollId");

            migrationBuilder.CreateIndex(
                name: "IX_Votes_PollOptionId",
                table: "Votes",
                column: "PollOptionId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Votes");

            migrationBuilder.DropColumn(
                name: "CreatedAt",
                table: "Polls");

            migrationBuilder.DropColumn(
                name: "EndDate",
                table: "Polls");

            migrationBuilder.AddColumn<int>(
                name: "Votes",
                table: "PollOptions",
                type: "INTEGER",
                nullable: false,
                defaultValue: 0);
        }
    }
}
