using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace PlanCraft.Api.Migrations
{
    public partial class Add_PhaseAssignment_And_NoAssignedDays : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "NoAssignedDays",
                table: "ProjectPhases",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateTable(
                name: "PhaseAssignments",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    PhaseId = table.Column<int>(type: "integer", nullable: false),
                    PersonId = table.Column<int>(type: "integer", nullable: false),
                    AssignedDays = table.Column<int>(type: "integer", nullable: false),
                    StartDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PhaseAssignments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PhaseAssignments_People_PersonId",
                        column: x => x.PersonId,
                        principalTable: "People",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_PhaseAssignments_ProjectPhases_PhaseId",
                        column: x => x.PhaseId,
                        principalTable: "ProjectPhases",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_PhaseAssignments_PersonId",
                table: "PhaseAssignments",
                column: "PersonId");

            migrationBuilder.CreateIndex(
                name: "IX_PhaseAssignments_PhaseId",
                table: "PhaseAssignments",
                column: "PhaseId");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(name: "PhaseAssignments");

            migrationBuilder.DropColumn(
                name: "NoAssignedDays",
                table: "ProjectPhases");
        }
    }
}
