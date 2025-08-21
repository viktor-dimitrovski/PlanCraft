﻿using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace PlanCraft.Api.Migrations
{
    /// <inheritdoc />
    public partial class Add_ProjectPhases : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "PhaseId",
                table: "Tasks",
                type: "integer",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "ProjectPhases",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    ProjectId = table.Column<int>(type: "integer", nullable: false),
                    Title = table.Column<string>(type: "text", nullable: false),
                    EstimatedDays = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProjectPhases", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ProjectPhases_Projects_ProjectId",
                        column: x => x.ProjectId,
                        principalTable: "Projects",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Tasks_PhaseId",
                table: "Tasks",
                column: "PhaseId");

            migrationBuilder.CreateIndex(
                name: "IX_ProjectPhases_ProjectId",
                table: "ProjectPhases",
                column: "ProjectId");

            migrationBuilder.AddForeignKey(
                name: "FK_Tasks_ProjectPhases_PhaseId",
                table: "Tasks",
                column: "PhaseId",
                principalTable: "ProjectPhases",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Tasks_ProjectPhases_PhaseId",
                table: "Tasks");

            migrationBuilder.DropTable(
                name: "ProjectPhases");

            migrationBuilder.DropIndex(
                name: "IX_Tasks_PhaseId",
                table: "Tasks");

            migrationBuilder.DropColumn(
                name: "PhaseId",
                table: "Tasks");
        }
    }
}
