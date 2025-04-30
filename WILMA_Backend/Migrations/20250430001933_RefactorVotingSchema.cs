using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace WILMA_Backend.Migrations
{
    /// <inheritdoc />
    public partial class RefactorVotingSchema : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Votes_PollOptions_PollOptionId",
                table: "Votes");

            migrationBuilder.DropTable(
                name: "UserVotes");

            migrationBuilder.DropTable(
                name: "VoteOptions");

            migrationBuilder.DropColumn(
                name: "EndDate",
                table: "Polls");

            migrationBuilder.AddColumn<DateTime>(
                name: "VotedAt",
                table: "Votes",
                type: "TEXT",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.CreateIndex(
                name: "IX_Votes_UserId_PollId",
                table: "Votes",
                columns: new[] { "UserId", "PollId" },
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_Votes_PollOptions_PollOptionId",
                table: "Votes",
                column: "PollOptionId",
                principalTable: "PollOptions",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Votes_PollOptions_PollOptionId",
                table: "Votes");

            migrationBuilder.DropIndex(
                name: "IX_Votes_UserId_PollId",
                table: "Votes");

            migrationBuilder.DropColumn(
                name: "VotedAt",
                table: "Votes");

            migrationBuilder.AddColumn<DateTime>(
                name: "EndDate",
                table: "Polls",
                type: "TEXT",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.CreateTable(
                name: "VoteOptions",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    Title = table.Column<string>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_VoteOptions", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "UserVotes",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    VoteOptionId = table.Column<int>(type: "INTEGER", nullable: false),
                    UserId = table.Column<string>(type: "TEXT", nullable: false),
                    VotedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserVotes", x => x.Id);
                    table.ForeignKey(
                        name: "FK_UserVotes_VoteOptions_VoteOptionId",
                        column: x => x.VoteOptionId,
                        principalTable: "VoteOptions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_UserVotes_VoteOptionId",
                table: "UserVotes",
                column: "VoteOptionId");

            migrationBuilder.AddForeignKey(
                name: "FK_Votes_PollOptions_PollOptionId",
                table: "Votes",
                column: "PollOptionId",
                principalTable: "PollOptions",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
