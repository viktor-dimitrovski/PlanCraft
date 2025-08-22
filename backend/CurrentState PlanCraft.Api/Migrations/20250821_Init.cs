using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PlanCraft.Api.Migrations
{
    public partial class Init : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Banks",
                columns: table => new
                {
                    Id = table.Column<int>(nullable: false).Annotation("Npgsql:ValueGenerationStrategy", Npgsql.EntityFrameworkCore.PostgreSQL.Metadata.NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Name = table.Column<string>(nullable: false),
                    Color = table.Column<string>(nullable: false)
                },
                constraints: table => { table.PrimaryKey("PK_Banks", x => x.Id); }
            );

            migrationBuilder.CreateTable(
                name: "People",
                columns: table => new
                {
                    Id = table.Column<int>(nullable: false).Annotation("Npgsql:ValueGenerationStrategy", Npgsql.EntityFrameworkCore.PostgreSQL.Metadata.NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Name = table.Column<string>(nullable: false),
                    CapacityHoursPerWeek = table.Column<int>(nullable: false),
                    Skills = table.Column<string[]>(type: "text[]", nullable: false),
                    Color = table.Column<string>(nullable: false)
                },
                constraints: table => { table.PrimaryKey("PK_People", x => x.Id); }
            );

            migrationBuilder.CreateTable(
                name: "Holidays",
                columns: table => new
                {
                    Id = table.Column<int>(nullable: false).Annotation("Npgsql:ValueGenerationStrategy", Npgsql.EntityFrameworkCore.PostgreSQL.Metadata.NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Date = table.Column<DateTime>(nullable: false),
                    Name = table.Column<string>(nullable: false),
                    Region = table.Column<string>(nullable: false)
                },
                constraints: table => { table.PrimaryKey("PK_Holidays", x => x.Id); }
            );

            migrationBuilder.CreateTable(
                name: "Scenarios",
                columns: table => new
                {
                    Id = table.Column<int>(nullable: false).Annotation("Npgsql:ValueGenerationStrategy", Npgsql.EntityFrameworkCore.PostgreSQL.Metadata.NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Name = table.Column<string>(nullable: false),
                    CreatedAt = table.Column<DateTime>(nullable: false)
                },
                constraints: table => { table.PrimaryKey("PK_Scenarios", x => x.Id); }
            );

            migrationBuilder.CreateTable(
                name: "Projects",
                columns: table => new
                {
                    Id = table.Column<int>(nullable: false).Annotation("Npgsql:ValueGenerationStrategy", Npgsql.EntityFrameworkCore.PostgreSQL.Metadata.NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Name = table.Column<string>(nullable: false),
                    BankId = table.Column<int>(nullable: false),
                    Color = table.Column<string>(nullable: true),
                    Deadline = table.Column<DateTime>(nullable: true)
                },
                constraints: table => {
                    table.PrimaryKey("PK_Projects", x => x.Id);
                    table.ForeignKey("FK_Projects_Banks_BankId", x => x.BankId, "Banks", "Id", onDelete: ReferentialAction.Cascade);
                }
            );

            migrationBuilder.CreateTable(
                name: "Tasks",
                columns: table => new
                {
                    Id = table.Column<int>(nullable: false).Annotation("Npgsql:ValueGenerationStrategy", Npgsql.EntityFrameworkCore.PostgreSQL.Metadata.NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    ProjectId = table.Column<int>(nullable: false),
                    Title = table.Column<string>(nullable: false),
                    EstimatedDays = table.Column<int>(nullable: false),
                    StartDate = table.Column<DateTime>(nullable: false),
                    DurationDays = table.Column<int>(nullable: false),
                    Status = table.Column<int>(nullable: false),
                    IsMilestone = table.Column<bool>(nullable: false),
                    RequiredSkills = table.Column<string[]>(type: "text[]", nullable: false),
                    OptimisticDays = table.Column<int>(nullable: true),
                    MostLikelyDays = table.Column<int>(nullable: true),
                    PessimisticDays = table.Column<int>(nullable: true)
                },
                constraints: table => {
                    table.PrimaryKey("PK_Tasks", x => x.Id);
                    table.ForeignKey("FK_Tasks_Projects_ProjectId", x => x.ProjectId, "Projects", "Id", onDelete: ReferentialAction.Cascade);
                }
            );

            migrationBuilder.CreateTable(
                name: "ProjectMilestones",
                columns: table => new
                {
                    Id = table.Column<int>(nullable: false).Annotation("Npgsql:ValueGenerationStrategy", Npgsql.EntityFrameworkCore.PostgreSQL.Metadata.NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    ProjectId = table.Column<int>(nullable: false),
                    Name = table.Column<string>(nullable: false),
                    Date = table.Column<DateTime>(nullable: false)
                },
                constraints: table => {
                    table.PrimaryKey("PK_ProjectMilestones", x => x.Id);
                    table.ForeignKey("FK_ProjectMilestones_Projects_ProjectId", x => x.ProjectId, "Projects", "Id", onDelete: ReferentialAction.Cascade);
                }
            );

            migrationBuilder.CreateTable(
                name: "TaskAssignments",
                columns: table => new
                {
                    Id = table.Column<int>(nullable: false).Annotation("Npgsql:ValueGenerationStrategy", Npgsql.EntityFrameworkCore.PostgreSQL.Metadata.NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    TaskId = table.Column<int>(nullable: false),
                    PersonId = table.Column<int>(nullable: false),
                    SharePercent = table.Column<int>(nullable: false),
                    IsPrimary = table.Column<bool>(nullable: false)
                },
                constraints: table => {
                    table.PrimaryKey("PK_TaskAssignments", x => x.Id);
                    table.ForeignKey("FK_TaskAssignments_People_PersonId", x => x.PersonId, "People", "Id", onDelete: ReferentialAction.Cascade);
                    table.ForeignKey("FK_TaskAssignments_Tasks_TaskId", x => x.TaskId, "Tasks", "Id", onDelete: ReferentialAction.Cascade);
                }
            );

            migrationBuilder.CreateTable(
                name: "TaskDependencies",
                columns: table => new
                {
                    Id = table.Column<int>(nullable: false).Annotation("Npgsql:ValueGenerationStrategy", Npgsql.EntityFrameworkCore.PostgreSQL.Metadata.NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    TaskId = table.Column<int>(nullable: false),
                    DependsOnTaskId = table.Column<int>(nullable: false)
                },
                constraints: table => {
                    table.PrimaryKey("PK_TaskDependencies", x => x.Id);
                    table.ForeignKey("FK_TaskDependencies_Tasks_TaskId", x => x.TaskId, "Tasks", "Id", onDelete: ReferentialAction.Cascade);
                    table.ForeignKey("FK_TaskDependencies_Tasks_DependsOnTaskId", x => x.DependsOnTaskId, "Tasks", "Id");
                }
            );

            migrationBuilder.CreateTable(
                name: "TimeOffs",
                columns: table => new
                {
                    Id = table.Column<int>(nullable: false).Annotation("Npgsql:ValueGenerationStrategy", Npgsql.EntityFrameworkCore.PostgreSQL.Metadata.NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    PersonId = table.Column<int>(nullable: false),
                    Date = table.Column<DateTime>(nullable: false),
                    Hours = table.Column<int>(nullable: false)
                },
                constraints: table => {
                    table.PrimaryKey("PK_TimeOffs", x => x.Id);
                    table.ForeignKey("FK_TimeOffs_People_PersonId", x => x.PersonId, "People", "Id", onDelete: ReferentialAction.Cascade);
                }
            );

            migrationBuilder.CreateIndex("IX_Projects_BankId","Projects","BankId");
            migrationBuilder.CreateIndex("IX_Tasks_ProjectId","Tasks","ProjectId");
            migrationBuilder.CreateIndex("IX_TaskAssignments_TaskId","TaskAssignments","TaskId");
            migrationBuilder.CreateIndex("IX_TaskAssignments_PersonId","TaskAssignments","PersonId");
            migrationBuilder.CreateIndex("IX_TaskDependencies_TaskId","TaskDependencies","TaskId");
            migrationBuilder.CreateIndex("IX_TaskDependencies_DependsOnTaskId","TaskDependencies","DependsOnTaskId");
            migrationBuilder.CreateIndex("IX_TimeOffs_PersonId","TimeOffs","PersonId");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable("TimeOffs");
            migrationBuilder.DropTable("TaskDependencies");
            migrationBuilder.DropTable("TaskAssignments");
            migrationBuilder.DropTable("ProjectMilestones");
            migrationBuilder.DropTable("Tasks");
            migrationBuilder.DropTable("Scenarios");
            migrationBuilder.DropTable("Holidays");
            migrationBuilder.DropTable("Projects");
            migrationBuilder.DropTable("People");
            migrationBuilder.DropTable("Banks");
        }
    }
}
