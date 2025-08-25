using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace PlanCraft.Api.Migrations
{
    public partial class Add_PhaseVerification : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "StartDate",
                table: "ProjectPhases",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "DurationDays",
                table: "ProjectPhases",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "Status",
                table: "ProjectPhases",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "Description",
                table: "ProjectPhases",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "Priority",
                table: "ProjectPhases",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "DependantPhaseId",
                table: "ProjectPhases",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "CanGoInParalelWith",
                table: "ProjectPhases",
                type: "boolean",
                nullable: false,
                defaultValue: true);

            migrationBuilder.CreateTable(
                name: "PhaseAcceptanceCriteria",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    PhaseId = table.Column<int>(type: "integer", nullable: false),
                    Title = table.Column<string>(type: "text", nullable: false),
                    Description = table.Column<string>(type: "text", nullable: true),
                    Order = table.Column<int>(type: "integer", nullable: false),
                    IsRequired = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PhaseAcceptanceCriteria", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PhaseAcceptanceCriteria_ProjectPhases_PhaseId",
                        column: x => x.PhaseId,
                        principalTable: "ProjectPhases",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "PhaseAcceptanceRuns",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    PhaseId = table.Column<int>(type: "integer", nullable: false),
                    VerifiedByPersonId = table.Column<int>(type: "integer", nullable: true),
                    VerifiedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    OverallStatus = table.Column<int>(type: "integer", nullable: false),
                    Notes = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PhaseAcceptanceRuns", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PhaseAcceptanceRuns_People_VerifiedByPersonId",
                        column: x => x.VerifiedByPersonId,
                        principalTable: "People",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_PhaseAcceptanceRuns_ProjectPhases_PhaseId",
                        column: x => x.PhaseId,
                        principalTable: "ProjectPhases",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "PhaseAcceptanceResults",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    RunId = table.Column<int>(type: "integer", nullable: false),
                    CriteriaId = table.Column<int>(type: "integer", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    Note = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PhaseAcceptanceResults", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PhaseAcceptanceResults_PhaseAcceptanceCriteria_CriteriaId",
                        column: x => x.CriteriaId,
                        principalTable: "PhaseAcceptanceCriteria",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_PhaseAcceptanceResults_PhaseAcceptanceRuns_RunId",
                        column: x => x.RunId,
                        principalTable: "PhaseAcceptanceRuns",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_PhaseAcceptanceCriteria_PhaseId",
                table: "PhaseAcceptanceCriteria",
                column: "PhaseId");

            migrationBuilder.CreateIndex(
                name: "IX_PhaseAcceptanceRuns_PhaseId",
                table: "PhaseAcceptanceRuns",
                column: "PhaseId");

            migrationBuilder.CreateIndex(
                name: "IX_PhaseAcceptanceRuns_VerifiedByPersonId",
                table: "PhaseAcceptanceRuns",
                column: "VerifiedByPersonId");

            migrationBuilder.CreateIndex(
                name: "IX_PhaseAcceptanceResults_CriteriaId",
                table: "PhaseAcceptanceResults",
                column: "CriteriaId");

            migrationBuilder.CreateIndex(
                name: "IX_PhaseAcceptanceResults_RunId",
                table: "PhaseAcceptanceResults",
                column: "RunId");

            migrationBuilder.CreateIndex(
                name: "IX_ProjectPhases_DependantPhaseId",
                table: "ProjectPhases",
                column: "DependantPhaseId");

            migrationBuilder.AddForeignKey(
                name: "FK_ProjectPhases_ProjectPhases_DependantPhaseId",
                table: "ProjectPhases",
                column: "DependantPhaseId",
                principalTable: "ProjectPhases",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(name: "FK_ProjectPhases_ProjectPhases_DependantPhaseId", table: "ProjectPhases");

            migrationBuilder.DropTable(name: "PhaseAcceptanceResults");
            migrationBuilder.DropTable(name: "PhaseAcceptanceRuns");
            migrationBuilder.DropTable(name: "PhaseAcceptanceCriteria");

            migrationBuilder.DropIndex(name: "IX_ProjectPhases_DependantPhaseId", table: "ProjectPhases");

            migrationBuilder.DropColumn(name: "StartDate", table: "ProjectPhases");
            migrationBuilder.DropColumn(name: "DurationDays", table: "ProjectPhases");
            migrationBuilder.DropColumn(name: "Status", table: "ProjectPhases");
            migrationBuilder.DropColumn(name: "Description", table: "ProjectPhases");
            migrationBuilder.DropColumn(name: "Priority", table: "ProjectPhases");
            migrationBuilder.DropColumn(name: "DependantPhaseId", table: "ProjectPhases");
            migrationBuilder.DropColumn(name: "CanGoInParalelWith", table: "ProjectPhases");
        }
    }
}
