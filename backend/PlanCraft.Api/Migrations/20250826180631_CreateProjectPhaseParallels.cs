using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PlanCraft.Api.Migrations
{
    public partial class CreateProjectPhaseParallels : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ProjectPhaseParallels",
                columns: table => new
                {
                    PhaseId = table.Column<int>(type: "integer", nullable: false),
                    WithPhaseId = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProjectPhaseParallels", x => new { x.PhaseId, x.WithPhaseId });
                    table.ForeignKey(
                        name: "FK_ProjectPhaseParallels_ProjectPhases_PhaseId",
                        column: x => x.PhaseId,
                        principalTable: "ProjectPhases",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ProjectPhaseParallels_ProjectPhases_WithPhaseId",
                        column: x => x.WithPhaseId,
                        principalTable: "ProjectPhases",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ProjectPhaseParallels_WithPhaseId",
                table: "ProjectPhaseParallels",
                column: "WithPhaseId");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ProjectPhaseParallels");
        }
    }
}
