using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable
namespace PlanCraft.Api.Migrations
{
    public partial class AddStatusToPhaseAcceptanceCriteria : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "Status",
                table: "PhaseAcceptanceCriteria",
                type: "integer",
                nullable: false,
                defaultValue: 0);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Status",
                table: "PhaseAcceptanceCriteria");
        }
    }
}
